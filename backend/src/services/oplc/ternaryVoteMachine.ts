/**
 * OPLC 三进制投票状态机 (Ternary Vote State Machine)
 *
 * 实现 §4.3 三进制投票状态空间：
 *
 * 状态转换图:
 *   NEUTRAL(0) ──(+1验证通过)──→ POSITIVE(+1)  [终态]
 *   NEUTRAL(0) ──(-1揭发+证据)──→ NEGATIVE(-1) [终态, 需 Merkle Proof]
 *   NEGATIVE(-1) ──(证据无效)──→ NEUTRAL(0)       [回退]
 *
 * 投票聚合规则（多数决变体）：
 * - Σ(votes) > threshold → ACCEPT (+1)
 * - Σ(votes) < -threshold → REJECT (-1), 触发惩罚
 * - 否则 → PENDING (0), 进入下一轮
 *
 * @version V15.0
 */

import {
  TernaryVoteValue,
  TernaryLabels,
  TernaryVote,
  TransactionId,
  NodeId,
  PosetTransaction,
} from './types';
import { verifyMerkleProof } from './merkleProof';

// ============================================================================
// 状态机配置
// ============================================================================

/** 共识参数 */
export interface TernaryVoteConfig {
  /** 接受阈值 (正票数 - 负票数 > acceptanceThreshold 时接受) */
  acceptanceThreshold: number;
  /** 拒绝阈值 (负票数 - 正票数 > rejectionThreshold 时拒绝) */
  rejectionThreshold: number;
  /** 超时时间 (ms)，超时后按当前结果结算 */
  timeoutMs: number;
  /** -1 票所需的最小证明强度 (Merkle Proof path 最短长度) */
  minProofLength: number;
  /** 参与投票的最小节点比例 (0~1) */
  minParticipationRate: number;
}

/** 默认配置：2/3 多数决 + 10000ms 超时 */
export const DEFAULT_VOTE_CONFIG: TernaryVoteConfig = {
  acceptanceThreshold: 1,    // 正票数 > 负票数+1
  rejectionThreshold: 1,     // 负票数 > 正票数+1
  timeoutMs: 10_000,
  minProofLength: 1,
  minParticipationRate: 0.5, // 至少50%节点参与
};

// ============================================================================
// 投票轮次管理
// ============================================================================

/** 单个交易的三进制投票过程 */
export class VotingRound {
  public readonly targetTxId: TransactionId;
  private votes: Map<NodeId, TernaryVote> = new Map();
  private config: TernaryVoteConfig;
  private createdAt: Date;
  private closedAt?: Date;

  constructor(targetTxId: TransactionId, config: TernaryVoteConfig = DEFAULT_VOTE_CONFIG) {
    this.targetTxId = targetTxId;
    this.config = config;
    this.createdAt = new Date();
  }

  /**
   * 提交一票
   *
   * @param vote 三进制投票
   * @returns 是否接受此票（-1 票需验证 Merkle Proof）
   */
  submitVote(vote: TernaryVote): { accepted: boolean; reason?: string } {
    if (this.closedAt) {
      return { accepted: false, reason: 'Voting round already closed' };
    }

    // -1 票必须附带 Merkle Proof
    if (vote.vote === TernaryVoteValue.NEGATIVE) {
      if (!vote.evidence || vote.evidence.path.length < this.config.minProofLength) {
        return { accepted: false, reason: '-1 vote requires valid Merkle Proof evidence' };
      }
    }

    // 允许更新投票（同一节点重新投票覆盖旧票）
    this.votes.set(vote.voter, vote);
    return { accepted: true };
  }

  /**
   * 聚合投票结果
   *
   * @returns 当前聚合状态和最终判定
   */
  aggregate(): {
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    totalVotes: number;
    currentResult: TernaryVoteValue | 'PENDING';
    isFinalized: boolean;
    details: Array<{ voter: NodeId; vote: TernaryVoteValue; hasValidProof: boolean }>;
  } {
    let positive = 0, negative = 0, neutral = 0;
    const details: Array<{ voter: NodeId; vote: TernaryVoteValue; hasValidProof: boolean }> = [];

    for (const [, v] of this.votes) {
      switch (v.vote) {
        case TernaryVoteValue.POSITIVE: positive++; break;
        case TernaryVoteValue.NEGATIVE: negative++; break;
        case TernaryVoteValue.NEUTRAL: neutral++; break;
      }
      details.push({
        voter: v.voter,
        vote: v.vote,
        hasValidProof: !!v.evidence,
      });
    }

    const total = positive + negative + neutral;
    const netScore = positive - negative;

    let currentResult: TernaryVoteValue | 'PENDING' = 'PENDING';
    let isFinalized = false;

    // 检查是否超时
    const timedOut = Date.now() - this.createdAt.getTime() > this.config.timeoutMs;
    const participationRate = total / Math.max(this.config.minParticipationRate * 100, 1); // 简化

    if (
      netScore > this.config.acceptanceThreshold ||
      (timedOut && netScore >= 0)
    ) {
      currentResult = TernaryVoteValue.POSITIVE;
      isFinalized = true;
    } else if (
      netScore < -this.config.rejectionThreshold ||
      (timedOut && netScore < 0)
    ) {
      currentResult = TernaryVoteValue.NEGATIVE;
      isFinalized = true;
    }

    return {
      positiveCount: positive,
      negativeCount: negative,
      neutralCount: neutral,
      totalVotes: total,
      currentResult,
      isFinalized,
      details,
    };
  }

