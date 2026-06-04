/**
 * OPLC (奇正格链 - Odd-Positive Lattice Chain) 核心类型定义
 *
 * 基于微信文章《奇正格链:基于三进制逻辑与偏序格的下一代分布式共识架构》
 * TOSAS (太一结构公理系统) 技术映射
 *
 * @version V15.0
 * @author TaiyiAGI Team
 * @license MIT
 */

// ============================================================================
// 三进制逻辑 (Ternary Logic)
// ============================================================================

/** 三进制投票状态：+1(验证通过), 0(中立/待定), -1(揭发+证据) */
export enum TernaryVoteValue {
  POSITIVE = +1,    // 正向：验证通过，确认交易
  NEUTRAL = 0,      // 中立：未就绪或待定
  NEGATIVE = -1,    // 负向（奇/揭发）：提交 Merkle Proof 证据证明作恶
}

/** 三进制状态的字符串表示 */
export const TernaryLabels: Record<TernaryVoteValue, string> = {
  [TernaryVoteValue.POSITIVE]: 'Positive (+1)',
  [TernaryVoteValue.NEUTRAL]: 'Neutral (0)',
  [TernaryVoteValue.NEGATIVE]: 'Odd (-1)',
};

// ============================================================================
// 偏序格 (Partial Order Lattice / Poset)
// ============================================================================

/** 交易唯一标识 */
export type TransactionId = string;

/** 区块/极大元标识 */
export type BlockId = string;

/** 节点标识 */
export type NodeId = string;

/**
 * 交易 — 偏序格中的基本元素
 * 每笔交易携带因果关系（父交易列表）和三进制投票状态
 */
export interface PosetTransaction {
  id: TransactionId;
  /** 父交易列表 — 定义因果依赖关系（偏序关系 ≤ 的基础） */
  parents: TransactionId[];
  /** 创建者节点 */
  creator: NodeId;
  /** 时间戳 (Lamport clock) */
  lamportTimestamp: number;
  /** payload 数据 */
  data: Record<string, unknown>;
  /** 当前聚合投票结果 */
  aggregatedVote: TernaryVoteValue;
  /** 各节点投票记录 */
  votes: Map<NodeId, TernaryVote>;
  /** 是否已被合并到某个区块中 */
  finalized: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** Merkle Proof（仅 NEGATIVE 票需要） */
  merkleProof?: MerkleProof;
}

/**
 * 单个节点的三进制投票
 * 当 vote === NEGATIVE 时必须附带 evidence
 */
export interface TernaryVote {
  voter: NodeId;
  vote: TernaryVoteValue;
  /** 仅 NEGATIVE 票需要 — Merkle Proof 形式的作恶证据 */
  evidence?: MerkleProof;
  timestamp: Date;
}

/**
 * Merkle Proof 证据结构
 * 用于 -1 (揭发) 票的可验证证据
 */
export interface MerkleProof {
  /** 目标交易的哈希 */
  targetHash: string;
  /** Merkle 路径（从叶到根） */
  path: {
    hash: string;
    /** true = 右兄弟, false = 左兄弟 */
    isRight: boolean;
  }[];
  /** Merkle 根哈希 */
  rootHash: string;
  /** 被揭发的恶意行为描述 */
  allegation: string;
}

/**
 * 极大元 (Maximal Element) — 格的"区块"
 * 一个极大元是不可再扩展的交易集合上界
 * 对应传统区块链中的"区块"
 */
export interface MaximalElement {
  id: BlockId;
  /** 组成此极大元的交易 ID 集合 */
  transactions: TransactionId[];
  /** 并运算生成此极大元时涉及的父极大元（如有冲突合并） */
  parentBlocks: BlockId[];
  /** 此极大元的并运算结果哈希 */
  joinHash: string;
  /** 创建时间 */
  createdAt: Date;
  /** 是否为最终确定的极大元（定理3.1保证的唯一性） */
  confirmed: boolean;
  /** Lamport 时间戳 */
  lamportTimestamp: number;
}

/**
 * 调解交易 (Reconciliation Transaction)
 * 冲突时通过并运算 ∨ 生成的上界交易
 * 不丢弃任何一方，而是将两者合并为新状态
 */
export interface ReconciliationTransaction extends PosetTransaction {
  reconciliationOf: [TransactionId, TransactionId];
  resolvedBy: NodeId;
}

// ============================================================================
// OP-BFT 共识相关
// ============================================================================

/** OP-BFT 共识轮次 */
export interface ConsensusRound {
  roundId: number;
  targetTx: TransactionId | null;        // null = 空轮（只做心跳）
  votes: TernaryVote[];
  /** 本轮是否触发 -1 揭发机制 */
  hasAccusation: boolean;
  /** Merkle Proof 验证结果 */
  proofVerifications: Array<{
    verifier: NodeId;
    valid: boolean;
    latencyMs: number;
  }>;
  startTime: Date;
  endTime?: Date;
  result?: ConsensusResult;
}

/** 共识结果 */
export interface ConsensusResult {
  accepted: boolean;           // 是否被接受
  finalVote: TernaryVoteValue; // 最终投票值
  maximalElement?: BlockId;   // 关联的极大元
  reconciled?: boolean;        // 是否经过调解
  latencyMs: number;
}

// ============================================================================
// 节点状态
// ============================================================================

/** 节点在OPLC网络中的角色与状态 */
export interface OPLCNodeState {
  nodeId: NodeId;
  /** 节点当前持有的本地账本（极大元集） */
  localMaximalElements: MaximalElement[];
  /** 节点已知的所有交易 */
  knownTransactions: Map<TransactionId, PosetTransaction>;
  /** 当前 Lamport 时钟值 */
  lamportClock: number;
  /** 节点声誉分数 (0~1, 被-1票击中会降低) */
  reputation: number;
  /** 节点是否被标记为可疑 */
  flagged: boolean;
  /** 最后活跃时间 */
  lastActive: Date;
  /** 参与过的共识轮次统计 */
  stats: {
    totalRounds: number;
    positiveVotes: number;
    negativeVotes: number;
    accusationsMade: number;
    accusationsReceived: number;
    successfulAccusations: number;
  };
}

// ============================================================================
// 流贯动力学 (Φ-Dynamics) 映射
// ============================================================================

/** 流贯 Φ 在信息势场中的度量 */
export interface PhiMetric {
  /** 关系作用量 S — 越小系统越稳定 */
  relationActionS: number;
  /** 相位耦合程度 — 模块间互操作强度 */
  phaseCoupling: number;
  /** 拓扑阻抗 — Merkle Proof 验证带来的延迟开销 */
  topologicalImpedance: number;
  /** 系统熵 */
  entropy: number;
}

/** 拓扑相变事件 */
export interface TopologicalPhaseTransition {
  fromState: string;
  toState: string;
  triggerTx: TransactionId;
  phiBefore: PhiMetric;
  phiAfter: PhiMetric;
  timestamp: Date;
}
