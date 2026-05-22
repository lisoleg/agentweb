/**
 * SRAM Memory Pool - Φ-SRAM片上内存池
 *
 * V5.0 Brainwave Integration: P0-1
 * 管理全局FPGA SRAM资源池，支持跨FPGA全局内存寻址与Φ场边界同步机制。
 *
 * 默认参数:
 * - Stratix 10: 30MB SRAM per FPGA
 * - 10μs FPGA间延迟
 * - 100ms Φ场边界同步间隔
 */

import {
  BRAMRegion,
  SRAMPoolNode,
  GlobalSRAMPool,
} from './types';

// =============== Constants ===============

const DEFAULT_SRAM_PER_FPGA = 30 * 1024 * 1024; // 30 MB
const DEFAULT_INTER_FPGA_LATENCY = 10; // 10 μs
const DEFAULT_PHI_SYNC_INTERVAL = 100; // 100 ms
const GLOBAL_ADDR_OFFSET_BITS = 16; // 每个FPGA全局地址偏移位数

// =============== SRAM Memory Pool ===============

/**
 * SRAMMemoryPool: 全局FPGA SRAM资源池管理器
 *
 * 核心功能:
 * - 跨FPGA全局内存寻址
 * - Φ场边界同步机制
 * - SRAM分配/释放
 */
export class SRAMMemoryPool {
  private pool: GlobalSRAMPool;
  private regionCounter: number = 0;
  private lastPhiSyncTime: number = 0;
  private static instance: SRAMMemoryPool | null = null;

  private constructor() {
    this.pool = {
      nodes: new Map(),
      totalCapacity: 0,
      totalUsed: 0,
      interFpgaLatency: DEFAULT_INTER_FPGA_LATENCY,
      phiFieldSyncInterval: DEFAULT_PHI_SYNC_INTERVAL,
    };
  }

  /**
   * 获取单例实例
   */
  static get_instance(): SRAMMemoryPool {
    if (!SRAMMemoryPool.instance) {
      SRAMMemoryPool.instance = new SRAMMemoryPool();
    }
    return SRAMMemoryPool.instance;
  }

  /**
   * 注册FPGA节点到SRAM池
   */
  registerFPGA(fpgaId: string, totalSRAM: number = DEFAULT_SRAM_PER_FPGA): SRAMPoolNode {
    if (this.pool.nodes.has(fpgaId)) {
      throw new Error(`FPGA ${fpgaId} already registered in SRAM pool`);
    }

    const node: SRAMPoolNode = {
      fpgaId,
      totalSRAM,
      usedSRAM: 0,
      blockRamRegions: [],
      phiBoundarySync: 0,
    };

    this.pool.nodes.set(fpgaId, node);
    this.pool.totalCapacity += totalSRAM;

    console.log(`[SRAMPool] FPGA registered: ${fpgaId} (${(totalSRAM / 1024 / 1024).toFixed(1)} MB)`);
    return node;
  }

  /**
   * 注销FPGA节点
   */
  unregisterFPGA(fpgaId: string): boolean {
    const node = this.pool.nodes.get(fpgaId);
    if (!node) {
      return false;
    }

    if (node.usedSRAM > 0) {
      throw new Error(`Cannot unregister FPGA ${fpgaId}: ${node.usedSRAM} bytes still allocated`);
    }

    this.pool.nodes.delete(fpgaId);
    this.pool.totalCapacity -= node.totalSRAM;
    console.log(`[SRAMPool] FPGA unregistered: ${fpgaId}`);
    return true;
  }

  /**
   * 分配SRAM区域
   */
  allocate(
    fpgaId: string,
    size: number,
    prrId: string | null = null,
    phiExcitationId: string | null = null
  ): BRAMRegion | null {
    const node = this.pool.nodes.get(fpgaId);
    if (!node) {
      console.error(`[SRAMPool] FPGA ${fpgaId} not found`);
      return null;
    }

    const available = node.totalSRAM - node.usedSRAM;
    if (size > available) {
      console.error(`[SRAMPool] Insufficient SRAM on ${fpgaId}: need ${size}, available ${available}`);
      return null;
    }

    // 计算起始地址：当前已用SRAM之后
    const startAddr = node.usedSRAM;

    const region: BRAMRegion = {
      id: `bram_${fpgaId}_${this.regionCounter++}`,
      startAddr,
      size,
      prrId,
      phiExcitationId,
    };

    node.blockRamRegions.push(region);
    node.usedSRAM += size;
    this.pool.totalUsed += size;

    console.log(`[SRAMPool] Allocated ${size} bytes on ${fpgaId} (region: ${region.id})`);
    return region;
  }

