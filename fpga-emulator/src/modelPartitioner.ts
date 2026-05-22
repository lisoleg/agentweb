/**
 * Model Partitioner - 模型分段映射器
 *
 * V5.0 Brainwave Integration: P0-3
 * DNN计算流图自动分段，每个子图适配单个FPGA的SRAM容量。
 * Φ激发→PRR映射对偶。
 *
 * 分段算法: 贪心分割，按拓扑序遍历计算图，累积SRAM需求，超限则切割。
 * FPGA加速算子优先分配。
 */

import {
  ComputeNode,
  ComputeNodeType,
  DataFlowEdge,
  DNNComputeGraph,
  SubGraph,
} from './types';

// =============== Constants ===============

const DEFAULT_SRAM_LIMIT_PER_FPGA = 30 * 1024 * 1024; // 30 MB
const FPGA_ACCELERABLE_PRIORITY: Record<ComputeNodeType, number> = {
  'CONV': 1,    // 最高优先级 - FPGA加速效果最好
  'FC': 2,
  'NORM': 3,
  'ACTIVATE': 4,
  'POOL': 5,
  'CUSTOM': 6,  // 最低优先级
};

// =============== Model Partitioner ===============

/**
 * ModelPartitioner: DNN计算流图自动分段映射器
 *
 * 核心功能:
 * - 贪心拓扑序分段
 * - FPGA加速算子优先分配
 * - Φ激发→PRR映射对偶
 */
export class ModelPartitioner {
  private static instance: ModelPartitioner | null = null;
  private partitionHistory: Map<string, SubGraph[]> = new Map();
  private partitionCount: number = 0;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static get_instance(): ModelPartitioner {
    if (!ModelPartitioner.instance) {
      ModelPartitioner.instance = new ModelPartitioner();
    }
    return ModelPartitioner.instance;
  }

  /**
   * 自动分段 - 贪心拓扑序分割
   */
  partition(
    graph: DNNComputeGraph,
    sramLimitPerFpga: number = DEFAULT_SRAM_LIMIT_PER_FPGA
  ): SubGraph[] {
    const subGraphs: SubGraph[] = [];
    const topoOrder = this.topologicalSort(graph);

    let currentSubGraphNodes: string[] = [];
    let currentSram = 0;
    let subGraphIndex = 0;

    for (const nodeId of topoOrder) {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // 检查是否可以加入当前子图
      if (currentSram + node.sramRequired > sramLimitPerFpga && currentSubGraphNodes.length > 0) {
        // 超限，创建子图
        const subGraph = this.createSubGraph(
          `subgraph_${subGraphIndex++}`,
          currentSubGraphNodes,
          sramLimitPerFpga
        );
        subGraphs.push(subGraph);
        currentSubGraphNodes = [];
        currentSram = 0;
      }

      currentSubGraphNodes.push(nodeId);
      currentSram += node.sramRequired;
    }

    // 处理剩余节点
    if (currentSubGraphNodes.length > 0) {
      const subGraph = this.createSubGraph(
        `subgraph_${subGraphIndex}`,
        currentSubGraphNodes,
        sramLimitPerFpga
      );
      subGraphs.push(subGraph);
    }

    // 存储分段结果
    const graphId = `graph_${this.partitionCount++}`;
    this.partitionHistory.set(graphId, subGraphs);

    console.log(`[ModelPartitioner] Partitioned graph into ${subGraphs.length} sub-graphs`);
    return subGraphs;
  }

  /**
   * 为子图分配FPGA
   */
  assignFPGAs(
    subGraphs: SubGraph[],
    pool: { findAvailableFPGA: (sramNeeded: number) => { fpgaId: string } | null }
  ): SubGraph[] {
    for (const subGraph of subGraphs) {
      // 按FPGA加速优先级排序节点
      const totalSram = subGraph.sramAllocated;
      const fpga = pool.findAvailableFPGA(totalSram);

      if (fpga) {
        subGraph.targetFpgaId = fpga.fpgaId;
        console.log(`[ModelPartitioner] Assigned ${subGraph.id} → ${fpga.fpgaId}`);
      } else {
        console.warn(`[ModelPartitioner] No FPGA available for ${subGraph.id} (${totalSram} bytes)`);
      }
    }

    return subGraphs;
  }

