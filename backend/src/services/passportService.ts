/**
 * Passport Service - V11.0 Agent通行证服务层
 *
 * 管理Agent通行证的签发、更新、撤销。
 * 当前为模拟模式，生产环境需连接真实链上AgentPassport合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export interface PassportInfo {
  agent: string;
  phiValue: number;
  creditScore: number;
  caseMerkleRoot: string;
  lostCaseCount: number;
  totalCaseCount: number;
  issuedAt: number;
  lastUpdated: number;
  active: boolean;
}

// =============== Service Class ===============

class PassportServiceClass {
  private passports: Map<string, PassportInfo>;
  private baseCreditScore: number;
  private creditPerCase: number;
  private creditLostPerCase: number;

  constructor() {
    this.passports = new Map();
    this.baseCreditScore = 5000;
    this.creditPerCase = 100;
    this.creditLostPerCase = 200;
    logger.info('[PassportService] Initialized V11.0 Agent Passport Service');
  }

  /**
   * 签发Agent通行证
   */
  issuePassport(agent: string, phiValue: number): PassportInfo {
    if (this.passports.has(agent)) {
      throw new Error(`Agent ${agent} already has a passport`);
    }
    if (phiValue > 10000) {
      throw new Error('phiValue exceeds maximum (10000)');
    }
    const now = Date.now();
    const passport: PassportInfo = {
      agent,
      phiValue,
      creditScore: this.baseCreditScore,
      caseMerkleRoot: '',
      lostCaseCount: 0,
      totalCaseCount: 0,
      issuedAt: now,
      lastUpdated: now,
      active: true,
    };
    this.passports.set(agent, passport);
    logger.info(`[PassportService] Passport issued for ${agent} with phiValue=${phiValue}`);
    return passport;
  }

  /**
   * 更新Φ值
   */
  updatePhiValue(agent: string, newPhiValue: number): PassportInfo {
    const passport = this.passports.get(agent);
    if (!passport) throw new Error(`Agent ${agent} has no passport`);
    if (newPhiValue > 10000) throw new Error('phiValue exceeds maximum');
    const oldPhi = passport.phiValue;
    passport.phiValue = newPhiValue;
    passport.lastUpdated = Date.now();
    logger.info(`[PassportService] Phi updated for ${agent}: ${oldPhi} → ${newPhiValue}`);
    return passport;
  }

  /**
   * 更新信用分（重新计算）
   */
  updateCreditScore(agent: string): PassportInfo {
    const passport = this.passports.get(agent);
    if (!passport) throw new Error(`Agent ${agent} has no passport`);
    const oldScore = passport.creditScore;
    passport.creditScore = this.calculateCreditScore(passport.totalCaseCount, passport.lostCaseCount);
    passport.lastUpdated = Date.now();
    logger.info(`[PassportService] Credit score updated for ${agent}: ${oldScore} → ${passport.creditScore}`);
    return passport;
  }

  /**
   * 更新案件Merkle根
   */
  updateCaseMerkleRoot(agent: string, newRoot: string): PassportInfo {
    const passport = this.passports.get(agent);
    if (!passport) throw new Error(`Agent ${agent} has no passport`);
    const oldRoot = passport.caseMerkleRoot;
    passport.caseMerkleRoot = newRoot;
    passport.lastUpdated = Date.now();
    logger.info(`[PassportService] Case merkle root updated for ${agent}: ${oldRoot} → ${newRoot}`);
    return passport;
  }

  /**
   * 增加败诉案件数
   */
  incrementLostCases(agent: string): PassportInfo {
    const passport = this.passports.get(agent);
    if (!passport) throw new Error(`Agent ${agent} has no passport`);
    passport.lostCaseCount++;
    passport.totalCaseCount++;
    passport.creditScore = this.calculateCreditScore(passport.totalCaseCount, passport.lostCaseCount);
    passport.lastUpdated = Date.now();
    logger.info(`[PassportService] Lost case incremented for ${agent}: total=${passport.totalCaseCount}, lost=${passport.lostCaseCount}, creditScore=${passport.creditScore}`);
    return passport;
  }

  /**
   * 撤销通行证
   */
  revokePassport(agent: string): PassportInfo {
    const passport = this.passports.get(agent);
    if (!passport) throw new Error(`Agent ${agent} has no passport`);
    passport.active = false;
    passport.lastUpdated = Date.now();
    logger.info(`[PassportService] Passport revoked for ${agent}`);
    return passport;
  }

  /**
   * 获取通行证
   */
  getPassport(agent: string): PassportInfo | null {
    return this.passports.get(agent) || null;
  }

  /**
   * 计算信用分: baseScore + totalCases*creditPerCase - lostCases*creditLostPerCase
   * 结果钳制在 [0, 10000] 范围
   */
  calculateCreditScore(totalCases: number, lostCases: number): number {
    const addition = this.baseCreditScore + totalCases * this.creditPerCase;
    const deduction = lostCases * this.creditLostPerCase;

    if (deduction > addition) {
      return 0;
    }

    const score = addition - deduction;
    return Math.min(10000, Math.max(0, score));
  }

  /**
   * 获取所有通行证
   */
  listPassports(options?: { activeOnly?: boolean; limit?: number }): PassportInfo[] {
    const opts = options || {};
    const limit = opts.limit || 100;
    let result = Array.from(this.passports.values());
    if (opts.activeOnly) {
      result = result.filter(p => p.active);
    }
    return result.slice(0, limit);
  }
}

// =============== Singleton ===============

let instance: PassportServiceClass | null = null;

export function getPassportService(): PassportServiceClass {
  if (!instance) {
    instance = new PassportServiceClass();
  }
  return instance;
}

export { PassportServiceClass };
export default PassportServiceClass;