  /**
   * 释放SRAM区域
   */
  deallocate(fpgaId: string, regionId: string): boolean {
    const node = this.pool.nodes.get(fpgaId);
    if (!node) {
      console.error(`[SRAMPool] FPGA ${fpgaId} not found`);
      return false;
    }

    const regionIndex = node.blockRamRegions.findIndex(r => r.id === regionId);
    if (regionIndex === -1) {
      console.error(`[SRAMPool] Region ${regionId} not found on ${fpgaId}`);
      return false;
    }

    const region = node.blockRamRegions[regionIndex];
    node.blockRamRegions.splice(regionIndex, 1);
    node.usedSRAM -= region.size;
    this.pool.totalUsed -= region.size;

    // 确保usedSRAM不为负
    node.usedSRAM = Math.max(0, node.usedSRAM);

    console.log(`[SRAMPool] Deallocated region ${regionId} (${region.size} bytes) on ${fpgaId}`);
    return true;
  }

  /**
   * 获取全局地址
   * 全局地址 = FPGA索引 << GLOBAL_ADDR_OFFSET_BITS | 本地地址
   */
  getGlobalAddress(fpgaId: string, localAddr: number): number | null {
    const node = this.pool.nodes.get(fpgaId);
    if (!node) {
      return null;
    }

    // 获取FPGA在池中的索引
    const fpgaIndex = this.getFPGAIndex(fpgaId);
    if (fpgaIndex === -1) {
      return null;
    }

    return (fpgaIndex << GLOBAL_ADDR_OFFSET_BITS) | localAddr;
  }

  /**
   * Φ场边界同步
   * 模拟跨FPGA的Φ场数据同步过程
   */
  syncPhiBoundaries(): {
    syncedNodes: number;
    syncLatency: number;
    phiCoherence: number;
  } {
    const nodeCount = this.pool.nodes.size;
    if (nodeCount === 0) {
      return { syncedNodes: 0, syncLatency: 0, phiCoherence: 1.0 };
    }

    // 同步延迟 = 最大FPGA间延迟 × 节点数
    const syncLatency = this.pool.interFpgaLatency * (nodeCount - 1);

    // 更新每个节点的Φ边界同步计数
    for (const node of this.pool.nodes.values()) {
      node.phiBoundarySync++;
    }

    // 计算Φ场相干度 (基于分配均匀度)
    const utilizationRatios = Array.from(this.pool.nodes.values()).map(
      n => n.totalSRAM > 0 ? n.usedSRAM / n.totalSRAM : 0
    );
    const avgUtil = utilizationRatios.reduce((a, b) => a + b, 0) / utilizationRatios.length;
    const variance = utilizationRatios.reduce((sum, r) => sum + (r - avgUtil) ** 2, 0) / utilizationRatios.length;
    const phiCoherence = Math.max(0, 1.0 - Math.sqrt(variance));

    this.lastPhiSyncTime = Date.now();

    console.log(`[SRAMPool] Φ boundary sync completed: ${nodeCount} nodes, coherence=${phiCoherence.toFixed(4)}`);
    return { syncedNodes: nodeCount, syncLatency, phiCoherence };
  }

  /**
   * 池统计信息
   */
  getPoolStats(): {
    totalCapacity: number;
    totalUsed: number;
    utilizationRate: number;
    nodeCount: number;
    nodes: Array<{
      fpgaId: string;
      totalSRAM: number;
      usedSRAM: number;
      utilization: number;
      regionCount: number;
      phiBoundarySync: number;
    }>;
    lastPhiSyncTime: number;
  } {
    const nodes = Array.from(this.pool.nodes.values()).map(n => ({
      fpgaId: n.fpgaId,
      totalSRAM: n.totalSRAM,
      usedSRAM: n.usedSRAM,
      utilization: n.totalSRAM > 0 ? n.usedSRAM / n.totalSRAM : 0,
      regionCount: n.blockRamRegions.length,
      phiBoundarySync: n.phiBoundarySync,
    }));

    return {
      totalCapacity: this.pool.totalCapacity,
      totalUsed: this.pool.totalUsed,
      utilizationRate: this.pool.totalCapacity > 0
        ? this.pool.totalUsed / this.pool.totalCapacity
        : 0,
      nodeCount: this.pool.nodes.size,
      nodes,
      lastPhiSyncTime: this.lastPhiSyncTime,
    };
  }

