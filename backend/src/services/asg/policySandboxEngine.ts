/**
 * L2: 策略沙箱引擎 (Policy Sandbox Engine)
 *
 * 基于MetaMask Agent Wallet的"规则约束层"设计：
 * - 用户预设策略边界（日消费上限、协议白名单、时间窗口等）
 * - Guard Mode（默认/严格）vs Beast Mode（可选/宽松）
 * - 每个操作请求先通过策略评估，不合规直接拒绝
 *
 * 核心设计模式：**策略沙箱 (Policy Sandbox)**
 * AI在预设边界内运行，越界即拦截
 *
 * @version V17.0
 */

import {
  AgentMode,
  AgentPolicy,
  AgentOperationRequest,
  HITLTriggerCondition,
} from './types';

// ============================================================================
// 策略评估结果
// ============================================================================

export interface PolicyEvaluationResult {
  /** 是否通过策略检查 */
  allowed: boolean;

  /** 不通过的原因 */
  denialReason?:
    | 'daily_limit_exceeded'          // 日消费超限
    | 'per_tx_limit_exceeded'         // 单笔超限
    | 'protocol_not_whitelisted'      // 协议不在白名单
    | 'asset_not_whitelisted'         // 资产不在白名单
    | 'outside_time_window'           // 超出时间窗口
    | 'outside_allowed_days'          // 非允许的星期几
    | 'agent_suspended'               // Agent被暂停
    | 'agent_frozen';                 // Agent被冻结

  /** 触发的HITL条件 */
  hitlTrigger?: HITLTriggerCondition;

  /** 当前日已消费金额 */
  dailySpent?: number;

  /** 日限额剩余 */
  dailyRemaining?: number;

  /** 当前模式 */
  currentMode: AgentMode;

  /** 评估耗时(ms) */
  evaluationMs: number;
}

// ============================================================================
// 日消费追踪（内存存储，生产环境用Redis/数据库）
// ============================================================================

interface DailySpendingTracker {
  agentDid: string;
  date: string;                       // YYYY-MM-DD
  totalSpent: number;
  transactions: Array<{
    txId: string;
    amount: number;
    timestamp: number;
  }>;
}

const spendingTrackers = new Map<string, DailySpendingTracker>();

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getOrCreateTracker(agentDid: string): DailySpendingTracker {
  const today = getTodayKey();
  const key = `${agentDid}:${today}`;

  let tracker = spendingTrackers.get(key);
  if (!tracker) {
    tracker = { agentDid, date: today, totalSpent: 0, transactions: [] };
    spendingTrackers.set(key, tracker);
  }

  // 清理过期数据（保留7天）
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [k, t] of spendingTrackers.entries()) {
    if (new Date(t.date).getTime() < cutoff) {
      spendingTrackers.delete(k);
    }
  }

  return tracker;
}

// ============================================================================
// PolicySandboxEngine 类
// ============================================================================

export class PolicySandboxEngine {
  private evaluationStats = {
    totalEvaluations: 0,
    allowedCount: 0,
    deniedCount: 0,
    hitlTriggeredCount: 0,
    totalEvaluationMs: 0,
  };

