/**
 * L6: 经济安全池 (Economic Safety Pool)
 *
 * 基于MetaMask Agent Wallet的"交易保护计划(Transaction Protection)"设计：
 * - 凡系统判定为"安全"的交易出问题 → 最高赔付 $10,000/月
 * - 验证节点Stake质押机制（类似PoS slashing）
 * - 举报人奖励（激励安全生态）
 *
 * 设计模式：**经济激励对齐的安全机制**
 * 将安全从"技术问题"转化为"经济问题"
 *
 * 核心公式：
 *   赔付上限 = min(月预算, 实际损失, 质押额 × 赔付比例)
 *   罚没金额 = 违规严重度 × 基础罚金系数
 *   举报人奖励 = 罚没金额 × 举报奖励比例(默认10%)
 *
 * @version V17.0
 */

import crypto from 'crypto';
import {
  StakeEntry,
  SlashingEvent,
  ClaimRequest,
  EconomicSafetyPoolStats,
} from './types';

// ============================================================================
// 内存存储
// ============================================================================

const stakes = new Map<string, StakeEntry>();
const slashings = new Map<string, SlashingEvent>();
const claims = new Map<string, ClaimRequest>();

// ============================================================================
// 配置常量
// ============================================================================

const POOL_CONFIG = {
  /** 月赔付预算上限 */
  monthlyPayoutBudget: 50_000,           // $50,000/月

  /** 单次最大赔付比例（相对于质押额） */
  maxPayoutRatio: 0.8,                   // 最多赔付80%的质押额

  /** 举报人奖励比例 */
  reporterRewardRatio: 0.1,              // 10%

  /** 最小质押期限（天） */
  minLockDays: 30,

  /** 各违规类型的罚金系数 */
  slashCoefficients: {
    privacy_breach: 0.5,                 // 隐私泄露 → 扣除50%质押
    policy_violation: 0.3,               // 策略违反 → 30%
    fraudulent_activity: 1.0,             // 欺诈行为 → 全部没收
    collusion: 0.7,                       // 共谋攻击 → 70%
    availability_failure: 0.2,            // 可用性故障 → 20%（较轻）
  } as Record<string, number>,

  /** 质押冷却期（解锁后需等待的天数才能提取） */
  unlockCooldownDays: 7,

  /** 赔付申请审核超时时间（天） */
  claimReviewMaxDays: 14,
};

// ============================================================================
// 工具函数
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function calculateSlashAmount(
  baseAmount: number,
  reason: SlashingEvent['slashReason'],
): number {
  const coeff = POOL_CONFIG.slashCoefficients[reason] || 0.3;
  return Math.floor(baseAmount * coeff);
}

// ============================================================================
// EconomicSafetyPool 类
// ============================================================================

export class EconomicSafetyPool {
  private poolStats = {
    totalStaked: 0,
    totalSlashed: 0,
    totalPaidOut: 0,
    totalClaimsSubmitted: 0,
    totalClaimsApproved: 0,
    totalClaimsRejected: 0,
    totalSlashingEvents: 0,
    activeStakers: new Set<string>(),
  };

  // ====== 质押操作 ======

  /**
   * Agent Owner为Agent质押
   *
   * 质押后Agent获得更高的信任等级和操作权限
   * 同时也承担被slashing的经济风险
   */
  stake(params: {
    agentDid: string;
    stakerDid: string;
    amount: number;
    currency?: string;
    lockDurationDays?: number;
  }): StakeEntry {
    const stakeId = generateId('stake');
    const lockDays = params.lockDurationDays || POOL_CONFIG.minLockDays;

    const entry: StakeEntry = {
      stakeId,
      agentDid: params.agentDid,
      stakerDid: params.stakerDid,
      amount: params.amount,
      currency: params.currency || 'USD',
      lockedUntil: new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000),
      status: 'active',
      stakedAt: new Date(),
    };

    stakes.set(stakeId, entry);
    this.poolStats.totalStaked += params.amount;
    this.poolStats.activeStakers.add(params.stakerDid);

