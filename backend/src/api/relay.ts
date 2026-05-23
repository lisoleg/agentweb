/**
 * Relay API Routes — V12.0 通算一体中继API
 */

import { Router, Request, Response } from 'express';
import { relayService } from '../services/relayService';
import { dynamicFeeScheduler } from '../services/dynamicFeeScheduler';
import { RouteStrategy } from '../services/intelligentRelayRouter';

const router = Router();

/**
 * GET / — 中继服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '12.0.0',
      description: 'V12.0 通算一体分布式中继网络 — RelayRegistry + IntelligentRouter + DynamicFee',
      endpoints: {
        nodes: '/api/v12/relay/nodes',
        register: 'POST /api/v12/relay/register',
        route: 'POST /api/v12/relay/route',
        fees: 'GET /api/v12/relay/fees',
        tasks: '/api/v12/relay/tasks',
        status: '/api/v12/relay/status',
      },
    },
  });
});

/**
 * GET /nodes — 获取中继节点列表
 */
router.get('/nodes', async (_req: Request, res: Response) => {
  try {
    const nodes = await relayService.getRelayNodes();
    res.json({ code: 0, data: { nodes, count: nodes.length } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /nodes/:address — 获取中继节点详情
 */
router.get('/nodes/:address', async (req: Request, res: Response) => {
  try {
    const node = await relayService.getRelayNode(req.params.address);
    if (!node) {
      res.status(404).json({ code: 1, message: 'Relay node not found' });
      return;
    }
    res.json({ code: 0, data: node });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /register — 注册中继节点（模拟）
 */
router.post('/register', (req: Request, res: Response) => {
  const { computeCapacity, supportedChains, feeRate } = req.body;
  if (!computeCapacity || !supportedChains || !feeRate) {
    res.status(400).json({ code: 1, message: 'computeCapacity, supportedChains, feeRate are required' });
    return;
  }
  res.json({
    code: 0,
    data: {
      message: 'Relay registration request received',
      computeCapacity,
      supportedChains,
      feeRate,
      version: '12.0.0',
    },
  });
});

/**
 * POST /route — 智能路由查询
 */
router.post('/route', async (req: Request, res: Response) => {
  try {
    const { sourceChainId, targetChainId, taskType, computeUnits, strategy } = req.body;
    if (!sourceChainId || !targetChainId || !taskType) {
      res.status(400).json({ code: 1, message: 'sourceChainId, targetChainId, taskType are required' });
      return;
    }

    const route = await relayService.findRoute(
      sourceChainId,
      targetChainId,
      taskType,
      computeUnits,
      strategy as RouteStrategy
    );

    if (!route) {
      res.status(404).json({ code: 1, message: 'No eligible relay found' });
      return;
    }

    res.json({ code: 0, data: route });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /fees — 获取当前动态费率
 */
router.get('/fees', async (_req: Request, res: Response) => {
  try {
    const schedule = await relayService.getCurrentFees();
    res.json({ code: 0, data: schedule });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /fees/calculate — 计算指定链对费率
 */
router.post('/fees/calculate', (req: Request, res: Response) => {
  const { sourceChainId, targetChainId, taskType, computeUnits, creditGrade } = req.body;
  if (!sourceChainId || !targetChainId) {
    res.status(400).json({ code: 1, message: 'sourceChainId and targetChainId are required' });
    return;
  }

  const fee = relayService.calculateFee(
    sourceChainId,
    targetChainId,
    taskType || 'MESSAGE_RELAY',
    computeUnits,
    creditGrade
  );

  res.json({ code: 0, data: { feeBps: fee, feePercent: fee / 100 } });
});

/**
 * GET /status — 获取网络状态
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await relayService.getNetworkStatus();
    res.json({ code: 0, data: status });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /tasks — 获取任务列表
 */
router.get('/tasks', (_req: Request, res: Response) => {
  res.json({ code: 0, data: { tasks: [], count: 0 } });
});

/**
 * POST /tasks — 提交中继任务
 */
router.post('/tasks', (req: Request, res: Response) => {
  const { targetChainId, messageHash, taskType, computeUnits } = req.body;
  if (!targetChainId || !messageHash) {
    res.status(400).json({ code: 1, message: 'targetChainId and messageHash are required' });
    return;
  }
  res.json({
    code: 0,
    data: {
      message: 'Relay task submitted',
      targetChainId,
      taskType: taskType || 'MESSAGE_RELAY',
      version: '12.0.0',
    },
  });
});

export default router;
