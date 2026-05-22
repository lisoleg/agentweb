/**
 * Oracle Routes
 * 太乙预言机路由
 *
 * POST /api/v1/oracle/register — 注册预言机
 * POST /api/v1/oracle/submit — 提交预言
 * POST /api/v1/oracle/settle — 结算预言
 * GET /api/v1/oracle/prediction/:topicId — 查询预测
 * GET /api/v1/oracle/phi-evolution/:topicId — Φ值演化轨迹
 * GET /api/v1/oracle/oracles — 预言师列表
 * GET /api/v1/oracle/topics — 预测主题列表
 * GET /api/v1/oracle/params — 引擎参数
 * PUT /api/v1/oracle/params — 设置引擎参数
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { taiyiOracleService, PredictionType } from '../services/taiyiOracleService';

const router = Router();

// =============== Validation Schemas ===============

const RegisterOracleSchema = z.object({
  initialPhiValue: z.number().min(0.01).max(1),
});

const CreateTopicSchema = z.object({
  description: z.string().min(1).max(2000),
  predictionType: z.enum(['Fermion', 'Boson']),
  deadlineDays: z.number().min(1).max(365),
});

const SubmitPredictionSchema = z.object({
  topicId: z.string().min(1),
  predictedValue: z.number(),
  confidence: z.number().min(0.01).max(1),
});

const SettleSchema = z.object({
  topicId: z.string().min(1),
  actualValue: z.number(),
});

const SetParamsSchema = z.object({
  alpha: z.number().min(0).max(1),
  beta: z.number().min(0).max(1),
  gamma: z.number().min(0).max(1),
});

// =============== Routes ===============

/**
 * POST /api/v1/oracle/register
 * 注册预言机节点
 */
router.post('/register', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = RegisterOracleSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const oracle = taiyiOracleService.registerOracle(userId, validated.initialPhiValue);

    logger.info('Oracle registered', { oracle: userId, phiValue: validated.initialPhiValue });

    res.status(201).json({
      code: 0,
      data: oracle,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/oracle/submit
 * 提交预言
 */
router.post('/submit', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SubmitPredictionSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const prediction = taiyiOracleService.submitPrediction({
      topicId: validated.topicId,
      predictor: userId,
      predictedValue: validated.predictedValue,
      confidence: validated.confidence,
    });

    logger.info('Prediction submitted', { predictionId: prediction.predictionId, predictor: userId });

    res.status(201).json({
      code: 0,
      data: prediction,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/oracle/settle
 * 结算预言
 */
router.post('/settle', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SettleSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const result = taiyiOracleService.settlePrediction({
      topicId: validated.topicId,
      actualValue: validated.actualValue,
    });

    logger.info('Prediction settled', { topicId: validated.topicId, result: result.result });

    res.json({
      code: 0,
      data: {
        topic: result.topic,
        result: result.result,
        phiUpdates: result.phiUpdates,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/oracle/prediction/:topicId
 * 查询预测主题及所有预测
 */
router.get('/prediction/:topicId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topicId } = req.params;
    const topic = taiyiOracleService.getTopic(topicId);

    if (!topic) {
      res.status(404).json({ code: 1004, message: 'Topic not found' });
      return;
    }

    const predictions = taiyiOracleService.getPredictions(topicId);

    res.json({
      code: 0,
      data: {
        topic,
        predictions,
        predictionCount: predictions.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/oracle/phi-evolution/:topicId
 * Φ值演化轨迹
 */
router.get('/phi-evolution/:topicId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topicId } = req.params;
    const evolution = taiyiOracleService.getPhiEvolution(topicId);

    res.json({
      code: 0,
      data: {
        topicId,
        evolution,
        recordCount: evolution.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/oracle/oracles
 * 预言师列表
 */
router.get('/oracles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const oracles = taiyiOracleService.getActiveOracles();

    res.json({
      code: 0,
      data: {
        oracles,
        count: oracles.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/oracle/topics
 * 预测主题列表
 */
router.get('/topics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 简化实现：返回空列表（实际需要遍历topics Map）
    res.json({
      code: 0,
      data: {
        topics: [],
        count: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/oracle/params
 * 引擎参数
 */
router.get('/params', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const params = taiyiOracleService.getEngineParams();

    res.json({
      code: 0,
      data: params,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/oracle/params
 * 设置引擎参数
 */
router.put('/params', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = SetParamsSchema.parse(req.body);

    const sum = validated.alpha + validated.beta + validated.gamma;
    if (Math.abs(sum - 1.0) > 0.01) {
      res.status(400).json({ code: 1001, message: 'Parameters must sum to 1.0' });
      return;
    }

    taiyiOracleService.setEngineParams(validated.alpha, validated.beta, validated.gamma);

    logger.info('Oracle engine params updated', validated);

    res.json({
      code: 0,
      data: validated,
      message: 'Engine parameters updated',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
