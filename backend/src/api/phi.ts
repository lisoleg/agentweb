/**
 * Phi (Φ) Routes
 * POST /api/v1/phi/calculate, GET /api/v1/phi/history/:userId, GET /api/v1/phi/distribution
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import prisma from '@prisma/client';
import axios from 'axios';

const router = Router();
const PHI_ENGINE_URL = process.env.PHI_ENGINE_URL || 'http://localhost:8000';

// =============== Validation Schemas ===============

const CalculatePhiSchema = z.object({
  userId: z.string().min(1),
  interactionData: z.object({}).passthrough(),
  contentId: z.string().optional(),
});

// =============== Routes ===============

/**
 * POST /api/v1/phi/calculate
 * Calculate Φ value from interaction data
 */
router.post('/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CalculatePhiSchema.parse(req.body);
    const { userId, interactionData, contentId } = validated;

    // Call Phi Engine (Python FastAPI)
    const phiResponse = await axios.post(`${PHI_ENGINE_URL}/api/v1/phi/calculate`, {
      interaction_data: {
        user_id: userId,
        content_id: contentId,
        ...interactionData,
      },
    });

    const phiResult = phiResponse.data.data || phiResponse.data;

    // Store result in database
    const record = await prisma.phiRecord.create({
      data: {
        userId,
        phiValue: phiResult.phi_value,
        calculationData: interactionData,
        metadata: phiResult.details || {},
      },
    });

    logger.info('Φ calculated and stored', {
      userId,
      phiValue: phiResult.phi_value,
      recordId: record.id,
    });

    res.json({
      code: 0,
      data: {
        phiValue: phiResult.phi_value,
        recordId: record.id,
        details: phiResult.details,
      },
    });
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      logger.warn('Phi Engine not available, using fallback calculation');
      // TODO: Implement fallback calculation
      next(new Error('Phi Engine not available'));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/phi/history/:userId
 * Get Φ value history for a user
 */
router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const records = await prisma.phiRecord.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    res.json({
      code: 0,
      data: {
        userId,
        records: records.map(r => ({
          id: r.id,
          phiValue: r.phiValue,
          timestamp: r.timestamp,
          metadata: r.metadata,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/phi/distribution
 * Get Φ value distribution statistics
 */
router.get('/distribution', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all phi records
    const records = await prisma.phiRecord.findMany({
      select: { phiValue: true },
    });

    if (records.length === 0) {
      res.json({
        code: 0,
        data: {
          count: 0,
          statistics: { mean: 0, median: 0, std: 0, min: 0, max: 0 },
          distribution: {},
        },
      });
      return;
    }

    const values = records.map(r => r.phiValue).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const median = count % 2 === 0
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)];
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / count;
    const std = Math.sqrt(variance);

    // Create distribution buckets
    const buckets: Record<string, number> = {};
    values.forEach(v => {
      const bucket = (Math.floor(v * 10) / 10).toFixed(1);
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

    res.json({
      code: 0,
      data: {
        count,
        statistics: {
          mean: parseFloat(mean.toFixed(6)),
          median: parseFloat(median.toFixed(6)),
          std: parseFloat(std.toFixed(6)),
          min: values[0],
          max: values[count - 1],
        },
        distribution: buckets,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