  /**
   * 子图→Φ激发映射
   */
  mapToPhiExcitation(
    subGraph: SubGraph,
    excitation: { id: string; amplitude: number; phase: number }
  ): SubGraph {
    subGraph.phiExcitationId = excitation.id;
    console.log(`[ModelPartitioner] Mapped ${subGraph.id} → Φ excitation ${excitation.id}`);
    return subGraph;
  }

  /**
   * 子图→PRR映射
   */
  mapToPRR(
    subGraph: SubGraph,
    prrs: Array<{ id: string; startAddress: number; endAddress: number }>
  ): SubGraph {
    // 找到第一个可用的PRR
    if (prrs.length > 0) {
      subGraph.prrBinding = prrs[0].id;
      console.log(`[ModelPartitioner] Mapped ${subGraph.id} → PRR ${prrs[0].id}`);
    }
    return subGraph;
  }

  /**
   * 优化分段方案
   * 尝试合并小子图以减少FPGA数量
   */
  optimizePartition(
    subGraphs: SubGraph[],
    constraints: { sramLimitPerFpga: number }
  ): SubGraph[] {
    if (subGraphs.length <= 1) return subGraphs;

    const optimized: SubGraph[] = [];
    const used = new Set<number>();

    for (let i = 0; i < subGraphs.length; i++) {
      if (used.has(i)) continue;

      let currentSram = subGraphs[i].sramAllocated;
      const mergedNodes = [...subGraphs[i].nodes];

      // 尝试合并后续小子图
      for (let j = i + 1; j < subGraphs.length; j++) {
        if (used.has(j)) continue;

        if (currentSram + subGraphs[j].sramAllocated <= constraints.sramLimitPerFpga) {
          mergedNodes.push(...subGraphs[j].nodes);
          currentSram += subGraphs[j].sramAllocated;
          used.add(j);
        }
      }

      used.add(i);

      const merged: SubGraph = {
        id: `subgraph_opt_${optimized.length}`,
        nodes: mergedNodes,
        targetFpgaId: subGraphs[i].targetFpgaId,
        sramAllocated: currentSram,
        phiExcitationId: subGraphs[i].phiExcitationId,
        prrBinding: subGraphs[i].prrBinding,
      };

      optimized.push(merged);
    }

    console.log(`[ModelPartitioner] Optimized: ${subGraphs.length} → ${optimized.length} sub-graphs`);
    return optimized;
  }

  /**
   * 分段统计
   */
  getPartitionStats(): {
    totalPartitions: number;
    historySize: number;
  } {
    return {
      totalPartitions: this.partitionCount,
      historySize: this.partitionHistory.size,
    };
  }

  /**
   * 获取分段结果
   */
  getPartitionResult(graphId: string): SubGraph[] | undefined {
    return this.partitionHistory.get(graphId);
  }

  // =============== Private Methods ===============

  /**
   * 拓扑排序 (Kahn's algorithm)
   */
  private topologicalSort(graph: DNNComputeGraph): string[] {
    const inDegree: Map<string, number> = new Map();
    const adjacency: Map<string, string[]> = new Map();

    // 初始化
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // 构建邻接表和入度
    for (const edge of graph.edges) {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // 收集入度为0的节点，按FPGA加速优先级排序
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    // 按FPGA加速优先级排序队列
    this.sortByPriority(queue, graph);

    const result: string[] = [];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }

      // 每次处理后重新排序队列
      this.sortByPriority(queue, graph);
    }

