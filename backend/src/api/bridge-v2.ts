/**
 * Bridge V2 Routes - V11.0 跨链桥接V2路由
 *
 * POST   /api/v11/bridge-v2/lock            — 锁定资产（携带Passport）
 * POST   /api/v11/bridge-v2/mint            — 铸造（目标链）
 * PUT    /api/v11/bridge-v2/migrate/:id     — 标记迁徙完成
 * GET    /api/v11/bridge-v2/request/:id     — 查询迁徙请求
 * GET    /api/v11/bridge-v2/decay           — 查询Φ衰减计算
 * PUT    /api/v11/bridge-v2/decay-rate      — 设置衰减率
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

const router = Router();

// =============== Validation Schemas ===============

const LockSchema = z.object({
  targetChainId: z.number().positive(),
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().min(1),
  passportData: z.object({
    phiValue: z.number().int().min(0).max(10000),
    creditScore: z.number().int().min(0).max(10000),
    caseMerkleRoot: z.string(),
    lostCaseCount: z.number().int().min(0),
  }),
});

const MintSchema = z.object({
  requestId: z.string(),
  agent: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  sourceChainId: z.number().positive(),
  amount: z.string().min(1),
  passportData: z.object({
    phiValue: z.number().int().min(0).max(10000),
    creditScore: z.number().int().min(0).max(10000),
    caseMerkleRoot: z.string(),
    lostCaseCount: z.number().int().min(0),
  }),
});

const DecayRateSchema = z.object({
  decayRate: z.number().int().min(0).max(10000),
});

// =============== Simulated Storage ===============

interface BridgeRequest {
  requestId: string;
  agent: string;
  sourceChainId: number;
  targetChainId: number;
  amount: string;
  passportData: {
    phiValue: number;
    creditScore: number;
    caseMerkleRoot: string;
    lostCaseCount: number;
  };
  decayedPhi: number;
  state: string;
  createdAt: number;
}

const requests: Map<string, BridgeRequest> = new Map();
let currentDecayRate = 9500; // 0.95 default

// =============== Routes ===============

/**
 * POST /api/v11/bridge-v2/lock
 * 锁定资产
 */
router.post('/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = LockSchema.parse(req.body);
    const userId = (req as any).user?.userId || 'anonymous';

    const requestId = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

    const bridgeRequest: BridgeRequest = {
      requestId,
      agent: userId,
      sourceChainId: 1,
      targetChainId: validated.targetChainId,
      amount: validated.amount,
      passportData: validated.passportData,
      decayedPhi: 0,
      state: 'LOCKED',
      createdAt: Date.now(),
    };

    requests.set(requestId, bridgeRequest);
    logger.info(`[BridgeV2] Locked: ${requestId} agent=${userId} target=${validated.targetChainId}`);

    res.status(201).json({ code: 0, data: bridgeRequest, message: 'Assets locked with passport' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /api/v11/bridge-v2/mint
 * 铸造（目标链）
 */
router.post('/mint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = MintSchema.parse(req.body);
    const request = requests.get(validated.requestId);

    if (!request) {
      res.status(404).json({ code: 1, data: null, message: 'Request not found' });
      return;
    }

    // Calculate decayed Phi
    const decayedPhi = Math.floor(validated.passportData.phiValue * currentDecayRate / 10000);
    request.decayedPhi = decayedPhi;
    request.state = 'MINTED';

    logger.info(`[BridgeV2] Minted: ${validated.requestId} decayedPhi=${decayedPhi}`);
    res.json({ code: 0, data: request, message: 'Minted with Phi decay' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PUT /api/v11/bridge-v2/migrate/:id
 * 标记迁徙完成
 */
router.put('/migrate/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = requests.get(req.params.id);
    if (!request) {
      res.status(404).json({ code: 1, data: null, message: 'Request not found' });
      return;
    }
    request.state = 'MIGRATED';
    res.json({ code: 0, data: request, message: 'Migration completed' });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/bridge-v2/request/:id
 * 查询迁徙请求
 */
router.get('/request/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = requests.get(req.params.id);
    if (!request) {
      res.status(404).json({ code: 1, data: null, message: 'Request not found' });
      return;
    }
    res.json({ code: 0, data: request });
  } catch (err: any) {
    next(err);
  }
});

/**
 * GET /api/v11/bridge-v2/decay?phiValue=8000
 * 计算Φ衰减
 */
router.get('/decay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phiValue = parseInt(req.query.phiValue as string) || 0;
    const decayedPhi = Math.floor(phiValue * currentDecayRate / 10000);
    res.json({ code: 0, data: { phiValue, decayedPhi, decayRate: currentDecayRate } });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PUT /api/v11/bridge-v2/decay-rate
 * 设置衰减率
 */
router.put('/decay-rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = DecayRateSchema.parse(req.body);
    const oldRate = currentDecayRate;
    currentDecayRate = validated.decayRate;
    logger.info(`[BridgeV2] DecayRate updated: ${oldRate} → ${currentDecayRate}`);
    res.json({ code: 0, data: { oldRate, newRate: currentDecayRate }, message: 'Decay rate updated' });
  } catch (err: any) {
    next(err);
  }
});

export default router;
