/**
 * L4: 人机回环服务 (Human-In-The-Loop Service)
 *
 * 基于MetaMask Agent Wallet的"异常交易强制2FA"设计：
 *
 * 触发条件（来自策略沙箱或门控管线）：
 * - 交易超出预设规则
 * - 系统判定为高风险
 * - 用户手动要求
 *
 * 执行机制：
 * - AI无法自行拍板
 * - 通过推送/邮件/短信/Telegram发送二次验证
 * - 用户必须手动点击确认或拒绝
 * - 超时未处理 = 自动拒绝
 *
 * 设计模式：
 * - **Human-in-the-Loop (HITL)** — 关键决策拉入人类
 * - **Out-of-Band Authentication** — 带外认证通道
 * - **Policy-based Escalation** — 策略驱动的升级链
 *
 * @version V17.0
 */

import crypto from 'crypto';
import {
  HITLRequest,
  HITLStatus,
  FullGatePipelineResult,
  HITLTriggerCondition,
  NotificationChannel,
} from './types';
import type { TransactionId } from '../oplc/types';

// ============================================================================
// 内存存储
// ============================================================================

const hitlRequests = new Map<string, HITLRequest>();
const notificationLog = new Array<{
  requestId: string;
  channel: NotificationChannel;
  sentAt: Date;
  delivered: boolean;
}>();

// ============================================================================
// 配置
// ============================================================================

const DEFAULT_CONFIG = {
  /** 默认超时时间(ms) —— 5分钟 */
  defaultTimeoutMs: 5 * 60 * 1000,

  /** 最大重试次数 */
  maxRetries: 3,

  /** 重试间隔(ms) */
  retryIntervalMs: 30_000,

  /** 默认通知渠道优先级 */
  channelPriority: [
    'in_app',
    'push_notification',
    'telegram',
    'email',
    'sms',
  ] as NotificationChannel[],
};

// ============================================================================
// 工具函数
// ============================================================================