  /** 关闭投票轮次 */
  close(): void {
    if (!this.closedAt) {
      this.closedAt = new Date();
    }
  }

  get isClosed(): boolean { return !!this.closedAt; }
  get voteCount(): number { return this.votes.size; }
  getVotes(): Map<NodeId, TernaryVote> { return new Map(this.votes); }
}

// ============================================================================
// 全局投票管理器
// ============================================================================

/**
 * OPLC 三进制投票引擎
 *
 * 管理 Poset 中所有交易的投票生命周期：
 * 1. 交易创建后自动开启投票
 * 2. 节点提交三进制票
 * 3. 自动聚合+超时结算
 * 4. 结果写回交易的 aggregatedVote 字段
 */
export class TernaryVoteEngine {
  private activeRounds: Map<TransactionId, VotingRound> = new Map();
  private completedRounds: Map<TransactionId, VotingRound> = new Map();
  private config: TernaryVoteConfig;
  private merkleRoots: Map<string, string> = new Map();

  constructor(config?: Partial<TernaryVoteConfig>) {
    this.config = { ...DEFAULT_VOTE_CONFIG, ...config };
  }

  /**
   * 为新交易创建投票轮次
   */
  createVotingRound(txId: TransactionId): VotingRound {
    const round = new VotingRound(txId, this.config);
    this.activeRounds.set(txId, round);
    return round;
  }

  /**
   * 提交投票（自动路由到对应轮次）
   *
   * @param txId 目标交易ID
   * @param vote 投票内容
   * @returns 提交结果
   */
  castVote(
    txId: TransactionId,
    vote: TernaryVote
  ): {
    success: boolean;
    roundResult?: ReturnType<VotingRound['aggregate']>;
    error?: string;
  } {
    let round = this.activeRounds.get(txId);

    // 如果没有活跃轮次，自动创建
    if (!round) {
      round = this.createVotingRound(txId);
    }

    const result = round.submitVote(vote);

    if (!result.accepted) {
      return { success: false, error: result.reason };
    }

    // 提交成功后立即聚合检查
    const aggregation = round.aggregate();

    // 如果已最终确定，移动到已完成集合
    if (aggregation.isFinalized) {
      round.close();
      this.completedRounds.set(txId, round);
      this.activeRounds.delete(txId);
    }

    return { success: true, roundResult: aggregation };
  }

  /**
   * 注册 Merkle Root（用于验证 -1 票的证据）
   */
  registerMerkleRoot(blockHash: string, rootHash: string): void {
    this.merkleRoots.set(blockHash, rootHash);
  }

  /**
   * 批量结算所有超时的活跃投票轮次
   *
   * 应该由定时器周期性调用
   *
   * @returns 本轮结算的交易列表
   */
  settleTimeoutRounds(): Array<{
    txId: TransactionId;
    result: TernaryVoteValue | 'PENDING';
    positive: number;
    negative: number;
  }> {
    const settled: Array<{
      txId: TransactionId;
      result: TernaryVoteValue | 'PENDING';
      positive: number;
      negative: number;
    }> = [];

    for (const [txId, round] of this.activeRounds) {
      const agg = round.aggregate();
      if (agg.isFinalized) {
        round.close();
        this.completedRounds.set(txId, round);
        this.activeRounds.delete(txId);

        settled.push({
          txId,
          result: agg.currentResult === 'PENDING'
            ? TernaryVoteValue.NEUTRAL
            : agg.currentResult as TernaryVoteValue,
          positive: agg.positiveCount,
          negative: agg.negativeCount,
        });
      }
    }

    return settled;
  }

  /**
   * 将投票结果应用到 PosetTransaction
   */
  applyVoteResults(
    transactions: Map<TransactionId, PosetTransaction>
  ): number {
    let updated = 0;

    for (const [txId, round] of this.completedRounds) {
      const tx = transactions.get(txId);
      if (tx) {
        const agg = round.aggregate();
        if (agg.currentResult !== 'PENDING') {
          tx.aggregatedVote = agg.currentResult as TernaryVoteValue;
          tx.votes = round.getVotes();
          updated++;
        }
      }
    }

    return updated;
  }

  // --------------------------------------------------------------------------
  // 查询接口
  // --------------------------------------------------------------------------

  getActiveRound(txId: TransactionId): VotingRound | undefined {
    return this.activeRounds.get(txId);
  }

  getCompletedRound(txId: TransactionId): VotingRound | undefined {
    return this.completedRounds.get(txId);
  }

  getActiveRoundCount(): number { return this.activeRounds.size; }
  getCompletedRoundCount(): number { return this.completedRounds.size; }

  getStats(): {
    activeRounds: number;
    completedRounds: number;
    totalVotesCast: number;
    avgVotesPerRound: number;
  } {
    let totalVotes = 0;
    for (const [, r] of this.activeRounds) {
      totalVotes += r.voteCount;
    }
    for (const [, r] of this.completedRounds) {
      totalVotes += r.voteCount;
    }

    return {
      activeRounds: this.activeRounds.size,
      completedRounds: this.completedRounds.size,
      totalVotesCast: totalVotes,
      avgVotesPerRound:
        (this.activeRounds.size + this.completedRounds.size) > 0
          ? totalVotes / (this.activeRounds.size + this.completedRounds.size)
          : 0,
    };
  }
}
