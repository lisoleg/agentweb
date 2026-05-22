/**
 * Constitution Routes - V10.0 宪法治理路由
 */

import { Router, Request, Response } from 'express';
import { get_instance } from '../services/constitutionService';

const router = Router();
const constitutionService = get_instance();

// =============== Constitution Routes ===============

/**
 * GET /api/v1/constitution/info
 * 获取宪法信息
 */
router.get('/info', (_req: Request, res: Response) => {
  const info = constitutionService.getInfo();
  res.json({ code: 0, data: info, version: '10.0.0' });
});

/**
 * GET /api/v1/constitution/clauses
 * 获取所有条款
 */
router.get('/clauses', (_req: Request, res: Response) => {
  const clauses = constitutionService.getAllClauses();
  res.json({ code: 0, data: clauses, version: '10.0.0' });
});

/**
 * POST /api/v1/constitution/clauses
 * 创建条款
 */
router.post('/clauses', (req: Request, res: Response) => {
  const { title, content, isCore } = req.body;
  if (!title || !content) {
    res.status(400).json({ code: 1, message: 'title and content are required' });
    return;
  }
  try {
    const clause = constitutionService.createClause(title, content, isCore ?? false);
    res.json({ code: 0, data: clause, version: '10.0.0' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/constitution/clauses/:clauseId
 * 获取条款详情
 */
router.get('/clauses/:clauseId', (req: Request, res: Response) => {
  const clause = constitutionService.getClause(Number(req.params.clauseId));
  if (!clause) {
    res.status(404).json({ code: 1, message: 'Clause not found' });
    return;
  }
  res.json({ code: 0, data: clause, version: '10.0.0' });
});

/**
 * GET /api/v1/constitution/amendments
 * 获取所有修正案
 */
router.get('/amendments', (_req: Request, res: Response) => {
  const amendments = constitutionService.getAllAmendments();
  res.json({ code: 0, data: amendments, version: '10.0.0' });
});

/**
 * POST /api/v1/constitution/amendments
 * 提出修正案
 */
router.post('/amendments', (req: Request, res: Response) => {
  const { targetClauseId, title, description, proposedContent, proposer } = req.body;
  if (!targetClauseId || !title || !description || !proposedContent || !proposer) {
    res.status(400).json({ code: 1, message: 'targetClauseId, title, description, proposedContent, and proposer are required' });
    return;
  }
  try {
    const amendment = constitutionService.proposeAmendment(Number(targetClauseId), title, description, proposedContent, proposer);
    res.json({ code: 0, data: amendment, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/constitution/amendments/:amendmentId/advance
 * 推进修正案到投票阶段
 */
router.post('/amendments/:amendmentId/advance', (req: Request, res: Response) => {
  try {
    const amendment = constitutionService.advanceToVoting(Number(req.params.amendmentId));
    res.json({ code: 0, data: amendment, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/constitution/amendments/:amendmentId/vote
 * 对修正案投票
 */
router.post('/amendments/:amendmentId/vote', (req: Request, res: Response) => {
  const { voter, support, votingPower } = req.body;
  if (!voter || support === undefined || !votingPower) {
    res.status(400).json({ code: 1, message: 'voter, support, and votingPower are required' });
    return;
  }
  try {
    const amendment = constitutionService.voteOnAmendment(Number(req.params.amendmentId), voter, support, votingPower);
    res.json({ code: 0, data: amendment, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/constitution/amendments/:amendmentId/resolve
 * 结算修正案
 */
router.post('/amendments/:amendmentId/resolve', (req: Request, res: Response) => {
  try {
    const amendment = constitutionService.resolveAmendment(Number(req.params.amendmentId));
    res.json({ code: 0, data: amendment, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/constitution/emergency-pause
 * 紧急暂停宪法
 */
router.post('/emergency-pause', (req: Request, res: Response) => {
  const { reason } = req.body;
  constitutionService.emergencyPause(reason || 'Emergency pause triggered');
  res.json({ code: 0, data: { message: 'Constitution emergency paused', reason }, version: '10.0.0' });
});

/**
 * POST /api/v1/constitution/emergency-unpause
 * 解除宪法暂停
 */
router.post('/emergency-unpause', (_req: Request, res: Response) => {
  constitutionService.emergencyUnpause();
  res.json({ code: 0, data: { message: 'Constitution unpaused' }, version: '10.0.0' });
});

export default router;
