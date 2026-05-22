/**
 * Metabolism Routes - V10.0 新陈代谢路由
 */

import { Router, Request, Response } from 'express';
import { get_instance } from '../services/metabolismService';

const router = Router();
const metabolismService = get_instance();

// =============== Metabolism Routes ===============

/**
 * GET /api/v1/metabolism/:agent
 * 获取Agent新陈代谢状态
 */
router.get('/:agent', (req: Request, res: Response) => {
  const state = metabolismService.getMetabolismState(req.params.agent);
  if (!state) {
    res.json({ code: 0, data: { message: 'Agent not initialized, use update to initialize' }, version: '10.0.0' });
    return;
  }
  res.json({ code: 0, data: state, version: '10.0.0' });
});

/**
 * POST /api/v1/metabolism/:agent/update
 * 更新Agent新陈代谢状态
 */
router.post('/:agent/update', (req: Request, res: Response) => {
  const { activity } = req.body;
  if (activity === undefined) {
    res.status(400).json({ code: 1, message: 'activity is required (0-10000)' });
    return;
  }
  try {
    const state = metabolismService.updateMetabolism(req.params.agent, Number(activity));
    res.json({ code: 0, data: state, version: '10.0.0' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/metabolism/:agent/hibernate
 * 进入冬眠
 */
router.post('/:agent/hibernate', (req: Request, res: Response) => {
  try {
    const state = metabolismService.enterHibernation(req.params.agent);
    res.json({ code: 0, data: state, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/metabolism/:agent/wake
 * 退出冬眠
 */
router.post('/:agent/wake', (req: Request, res: Response) => {
  try {
    const state = metabolismService.exitHibernation(req.params.agent);
    res.json({ code: 0, data: state, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/metabolism/:agent/regenerate
 * 再生恢复代谢率
 */
router.post('/:agent/regenerate', (req: Request, res: Response) => {
  const { amount } = req.body;
  if (amount === undefined) {
    res.status(400).json({ code: 1, message: 'amount is required (0-10000)' });
    return;
  }
  try {
    const state = metabolismService.regenerate(req.params.agent, Number(amount));
    res.json({ code: 0, data: state, version: '10.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/metabolism/:agent/rate
 * 计算Agent当前代谢率
 */
router.get('/:agent/rate', (req: Request, res: Response) => {
  const rate = metabolismService.calculateMetabolicRate(req.params.agent);
  res.json({ code: 0, data: { agent: req.params.agent, effectiveMetabolicRate: rate }, version: '10.0.0' });
});

export default router;