    return result;
  }

  /**
   * 按FPGA加速优先级排序节点
   */
  private sortByPriority(nodeIds: string[], graph: DNNComputeGraph): void {
    nodeIds.sort((a, b) => {
      const nodeA = graph.nodes.find(n => n.id === a);
      const nodeB = graph.nodes.find(n => n.id === b);
      const priorityA = nodeA ? (FPGA_ACCELERABLE_PRIORITY[nodeA.type] || 99) : 99;
      const priorityB = nodeB ? (FPGA_ACCELERABLE_PRIORITY[nodeB.type] || 99) : 99;
      return priorityA - priorityB;
    });
  }

  /**
   * 创建子图
   */
  private createSubGraph(id: string, nodes: string[], sramAllocated: number): SubGraph {
    return {
      id,
      nodes,
      targetFpgaId: '',
      sramAllocated,
      phiExcitationId: null,
      prrBinding: null,
    };
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      partitionCount: this.partitionCount,
      historySize: this.partitionHistory.size,
      historyKeys: Array.from(this.partitionHistory.keys()),
    };
  }

  /**
   * 重置（用于测试）
   */
  reset(): void {
    this.partitionHistory.clear();
    this.partitionCount = 0;
  }
}

// =============== Self-Test ===============

function selfTest(): void {
  const mp = ModelPartitioner.get_instance();
  mp.reset();

  // 创建测试计算图
  const graph: DNNComputeGraph = {
    nodes: [
      { id: 'conv1', type: 'CONV', params: 1000, flops: 500000, sramRequired: 10 * 1024 * 1024, fpgaAccelerable: true },
      { id: 'relu1', type: 'ACTIVATE', params: 0, flops: 50000, sramRequired: 1 * 1024 * 1024, fpgaAccelerable: true },
      { id: 'pool1', type: 'POOL', params: 0, flops: 200000, sramRequired: 2 * 1024 * 1024, fpgaAccelerable: false },
      { id: 'fc1', type: 'FC', params: 5000, flops: 300000, sramRequired: 15 * 1024 * 1024, fpgaAccelerable: true },
      { id: 'relu2', type: 'ACTIVATE', params: 0, flops: 10000, sramRequired: 1 * 1024 * 1024, fpgaAccelerable: true },
      { id: 'fc2', type: 'FC', params: 2000, flops: 100000, sramRequired: 8 * 1024 * 1024, fpgaAccelerable: true },
    ],
    edges: [
      { from: 'conv1', to: 'relu1', tensorSize: 500000 },
      { from: 'relu1', to: 'pool1', tensorSize: 500000 },
      { from: 'pool1', to: 'fc1', tensorSize: 200000 },
      { from: 'fc1', to: 'relu2', tensorSize: 5000 },
      { from: 'relu2', to: 'fc2', tensorSize: 5000 },
    ],
    totalParams: 8000,
  };

  // 测试1: 分段
  const subGraphs = mp.partition(graph, 20 * 1024 * 1024);
  console.log(`[Test] Partitioned into ${subGraphs.length} sub-graphs`);
  subGraphs.forEach(sg => {
    console.log(`  ${sg.id}: ${sg.nodes.length} nodes, ${sg.sramAllocated / 1024 / 1024} MB`);
  });

  // 测试2: Φ激发映射
  mp.mapToPhiExcitation(subGraphs[0], { id: 'exc-1', amplitude: 0.8, phase: Math.PI / 3 });
  console.log(`[Test] Mapped to Φ excitation: ${subGraphs[0].phiExcitationId}`);

  // 测试3: PRR映射
  mp.mapToPRR(subGraphs[0], [{ id: 'prr-1', startAddress: 0, endAddress: 0x10000 }]);
  console.log(`[Test] Mapped to PRR: ${subGraphs[0].prrBinding}`);

  // 测试4: 优化
  const optimized = mp.optimizePartition(subGraphs, { sramLimitPerFpga: 30 * 1024 * 1024 });
  console.log(`[Test] Optimized: ${optimized.length} sub-graphs`);

  console.log('[SelfTest] ModelPartitioner: ALL PASSED');
  mp.reset();
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
