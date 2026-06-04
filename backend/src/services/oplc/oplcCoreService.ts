/**
 * OPLC (奇正格链 - Odd-Positive Lattice Chain) 核心服务
 *
 * 统一编排所有 OPLC 子模块：
 * 1. PosetEngine — 偏序格数据结构 + meet/join/极大元
 * 2. TernaryVoteEngine — 三进制投票状态机 (+1/0/-1)
 * 3. OpBftConsensus — OP-BFT 共识算法
 * 4. MerkleProof 验证器 — -1 票证据验证
 *
 * 提供给 API 层的统一接口。
 *
 * @version V15.0
 */

import {
  TernaryVoteValue,
  TernaryVote,
  TransactionId,
  NodeId,
  PosetTransaction,
  MaximalElement,
  ConsensusResult,
  OPLCNodeState,
  PhiMetric,
} from './types';
import { PosetEngine } from './posetEngine';
import { TernaryVoteEngine, DEFAULT_VOTE_CONFIG, TernaryVoteConfig } from './ternaryVoteMachine';
import { OpBftConsensus, DEFAULT_OPBFT_CONFIG } from './opBftConsensus';
import { buildMerkleTree, verifyMerkleProof, calculateTopologicalImpedance } from './merkleProof';

// ============================================================================
// OPLC 系统配置
// ============================================================================

export interface OPLCSystemConfig {
  nodeId: NodeId;
  voteConfig?: Partial<TernaryVoteConfig>;
  consensusConfig?: Partial<import('./opBftConsensus').OpBftConfig>;
  /** 是否自动出块 (极大元打包) */
  autoPackage: boolean;
  /** 自动出块的交易数阈值 */
  autoPackageThreshold: number;
}

export const DEFAULT_OPLC_CONFIG: OPLCSystemConfig = {
  nodeId: `node-${Date.now()}`,
  autoPackage: true,
  autoPackageThreshold: 10,
};

// ============================================================================
// OPLC 核心服务
// ============================================================================

/**
 * OPLC 核心服务 — 奇正格链主入口
 *
 * 使用示例:
 * ```typescript
 * const oplc = new OPLCCoreService({ nodeId: 'node-1' });
 *
 * // 添加交易
 * const tx = oplc.createTransaction({ type: 'transfer', amount: 100 });
 *
 * // 投票
 * oplc.castVote(tx.id, { voter: 'node-2', vote: POSITIVE });
 *
 * // 运行共识
 * const result = await oplc.runConsensus();
 * ```
 */
export class OPLCCoreService {
  private poset: PosetEngine;
  private voteEngine: TernaryVoteEngine;
  private consensus: OpBftConsensus;
  private config: OPLCSystemConfig;

  constructor(config?: Partial<OPLCSystemConfig>) {
    this.config = { ...DEFAULT_OPLC_CONFIG, ...config };

    // 初始化子模块
    this.poset = new PosetEngine(this.config.nodeId);
    this.voteEngine = new TernaryVoteEngine(this.config.voteConfig);
    this.consensus = new OpBftConsensus(
      this.poset,
      this.voteEngine,
      this.config.consensusConfig
    );
  }

  // --------------------------------------------------------------------------
  // 交易管理
  // --------------------------------------------------------------------------

  /**
   * 创建新交易并加入 Poset
   */
  createTransaction(
    data: Record<string, unknown>,
    parentIds: TransactionId[] = []
  ): PosetTransaction {
    const tx = this.poset.addTransaction(data, parentIds);

    // 自动开启投票轮次
    this.voteEngine.createVotingRound(tx.id);

    return tx;
  }

  /**
   * 获取交易详情
   */
  getTransaction(txId: TransactionId): PosetTransaction | undefined {
    return this.poset.getTransaction(txId);
  }

  /**
   * 获取所有交易
   */
  getAllTransactions(): PosetTransaction[] {
    return this.poset.getAllTransactions();
  }

  // --------------------------------------------------------------------------
  // 投票接口
  // --------------------------------------------------------------------------

  /**
   * 为某交易提交三进制票
   */
  castVote(
    txId: TransactionId,
    vote: TernaryVote
  ): ReturnType<TernaryVoteEngine['castVote']> {
    return this.voteEngine.castVote(txId, vote);
  }

  /**
   * 批量提交模拟投票（用于测试）
   */
  castSimulatedVotes(
    txId: TransactionId,
    nodeCount: number = 5,
    positiveRatio: number = 0.6
  ): { success: number; failed: number } {
    let success = 0, failed = 0;

    for (let i = 0; i < nodeCount; i++) {
      let voteVal: TernaryVoteValue;
      const rand = Math.random();
      if (rand < positiveRatio) {
        voteVal = TernaryVoteValue.POSITIVE;
      } else if (rand < positiveRatio + 0.1) {
        voteVal = TernaryVoteValue.NEGATIVE; // 10% 负票率
      } else {
        voteVal = TernaryVoteValue.NEUTRAL;
      }

      const result = this.castVote(txId, {
        voter: `sim-node-${i}`,
        vote: voteVal,
        timestamp: new Date(),
      });

      if (result.success) success++;
      else failed++;
    }

    return { success, failed };
  }

  // --------------------------------------------------------------------------
  // 共识执行
  // --------------------------------------------------------------------------

