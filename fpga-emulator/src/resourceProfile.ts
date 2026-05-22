/**
 * Resource Profile - 四维ResourceProfile资源评估
 *
 * V7.0 超节点语义对齐版: P1
 * 来源: 华为A5超节点"AI系统综合性能 = 超节点规模 × 单颗芯片规格"
 *   "不是单算力比拼，而是算力/内存带宽/内存容量/互联带宽四指标的动态配比，
 *    不同场景优先级完全不同。"
 *
 * 核心创新:
 * - 四维ResourceProfile: compute/memoryBandwidth/memoryCapacity/ioBandwidth
 * - 场景感知调度: M78推理密集→算力优先, M84 Φ计算→内存带宽优先,
 *   Φ-402微支付→IO带宽优先
 * - Liu路由扩展: 三因子×四维资源 = 场景感知的资源调度
 * - 动态配比: 根据实时负载自动调整四维权重
 */

// =============== Types ===============

export interface ResourceProfile {
  /** 算力权重 (0-1, M78推理场景优先) */
  compute: number;
  /** 内存带宽权重 (0-1, M84 Φ三视界展开优先) */
  memoryBandwidth: number;
  /** 内存容量权重 (0-1, 大模型加载优先) */
  memoryCapacity: number;
  /** 互联带宽权重 (0-1, Φ-402微支付高频结算优先) */
  ioBandwidth: number;
}

export interface NodeResource {
  nodeId: string;
  /** 可用算力 (TFLOPS) */
  computeAvailable: number;
  computeTotal: number;
  /** 内存带宽 (GB/s) */
  memoryBandwidthAvailable: number;
  memoryBandwidthTotal: number;
  /** 内存容量 (GB) */
  memoryCapacityAvailable: number;
  memoryCapacityTotal: number;
  /** 互联带宽 (Gbps) */
  ioBandwidthAvailable: number;
  ioBandwidthTotal: number;
  /** 当前负载 (0-1) */
  loadFactor: number;
  /** Φ适配度 (0-1) */
  phiFit: number;
  /** Φ相位熵 (0-1, 越低越好) */
  phaseEntropy: number;
}

export type ScenarioType = 'M78_INFERENCE' | 'M84_PHI_COMPUTE' | 'PHI402_MICROPAYMENT' | 'MODEL_LOADING' | 'GENERAL';

export interface ScenarioProfile {
  type: ScenarioType;
  profile: ResourceProfile;
  description: string;
}

export interface ResourceScore {
  nodeId: string;
  overallScore: number;
  computeScore: number;
  memoryBandwidthScore: number;
  memoryCapacityScore: number;
  ioBandwidthScore: number;
  liuScore: number;
  scenario: ScenarioType;
}

export interface ResourceAllocation {
  flowId: string;
  nodeId: string;
  scenario: ScenarioType;
  allocatedResources: {
    compute: number;
    memoryBandwidth: number;
    memoryCapacity: number;
    ioBandwidth: number;
  };
  score: ResourceScore;
  allocatedAt: number;
}

export interface ResourceProfileConfig {
  /** Liu路由负载权重 (默认0.3) */
  liuLoadWeight: number;
  /** Liu路由Φ适配权重 (默认0.3) */
  liuPhiFitWeight: number;
  /** Liu路由相位熵权重 (默认0.4) */
  liuPhaseEntropyWeight: number;
  /** 资源评分与Liu评分的融合系数 (默认0.6, 资源占比更高) */
  resourceBlendFactor: number;
  /** 节点故障检测超时 (ms, 默认5000) */
  faultTimeoutMs: number;
  /** 资源更新间隔 (ms, 默认1000) */
  resourceUpdateIntervalMs: number;
}

// =============== Scenario Presets ===============

