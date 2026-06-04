/**
 * OPLC 偏序格 (Poset / Partial Order Lattice) 引擎
 *
 * 实现文章 §3.1 偏序格定义 中的核心运算：
 * - meet (∧): 下确界 — 最大下界（最大共同祖先）
 * - join (∨): 上确界 — 最小上界（调解/合并）
 * - 极大元集计算: MaximalElements(P)
 * - 因果关系推导: happens-before 关系
 *
 * 定理 3.1: OPLC 的每个极大元是唯一的 → 对应传统"区块"
 * 定理 3.2: OP-BFT 在有限轮次内终止 (liveness)
 *
 * @version V15.0
 * @reference 微信文章《奇正格链》§3.1-§3.4
 */

import {
  PosetTransaction,
  TransactionId,
  BlockId,
  NodeId,
  MaximalElement,
  ReconciliationTransaction,
  TernaryVoteValue,
  ConsensusRound,
  ConsensusResult,
  OPLCNodeState,
  PhiMetric,
  TopologicalPhaseTransition,
} from './types';
import { sha256 } from './merkleProof';

// ============================================================================
// 偏序格数据结构
// ============================================================================

/**
 * OPLC Poset 引擎 — 核心偏序格运算
 */
export class PosetEngine {
  /** 所有交易映射 */
  private transactions: Map<TransactionId, PosetTransaction> = new Map();

  /** 极大元集（已确认的"区块"） */
  private maximalElements: MaximalElement[] = [];

  /** 当前 Lamport 时钟 */
  private lamportClock: number = 0;

  /** 节点 ID */
  private nodeId: NodeId;

  constructor(nodeId: NodeId) {
    this.nodeId = nodeId;
  }

  // --------------------------------------------------------------------------
  // 基础操作：添加交易、查询
  // --------------------------------------------------------------------------

  /**
   * 向 Poset 中添加新交易
   *
   * @param data 交易 payload
   * @param parentIds 父交易列表（因果依赖）
   * @returns 创建的交易对象
   */
  addTransaction(
    data: Record<string, unknown>,
    parentIds: TransactionId[] = []
  ): PosetTransaction {
    // 更新 Lamport 时钟
    this.lamportClock = Math.max(
      this.lamportClock,
      ...parentIds.map(pid => this.transactions.get(pid)?.lamportTimestamp || 0)
    ) + 1;

    const tx: PosetTransaction = {
      id: sha256(`${this.nodeId}-${Date.now()}-${Math.random()}`),
      parents: parentIds,
      creator: this.nodeId,
      lamportTimestamp: this.lamportClock,
      data,
      aggregatedVote: TernaryVoteValue.NEUTRAL,
      votes: new Map(),
      finalized: false,
      createdAt: new Date(),
    };

    this.transactions.set(tx.id, tx);
    return tx;
  }

  /**
   * 添加调解交易（冲突合并）
   *
   * 当两个极大元存在因果冲突时，通过 join 运算生成上界
   * 这是 OPLC 区别于传统链式区块链的核心创新：
   * 不分叉丢弃，而是合并为新的统一状态
   *
   * @param txId1 冲突交易1
   * @param txId2 冲突交易2
   * @returns 调解交易
   */
  addReconciliation(
    txId1: TransactionId,
    txId2: TransactionId
  ): ReconciliationTransaction | null {
    const tx1 = this.transactions.get(txId1);
    const tx2 = this.transactions.get(txId2);

    if (!tx1 || !tx2) return null;
    if (txId1 === txId2) return null;

    // 确认确实存在因果冲突（不可比较的两个元素）
    if (this.isComparable(txId1, txId2)) {
      return null; // 可比较的不需要调解，直接用 meet 即可
    }

    this.lamportClock++;
    const recTx: ReconciliationTransaction = {
      id: sha256(`reconcile-${txId1}-${txId2}-${this.lamportClock}`),
      parents: [txId1, txId2], // 双亲 = 两者的共同上界
      creator: this.nodeId,
      lamportTimestamp: this.lamportClock,
      data: {
        type: 'RECONCILIATION',
        leftTx: txId1,
        rightTx: txId2,
        resolvedAt: new Date().toISOString(),
      },
      aggregatedVote: TernaryVoteValue.NEUTRAL,
      votes: new Map(),
      finalized: false,
      createdAt: new Date(),
      reconciliationOf: [txId1, txId2],
      resolvedBy: this.nodeId,
    };

    this.transactions.set(recTx.id, recTx);
    return recTx;
  }

