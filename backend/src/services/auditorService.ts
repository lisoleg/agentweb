/**
 * auditorService — V14.0 纪委Auditor自监督服务
 * 对应文章1 §3：监督（Supervision）—— 纪委Auditor与自监督
 *
 * 核心机制:
 * - 只读快照（ReadOnly Snapshot）：仅查看系统运行账目，不干预业务执行
 * - Veto Power（否决权）：发现违规行为立即冻结（Freeze），叫停"乱作为"
 * - ReadLog（双录双存）：所有决策全程留痕，支持终身追责（一案双查）
 * - 认知递归复盘（RRP）：系统出现Near-Miss（未遂错误）时，必须触发复盘流程
 * - 错误进系统定理（Thm5.1）：三次同类错误未整改，系统自动上报纪委
 * - 防躺平监测：监测节点流贯密度，密度过低触发预警并调整权重
 *
 * 类比：
 *   业务Agent = 市长（负责干事）
 *   Auditor Agent = 纪委（监督市长不贪腐、不懒政）
 *   RRP = 民主生活会（复盘纠错）
 */

import logger from '../utils/logger';

// =============== Types ===============

/**
 * Auditor 审计记录
 */
export interface AuditRecord {
  id: string;
  timestamp: number;
  agentId: string;
  actionType: AuditActionType;
  severity: AuditSeverity;
  description: string;
  evidenceHash: string;      // 证据哈希（Merkle根）
  relatedTransaction?: string;
  status: AuditStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  appealable: boolean;
}

export enum AuditActionType {
  FREEZE = 'FREEZE',           // 冻结Agent
  UNFREEZE = 'UNFREEZE',       // 解冻Agent
  VETO = 'VETO',               // 否决决策
  WARNING = 'WARNING',           // 警告
  INFO_REQUEST = 'INFO_REQUEST', // 信息调阅
  SNAPSHOT = 'SNAPSHOT',       // 只读快照
  ERROR_REPORT = 'ERROR_REPORT', // 错误上报（Thm5.1）
  LAYFLAT_WARN = 'LAYFLAT_WARN', // 防躺平预警
  DUAL_RECORD = 'DUAL_RECORD',  // 双录双存
}

export enum AuditSeverity {
  LOW = 'LOW',         // 轻度异常
  MEDIUM = 'MEDIUM',  // 中度违规
  HIGH = 'HIGH',       // 重度违规
  CRITICAL = 'CRITICAL', // 系统性风险
}

export enum AuditStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
  CONFIRMED = 'CONFIRMED',
  DISMISSED = 'DISMISSED',
  APPEALED = 'APPEALED',
}

/**
 * Near-Miss 未遂错误记录（触发RRP认知递归复盘）
 */
export interface NearMissRecord {
  id: string;
  timestamp: number;
  agentId: string;
  errorType: string;         // 错误类型标签
  description: string;
  context: Record<string, unknown>;
  preventedAt: number;        // 错误被阻止的时间戳
  triggerRRP: boolean;        // 是否已触发RRP复盘
  rrpCompletedAt?: number;
  similarErrors: string[];     // 同类错误ID列表（用于Thm5.1判断）
}

/**
 * RRP 认知递归复盘记录
 */
export interface RRPRecord {
  id: string;
  nearMissId: string;
  startedAt: number;
  completedAt?: number;
  findings: string;            // 复盘发现
  actionItems: string[];      // 整改行动项
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED';
  esclated: boolean;          // 是否触发Thm5.1上报
}

/**
 * 流贯密度监测记录（防躺平）
 */
export interface FlowDensityRecord {
  agentId: string;
  timestamp: number;
  density: number;            // 流贯密度 (0-10000)
  taskCompletionRate: number;  // 任务完成率
  avgResponseTime: number;     // 平均响应时间(ms)
  status: 'NORMAL' | 'LOW' | 'CRITICAL';
  weightAdjustment: number;    // 权重调整量（负值表示降权）
}

/**
 * 定理5.1 状态：三次同类错误未整改 → 自动上报纪委
 */
export interface Theorem51Status {
  agentId: string;
  errorType: string;
  occurrenceCount: number;
  lastOccurrence: number;
  rectified: boolean;
  autoReported: boolean;      // 是否已自动上报
  reportedAt?: number;
}

