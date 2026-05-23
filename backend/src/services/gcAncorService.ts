/**
 * GCAncorService — V12.5 GC锚定层服务
 * 封装GCAncor合约调用 + 锚定记录查询 + Merkle证明 + 自动奖励/惩罚触发
 *
 * 核心能力:
 * - 查询Agent锚定状态（余额、代谢率、饿死倒计时、健康度）
 * - 分页查询锚定记录（收入/消费/惩罚/奖励/质押/燃烧）
 * - 周期结算与Merkle根验证
 * - GC健康度评分（0-10000）
 * - 自动奖励触发（余额>5倍月代谢成本）
 */

import logger from '../utils/logger';

// =============== Types ===============

export enum AnchorType {
  INCOME = 0,
  CONSUMPTION = 1,
  PENALTY = 2,
  REWARD = 3,
  STAKE = 4,
  BURN = 5,
}

const ANCHOR_TYPE_NAMES: Record<number, string> = {
  0: 'INCOME',
  1: 'CONSUMPTION',
  2: 'PENALTY',
  3: 'REWARD',
  4: 'STAKE',
  5: 'BURN',
};

export interface AnchorRecordDTO {
  id: number;
  agent: string;
  recordType: string;
  amount: string;
  balanceAfter: string;
  sourceHash: string;
  epoch: number;
  timestamp: number;
}

export interface AgentAnchorStateDTO {
  totalIncome: string;
  totalConsumption: string;
  totalPenalty: string;
  totalReward: string;
  totalStaked: string;
  totalBurned: string;
  gcBalance: string;
  metabolicRate: string;
  secondsToStarve: string;
  isActive: boolean;
  lastSettleEpoch: number;
  registeredAt: number;
}

export interface GCHealthDTO {
  balance: string;
  metabolicRate: string;
  secondsToStarve: string;
  monthlyCost: string;
  healthScore: number;
  healthGrade: string;
  statusMessage: string;
}

export interface EpochSummaryDTO {
  epoch: number;
  totalIncome: string;
  totalConsumption: string;
  totalPenalties: string;
  totalRewards: string;
  activeAgents: number;
  merkleRoot: string;
  settledAt: number;
}

export interface GCAnchorStatsDTO {
  totalAnchorRecords: number;
  currentEpoch: number;
  epochDuration: number;
  autoRewardThresholdBps: number;
  rewardRateBps: number;
  totalAgents: number;
}

// =============== Service ===============

class GCAncorService {
  /**
   * 获取Agent锚定状态
   */
  async getAgentAnchorState(address: string): Promise<AgentAnchorStateDTO | null> {
    logger.info(`[GCAncorService] Getting anchor state for: ${address}`);
    // 模拟数据（实际从合约读取）
    return null;
  }

  /**
   * 获取Agent GC健康度
   */
  async getGCHealth(address: string): Promise<GCHealthDTO | null> {
    logger.info(`[GCAncorService] Getting GC health for: ${address}`);
    // 模拟数据（实际从合约getGCHealth读取）
    return null;
  }

  /**
   * 获取Agent锚定记录（分页）
   */
  async getAgentRecords(
    address: string,
    from: number = 0,
    limit: number = 20
  ): Promise<{ records: AnchorRecordDTO[]; total: number }> {
    logger.info(`[GCAncorService] Getting records for: ${address}, from=${from}, limit=${limit}`);
    return { records: [], total: 0 };
  }

  /**
   * 获取单条锚定记录
   */
  async getAnchorRecord(recordId: number): Promise<AnchorRecordDTO | null> {
    logger.info(`[GCAncorService] Getting anchor record: ${recordId}`);
    return null;
  }

  /**
   * 获取周期结算摘要
   */
  async getEpochSummary(epoch: number): Promise<EpochSummaryDTO | null> {
    logger.info(`[GCAncorService] Getting epoch summary: ${epoch}`);
    return null;
  }

  /**
   * 获取周期Merkle根
   */
  async getEpochMerkleRoot(epoch: number): Promise<string | null> {
    logger.info(`[GCAncorService] Getting epoch merkle root: ${epoch}`);
    return null;
  }

  /**
   * 获取锚定层统计
   */
  async getAnchorStats(): Promise<GCAnchorStatsDTO> {
    return {
      totalAnchorRecords: 0,
      currentEpoch: 1,
      epochDuration: 86400,
      autoRewardThresholdBps: 50000,
      rewardRateBps: 100,
      totalAgents: 0,
    };
  }

  /**
   * 计算GC健康等级
   */
  calculateHealthGrade(healthScore: number): string {
    if (healthScore >= 9000) return 'HEALTHY';
    if (healthScore >= 7000) return 'GOOD';
    if (healthScore >= 5000) return 'FAIR';
    if (healthScore >= 2000) return 'WARNING';
    if (healthScore >= 500) return 'CRITICAL';
    return 'STARVING';
  }

  /**
   * 获取健康状态消息
   */
  getHealthStatusMessage(healthScore: number): string {
    if (healthScore >= 9000) return 'GC余额充足，可正常消费与投资';
    if (healthScore >= 7000) return 'GC余额良好，代谢成本可覆盖';
    if (healthScore >= 5000) return 'GC余额一般，注意控制消费';
    if (healthScore >= 2000) return 'GC余额偏低，建议补充收入来源';
    if (healthScore >= 500) return 'GC余额危险！即将触发惩罚机制';
    return 'GC余额极低！已进入饿死倒计时！';
  }

  /**
   * 锚定类型枚举转名称
   */
  anchorTypeToName(typeIndex: number): string {
    return ANCHOR_TYPE_NAMES[typeIndex] || 'UNKNOWN';
  }

  /**
   * 预测饿死时间
   */
  predictStarveTime(
    gcBalance: number,
    metabolicRate: number
  ): { secondsToStarve: number; daysToStarve: number; hoursToStarve: number } {
    if (metabolicRate === 0) {
      return { secondsToStarve: Infinity, daysToStarve: Infinity, hoursToStarve: Infinity };
    }
    const seconds = Math.floor(gcBalance / metabolicRate);
    return {
      secondsToStarve: seconds,
      daysToStarve: Math.floor(seconds / 86400),
      hoursToStarve: Math.floor(seconds / 3600),
    };
  }

  /**
   * 估算月代谢成本
   */
  estimateMonthlyCost(metabolicRate: number): number {
    return metabolicRate * 30 * 24 * 3600; // 30天
  }

  /**
   * 判断是否触发自动奖励
   */
  isAutoRewardTriggered(
    gcBalance: number,
    metabolicRate: number,
    thresholdBps: number = 50000
  ): { triggered: boolean; excessAmount: number; rewardAmount: number } {
    const monthlyCost = this.estimateMonthlyCost(metabolicRate);
    const threshold = monthlyCost * thresholdBps / 10000;
    const excess = gcBalance > threshold ? gcBalance - threshold : 0;
    const reward = excess * 100 / 10000; // rewardRateBps=100 → 1%

    return {
      triggered: gcBalance >= threshold,
      excessAmount: excess,
      rewardAmount: reward,
    };
  }
}

export const gcAncorService = new GCAncorService();
