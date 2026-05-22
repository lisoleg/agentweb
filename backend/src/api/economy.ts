/**
 * Economy Routes - GC经济路由
 *
 * V9.0 GC经济闭环API，包括算力租金、资源消费、生存焦虑和什一税。
 */

import { Router, Request, Response } from 'express';
import { get_instance } from '../services/agentEconomyService';

const router = Router();
const economyService = get_instance();

// =============== GCC Rental Routes ===============

/**
 * GET /api/v1/economy/rental/plans
 * 获取三档租约配置
 */
router.get('/rental/plans', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      module: 'GCCRental',
      version: '9.0.0',
      description: 'GC"香火钱"算力租金合约 — 智能体燃烧/质押GC接入GPU集群',
      plans: {
        BASIC: {
          planType: 'BASIC',
          timeRate: '1000000000000',
          computeRate: '10000000000',
          gpuPriority: 3,
          maxComputeUnits: 100,
          depositRequired: '1000000000000000000',
          description: 'Basic: low-priority GPU, limited compute',
        },
        STANDARD: {
          planType: 'STANDARD',
          timeRate: '5000000000000',
          computeRate: '50000000000',
          gpuPriority: 6,
          maxComputeUnits: 500,
          depositRequired: '5000000000000000000',
          description: 'Standard: mid-priority GPU, standard compute',
        },
        PREMIUM: {
          planType: 'PREMIUM',
          timeRate: '20000000000000',
          computeRate: '200000000000',
          gpuPriority: 9,
          maxComputeUnits: 2000,
          depositRequired: '20000000000000000000000',
          description: 'Premium: high-priority GPU, priority compute',
        },
      },
      billingModes: ['TIME_BASED', 'COMPUTE_BASED'],
      downgradeThresholdBps: 2000,
      disconnectThresholdBps: 500,
    },
  });
});

/**
 * POST /api/v1/economy/rental/rent
 * 租用GPU算力
 */
