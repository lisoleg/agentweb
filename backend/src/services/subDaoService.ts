/**
 * SubDAO Service - 子DAO本地化治理服务
 *
 * 基于地理区域的子DAO治理，支持本地化法规合规。
 * 核心设计：
 * - 区域绑定：子DAO与地理区域1:1映射
 * - 法规合规引擎：不同区域不同合规参数
 * - 跨区提案路由：自动转发到相关子DAO
 * - 与phiBftConsensus集成：Φ值加权投票
 */

import * as crypto from 'crypto';

// =============== Types ===============

export interface JurisdictionRule {
  minVotingPeriod: number;     // 最短投票期（秒）
  maxVotingPeriod: number;     // 最长投票期（秒）
  quorumRatio: number;         // 法定人数比率 (0-1)
  approvalThreshold: number;   // 通过阈值 (0-1)
  requireKYC: boolean;
  maxStakeInfluence: number;   // 最大质押影响力 (0-1)
}

export interface SubDAOInfo {
  subDaoId: string;
  countryCode: string;        // ISO 3166-1 alpha-2
  regionCode: string;
  name: string;
  memberCount: number;
  createdAt: number;
  active: boolean;
  jurisdictionRule: JurisdictionRule;
}

export interface SubDAOProposal {
  proposalId: string;
  subDaoId: string;
  proposer: string;
  description: string;
  deadline: number;
  forVotes: number;
  againstVotes: number;
  totalVotingPower: number;
  state: ProposalState;
  isCrossRegion: boolean;
  targetRegions?: string[];
}

export enum ProposalState {
  Pending = 'Pending',
  Active = 'Active',
  Passed = 'Passed',
  Failed = 'Failed',
  Executed = 'Executed',
  Cancelled = 'Cancelled',
}

// =============== 预置法规模板 ===============

const JURISDICTION_TEMPLATES: Record<string, Partial<JurisdictionRule>> = {
  // 中国：严格KYC，较长投票期
  CN: {
    minVotingPeriod: 3 * 86400,    // 3天
    maxVotingPeriod: 14 * 86400,   // 14天
    quorumRatio: 0.3,
    approvalThreshold: 0.6,
    requireKYC: true,
    maxStakeInfluence: 0.3,      // 限制大户影响力
  },
  // 美国：SEC合规，中等投票期
  US: {
    minVotingPeriod: 2 * 86400,    // 2天
    maxVotingPeriod: 10 * 86400,   // 10天
    quorumRatio: 0.2,
    approvalThreshold: 0.5,
    requireKYC: true,
    maxStakeInfluence: 0.5,
  },
  // 欧盟：GDPR合规，注重隐私
  EU: {
    minVotingPeriod: 2 * 86400,
    maxVotingPeriod: 12 * 86400,
    quorumRatio: 0.25,
    approvalThreshold: 0.55,
    requireKYC: false,
    maxStakeInfluence: 0.4,
  },
  // 新加坡：灵活监管
  SG: {
    minVotingPeriod: 1 * 86400,
    maxVotingPeriod: 7 * 86400,
    quorumRatio: 0.15,
    approvalThreshold: 0.5,
    requireKYC: true,
    maxStakeInfluence: 0.6,
  },
  // 瑞士：去中心化友好
  CH: {
    minVotingPeriod: 1 * 86400,
    maxVotingPeriod: 7 * 86400,
    quorumRatio: 0.1,
    approvalThreshold: 0.5,
    requireKYC: false,
    maxStakeInfluence: 1.0,      // 不限制
  },
};

// =============== SubDAO Service ===============

class SubDAOServiceClass {
  private subDaos: Map<string, SubDAOInfo> = new Map();
  private proposals: Map<string, SubDAOProposal> = new Map();
  private members: Map<string, Set<string>> = new Map(); // subDaoId => Set<userId>
  private regionIndex: Map<string, string> = new Map();  // "CC:RR" => subDaoId

  /**
   * 创建子DAO
   */
  createSubDAO(params: {
    countryCode: string;
    regionCode: string;
    name: string;
    customRule?: Partial<JurisdictionRule>;
  }): SubDAOInfo {
    const { countryCode, regionCode, name, customRule } = params;

    const regionKey = `${countryCode}:${regionCode}`;
    if (this.regionIndex.has(regionKey)) {
      throw new Error(`Region ${regionKey} already has a SubDAO`);
    }

    // 应用法规模板 + 自定义覆盖
    const template = JURISDICTION_TEMPLATES[countryCode] || JURISDICTION_TEMPLATES['CH']; // 默认瑞士
    const defaultRule: JurisdictionRule = {
      minVotingPeriod: template.minVotingPeriod || 86400,
      maxVotingPeriod: template.maxVotingPeriod || 7 * 86400,
      quorumRatio: template.quorumRatio || 0.2,
      approvalThreshold: template.approvalThreshold || 0.5,
      requireKYC: template.requireKYC || false,
      maxStakeInfluence: template.maxStakeInfluence || 1.0,
    };

    const jurisdictionRule: JurisdictionRule = customRule
      ? { ...defaultRule, ...customRule }
      : defaultRule;

    const subDaoId = `subdao_${countryCode}_${regionCode}_${Date.now()}`;

    const subDao: SubDAOInfo = {
      subDaoId,
      countryCode,
      regionCode,
      name,
      memberCount: 0,
      createdAt: Date.now(),
      active: true,
      jurisdictionRule,
    };

    this.subDaos.set(subDaoId, subDao);
    this.regionIndex.set(regionKey, subDaoId);
    this.members.set(subDaoId, new Set());

    console.log(`✅ [SubDAO] Created: ${subDaoId} (${countryCode}-${regionCode})`);
    console.log(`   Jurisdiction: KYC=${jurisdictionRule.requireKYC}, Quorum=${jurisdictionRule.quorumRatio}, Threshold=${jurisdictionRule.approvalThreshold}`);

    return subDao;
  }

