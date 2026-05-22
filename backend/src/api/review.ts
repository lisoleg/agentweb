/**
 * Review Routes - 互审路由
 *
 * V9.0 多角色对抗互审+熔断机制+负面案例库API
 */

import { Router, Request, Response } from 'express';
import { get_instance } from '../services/adversarialReviewService';

const router = Router();
const reviewService = get_instance();

// =============== Adversarial Review Routes ===============

/**
 * GET /api/v1/review/info
 * 获取互审系统概览
 */
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      module: 'AdversarialReview',
      version: '9.0.0',
      description: '多角色对抗互审 — 三方独立评审+投票+冲突仲裁+熔断机制',
      reviewRoles: {
        ARCHITECT: { description: '架构师: 评估架构合理性' },
        SECURITY_AUDITOR: { description: '安全审计员: 评估安全风险' },
        UX_OFFICER: { description: '体验官: 评估用户体验' },
      },
      reviewFlow: '提交 → 三方独立评审 → 投票 → 决议',
      conflictHandling: '评审分歧(分差>30) → 自动触发仲裁',
      scoringSystem: '每位评审0-100分 + 评语 + 标签',
      circuitBreaker: {
        states: ['OPERATIONAL', 'WARNED', 'SUSPENDED', 'CIRCUIT_BROKEN'],
        thresholds: { warning: 3, suspension: 5, circuitBreak: 10 },
        recovery: '必须通过复查才能恢复',
      },
    },
  });
});

/**
 * POST /api/v1/review/session
 * 提交评审申请
 */