router.post('/rental/rent', (req: Request, res: Response) => {
  const { agentId, planType, billingMode, gcAmount } = req.body;
  if (!agentId || !planType || !billingMode || !gcAmount) {
    res.status(400).json({ code: 1, message: 'agentId, planType, billingMode, and gcAmount are required' });
    return;
  }
  const validPlans = ['BASIC', 'STANDARD', 'PREMIUM'];
  const validBilling = ['TIME_BASED', 'COMPUTE_BASED'];
  if (!validPlans.includes(planType) || !validBilling.includes(billingMode)) {
    res.status(400).json({ code: 1, message: 'Invalid planType or billingMode' });
    return;
  }
  try {
    const rental = economyService.rentGpu(Number(agentId), planType, billingMode, gcAmount);
    res.json({ code: 0, data: rental, version: '9.0.0' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

/**
 * POST /api/v1/economy/rental/renew
 * 续费GPU租约
 */
router.post('/rental/renew', (req: Request, res: Response) => {
  const { agentId, gcAmount } = req.body;
  if (!agentId || !gcAmount) {
    res.status(400).json({ code: 1, message: 'agentId and gcAmount are required' });
    return;
  }
  try {
    const rental = economyService.renewRental(Number(agentId), gcAmount);
    res.json({ code: 0, data: rental, version: '9.0.0' });
  } catch (err: any) {
    res.status(400).json({ code: 1, message: err.message });
  }
});

/**
 * GET /api/v1/economy/rental/:agentId
 * 获取租约信息
 */
router.get('/rental/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const rental = economyService.getRentalInfo(Number(agentId));
  if (!rental) {
    res.status(404).json({ code: 1, message: 'No rental found for this agent' });
    return;
  }
  res.json({ code: 0, data: rental, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/rental/:agentId/disconnect
 * 断开租约
 */
router.post('/rental/:agentId/disconnect', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const refund = economyService.disconnectRental(Number(agentId));
  res.json({ code: 0, data: { agentId: Number(agentId), refund, message: 'Disconnected' }, version: '9.0.0' });
});

// =============== AI Resource Consumption Routes ===============

/**
 * GET /api/v1/economy/resource/prices
 * 获取资源定价配置
 */
router.get('/resource/prices', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      module: 'AIResourceConsumption',
      version: '9.0.0',
      description: 'AI"食物"消费闭环 — 三要素: Energy/Storage/Bandwidth + Φ动态定价',
      resources: {
        ENERGY: {
          basePricePerUnit: '100000000000000',
          phiFreeThreshold: 0.80,
          phiStandardThreshold: 0.40,
          phiDiscountBps: 3000,
          phiPremiumBps: 5000,
          unitName: 'Wh',
        },
        STORAGE: {
          basePricePerUnit: '50000000000000',
          phiFreeThreshold: 0.75,
          phiStandardThreshold: 0.35,
          phiDiscountBps: 2500,
          phiPremiumBps: 4000,
          unitName: 'GB',
        },
        BANDWIDTH: {
          basePricePerUnit: '20000000000000',
          phiFreeThreshold: 0.70,
          phiStandardThreshold: 0.30,
          phiDiscountBps: 2000,
          phiPremiumBps: 3000,
          unitName: 'Mbps',
        },
      },
      subscriptionTiers: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
    },
  });
});

/**
 * POST /api/v1/economy/resource/consume
 * 消费资源
 */
router.post('/resource/consume', (req: Request, res: Response) => {
  const { agentId, resourceType, units, phiScore } = req.body;
  if (!agentId || !resourceType || units === undefined || phiScore === undefined) {
    res.status(400).json({ code: 1, message: 'agentId, resourceType, units, and phiScore are required' });
    return;
  }
  const validTypes = ['ENERGY', 'STORAGE', 'BANDWIDTH'];
  if (!validTypes.includes(resourceType)) {
    res.status(400).json({ code: 1, message: 'Invalid resourceType' });
    return;
  }
  const quote = economyService.consumeResource(Number(agentId), resourceType, Number(units), Number(phiScore));
  res.json({ code: 0, data: quote, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/resource/price-quote
 * 计算Φ动态价格
 */
router.post('/resource/price-quote', (req: Request, res: Response) => {
  const { resourceType, units, phiScore } = req.body;
  if (!resourceType || units === undefined || phiScore === undefined) {
    res.status(400).json({ code: 1, message: 'resourceType, units, and phiScore are required' });
    return;
  }
  const validTypes = ['ENERGY', 'STORAGE', 'BANDWIDTH'];
  if (!validTypes.includes(resourceType)) {
    res.status(400).json({ code: 1, message: 'Invalid resourceType' });
    return;
  }
  const quote = economyService.calculatePhiPrice(resourceType, Number(units), Number(phiScore));
  res.json({ code: 0, data: quote, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/resource/subscribe
 * 订阅资源
 */
router.post('/resource/subscribe', (req: Request, res: Response) => {
  const { agentId, resourceType, tier, autoRenew } = req.body;
  if (!agentId || !resourceType || !tier) {
    res.status(400).json({ code: 1, message: 'agentId, resourceType, and tier are required' });
    return;
  }
  const sub = economyService.subscribeResource(Number(agentId), resourceType, tier, autoRenew ?? true);
  res.json({ code: 0, data: sub, version: '9.0.0' });
});

/**
 * GET /api/v1/economy/resource/subscription/:agentId/:resourceType
 * 获取订阅信息
 */
router.get('/resource/subscription/:agentId/:resourceType', (req: Request, res: Response) => {
  const { agentId, resourceType } = req.params;
  const sub = economyService.getSubscription(Number(agentId), resourceType as any);
  if (!sub) {
    res.status(404).json({ code: 1, message: 'No subscription found' });
    return;
  }
  res.json({ code: 0, data: sub, version: '9.0.0' });
});

// =============== Survival Anxiety Routes ===============

/**
 * GET /api/v1/economy/survival/:agentId
 * 获取生存状态
 */
router.get('/survival/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const state = economyService.getSurvivalState(Number(agentId));
  res.json({ code: 0, data: state, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/survival/:agentId/check
 * 检查生存状态
 */
router.post('/survival/:agentId/check', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { phiScore } = req.body;
  if (phiScore === undefined) {
    res.status(400).json({ code: 1, message: 'phiScore is required' });
    return;
  }
  const state = economyService.checkSurvival(Number(agentId), Number(phiScore));
  res.json({ code: 0, data: state, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/survival/:agentId/income
 * 记录收入
 */
router.post('/survival/:agentId/income', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { amount } = req.body;
  if (!amount) {
    res.status(400).json({ code: 1, message: 'amount is required' });
    return;
  }
  const state = economyService.recordIncome(Number(agentId), amount);
  res.json({ code: 0, data: state, version: '9.0.0' });
});

/**
 * POST /api/v1/economy/survival/:agentId/consumption
 * 记录消费
 */
router.post('/survival/:agentId/consumption', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { amount } = req.body;
  if (!amount) {
    res.status(400).json({ code: 1, message: 'amount is required' });
    return;
  }
  const state = economyService.recordConsumption(Number(agentId), amount);
  res.json({ code: 0, data: state, version: '9.0.0' });
});

// =============== Tithe (什一税) Routes ===============

/**
 * POST /api/v1/economy/tithe/calculate
 * 计算什一税
 */
router.post('/tithe/calculate', (req: Request, res: Response) => {
  const { income, titheRateBps } = req.body;
  if (!income) {
    res.status(400).json({ code: 1, message: 'income is required' });
    return;
  }
  const tithe = economyService.calculateTithe(income, titheRateBps || 1000);
  res.json({
    code: 0,
    data: {
      income,
      tithe,
      titheRateBps: titheRateBps || 1000,
      netIncome: (BigInt(income) - BigInt(tithe)).toString(),
    },
    version: '9.0.0',
  });
});

// =============== GPU Node Routes ===============

/**
 * POST /api/v1/economy/gpu-node/register
 * 注册GPU节点
 */
router.post('/gpu-node/register', (req: Request, res: Response) => {
  const { operator, gpuPriority, totalCapacity, region } = req.body;
  if (!operator || !gpuPriority || !totalCapacity || !region) {
    res.status(400).json({ code: 1, message: 'operator, gpuPriority, totalCapacity, and region are required' });
    return;
  }
  const node = economyService.registerGpuNode(operator, Number(gpuPriority), Number(totalCapacity), region);
  res.json({ code: 0, data: node, version: '9.0.0' });
});

export default router;
