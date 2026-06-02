/**
 * sentimentITAEngine — V14.0 舆情ITA引擎（情绪优先·责任上移）
 * 对应文章1 §4.1：舆情ITA（情绪优先·责任上移）
 *
 * 核心机制:
 * - 情绪优先：系统监测到负面情绪爆表，立即触发Draft Hold（停发所有营销内容）
 * - 责任上移：事件自动Escalate给总部核，总部第一时间担责（明确回应"是我们的责任"），不甩锅给基层员工
 * - 行动优先：1小时内出台补偿方案（退货/赔偿），48小时后再发布详细调查报告
 * - 参考正例：胖东来、长城汽车的舆情处置逻辑代码化实现
 *
 * ITA-Trigger 预判型链路:
 *   I(信息): 舆情情绪指数爆表
 *   T(触发): 情绪得分 > 阈值 AND 成交量/提及量异常
 *   A(动作): Draft Hold → Escalate → Compensate → Report
 */

import logger from '../utils/logger';

// =============== Types ===============

/**
 * 舆情事件记录
 */
export interface SentimentEvent {
  id: string;
  timestamp: number;
  source: string;           // 信息来源（微博/微信/抖音/小红书）
  keyword: string;          // 监测关键词
  sentimentScore: number;     // 情绪得分 (0-10000, 0=极度负面, 5000=中性, 10000=极度正面)
  volume: number;            // 提及量/成交量
  trend: 'RISING' | 'FALLING' | 'STABLE';
  severity: SentimentSeverity;
  status: SentimentStatus;
  draftHoldActivated: boolean;  // Draft Hold 是否激活
  escalatedToHQ: boolean;    // 是否上报总部
  compensationPlan: CompensationPlan | null;
  investigationReport: InvestigationReport | null;
  resolvedAt?: number;
}

export enum SentimentSeverity {
  LOW = 'LOW',           // 轻度负面情绪
  MEDIUM = 'MEDIUM',   // 中度负面
  HIGH = 'HIGH',         // 高度负面
  CRITICAL = 'CRITICAL', // 危机级（情绪得分<1000）
}

export enum SentimentStatus {
  MONITORING = 'MONITORING',   // 监测中
  DRAFT_HOLD = 'DRAFT_HOLD',   // 停发营销内容
  ESCALATED = 'ESCALATED',     // 已上报总部
  COMPENSATING = 'COMPENSATING', // 补偿方案执行中
  REPORTING = 'REPORTING',     // 调查报告撰写中
  RESOLVED = 'RESOLVED',     // 已解决
  CLOSED = 'CLOSED',         // 已结案
}

/**
 * 补偿方案（1小时内出台）
 */
export interface CompensationPlan {
  id: string;
  triggeredAt: number;
  type: 'REFUND' | 'COMPENSATION' | 'REPLACEMENT' | 'APOLOGY';
  budget: number;
  coverage: string;          // 覆盖范围描述
  executionDeadline: number; // 执行截止时间（triggeredAt + 1h）
  approved: boolean;
  approvedBy?: string;
}

/**
 * 调查报告（48小时内发布）
 */
export interface InvestigationReport {
  id: string;
  triggeredAt: number;
  draftCompletedAt?: number;  // 初稿完成时间
  publishedAt?: number;      // 发布时间（triggeredAt + 48h）
  summary: string;
  rootCause: string;
  correctiveActions: string[];
  preventiveMeasures: string[];
  status: 'DRAFT' | 'REVIEWING' | 'PUBLISHED';
}

/**
 * ITA-Trigger 三元组（舆情专用）
 */
export interface SentimentITATrigger {
  id: string;
  eventId: string;
  triggerTime: number;
  information: {
    sentimentScore: number;
    volume: number;
    keyword: string;
    source: string;
  };
  actions: ITAAction[];
  status: 'PENDING' | 'FIRED' | 'COMPLETED';
}

