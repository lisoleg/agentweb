/**
 * DynamicFeeScheduler — V12.0 动态费率调度
 * 6GNetGPT"通算一体融合调度"思想: 费率根据网络状态动态调整
 * 
 * feeMultiplier = baseFee × congestionFactor × computeFactor × distanceFactor
 */

import logger from '../utils/logger';

// =============== Types ===============

export interface FeeSchedule {
  baseFee: number;             // 基础费率 (基点)
  congestionFactor: number;    // 拥堵因子 (1.0-3.0)
  computeFactor: number;       // 计算因子 (1.0-2.0)
  distanceFactor: number;      // 跨链距离因子 (1.0-2.0)
  totalMultiplier: number;     // 总乘数 (基点)
  updatedAt: string;
}

export interface NetworkState {
  activeRelayCount: number;
  pendingTasks: number;
  averageLoad: number;         // 0-1
  computeDemand: number;       // 0-1
}

// =============== Scheduler ===============

class DynamicFeeScheduler {
  private currentSchedule: FeeSchedule;
  private networkState: NetworkState;

  constructor() {
    this.currentSchedule = {
      baseFee: 100, // 1% 基础费率
      congestionFactor: 1.0,
      computeFactor: 1.0,
      distanceFactor: 1.0,
      totalMultiplier: 100,
      updatedAt: new Date().toISOString(),
    };

    this.networkState = {
      activeRelayCount: 0,
      pendingTasks: 0,
      averageLoad: 0,
      computeDemand: 0,
    };
  }

  /**
   * 更新网络状态
   */
  updateNetworkState(state: Partial<NetworkState>): void {
    this.networkState = { ...this.networkState, ...state };
    this._recalculateFees();
  }

  /**
   * 获取当前费率
   */
  getCurrentSchedule(): FeeSchedule {
    return { ...this.currentSchedule };
  }

  /**
   * 计算指定链对的费率
   */
  calculateFee(
    sourceChainId: number,
    targetChainId: number,
    taskType: 'MESSAGE_RELAY' | 'COMPUTE_RELAY',
    computeUnits?: number
  ): number {
    const schedule = this.currentSchedule;
    const distance = this._calculateChainDistance(sourceChainId, targetChainId);
    const distanceFactor = 1.0 + distance * 0.1;

    let fee = schedule.baseFee * schedule.congestionFactor * distanceFactor;

    if (taskType === 'COMPUTE_RELAY') {
      fee *= schedule.computeFactor;
      if (computeUnits) {
        fee *= (1 + computeUnits / 10000);
      }
    }

    return Math.round(fee);
  }

  /**
   * 获取信用联动费率
   */
  getCreditAdjustedFee(baseFeeBps: number, creditGrade: number): number {
    // AAA(0)→0.7x, AA(1)→0.8x, A(2)→0.9x, BBB(3)→1.0x, BB(4)→1.2x, B(5)→1.4x, CCC(6)→1.5x
    const multipliers = [0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.5];
    const multiplier = multipliers[creditGrade] || 1.5;
    return Math.round(baseFeeBps * multiplier);
  }

  /**
   * 重新计算费率
   */
  private _recalculateFees(): void {
    const { averageLoad, computeDemand, activeRelayCount } = this.networkState;

    // 拥堵因子: 负载越高越贵
    const congestionFactor = 1.0 + averageLoad * 2.0;

    // 计算因子: 计算需求越高越贵
    const computeFactor = 1.0 + computeDemand * 1.0;

    // 中继数量修正: 中继越多竞争越激烈，费率越低
    const relayDiscount = Math.max(0, 1.0 - activeRelayCount * 0.02);

    const totalMultiplier = Math.round(
      this.currentSchedule.baseFee * congestionFactor * computeFactor * relayDiscount
    );

    this.currentSchedule = {
      baseFee: this.currentSchedule.baseFee,
      congestionFactor: Math.round(congestionFactor * 1000) / 1000,
      computeFactor: Math.round(computeFactor * 1000) / 1000,
      distanceFactor: 1.0, // 链对特定，默认1.0
      totalMultiplier,
      updatedAt: new Date().toISOString(),
    };

    logger.info(`[DynamicFeeScheduler] Fees updated: multiplier=${totalMultiplier}bps, congestion=${congestionFactor.toFixed(2)}, compute=${computeFactor.toFixed(2)}`);
  }

  /**
   * 链距离估算（简化：基于chainId差值）
   */
  private _calculateChainDistance(sourceChainId: number, targetChainId: number): number {
    if (sourceChainId === targetChainId) return 0;
    // 简化: 用chainId差值估算
    return Math.min(Math.abs(sourceChainId - targetChainId) / 100, 10);
  }

  /**
   * 低峰期折扣
   */
  applyOffPeakDiscount(schedule: FeeSchedule): FeeSchedule {
    const hour = new Date().getUTCHours();
    // UTC 0-6时为低峰期
    if (hour < 6) {
      return {
        ...schedule,
        totalMultiplier: Math.round(schedule.totalMultiplier * 0.8),
        congestionFactor: schedule.congestionFactor * 0.8,
      };
    }
    return schedule;
  }
}

export const dynamicFeeScheduler = new DynamicFeeScheduler();
