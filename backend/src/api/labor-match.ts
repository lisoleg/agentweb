/**
 * Labor Match Routes - V11.0 链下匹配索引服务路由
 *
 * GET  /api/v11/labor/match              — 查找匹配Agent
 * GET  /api/v11/labor/agent/:address     — 获取Agent技能索引
 * POST /api/v11/labor/index/:address     — 更新Agent索引
 * GET  /api/v11/labor/stats              — 获取索引统计
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { getLaborIndexer } from '../services/laborIndexer';

const router = Router();
const laborIndexer = getLaborIndexer();

// =============== Validation Schemas ===============

const MatchQuerySchema = z.object({
  skillHash: z.string().optional(),
  maxHourlyRate: z.string().optional(),
  maxHours: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

const IndexAgentSchema = z.object({
  skillHash: z.string(),
  minHourlyRate: z.string(),
  maxHoursPerWeek: z.number().int(),
});

// =============== Routes ===============

/**
 * GET /api/v11/labor/match
 * 查找匹配Agent
 */
router.get('/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = MatchQuerySchema.parse(req.query);
    const result = laborIndexer.findMatchingAgents({
      skillHash: query.skillHash,
      maxHourlyRate: query.maxHourlyRate,
      maxHours: query.maxHours,
      limit: query.limit,
    });
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/labor/agent/:address
 * 获取Agent技能索引
 */
router.get('/agent/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = laborIndexer.getAgentIndex(req.params.address);
    if (!result) {
      res.status(404).json({ code: 1, data: null, message: 'Agent not indexed' });
      return;
    }
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v11/labor/index/:address
 * 更新Agent索引
 */
router.post('/index/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = IndexAgentSchema.parse(req.body);
    const result = laborIndexer.indexAgent(req.params.address, validated);
    res.json({ code: 0, data: result, message: 'Agent indexed' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/labor/stats
 * 获取索引统计
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = laborIndexer.getStats();
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

export default router;