export interface ITAAction {
  id: string;
  type: 'DRAFT_HOLD' | 'ESCALATE' | 'COMPENSATE' | 'REPORT';
  triggeredAt?: number;
  completedAt?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  result?: Record<string, unknown>;
}

// =============== Engine ===============

class SentimentITAEngine {
  private events: Map<string, SentimentEvent> = new Map();
  private triggers: Map<string, SentimentITATrigger> = new Map();
  private readonly SENTIMENT_THRESHOLD = 2000;   // 情绪得分阈值（<2000触发预警）
  private readonly VOLUME_SPIKE_THRESHOLD = 3.0; // 成交量突增倍数
  private readonly DRAFT_HOLD_WINDOW = 0;        // Draft Hold 即时激活
  private readonly COMPENSATION_WINDOW = 3600;   // 1小时内出台补偿方案
  private readonly REPORT_WINDOW = 172800;        // 48小时内发布调查报告

  // ------ 舆情监测 ------

  /**
   * 监测舆情情绪（核心入口）
   * 返回是否需要触发 ITA
   */
  monitorSentiment(
    source: string,
    keyword: string,
    sentimentScore: number,
    volume: number,
    trend: 'RISING' | 'FALLING' | 'STABLE',
  ): { triggered: boolean; eventId?: string; actions?: string[] } {
    // 判断是否触发预警
    const isCritical = sentimentScore < this.SENTIMENT_THRESHOLD;
    const isVolumeSpike = volume > 1000; // 简化：成交量>1000视为异常

    if (!isCritical && !isVolumeSpike) {
      return { triggered: false };
    }

    // 创建舆情事件
    const eventId = `sent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const severity = this.calculateSeverity(sentimentScore, volume);

    const event: SentimentEvent = {
      id: eventId,
      timestamp: Date.now(),
      source,
      keyword,
      sentimentScore,
      volume,
      trend,
      severity,
      status: SentimentStatus.MONITORING,
      draftHoldActivated: false,
      escalatedToHQ: false,
      compensationPlan: null,
      investigationReport: null,
    };

    this.events.set(eventId, event);

    // 触发 ITA 链路
    const actions = this.triggerITA(event);

    logger.warn(`[SentimentITA] Event DETECTED: id=${eventId}, sentiment=${sentimentScore}, severity=${severity}`);
    return { triggered: true, eventId, actions };
  }

  /**
   * 计算严重等级
   */
  private calculateSeverity(sentimentScore: number, volume: number): SentimentSeverity {
    if (sentimentScore < 1000 && volume > 5000) return SentimentSeverity.CRITICAL;
    if (sentimentScore < 2000) return SentimentSeverity.HIGH;
    if (sentimentScore < 3500) return SentimentSeverity.MEDIUM;
    return SentimentSeverity.LOW;
  }

  // ------ ITA 触发链路 ------

  /**
   * ITA-Trigger 预判型链路
   * I(信息): 舆情情绪指数爆表
   * T(触发): 情绪得分 > 阈值 AND 成交量/提及量异常
   * A(动作): Draft Hold → Escalate → Compensate → Report
   */
  private triggerITA(event: SentimentEvent): string[] {
    const triggerId = `ita_${event.id}`;
    const actions: ITAAction[] = [];

    // A1: Draft Hold（停发所有营销内容）— 即时激活
    actions.push({
      id: `act_${triggerId}_1`,
      type: 'DRAFT_HOLD',
      status: 'PENDING',
    });

    // A2: Escalate（上报总部）— 责任上移
    actions.push({
      id: `act_${triggerId}_2`,
      type: 'ESCALATE',
      status: 'PENDING',
    });

    // A3: Compensate（1小时内出台补偿方案）
    actions.push({
      id: `act_${triggerId}_3`,
      type: 'COMPENSATE',
      status: 'PENDING',
    });

    // A4: Report（48小时内发布调查报告）
    actions.push({
      id: `act_${triggerId}_4`,
      type: 'REPORT',
      status: 'PENDING',
    });

    const trigger: SentimentITATrigger = {
      id: triggerId,
      eventId: event.id,
      triggerTime: Date.now(),
      information: {
        sentimentScore: event.sentimentScore,
        volume: event.volume,
        keyword: event.keyword,
        source: event.source,
      },
      actions,
      status: 'PENDING',
    };

    this.triggers.set(triggerId, trigger);

    // 立即执行 Draft Hold
    this.executeDraftHold(event, trigger);

    return actions.map(a => a.type);
  }

  /**
   * A1: Draft Hold（停发所有营销内容）
   * 情绪优先：立即触发，不等待确认
   */
  private executeDraftHold(event: SentimentEvent, trigger: SentimentITATrigger): void {
    const action = trigger.actions.find(a => a.type === 'DRAFT_HOLD');
    if (!action) return;

    action.status = 'IN_PROGRESS';
    event.draftHoldActivated = true;
    event.status = SentimentStatus.DRAFT_HOLD;

    logger.warn(`[SentimentITA] DRAFT HOLD ACTIVATED: event=${event.id}, keyword=${event.keyword}`);
    logger.info(`[SentimentITA] All marketing content STOPPED for event ${event.id}`);

    action.triggeredAt = Date.now();
    action.status = 'COMPLETED';
  }

  /**
   * A2: Escalate（责任上移 — 上报总部）
   * 不甩锅给基层员工，总部第一时间担责
   */
  escalateToHQ(eventId: string, escalationNote: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    const trigger = Array.from(this.triggers.values()).find(t => t.eventId === eventId);
    const action = trigger?.actions.find(a => a.type === 'ESCALATE');

    if (action) {
      action.status = 'IN_PROGRESS';
      action.triggeredAt = Date.now();
    }

    event.escalatedToHQ = true;
    event.status = SentimentStatus.ESCALATED;

    // 参考胖东来/长城汽车：总部担责
    logger.error(`[SentimentITA] ESCALATED TO HQ: event=${eventId}`);
    logger.info(`[SentimentITA] HQ takes responsibility: "This is our fault." (not blaming frontline staff)`);
    logger.info(`[SentimentITA] Escalation note: ${escalationNote}`);

    if (action) {
      action.status = 'COMPLETED';
      action.completedAt = Date.now();
    }

    return true;
  }

  /**
   * A3: Compensate（1小时内出台补偿方案）
   * 行动优先：退货/赔偿
   */
  generateCompensationPlan(eventId: string, type: 'REFUND' | 'COMPENSATION' | 'REPLACEMENT' | 'APOLOGY', budget: number, coverage: string): CompensationPlan | null {
    const event = this.events.get(eventId);
    if (!event) return null;

    const now = Date.now();
    const plan: CompensationPlan = {
      id: `comp_${eventId}`,
      triggeredAt: now,
      type,
      budget,
      coverage,
      executionDeadline: now + this.COMPENSATION_WINDOW * 1000,
      approved: false,
    };

    event.compensationPlan = plan;
    event.status = SentimentStatus.COMPENSATING;

    const trigger = Array.from(this.triggers.values()).find(t => t.eventId === eventId);
    const action = trigger?.actions.find(a => a.type === 'COMPENSATE');

    if (action) {
      action.status = 'IN_PROGRESS';
      action.triggeredAt = now;
      // 模拟：1小时内完成审批
      setTimeout(() => {
        plan.approved = true;
        plan.approvedBy = 'HQ';
        action.status = 'COMPLETED';
        action.completedAt = Date.now();
        logger.info(`[SentimentITA] Compensation plan APPROVED: plan=${plan.id}, type=${type}, budget=${budget}`);
      }, 1000); // 模拟1秒后审批（实际应为1小时内）
    }

    logger.info(`[SentimentITA] Compensation plan GENERATED: event=${eventId}, type=${type}, deadline=${(plan.executionDeadline - now) / 1000}s`);
    return plan;
  }

  /**
   * A4: Report（48小时内发布调查报告）
   */
  generateInvestigationReport(eventId: string, summary: string, rootCause: string, correctiveActions: string[], preventiveMeasures: string[]): InvestigationReport | null {
    const event = this.events.get(eventId);
    if (!event) return null;

    const now = Date.now();
    const report: InvestigationReport = {
      id: `rpt_${eventId}`,
      triggeredAt: now,
      summary,
      rootCause,
      correctiveActions,
      preventiveMeasures,
      status: 'DRAFT',
    };

    event.investigationReport = report;
    event.status = SentimentStatus.REPORTING;

    const trigger = Array.from(this.triggers.values()).find(t => t.eventId === eventId);
    const action = trigger?.actions.find(a => a.type === 'REPORT');

    if (action) {
      action.status = 'IN_PROGRESS';
      action.triggeredAt = now;

      // 模拟：48小时内完成报告
      setTimeout(() => {
        report.draftCompletedAt = Date.now();
        report.status = 'REVIEWING';
        logger.info(`[SentimentITA] Investigation report DRAFT completed: report=${report.id}`);

        // 模拟：审核后发布
        setTimeout(() => {
          report.publishedAt = Date.now();
          report.status = 'PUBLISHED';
          event.status = SentimentStatus.RESOLVED;
          action.status = 'COMPLETED';
          action.completedAt = Date.now();
          logger.info(`[SentimentITA] Investigation report PUBLISHED: report=${report.id}`);
        }, 1000);
      }, 1000);
    }

    logger.info(`[SentimentITA] Investigation report STARTED: event=${eventId}, deadline=${(now + this.REPORT_WINDOW * 1000 - now) / 1000}s`);
    return report;
  }

  // ------ 查询方法 ------

  getEvent(eventId: string): SentimentEvent | null {
    return this.events.get(eventId) || null;
  }

  getEventsByStatus(status: SentimentStatus): SentimentEvent[] {
    return Array.from(this.events.values()).filter(e => e.status === status);
  }

  getTrigger(triggerId: string): SentimentITATrigger | null {
    return this.triggers.get(triggerId) || null;
  }

  /**
   * 获取舆情ITA统计
   */
  getStats(): Record<string, unknown> {
    const events = Array.from(this.events.values());
    const triggers = Array.from(this.triggers.values());

    return {
      totalEvents: events.length,
      bySeverity: {
        critical: events.filter(e => e.severity === SentimentSeverity.CRITICAL).length,
        high: events.filter(e => e.severity === SentimentSeverity.HIGH).length,
        medium: events.filter(e => e.severity === SentimentSeverity.MEDIUM).length,
        low: events.filter(e => e.severity === SentimentSeverity.LOW).length,
      },
      byStatus: {
        monitoring: events.filter(e => e.status === SentimentStatus.MONITORING).length,
        draftHold: events.filter(e => e.status === SentimentStatus.DRAFT_HOLD).length,
        escalated: events.filter(e => e.status === SentimentStatus.ESCALATED).length,
        compensating: events.filter(e => e.status === SentimentStatus.COMPENSATING).length,
        resolved: events.filter(e => e.status === SentimentStatus.RESOLVED).length,
      },
      totalTriggers: triggers.length,
      avgResponseTime: this.calculateAvgResponseTime(),
    };
  }

  private calculateAvgResponseTime(): number {
    const triggers = Array.from(this.triggers.values());
    if (triggers.length === 0) return 0;

    const totalTime = triggers
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => {
        const lastAction = t.actions[t.actions.length - 1];
        return sum + (lastAction?.completedAt || 0) - t.triggerTime;
      }, 0);

    return totalTime / triggers.length;
  }
}

const sentimentITAEngine = new SentimentITAEngine();
export { sentimentITAEngine };