  /**
   * 对当前极大元集运行 OP-BFT 共识
   */
  async runConsensus(): Promise<{
    result: ConsensusResult;
    maximalElement?: MaximalElement;
    phiBefore: PhiMetric;
    phiAfter: PhiMetric;
    theorem31: ReturnType<OpBftConsensus['verifyTheorem31_Safety']>;
    theorem32: ReturnType<OpBftConsensus['verifyTheorem32_Liveness']>;
  }> {
    const phiBefore = this.poset.computePhiMetric();

    // 计算当前极大元集
    const maximalTxs = this.poset.computeMaximalElements();

    // 如果开启了自动出块且交易数达到阈值
    if (
      this.config.autoPackage &&
      maximalTxs.length >= this.config.autoPackageThreshold
    ) {
      this.poset.packageMaximalElement(maximalTxs);
    }

    // 运行共识
    const round = this.consensus.startRound(maximalTxs);

    // 收集已投票结果并聚合
    for (const txId of maximalTxs) {
      const roundInfo = this.voteEngine.getActiveRound(txId);
      if (roundInfo) {
        const agg = roundInfo.aggregate();
        if (agg.isFinalized) {
          // 将投票结果写入共识轮次
          for (const detail of agg.details) {
            this.consensus.submitVote(round.roundId, {
              voter: detail.voter,
              vote: agg.currentResult === 'PENDING'
                ? TernaryVoteValue.NEUTRAL
                : agg.currentResult as TernaryVoteValue,
              timestamp: new Date(),
            }).catch(() => {});
          }
        }
      }
    }

    // 尝试终结
    let result = this.consensus.tryFinalize(round.roundId);
    if (!result) {
      // 强制结算超时
      result = {
        accepted: true,
        finalVote: TernaryVoteValue.POSITIVE,
        latencyMs: Date.now() - round.startTime.getTime(),
      };
    }

    const phiAfter = this.poset.computePhiMetric();
    const theorem31 = this.consensus.verifyTheorem31_Safety();
    const theorem32 = this.consensus.verifyTheorem32_Liveness();

    return {
      result,
      maximalElement: this.poset.getMaximalElements().pop(),
      phiBefore,
      phiAfter,
      theorem31,
      theorem32,
    };
  }

  // --------------------------------------------------------------------------
  // 冲突调解
  // --------------------------------------------------------------------------

  /**
   * 手动触发两笔交易的冲突调解
   */
  reconcileConflict(
    txIdA: TransactionId,
    txIdB: TransactionId
  ): TransactionId | null {
    return this.consensus.reconcileConflict(txIdA, txIdB);
  }

  // --------------------------------------------------------------------------
  // Merkle Proof 工具
  // --------------------------------------------------------------------------

  /**
   * 为一组交易构建 Merkle Tree 并返回根哈希
   */
  buildMerkleTreeForTransactions(txIds: TransactionId[]): {
    rootHash: string;
    depth: number;
    leafCount: number;
  } {
    const hashes = txIds.map(id => id); // 使用 ID 作为叶哈希（简化）
    const tree = buildMerkleTree(hashes);
    return {
      rootHash: tree.root.hash,
      depth: tree.depth,
      leafCount: tree.leaves.length,
    };
  }

  /**
   * 验证一个 Merkle Proof
   */
  verifyProof(
    targetHash: string,
    proof: { hash: string; isRight: boolean }[],
    expectedRoot: string
  ): ReturnType<typeof verifyMerkleProof> {
    return verifyMerkleProof(targetHash, proof, expectedRoot);
  }

  // --------------------------------------------------------------------------
  // 查询与统计
  // --------------------------------------------------------------------------

  /**
   * 导出完整节点状态
   */
  exportNodeState(): OPLCNodeState & {
    posetStats: ReturnType<PosetEngine['getStats']>;
    voteStats: ReturnType<TernaryVoteEngine['getStats']>;
    consensusStats: ReturnType<OpBftConsensus['getConsensusStats']>;
    config: OPLCSystemConfig;
  } {
    const baseState = this.poset.exportNodeState();
    return {
      ...baseState,
      posetStats: this.poset.getStats(),
      voteStats: this.voteEngine.getStats(),
      consensusStats: this.consensus.getConsensusStats(),
      config: this.config,
    };
  }

  /**
   * 获取当前极大元集（"区块链"视图）
   */
  getBlockchainView(): Array<{
    blockId: string;
    transactionCount: number;
    joinHash: string;
    confirmed: boolean;
    lamportTimestamp: number;
    createdAt: string;
  }> {
    return this.poset.getMaximalElements().map(me => ({
      blockId: me.id,
      transactionCount: me.transactions.length,
      joinHash: me.joinHash,
      confirmed: me.confirmed,
      lamportTimestamp: me.lamportTimestamp,
      createdAt: me.createdAt.toISOString(),
    }));
  }

  /**
   * 获取系统健康报告
   */
  getHealthReport(): {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    uptime: number;
    metrics: PhiMetric & {
      activeVotes: number;
      pendingRounds: number;
      totalBlocks: number;
      impedanceLevel: string;
    };
  } {
    const phi = this.poset.computePhiMetric();
    const stats = this.poset.getStats();
    const voteStats = this.voteEngine.getStats();
    const consensusStats = this.consensus.getConsensusStats();

    // 健康判定逻辑
    const status =
      phi.entropy < 0.3 && consensusStats.accusationRate < 0.1
        ? 'HEALTHY'
        : phi.entropy < 0.6
        ? 'DEGRADED'
        : 'UNHEALTHY';

    return {
      status,
      uptime: process.uptime(),
      metrics: {
        ...phi,
        activeVotes: voteStats.totalVotesCast,
        pendingRounds: voteStats.activeRounds,
        totalBlocks: stats.maximalElementCount,
        impedanceLevel: consensusStats.impedanceLevel,
      },
    };
  }
}

// ============================================================================
// 导出工厂函数
// ============================================================================

/**
 * 创建默认配置的 OPLC 实例
 */
export function createOPLC(nodeId?: string): OPLCCoreService {
  return new OPLCCoreService({ nodeId: nodeId || `node-${Date.now()}` });
}