router.post('/session', (req: Request, res: Response) => {
  const { targetAgentId, subject, description, contentHash } = req.body;
  if (!targetAgentId || !subject) {
    res.status(400).json({ code: 1, message: 'targetAgentId and subject are required' });
    return;
  }
  try {
    const session = reviewService.submitReview(
      Number(targetAgentId),
      subject,
      description || '',
      contentHash || ''
    );
    res.json({ code: 0, data: session, version: '9.0.0' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/review/session/:sessionId/opinion
 * 提交评审意见
 */
router.post('/session/:sessionId/opinion', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { role, score, comment, tags, decision } = req.body;
  if (!role || score === undefined || !decision) {
    res.status(400).json({ code: 1, message: 'role, score, and decision are required' });
    return;
  }
  const validRoles = ['ARCHITECT', 'SECURITY_AUDITOR', 'UX_OFFICER'];
  const validDecisions = ['APPROVED', 'REJECTED', 'CONDITIONAL'];
  if (!validRoles.includes(role) || !validDecisions.includes(decision)) {
    res.status(400).json({ code: 1, message: 'Invalid role or decision' });
    return;
  }
  if (score < 0 || score > 100) {
    res.status(400).json({ code: 1, message: 'Score must be 0-100' });
    return;
  }
  try {
    const session = reviewService.submitReviewOpinion(
      Number(sessionId),
      role,
      Number(score),
      comment || '',
      tags || [],
      decision
    );
    res.json({ code: 0, data: session, version: '9.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/review/session/:sessionId
 * 获取评审会话
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = reviewService.getSession(Number(sessionId));
  if (!session) {
    res.status(404).json({ code: 1, message: 'Session not found' });
    return;
  }
  const avgScore = reviewService.getAverageScore(Number(sessionId));
  const disparity = reviewService.getScoreDisparity(Number(sessionId));
  res.json({ code: 0, data: { ...session, averageScore: avgScore, scoreDisparity: disparity }, version: '9.0.0' });
});

/**
 * GET /api/v1/review/session/:sessionId/scores
 * 获取评审评分详情
 */
router.get('/session/:sessionId/scores', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = reviewService.getSession(Number(sessionId));
  if (!session) {
    res.status(404).json({ code: 1, message: 'Session not found' });
    return;
  }
  const avgScore = reviewService.getAverageScore(Number(sessionId));
  const disparity = reviewService.getScoreDisparity(Number(sessionId));
  res.json({
    code: 0,
    data: {
      sessionId: Number(sessionId),
      reviews: session.reviews,
      averageScore: avgScore,
      scoreDisparity: disparity,
      needsArbitration: disparity > 30,
    },
    version: '9.0.0',
  });
});

/**
 * POST /api/v1/review/arbitration/:arbitrationId/resolve
 * 解决仲裁
 */
router.post('/arbitration/:arbitrationId/resolve', (req: Request, res: Response) => {
  const { arbitrationId } = req.params;
  const { decision, reasoning } = req.body;
  if (!decision || !reasoning) {
    res.status(400).json({ code: 1, message: 'decision and reasoning are required' });
    return;
  }
  try {
    const arb = reviewService.resolveArbitration(Number(arbitrationId), decision, reasoning);
    res.json({ code: 0, data: arb, version: '9.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

// =============== Reviewer Management Routes ===============

/**
 * POST /api/v1/review/reviewer/assign
 * 指派评审员
 */
router.post('/reviewer/assign', (req: Request, res: Response) => {
  const { role, reviewer } = req.body;
  if (!role || !reviewer) {
    res.status(400).json({ code: 1, message: 'role and reviewer are required' });
    return;
  }
  const validRoles = ['ARCHITECT', 'SECURITY_AUDITOR', 'UX_OFFICER'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ code: 1, message: 'Invalid role' });
    return;
  }
  reviewService.assignReviewer(role, reviewer);
  res.json({ code: 0, data: { role, reviewer, message: 'Reviewer assigned' }, version: '9.0.0' });
});

// =============== Circuit Breaker Routes ===============

/**
 * GET /api/v1/review/circuit/:agentId
 * 获取熔断状态
 */
router.get('/circuit/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const circuit = reviewService.getCircuitState(Number(agentId));
  const score = reviewService.getCircuitScore(Number(agentId));
  res.json({
    code: 0,
    data: {
      agentId: Number(agentId),
      circuitState: circuit || { state: 'OPERATIONAL', totalErrors: 0, circuitScore: 100 },
      circuitScore: score,
    },
    version: '9.0.0',
  });
});

/**
 * POST /api/v1/review/circuit/error
 * 记录错误
 */
router.post('/circuit/error', (req: Request, res: Response) => {
  const { agentId, errorType, errorMessage, severity, sessionId } = req.body;
  if (!agentId || !errorType || !errorMessage || !severity) {
    res.status(400).json({ code: 1, message: 'agentId, errorType, errorMessage, and severity are required' });
    return;
  }
  const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  if (!validSeverities.includes(severity)) {
    res.status(400).json({ code: 1, message: 'Invalid severity' });
    return;
  }
  try {
    const circuit = reviewService.recordError(
      Number(agentId),
      errorType,
      errorMessage,
      severity,
      sessionId ? Number(sessionId) : 0
    );
    res.json({ code: 0, data: circuit, version: '9.0.0' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/review/circuit/:agentId/recovery
 * 申请/审批恢复
 */
router.post('/circuit/:agentId/recovery', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { approved } = req.body;
  try {
    let circuit;
    if (approved === undefined) {
      // 申请恢复
      circuit = reviewService.requestRecovery(Number(agentId));
    } else {
      // 审批恢复
      circuit = reviewService.approveRecovery(Number(agentId), approved);
    }
    res.json({ code: 0, data: circuit, version: '9.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

// =============== Negative Case Library Routes ===============

/**
 * GET /api/v1/review/negative-cases
 * 获取负面案例库
 */
router.get('/negative-cases', (req: Request, res: Response) => {
  const { agentId } = req.query;
  const cases = reviewService.getNegativeCases(agentId ? Number(agentId) : undefined);
  res.json({ code: 0, data: cases, version: '9.0.0' });
});

/**
 * POST /api/v1/review/negative-cases/:caseId/resolve
 * 解决负面案例
 */
router.post('/negative-cases/:caseId/resolve', (req: Request, res: Response) => {
  const { caseId } = req.params;
  const nc = reviewService.resolveNegativeCase(Number(caseId));
  if (!nc) {
    res.status(404).json({ code: 1, message: 'Case not found' });
    return;
  }
  res.json({ code: 0, data: nc, version: '9.0.0' });
});

export default router;
