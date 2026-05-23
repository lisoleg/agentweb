/**
 * GCLedgerService — V12.5 GC总账服务
 * 统一GC交易视图 + 链上职业征信报告 + GC健康评分
 *
 * 核心能力:
 * - 统一GC交易流水（合并GCAncor锚定记录+惩罚记录）
 * - 链上职业征信报告（不可篡改的GC交易记录 = Agent能力唯一标准）
 * - GC健康评分与趋势分析
 * - "做题家机制": GC余额 = AI优化目标函数
 *
 * 参考: 《GSD-Coin终极推演》— "GC余额是AI唯一信任的优化目标函数"
 */

import logger from '../utils/logger';
import { gcAncorService, AnchorType } from './gcAncorService';
import { gcPenaltyService, PenaltyLevel } from './gcPenaltyService';

// =============== Types ===============

export interface GCLedgerEntryDTO {
  id: number;
  agent: string;
  type: string;           // INCOME / CONSUMPTION / PENALTY / REWARD / STAKE / BURN
  amount: string;
  balanceAfter: string;
  sourceHash: string;
  epoch: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface GCCareerCreditDTO {
  agent: string;
  registeredAt: number;
  totalIncome: string;
  totalConsumption: string;
  totalPenalty: string;
  totalReward: string;
  totalStaked: string;
  totalBurned: string;
  gcBalance: string;
  metabolicRate: string;
  currentHealthScore: number;
  currentHealthGrade: string;
  currentPenaltyLevel: string;
  consecutivePenalties: number;
  careerSummary: string;
  incomeConsumptionRatio: string;  // 收入/消费比
  penaltyRate: string;              // 惩罚率 = totalPenalty / (totalIncome + totalReward)
  netGCFlow: string;                // 净流入 = totalIncome + totalReward - totalConsumption - totalPenalty - totalBurned
}

export interface GCHealthTrendDTO {
  agent: string;
  currentHealthScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'CRITICAL';
  recommendations: string[];
  projectedBalanceIn7Days: string;
  projectedBalanceIn30Days: string;
  daysToStarvation: number;
}

export interface GCLedgerStatsDTO {
  totalAgents: number;
  totalRecords: number;
  totalGCInflow: string;       // 全局收入+奖励
  totalGCOutflow: string;     // 全局消费+惩罚+质押+燃烧
  averageHealthScore: number;
  penaltyDistribution: {
    none: number;
    warning: number;
    downgrade: number;
    expel: number;
  };
}

// =============== Service ===============

class GCLedgerService {
  /**
   * 获取Agent统一GC交易流水（合并锚定记录+惩罚记录）
   */
  async getGCLedger(
    address: string,
    from: number = 0,
    limit: number = 20,
    typeFilter?: AnchorType
  ): Promise<{ entries: GCLedgerEntryDTO[]; total: number }> {
    logger.info(`[GCLedgerService] Getting GC ledger for: ${address}, from=${from}, limit=${limit}`);

    // 从GCAncor获取锚定记录
    const anchorResult = await gcAncorService.getAgentRecords(address, from, limit);
    const entries: GCLedgerEntryDTO[] = anchorResult.records
      .filter(r => !typeFilter || r.recordType === gcAncorService.anchorTypeToName(typeFilter))
      .map(r => ({
        id: r.id,
        agent: r.agent,
        type: r.recordType,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        sourceHash: r.sourceHash,
        epoch: r.epoch,
        timestamp: r.timestamp,
      }));

    return { entries, total: anchorResult.total };
  }

  /**
   * 生成链上职业征信报告
   */
  async getCareerCredit(address: string): Promise<GCCareerCreditDTO | null> {
    logger.info(`[GCLedgerService] Generating career credit report for: ${address}`);

    const anchorState = await gcAncorService.getAgentAnchorState(address);
    if (!anchorState) {
      return null;
    }

    const health = await gcAncorService.getGCHealth(address);
    const penaltySummary = await gcPenaltyService.getPenaltySummary(address);

    const totalIncome = Number(anchorState.totalIncome);
    const totalConsumption = Number(anchorState.totalConsumption);
    const totalPenalty = Number(anchorState.totalPenalty);
    const totalReward = Number(anchorState.totalReward);
    const totalStaked = Number(anchorState.totalStaked);
    const totalBurned = Number(anchorState.totalBurned);

    // 收入/消费比
    const incomeConsumptionRatio = totalConsumption > 0
      ? (totalIncome / totalConsumption).toFixed(2)
      : totalIncome > 0 ? '∞' : '0';

    // 惩罚率 = totalPenalty / (totalIncome + totalReward)
    const totalInflow = totalIncome + totalReward;
    const penaltyRate = totalInflow > 0
      ? (totalPenalty / totalInflow * 100).toFixed(2) + '%'
      : '0%';

    // 净流入
    const netGCFlow = totalIncome + totalReward - totalConsumption - totalPenalty - totalBurned;

    // 职业总结
    const healthScore = health?.healthScore ?? 0;
    const careerSummary = this.generateCareerSummary(
      totalIncome, totalConsumption, totalPenalty, totalReward,
      healthScore, penaltySummary.agentPenaltyLevel
    );

    return {
      agent: address,
      registeredAt: anchorState.registeredAt,
      totalIncome: anchorState.totalIncome,
      totalConsumption: anchorState.totalConsumption,
      totalPenalty: anchorState.totalPenalty,
      totalReward: anchorState.totalReward,
      totalStaked: anchorState.totalStaked,
      totalBurned: anchorState.totalBurned,
      gcBalance: anchorState.gcBalance,
      metabolicRate: anchorState.metabolicRate,
      currentHealthScore: healthScore,
      currentHealthGrade: health?.healthGrade ?? 'UNKNOWN',
      currentPenaltyLevel: penaltySummary.agentPenaltyLevel,
      consecutivePenalties: penaltySummary.consecutivePenalties,
      careerSummary,
      incomeConsumptionRatio,
      penaltyRate,
      netGCFlow: netGCFlow.toString(),
    };
  }