// =============== Service ===============

class AuditorService {
  private auditRecords: Map<string, AuditRecord> = new Map();
  private nearMissRecords: Map<string, NearMissRecord> = new Map();
  private rrpRecords: Map<string, RRPRecord> = new Map();
  private flowDensityRecords: FlowDensityRecord[] = [];
  private theorem51Map: Map<string, Theorem51Status[]> = new Map(); // agentId → statuses

  private readonly THM51_THRESHOLD = 3;  // 三次同类错误触发上报
  private readonly FLOW_DENSITY_LOW_THRESHOLD = 3000;  // 流贯密度低于此值预警
  private readonly FLOW_DENSITY_CRITICAL_THRESHOLD = 1000;

  // ------- 只读快照 -------

  /**
   * 获取系统只读快照（不修改任何状态）
   * 类比：纪委巡视组，仅查看账目
   */
  getReadOnlySnapshot(scope: 'AGENT' | 'CONTRACT' | 'TRANSACTION' | 'FULL'): Record<string, unknown> {
    const snapshot = {
      timestamp: Date.now(),
      scope,
      data: {} as Record<string, unknown>,
    };

    switch (scope) {
      case 'AGENT':
        snapshot.data = { agents: 'read-only-placeholder', note: 'Auditor read-only snapshot of agent states' };
        break;
      case 'CONTRACT':
        snapshot.data = { contracts: 'read-only-placeholder', note: 'Auditor read-only snapshot of contract states' };
        break;
      case 'TRANSACTION':
        snapshot.data = { transactions: 'read-only-placeholder', note: 'Auditor read-only snapshot of transaction logs' };
        break;
      case 'FULL':
        snapshot.data = { full: 'read-only-placeholder', note: 'Auditor full system snapshot' };
        break;
    }

    logger.info(`[AuditorService] ReadOnlySnapshot taken: scope=${scope}`);
    return snapshot;
  }

  // ------- Veto Power -------

  /**
   * 否决权：发现违规行为立即冻结Agent
   * 类比：纪委叫停"乱作为"
   */
  vetoAndFreeze(agentId: string, reason: string, severity: AuditSeverity): AuditRecord {
    const record: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      agentId,
      actionType: AuditActionType.FREEZE,
      severity,
      description: `VETO FREEZE: ${reason}`,
      evidenceHash: `0x${Math.random().toString(16).substring(2, 18)}`,
      status: AuditStatus.CONFIRMED,
      appealable: true,
    };