  /**
   * 评估操作请求是否满足策略约束
   *
   * 这是ASG的第一道防线——所有请求必须先过策略沙箱
   */
  evaluate(
    request: AgentOperationRequest,
    policy: AgentPolicy,
    agentStatus: string,
  ): PolicyEvaluationResult {
    const startTime = Date.now();
    this.evaluationStats.totalEvaluations++;

    // ===== 快速预检 =====

    // 1. Agent状态检查
    if (agentStatus === 'frozen') {
      return this.buildResult(false, 'agent_frozen', policy.mode, startTime);
    }
    if (agentStatus === 'suspended' || agentStatus === 'revoked') {
      return this.buildResult(false, 'agent_suspended', policy.mode, startTime);
    }

    // 2. 时间窗口检查
    const timeCheck = this.checkTimeWindow(policy.timeWindow);
    if (!timeCheck.passed) {
      // Beast模式下时间窗口仅作为HITL触发而非硬拒绝
      if (policy.mode === AgentMode.GUARD) {
        return this.buildResult(false, 'outside_time_window', policy.mode, startTime);
      }
      // Beast模式下触发HITL
      return this.buildHitlResult(
        request,
        policy,
        'outside_time_window',
        policy.mode,
        startTime
      );
    }

    // ===== 资金相关检查 =====

    // 3. 提取涉及金额
    const totalAmount = this.extractTotalAmount(request);

    // 4. 单笔限制检查
    if (totalAmount > policy.perTransactionLimit) {
      return this.buildResult(false, 'per_tx_limit_exceeded', policy.mode, startTime, {
        dailySpent: this.getDailySpending(request.agentDid)?.spent ?? 0,
        dailyRemaining: 0,
      });
    }

    // 5. 日消费限制检查
    const tracker = getOrCreateTracker(request.agentDid);
    const newDailyTotal = tracker.totalSpent + totalAmount;

    if (newDailyTotal > policy.dailySpendingLimit) {
      return this.buildResult(false, 'daily_limit_exceeded', policy.mode, startTime, {
        dailySpent: tracker.totalSpent,
        dailyRemaining: Math.max(0, policy.dailySpendingLimit - tracker.totalSpent),
      });
    }

    // ===== 白名单检查 =====

    // 6. 协议白名单
    if (
      policy.protocolWhitelist.length > 0 &&
      !policy.protocolWhitelist.includes('*') &&
      !policy.protocolWhitelist.includes(request.targetProtocol)
    ) {
      return this.buildHitlResult(
        request,
        policy,
        'protocol_not_in_whitelist',
        policy.mode,
        startTime
      );
    }

    // 7. 资产白名单
    const assetsInvolved = request.assetMovements.map((m) => m.asset);
    const assetViolated = assetsInvolved.some(
      (a) =>
        policy.assetWhitelist.length > 0 &&
        !policy.assetWhitelist.includes('*') &&
        !policy.assetWhitelist.includes(a)
    );

    if (assetViolated) {
      return this.buildHitlResult(
        request,
        policy,
        'asset_not_in_whitelist',
        policy.mode,
        startTime
      );
    }

    // ===== HITL条件匹配 =====

    // 8. 检查是否需要强制HITL
    if (request.forceHitl || this.shouldForceHitl(request, policy)) {
      return this.buildHitlResult(request, policy, 'high_risk_score', policy.mode, startTime);
    }

    // ===== 全部通过 =====

    // 预记录消费（实际执行时确认）
    this.evaluationStats.allowedCount++;
    return {
      allowed: true,
      currentMode: policy.mode,
      dailySpent: tracker.totalSpent,
      dailyRemaining: Math.max(0, policy.dailySpendingLimit - newDailyTotal),
      evaluationMs: Date.now() - startTime,
    };
  }

  /**
   * 确认交易执行后更新日消费追踪器
   */
  confirmSpending(agentDid: string, amount: number): void {
    const tracker = getOrCreateTracker(agentDid);
    tracker.totalSpent += amount;
    tracker.transactions.push({
      txId: `tx_${Date.now()}`,
      amount,
      timestamp: Date.now(),
    });
  }

  /**
   * 重置某Agent的日消费（管理员操作或用户手动重置）
   */
  resetDailySpending(agentDid: string): void {
    const key = `${agentDid}:${getTodayKey()}`;
    const tracker = spendingTrackers.get(key);
    if (tracker) {
      tracker.totalSpent = 0;
      tracker.transactions = [];
    }
  }

  /**
   * 获取当前日消费信息
   */
  getDailySpending(agentDid: string): {
    spent: number;
    limit: number;
    remaining: number;
    transactionCount: number;
  } | null {
    const tracker = spendingTrackers.get(`${agentDid}:${getTodayKey()}`);
    return tracker
      ? {
          spent: tracker.totalSpent,
          limit: 0, // 需要从policy获取，这里返回0表示未知
          remaining: 0,
          transactionCount: tracker.transactions.length,
        }
      : null;
  }

