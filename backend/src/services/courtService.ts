/**
 * Court Service - V11.0 宪法法院服务层
 *
 * 管理宪法审查案件的提交、投票和判决。
 * 当前为模拟模式，生产环境需连接真实链上ConstitutionCourt合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type CaseState = 'PENDING' | 'VOTING' | 'RESOLVED' | 'DISMISSED';
export type JudgmentType = 'NONE' | 'UPHOLD' | 'OVERTURN' | 'REMAND';

export interface ConstitutionCase {
  caseId: number;
  amendmentId: number;
  filer: string;
  reason: string;
  evidenceHash: string;
  state: CaseState;
  isEmergency: boolean;
  emergencyApproved: boolean;
  votingStart: number;
  votingEnd: number;
  yesVotes: number;
  noVotes: number;
  totalVoters: number;
  judgment: JudgmentType;
  votes: CaseVote[];
}

export interface CaseVote {
  voter: string;
  support: boolean;
  votingPower: number;
  timestamp: number;
}

// =============== Service Class ===============

class CourtServiceClass {
  private cases: Map<number, ConstitutionCase>;
  private nextCaseId: number;
  private judgmentThreshold: number;
  private standardVotingPeriod: number;
  private emergencyVotingPeriod: number;

  constructor() {
    this.cases = new Map();
    this.nextCaseId = 1;
    this.judgmentThreshold = 6700;  // 67%
    this.standardVotingPeriod = 14 * 24 * 3600 * 1000;  // 14 days in ms
    this.emergencyVotingPeriod = 3 * 24 * 3600 * 1000;  // 3 days in ms
    logger.info('[CourtService] Initialized V11.0 Constitution Court Service');
  }

  /**
   * 提交普通宪法审查案件
   */
  submitCase(filer: string, amendmentId: number, reason: string, evidenceHash: string): ConstitutionCase {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason is required');
    }
    const caseId = this.nextCaseId++;
    const now = Date.now();
    const courtCase: ConstitutionCase = {
      caseId,
      amendmentId,
      filer,
      reason,
      evidenceHash,
      state: 'VOTING',
      isEmergency: false,
      emergencyApproved: false,
      votingStart: now,
      votingEnd: now + this.standardVotingPeriod,
      yesVotes: 0,
      noVotes: 0,
      totalVoters: 0,
      judgment: 'NONE',
      votes: [],
    };
    this.cases.set(caseId, courtCase);
    logger.info(`[CourtService] Case ${caseId} submitted by ${filer} for amendment ${amendmentId}`);
    return courtCase;
  }

  /**
   * 提交紧急宪法审查案件
   */
  submitEmergencyCase(filer: string, amendmentId: number, reason: string, evidenceHash: string): ConstitutionCase {
    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason is required');
    }
    const caseId = this.nextCaseId++;
    const courtCase: ConstitutionCase = {
      caseId,
      amendmentId,
      filer,
      reason,
      evidenceHash,
      state: 'PENDING',
      isEmergency: true,
      emergencyApproved: false,
      votingStart: 0,
      votingEnd: 0,
      yesVotes: 0,
      noVotes: 0,
      totalVoters: 0,
      judgment: 'NONE',
      votes: [],
    };
    this.cases.set(caseId, courtCase);
    logger.info(`[CourtService] Emergency case ${caseId} submitted by ${filer}`);
    return courtCase;
  }

  /**
   * 批准紧急案件
   */
  approveEmergency(caseId: number): ConstitutionCase {
    const courtCase = this.cases.get(caseId);
    if (!courtCase) throw new Error(`Case ${caseId} not found`);
    if (courtCase.state !== 'PENDING') throw new Error(`Case ${caseId} not pending`);
    if (!courtCase.isEmergency) throw new Error(`Case ${caseId} is not emergency`);
    if (courtCase.emergencyApproved) throw new Error(`Case ${caseId} already approved`);

    const now = Date.now();
    courtCase.emergencyApproved = true;
    courtCase.state = 'VOTING';
    courtCase.votingStart = now;
    courtCase.votingEnd = now + this.emergencyVotingPeriod;

    logger.info(`[CourtService] Emergency case ${caseId} approved`);
    return courtCase;
  }

  /**
   * 对案件投票
   */
  voteOnCase(caseId: number, voter: string, support: boolean, votingPower: number): ConstitutionCase {
    const courtCase = this.cases.get(caseId);
    if (!courtCase) throw new Error(`Case ${caseId} not found`);
    if (courtCase.state !== 'VOTING') throw new Error(`Case ${caseId} not in voting`);
    if (Date.now() > courtCase.votingEnd) throw new Error(`Case ${caseId} voting period ended`);
    if (courtCase.votes.some(v => v.voter === voter)) throw new Error(`Voter ${voter} already voted`);
    if (votingPower <= 0) throw new Error('No voting power');

    const vote: CaseVote = {
      voter,
      support,
      votingPower,
      timestamp: Date.now(),
    };
    courtCase.votes.push(vote);
    courtCase.totalVoters++;

    if (support) {
      courtCase.yesVotes += votingPower;
    } else {
      courtCase.noVotes += votingPower;
    }

    logger.info(`[CourtService] Vote on case ${caseId}: voter=${voter}, support=${support}, power=${votingPower}`);
    return courtCase;
  }

  /**
   * 判决案件
   */
  renderJudgment(caseId: number): ConstitutionCase {
    const courtCase = this.cases.get(caseId);
    if (!courtCase) throw new Error(`Case ${caseId} not found`);
    if (courtCase.state !== 'VOTING') throw new Error(`Case ${caseId} not in voting`);
    if (Date.now() < courtCase.votingEnd) throw new Error(`Case ${caseId} voting period not ended`);

    const totalVotes = courtCase.yesVotes + courtCase.noVotes;

    if (totalVotes === 0) {
      courtCase.state = 'DISMISSED';
      courtCase.judgment = 'NONE';
      logger.info(`[CourtService] Case ${caseId} dismissed (no votes)`);
      return courtCase;
    }

    const approvalRate = (courtCase.yesVotes * 10000) / totalVotes;

    if (approvalRate >= this.judgmentThreshold) {
      courtCase.judgment = 'UPHOLD';
    } else if (approvalRate < 3300) {
      courtCase.judgment = 'OVERTURN';
      // OVERTURN: only marks amendment FAILED, no auto-rollback
      logger.info(`[CourtService] Case ${caseId} OVERTURN — amendment ${courtCase.amendmentId} marked FAILED`);
    } else {
      courtCase.judgment = 'REMAND';
      // REMAND: notification only, sends back for re-review
      logger.info(`[CourtService] Case ${caseId} REMAND — amendment ${courtCase.amendmentId} sent back for re-review`);
    }

    courtCase.state = 'RESOLVED';
    logger.info(`[CourtService] Case ${caseId} judgment: ${courtCase.judgment} (yes=${courtCase.yesVotes}, no=${courtCase.noVotes})`);
    return courtCase;
  }

  /**
   * 获取案件
   */
  getCase(caseId: number): ConstitutionCase | null {
    return this.cases.get(caseId) || null;
  }

  /**
   * 列出所有案件
   */
  listCases(options?: { state?: CaseState; limit?: number }): ConstitutionCase[] {
    const opts = options || {};
    const limit = opts.limit || 100;
    let result = Array.from(this.cases.values());
    if (opts.state) {
      result = result.filter(c => c.state === opts.state);
    }
    return result.slice(0, limit);
  }
}

// =============== Singleton ===============

let instance: CourtServiceClass | null = null;

export function getCourtService(): CourtServiceClass {
  if (!instance) {
    instance = new CourtServiceClass();
  }
  return instance;
}

export { CourtServiceClass };
export default CourtServiceClass;