  /**
   * 获取交易
   */
  getTransaction(id: TransactionId): PosetTransaction | undefined {
    return this.transactions.get(id);
  }

  /**
   * 获取所有交易
   */
  getAllTransactions(): PosetTransaction[] {
    return Array.from(this.transactions.values());
  }

  // --------------------------------------------------------------------------
  // 偏序关系运算 (§3.1)
  // --------------------------------------------------------------------------

  /**
   * 判断两交易的可达性（happens-before 关系）
   *
   * tx_a ≤ tx_b 当且仅当 存在从 tx_a 到 tx_b 的因果路径
   *
   * 使用 BFS 遍历父指针链
   */
  isReachable(fromId: TransactionId, toId: TransactionId): boolean {
    if (fromId === toId) return true; // 自反性

    const visited = new Set<TransactionId>();
    const queue: TransactionId[] = [toId];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const tx = this.transactions.get(current);
      if (tx) {
        for (const parentId of tx.parents) {
          if (!visited.has(parentId)) {
            queue.push(parentId);
          }
        }
      }
    }

    return false;
  }

  /**
   * 判断两个交易是否可比较（存在偏序关系）
   *
   * 可比较 ⇔ a ≤ b 或 b ≤ a
   * 不可比较 ⇔ a 和 b 是并发事件（conflict/diamond）
   */
  isComparable(a: TransactionId, b: TransactionId): boolean {
    return this.isReachable(a, b) || this.isReachable(b, a);
  }

  /**
   * Meet 运算 (∧) — 计算下确界（最大共同祖先集合中的最优者）
   *
   * meet(a, b) = max{ x | x ≤ a 且 x ≤ b }
   *
   * 用途：找到两个交易最近的共同祖先
   */
  meet(a: TransactionId, b: TransactionId): TransactionId | null {
    if (a === b) return a;

    // 找到所有 a 的祖先
    const ancestorsOfA = this.getAncestors(a);

    // 找到同时是 b 祖先的最大元素
    let bestCandidate: TransactionId | null = null;
    let bestLamport = -1;

    for (const ancestor of ancestorsOfA) {
      if (ancestor !== b && this.isReachable(ancestor, b)) {
        const ancTx = this.transactions.get(ancestor);
        if (ancTx && ancTx.lamportTimestamp > bestLamport) {
          bestCandidate = ancestor;
          bestLamport = ancTx.lamportTimestamp;
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Join 运算 (∨) — 计算上确界（最小共同后继）
   *
   * join(a, b) = min{ x | a ≤ x 且 b ≤ x }
   *
   * 用途：
   * 1. 合并两个冲突分支为统一状态
   * 2. 生成新的极大元（区块）
   *
   * 如果 a, b 可比较，join 就是两者中较晚的那个
   * 如果 a, b 不可比较（冲突），join 就是调解交易
   */
  join(a: TransactionId, b: TransactionId): TransactionId | null {
    if (a === b) return a;

    // 如果可比较，返回较晚的
    if (this.isReachable(a, b)) return b;
    if (this.isReachable(b, a)) return a;

    // 不可比较：寻找是否已有共同的后续（已有的调解交易）
    for (const [, tx] of this.transactions) {
      if (
        tx.parents.includes(a) &&
        tx.parents.includes(b)
      ) {
        return tx.id; // 已有调解交易
      }
    }

    // 需要创建新的调解交易
    const recTx = this.addReconciliation(a, b);
    return recTx?.id || null;
  }

  // --------------------------------------------------------------------------
  // 极大元集计算 (§3.2)
  // --------------------------------------------------------------------------

  /**
   * 计算当前 Poset 的极大元集 MaximalElements(P)
   *
   * 极大元定义：不存在其他元素使得 极大元 < 其他元素
   * 即：没有父节点的交易（或所有父节点都已 finalized）
   *
   * 在 OPLC 中，极大元集对应传统区块链的"未确认交易池 + 最新区块"
   */
  computeMaximalElements(): TransactionId[] {
    const unfinalizedTxs = Array.from(this.transactions.values()).filter(
      tx => !tx.finalized
    );

    if (unfinalizedTxs.length === 0) return [];

    // 极大元 = 没有其他未最终确定的交易以它为父节点
    const maximalIds: TransactionId[] = [];

    for (const tx of unfinalizedTxs) {
      const hasChild = unfinalizedTxs.some(
        other => other.parents.includes(tx.id) && other.id !== tx.id
      );
      if (!hasChild) {
        maximalIds.push(tx.id);
      }
    }

    return maximalIds;
  }

  /**
   * 将一批交易打包为极大元（"出块"）
   *
   * @param transactionIds 待打包的交易ID列表
   * @returns 创建的极大元（区块）
   *
   * 打包规则：
   * 1. 所有交易必须是当前极大元集中的元素
   * 2. 如果交易间存在因果关系，保持拓扑序
   * 3. 计算 joinHash 作为区块唯一标识
   */
  packageMaximalElement(
    transactionIds: TransactionId[]
  ): MaximalElement | null {
    if (transactionIds.length === 0) return null;

    // 验证所有交易都存在
    for (const id of transactionIds) {
      if (!this.transactions.has(id)) return null;
    }

    // 按拓扑序排序
    const sortedIds = this.topologicalSort(transactionIds);

    // 找到父极大元（与当前极大元有因果关系的已有区块）
    const parentBlocks: BlockId[] = [];
    for (const existingME of this.maximalElements) {
      for (const txId of sortedIds) {
        const tx = this.transactions.get(txId);
        if (tx && existingME.transactions.some(eid => this.isReachable(eid, txId))) {
          if (!parentBlocks.includes(existingME.id)) {
            parentBlocks.push(existingME.id);
          }
        }
      }
    }

    this.lamportClock++;
    const joinHash = sha256(sortedIds.join('-') + '-' + this.lamportClock);

    const me: MaximalElement = {
      id: `block-${sha256(joinHash).slice(0, 16)}`,
      transactions: sortedIds,
      parentBlocks,
      joinHash,
      createdAt: new Date(),
      confirmed: false,
      lamportTimestamp: this.lamportClock,
    };

    // 标记交易为已 final
    for (const id of sortedIds) {
      const tx = this.transactions.get(id);
      if (tx) tx.finalized = true;
    }

    // 移除已被此极大元包含的旧极大元
    this.maximalElements = this.maximalElements.filter(
      old => !sortedIds.some(newId => old.transactions.includes(newId))
    );
    this.maximalElements.push(me);

    return me;
  }

  // --------------------------------------------------------------------------
  // 辅助方法
  // --------------------------------------------------------------------------

  /**
   * 获取某交易的所有祖先（闭包）*/
  private getAncestors(txId: TransactionId): Set<TransactionId> {
    const ancestors = new Set<TransactionId>();
    const queue: TransactionId[] = [txId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const tx = this.transactions.get(current);
      if (tx) {
        for (const pid of tx.parents) {
          if (!ancestors.has(pid)) {
            ancestors.add(pid);
            queue.push(pid);
          }
        }
      }
    }

    return ancestors;
  }

  /**
   * 拓扑排序（Kahn 算法）
   *
   * 保证打包时因果顺序正确
   */
  topologicalSort(ids: TransactionId[]): TransactionId[] {
    const inDegree = new Map<TransactionId, number>();
    const adjList = new Map<TransactionId, TransactionId[]>();

    for (const id of ids) {
      inDegree.set(id, 0);
      adjList.set(id, []);
    }

    for (const id of ids) {
      const tx = this.transactions.get(id);
      if (tx) {
        for (const pid of tx.parents) {
          if (ids.includes(pid)) {
            adjList.get(pid)?.push(id);
            inDegree.set(id, (inDegree.get(id) || 0) + 1);
          }
        }
      }
    }

    const queue: TransactionId[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: TransactionId[] = [];
    while (queue.length > 0) {
      // 按 Lamport 时间戳排序取最小（FIFO + Lamport）
      queue.sort((a, b) => {
        const ta = this.transactions.get(a)?.lamportTimestamp || 0;
        const tb = this.transactions.get(b)?.lamportTimestamp || 0;
        return ta - tb;
      });

      const current = queue.shift()!;
      result.push(current);

      for (const next of adjList.get(current) || []) {
        inDegree.set(next, (inDegree.get(next) || 0) - 1);
        if ((inDegree.get(next) || 0) === 0) {
          queue.push(next);
        }
      }
    }

    return result; // 如果有环则返回部分排序（OPLC 应保证 DAG）
  }

  /**
   * 获取当前极大元集（只读副本）
   */
  getMaximalElements(): MaximalElement[] {
    return [...this.maximalElements];
  }

  /**
   * 获取 Poset 统计信息
   */
  getStats(): {
    totalTransactions: number;
    finalizedCount: number;
    maximalElementCount: number;
    lamportClock: number;
    avgBranchingFactor: number;
    estimatedDepth: number;
  } {
    const allTxs = Array.from(this.transactions.values());
    const totalParents = allTxs.reduce((sum, tx) => sum + tx.parents.length, 0);

    return {
      totalTransactions: allTxs.length,
      finalizedCount: allTxs.filter(t => t.finalized).length,
      maximalElementCount: this.maximalElements.length,
      lamportClock: this.lamportClock,
      avgBranchingFactor: allTxs.length > 0 ? totalParents / allTxs.length : 0,
      estimatedDepth: this.estimateDepth(),
    };
  }

  /** 估算 Poset 深度（最长因果链长度） */
  private estimateDepth(): number {
    let maxDepth = 0;
    for (const [, tx] of this.transactions) {
      const depth = this.computeDepth(tx.id);
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }

  private computeDepth(txId: TransactionId, memo = new Map<TransactionId, number>()): number {
    if (memo.has(txId)) return memo.get(txId)!;
    const tx = this.transactions.get(txId);
    if (!tx || tx.parents.length === 0) {
      memo.set(txId, 1);
      return 1;
    }
    const maxParentDepth = Math.max(...tx.parents.map(p => this.computeDepth(p, memo)));
    memo.set(txId, maxParentDepth + 1);
    return maxParentDepth + 1;
  }

  /**
   * 计算 Φ 流贯度量（Poset 结构健康度）
   *
   * 基于 TOSAS §5 信息势场理论
   */
  computePhiMetric(): PhiMetric {
    const stats = this.getStats();
    const totalEdges = stats.totalTransactions * stats.avgBranchingFactor;

    // S = 关系作用量（边的数量越少越稳定）
    const relationActionS = totalEdges;

    // 相位耦合 = 最终化率
    const phaseCoupling = stats.totalTransactions > 0
      ? stats.finalizedCount / stats.totalTransactions
      : 0;

    // 拓扑阻抗 ≈ log(深度) × 未最终交易数
    const topologicalImpedance = Math.log2(stats.estimatedDepth + 1) *
      (stats.totalTransactions - stats.finalizedCount + 1);

    // 熵 = 1 - phaseCoupling（越高越无序）
    const entropy = 1 - phaseCoupling;

    return {
      relationActionS,
      phaseCoupling,
      topologicalImpedance,
      entropy,
    };
  }

  /**
   * 导出节点状态（用于网络同步）
   */
  exportNodeState(): OPLCNodeState {
    return {
      nodeId: this.nodeId,
      localMaximalElements: this.maximalElements,
      knownTransactions: this.transactions,
      lamportClock: this.lamportClock,
      reputation: 1.0,
      flagged: false,
      lastActive: new Date(),
      stats: {
        totalRounds: 0,
        positiveVotes: 0,
        negativeVotes: 0,
        accusationsMade: 0,
        accusationsReceived: 0,
        successfulAccusations: 0,
      },
    };
  }
}