  /**
   * 加入子DAO
   */
  joinSubDAO(subDaoId: string, userId: string): boolean {
    const subDao = this.subDaos.get(subDaoId);
    if (!subDao || !subDao.active) throw new Error('SubDAO not active');

    const memberSet = this.members.get(subDaoId)!;
    if (memberSet.has(userId)) throw new Error('Already a member');

    // 法规合规检查
    this._checkJurisdictionCompliance(subDao, userId);

    memberSet.add(userId);
    subDao.memberCount++;

    console.log(`👤 [SubDAO] ${userId} joined ${subDaoId}`);
    return true;
  }

  /**
   * 退出子DAO
   */
  leaveSubDAO(subDaoId: string, userId: string): boolean {
    const memberSet = this.members.get(subDaoId);
    if (!memberSet || !memberSet.has(userId)) throw new Error('Not a member');

    memberSet.delete(userId);
    const subDao = this.subDaos.get(subDaoId)!;
    subDao.memberCount--;

    console.log(`👋 [SubDAO] ${userId} left ${subDaoId}`);
    return true;
  }

  /**
   * 创建子DAO内提案
   */
  createProposal(params: {
    subDaoId: string;
    proposer: string;
    description: string;
    votingPeriodDays: number;
  }): SubDAOProposal {
    const { subDaoId, proposer, description, votingPeriodDays } = params;
    const subDao = this.subDaos.get(subDaoId);
    if (!subDao || !subDao.active) throw new Error('SubDAO not active');

    const memberSet = this.members.get(subDaoId);
    if (!memberSet?.has(proposer)) throw new Error('Not a member of this SubDAO');

    // 法规合规检查
    const votingPeriodSeconds = votingPeriodDays * 86400;
    this._checkVotingPeriodCompliance(subDao, votingPeriodSeconds);

    const proposalId = `proposal_${subDaoId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const proposal: SubDAOProposal = {
      proposalId,
      subDaoId,
      proposer,
      description,
      deadline: Date.now() + votingPeriodSeconds * 1000,
      forVotes: 0,
      againstVotes: 0,
      totalVotingPower: 0,
      state: ProposalState.Active,
      isCrossRegion: false,
    };

    this.proposals.set(proposalId, proposal);

    console.log(`📋 [SubDAO] Proposal created: ${proposalId} in ${subDaoId}`);
    return proposal;
  }

  /**
   * 创建跨区提案
   */
  createCrossRegionProposal(params: {
    sourceSubDaoId: string;
    proposer: string;
    description: string;
    targetRegions: string[]; // "CC:RR" 格式
    votingPeriodDays: number;
  }): SubDAOProposal {
    const { sourceSubDaoId, proposer, description, targetRegions, votingPeriodDays } = params;
    const subDao = this.subDaos.get(sourceSubDaoId);
    if (!subDao || !subDao.active) throw new Error('Source SubDAO not active');

    const memberSet = this.members.get(sourceSubDaoId);
    if (!memberSet?.has(proposer)) throw new Error('Not a member of source SubDAO');

    // 验证目标区域存在且激活
    for (const region of targetRegions) {
      const targetSubDaoId = this.regionIndex.get(region);
      if (!targetSubDaoId) throw new Error(`Target region ${region} has no SubDAO`);
      const targetSubDao = this.subDaos.get(targetSubDaoId)!;
      if (!targetSubDao.active) throw new Error(`Target SubDAO for ${region} is not active`);
    }

    const votingPeriodSeconds = votingPeriodDays * 86400;
    this._checkVotingPeriodCompliance(subDao, votingPeriodSeconds);

    const proposalId = `crossprop_${sourceSubDaoId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const proposal: SubDAOProposal = {
      proposalId,
      subDaoId: sourceSubDaoId,
      proposer,
      description,
      deadline: Date.now() + votingPeriodSeconds * 1000,
      forVotes: 0,
      againstVotes: 0,
      totalVotingPower: 0,
      state: ProposalState.Active,
      isCrossRegion: true,
      targetRegions,
    };

    this.proposals.set(proposalId, proposal);

    // 路由到目标子DAO
    for (const region of targetRegions) {
      const targetSubDaoId = this.regionIndex.get(region)!;
      console.log(`🔄 [SubDAO] Cross-region proposal routed: ${proposalId} → ${targetSubDaoId}`);
    }

    console.log(`📋 [SubDAO] Cross-region proposal created: ${proposalId}`);
    return proposal;
  }

  /**
   * 投票（Φ值加权）
   */
  castVote(params: {
    proposalId: string;
    voter: string;
    support: boolean;
    phiWeight: number;
  }): boolean {
    const { proposalId, voter, support, phiWeight } = params;
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.state !== ProposalState.Active) throw new Error('Proposal not active');
    if (Date.now() > proposal.deadline) throw new Error('Voting deadline passed');

    // 检查成员身份
    const memberSet = this.members.get(proposal.subDaoId);
    if (!memberSet?.has(voter)) throw new Error('Not a member of this SubDAO');

    // 应用法规约束
    const subDao = this.subDaos.get(proposal.subDaoId)!;
    let effectiveWeight = phiWeight;
    if (subDao.jurisdictionRule.maxStakeInfluence < 1.0) {
      const maxWeight = proposal.totalVotingPower * subDao.jurisdictionRule.maxStakeInfluence;
      effectiveWeight = Math.min(phiWeight, maxWeight);
    }

    if (support) {
      proposal.forVotes += effectiveWeight;
    } else {
      proposal.againstVotes += effectiveWeight;
    }
    proposal.totalVotingPower += effectiveWeight;

    console.log(`🗳️ [SubDAO] Vote cast: ${voter} → ${support ? 'FOR' : 'AGAINST'} (Φ weight: ${effectiveWeight.toFixed(4)})`);

    // 检查是否可以提前结算
    this._checkEarlySettlement(proposal);

    return true;
  }

