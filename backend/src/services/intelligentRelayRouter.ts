/**
 * IntelligentRelayRouter — V12.0 智能中继路由
 * 6GNetGPT"内生AI+分布式算力"思想: 智能选择最优中继路径+故障自愈
 */

import logger from '../utils/logger';

// =============== Types ===============

export interface RelayNodeInfo {
  address: string;
  stakeAmount: bigint;
  computeCapacity: number;
  reputationScore: number;
  feeRate: number;
  isActive: boolean;
  lastActiveAt: number;
  supportedChains: number[];
}

export interface RouteRequest {
  sourceChainId: number;
  targetChainId: number;
  taskType: 'MESSAGE_RELAY' | 'COMPUTE_RELAY';
  computeUnits?: number;
  strategy?: RouteStrategy;
}

export enum RouteStrategy {
  CHEAPEST = 'CHEAPEST',
  FASTEST = 'FASTEST',
  MOST_RELIABLE = 'MOST_RELIABLE',
  BALANCED = 'BALANCED',
}

export interface RouteResult {
  primaryRelay: string;
  backupRelays: string[];
  estimatedFee: number;
  estimatedLatency: number;
  reliabilityScore: number;
  routeScore: number;
}

// =============== Router ===============

class IntelligentRelayRouter {
  // 权重配置
  private weights = {
    latency: 0.3,
    feeRate: 0.25,
    reputation: 0.25,
    loadBalance: 0.2,
  };

  /**
   * 计算最优路由
   */
  findBestRoute(relays: RelayNodeInfo[], request: RouteRequest): RouteResult | null {
    const strategy = request.strategy || RouteStrategy.BALANCED;
    const eligible = this._filterEligible(relays, request);

    if (eligible.length === 0) {
      logger.warn('[IntelligentRelayRouter] No eligible relays found');
      return null;
    }

    // 按策略调整权重
    const adjustedWeights = this._adjustWeights(strategy);

    // 计算每个中继的综合评分
    const scored = eligible.map(relay => ({
      relay,
      score: this._calculateScore(relay, adjustedWeights),
    }));

    // 排序
    scored.sort((a, b) => b.score - a.score);

    const primary = scored[0];
    const backups = scored.slice(1, 4).map(s => s.relay.address);

    return {
      primaryRelay: primary.relay.address,
      backupRelays: backups,
      estimatedFee: Number(primary.relay.feeRate),
      estimatedLatency: this._estimateLatency(primary.relay, request),
      reliabilityScore: primary.relay.reputationScore / 10000,
      routeScore: primary.score,
    };
  }

  /**
   * 故障自愈: 自动切换到备选路径
   */
  findFailoverRoute(
    relays: RelayNodeInfo[],
    request: RouteRequest,
    failedRelay: string
  ): RouteResult | null {
    logger.info(`[IntelligentRelayRouter] Finding failover for failed relay ${failedRelay}`);
    const filtered = relays.filter(r => r.address !== failedRelay);
    return this.findBestRoute(filtered, request);
  }

  /**
   * 过滤符合条件的中继
   */
  private _filterEligible(relays: RelayNodeInfo[], request: RouteRequest): RelayNodeInfo[] {
    return relays.filter(relay => {
      if (!relay.isActive) return false;
      if (relay.reputationScore < 2000) return false;
      if (!relay.supportedChains.includes(request.targetChainId)) return false;
      if (request.taskType === 'COMPUTE_RELAY' && relay.computeCapacity < (request.computeUnits || 0)) {
        return false;
      }
      return true;
    });
  }

  /**
   * 综合评分
   */
  private _calculateScore(relay: RelayNodeInfo, weights: Record<string, number>): number {
    // 声誉分 (0-1)
    const reputationNorm = relay.reputationScore / 10000;
    // 费率分 (越低越好，10000=100% → 0分，0=0% → 1分)
    const feeNorm = 1 - Math.min(relay.feeRate / 10000, 1);
    // 负载均衡分 (基于最后活跃时间，最近活跃=负载较高)
    const timeSinceActive = Date.now() / 1000 - relay.lastActiveAt;
    const loadNorm = Math.min(timeSinceActive / 3600, 1); // 1小时内活跃=低负载
    // 延迟分 (简化: 基于声誉估算)
    const latencyNorm = reputationNorm * 0.8 + loadNorm * 0.2;

    return (
      weights.reputation * reputationNorm +
      weights.feeRate * feeNorm +
      weights.loadBalance * loadNorm +
      weights.latency * latencyNorm
    );
  }

  /**
   * 根据策略调整权重
   */
  private _adjustWeights(strategy: RouteStrategy): Record<string, number> {
    switch (strategy) {
      case RouteStrategy.CHEAPEST:
        return { latency: 0.1, feeRate: 0.5, reputation: 0.2, loadBalance: 0.2 };
      case RouteStrategy.FASTEST:
        return { latency: 0.5, feeRate: 0.1, reputation: 0.2, loadBalance: 0.2 };
      case RouteStrategy.MOST_RELIABLE:
        return { latency: 0.2, feeRate: 0.1, reputation: 0.5, loadBalance: 0.2 };
      case RouteStrategy.BALANCED:
      default:
        return this.weights;
    }
  }

  /**
   * 估算延迟 (简化模型)
   */
  private _estimateLatency(relay: RelayNodeInfo, _request: RouteRequest): number {
    // 基础延迟 + 声誉修正
    const baseLatency = 2000; // 2秒基础
    const reputationDiscount = (relay.reputationScore / 10000) * 500;
    return Math.max(baseLatency - reputationDiscount, 500);
  }

  /**
   * 预测性维护: 检测中继器性能下降趋势
   */
  detectPerformanceDegradation(relay: RelayNodeInfo): {
    isDegraded: boolean;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  } {
    if (relay.reputationScore < 2000) {
      return {
        isDegraded: true,
        severity: 'high',
        recommendation: '声誉严重不足，建议从活跃中继列表移除',
      };
    }

    if (relay.reputationScore < 4000) {
      return {
        isDegraded: true,
        severity: 'medium',
        recommendation: '声誉下降趋势，建议降低路由权重并监控',
      };
    }

    const timeSinceActive = Date.now() / 1000 - relay.lastActiveAt;
    if (timeSinceActive > 86400) { // 24小时未活跃
      return {
        isDegraded: true,
        severity: 'low',
        recommendation: '长时间未活跃，可能已离线，建议标记为疑似故障',
      };
    }

    return {
      isDegraded: false,
      severity: 'low',
      recommendation: '中继器运行正常',
    };
  }
}

export const intelligentRelayRouter = new IntelligentRelayRouter();
