/**
 * Liu Deterministic Path Pinning - Liu确定性路径钉扎
 *
 * V7.0 超节点语义对齐版: P0-1
 * 来源: 华为A5超节点ECMP实战经验
 *   "极致延迟场景必须放弃多路径路由ECMP，单路径传输是稳定性最优解，
 *    宁可牺牲带宽利用率也要消除路径冲突带来的性能波动。"
 *
 * 核心创新:
 * - flowId哈希钉扎: 同一flowId永远路由到同一候选节点子集
 * - 故障自动切换: 仅在节点故障时才重新钉扎
 * - 一致性哈希虚拟节点: 避免流量倾斜
 * - Φ相位连续性保证: 同一Agent的Φ请求状态连续
 */

import { createHash } from 'crypto';

// =============== Types ===============

export interface PinnedPath {
  flowId: string;
  primaryNodeId: string;
  backupNodeId: string | null;
  pinnedAt: number;
  lastUsed: number;
  switchCount: number;
  phiPhaseContinuity: number;  // Φ相位连续性评分 0-1
}

export interface PathPinConfig {
  /** 一致性哈希虚拟节点数 (默认150) */
  virtualNodeCount: number;
  /** 故障检测超时 (ms, 默认5000) */
  faultDetectionTimeoutMs: number;
  /** 最大切换次数 (超过告警, 默认5) */
  maxSwitchCount: number;
  /** 备份节点数 (默认2) */
  backupCount: number;
  /** Φ相位连续性阈值 (低于此值触发重新钉扎, 默认0.6) */
  phiPhaseThreshold: number;
}

export interface PathSwitchEvent {
  flowId: string;
  fromNodeId: string;
  toNodeId: string;
  reason: 'FAULT' | 'PHASE_DISCONTINUITY' | 'MANUAL';
  timestamp: number;
}

// =============== Constants ===============

const DEFAULT_PIN_CONFIG: PathPinConfig = {
  virtualNodeCount: 150,
  faultDetectionTimeoutMs: 5000,
  maxSwitchCount: 5,
  backupCount: 2,
  phiPhaseThreshold: 0.6,
};

// =============== Consistent Hash Ring ===============

class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];

  constructor(
    private readonly nodeIds: string[],
    private readonly virtualNodeCount: number
  ) {
    this.buildRing();
  }

  private buildRing(): void {
    this.ring.clear();
    this.sortedKeys = [];

    for (const nodeId of this.nodeIds) {
      for (let i = 0; i < this.virtualNodeCount; i++) {
        const key = this.hash(`${nodeId}:vnode:${i}`);
        this.ring.set(key, nodeId);
        this.sortedKeys.push(key);
      }
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  /**
   * 查找flowId对应的节点
   * 一致性哈希: 顺时针查找第一个虚拟节点
   */
  getNode(flowId: string): string | null {
    if (this.sortedKeys.length === 0) return null;

    const hash = this.hash(flowId);
    // 二分查找: 找到第一个 >= hash 的位置
    let lo = 0;
    let hi = this.sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sortedKeys[mid] < hash) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    // 环形: 超出则回到0
    if (lo >= this.sortedKeys.length) lo = 0;

    return this.ring.get(this.sortedKeys[lo]) || null;
  }

  /**
   * 获取候选节点列表 (主节点 + 备份节点)
   */
  getCandidateNodes(flowId: string, count: number): string[] {
    if (this.sortedKeys.length === 0) return [];

    const hash = this.hash(flowId);
    const candidates: string[] = [];
    const seen = new Set<string>();

    let lo = 0;
    let hi = this.sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.sortedKeys[mid] < hash) lo = mid + 1;
      else hi = mid;
    }

    // 顺时针遍历，收集不同物理节点
    for (let i = 0; i < this.sortedKeys.length && candidates.length < count; i++) {
      const idx = (lo + i) % this.sortedKeys.length;
      const nodeId = this.ring.get(this.sortedKeys[idx]);
      if (nodeId && !seen.has(nodeId)) {
        seen.add(nodeId);
        candidates.push(nodeId);
      }
    }

    return candidates;
  }

  /**
   * 重建哈希环 (节点变更时调用)
   */
  rebuild(nodeIds: string[]): void {
    this.nodeIds.splice(0, this.nodeIds.length, ...nodeIds);
    this.buildRing();
  }

  private hash(input: string): number {
    const h = createHash('md5').update(input).digest();
    return h.readUInt32BE(0);
  }
}

// =============== Liu Deterministic Path Pinner ===============

class LiuDeterministicPathPinner {
  private pinnedPaths: Map<string, PinnedPath> = new Map();
  private hashRing: ConsistentHashRing | null = null;
  private healthyNodes: Set<string> = new Set();
  private switchHistory: PathSwitchEvent[] = [];
  private config: PathPinConfig;

  constructor(config?: Partial<PathPinConfig>) {
    this.config = { ...DEFAULT_PIN_CONFIG, ...config };
  }

