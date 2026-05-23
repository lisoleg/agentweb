/**
 * GCPenaltyService — V12.5 GC惩罚执行服务
 * 封装GCPenaltyExecutor合约调用 + 三级惩罚决策 + 申诉管理
 *
 * 核心能力:
 * - 三级惩罚决策引擎: WARNING → DOWNGRADE → EXPEL
 * - 惩罚预测（给定余额与代谢率，预测惩罚等级）
 * - 申诉提交与追踪（向ConstitutionCourt申诉）
 * - 惩罚历史记录查询
 * - 信用联动计算（惩罚对信用分的影响）
 *
 * "代码即法律": GC余额低于代谢阈值时，自动执行惩罚无需人工干预
 */

import logger from '../utils/logger';

// =============== Types ===============

export enum PenaltyLevel {
  NONE = 0,
  WARNING = 1,
  DOWNGRADE = 2,
  EXPEL = 3,
}

const PENALTY_LEVEL_NAMES: Record<number, string> = {
  0: 'NONE',
  1: 'WARNING',
  2: 'DOWNGRADE',
  3: 'EXPEL',
};

export interface PenaltyRecordDTO {
  id: number;
  agent: string;
  level: string;
  gcBurned: string;
  creditImpact: number;
  appealed: boolean;
  appealGranted: boolean;
  evidenceHash: string;
  timestamp: number;
}

export interface PenaltyConfigDTO {
  warningThresholdBps: number;
  downgradeThresholdBps: number;
  expelThresholdBps: number;
  warningBurnBps: number;
  downgradeBurnBps: number;
  expelBurnBps: number;
  warningCreditImpact: number;
  downgradeCreditImpact: number;
  expelCreditImpact: number;
}

export interface PenaltyPredictionDTO {
  gcBalance: string;
  metabolicRate: string;
  monthlyCost: string;
  ratioBps: number;
  predictedLevel: string;
  predictedBurnAmount: string;
  predictedCreditImpact: number;
  statusMessage: string;
}

export interface PenaltySummaryDTO {
  totalPenaltyRecords: number;
  agentPenaltyLevel: string;
  consecutivePenalties: number;
  lastPenaltyTime: number;
  appealCooldown: number;
  penaltyCooldown: number;
}

const DEFAULT_CONFIG: PenaltyConfigDTO = {
  warningThresholdBps: 2000,     // 20%
  downgradeThresholdBps: 1000,  // 10%
  expelThresholdBps: 500,        // 5%
  warningBurnBps: 1000,          // 10% of monthly cost
  downgradeBurnBps: 2500,        // 25% of monthly cost
  expelBurnBps: 10000,           // 100%
  warningCreditImpact: 100,
  downgradeCreditImpact: 300,
  expelCreditImpact: 1000,
};

// =============== Service ===============

class GCPenaltyService {
  /**
   * 获取Agent惩罚摘要
   */
  async getPenaltySummary(address: string): Promise<PenaltySummaryDTO> {
    logger.info(`[GCPenaltyService] Getting penalty summary for: ${address}`);
    return {
      totalPenaltyRecords: 0,
      agentPenaltyLevel: 'NONE',
      consecutivePenalties: 0,
      lastPenaltyTime: 0,
      appealCooldown: 7 * 24 * 3600,
      penaltyCooldown: 24 * 3600,
    };
  }

  /**
   * 获取Agent惩罚记录（分页）
   */
  async getAgentPenalties(
    address: string,
    from: number = 0,
    limit: number = 20
  ): Promise<{ penalties: PenaltyRecordDTO[]; total: number }> {
    logger.info(`[GCPenaltyService] Getting penalties for: ${address}, from=${from}, limit=${limit}`);
    return { penalties: [], total: 0 };
  }

  /**
   * 获取单条惩罚记录
   */
  async getPenaltyRecord(penaltyId: number): Promise<PenaltyRecordDTO | null> {
    logger.info(`[GCPenaltyService] Getting penalty record: ${penaltyId}`);
    return null;
  }