function generateRequestId(): string {
  return `hitl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function generateSignature(payload: string): string {
  return `hitl_sig_${crypto.createHash('sha256').update(payload).digest('hex').substring(0, 20)}`;
}

/**
 * 根据风险级别决定通知渠道
 *
 * LOW → in_app
 * MEDIUM → push_notification + in_app
 * HIGH → push + telegram/email
 * CRITICAL → all channels
 */
function determineChannels(riskLevel: HITLRequest['userFacingSummary']['riskLevel']): NotificationChannel[] {
  const priority = [...DEFAULT_CONFIG.channelPriority];

  switch (riskLevel) {
    case 'LOW':
      return ['in_app'];
    case 'MEDIUM':
      return priority.slice(0, 2);
    case 'HIGH':
      return priority.slice(0, 4);
    case 'CRITICAL':
      return priority;
    default:
      return ['in_app'];
  }
}

// ============================================================================
// HumanInLoopService 类
// ============================================================================

export class HumanInLoopService {
  private stats = {
    totalRequests: 0,
    approvedCount: 0,
    rejectedCount: 0,
    expiredCount: 0,
    escalatedCount: 0,
    avgResponseMs: 0,
    totalResponseMs: 0,
  };

  /**
   * 创建HITL请求
   *
   * 当策略沙箱或门控管线判定需要人工干预时调用
   */
  async createHitlRequest(params: {
    agentDid: string;
    transactionId: TransactionId;
    gateResult: FullGatePipelineResult;
    triggeredCondition: HITLTriggerCondition;

    /** 用户可见的操作摘要 */
    userSummary: {
      title: string;
      description: string;
      amount: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      previewData?: Record<string, unknown>;
    };

    /** 自定义超时时间（可选） */
    customTimeoutMs?: number;

    /** 自定义通知渠道（可选，默认根据风险级别自动选择） */
    overrideChannels?: NotificationChannel[];
  }): Promise<HITLRequest> {
    const requestId = generateRequestId();
    const timeout = params.customTimeoutMs || DEFAULT_CONFIG.defaultTimeoutMs;
    const channels = params.overrideChannels || determineChannels(params.userSummary.riskLevel);

    // 发送通知（模拟）
    await this.sendNotifications(requestId, channels);

    const request: HITLRequest = {
      requestId,
      agentDid: params.agentDid,
      transactionId: params.transactionId,
      gateResult: params.gateResult,
      triggeredCondition: params.triggeredCondition,
      userFacingSummary: params.userSummary,
      notificationChannels: channels,
      expiresAt: new Date(Date.now() + timeout),
      status: HITLStatus.PENDING,
      createdAt: new Date(),
    };

    hitlRequests.set(requestId, request);
    this.stats.totalRequests++;

    // 启动超时计时器（生产环境用外部调度器）
    this.scheduleExpiryCheck(requestId, timeout);

    return request;
  }

  /**
   * 用户批准HITL请求
   */
  approveRequest(
    requestId: string,
    userSignature?: string,
  ): { success: boolean; request?: HITLRequest; error?: string } {
    const req = hitlRequests.get(requestId);
    if (!req) return { success: false, error: 'Request not found' };

    if (req.status !== HITLStatus.PENDING) {
      return {
        success: false,
        error: `Request already ${req.status}`,
        request: req,
      };
    }

    if (new Date() > req.expiresAt) {
      req.status = HITLStatus.EXPIRED;
      this.stats.expiredCount++;
      return { success: false, error: 'Request expired', request: req };
    }

    // 更新请求状态
    req.status = HITLStatus.APPROVED;
    req.respondedAt = new Date();
    req.userResponseSignature = userSignature || generateSignature(`approved:${requestId}`);

    this.recordResponse(req);
    return { success: true, request: req };
  }

  /**
   * 用户拒绝HITL请求
   */
  rejectRequest(
    requestId: string,
    reason?: string,
  ): { success: boolean; request?: HITLRequest; error?: string } {
    const req = hitlRequests.get(requestId);
    if (!req) return { success: false, error: 'Request not found' };

    if (req.status !== HITLStatus.PENDING) {
      return { success: false, error: `Request already ${req.status}` };
    }

    req.status = HITLStatus.REJECTED;
    req.respondedAt = new Date();
    req.userResponseSignature = generateSignature(`rejected:${requestId}:${reason || ''}`);

    this.recordResponse(req);
    return { success: true, request: req };
  }

  /**
   * 升级请求到更高权限审批者
   */
  escalateRequest(
    requestId: string,
    escalationReason: string,
  ): boolean {
    const req = hitlRequests.get(requestId);
    if (!req) return false;

    req.status = HITLStatus.ESCALATED;
    this.stats.escalatedCount++;

    // 实际实现：将请求转发给管理员/多签钱包/DAO治理合约
    console.log(`[HITL-ESCALATION] ${requestId} escalated: ${escalationReason}`);
    return true;
  }

  /**
   * 查询请求状态
   */
  getRequest(requestId: string): HITLRequest | undefined {
    // 检查过期
    this.checkExpiry(requestId);
    return hitlRequests.get(requestId);
  }

  /**
   * 列出Agent的所有HITL请求
   */
  listRequestsByAgent(agentDid: string, options?: {
    status?: HITLStatus;
    limit?: number;
  }): HITLRequest[] {
    let requests = Array.from(hitlRequests.values())
      .filter((r) => r.agentDid === agentDid);

    if (options?.status) {
      requests = requests.filter((r) => r.status === options.status);
    }
    if (options?.limit) {
      requests = requests.slice(-options.limit);
    }

    // 对每个请求检查过期
    requests.forEach((r) => this.checkExpiry(r.requestId));

    return requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 批量清理过期请求
   */
  cleanupExpired(): number {
    let cleaned = 0;
    for (const [id, req] of hitlRequests.entries()) {
      if (req.status === HITLStatus.PENDING && new Date() > req.expiresAt) {
        req.status = HITLStatus.EXPIRED;
        this.stats.expiredCount++;
        cleaned++;
      }
    }
    return cleaned;
  }

  /** 获取统计信息 */
  getStats() {
    return {
      ...this.stats,
      pendingCount: Array.from(hitlRequests.values()).filter(
        (r) => r.status === HITLStatus.PENDING
      ).length,
      avgResponseMs:
        this.stats.approvedCount + this.stats.rejectedCount > 0
          ? this.stats.totalResponseMs / (this.stats.approvedCount + this.stats.rejectedCount)
          : 0,
      approvalRate:
        this.stats.totalRequests > 0
          ? this.stats.approvedCount / this.stats.totalRequests
          : 0,
    };
  }

  /** 获取通知日志 */
  getNotificationLog(limit = 50) {
    return notificationLog.slice(-limit);
  }

  // ========================================================================
  // 内部方法
  // ========================================================================

  private async sendNotifications(
    requestId: string,
    channels: NotificationChannel[],
  ): Promise<void> {
    for (const channel of channels) {
      // 模拟通知发送（实际集成FCM/APNS/SMTP/Telegram Bot等）
      notificationLog.push({
        requestId,
        channel,
        sentAt: new Date(),
        delivered: Math.random() > 0.05, // 95%送达率模拟
      });

      console.log(`[HITL-NOTIFY] ${requestId} via ${channel}`);
    }
  }

  private scheduleExpiryCheck(requestId: string, timeoutMs: number): void {
    // 生产环境使用Redis TTL或cron调度器
    // 这里仅做记录，不启动真实定时器（避免内存泄漏）
    setTimeout(() => {
      this.checkExpiry(requestId);
    }, timeoutMs + 1000); // 额外1s缓冲
  }

  private checkExpiry(requestId: string): void {
    const req = hitlRequests.get(requestId);
    if (req && req.status === HITLStatus.PENDING && new Date() > req.expiresAt) {
      req.status = HITLStatus.EXPIRED;
      this.stats.expiredCount++;
    }
  }

  private recordResponse(req: HITLRequest): void {
    if (req.status === HITLStatus.APPROVED) {
      this.stats.approvedCount++;
    } else if (req.status === HITLStatus.REJECTED) {
      this.stats.rejectedCount++;
    }

    if (req.respondedAt && req.createdAt) {
      const responseMs = req.respondedAt.getTime() - req.createdAt.getTime();
      this.stats.totalResponseMs += responseMs;
      const totalResponses = this.stats.approvedCount + this.stats.rejectedCount;
      this.stats.avgResponseMs = this.stats.totalResponseMs / totalResponses;
    }
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let instance: HumanInLoopService | null = null;

export function getInstance(): HumanInLoopService {
  if (!instance) {
    instance = new HumanInLoopService();
  }
  return instance;
}