  /**
   * 初始化: 注册健康节点列表
   */
  initialize(nodeIds: string[]): void {
    this.healthyNodes = new Set(nodeIds);
    this.hashRing = new ConsistentHashRing(nodeIds, this.config.virtualNodeCount);
    console.log(
      `[LiuPinner] 初始化完成: ${nodeIds.length} 个节点, ` +
      `${this.config.virtualNodeCount} 个虚拟节点/物理节点`
    );
  }

  /**
   * 核心: 确定性路径钉扎
   *
   * 原理: flowId → 一致性哈希 → 固定节点子集
   * 保证: 同一Agent的多次Φ请求路由到同一节点子集
   * 切换: 仅在节点故障或Φ相位不连续时
   *
   * @param flowId 流标识 (通常为 Agent会话ID)
   * @returns 钉扎的主节点ID
   */
  pinPath(flowId: string): string {
    // 检查已有钉扎
    const existing = this.pinnedPaths.get(flowId);
    if (existing) {
      // 主节点健康 → 保持钉扎
      if (this.healthyNodes.has(existing.primaryNodeId)) {
        existing.lastUsed = Date.now();
        return existing.primaryNodeId;
      }
      // 主节点故障 → 切换到备份
      return this.switchPath(flowId, 'FAULT');
    }

    // 新钉扎: 一致性哈希确定节点
    if (!this.hashRing) {
      throw new Error('[LiuPinner] 未初始化，请先调用 initialize()');
    }

    const candidates = this.hashRing.getCandidateNodes(flowId, this.config.backupCount + 1);

    // 过滤不健康节点
    const healthyCandidates = candidates.filter(id => this.healthyNodes.has(id));
    if (healthyCandidates.length === 0) {
      throw new Error(`[LiuPinner] flowId=${flowId} 无可用健康节点`);
    }

    const primaryNodeId = healthyCandidates[0];
    const backupNodeId = healthyCandidates.length > 1 ? healthyCandidates[1] : null;

    const pinned: PinnedPath = {
      flowId,
      primaryNodeId,
      backupNodeId,
      pinnedAt: Date.now(),
      lastUsed: Date.now(),
      switchCount: 0,
      phiPhaseContinuity: 1.0,
    };

    this.pinnedPaths.set(flowId, pinned);
    return primaryNodeId;
  }

  /**
   * 获取钉扎路径详情
   */
  getPinnedPath(flowId: string): PinnedPath | undefined {
    return this.pinnedPaths.get(flowId);
  }

  /**
   * 更新Φ相位连续性
   *
   * 如果Agent的Φ请求导致相位跳变过大，可能需要重新钉扎
   * (通常不应发生，因为同一节点保证了状态连续性)
   */
  updatePhiPhaseContinuity(flowId: string, continuity: number): void {
    const pinned = this.pinnedPaths.get(flowId);
    if (!pinned) return;

    pinned.phiPhaseContinuity = continuity;

    // Φ相位不连续 → 重新钉扎
    if (continuity < this.config.phiPhaseThreshold) {
      console.warn(
        `[LiuPinner] flowId=${flowId} Φ相位不连续: ${continuity.toFixed(3)} ` +
        `< 阈值 ${this.config.phiPhaseThreshold}, 触发重新钉扎`
      );
      this.switchPath(flowId, 'PHASE_DISCONTINUITY');
    }
  }

  /**
   * 节点故障通知
   *
   * 当健康检查发现节点故障时调用，
   * 所有钉扎到该节点的flow自动切换到备份节点
   */
  notifyNodeFault(nodeId: string): number {
    const previouslyHealthy = this.healthyNodes.has(nodeId);
    this.healthyNodes.delete(nodeId);

    if (!previouslyHealthy) return 0;

    // 重建哈希环
    if (this.hashRing) {
      this.hashRing.rebuild(Array.from(this.healthyNodes));
    }

    // 切换所有受影响的钉扎路径
    let switchCount = 0;
    for (const [flowId, pinned] of this.pinnedPaths) {
      if (pinned.primaryNodeId === nodeId) {
        this.switchPath(flowId, 'FAULT');
        switchCount++;
      }
    }

    console.log(
      `[LiuPinner] 节点 ${nodeId} 故障, ` +
      `${switchCount} 条钉扎路径切换到备份节点`
    );
    return switchCount;
  }

  /**
   * 节点恢复通知
   */
  notifyNodeRecovery(nodeId: string): void {
    this.healthyNodes.add(nodeId);
    // 重建哈希环以包含恢复节点
    if (this.hashRing) {
      this.hashRing.rebuild(Array.from(this.healthyNodes));
    }
    // 注意: 不主动迁移已有钉扎路径 (保持稳定性)
    // 新flowId的钉扎会自动考虑恢复的节点
    console.log(`[LiuPinner] 节点 ${nodeId} 恢复, 已加入哈希环`);
  }

  /**
   * 获取路径切换历史
   */
  getSwitchHistory(limit: number = 100): PathSwitchEvent[] {
    return this.switchHistory.slice(-limit);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPinnedPaths: number;
    totalSwitches: number;
    avgPhiPhaseContinuity: number;
    healthyNodeCount: number;
  } {
    const paths = Array.from(this.pinnedPaths.values());
    const avgContinuity = paths.length > 0
      ? paths.reduce((sum, p) => sum + p.phiPhaseContinuity, 0) / paths.length
      : 0;

    return {
      totalPinnedPaths: paths.length,
      totalSwitches: this.switchHistory.length,
      avgPhiPhaseContinuity: Math.round(avgContinuity * 1000) / 1000,
      healthyNodeCount: this.healthyNodes.size,
    };
  }

