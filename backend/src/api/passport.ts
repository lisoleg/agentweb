/**
 * Passport Routes - V11.0 Agent通行证路由
 *
 * POST   /api/v11/passport/issue           — 签发通行证
 * PUT    /api/v11/passport/:agent/phi       — 更新Φ值
 * POST   /api/v11/passport/:agent/lost-case — 增加败诉案件
 * PUT    /api/v11/passport/:agent/merkle    — 更新Merkle根
 * DELETE /api/v11/passport/:agent           — 撤销通行证
 * GET    /api/v11/passport/:agent           — 获取通行证信息
 * GET    /api/v11/passport                  — 列出所有通行证
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { getPassportService } from '../services/passportService';

const router = Router();
const passportService = getPassportService();

// =============== Validation Schemas ===============

const IssuePassportSchema = z.object({
  agent: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  phiValue: z.number().int().min(0).max(10000),
});

const UpdatePhiSchema = z.object({
  phiValue: z.number().int().min(0).max(10000),
});

const UpdateMerkleSchema = z.object({
  caseMerkleRoot: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

// =============== Routes ===============

/**
 * POST /api/v11/passport/issue
 * 签发通行证
 */
router.post('/issue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = IssuePassportSchema.parse(req.body);
    const result = passportService.issuePassport(validated.agent, validated.phiValue);
    res.status(201).json({ code: 0, data: result, message: 'Passport issued' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PUT /api/v11/passport/:agent/phi
 * 更新Φ值
 */
router.put('/:agent/phi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdatePhiSchema.parse(req.body);
    const result = passportService.updatePhiValue(req.params.agent, validated.phiValue);
    res.json({ code: 0, data: result, message: 'Phi value updated' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v11/passport/:agent/lost-case
 * 增加败诉案件
 */
router.post('/:agent/lost-case', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = passportService.incrementLostCases(req.params.agent);
    res.json({ code: 0, data: result, message: 'Lost case incremented' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PUT /api/v11/passport/:agent/merkle
 * 更新Merkle根
 */
router.put('/:agent/merkle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateMerkleSchema.parse(req.body);
    const result = passportService.updateCaseMerkleRoot(req.params.agent, validated.caseMerkleRoot);
    res.json({ code: 0, data: result, message: 'Merkle root updated' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * DELETE /api/v11/passport/:agent
 * 撤销通行证
 */
router.delete('/:agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = passportService.revokePassport(req.params.agent);
    res.json({ code: 0, data: result, message: 'Passport revoked' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/passport/:agent
 * 获取通行证信息
 */
router.get('/:agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = passportService.getPassport(req.params.agent);
    if (!result) {
      res.status(404).json({ code: 1, data: null, message: 'Passport not found' });
      return;
    }
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/passport
 * 列出所有通行证
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = passportService.listPassports();
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

export default router;