const SCENARIO_PROFILES: Record<ScenarioType, ScenarioProfile> = {
  M78_INFERENCE: {
    type: 'M78_INFERENCE',
    profile: { compute: 0.5, memoryBandwidth: 0.2, memoryCapacity: 0.15, ioBandwidth: 0.15 },
    description: 'M78 HoTT推理引擎: 算力优先, 证明搜索需要大量计算'
  },
  M84_PHI_COMPUTE: {
    type: 'M84_PHI_COMPUTE',
    profile: { compute: 0.15, memoryBandwidth: 0.5, memoryCapacity: 0.2, ioBandwidth: 0.15 },
    description: 'M84 刘原理Φ求解器: 内存带宽优先, 三视界展开需要快速读写Φ状态'
  },
  PHI402_MICROPAYMENT: {
    type: 'PHI402_MICROPAYMENT',
    profile: { compute: 0.1, memoryBandwidth: 0.1, memoryCapacity: 0.1, ioBandwidth: 0.7 },
    description: 'Φ-402语义微支付: 互联带宽优先, 高频细颗粒结算'
  },
  MODEL_LOADING: {
    type: 'MODEL_LOADING',
    profile: { compute: 0.1, memoryBandwidth: 0.3, memoryCapacity: 0.5, ioBandwidth: 0.1 },
    description: '模型加载: 内存容量优先, 大模型参数需要大容量存储'
  },
  GENERAL: {
    type: 'GENERAL',
    profile: { compute: 0.25, memoryBandwidth: 0.25, memoryCapacity: 0.25, ioBandwidth: 0.25 },
    description: '通用场景: 四维均衡'
  }
};

// =============== Resource Profile Manager ===============

export class ResourceProfileManager {
  private nodes: Map<string, NodeResource> = new Map();
  private allocations: Map<string, ResourceAllocation> = new Map();
  private config: ResourceProfileConfig;
  private stats = {
    totalAllocations: 0,
    scenarioCounts: {} as Record<ScenarioType, number>,
    avgScore: 0,
    resourceUtilization: { compute: 0, memoryBandwidth: 0, memoryCapacity: 0, ioBandwidth: 0 }
  };

  constructor(config?: Partial<ResourceProfileConfig>) {
    this.config = {
      liuLoadWeight: 0.3,
      liuPhiFitWeight: 0.3,
      liuPhaseEntropyWeight: 0.4,
      resourceBlendFactor: 0.6,
      faultTimeoutMs: 5000,
      resourceUpdateIntervalMs: 1000,
      ...config
    };
    // 初始化场景计数
    Object.keys(SCENARIO_PROFILES).forEach(s => {
      this.stats.scenarioCounts[s as ScenarioType] = 0;
    });
  }

  // =============== Node Management ===============

  /**
   * 注册节点资源
   */
  registerNode(resource: NodeResource): void {
    this.nodes.set(resource.nodeId, { ...resource });
  }

  /**
   * 批量注册节点
   */
  registerNodes(resources: NodeResource[]): void {
    resources.forEach(r => this.registerNode(r));
  }

  /**
   * 更新节点资源状态
   */
  updateNodeResource(nodeId: string, update: Partial<NodeResource>): void {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      this.nodes.set(nodeId, { ...existing, ...update });
    }
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  // =============== Scenario-Aware Routing ===============

  /**
   * 获取场景预设Profile
   */
  getScenarioProfile(scenario: ScenarioType): ScenarioProfile {
    return SCENARIO_PROFILES[scenario];
  }

  /**
   * 计算节点资源评分
   * 将四维资源可用率按场景Profile加权求和
   */
  calculateResourceScore(node: NodeResource, scenario: ScenarioType): number {
    const profile = SCENARIO_PROFILES[scenario].profile;

    const computeScore = node.computeAvailable / Math.max(node.computeTotal, 0.001);
    const memBwScore = node.memoryBandwidthAvailable / Math.max(node.memoryBandwidthTotal, 0.001);
    const memCapScore = node.memoryCapacityAvailable / Math.max(node.memoryCapacityTotal, 0.001);
    const ioBwScore = node.ioBandwidthAvailable / Math.max(node.ioBandwidthTotal, 0.001);

    return (
      computeScore * profile.compute +
      memBwScore * profile.memoryBandwidth +
      memCapScore * profile.memoryCapacity +
      ioBwScore * profile.ioBandwidth
    );
  }

