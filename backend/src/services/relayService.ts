/**
 * RelayService — V12.0 中继服务层
 * 封装RelayRegistry合约调用 + 智能路由 + 动态费率
 */

import logger from '../utils/logger';
import { intelligentRelayRouter, RouteStrategy } from './intelligentRelayRouter';
import { dynamicFeeScheduler } from './dynamicFeeScheduler';

// =============== Types ===============

export interface RelayNodeDTO {
  address: string;
  stakeAmount: string;
  computeCapacity: number;
  reputationScore: number;
  feeRate: number;
  isActive: boolean;
  registeredAt: number;
  lastActiveAt: number;
  supportedChains: number[];
}

export interface RelayTaskDTO {
  taskId: string;
  requester: string;
  assignedRelay: string;
  targetChainId: number;
  taskType: string;
  fee: string;
  status: string;
  createdAt: number;
  completedAt: number;
}

// =============== Service ===============

class RelayService {
  /**
   * 获取中继节点列表
   */
  async getRelayNodes(): Promise<RelayNodeDTO[]> {
    // 模拟数据（实际从合约读取）
    return [];
  }

  /**
   * 获取中继节点详情
   */
  async getRelayNode(address: string): Promise<RelayNodeDTO | null> {
    logger.info(`[RelayService] Getting relay node: ${address}`);
    return null;
  }

  /**
   * 获取活跃中继数量
   */
  async getActiveRelayCount(): Promise<number> {
    return 0;
  }

  /**
   * 智能路由查询
   */
  async findRoute(
    sourceChainId: number,
    targetChainId: number,
    taskType: 'MESSAGE_RELAY' | 'COMPUTE_RELAY',
    computeUnits?: number,
    strategy?: RouteStrategy
  ) {
    const relays = await this.getRelayNodes();
    const activeRelays = relays.filter(r => r.isActive).map(r => ({
      address: r.address,
      stakeAmount: BigInt(r.stakeAmount),
      computeCapacity: r.computeCapacity,
      reputationScore: r.reputationScore,
      feeRate: r.feeRate,
      isActive: r.isActive,
      lastActiveAt: r.lastActiveAt,
      supportedChains: r.supportedChains,
    }));

    return intelligentRelayRouter.findBestRoute(activeRelays, {
      sourceChainId,
      targetChainId,
      taskType,
      computeUnits,
      strategy,
    });
  }

  /**
   * 获取当前费率
   */
  async getCurrentFees() {
    return dynamicFeeScheduler.getCurrentSchedule();
  }

  /**
   * 计算指定链对费率
   */
  calculateFee(
    sourceChainId: number,
    targetChainId: number,
    taskType: 'MESSAGE_RELAY' | 'COMPUTE_RELAY',
    computeUnits?: number,
    creditGrade?: number
  ) {
    const baseFee = dynamicFeeScheduler.calculateFee(
      sourceChainId, targetChainId, taskType, computeUnits
    );

    if (creditGrade !== undefined) {
      return dynamicFeeScheduler.getCreditAdjustedFee(baseFee, creditGrade);
    }

    return baseFee;
  }

  /**
   * 获取网络状态
   */
  async getNetworkStatus() {
    const relayCount = await this.getActiveRelayCount();
    const schedule = dynamicFeeScheduler.getCurrentSchedule();

    return {
      activeRelayCount: relayCount,
      feeSchedule: schedule,
      timestamp: new Date().toISOString(),
    };
  }
}

export const relayService = new RelayService();
