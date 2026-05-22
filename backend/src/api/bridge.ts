/**
 * Bridge Routes
 * 跨链桥接协议路由
 *
 * POST /api/v1/bridge/lock — 发起锁定
 * POST /api/v1/bridge/mint — 目标链铸造
 * POST /api/v1/bridge/burn — 源链销毁
 * POST /api/v1/bridge/unlock — 目标链解锁
 * POST /api/v1/bridge/sign — 验证者签名
 * POST /api/v1/bridge/refund — 超时退款
 * GET /api/v1/bridge/status/:requestId — 查询桥接状态
 * GET /api/v1/bridge/chains — 支持的链列表
 * GET /api/v1/bridge/validators — 验证者列表
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { crossChainBridgeService } from '../services/crossChainBridgeService';

const router = Router();

// =============== Validation Schemas ===============

const LockSchema = z.object({
  targetChainId: z.number().positive(),
  token: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.number().positive(),
});

const MintSchema = z.object({
  requestId: z.string().min(1),
});

const BurnSchema = z.object({
  targetChainId: z.number().positive(),
  token: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.number().positive(),
});

const UnlockSchema = z.object({
  requestId: z.string().min(1),
});

const SignSchema = z.object({
  requestId: z.string().min(1),
});

const RefundSchema = z.object({
  requestId: z.string().min(1),
});

// =============== Routes ===============

/**
 * POST /api/v1/bridge/lock
 * 发起锁定（Lock-Mint模式）
 */
router.post('/lock', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = LockSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const bridgeRequest = await crossChainBridgeService.lock({
      targetChainId: validated.targetChainId,
      token: validated.token,
      sender: userId,
      recipient: validated.recipient,
      amount: validated.amount,
    });

    logger.info('Bridge lock initiated', { requestId: bridgeRequest.requestId, sender: userId });

    res.status(201).json({
      code: 0,
      data: bridgeRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/bridge/mint
 * 目标链铸造
 */
router.post('/mint', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = MintSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const bridgeRequest = await crossChainBridgeService.mint(validated.requestId);

    logger.info('Bridge mint completed', { requestId: validated.requestId });

    res.json({
      code: 0,
      data: bridgeRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/bridge/burn
 * 源链销毁（Burn-Unlock模式）
 */
router.post('/burn', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = BurnSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const bridgeRequest = await crossChainBridgeService.burn({
      targetChainId: validated.targetChainId,
      token: validated.token,
      sender: userId,
      recipient: validated.recipient,
      amount: validated.amount,
    });

    logger.info('Bridge burn initiated', { requestId: bridgeRequest.requestId, sender: userId });

    res.status(201).json({
      code: 0,
      data: bridgeRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/bridge/unlock
 * 目标链解锁
 */
router.post('/unlock', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UnlockSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const bridgeRequest = await crossChainBridgeService.unlock(validated.requestId);

    logger.info('Bridge unlock completed', { requestId: validated.requestId });

    res.json({
      code: 0,
      data: bridgeRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/bridge/sign
 * 验证者签名
 */
router.post('/sign', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SignSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    crossChainBridgeService.signRequest(validated.requestId, userId);

    const isConfirmed = crossChainBridgeService.isBridgeConfirmed(validated.requestId);

    logger.info('Bridge signature added', { requestId: validated.requestId, validator: userId, confirmed: isConfirmed });

    res.json({
      code: 0,
      data: { confirmed: isConfirmed },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/bridge/refund
 * 超时退款
 */
router.post('/refund', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = RefundSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const bridgeRequest = crossChainBridgeService.refund(validated.requestId, userId);

    logger.info('Bridge refund processed', { requestId: validated.requestId, requester: userId });

    res.json({
      code: 0,
      data: bridgeRequest,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/bridge/status/:requestId
 * 查询桥接状态
 */
router.get('/status/:requestId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const bridgeRequest = crossChainBridgeService.getBridgeRequest(requestId);

    if (!bridgeRequest) {
      res.status(404).json({ code: 1004, message: 'Bridge request not found' });
      return;
    }

    const isConfirmed = crossChainBridgeService.isBridgeConfirmed(requestId);

    res.json({
      code: 0,
      data: {
        ...bridgeRequest,
        isConfirmed,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/bridge/chains
 * 支持的链列表
 */
router.get('/chains', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const chains = crossChainBridgeService.getSupportedChains();

    res.json({
      code: 0,
      data: { chains, count: chains.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/bridge/validators
 * 验证者列表
 */
router.get('/validators', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const validators = crossChainBridgeService.getActiveValidators();
    const totalPhiWeight = crossChainBridgeService.getTotalPhiWeight();

    res.json({
      code: 0,
      data: {
        validators,
        count: validators.length,
        totalPhiWeight,
        signatureThreshold: '2/3',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