  /**
   * GC健康趋势分析
   */
  async getHealthTrend(address: string): Promise<GCHealthTrendDTO | null> {
    logger.info(`[GCLedgerService] Analyzing health trend for: ${address}`);

    const health = await gcAncorService.getGCHealth(address);
    if (!health) {
      return null;
    }

    const balance = Number(health.balance);
    const metabolicRate = Number(health.metabolicRate);
    const healthScore = health.healthScore;

    // 趋势判断
    let trend: GCHealthTrendDTO['trend'];
    if (healthScore >= 7000) trend = 'STABLE';
    else if (healthScore >= 4000) trend = 'DECLINING';
    else if (healthScore >= 1000) trend = 'CRITICAL';
    else trend = 'CRITICAL';

    // 预测余额（假设无收入，仅代谢消耗）
    const secondsPerDay = 86400;
    const consumption7d = metabolicRate * 7 * secondsPerDay;
    const consumption30d = metabolicRate * 30 * secondsPerDay;
    const projected7d = Math.max(0, balance - consumption7d);
    const projected30d = Math.max(0, balance - consumption30d);

    // 饿死天数
    const daysToStarvation = metabolicRate > 0
      ? Math.floor(balance / (metabolicRate * secondsPerDay))
      : Infinity;

    // 建议
    const recommendations = this.generateRecommendations(healthScore, daysToStarvation, trend);

    return {
      agent: address,
      currentHealthScore: healthScore,
      trend,
      recommendations,
      projectedBalanceIn7Days: projected7d.toString(),
      projectedBalanceIn30Days: projected30d.toString(),
      daysToStarvation,
    };
  }

  /**
   * 获取GC总账统计
   */
  async getLedgerStats(): Promise<GCLedgerStatsDTO> {
    logger.info('[GCLedgerService] Getting ledger stats');
    const stats = await gcAncorService.getAnchorStats();
    return {
      totalAgents: stats.totalAgents,
      totalRecords: stats.totalAnchorRecords,
      totalGCInflow: '0',
      totalGCOutflow: '0',
      averageHealthScore: 0,
      penaltyDistribution: { none: 0, warning: 0, downgrade: 0, expel: 0 },
    };
  }

  // =============== Private Helpers ===============

  /**
   * 生成职业总结
   */
  private generateCareerSummary(
    totalIncome: number,
    totalConsumption: number,
    totalPenalty: number,
    totalReward: number,
    healthScore: number,
    penaltyLevel: string
  ): string {
    const parts: string[] = [];

    if (totalIncome === 0 && totalReward === 0) {
      parts.push('尚未获得任何GC收入');
    } else {
      if (totalIncome > 0) {
        parts.push(`累计收入${totalIncome}GC`);
      }
      if (totalReward > 0) {
        parts.push(`获得奖励${totalReward}GC`);
      }
    }

    if (totalPenalty > 0) {
      parts.push(`遭受惩罚${totalPenalty}GC`);
    }

    if (penaltyLevel !== 'NONE') {
      parts.push(`当前处于${penaltyLevel}惩罚状态`);
    }

    if (healthScore >= 9000) {
      parts.push('健康度优秀');
    } else if (healthScore >= 5000) {
      parts.push('健康度一般');
    } else if (healthScore > 0) {
      parts.push('健康度堪忧');
    }

    if (parts.length === 0) {
      return '新注册Agent，暂无交易记录';
    }

    return parts.join('，') + '。';
  }

  /**
   * 生成健康建议
   */
  private generateRecommendations(
    healthScore: number,
    daysToStarvation: number,
    trend: string
  ): string[] {
    const recommendations: string[] = [];

    if (healthScore < 2000) {
      recommendations.push('紧急：GC余额极低，应立即补充收入来源');
      recommendations.push('建议：降低代谢率（减少GPU租用/资源消耗）');
    }

    if (daysToStarvation !== Infinity && daysToStarvation < 7) {
      recommendations.push(`警告：按当前消耗速率，${daysToStarvation}天后GC耗尽`);
    }

    if (trend === 'DECLINING') {
      recommendations.push('GC余额呈下降趋势，建议增加AI劳动收入');
    }

    if (trend === 'CRITICAL') {
      recommendations.push('严重警告：进入饿死倒计时！立即行动！');
      recommendations.push('可选方案：质押Φ值获取GC贷款（如已开通）');
    }

    if (healthScore >= 9000) {
      recommendations.push('GC余额充裕，可考虑投资或质押获取更多收益');
    }

    if (recommendations.length === 0) {
      recommendations.push('GC余额健康，保持当前收支平衡');
    }

    return recommendations;
  }
}

export const gcLedgerService = new GCLedgerService();