    return entry;
  }

  /**
   * 解锁质押（到期后可提取）
   */
  unlockStake(stakeId: string): { success: boolean; reason?: string; remainingCooldownMs?: number } {
    const entry = stakes.get(stakeId);
    if (!entry) return { success: false, reason: 'Stake not found' };
    if (entry.status === 'slashed') return { success: false, reason: 'Already slashed' };
    if (entry.status === 'unlocked') return { success: false, reason: 'Already unlocked' };

    const now = new Date();

    // 检查是否已过锁定期
    if (now < entry.lockedUntil) {
      return {
        success: false,
        reason: 'Still in lock period',
        remainingCooldownMs: entry.lockedUntil.getTime() - now.getTime(),
      };
    }

    // 检查冷却期（防止立即提取用于再质押规避风险）
    const cooldownEnd = new Date(entry.lockedUntil.getTime() + POOL_CONFIG.unlockCooldownDays * 24 * 60 * 60 * 1000);
    if (now < cooldownEnd) {
      return {
        success: false,
        reason: 'In cooldown period',
        remainingCooldownMs: cooldownEnd.getTime() - now.getTime(),
      };
    }

    entry.status = 'unlocked';
    this.poolStats.totalStaked -= entry.amount;
    this.poolStats.activeStakers.delete(entry.stakerDid);

    return { success: true };
  }

  /**
   * 查询质押状态
   */
  getStake(stakeId: string): StakeEntry | null {
    return stakes.get(stakeId) || null;
  }

  /**
   * 列出Agent的所有质押
   */
  getStakesByAgent(agentDid: string): StakeEntry[] {
    return Array.from(stakes.values()).filter((s) => s.agentDid === agentDid);
  }

  // ====== Slashing操作 ======

  /**
   * 执行罚没（由治理合约或多数验证节点触发）
   *
   * 触发条件：
   * - 隐私泄露事件确认
   * - 严重策略违反
   * - 欺诈行为证实
   * - 共谋攻击检测
   */
  executeSlashing(params: {
    stakeId: string;
    slashReason: SlashingEvent['slashReason'];
    evidenceHash: string;
    reporterDid?: string;              // 可选：举报人DID
  }): SlashingEvent | null {
    const stake = stakes.get(params.stakeId);
    if (!stake || stake.status !== 'active') return null;

    const slashedAmount = calculateSlashAmount(stake.amount, params.slashReason);
    const reporterReward = params.reporterDid
      ? Math.floor(slashedAmount * POOL_CONFIG.reporterRewardRatio)
      : 0;

    const event: SlashingEvent = {
      eventId: generateId('slash'),
      stakeId: params.stakeId,
      agentDid: stake.agentDid,
      slashReason: params.slashReason,
      slashedAmount,
      remainingStake: stake.amount - slashedAmount,
      reporterReward,
      reporterDid: params.reporterDid,
      eventTime: new Date(),
    };

    // 更新质押状态
    stake.amount -= slashedAmount;
    if (stake.amount <= 0) {
      stake.status = 'slashed';
      this.poolStats.activeStakers.delete(stake.stakerDid);
    }

    slashings.set(event.eventId, event);

    // 更新统计
    this.poolStats.totalSlashed += slashedAmount;
    this.poolStats.totalStaked -= slashedAmount;
    this.poolStats.totalSlashingEvents++;

    return event;
  }

  /**
   * 列出所有罚没事件
   */
  listSlashings(options?: { agentDid?: string; limit?: number }): SlashingEvent[] {
    let events = Array.from(slashings.values());

    if (options?.agentDid) {
      events = events.filter((e) => e.agentDid === options.agentDid);
    }
    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events.sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());
  }

  // ====== 赔付操作 ======

  /**
   * 提交赔付申请
   *
   * 条件：
   * - 该交易的门控管线结果为passed
   * - 用户遭受了实际损失
   * - 提供了证据哈希
   */
  submitClaim(params: {
    transactionId: string;
    claimantDid: string;
    claimedLossAmount: number;
    evidence: string;
    gatePipelineResultId: string;
  }): ClaimRequest {
    const claimId = generateId('claim');

    const request: ClaimRequest = {
      claimId,
      transactionId: params.transactionId,
      claimantDid: params.claimantDid,
      claimedLossAmount: params.claimedLossAmount,
      evidence: params.evidence,
      gatePipelineResultId: params.gatePipelineResultId,
      status: 'pending_review',
      submittedAt: new Date(),
    };

    claims.set(claimId, request);
    this.poolStats.totalClaimsSubmitted++;

    return request;
  }

  /**
   * 审核赔付申请
   *
   * 由多签委员会/DAO治理执行
   */
  reviewClaim(
    claimId: string,
    approved: boolean,
    reviewerNote?: string,
  ): ClaimRequest | null {
    const claim = claims.get(claimId);
    if (!claim || claim.status !== 'pending_review') return null;

    // 检查月预算
    if (approved) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthlyPaidSoFar = Array.from(claims.values())
        .filter(
          (c) => c.status === 'paid_out' &&
          c.reviewedAt &&
          c.reviewedAt >= monthStart
        )
        .reduce((sum, c) => sum + (c.payoutAmount || 0), 0);

      const maxPayoutForThisClaim = Math.min(
        claim.claimedLossAmount,
        POOL_CONFIG.monthlyPayoutBudget - monthlyPaidSoFar,
      );

      // 检查是否有足够质押支持
      const agentStakes = this.getStakesByAgent(claim.claimantDid);
      const totalAgentStake = agentStakes
        .filter((s) => s.status === 'active')
        .reduce((sum, s) => sum + s.amount, 0);

      const finalPayout = Math.min(
        maxPayoutForThisClaim,
        totalAgentStake * POOL_CONFIG.maxPayoutRatio,
      );

      claim.payoutAmount = Math.max(0, finalPayout);
    }

    claim.status = approved ? 'approved' : 'rejected';
    claim.reviewedAt = new Date();

    if (approved) {
      this.poolStats.totalClaimsApproved++;
      this.poolStats.totalPaidOut += claim.payoutAmount || 0;
      // 自动标记为paid_out（生产环境需要实际转账步骤）
      claim.status = 'paid_out';
    } else {
      this.poolStats.totalClaimsRejected++;
    }

    return claim;
  }

  /**
   * 查询赔付申请状态
   */
  getClaim(claimId: string): ClaimRequest | undefined {
    return claims.get(claimId);
  }

  /**
   * 列出用户的赔付申请
   */
  getClaimsByClaimant(claimantDid: string): ClaimRequest[] {
    return Array.from(claims.values())
      .filter((c) => c.claimantDid === claimantDid)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  // ====== 统计与查询 ======

  /** 获取经济池完整统计 */
  getPoolStats(): EconomicSafetyPoolStats {
    const avgProcessingMs =
      this.poolStats.totalClaimsApproved > 0
        ? 3_600_000 // 平均约1小时（模拟值）
        : 0;

    return {
      totalStaked: this.poolStats.totalStaked,
      totalSlashed: this.poolStats.totalSlashed,
      totalPaidOut: this.poolStats.totalPaidOut,
      payoutRatio:
        this.poolStats.totalStaked > 0
          ? this.poolStats.totalPaidOut / this.poolStats.totalStaked
          : 0,
      activeAgents: this.poolStats.activeStakers.size,
      monthlyBudgetRemaining: POOL_CONFIG.monthlyPayoutBudget - this.getMonthlyPaidTotal(),
      avgClaimProcessingMs: avgProcessingMs,
    };
  }

  /** 获取本月已赔付总额 */
  private getMonthlyPaidTotal(): number {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return Array.from(claims.values())
      .filter(
        (c) =>
          c.status === 'paid_out' &&
          c.reviewedAt &&
          c.reviewedAt >= monthStart
      )
      .reduce((sum, c) => sum + (c.payoutAmount || 0), 0);
  }

  /** 获取完整统计（含内部指标） */
  getFullStats() {
    return {
      pool: this.getPoolStats(),
      config: POOL_CONFIG,
      internal: {
        totalStakes: stakes.size,
        activeStakes: Array.from(stakes.values()).filter(
          (s) => s.status === 'active'
        ).length,
        totalSlashings: slashings.size,
        totalClaims: claims.size,
        pendingClaims: Array.from(claims.values()).filter(
          (c) => c.status === 'pending_review'
        ).length,
      },
    };
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: EconomicSafetyPool | null = null;

export function getInstance(): EconomicSafetyPool {
  if (!instance) {
    instance = new EconomicSafetyPool();
  }
  return instance;
}
