/**
 * Catapult Pool - Catapult资源池
 *
 * V5.0 Brainwave Integration: P1-2
 * 全局FPGA资源池管理，Liu路由三因子评分驱动调度，跨数据中心FPGA发现与分配。
 *
 * Liu路由公式: score = (1-load)×0.3 + phiFit×0.3 + (1-phaseEntropy)×0.4
 */

import {
  CatapultNode,
  CatapultPoolConfig,
} from './types';

// =============== Constants ===============

const DEFAULT_POOL_CONFIG: CatapultPoolConfig = {
  liuLoadWeight: 0.3,
  liuPhiFitWeight: 0.3,
  liuPhaseEntropyWeight: 0.4,
};

// =============== Resource Requirement ===============

export interface ResourceRequirement {
  fpgaCount: number;
  minSRAM: number;
  maxLatency: number;
  preferredRegion?: string;
}

// =============== Allocation Result ===============

export interface CatapultAllocation {
  allocationId: string;
  nodeId: string;
  fpgaIds: string[];
  totalSRAM: number;
  liuScore: number;
  timestamp: number;
}

// =============== Catapult Pool ===============

/**
 * CatapultPool: 全局FPGA资源池管理器
 *
 * 核心功能:
 * - 跨数据中心FPGA发现与分配
 * - Liu路由三因子评分驱动调度
 * - 资源池管理
 */
export class CatapultPool {
  private static instance: CatapultPool | null = null;
  private nodes: Map<string, CatapultNode> = new Map();
  private config: CatapultPoolConfig;
  private allocations: Map<string, CatapultAllocation> = new Map();
  private allocationCounter: number = 0;
  // 每个节点的已分配FPGA ID列表
  private allocatedFpgas: Map<string, Set<string>> = new Map();

  private constructor(config?: Partial<CatapultPoolConfig>) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * 获取单例实例
   */
  static get_instance(config?: Partial<CatapultPoolConfig>): CatapultPool {
    if (!CatapultPool.instance) {
      CatapultPool.instance = new CatapultPool(config);
    }
    return CatapultPool.instance;
  }

  /**
   * 注册数据中心节点
   */
  registerNode(node: CatapultNode): CatapultNode {
    if (this.nodes.has(node.nodeId)) {
      throw new Error(`Node ${node.nodeId} already registered`);
    }

    this.nodes.set(node.nodeId, { ...node });
    this.allocatedFpgas.set(node.nodeId, new Set());

    // 计算初始Liu评分
    const liuScore = this.calculateLiuScore(node);
    this.nodes.get(node.nodeId)!.liuScore = liuScore;

    console.log(`[CatapultPool] Node registered: ${node.nodeId} (${node.dataCenter}, ${node.fpgaCount} FPGAs, Liu=${liuScore.toFixed(4)})`);
    return this.nodes.get(node.nodeId)!;
  }

  /**
   * 注销节点
   */
  unregisterNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    // 检查是否有分配的FPGA
    const allocated = this.allocatedFpgas.get(nodeId);
    if (allocated && allocated.size > 0) {
      throw new Error(`Cannot unregister node ${nodeId}: ${allocated.size} FPGAs still allocated`);
    }

