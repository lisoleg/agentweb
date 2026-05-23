/**
 * Wakeup Routes - V11.0 冬眠唤醒路由
 *
 * POST /api/v11/wakeup/scan       — 触发扫描（手动）
 * GET  /api/v11/wakeup/status     — 获取调度器状态
 * GET  /api/v11/wakeup/last-scan  — 获取上次扫描结果
 * POST /api/v11/wakeup/check/:agent — 检查单个Agent唤醒条件
 * PUT  /api/v11/wakeup/params     — 更新唤醒参数
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { getWakeupScheduler } from '../services/wakeupScheduler';

const router = Router();
const wakeupScheduler = getWakeupScheduler();

// =============== Validation Schemas ===============

const WakeParamsSchema = z.object({
  wakePhiThreshold: z.number().int().min(0).max(10000).optional(),
  wakeTimeoutDays: z.number().int().min(1).max(365).optional(),
  wakeVotingWeightBps: z.number().int().min(0).max(10000).optional(),
});

// =============== Routes ===============

/**
 * POST /api/v11/wakeup/scan
 * 手动触发唤醒扫描
 */
router.post('/scan', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await wakeupScheduler.manualScan();
    res.json({ code: 0, data: result, message: 'Scan completed' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/wakeup/status
 * 获取调度器状态
 */
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = wakeupScheduler.getStatus();
    res.json({ code: 0, data: status });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/wakeup/last-scan
 * 获取上次扫描结果
 */
router.get('/last-scan', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = wakeupScheduler.getLastScanResult();
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v11/wakeup/check/:agent
 * 检查单个Agent唤醒条件
 */
router.post('/check/:agent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = req.params.agent;
    const result = await wakeupScheduler.checkAgent(agent);
    res.json({ code: 0, data: result });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PUT /api/v11/wakeup/params
 * 更新唤醒参数
 */
router.put('/params', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = WakeParamsSchema.parse(req.body);
    const result = wakeupScheduler.updateParams(validated);
    res.json({ code: 0, data: result, message: 'Wakeup params updated' });
  } catch (err: any) {
    next(err);
  }
});

export default router;