  /**
   * 计算Liu三因子评分 (经典算法)
   */
  calculateLiuScore(node: NodeResource): number {
    return (
      (1 - node.loadFactor) * this.config.liuLoadWeight +
      node.phiFit * this.config.liuPhiFitWeight +
      (1 - node.phaseEntropy) * this.config.liuPhaseEntropyWeight
    );
  }

  /**
   * 融合评分: Liu三因子 × 四维ResourceProfile
   * V7.0核心创新: 场景感知的资源调度
   */
  calculateBlendedScore(node: NodeResource, scenario: ScenarioType): ResourceScore {
    const resourceScore = this.calculateResourceScore(node, scenario);
    const liuScore = this.calculateLiuScore(node);
    const blend = this.config.resourceBlendFactor;

    const overallScore = liuScore * (1 - blend) + resourceScore * blend;

    return {
      nodeId: node.nodeId,
      overallScore,
      computeScore: node.computeAvailable / Math.max(node.computeTotal, 0.001),
      memoryBandwidthScore: node.memoryBandwidthAvailable / Math.max(node.memoryBandwidthTotal, 0.001),
      memoryCapacityScore: node.memoryCapacityAvailable / Math.max(node.memoryCapacityTotal, 0.001),
      ioBandwidthScore: node.ioBandwidthAvailable / Math.max(node.ioBandwidthTotal, 0.001),
      liuScore,
      scenario
    };
  }

  /**
   * 场景感知路由选择最优节点
   * 核心方法: 根据场景类型选择最匹配的节点
   */
  selectBestNode(scenario: ScenarioType, excludeNodes: string[] = []): ResourceScore | null {
    let bestScore: ResourceScore | null = null;

    for (const node of this.nodes.values()) {
      if (excludeNodes.includes(node.nodeId)) continue;
      if (node.loadFactor >= 0.95) continue;  // 跳过过载节点

      const score = this.calculateBlendedScore(node, scenario);

      if (!bestScore || score.overallScore > bestScore.overallScore) {
        bestScore = score;
      }
    }

    return bestScore;
  }

  /**
   * 分配资源给流
   */
  allocateResource(flowId: string, scenario: ScenarioType): ResourceAllocation | null {
    const bestScore = this.selectBestNode(scenario);
    if (!bestScore) return null;

    const node = this.nodes.get(bestScore.nodeId);
    if (!node) return null;

    // 预留资源 (简化: 按场景Profile比例分配10%的节点总资源)
    const profile = SCENARIO_PROFILES[scenario].profile;
    const allocFraction = 0.1;
    const allocation: ResourceAllocation = {
      flowId,
      nodeId: bestScore.nodeId,
      scenario,
      allocatedResources: {
        compute: node.computeTotal * allocFraction * profile.compute,
        memoryBandwidth: node.memoryBandwidthTotal * allocFraction * profile.memoryBandwidth,
        memoryCapacity: node.memoryCapacityTotal * allocFraction * profile.memoryCapacity,
        ioBandwidth: node.ioBandwidthTotal * allocFraction * profile.ioBandwidth
      },
      score: bestScore,
      allocatedAt: Date.now()
    };

    // 更新节点可用资源
    this.updateNodeResource(bestScore.nodeId, {
      computeAvailable: Math.max(0, node.computeAvailable - allocation.allocatedResources.compute),
      memoryBandwidthAvailable: Math.max(0, node.memoryBandwidthAvailable - allocation.allocatedResources.memoryBandwidth),
      memoryCapacityAvailable: Math.max(0, node.memoryCapacityAvailable - allocation.allocatedResources.memoryCapacity),
      ioBandwidthAvailable: Math.max(0, node.ioBandwidthAvailable - allocation.allocatedResources.ioBandwidth),
      loadFactor: Math.min(1, node.loadFactor + allocFraction)
    });

    this.allocations.set(flowId, allocation);
    this.stats.totalAllocations++;
    this.stats.scenarioCounts[scenario]++;

    return allocation;
  }

