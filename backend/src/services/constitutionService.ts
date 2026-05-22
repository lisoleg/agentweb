/**
 * Constitution Service - V10.0 宪法治理服务层
 *
 * 管理宪法条款、修正案流程和紧急暂停机制。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type AmendmentState = 'DISCUSSION' | 'VOTING' | 'PASSED' | 'FAILED';

export interface Clause {
  clauseId: number;
  title: string;
  content: string;
  isCore: boolean;
  createdAt: number;
  active: boolean;
}

export interface Amendment {
  amendmentId: number;
  targetClauseId: number;
  title: string;
  description: string;
  proposedContent: string;
  proposer: string;
  state: AmendmentState;
  discussionStart: number;
  votingStart: number;
  votingEnd: number;
  yesVotes: string;
  noVotes: string;
  totalVoters: number;
}

export interface ConstitutionInfo {
  totalClauses: number;
  totalAmendments: number;
  amendmentApprovalThreshold: number;
  discussionPeriodDays: number;
  votingPeriodDays: number;
  constitutionPaused: boolean;
}

// =============== Service Class ===============

class ConstitutionServiceClass {
  private clauses: Map<number, Clause>;
  private amendments: Map<number, Amendment>;
  private nextClauseId: number;
  private nextAmendmentId: number;
  private amendmentApprovalThreshold: number;
  private discussionPeriodDays: number;
  private votingPeriodDays: number;
  private constitutionPaused: boolean;

  constructor() {
    this.clauses = new Map();
    this.amendments = new Map();
    this.nextClauseId = 1;
    this.nextAmendmentId = 1;
    this.amendmentApprovalThreshold = 6700; // 67%
    this.discussionPeriodDays = 7;
    this.votingPeriodDays = 7;
    this.constitutionPaused = false;
    logger.info('[ConstitutionService] Initialized V10.0 Constitution Service');
  }

  /**
   * 创建条款
   */
  createClause(title: string, content: string, isCore: boolean): Clause {
    const clauseId = this.nextClauseId++;
    const clause: Clause = {
      clauseId,
      title,
      content,
      isCore,
      createdAt: Date.now(),
      active: true,
    };
    this.clauses.set(clauseId, clause);
    logger.info(`[ConstitutionService] Clause ${clauseId} created: ${title} (core=${isCore})`);
    return clause;
  }

  /**
   * 提出修正案
   */
  proposeAmendment(targetClauseId: number, title: string, description: string, proposedContent: string, proposer: string): Amendment {
    const clause = this.clauses.get(targetClauseId);
    if (!clause || !clause.active) {
      throw new Error(`Clause ${targetClauseId} not found or inactive`);
    }
    if (clause.isCore) {
      throw new Error(`Core clause ${targetClauseId} is not amendable`);
    }
    const amendmentId = this.nextAmendmentId++;
    const amendment: Amendment = {
      amendmentId,
      targetClauseId,
      title,
      description,
      proposedContent,
      proposer,
      state: 'DISCUSSION',
      discussionStart: Date.now(),
      votingStart: 0,
      votingEnd: 0,
      yesVotes: '0',
      noVotes: '0',
      totalVoters: 0,
    };
    this.amendments.set(amendmentId, amendment);
    logger.info(`[ConstitutionService] Amendment ${amendmentId} proposed: ${title}`);
    return amendment;
  }

  /**
   * 推进修正案到投票阶段
   */
  advanceToVoting(amendmentId: number): Amendment {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment) {
      throw new Error(`Amendment ${amendmentId} not found`);
    }
    if (amendment.state !== 'DISCUSSION') {
      throw new Error(`Amendment ${amendmentId} not in discussion state`);
    }
    amendment.state = 'VOTING';
    amendment.votingStart = Date.now();
    amendment.votingEnd = Date.now() + this.votingPeriodDays * 24 * 60 * 60 * 1000;
    logger.info(`[ConstitutionService] Amendment ${amendmentId} advanced to voting`);
    return amendment;
  }

  /**
   * 对修正案投票
   */
  voteOnAmendment(amendmentId: number, voter: string, support: boolean, votingPower: string): Amendment {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment) {
      throw new Error(`Amendment ${amendmentId} not found`);
    }
    if (amendment.state !== 'VOTING') {
      throw new Error(`Amendment ${amendmentId} not in voting state`);
    }
    const power = BigInt(votingPower);
    if (support) {
      amendment.yesVotes = (BigInt(amendment.yesVotes) + power).toString();
    } else {
      amendment.noVotes = (BigInt(amendment.noVotes) + power).toString();
    }
    amendment.totalVoters++;
    logger.info(`[ConstitutionService] Vote on amendment ${amendmentId}: ${support ? 'YES' : 'NO'} (${votingPower})`);
    return amendment;
  }

  /**
   * 结算修正案
   */
  resolveAmendment(amendmentId: number): Amendment {
    const amendment = this.amendments.get(amendmentId);
    if (!amendment) {
      throw new Error(`Amendment ${amendmentId} not found`);
    }
    const yesVotes = BigInt(amendment.yesVotes);
    const noVotes = BigInt(amendment.noVotes);
    const total = yesVotes + noVotes;
    let passed = false;
    if (total > BigInt(0)) {
      const approvalRate = Number((yesVotes * BigInt(10000)) / total);
      passed = approvalRate >= this.amendmentApprovalThreshold;
    }
    amendment.state = passed ? 'PASSED' : 'FAILED';
    if (passed) {
      const clause = this.clauses.get(amendment.targetClauseId);
      if (clause) {
        clause.content = amendment.proposedContent;
      }
    }
    logger.info(`[ConstitutionService] Amendment ${amendmentId} resolved: ${passed ? 'PASSED' : 'FAILED'}`);
    return amendment;
  }

  /**
   * 紧急暂停宪法
   */
  emergencyPause(reason: string): void {
    this.constitutionPaused = true;
    logger.warn(`[ConstitutionService] Constitution EMERGENCY PAUSED: ${reason}`);
  }

  /**
   * 解除宪法暂停
   */
  emergencyUnpause(): void {
    this.constitutionPaused = false;
    logger.info('[ConstitutionService] Constitution unpaused');
  }

  /**
   * 获取条款
   */
  getClause(clauseId: number): Clause | null {
    return this.clauses.get(clauseId) || null;
  }

  /**
   * 获取修正案
   */
  getAmendment(amendmentId: number): Amendment | null {
    return this.amendments.get(amendmentId) || null;
  }

  /**
   * 获取宪法信息
   */
  getInfo(): ConstitutionInfo {
    return {
      totalClauses: this.clauses.size,
      totalAmendments: this.amendments.size,
      amendmentApprovalThreshold: this.amendmentApprovalThreshold,
      discussionPeriodDays: this.discussionPeriodDays,
      votingPeriodDays: this.votingPeriodDays,
      constitutionPaused: this.constitutionPaused,
    };
  }

  /**
   * 获取所有条款
   */
  getAllClauses(): Clause[] {
    return Array.from(this.clauses.values());
  }

  /**
   * 获取所有修正案
   */
  getAllAmendments(): Amendment[] {
    return Array.from(this.amendments.values());
  }
}

// =============== Singleton ===============

let instance: ConstitutionServiceClass | null = null;

export function get_instance(): ConstitutionServiceClass {
  if (!instance) {
    instance = new ConstitutionServiceClass();
  }
  return instance;
}

export { ConstitutionServiceClass };
export default ConstitutionServiceClass;