  /**
   * 清理过期钉扎路径 (超过1小时未使用)
   */
  cleanup(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [flowId, pinned] of this.pinnedPaths) {
      if (now - pinned.lastUsed > maxAgeMs) {
        this.pinnedPaths.delete(flowId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[LiuPinner] 清理 ${cleaned} 条过期钉扎路径`);
    }
    return cleaned;
  }

  // =============== Private Methods ===============

  private switchPath(flowId: string, reason: PathSwitchEvent['reason']): string {
    const existing = this.pinnedPaths.get(flowId);
    if (!existing) {
      // 无已有钉扎，走新钉扎逻辑
      return this.pinPath(flowId);
    }

    const fromNodeId = existing.primaryNodeId;

    // 尝试使用备份节点
    if (existing.backupNodeId && this.healthyNodes.has(existing.backupNodeId)) {
      const newPrimary = existing.backupNodeId;

      // 需要选择新的备份节点
      let newBackup: string | null = null;
      if (this.hashRing) {
        const candidates = this.hashRing
          .getCandidateNodes(flowId, this.config.backupCount + 2)
          .filter(id => this.healthyNodes.has(id) && id !== newPrimary);
        newBackup = candidates[0] || null;
      }

      existing.primaryNodeId = newPrimary;
      existing.backupNodeId = newBackup;
      existing.switchCount++;
      existing.lastUsed = Date.now();

      this.recordSwitch(flowId, fromNodeId, newPrimary, reason);
      return newPrimary;
    }

    // 备份也不可用 → 重新计算
    this.pinnedPaths.delete(flowId);
    return this.pinPath(flowId);
  }

  private recordSwitch(
    flowId: string,
    fromNodeId: string,
    toNodeId: string,
    reason: PathSwitchEvent['reason']
  ): void {
    this.switchHistory.push({
      flowId,
      fromNodeId,
      toNodeId,
      reason,
      timestamp: Date.now(),
    });

    // 保留最近1000条切换记录
    if (this.switchHistory.length > 1000) {
      this.switchHistory = this.switchHistory.slice(-1000);
    }
  }
}

// =============== Singleton Export ===============

let _pinner: LiuDeterministicPathPinner | null = null;

export function getLiuDeterministicPathPinner(
  config?: Partial<PathPinConfig>
): LiuDeterministicPathPinner {
  if (!_pinner) {
    _pinner = new LiuDeterministicPathPinner(config);
  }
  return _pinner;
}

export function createLiuDeterministicPathPinner(
  config?: Partial<PathPinConfig>
): LiuDeterministicPathPinner {
  return new LiuDeterministicPathPinner(config);
}

export { LiuDeterministicPathPinner };

// =============== Self-Test ===============

if (require.main === module) {
  const pinner = createLiuDeterministicPathPinner();

  // 初始化5个节点
  const nodes = ['node-A', 'node-B', 'node-C', 'node-D', 'node-E'];
  pinner.initialize(nodes);

  console.log('\n=== Liu确定性路径钉扎自测 ===\n');

  // 测试1: 同一flowId始终路由到同一节点
  const flow1 = 'agent-session-001';
  const r1a = pinner.pinPath(flow1);
  const r1b = pinner.pinPath(flow1);
  const r1c = pinner.pinPath(flow1);
  console.log(`测试1 - 一致性: ${r1a} === ${r1b} === ${r1c} → ${r1a === r1b && r1b === r1c ? 'PASS' : 'FAIL'}`);

  // 测试2: 不同flowId可能路由到不同节点
  const results = new Set<string>();
  for (let i = 0; i < 50; i++) {
    results.add(pinner.pinPath(`flow-${i}`));
  }
  console.log(`测试2 - 分布性: 50个flowId分布到 ${results.size} 个节点 (期望≥3)`);

  // 测试3: 节点故障切换
  const faultNode = r1a;
  const switchedCount = pinner.notifyNodeFault(faultNode);
  const r1d = pinner.pinPath(flow1);
  console.log(`测试3 - 故障切换: ${faultNode}→${r1d}, 切换${switchedCount}条路径 → ${r1d !== faultNode ? 'PASS' : 'FAIL'}`);

  // 测试4: 节点恢复
  pinner.notifyNodeRecovery(faultNode);
  console.log(`测试4 - 恢复: ${faultNode} 重新加入, 统计: ${JSON.stringify(pinner.getStats())}`);

  // 测试5: Φ相位连续性
  pinner.updatePhiPhaseContinuity(flow1, 0.8);
  const path = pinner.getPinnedPath(flow1);
  console.log(`测试5 - Φ相位: continuity=${path?.phiPhaseContinuity} → ${path && path.phiPhaseContinuity >= 0.6 ? 'PASS' : 'FAIL'}`);

  console.log('\n=== 自测完成 ===\n');
}