  /**
   * 释放流资源
   */
  releaseResource(flowId: string): boolean {
    const alloc = this.allocations.get(flowId);
    if (!alloc) return false;

    const node = this.nodes.get(alloc.nodeId);
    if (node) {
      this.updateNodeResource(alloc.nodeId, {
        computeAvailable: Math.min(node.computeTotal, node.computeAvailable + alloc.allocatedResources.compute),
        memoryBandwidthAvailable: Math.min(node.memoryBandwidthTotal, node.memoryBandwidthAvailable + alloc.allocatedResources.memoryBandwidth),
        memoryCapacityAvailable: Math.min(node.memoryCapacityTotal, node.memoryCapacityAvailable + alloc.allocatedResources.memoryCapacity),
        ioBandwidthAvailable: Math.min(node.ioBandwidthTotal, node.ioBandwidthAvailable + alloc.allocatedResources.ioBandwidth),
        loadFactor: Math.max(0, node.loadFactor - 0.1)
      });
    }

    this.allocations.delete(flowId);
    return true;
  }

  // =============== Batch Operations ===============

  /**
   * 批量场景路由 (同一场景多个flowId)
   */
  batchAllocate(flowIds: string[], scenario: ScenarioType): ResourceAllocation[] {
    const results: ResourceAllocation[] = [];
    for (const flowId of flowIds) {
      const alloc = this.allocateResource(flowId, scenario);
      if (alloc) results.push(alloc);
    }
    return results;
  }