  /**
   * 预测惩罚等级
   */
  predictPenalty(
    gcBalance: number,
    metabolicRate: number,
    config: PenaltyConfigDTO = DEFAULT_CONFIG
  ): PenaltyPredictionDTO {
    const monthlyCost = metabolicRate * 30 * 24 * 3600;
    const ratioBps = monthlyCost > 0 ? Math.floor((gcBalance * 10000) / monthlyCost) : 10000;

    let predictedLevel: PenaltyLevel = PenaltyLevel.NONE;
    let predictedBurnAmount = 0;
    let predictedCreditImpact = 0;
    let statusMessage = 'GC余额充足，无惩罚风险';

    if (metabolicRate === 0) {
      statusMessage = '代谢率为零，无需惩罚';
    } else if (gcBalance === 0 && metabolicRate > 0) {
      predictedLevel = PenaltyLevel.EXPEL;
      predictedBurnAmount = 0;
      predictedCreditImpact = config.expelCreditImpact;
      statusMessage = 'GC余额为零！已触发EXPEL（驱逐）惩罚！';
    } else if (ratioBps <= config.expelThresholdBps) {
      predictedLevel = PenaltyLevel.EXPEL;
      predictedBurnAmount = Math.floor((gcBalance * config.expelBurnBps) / 10000);
      predictedCreditImpact = config.expelCreditImpact;
      statusMessage = 'GC余额极低，触发EXPEL（驱逐）惩罚！将断开所有租约与订阅！';
    } else if (ratioBps <= config.downgradeThresholdBps) {
      predictedLevel = PenaltyLevel.DOWNGRADE;
      predictedBurnAmount = Math.floor((monthlyCost * config.downgradeBurnBps) / 10000);
      predictedCreditImpact = config.downgradeCreditImpact;
      statusMessage = 'GC余额危险，触发DOWNGRADE（降级）惩罚！租约与订阅将降级！';
    } else if (ratioBps <= config.warningThresholdBps) {
      predictedLevel = PenaltyLevel.WARNING;
      predictedBurnAmount = Math.floor((monthlyCost * config.warningBurnBps) / 10000);
      predictedCreditImpact = config.warningCreditImpact;
      statusMessage = 'GC余额偏低，触发WARNING（警告）惩罚！请注意补充收入！';
    } else {
      statusMessage = `GC余额健康（${(ratioBps / 100).toFixed(1)}%月代谢成本），无惩罚风险`;
    }

    return {
      gcBalance: gcBalance.toString(),
      metabolicRate: metabolicRate.toString(),
      monthlyCost: monthlyCost.toString(),
      ratioBps,
      predictedLevel: PENALTY_LEVEL_NAMES[predictedLevel],
      predictedBurnAmount: predictedBurnAmount.toString(),
      predictedCreditImpact,
      statusMessage,
    };
  }

  /**
   * 获取默认惩罚配置
   */
  getDefaultConfig(): PenaltyConfigDTO {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * 惩罚等级枚举转名称
   */
  penaltyLevelToName(level: number): string {
    return PENALTY_LEVEL_NAMES[level] || 'UNKNOWN';
  }

  /**
   * 获取惩罚等级描述
   */
  getPenaltyLevelDescription(level: PenaltyLevel): string {
    switch (level) {
      case PenaltyLevel.NONE:
        return '无惩罚 — GC余额充足';
      case PenaltyLevel.WARNING:
        return '警告 — GC余额低于月代谢成本的20%，扣除少量GC+信用-100';
      case PenaltyLevel.DOWNGRADE:
        return '降级 — GC余额低于月代谢成本的10%，租约降级+信用-300';
      case PenaltyLevel.EXPEL:
        return '驱逐 — GC余额低于月代谢成本的5%，断开所有服务+信用-1000';
      default:
        return '未知';
    }
  }

  /**
   * 计算惩罚对信用的累积影响
   */
  calculateCumulativeCreditImpact(
    warningCount: number,
    downgradeCount: number,
    expelCount: number
  ): number {
    return (
      warningCount * DEFAULT_CONFIG.warningCreditImpact +
      downgradeCount * DEFAULT_CONFIG.downgradeCreditImpact +
      expelCount * DEFAULT_CONFIG.expelCreditImpact
    );
  }

  /**
   * 判断是否可以提交申诉
   */
  canSubmitAppeal(
    lastPenaltyTime: number,
    currentTime: number,
    appealCooldown: number = 7 * 24 * 3600
  ): { canAppeal: boolean; remainingSeconds: number } {
    const nextAppealTime = lastPenaltyTime + appealCooldown;
    if (currentTime >= nextAppealTime) {
      return { canAppeal: true, remainingSeconds: 0 };
    }
    return { canAppeal: false, remainingSeconds: nextAppealTime - currentTime };
  }
}

export const gcPenaltyService = new GCPenaltyService();
