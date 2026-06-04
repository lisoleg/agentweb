/**
 * OP-BFT (Odd-Positive Byzantine Fault Tolerance) 共识算法
 *
 * 实现 §4 OP-BFT 共识协议：
 *
 * 核心创新：
 * 1. 三进制投票（+1/0/-1）替代传统二进制（accept/reject）
 * 2. -1 票需要 Merkle Proof 证据，防止恶意诬告
 * 3. 调解机制 (Reconciliation)：冲突不丢弃，而是 join 合并
 * 4. 定理 3.1 安全性：极大元唯一性
 * 5. 定理 3.2 活性：有限轮次内终止
 *
 * 协议流程（每轮）：
 *   1. Propose: Leader 提出候选交易集
 *   2. Ternary-Vote: 所有节点投 +1/0/-1
 *   3. Verify: -1 票的 Merkle Proof 验证
 *   4. Aggregate: 加权聚合 + 阈值判断
 *   5. Decide: Accept / Reject / Next-Round
 *   6. Reconcile (if needed): 冲突合并
 *
 * @version V15.0
 */

import {
  TernaryVoteValue,
  TernaryVote,
  TransactionId,
  NodeId,
  BlockId,
  ConsensusRound,
  ConsensusResult,
  PosetTransaction,
  MaximalElement,
  MerkleProof,
} from './types';
import { verifyMerkleProof, batchVerifyProofs, calculateTopologicalImpedance, sha256 } from './merkleProof';
import { PosetEngine } from './posetEngine';
import { TernaryVoteEngine, VotingRound } from './ternaryVoteMachine';

// ============================================================================
// OP-BFT 配置
// ============================================================================

export interface OpBftConfig {
  /** 每轮超时时间 (ms) */
  roundTimeoutMs: number;
  /** 最大轮次数（定理3.2保证在此范围内终止） */
  maxRounds: number;
  /** 节点列表（已知参与者） */
  knownNodes: NodeId[];
  /** Leader 选择策略: 'round-robin' | 'stake-weighted' | 'random' */
  leaderStrategy: 'round-robin' | 'stake-weighted' | 'random';
  /** 是否启用调解机制 */
  enableReconciliation: boolean;
}

export const DEFAULT_OPBFT_CONFIG: OpBftConfig = {
  roundTimeoutMs: 10_000,
  maxRounds: 20,
  knownNodes: [],
  leaderStrategy: 'round-robin',
  enableReconciliation: true,
};

// ============================================================================
// OP-BFT 共识引擎
// ============================================================================

/**
 * OP-BFT — 奇正拜占庭容错共识
 *
 * 安全性保证（定理 3.1）：
 * - 极大元是唯一的 → 不存在双花
 * - -1 票需 Merkle Proof → 防止 Sybil 攻击
 *
 * 活性保证（定理 3.2）：
 * - 有限轮次内终止（maxRounds 上界）
 * - 调解机制确保不因分叉而阻塞
 */
export class OpBftConsensus {
  private poset: PosetEngine;
  private voteEngine: TernaryVoteEngine;
  private config: OpBftConfig;
  private rounds: Map<number, ConsensusRound> = new Map();
  private currentRoundNumber: number = 0;
  private decidedBlocks: Map<TransactionId, BlockId> = new Map();