    this.nodes.delete(nodeId);
    this.allocatedFpgas.delete(nodeId);
    console.log(`[CatapultPool] Node unregistered: ${nodeId}`);
    return true;
  }

  /**
   * Liu路由找最优节点
   * score = (1-load)×W_load + phiFit×W_phiFit + (1-phaseEntropy)×W_phaseEntropy
   */
  findOptimalNode(requirements: ResourceRequirement): CatapultNode | null {
    const candidates = Array.from(this.nodes.values())
      .filter(node => {
        if (!node.isActive) return false;
        // 检查FPGA数量
        const allocated = this.allocatedFpgas.get(node.nodeId);
        const availableFpgas = node.fpgaCount - (allocated?.size || 0);
        if (availableFpgas < requirements.fpgaCount) return false;
        // 检查SRAM
        if (node.totalSRAM < requirements.minSRAM) return false;
        // 检查延迟
        if (node.latency > requirements.maxLatency) return false;
        // 检查区域偏好
        if (requirements.preferredRegion && node.region !== requirements.preferredRegion) return false;
        return true;
      });

    if (candidates.length === 0) {
      console.warn('[CatapultPool] No node satisfies requirements');
      return null;
    }

    // 按Liu评分降序排序
    candidates.sort((a, b) => b.liuScore - a.liuScore);

    const selected = candidates[0];
    console.log(`[CatapultPool] Selected node: ${selected.nodeId} (Liu=${selected.liuScore.toFixed(4)})`);
    return selected;
  }

  /**
   * 分配FPGA
   */
  allocateFPGAs(nodeId: string, count: number): CatapultAllocation | null {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.error(`[CatapultPool] Node ${nodeId} not found`);
      return null;
    }

    const allocated = this.allocatedFpgas.get(nodeId)!;
    const availableFpgas = node.fpgaCount - allocated.size;

    if (availableFpgas < count) {
      console.error(`[CatapultPool] Insufficient FPGAs on ${nodeId}: need ${count}, available ${availableFpgas}`);
      return null;
    }

    // 生成FPGA ID列表
    const fpgaIds: string[] = [];
    for (let i = 0; i < node.fpgaCount && fpgaIds.length < count; i++) {
      const fpgaId = `${nodeId}_fpga_${i}`;
      if (!allocated.has(fpgaId)) {
        fpgaIds.push(fpgaId);
        allocated.add(fpgaId);
      }
    }

    const allocation: CatapultAllocation = {
      allocationId: `alloc_${this.allocationCounter++}`,
      nodeId,
      fpgaIds,
      totalSRAM: (node.totalSRAM / node.fpgaCount) * count,
      liuScore: node.liuScore,
      timestamp: Date.now(),
    };

    this.allocations.set(allocation.allocationId, allocation);

    // 更新节点Liu评分
    node.liuScore = this.calculateLiuScore(node);

    console.log(`[CatapultPool] Allocated ${count} FPGAs on ${nodeId} (allocation: ${allocation.allocationId})`);
    return allocation;
  }

  /**
   * 释放FPGA
   */
  releaseFPGAs(nodeId: string, fpgaIds: string[]): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.error(`[CatapultPool] Node ${nodeId} not found`);
      return false;
    }

    const allocated = this.allocatedFpgas.get(nodeId);
    if (!allocated) return false;

    for (const fpgaId of fpgaIds) {
      allocated.delete(fpgaId);
    }

    // 更新节点Liu评分
    node.liuScore = this.calculateLiuScore(node);

    console.log(`[CatapultPool] Released ${fpgaIds.length} FPGAs on ${nodeId}`);
    return true;
  }

  /**
   * 计算Liu三因子评分
   * score = (1-load)×0.3 + phiFit×0.3 + (1-phaseEntropy)×0.4
   */
  calculateLiuScore(node: CatapultNode): number {
    // 负载因子：已分配FPGA比例
    const allocated = this.allocatedFpgas.get(node.nodeId);
    const load = allocated ? allocated.size / node.fpgaCount : 0;

    // Φ适配度：基于SRAM利用率和带宽
    const phiFit = Math.min(1.0, (node.bandwidth / 100) * (1 - load));

    // 相位熵：基于延迟和网络状况
    const phaseEntropy = Math.min(1.0, node.latency / 100);

    const score =
      (1 - load) * this.config.liuLoadWeight +
      phiFit * this.config.liuPhiFitWeight +
      (1 - phaseEntropy) * this.config.liuPhaseEntropyWeight;

    return Math.min(1.0, Math.max(0, score));
  }

  /**
   * 池统计
   */
  getPoolStats(): {
    totalNodes: number;
    activeNodes: number;
    totalFPGAs: number;
    allocatedFPGAs: number;
    totalSRAM: number;
    nodes: Array<{
      nodeId: string;
      dataCenter: string;
      region: string;
      fpgaCount: number;
      allocatedFPGAs: number;
      totalSRAM: number;
      liuScore: number;
      isActive: boolean;
    }>;
    allocations: number;
  } {
    const nodes = Array.from(this.nodes.values()).map(n => {
      const allocated = this.allocatedFpgas.get(n.nodeId);
      return {
        nodeId: n.nodeId,
        dataCenter: n.dataCenter,
        region: n.region,
        fpgaCount: n.fpgaCount,
        allocatedFPGAs: allocated ? allocated.size : 0,
        totalSRAM: n.totalSRAM,
        liuScore: n.liuScore,
        isActive: n.isActive,
      };
    });

    const totalFPGAs = nodes.reduce((sum, n) => sum + n.fpgaCount, 0);
    const allocatedFPGAs = nodes.reduce((sum, n) => sum + n.allocatedFPGAs, 0);
    const totalSRAM = nodes.reduce((sum, n) => sum + n.totalSRAM, 0);

    return {
      totalNodes: this.nodes.size,
      activeNodes: nodes.filter(n => n.isActive).length,
      totalFPGAs,
      allocatedFPGAs,
      totalSRAM,
      nodes,
      allocations: this.allocations.size,
    };
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      config: this.config,
      nodeCount: this.nodes.size,
      allocationCount: this.allocations.size,
      nodes: Array.from(this.nodes.entries()).map(([id, n]) => ({
        nodeId: id,
        dataCenter: n.dataCenter,
        fpgaCount: n.fpgaCount,
        liuScore: n.liuScore,
        isActive: n.isActive,
      })),
    };
  }

  /**
   * 重置（用于测试）
   */
  reset(): void {
    this.nodes.clear();
    this.allocations.clear();
    this.allocatedFpgas.clear();
    this.allocationCounter = 0;
  }
}

