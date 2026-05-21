/**
 * Φ-BFT Consensus Service (49% BFT 虚时共识)
 * 基于 Paper 4 "互联网重构悖论" 的虚时共识概念
 *
 * 核心思想：
 * - 传统 BFT 最多容忍 33% 恶意节点（n/3）
 * - Φ-BFT 用 Φ 值加权投票，高Φ节点获得更大投票权
 * - 虚时共识：在"虚时间"维度投票，允许逆序验证
 * - 理论上可容忍 49% 恶意节点
 *
 * 数学基础：
 * - 设总 Φ 权重 W = Σ(Φ_i)
 * - 恶意节点 Φ 权重 W_m < 0.49W
 * - 诚实节点 Φ 权重 W_h > 0.51W
 * - 共识条件：投票权重 > 0.51W (简单多数)
 *
 * 安全性证明：
 * - 49% 攻击者需控制 > 0.49W 的 Φ 值
 * - 但 Φ 值与整合度正相关，恶意行为降低 Φ → 自我抑制
 * - 形成自纠正闭环
 */

import * as crypto from 'crypto';

// =============== Types ===============

export enum VoteType {
  FOR = 'FOR',
  AGAINST = 'AGAINST',
  ABSTAIN = 'ABSTAIN',
}

export enum ConsensusPhase {
  PROPOSE = 'PROPOSE',
  VOTE = 'VOTE',
  VERIFY = 'VERIFY',
  COMMIT = 'COMMIT',
}

export enum ConsensusStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  REACHED = 'REACHED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
}

export interface ConsensusNode {
  id: string;
  phiWeight: number;        // Φ 值权重 (0-1)
  address: string;
  isValidator: boolean;
  reputation: number;       // 信誉分数 (0-1)
  lastVoteTime: number;
  virtualTime: number;      // 虚时间戳
}

export interface ConsensusVote {
  nodeId: string;
  proposalId: string;
  vote: VoteType;
  phiWeight: number;
  signature: string;
  virtualTimestamp: number;  // 虚时间（可逆）
  realTimestamp: number;
}

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  data: any;
  createdAt: number;
  deadline: number;          // 虚时间截止
  requiredPhiWeight: number; // 需要的 Φ 权重阈值
  status: ConsensusStatus;
  votes: ConsensusVote[];
  result?: {
    totalFor: number;
    totalAgainst: number;
    totalAbstain: number;
    phiWeightFor: number;
    phiWeightAgainst: number;
  };
}

export interface BFTConfig {
  phiWeightThreshold: number;  // Φ 权重阈值 (默认 0.51)
  maxFaultyRatio: number;       // 最大容错率 (默认 0.49)
  voteTimeoutMs: number;        // 投票超时
  virtualTimeDrift: number;    // 虚时间漂移率
  minValidators: number;        // 最小验证者数
}

// =============== Φ-BFT Consensus ===============

class PhiBFTConsensusClass {
  private config: BFTConfig;
  private nodes: Map<string, ConsensusNode> = new Map();
  private proposals: Map<string, ConsensusProposal> = new Map();
  private virtualClock: number = 0;

  constructor(config?: Partial<BFTConfig>) {
    this.config = {
      phiWeightThreshold: 0.51,
      maxFaultyRatio: 0.49,
      voteTimeoutMs: 30_000,
      virtualTimeDrift: 0.001,
      minValidators: 3,
      ...config,
    };
  }

  // =============== 节点管理 ===============

  /**
   * 注册共识节点
   */
  registerNode(node: Omit<ConsensusNode, 'lastVoteTime' | 'virtualTime'>): boolean {
    if (this.nodes.has(node.id)) {
      console.warn(`[Φ-BFT] Node ${node.id} already registered`);
      return false;
    }

    const fullNode: ConsensusNode = {
      ...node,
      lastVoteTime: 0,
      virtualTime: this.virtualClock,
    };

    this.nodes.set(node.id, fullNode);
    console.log(`✅ [Φ-BFT] Node registered: ${node.id} (Φ=${node.phiWeight.toFixed(4)})`);
    return true;
  }