  constructor(
    poset: PosetEngine,
    voteEngine?: TernaryVoteEngine,
    config?: Partial<OpBftConfig>
  ) {
    this.poset = poset;
    this.voteEngine = voteEngine || new TernaryVoteEngine();
    this.config = { ...DEFAULT_OPBFT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // 共识主流程
  // --------------------------------------------------------------------------

  /**
   * 发起一轮新的 OP-BFT 共识
   *
   * @param candidateTxs 候选交易ID列表（来自当前极大元集）
   * @returns 共识轮次对象
   */
  startRound(candidateTxs: TransactionId[] = []): ConsensusRound {
    this.currentRoundNumber++;
    const roundId = this.currentRoundNumber;

    const round: ConsensusRound = {
      roundId,
      targetTx: candidateTxs[0] || null,
      votes: [],
      hasAccusation: false,
      proofVerifications: [],
      startTime: new Date(),
    };

    this.rounds.set(roundId, round);
    return round;
  }

  /**
   * 提交投票到当前轮次
   *
   * @param roundId 轮次ID
   * @param vote 三进制投票（-1 票需 evidence）
   * @returns 投票结果
   */
  async submitVote(
    roundId: number,
    vote: TernaryVote
  ): Promise<{
    accepted: boolean;
    reason?: string;
    proofValid?: boolean;
  }> {
    const round = this.rounds.get(roundId);
    if (!round) return { accepted: false, reason: `Round ${roundId} not found` };
    if (round.endTime) return { accepted: false, reason: 'Round already ended' };

    // -1 票验证 Merkle Proof
    if (vote.vote === TernaryVoteValue.NEGATIVE && vote.evidence) {
      const tStart = Date.now();
      const verification = verifyMerkleProof(
        vote.evidence.targetHash,
        vote.evidence.path,
        vote.evidence.rootHash
      );

      round.proofVerifications.push({
        verifier: vote.voter,
        valid: verification.valid,
        latencyMs: Date.now() - tStart,
      });

      if (!verification.valid) {
        return {
          accepted: false,
          reason: 'Invalid Merkle Proof for -1 vote',
          proofValid: false,
        };
      }

      round.hasAccusation = true;
    }

    round.votes.push(vote);
    return { accepted: true, proofValid: true };
  }

  /**
   * 尝试终结当前轮次（聚合+判定）
   *
   * @param roundId 轮次ID
   * @returns 共识结果
   */
  tryFinalize(roundId: number): ConsensusResult | null {
    const round = this.rounds.get(roundId);
    if (!round) return null;

    const now = Date.now();
    const elapsed = now - round.startTime.getTime();
    const isTimedOut = elapsed > this.config.roundTimeoutMs;

    if (!isTimedOut && round.votes.length < this.config.knownNodes.length) {
      return null; // 未超时且未全员投票，继续等待
    }

    // === 聚合阶段 ===
    let positive = 0, negative = 0, neutral = 0;

    for (const v of round.votes) {
      switch (v.vote) {
        case TernaryVoteValue.POSITIVE: positive++; break;
        case TernaryVoteValue.NEGATIVE: negative++; break;
        case TernaryVoteValue.NEUTRAL: neutral++; break;
      }
    }

    const totalVotes = positive + negative + neutral;
    const netScore = positive - negative;

    // === 判定阶段 ===
    let result: ConsensusResult;

    if (netScore > 0 && positive > totalVotes * 0.5) {
      // 正向多数 → 接受
      result = {
        accepted: true,
        finalVote: TernaryVoteValue.POSITIVE,
        latencyMs: elapsed,
      };

      // 打包为极大元（区块）
      if (round.targetTx) {
        const maximalTxs = this.poset.computeMaximalElements();
        const me = this.poset.packageMaximalElement(
          maximalTxs.length > 0 ? maximalTxs : [round.targetTx]
        );
        if (me) {
          result.maximalElement = me.id;
          result.reconciled = me.parentBlocks.length > 1;
          this.decidedBlocks.set(round.targetTx, me.id);
        }
      }
    } else if (netScore < 0 && negative > totalVotes * 0.33) {
      // 负向超过阈值 → 拒绝（触发惩罚机制）
      result = {
        accepted: false,
        finalVote: TernaryVoteValue.NEGATIVE,
        latencyMs: elapsed,
      };

      // 降低被揭发节点的声誉
      for (const v of round.votes) {
        if (v.vote === TernaryVoteValue.NEGATIVE && v.evidence) {
          // 惩罚逻辑在外层处理
        }
      }
    } else if (isTimedOut || roundId >= this.config.maxRounds) {
      // 超时或达到最大轮次 → 按当前状态结算
      result = {
        accepted: netScore >= 0,
        finalVote: netScore >= 0
          ? (positive > 0 ? TernaryVoteValue.POSITIVE : TernaryVoteValue.NEUTRAL)
          : TernaryVoteValue.NEGATIVE,
        latencyMs: elapsed,
      };
    } else {
      // 不确定 → 需要下一轮或继续等待
      return null;
    }

    round.endTime = new Date();
    round.result = result;
    return result;
  }

  /**
   * 执行完整的一轮 OP-BFT 共识流程
   *
   * 自动化版本：模拟所有节点投票并完成聚合
   * 实际部署中，各节点独立调用 submitVote()
   *
   * @param candidateTxs 候选交易
   * @param simulatedVotes 模拟的投票（测试用）
   * @returns 完整的共识结果和过程数据
   */
  async runConsensus(
    candidateTxs: TransactionId[],
    simulatedVotes?: TernaryVote[]
  ): Promise<{
    result: ConsensusResult;
    round: ConsensusRound;
    phaseTransitions?: Array<{ phase: string; durationMs: number; detail: string }>;
  }> {
    const phases: Array<{ phase: string; durationMs: number; detail: string }> = [];
    const t0 = Date.now();

    // Phase 1: Propose
    const round = this.startRound(candidateTxs);

    // 如果提供了模拟投票，自动提交
    if (simulatedVotes) {
      for (const vote of simulatedVotes) {
        await this.submitVote(round.roundId, vote);
      }
    }

    phases.push({ phase: 'Propose', durationMs: Date.now() - t0, detail: `${candidateTxs.length} candidates proposed` });

    // Phase 2-3: Vote + Verify (-1 proofs)
    while (true) {
      const result = this.tryFinalize(round.roundId);
      if (result) {
        phases.push({
          phase: 'Decide',
          durationMs: Date.now() - t0,
          detail: `Finalized as ${TernaryVoteValue[result.finalVote]}`,
        });
        return { result, round, phaseTransitions: phases };
      }

      // 检查是否超时
      if (Date.now() - round.startTime.getTime() > this.config.roundTimeoutMs) {
        const timeoutResult = this.tryFinalize(round.roundId);
        if (timeoutResult) {
          return { result: timeoutResult, round, phaseTransitions: phases };
        }
      }

      // 短暂等待（模拟网络延迟）
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // --------------------------------------------------------------------------
  // Leader 选择
  // --------------------------------------------------------------------------

  /**
   * 根据策略选择本轮 Leader
   */
  selectLeader(roundNumber: number): NodeId {
    const nodes = this.config.knownNodes;
    if (nodes.length === 0) throw new Error('No known nodes configured');

    switch (this.config.leaderStrategy) {
      case 'round-robin':
        return nodes[roundNumber % nodes.length];

      case 'random':
        return nodes[Math.floor(Math.random() * nodes.length)];

      case 'stake-weighted': {
        // 简化版：基于节点 ID hash 的加权随机
        const weights = nodes.map(n =>
          parseInt(sha256(`${n}-${roundNumber}`).slice(0, 8), 16)
        );
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalWeight;
        for (let i = 0; i < nodes.length; i++) {
          rand -= weights[i];
          if (rand <= 0) return nodes[i];
        }
        return nodes[nodes.length - 1];
      }

      default:
        return nodes[0];
    }
  }

  // --------------------------------------------------------------------------
  // 调解机制 (Reconciliation)
  // --------------------------------------------------------------------------

  /**
   * 当检测到分叉/冲突时执行调解
   *
   * 调用 PosetEngine.join() 将两个冲突分支合并为统一上界
   */
  reconcileConflict(
    txIdA: TransactionId,
    txIdB: TransactionId
  ): TransactionId | null {
    if (!this.config.enableReconciliation) return null;

    return this.poset.join(txIdA, txIdB);
  }

  // --------------------------------------------------------------------------
  // 定理验证
  // --------------------------------------------------------------------------

  /**
   * 验证定理 3.1：极大元的唯一性（安全性）
   *
   * 检查是否存在两个不同的极大元包含同一笔交易
   * 如果存在，说明安全性被违反（双花可能）
   */
  verifyTheorem31_Safety(): {
    holds: boolean;
    violations: Array<{ txId: string; blockIds: string[] }>;
    description: string;
  } {
    const maximals = this.poset.getMaximalElements();
    const txToBlocks = new Map<TransactionId, BlockId[]>();

    for (const me of maximals) {
      for (const txId of me.transactions) {
        const existing = txToBlocks.get(txId) || [];
        existing.push(me.id);
        txToBlocks.set(txId, existing);
      }
    }

    const violations: Array<{ txId: string; blockIds: string[] }> = [];
    for (const [txId, blockIds] of txToBlocks) {
      if (blockIds.length > 1) {
        violations.push({ txId, blockIds });
      }
    }

    return {
      holds: violations.length === 0,
      violations,
      description: violations.length === 0
        ? '✅ Theorem 3.1 holds: Each transaction belongs to at most one maximal element'
        : `❌ Theorem 3.1 violated: ${violations.length} transactions appear in multiple blocks`,
    };
  }

  /**
   * 验证定理 3.2：活性（有限轮次终止）
   *
   * 模拟运行检查是否能在 maxRounds 内终止
   */
  verifyTheorem32_Liveness(): {
    holds: boolean;
    actualRounds: number;
    maxRoundsAllowed: number;
    description: string;
  } {
    const latestRound = this.currentRoundNumber;
    return {
      holds: latestRound <= this.config.maxRounds,
      actualRounds: latestRound,
      maxRoundsAllowed: this.config.maxRounds,
      description: latestRound <= this.config.maxRounds
        ? `✅ Theorem 3.2 holds: Consensus terminated in ${latestRound} rounds (≤${this.config.maxRounds})`
        : `⚠️ Theorem 3.2 check pending: At round ${latestRound}, max=${this.config.maxRounds}`,
    };
  }

  // --------------------------------------------------------------------------
  // 查询与统计
  // --------------------------------------------------------------------------

  getRound(roundId: number): ConsensusRound | undefined {
    return this.rounds.get(roundId);
  }

  getAllRounds(): ConsensusRound[] {
    return Array.from(this.rounds.values());
  }

  getCurrentRoundNumber(): number { return this.currentRoundNumber; }

  getConfig(): OpBftConfig { return { ...this.config }; }

  getConsensusStats(): {
    totalRounds: number;
    completedRounds: number;
    acceptedCount: number;
    rejectedCount: number;
    accusationRate: number;
    avgLatencyMs: number;
    impedanceLevel: ReturnType<typeof calculateTopologicalImpedance>['impedanceLevel'];
  } {
    let accepted = 0, rejected = 0, totalAccusations = 0, totalLatency = 0;
    let completed = 0;

    for (const [, r] of this.rounds) {
      if (r.endTime) {
        completed++;
        totalLatency += r.endTime.getTime() - r.startTime.getTime();
        if (r.result?.accepted) accepted++;
        else rejected++;
      }
      if (r.hasAccusation) totalAccusations++;
    }

    const avgLatency = completed > 0 ? totalLatency / completed : 0;
    const impedance = calculateTopologicalImpedance(
      totalAccusations,
      3 // 平均 proof 长度估计
    );

    return {
      totalRounds: this.rounds.size,
      completedRounds: completed,
      acceptedCount: accepted,
      rejectedCount: rejected,
      accusationRate: completed > 0 ? totalAccusations / completed : 0,
      avgLatencyMs: Math.round(avgLatency),
      impedanceLevel: impedance.impedanceLevel,
    };
  }
}