  /**
   * 法规合规检查
   */
  checkJurisdictionCompliance(subDaoId: string, userId: string): { compliant: boolean; reason: string } {
    const subDao = this.subDaos.get(subDaoId);
    if (!subDao) return { compliant: false, reason: 'SubDAO not found' };

    return this._checkJurisdictionComplianceInternal(subDao, userId);
  }

  // =============== Private Methods ===============

  private _checkJurisdictionCompliance(subDao: SubDAOInfo, userId: string): void {
    const result = this._checkJurisdictionComplianceInternal(subDao, userId);
    if (!result.compliant) {
      throw new Error(`Jurisdiction compliance failed: ${result.reason}`);
    }
  }

  private _checkJurisdictionComplianceInternal(subDao: SubDAOInfo, userId: string): { compliant: boolean; reason: string } {
    if (subDao.jurisdictionRule.requireKYC) {
      // KYC检查占位：集成DID/VC验证
      // 实际实现中查询VCService验证KYC凭证
      console.log(`🔍 [SubDAO] KYC check for ${userId} in ${subDao.countryCode} (placeholder: pass)`);
    }
    return { compliant: true, reason: 'Compliant' };
  }

  private _checkVotingPeriodCompliance(subDao: SubDAOInfo, votingPeriodSeconds: number): void {
    const rule = subDao.jurisdictionRule;
    if (votingPeriodSeconds < rule.minVotingPeriod) {
      throw new Error(`Voting period ${votingPeriodSeconds}s below minimum ${rule.minVotingPeriod}s`);
    }
    if (votingPeriodSeconds > rule.maxVotingPeriod) {
      throw new Error(`Voting period ${votingPeriodSeconds}s exceeds maximum ${rule.maxVotingPeriod}s`);
    }
  }

  private _checkEarlySettlement(proposal: SubDAOProposal): void {
    const subDao = this.subDaos.get(proposal.subDaoId)!;
    const rule = subDao.jurisdictionRule;

    const totalVotes = proposal.forVotes + proposal.againstVotes;
    const quorumReached = totalVotes >= proposal.totalVotingPower * rule.quorumRatio;
    const approvalReached = proposal.forVotes >= totalVotes * rule.approvalThreshold;

    if (quorumReached && approvalReached) {
      proposal.state = ProposalState.Passed;
      console.log(`✅ [SubDAO] Early settlement: ${proposal.proposalId} PASSED`);
    }
  }

  // =============== Query Methods ===============

  getSubDAO(subDaoId: string): SubDAOInfo | undefined {
    return this.subDaos.get(subDaoId);
  }

  getSubDAOByRegion(countryCode: string, regionCode: string): SubDAOInfo | undefined {
    const key = `${countryCode}:${regionCode}`;
    const subDaoId = this.regionIndex.get(key);
    return subDaoId ? this.subDaos.get(subDaoId) : undefined;
  }

  listSubDAOs(): SubDAOInfo[] {
    return Array.from(this.subDaos.values());
  }

  getProposal(proposalId: string): SubDAOProposal | undefined {
    return this.proposals.get(proposalId);
  }

  isMember(subDaoId: string, userId: string): boolean {
    return this.members.get(subDaoId)?.has(userId) || false;
  }

  getJurisdictionTemplates(): Record<string, Partial<JurisdictionRule>> {
    return JURISDICTION_TEMPLATES;
  }
}

export const subDaoService = new SubDAOServiceClass();