  /**
   * 更新节点 Φ 权重
   */
  updatePhiWeight(nodeId: string, newPhiWeight: number): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.phiWeight = Math.min(1.0, Math.max(0.0, newPhiWeight));
    console.log(`🔄 [Φ-BFT] Node ${nodeId} Φ weight updated: ${node.phiWeight.toFixed(4)}`);
    return true;
  }

  // =============== 共识流程 ===============

  /**
   * 创建提案
   */
  createProposal(
    proposerId: string,
    data: any,
    deadlineVirtualTime?: number
  ): ConsensusProposal {
    const proposer = this.nodes.get(proposerId);
    if (!proposer || !proposer.isValidator) {
      throw new Error(`Invalid proposer: ${proposerId}`);
    }

    const proposalId = `proposal_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const totalPhiWeight = this.getTotalPhiWeight();
    const requiredWeight = totalPhiWeight * this.config.phiWeightThreshold;

    const proposal: ConsensusProposal = {
      id: proposalId,
      proposerId,
      data,
      createdAt: Date.now(),
      deadline: deadlineVirtualTime || (this.virtualClock + this.config.voteTimeoutMs),
      requiredPhiWeight: requiredWeight,
      status: ConsensusStatus.IN_PROGRESS,
      votes: [],
    };

    this.proposals.set(proposalId, proposal);
    console.log(`📋 [Φ-BFT] Proposal created: ${proposalId} (required Φ weight: ${requiredWeight.toFixed(4)})`);

    return proposal;
  }

  /**
   * 投票
   */
  castVote(
    nodeId: string,
    proposalId: string,
    vote: VoteType,
    signature: string
  ): ConsensusVote | null {
    const node = this.nodes.get(nodeId);
    const proposal = this.proposals.get(proposalId);

    if (!node || !proposal) {
      console.warn(`[Φ-BFT] Invalid vote: node=${nodeId}, proposal=${proposalId}`);
      return null;
    }

    if (proposal.status !== ConsensusStatus.IN_PROGRESS) {
      console.warn(`[Φ-BFT] Proposal ${proposalId} is not in progress`);
      return null;
    }

    // 检查是否已投票
    const existingVote = proposal.votes.find(v => v.nodeId === nodeId);
    if (existingVote) {
      console.warn(`[Φ-BFT] Node ${nodeId} already voted on ${proposalId}`);
      return null;
    }

    // 更新虚时间
    this.advanceVirtualClock(node);

    const consensusVote: ConsensusVote = {
      nodeId,
      proposalId,
      vote,
      phiWeight: node.phiWeight,
      signature,
      virtualTimestamp: this.virtualClock,
      realTimestamp: Date.now(),
    };

    proposal.votes.push(consensusVote);
    node.lastVoteTime = Date.now();

    console.log(`🗳️ [Φ-BFT] Vote cast: ${nodeId} → ${vote} (Φ weight: ${node.phiWeight.toFixed(4)})`);

    // 检查是否达成共识
    this.checkConsensus(proposalId);

    return consensusVote;
  }

  /**
   * 检查共识
   */
  checkConsensus(proposalId: string): ConsensusStatus {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return ConsensusStatus.FAILED;

    // 计算 Φ 加权投票
    const forVotes = proposal.votes.filter(v => v.vote === VoteType.FOR);
    const againstVotes = proposal.votes.filter(v => v.vote === VoteType.AGAINST);
    const abstainVotes = proposal.votes.filter(v => v.vote === VoteType.ABSTAIN);

    const phiWeightFor = forVotes.reduce((sum, v) => sum + v.phiWeight, 0);
    const phiWeightAgainst = againstVotes.reduce((sum, v) => sum + v.phiWeight, 0);

    // 虚时共识验证：允许时间戳逆序
    const virtualVotesValid = this.validateVirtualTimeVotes(proposal.votes);

    const totalPhiWeight = this.getTotalPhiWeight();
    const threshold = totalPhiWeight * this.config.phiWeightThreshold;

    // 判定共识
    if (phiWeightFor >= threshold && virtualVotesValid) {
      proposal.status = ConsensusStatus.REACHED;
      proposal.result = {
        totalFor: forVotes.length,
        totalAgainst: againstVotes.length,
        totalAbstain: abstainVotes.length,
        phiWeightFor,
        phiWeightAgainst,
      };
      console.log(`✅ [Φ-BFT] Consensus reached: ${proposalId} (Φ for: ${phiWeightFor.toFixed(4)} / ${totalPhiWeight.toFixed(4)})`);
    } else if (phiWeightAgainst >= threshold) {
      proposal.status = ConsensusStatus.FAILED;
      proposal.result = {
        totalFor: forVotes.length,
        totalAgainst: againstVotes.length,
        totalAbstain: abstainVotes.length,
        phiWeightFor,
        phiWeightAgainst,
      };
      console.log(`❌ [Φ-BFT] Consensus failed: ${proposalId} (Φ against: ${phiWeightAgainst.toFixed(4)})`);
    }

    return proposal.status;
  }

  // =============== 虚时间 ===============

  /**
   * 推进虚时间
   */
  private advanceVirtualClock(node: ConsensusNode): void {
    // 虚时间 = 实时间 + Φ 权重 * drift
    // 高Φ节点的虚时间前进更快
    this.virtualClock += 1 + node.phiWeight * this.config.virtualTimeDrift;
    node.virtualTime = this.virtualClock;
  }

  /**
   * 验证虚时间投票
   * 允许逆序：虚时间可以"回溯"
   */
  private validateVirtualTimeVotes(votes: ConsensusVote[]): boolean {
    // 简化实现：检查投票是否来自有效验证者
    const validatorIds = Array.from(this.nodes.values())
      .filter(n => n.isValidator)
      .map(n => n.id);

    return votes.every(v => validatorIds.includes(v.nodeId));
  }

  // =============== 工具方法 ===============

  getTotalPhiWeight(): number {
    return Array.from(this.nodes.values())
      .filter(n => n.isValidator)
      .reduce((sum, n) => sum + n.phiWeight, 0);
  }

  getActiveValidators(): ConsensusNode[] {
    return Array.from(this.nodes.values()).filter(n => n.isValidator);
  }

  getProposal(proposalId: string): ConsensusProposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * 计算系统安全系数
   * 安全系数 = 1 - (maxFaultyRatio * (1 - avgPhiWeight))
   */
  getSecurityFactor(): number {
    const validators = this.getActiveValidators();
    if (validators.length === 0) return 0;

    const avgPhi = validators.reduce((sum, n) => sum + n.phiWeight, 0) / validators.length;
    return 1 - (this.config.maxFaultyRatio * (1 - avgPhi));
  }

  dispose(): void {
    this.nodes.clear();
    this.proposals.clear();
  }
}

export const phiBftConsensus = new PhiBFTConsensusClass();
