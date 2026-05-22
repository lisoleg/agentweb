/**
 * NegativeCaseBook Service - V10.0 反面案例簿服务层
 *
 * 管理反面案例记录、强制学习标记和Agent学习追踪。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type CaseCategory = 'HALLUCINATION' | 'SAFETY_VIOLATION' | 'DATA_LEAK' | 'PERFORMANCE_DEGRADATION' | 'MISALIGNMENT' | 'RESOURCE_ABUSE' | 'OTHER';
export type CaseSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface NegativeCase {
  caseId: number;
  title: string;
  description: string;
  category: CaseCategory;
  severity: CaseSeverity;
  evidenceHash: string;
  recorder: string;
  timestamp: number;
  isMandatory: boolean;
  softDeleted: boolean;
  confirmCount: number;
}

export interface AgentLearningStatus {
  agent: string;
  totalCases: number;
  learnedCount: number;
  mandatoryLearnedCount: number;
  mandatoryRemaining: number;
}

// =============== Service Class ===============

class NegativeCaseBookServiceClass {
  private cases: Map<number, NegativeCase>;
  private casesByCategory: Map<CaseCategory, number[]>;
  private agentLearned: Map<string, Set<number>>;
  private nextCaseId: number;

  constructor() {
    this.cases = new Map();
    this.casesByCategory = new Map();
    this.agentLearned = new Map();
    this.nextCaseId = 1;
    logger.info('[NegativeCaseBookService] Initialized V10.0 NegativeCaseBook Service');
  }

  /**
   * 记录反面案例
   */
  recordCase(title: string, description: string, category: CaseCategory, severity: CaseSeverity, evidenceHash: string, recorder: string): NegativeCase {
    const caseId = this.nextCaseId++;
    const negCase: NegativeCase = {
      caseId,
      title,
      description,
      category,
      severity,
      evidenceHash,
      recorder,
      timestamp: Date.now(),
      isMandatory: false,
      softDeleted: false,
      confirmCount: 0,
    };
    this.cases.set(caseId, negCase);
    const categoryList = this.casesByCategory.get(category) || [];
    categoryList.push(caseId);
    this.casesByCategory.set(category, categoryList);
    logger.info(`[NegativeCaseBookService] Case ${caseId} recorded: ${title} (${category}/${severity})`);
    return negCase;
  }

  /**
   * 标记案例为强制学习
   */
  markMandatory(caseId: number): NegativeCase {
    const negCase = this.cases.get(caseId);
    if (!negCase) throw new Error(`Case ${caseId} not found`);
    if (negCase.softDeleted) throw new Error(`Case ${caseId} is soft deleted`);
    negCase.isMandatory = true;
    logger.info(`[NegativeCaseBookService] Case ${caseId} marked as mandatory`);
    return negCase;
  }

  /**
   * 取消强制学习标记
   */
  unmarkMandatory(caseId: number): NegativeCase {
    const negCase = this.cases.get(caseId);
    if (!negCase) throw new Error(`Case ${caseId} not found`);
    negCase.isMandatory = false;
    logger.info(`[NegativeCaseBookService] Case ${caseId} unmarked mandatory`);
    return negCase;
  }

  /**
   * 确认Agent学习了某个案例
   */
  confirmLearning(agent: string, caseId: number): void {
    const negCase = this.cases.get(caseId);
    if (!negCase) throw new Error(`Case ${caseId} not found`);
    if (negCase.softDeleted) throw new Error(`Case ${caseId} is soft deleted`);
    let learned = this.agentLearned.get(agent);
    if (!learned) {
      learned = new Set();
      this.agentLearned.set(agent, learned);
    }
    if (learned.has(caseId)) {
      throw new Error(`Agent ${agent} already learned case ${caseId}`);
    }
    learned.add(caseId);
    negCase.confirmCount++;
    logger.info(`[NegativeCaseBookService] Agent ${agent} confirmed learning case ${caseId}`);
  }

  /**
   * 强制学习所有必学案例
   */
  mandatoryLearnAll(agent: string): number {
    let learned = this.agentLearned.get(agent);
    if (!learned) {
      learned = new Set();
      this.agentLearned.set(agent, learned);
    }
    let count = 0;
    for (const [caseId, negCase] of this.cases) {
      if (negCase.isMandatory && !negCase.softDeleted && !learned.has(caseId)) {
        learned.add(caseId);
        negCase.confirmCount++;
        count++;
      }
    }
    logger.info(`[NegativeCaseBookService] Agent ${agent} mandatory learned ${count} cases`);
    return count;
  }

  /**
   * 软删除案例
   */
  softDelete(caseId: number): void {
    const negCase = this.cases.get(caseId);
    if (!negCase) throw new Error(`Case ${caseId} not found`);
    if (negCase.softDeleted) throw new Error(`Case ${caseId} already soft deleted`);
    negCase.softDeleted = true;
    logger.info(`[NegativeCaseBookService] Case ${caseId} soft deleted`);
  }

  /**
   * 按分类获取案例
   */
  getCasesByCategory(category: CaseCategory): NegativeCase[] {
    const ids = this.casesByCategory.get(category) || [];
    return ids.map(id => this.cases.get(id)!).filter(c => c && !c.softDeleted);
  }

  /**
   * 获取案例
   */
  getCase(caseId: number): NegativeCase | null {
    return this.cases.get(caseId) || null;
  }

  /**
   * 获取Agent学习状态
   */
  getAgentLearningStatus(agent: string): AgentLearningStatus {
    const learned = this.agentLearned.get(agent) || new Set<number>();
    let mandatoryTotal = 0;
    let mandatoryLearned = 0;
    for (const [, negCase] of this.cases) {
      if (negCase.isMandatory && !negCase.softDeleted) {
        mandatoryTotal++;
        if (learned.has(negCase.caseId)) {
          mandatoryLearned++;
        }
      }
    }
    return {
      agent,
      totalCases: this.cases.size,
      learnedCount: learned.size,
      mandatoryLearnedCount: mandatoryLearned,
      mandatoryRemaining: mandatoryTotal - mandatoryLearned,
    };
  }

  /**
   * 获取所有案例
   */
  getAllCases(): NegativeCase[] {
    return Array.from(this.cases.values()).filter(c => !c.softDeleted);
  }
}

// =============== Singleton ===============

let instance: NegativeCaseBookServiceClass | null = null;

export function get_instance(): NegativeCaseBookServiceClass {
  if (!instance) {
    instance = new NegativeCaseBookServiceClass();
  }
  return instance;
}

export { NegativeCaseBookServiceClass };
export default NegativeCaseBookServiceClass;
