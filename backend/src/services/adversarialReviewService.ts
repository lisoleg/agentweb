/**
 * Adversarial Review Service - 对抗互审+熔断+负面案例库
 *
 * V9.0 多角色对抗互审服务，整合评审流程、熔断机制和负面案例管理。
 * 当前为模拟模式，生产环境需连接真实链上合约。
 */

import logger from '../utils/logger';

// =============== Types ===============

export type ReviewRole = 'ARCHITECT' | 'SECURITY_AUDITOR' | 'UX_OFFICER';
export type ReviewDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONDITIONAL' | 'ARBITRATION';
export type SessionStatus = 'SUBMITTED' | 'REVIEWING' | 'VOTING' | 'RESOLVED' | 'ARBITRATION' | 'CLOSED';
export type CircuitState = 'OPERATIONAL' | 'WARNED' | 'SUSPENDED' | 'CIRCUIT_BROKEN';
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Review {
  reviewer: string;
  role: ReviewRole;
  score: number;
  comment: string;
  tags: string[];
  decision: ReviewDecision;
  timestamp: number;
  submitted: boolean;
}

export interface ReviewSession {
  sessionId: number;
  targetAgentId: number;
  submitter: string;
  subject: string;
  description: string;
  contentHash: string;
  status: SessionStatus;
  finalDecision: ReviewDecision;
  submittedAt: number;
  resolvedAt: number;
  reviewDeadline: number;
  arbitrationId: number;
  reviews: Partial<Record<ReviewRole, Review>>;
}

export interface Arbitration {
  arbitrationId: number;
  sessionId: number;
  arbitrator: string;
  decision: ReviewDecision;
  reasoning: string;
  timestamp: number;
  resolved: boolean;
}

export interface CircuitBreakerState {
  agentId: number;
  state: CircuitState;
  totalErrors: number;
  warningCount: number;
  suspensionCount: number;
  circuitBreakCount: number;
  lastErrorTimestamp: number;
  recoveryAttempts: number;
  successfulRecoveries: number;
}

export interface ErrorRecord {
  errorId: number;
  agentId: number;
  errorType: string;
  errorMessage: string;
  severity: ErrorSeverity;
  timestamp: number;
  reporter: string;
  sessionId: number;
}

export interface NegativeCase {
  caseId: number;
  agentId: number;
  errorType: string;
  description: string;
  severity: ErrorSeverity;
  reviewSessionId: number;
  circuitState: CircuitState;
  timestamp: number;
  resolved: boolean;
}

export interface ReviewerProfile {
  reviewer: string;
  role: ReviewRole;
  totalReviews: number;
  approvedCount: number;
  rejectedCount: number;
  reputationScore: number;
  isActive: boolean;
}

// =============== Service Class ===============

class AdversarialReviewServiceClass {
  private sessions: Map<number, ReviewSession>;
  private arbitrations: Map<number, Arbitration>;
  private circuitStates: Map<number, CircuitBreakerState>;
  private errorRecords: Map<number, ErrorRecord>;
  private negativeCases: Map<number, NegativeCase>;
  private reviewerProfiles: Map<string, ReviewerProfile>;
  private roleReviewers: Map<ReviewRole, string>;

  private nextSessionId: number;
  private nextArbitrationId: number;
  private nextErrorId: number;
  private nextCaseId: number;

  // 配置
  private warningThreshold: number;
  private suspensionThreshold: number;
  private circuitBreakThreshold: number;
  private scoreDisparityThreshold: number;

  constructor() {
    this.sessions = new Map();
    this.arbitrations = new Map();
    this.circuitStates = new Map();
    this.errorRecords = new Map();
    this.negativeCases = new Map();
    this.reviewerProfiles = new Map();
    this.roleReviewers = new Map();

    this.nextSessionId = 1;
    this.nextArbitrationId = 1;
    this.nextErrorId = 1;
    this.nextCaseId = 1;

    this.warningThreshold = 3;
    this.suspensionThreshold = 5;
    this.circuitBreakThreshold = 10;
    this.scoreDisparityThreshold = 30;

    logger.info('[AdversarialReview] Service initialized');
  }