  /**
   * 跨场景对比评分 (同一节点在不同场景下的评分)
   */
  compareScenarios(nodeId: string): Record<ScenarioType, ResourceScore> | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const result: Record<string, ResourceScore> = {};
    for (const scenario of Object.keys(SCENARIO_PROFILES) as ScenarioType[]) {
      result[scenario] = this.calculateBlendedScore(node, scenario);
    }
    return result as Record<ScenarioType, ResourceScore>;
  }

  // =============== Dynamic Rebalancing ===============

  /**
   * 动态再平衡: 检测资源倾斜并重新分配
   * 当某维度利用率超过80%而其他维度低于30%时触发
   */
  rebalance(): { rebalanced: number; details: string[] } {
    const details: string[] = [];
    let rebalanced = 0;

    for (const [flowId, alloc] of this.allocations) {
      const node = this.nodes.get(alloc.nodeId);
      if (!node) continue;

      // 检测维度倾斜
      const utils = [
        { dim: 'compute', util: 1 - node.computeAvailable / node.computeTotal },
        { dim: 'memoryBandwidth', util: 1 - node.memoryBandwidthAvailable / node.memoryBandwidthTotal },
        { dim: 'memoryCapacity', util: 1 - node.memoryCapacityAvailable / node.memoryCapacityTotal },
        { dim: 'ioBandwidth', util: 1 - node.ioBandwidthAvailable / node.ioBandwidthTotal }
      ];

      const maxUtil = Math.max(...utils.map(u => u.util));
      const minUtil = Math.min(...utils.map(u => u.util));

      if (maxUtil > 0.8 && minUtil < 0.3) {
        const maxDim = utils.find(u => u.util === maxUtil)?.dim || 'unknown';
        // 尝试迁移到更均衡的节点
        const newScore = this.selectBestNode(alloc.scenario, [alloc.nodeId]);
        if (newScore && newScore.overallScore > alloc.score.overallScore * 1.1) {
          this.releaseResource(flowId);
          const newAlloc = this.allocateResource(flowId, alloc.scenario);
          if (newAlloc) {
            rebalanced++;
            details.push(`${flowId}: ${alloc.nodeId}→${newAlloc.nodeId} (倾斜维度: ${maxDim})`);
          }
        }
      }
    }

    return { rebalanced, details };
  }

  // =============== Statistics ===============

  /**
   * 获取所有场景预设
   */
  getAllScenarioProfiles(): Record<ScenarioType, ScenarioProfile> {
    return { ...SCENARIO_PROFILES };
  }

  /**
   * 获取当前分配
   */
  getAllocation(flowId: string): ResourceAllocation | undefined {
    return this.allocations.get(flowId);
  }

  /**
   * 获取所有节点资源
   */
  getAllNodes(): NodeResource[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const nodes = Array.from(this.nodes.values());
    const resourceUtilization = {
      compute: nodes.length > 0 ? nodes.reduce((s, n) => s + (1 - n.computeAvailable / n.computeTotal), 0) / nodes.length : 0,
      memoryBandwidth: nodes.length > 0 ? nodes.reduce((s, n) => s + (1 - n.memoryBandwidthAvailable / n.memoryBandwidthTotal), 0) / nodes.length : 0,
      memoryCapacity: nodes.length > 0 ? nodes.reduce((s, n) => s + (1 - n.memoryCapacityAvailable / n.memoryCapacityTotal), 0) / nodes.length : 0,
      ioBandwidth: nodes.length > 0 ? nodes.reduce((s, n) => s + (1 - n.ioBandwidthAvailable / n.ioBandwidthTotal), 0) / nodes.length : 0,
    };

    return {
      nodeCount: this.nodes.size,
      activeAllocations: this.allocations.size,
      totalAllocations: this.stats.totalAllocations,
      scenarioCounts: { ...this.stats.scenarioCounts },
      resourceUtilization,
      config: { ...this.config }
    };
  }

  /**
   * 获取系统状态
   */
  get_state() {
    return {
      module: 'ResourceProfileManager',
      version: '7.0.0',
      ...this.getStats()
    };
  }

  /**
   * 清理所有分配和节点
   */
  dispose(): void {
    this.allocations.clear();
    this.nodes.clear();
    this.stats.totalAllocations = 0;
    Object.keys(this.stats.scenarioCounts).forEach(k => {
      this.stats.scenarioCounts[k as ScenarioType] = 0;
    });
  }
}

// =============== Singleton ===============

let _instance: ResourceProfileManager | null = null;

export function getResourceProfileManager(config?: Partial<ResourceProfileConfig>): ResourceProfileManager {
  if (!_instance) {
    _instance = new ResourceProfileManager(config);
  }
  return _instance;
}

// =============== Self-Test ===============