  /** 获取引擎统计 */
  getStats() {
    return {
      ...this.evaluationStats,
      avgEvaluationMs:
        this.evaluationStats.totalEvaluations > 0
          ? this.evaluationStats.totalEvaluationMs / this.evaluationStats.totalEvaluations
          : 0,
      activeTrackers: spendingTrackers.size,
    };
  }

  // ========================================================================
  // 内部方法
  // ========================================================================

  private checkTimeWindow(timeWindow: AgentPolicy['timeWindow']): { passed: boolean } {
    const now = new Date();

    // 时区处理（简化版：使用UTC偏移计算本地时间）
    let localHour: number;
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeWindow.timezone,
        hour: 'numeric',
        hour12: false,
      });
      localHour = parseInt(formatter.format(now), 10);
    } catch {
      localHour = now.getUTCHours(); // fallback to UTC
    }

    const fromH = parseInt(timeWindow.activeFrom.split(':')[0], 10);
    const untilH = parseInt(timeWindow.activeUntil.split(':')[0], 10);

    // 处理跨午夜的情况（如 22:00 - 06:00）
    let inWindow: boolean;
    if (fromH > untilH) {
      inWindow = localHour >= fromH || localHour < untilH;
    } else {
      inWindow = localHour >= fromH && localHour < untilH;
    }

    // 星期几检查
    if (timeWindow.allowedDays && timeWindow.allowedDays.length > 0) {
      const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
      if (!timeWindow.allowedDays.includes(dayOfWeek)) {
        return { passed: false };
      }
    }

    return { passed: inWindow };
  }

  private extractTotalAmount(request: AgentOperationRequest): number {
    // 提取所有"out"方向的资产金额总和
    return request.assetMovements
      .filter((m) => m.direction === 'out')
      .reduce((sum, m) => {
        try {
          return sum + parseFloat(m.amount) || 0;
        } catch {
          return sum;
        }
      }, 0);
  }

  private shouldForceHitl(request: AgentOperationRequest, policy: AgentPolicy): boolean {
    // 大额交易自动触发HITL
    const amount = this.extractTotalAmount(request);
    if (amount >= policy.perTransactionLimit * 0.8) {
      return true; // 超过单笔80%自动触发
    }

    // Guard模式下始终需要HITL
    if (policy.mode === AgentMode.GUARD) {
      return true;
    }

    return false;
  }

  private buildResult(
    allowed: boolean,
    denialReason: PolicyEvaluationResult['denialReason'],
    mode: AgentMode,
    startTime: number,
    extra?: { dailySpent?: number; dailyRemaining?: number },
  ): PolicyEvaluationResult {
    if (!allowed) this.evaluationStats.deniedCount++;

    return {
      allowed,
      ...(allowed ? {} : { denialReason }),
      currentMode: mode,
      ...extra,
      evaluationMs: Date.now() - startTime,
    };
  }

  private buildHitlResult(
    request: AgentOperationRequest,
    policy: AgentPolicy,
    conditionType: HITLTriggerCondition['conditionType'],
    mode: AgentMode,
    startTime: number,
  ): PolicyEvaluationResult {
    this.evaluationStats.hitlTriggeredCount++;

    const trigger: HITLTriggerCondition = {
      triggerId: `ht_${Date.now()}`,
      conditionType,
      requiredAction: 'approve',
    };

    // 在Beast模式下，某些条件仍可放行（标记为需通知但不阻止）
    const allowedInBeast = mode === AgentMode.BEAST &&
      ['outside_time_window', 'protocol_not_in_whitelisted'].includes(conditionType);

    if (!allowedInBeast) {
      this.evaluationStats.deniedCount++;
    }

    return {
      allowed: allowedInBeast,
      hitlTrigger: trigger,
      currentMode: mode,
      evaluationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: PolicySandboxEngine | null = null;

export function getInstance(): PolicySandboxEngine {
  if (!instance) {
    instance = new PolicySandboxEngine();
  }
  return instance;
}