  // ── Review Session Methods ──

  /**
   * 提交评审申请
   */
  submitReview(targetAgentId: number, subject: string, description: string, contentHash: string): ReviewSession {
    const sessionId = this.nextSessionId++;
    const session: ReviewSession = {
      sessionId,
      targetAgentId,
      submitter: 'system',
      subject,
      description,
      contentHash,
      status: 'SUBMITTED',
      finalDecision: 'PENDING',
      submittedAt: Date.now(),
      resolvedAt: 0,
      reviewDeadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
      arbitrationId: 0,
      reviews: {},
    };
    this.sessions.set(sessionId, session);
    logger.info(`[AdversarialReview] Session ${sessionId} submitted for agent ${targetAgentId}: ${subject}`);
    return session;
  }

  /**
   * 提交评审意见
   */
  submitReviewOpinion(
    sessionId: number,
    role: ReviewRole,
    score: number,
    comment: string,
    tags: string[],
    decision: ReviewDecision
  ): ReviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'SUBMITTED' && session.status !== 'REVIEWING') {
      throw new Error(`Session ${sessionId} not in review state`);
    }

    session.status = 'REVIEWING';
    session.reviews[role] = {
      reviewer: this.roleReviewers.get(role) || 'unknown',
      role,
      score,
      comment,
      tags,
      decision,
      timestamp: Date.now(),
      submitted: true,
    };

    // 更新评审员资料
    const reviewerAddr = this.roleReviewers.get(role) || 'unknown';
    const profile = this.reviewerProfiles.get(reviewerAddr) || {
      reviewer: reviewerAddr,
      role,
      totalReviews: 0,
      approvedCount: 0,
      rejectedCount: 0,
      reputationScore: 5000,
      isActive: true,
    };
    profile.totalReviews++;
    if (decision === 'APPROVED' || decision === 'CONDITIONAL') {
      profile.approvedCount++;
    } else {
      profile.rejectedCount++;
    }
    this.reviewerProfiles.set(reviewerAddr, profile);

    // 检查三方是否完成
    const completedCount = Object.values(session.reviews).filter(r => r.submitted).length;
    if (completedCount >= 3) {
      this._resolveSession(sessionId);
    }

    logger.info(`[AdversarialReview] Session ${sessionId}: ${role} submitted score=${score}, decision=${decision}`);
    return session;
  }

  /**
   * 获取评审会话
   */
  getSession(sessionId: number): ReviewSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取平均分
   */
  getAverageScore(sessionId: number): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    const reviews = Object.values(session.reviews).filter(r => r.submitted);
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  }

  /**
   * 获取分差
   */
  getScoreDisparity(sessionId: number): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    const reviews = Object.values(session.reviews).filter(r => r.submitted);
    if (reviews.length < 2) return 0;
    const scores = reviews.map(r => r.score);
    return Math.max(...scores) - Math.min(...scores);
  }

  // ── Arbitration Methods ──

  /**
   * 解决仲裁
   */
  resolveArbitration(arbitrationId: number, decision: ReviewDecision, reasoning: string): Arbitration {
    const arb = this.arbitrations.get(arbitrationId);
    if (!arb) throw new Error(`Arbitration ${arbitrationId} not found`);
    if (arb.resolved) throw new Error(`Arbitration ${arbitrationId} already resolved`);

    arb.decision = decision;
    arb.reasoning = reasoning;
    arb.timestamp = Date.now();
    arb.resolved = true;

    // 更新会话
    const session = this.sessions.get(arb.sessionId);
    if (session) {
      session.finalDecision = decision;
      session.status = 'RESOLVED';
      session.resolvedAt = Date.now();
    }

    logger.info(`[AdversarialReview] Arbitration ${arbitrationId} resolved: ${decision}`);
    return arb;
  }

  /**
   * 获取仲裁信息
   */
  getArbitration(arbitrationId: number): Arbitration | null {
    return this.arbitrations.get(arbitrationId) || null;
  }

  // ── Circuit Breaker Methods ──

  /**
   * 记录错误
   */
  recordError(
    agentId: number,
    errorType: string,
    errorMessage: string,
    severity: ErrorSeverity,
    sessionId: number = 0
  ): CircuitBreakerState {
    const errorId = this.nextErrorId++;
    this.errorRecords.set(errorId, {
      errorId,
      agentId,
      errorType,
      errorMessage,
      severity,
      timestamp: Date.now(),
      reporter: 'system',
      sessionId,
    });

    let circuit = this.circuitStates.get(agentId);
    if (!circuit) {
      circuit = {
        agentId,
        state: 'OPERATIONAL',
        totalErrors: 0,
        warningCount: 0,
        suspensionCount: 0,
        circuitBreakCount: 0,
        lastErrorTimestamp: 0,
        recoveryAttempts: 0,
        successfulRecoveries: 0,
      };
      this.circuitStates.set(agentId, circuit);
    }

    const weights: Record<ErrorSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 };
    circuit.totalErrors += weights[severity];
    circuit.lastErrorTimestamp = Date.now();

    // 状态转换
    const oldState = circuit.state;
    if (circuit.state !== 'CIRCUIT_BROKEN') {
      if (circuit.totalErrors >= this.circuitBreakThreshold) {
        circuit.state = 'CIRCUIT_BROKEN';
        circuit.circuitBreakCount++;
      } else if (circuit.totalErrors >= this.suspensionThreshold) {
        circuit.state = 'SUSPENDED';
        circuit.suspensionCount++;
      } else if (circuit.totalErrors >= this.warningThreshold) {
        circuit.state = 'WARNED';
        circuit.warningCount++;
      }
    }

    // 记录负面案例
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      const caseId = this.nextCaseId++;
      this.negativeCases.set(caseId, {
        caseId,
        agentId,
        errorType,
        description: errorMessage,
        severity,
        reviewSessionId: sessionId,
        circuitState: circuit.state,
        timestamp: Date.now(),
        resolved: false,
      });
    }

    logger.info(`[AdversarialReview] Error recorded for agent ${agentId}: ${errorType} (${severity}), state: ${oldState} → ${circuit.state}`);
    return circuit;
  }

  /**
   * 申请恢复
   */
  requestRecovery(agentId: number): CircuitBreakerState {
    const circuit = this.circuitStates.get(agentId);
    if (!circuit) throw new Error(`No circuit state for agent ${agentId}`);
    if (circuit.state === 'OPERATIONAL') throw new Error('Agent is operational, no recovery needed');

    circuit.recoveryAttempts++;
    logger.info(`[AdversarialReview] Recovery requested for agent ${agentId}, attempt #${circuit.recoveryAttempts}`);
    return circuit;
  }

  /**
   * 审批恢复
   */
  approveRecovery(agentId: number, approved: boolean): CircuitBreakerState {
    const circuit = this.circuitStates.get(agentId);
    if (!circuit) throw new Error(`No circuit state for agent ${agentId}`);

    if (approved) {
      const oldState = circuit.state;
      if (circuit.state === 'CIRCUIT_BROKEN') {
        circuit.state = 'SUSPENDED';
      } else if (circuit.state === 'SUSPENDED') {
        circuit.state = 'WARNED';
      } else if (circuit.state === 'WARNED') {
        circuit.state = 'OPERATIONAL';
        circuit.successfulRecoveries++;
        circuit.totalErrors = 0;
      }
      logger.info(`[AdversarialReview] Recovery approved for agent ${agentId}: ${oldState} → ${circuit.state}`);
    } else {
      logger.info(`[AdversarialReview] Recovery rejected for agent ${agentId}`);
    }
    return circuit;
  }

  /**
   * 获取熔断状态
   */
  getCircuitState(agentId: number): CircuitBreakerState | null {
    return this.circuitStates.get(agentId) || null;
  }

  /**
   * 获取Agent运行分数（0-100）
   */
  getCircuitScore(agentId: number): number {
    const circuit = this.circuitStates.get(agentId);
    if (!circuit) return 100;
    if (circuit.state === 'CIRCUIT_BROKEN') return 0;
    if (circuit.state === 'SUSPENDED') return 25;
    if (circuit.state === 'WARNED') return 60;
    return 100;
  }

  // ── Negative Case Library ──

  /**
   * 获取负面案例
   */
  getNegativeCases(agentId?: number): NegativeCase[] {
    const cases = Array.from(this.negativeCases.values());
    if (agentId !== undefined) {
      return cases.filter(c => c.agentId === agentId);
    }
    return cases;
  }

  /**
   * 解决负面案例
   */
  resolveNegativeCase(caseId: number): NegativeCase | null {
    const nc = this.negativeCases.get(caseId);
    if (!nc) return null;
    nc.resolved = true;
    logger.info(`[AdversarialReview] Negative case ${caseId} resolved`);
    return nc;
  }

  // ── Reviewer Management ──

  /**
   * 指派评审员
   */
  assignReviewer(role: ReviewRole, reviewer: string): void {
    this.roleReviewers.set(role, reviewer);
    this.reviewerProfiles.set(reviewer, {
      reviewer,
      role,
      totalReviews: 0,
      approvedCount: 0,
      rejectedCount: 0,
      reputationScore: 5000,
      isActive: true,
    });
    logger.info(`[AdversarialReview] Assigned ${role}: ${reviewer}`);
  }

  /**
   * 获取评审员资料
   */
  getReviewerProfile(reviewer: string): ReviewerProfile | null {
    return this.reviewerProfiles.get(reviewer) || null;
  }

  // ── Internal Methods ──

  /**
   * 决议评审会话
   */
  private _resolveSession(sessionId: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const reviews = Object.values(session.reviews).filter(r => r.submitted);
    if (reviews.length < 3) return;

    // 计算分差
    const scores = reviews.map(r => r.score);
    const disparity = Math.max(...scores) - Math.min(...scores);

    if (disparity > this.scoreDisparityThreshold) {
      // 触发仲裁
      const arbId = this.nextArbitrationId++;
      this.arbitrations.set(arbId, {
        arbitrationId: arbId,
        sessionId,
        arbitrator: 'arbitrator',
        decision: 'PENDING',
        reasoning: '',
        timestamp: Date.now(),
        resolved: false,
      });
      session.status = 'ARBITRATION';
      session.arbitrationId = arbId;
      logger.info(`[AdversarialReview] Session ${sessionId}: arbitration triggered (disparity=${disparity})`);
      return;
    }

    // 多数决
    const approveCount = reviews.filter(r => r.decision === 'APPROVED' || r.decision === 'CONDITIONAL').length;
    const rejectCount = reviews.filter(r => r.decision === 'REJECTED').length;

    if (approveCount >= 2) {
      session.finalDecision = 'APPROVED';
    } else if (rejectCount >= 2) {
      session.finalDecision = 'REJECTED';
    } else {
      session.finalDecision = 'CONDITIONAL';
    }

    session.status = 'RESOLVED';
    session.resolvedAt = Date.now();
    logger.info(`[AdversarialReview] Session ${sessionId} resolved: ${session.finalDecision}`);
  }
}

// =============== Singleton ===============

let instance: AdversarialReviewServiceClass | null = null;

export function get_instance(): AdversarialReviewServiceClass {
  if (!instance) {
    instance = new AdversarialReviewServiceClass();
  }
  return instance;
}

export { AdversarialReviewServiceClass };
export default AdversarialReviewServiceClass;