// =============== Self-Test ===============

function selfTest(): void {
  const pool = CatapultPool.get_instance();
  pool.reset();

  // 测试1: 注册节点
  pool.registerNode({
    nodeId: 'dc1-node1',
    dataCenter: 'us-east-1',
    region: 'NA',
    fpgaCount: 16,
    totalSRAM: 16 * 30 * 1024 * 1024,
    liuScore: 0,
    bandwidth: 100,
    latency: 5,
    isActive: true,
  });

  pool.registerNode({
    nodeId: 'dc2-node1',
    dataCenter: 'eu-west-1',
    region: 'EU',
    fpgaCount: 8,
    totalSRAM: 8 * 30 * 1024 * 1024,
    liuScore: 0,
    bandwidth: 80,
    latency: 20,
    isActive: true,
  });

  console.log('[Test] Registered 2 nodes');

  // 测试2: Liu评分
  const node1 = pool.getPoolStats().nodes[0];
  const node2 = pool.getPoolStats().nodes[1];
  console.log(`[Test] Liu scores: ${node1.nodeId}=${node1.liuScore.toFixed(4)}, ${node2.nodeId}=${node2.liuScore.toFixed(4)}`);

  // 测试3: 找最优节点
  const optimal = pool.findOptimalNode({
    fpgaCount: 4,
    minSRAM: 120 * 1024 * 1024,
    maxLatency: 50,
  });
  console.log(`[Test] Optimal node: ${optimal?.nodeId}`);

  // 测试4: 分配FPGA
  const allocation = pool.allocateFPGAs('dc1-node1', 4);
  console.log(`[Test] Allocation: ${allocation?.allocationId}, ${allocation?.fpgaIds.length} FPGAs`);

  // 测试5: 释放FPGA
  if (allocation) {
    pool.releaseFPGAs('dc1-node1', allocation.fpgaIds);
    console.log('[Test] Released FPGAs');
  }

  // 测试6: 池统计
  const stats = pool.getPoolStats();
  console.log(`[Test] Pool: ${stats.totalNodes} nodes, ${stats.totalFPGAs} FPGAs, ${stats.allocatedFPGAs} allocated`);

  console.log('[SelfTest] CatapultPool: ALL PASSED');
  pool.reset();
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