if (require.main === module) {
  const manager = new ResourceProfileManager();

  console.log('\n=== 四维ResourceProfile资源评估自测 ===\n');

  // 注册模拟节点
  const nodes: NodeResource[] = [
    {
      nodeId: 'compute-heavy-1',
      computeAvailable: 400, computeTotal: 500,
      memoryBandwidthAvailable: 80, memoryBandwidthTotal: 100,
      memoryCapacityAvailable: 256, memoryCapacityTotal: 512,
      ioBandwidthAvailable: 40, ioBandwidthTotal: 50,
      loadFactor: 0.2, phiFit: 0.8, phaseEntropy: 0.2
    },
    {
      nodeId: 'mem-bw-heavy-2',
      computeAvailable: 200, computeTotal: 300,
      memoryBandwidthAvailable: 380, memoryBandwidthTotal: 400,
      memoryCapacityAvailable: 512, memoryCapacityTotal: 1024,
      ioBandwidthAvailable: 30, ioBandwidthTotal: 40,
      loadFactor: 0.3, phiFit: 0.7, phaseEntropy: 0.3
    },
    {
      nodeId: 'io-heavy-3',
      computeAvailable: 150, computeTotal: 200,
      memoryBandwidthAvailable: 60, memoryBandwidthTotal: 100,
      memoryCapacityAvailable: 128, memoryCapacityTotal: 256,
      ioBandwidthAvailable: 900, ioBandwidthTotal: 1000,
      loadFactor: 0.1, phiFit: 0.9, phaseEntropy: 0.1
    }
  ];

  manager.registerNodes(nodes);

  // 测试1: 场景感知路由
  const m78Node = manager.selectBestNode('M78_INFERENCE');
  const m84Node = manager.selectBestNode('M84_PHI_COMPUTE');
  const payNode = manager.selectBestNode('PHI402_MICROPAYMENT');
  console.log(`测试1 - 场景路由:`);
  console.log(`  M78推理 → ${m78Node?.nodeId} (score=${m78Node?.overallScore.toFixed(3)})`);
  console.log(`  M84 Φ计算 → ${m84Node?.nodeId} (score=${m84Node?.overallScore.toFixed(3)})`);
  console.log(`  Φ-402微支付 → ${payNode?.nodeId} (score=${payNode?.overallScore.toFixed(3)})`);

  // 测试2: 资源分配
  const alloc1 = manager.allocateResource('flow-m78-1', 'M78_INFERENCE');
  const alloc2 = manager.allocateResource('flow-m84-1', 'M84_PHI_COMPUTE');
  const alloc3 = manager.allocateResource('flow-pay-1', 'PHI402_MICROPAYMENT');
  console.log(`\n测试2 - 资源分配: ${alloc1 ? 'OK' : 'FAIL'}, ${alloc2 ? 'OK' : 'FAIL'}, ${alloc3 ? 'OK' : 'FAIL'}`);
  console.log(`  M78→${alloc1?.nodeId}, M84→${alloc2?.nodeId}, Φ402→${alloc3?.nodeId}`);

  // 测试3: 跨场景对比
  const comparison = manager.compareScenarios('compute-heavy-1');
  if (comparison) {
    console.log(`\n测试3 - 跨场景对比 (compute-heavy-1):`);
    for (const [scenario, score] of Object.entries(comparison)) {
      console.log(`  ${scenario}: overall=${score.overallScore.toFixed(3)}, liu=${score.liuScore.toFixed(3)}`);
    }
  }

  // 测试4: 统计
  const stats = manager.getStats();
  console.log(`\n测试4 - 统计: ${stats.nodeCount}节点, ${stats.activeAllocations}活跃分配`);
  console.log(`  场景分布: ${JSON.stringify(stats.scenarioCounts)}`);
  console.log(`  资源利用率: compute=${(stats.resourceUtilization.compute * 100).toFixed(1)}%, ` +
    `memBW=${(stats.resourceUtilization.memoryBandwidth * 100).toFixed(1)}%, ` +
    `memCap=${(stats.resourceUtilization.memoryCapacity * 100).toFixed(1)}%, ` +
    `ioBW=${(stats.resourceUtilization.ioBandwidth * 100).toFixed(1)}%`);

  // 测试5: 释放资源
  manager.releaseResource('flow-m78-1');
  const afterRelease = manager.getStats();
  console.log(`\n测试5 - 释放后: ${afterRelease.activeAllocations}活跃分配 → ${afterRelease.activeAllocations === 2 ? 'PASS' : 'FAIL'}`);

  // 测试6: 四维配比验证
  console.log(`\n测试6 - 四维配比验证:`);
  for (const [scenario, preset] of Object.entries(manager.getAllScenarioProfiles())) {
    const sum = preset.profile.compute + preset.profile.memoryBandwidth + preset.profile.memoryCapacity + preset.profile.ioBandwidth;
    console.log(`  ${scenario}: 总和=${sum.toFixed(2)} → ${Math.abs(sum - 1.0) < 0.01 ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n=== 自测完成 ===\n');
}