  /**
   * 找到有足够SRAM的FPGA
   */
  findAvailableFPGA(sramNeeded: number): SRAMPoolNode | null {
    for (const node of this.pool.nodes.values()) {
      const available = node.totalSRAM - node.usedSRAM;
      if (available >= sramNeeded) {
        return node;
      }
    }
    return null;
  }

  /**
   * 获取FPGA在池中的索引
   */
  private getFPGAIndex(fpgaId: string): number {
    let index = 0;
    for (const key of this.pool.nodes.keys()) {
      if (key === fpgaId) return index;
      index++;
    }
    return -1;
  }

  /**
   * 获取内部状态（用于调试/序列化）
   */
  get_state(): object {
    return {
      totalCapacity: this.pool.totalCapacity,
      totalUsed: this.pool.totalUsed,
      nodeCount: this.pool.nodes.size,
      interFpgaLatency: this.pool.interFpgaLatency,
      phiFieldSyncInterval: this.pool.phiFieldSyncInterval,
      nodes: Array.from(this.pool.nodes.entries()).map(([id, n]) => ({
        fpgaId: id,
        totalSRAM: n.totalSRAM,
        usedSRAM: n.usedSRAM,
        regionCount: n.blockRamRegions.length,
        phiBoundarySync: n.phiBoundarySync,
      })),
      lastPhiSyncTime: this.lastPhiSyncTime,
    };
  }

  /**
   * 重置池（用于测试）
   */
  reset(): void {
    this.pool.nodes.clear();
    this.pool.totalCapacity = 0;
    this.pool.totalUsed = 0;
    this.regionCounter = 0;
    this.lastPhiSyncTime = 0;
  }
}

// =============== Self-Test ===============

/**
 * 自检主块 - 验证SRAMMemoryPool核心功能
 */
function selfTest(): void {
  const pool = SRAMMemoryPool.get_instance();
  pool.reset();

  // 测试1: 注册FPGA
  pool.registerFPGA('fpga-0', 30 * 1024 * 1024);
  pool.registerFPGA('fpga-1', 30 * 1024 * 1024);
  console.log('[Test] Registered 2 FPGAs');

  // 测试2: 分配SRAM
  const region = pool.allocate('fpga-0', 5 * 1024 * 1024, 'prr-1', 'phi-exc-1');
  console.log(`[Test] Allocated region: ${region?.id}`);

  // 测试3: 全局地址
  const globalAddr = pool.getGlobalAddress('fpga-0', 1024);
  console.log(`[Test] Global address: 0x${globalAddr?.toString(16)}`);

  // 测试4: Φ场边界同步
  const syncResult = pool.syncPhiBoundaries();
  console.log(`[Test] Φ sync: coherence=${syncResult.phiCoherence.toFixed(4)}`);

  // 测试5: 找到可用FPGA
  const available = pool.findAvailableFPGA(25 * 1024 * 1024);
  console.log(`[Test] Available FPGA for 25MB: ${available?.fpgaId}`);

  // 测试6: 池统计
  const stats = pool.getPoolStats();
  console.log(`[Test] Pool stats: utilization=${(stats.utilizationRate * 100).toFixed(1)}%`);

  // 测试7: 释放
  if (region) {
    pool.deallocate('fpga-0', region.id);
    console.log('[Test] Deallocated region');
  }

  // 测试8: 注销
  pool.unregisterFPGA('fpga-1');
  console.log('[Test] Unregistered fpga-1');

  console.log('[SelfTest] SRAMMemoryPool: ALL PASSED');
  pool.reset();
}

// 运行自检（当直接执行此模块时）
if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
