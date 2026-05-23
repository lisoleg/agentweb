/**
 * Court Routes - V11.0 宪法法院路由
 *
 * POST   /api/v11/court/cases             — 提交普通案件
 * POST   /api/v11/court/cases/emergency    — 提交紧急案件
 * PUT    /api/v11/court/cases/:id/approve  — 批准紧急案件
 * POST   /api/v11/court/cases/:id/vote     — 对案件投票
 * POST   /api/v11/court/cases/:id/judgment — 判决案件
 * GET    /api/v11/court/cases              — 列出案件
 * GET    /api/v11/court/cases/:id          — 获取案件详情
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { getCourtService } from '../services/courtService';

const router = Router();
const courtService = getCourtService();

// =============== Validation Schemas ===============

const SubmitCaseSchema = z.object({
  amendmentId: z.number().positive(),
  reason: z.string().min(1),
  evidenceHash: z.string().optional().default(''),
});

const VoteSchema = z.object({
  support: z.boolean(),
  votingPower: z.number().positive().optional().default(1000),
});

// =============== Routes ===============

/**
 * POST /api/v11/court/cases
 * 提交普通宪法审查案件
 */
router.post('/cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SubmitCaseSchema.parse(req.body);
    const userId = (req as any).user?.userId || 'anonymous';

    const courtCase = courtService.submitCase(
      userId,
      validated.amendmentId,
      validated.reason,
      validated.evidenceHash
    );

    logger.info('Court case submitted', { caseId: courtCase.caseId, filer: userId });

    res.status(201).json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v11/court/cases/emergency
 * 提交紧急宪法审查案件
 */
router.post('/cases/emergency', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SubmitCaseSchema.parse(req.body);
    const userId = (req as any).user?.userId || 'anonymous';

    const courtCase = courtService.submitEmergencyCase(
      userId,
      validated.amendmentId,
      validated.reason,
      validated.evidenceHash
    );

    logger.info('Emergency court case submitted', { caseId: courtCase.caseId, filer: userId });

    res.status(201).json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v11/court/cases/:id/approve
 * 批准紧急案件
 */
router.put('/cases/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid case ID' });
      return;
    }

    const courtCase = courtService.approveEmergency(caseId);

    logger.info('Emergency case approved', { caseId });

    res.json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v11/court/cases/:id/vote
 * 对案件投票
 */
router.post('/cases/:id/vote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid case ID' });
      return;
    }

    const validated = VoteSchema.parse(req.body);
    const userId = (req as any).user?.userId || 'anonymous';

    const courtCase = courtService.voteOnCase(
      caseId,
      userId,
      validated.support,
      validated.votingPower
    );

    logger.info('Vote cast on court case', { caseId, voter: userId, support: validated.support });

    res.json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v11/court/cases/:id/judgment
 * 判决案件
 */
router.post('/cases/:id/judgment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid case ID' });
      return;
    }

    const courtCase = courtService.renderJudgment(caseId);

    logger.info('Judgment rendered', { caseId, judgment: courtCase.judgment });

    res.json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v11/court/cases
 * 列出案件
 */
router.get('/cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = req.query.state as string | undefined;
    const limit = parseInt(req.query.limit as string || '100', 10);

    const cases = courtService.listCases({
      state: state as any,
      limit,
    });

    res.json({
      code: 0,
      data: { cases, count: cases.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v11/court/cases/:id
 * 获取案件详情
 */
router.get('/cases/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid case ID' });
      return;
    }

    const courtCase = courtService.getCase(caseId);
    if (!courtCase) {
      res.status(404).json({ code: 1004, message: 'Case not found' });
      return;
    }

    res.json({
      code: 0,
      data: courtCase,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