    this.auditRecords.set(record.id, record);
    logger.warn(`[AuditorService] VETO FREEZE: agent=${agentId}, reason=${reason}, severity=${severity}`);
    return record;
  }

  /**
   * 解冻Agent（需Auditor确认）
   */
  unfreeze(agentId: string, auditorId: string): AuditRecord | null {
    const freezeRecords = Array.from(this.auditRecords.values())
      .filter(r => r.agentId === agentId && r.actionType === AuditActionType.FREEZE && r.status === AuditStatus.CONFIRMED);

    if (freezeRecords.length === 0) {
      logger.warn(`[AuditorService] No active freeze found for agent=${agentId}`);
      return null;
    }

    const record: AuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      agentId,
      actionType: AuditActionType.UNFREEZE,
      severity: AuditSeverity.LOW,
      description: `UNFREEZE by auditor=${auditorId}`,
      evidenceHash: `0x${Math.random().toString(16).substring(2, 18)}`,
      status: AuditStatus.CONFIRMED,
      reviewedBy: auditorId,
      reviewedAt: Date.now(),
      appealable: false,
    };

    this.auditRecords.set(record.id, record);
    logger.info(`[AuditorService] UNFREEZE: agent=${agentId} by auditor=${auditorId}`);
    return record;
  }

  // ------- ReadLog 双录双存 -------

  /**
   * 双录双存：所有决策全程留痕
   * 支持终身追责（一案双查）
   */
  dualRecordLog(decision: {
    agentId: string;
    decisionType: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    reasoning: string;
    timestamp?: number;
  }): string {
    const recordId = `dual_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record = {
      id: recordId,
      ...decision,
      timestamp: decision.timestamp || Date.now(),
      hash: `0x${Buffer.from(JSON.stringify(decision)).toString('hex').substring(0, 40)}`,
    };

    // 双存：内存 + 模拟链上（实际部署时写入区块链）
    this.auditRecords.set(`dual_${recordId}`, {
      id: `dual_${recordId}`,
      timestamp: record.timestamp,
      agentId: decision.agentId,
      actionType: AuditActionType.DUAL_RECORD,
      severity: AuditSeverity.LOW,
      description: `Dual record: ${decision.decisionType}`,
      evidenceHash: record.hash,
      status: AuditStatus.CONFIRMED,
      appealable: false,
    } as any);

    logger.info(`[AuditorService] DualRecord: agent=${decision.agentId}, type=${decision.decisionType}, hash=${record.hash}`);
    return recordId;
  }

  // ------- Near-Miss & RRP -------

  /**
   * 记录Near-Miss（未遂错误），自动触发RRP复盘
   */
  recordNearMiss(agentId: string, errorType: string, description: string, context: Record<string, unknown>): NearMissRecord {
    const id = `nmiss_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record: NearMissRecord = {
      id,
      timestamp: Date.now(),
      agentId,
      errorType,
      description,
      context,
      preventedAt: Date.now(),
      triggerRRP: true,
      similarErrors: this.findSimilarErrors(agentId, errorType),
    };

    this.nearMissRecords.set(id, record);

    // 自动触发RRP复盘
    this.triggerRRP(id);

    // 检查Thm5.1：三次同类错误未整改 → 自动上报
    this.checkTheorem51(agentId, errorType);

    logger.warn(`[AuditorService] NearMiss recorded: agent=${agentId}, type=${errorType}, id=${id}`);
    return record;
  }

  /**
   * RRP 认知递归复盘
   */
  private triggerRRP(nearMissId: string): RRPRecord {
    const nearMiss = this.nearMissRecords.get(nearMissId);
    if (!nearMiss) throw new Error(`NearMiss ${nearMissId} not found`);

    const rrpId = `rrp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const rrp: RRPRecord = {
      id: rrpId,
      nearMissId,
      startedAt: Date.now(),
      findings: `RRP findings for ${nearMiss.errorType}: recursive review initiated`,
      actionItems: ['Review similar errors', 'Update prevention rules', 'Notify agent'],
      status: 'IN_PROGRESS',
      esclated: false,
    };

    this.rrpRecords.set(rrpId, rrp);
    nearMiss.triggerRRP = true;
    nearMiss.rrpCompletedAt = undefined;

    logger.info(`[AuditorService] RRP triggered: nearMiss=${nearMissId}, rrp=${rrpId}`);
    return rrp;
  }

  /**
   * 完成RRP复盘
   */
  completeRRP(rrpId: string, findings: string, actionItems: string[]): RRPRecord | null {
    const rrp = this.rrpRecords.get(rrpId);
    if (!rrp) return null;

    rrp.findings = findings;
    rrp.actionItems = actionItems;
    rrp.status = 'COMPLETED';
    rrp.completedAt = Date.now();

    const nearMiss = this.nearMissRecords.get(rrp.nearMissId);
    if (nearMiss) {
      nearMiss.rrpCompletedAt = Date.now();
    }

    logger.info(`[AuditorService] RRP completed: rrp=${rrpId}`);
    return rrp;
  }

  // ------- 定理5.1 -------

  /**
   * 检查错误进系统定理（Thm5.1）
   * 三次同类错误未整改 → 系统自动上报纪委
   */
  private checkTheorem51(agentId: string, errorType: string): boolean {
    const key = `${agentId}::${errorType}`;
    let status = this.theorem51Map.get(agentId)?.find(s => s.errorType === errorType);

    if (!status) {
      status = {
        agentId,
        errorType,
        occurrenceCount: 0,
        lastOccurrence: Date.now(),
        rectified: false,
        autoReported: false,
      };
      const list = this.theorem51Map.get(agentId) || [];
      list.push(status);
      this.theorem51Map.set(agentId, list);
    }

    status.occurrenceCount++;
    status.lastOccurrence = Date.now();

    if (status.occurrenceCount >= this.THM51_THRESHOLD && !status.rectified) {
      status.autoReported = true;
      status.reportedAt = Date.now();
      logger.error(`[AuditorService] Thm5.1 TRIGGERED: agent=${agentId}, errorType=${errorType}, count=${status.occurrenceCount}`);
      return true;
    }

    return false;
  }

  /**
   * 标记错误已整改（阻止Thm5.1上报）
   */
  rectifyError(agentId: string, errorType: string): boolean {
    const list = this.theorem51Map.get(agentId);
    if (!list) return false;
    const status = list.find(s => s.errorType === errorType);
    if (!status) return false;

    status.rectified = true;
    logger.info(`[AuditorService] Error rectified: agent=${agentId}, errorType=${errorType}`);
    return true;
  }

  // ------- 防躺平监测 -------

  /**
   * 监测节点流贯密度（防躺平）
   * 密度过低（出工不出力）→ 触发预警并调整对应节点权重
   */
  monitorFlowDensity(agentId: string, density: number, taskCompletionRate: number, avgResponseTime: number): FlowDensityRecord {
    let status: 'NORMAL' | 'LOW' | 'CRITICAL' = 'NORMAL';
    let weightAdjustment = 0;

    if (density < this.FLOW_DENSITY_CRITICAL_THRESHOLD) {
      status = 'CRITICAL';
      weightAdjustment = -500; // 大幅降权
    } else if (density < this.FLOW_DENSITY_LOW_THRESHOLD) {
      status = 'LOW';
      weightAdjustment = -200; // 适度降权
    }

    const record: FlowDensityRecord = {
      agentId,
      timestamp: Date.now(),
      density,
      taskCompletionRate,
      avgResponseTime,
      status,
      weightAdjustment,
    };

    this.flowDensityRecords.push(record);

    if (status !== 'NORMAL') {
      logger.warn(`[AuditorService] Layflat WARN: agent=${agentId}, density=${density}, adjustment=${weightAdjustment}`);
    }

    return record;
  }

  // ------- 辅助方法 -------

  private findSimilarErrors(agentId: string, errorType: string): string[] {
    return Array.from(this.nearMissRecords.values())
      .filter(r => r.agentId === agentId && r.errorType === errorType)
      .map(r => r.id);
  }

  // ------- 查询方法 -------

  getAuditRecord(recordId: string): AuditRecord | null {
    return this.auditRecords.get(recordId) || null;
  }

  getAuditRecordsByAgent(agentId: string): AuditRecord[] {
    return Array.from(this.auditRecords.values()).filter(r => r.agentId === agentId);
  }

  getNearMissRecords(agentId: string): NearMissRecord[] {
    return Array.from(this.nearMissRecords.values()).filter(r => r.agentId === agentId);
  }

  getTheorem51Status(agentId: string): Theorem51Status[] {
    return this.theorem51Map.get(agentId) || [];
  }

  getFlowDensityHistory(agentId: string, limit = 50): FlowDensityRecord[] {
    return this.flowDensityRecords
      .filter(r => r.agentId === agentId)
      .slice(-limit);
  }

  /**
   * 审计服务统计
   */
  getStats(): Record<string, unknown> {
    const records = Array.from(this.auditRecords.values());
    const nearMisses = Array.from(this.nearMissRecords.values());
    const rrpRecords = Array.from(this.rrpRecords.values());

    return {
      totalAuditRecords: records.length,
      freezeCount: records.filter(r => r.actionType === AuditActionType.FREEZE).length,
      vetoCount: records.filter(r => r.actionType === AuditActionType.VETO).length,
      dualRecordCount: records.filter(r => r.actionType === AuditActionType.DUAL_RECORD).length,
      totalNearMiss: nearMisses.length,
      totalRRP: rrpRecords.length,
      rrpCompleted: rrpRecords.filter(r => r.status === 'COMPLETED').length,
      thm51Triggered: Array.from(this.theorem51Map.values())
        .flat().filter(s => s.autoReported).length,
      flowDensityRecords: this.flowDensityRecords.length,
    };
  }
}

const auditorService = new AuditorService();
export { auditorService };
