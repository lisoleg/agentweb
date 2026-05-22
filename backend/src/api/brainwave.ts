/**
 * Brainwave API Routes
 * V5.0 Brainwave整合 REST API
 *
 * 所有Brainwave API响应统一格式: {code: number, data: T, message: string}
 * 成功: code=0, data=实际数据
 * 失败: code!=0, message=错误描述
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { brainwaveService } from '../services/brainwaveService';

const router = Router();

// =============== Validation Schemas ===============

const AllocateSRAMSchema = z.object({
  fpgaId: z.string().min(1),
  size: z.number().positive(),
  prrId: z.string().optional(),
  phiExcitationId: z.string().optional(),
});

const DeallocateSRAMSchema = z.object({
  fpgaId: z.string().min(1),
  regionId: z.string().min(1),
});

const QuantizeSchema = z.object({
  values: z.array(z.number()).min(1),
  mode: z.enum(['MS_FP8', 'MS_FP9', 'FP32']).optional().default('MS_FP8'),
});

const DequantizeSchema = z.object({
  quantized: z.array(z.any()).min(1),
});

const PartitionSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['CONV', 'FC', 'POOL', 'ACTIVATE', 'NORM', 'CUSTOM']),
    params: z.number().nonnegative(),
    flops: z.number().nonnegative(),
    sramRequired: z.number().nonnegative(),
    fpgaAccelerable: z.boolean(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    tensorSize: z.number().nonnegative(),
  })),
  totalParams: z.number().nonnegative(),
  sramLimit: z.number().positive().optional(),
});

const DeploySchema = z.object({
  graphId: z.string().min(1),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['CONV', 'FC', 'POOL', 'ACTIVATE', 'NORM', 'CUSTOM']),
    params: z.number().nonnegative(),
    flops: z.number().nonnegative(),
    sramRequired: z.number().nonnegative(),
    fpgaAccelerable: z.boolean(),
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    tensorSize: z.number().nonnegative(),
  })),
  totalParams: z.number().nonnegative(),
});

const RegisterCatapultNodeSchema = z.object({
  nodeId: z.string().min(1),
  dataCenter: z.string().min(1),
  region: z.string().min(1),
  fpgaCount: z.number().int().positive(),
  totalSRAM: z.number().positive(),
  bandwidth: z.number().nonnegative(),
  latency: z.number().nonnegative(),
  isActive: z.boolean().optional().default(true),
});

const PrecisionValidateSchema = z.object({
  modelId: z.string().min(1),
  originals: z.array(z.number()),
  quantized: z.array(z.number()),
  threshold: z.number().positive().optional().default(0.01),
});

// =============== Routes ===============

/**
 * GET /brainwave/sram-pool
 * SRAM内存池统计
 */
router.get('/sram-pool', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = brainwaveService.getSRAMPoolStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/sram-allocate
 * 分配SRAM
 */
router.post('/sram-allocate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = AllocateSRAMSchema.parse(req.body);
    const result = brainwaveService.allocateSRAM(
      validated.fpgaId,
      validated.size,
      validated.prrId,
      validated.phiExcitationId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/sram-deallocate
 * 释放SRAM
 */
router.post('/sram-deallocate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = DeallocateSRAMSchema.parse(req.body);
    const result = brainwaveService.deallocateSRAM(validated.fpgaId, validated.regionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/quantize
 * Φ值量化
 */
router.post('/quantize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = QuantizeSchema.parse(req.body);
    const result = brainwaveService.quantizePhi(validated.values, validated.mode);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/dequantize
 * Φ值反量化
 */
router.post('/dequantize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = DequantizeSchema.parse(req.body);
    const result = brainwaveService.dequantizePhi(validated.quantized);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/partition
 * 模型分段
 */
router.post('/partition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = PartitionSchema.parse(req.body);
    const graph = {
      nodes: validated.nodes,
      edges: validated.edges,
      totalParams: validated.totalParams,
    };
    const result = brainwaveService.partitionModel(graph, validated.sramLimit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /brainwave/partition/:graphId
 * 查询分段结果
 */
router.get('/partition/:graphId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { graphId } = req.params;
    // 查询分段历史（简化实现）
    res.json({
      code: 0,
      data: {
        graphId,
        message: 'Partition result lookup - use service state for details',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/deploy
 * 部署模型到FPGA
 */
router.post('/deploy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = DeploySchema.parse(req.body);
    const graph = {
      nodes: validated.nodes,
      edges: validated.edges,
      totalParams: validated.totalParams,
    };
    const result = brainwaveService.deployModel(validated.graphId, graph);

    if (result.code === 0) {
      logger.info('Model deployed', { deploymentId: result.data.deploymentId });
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /brainwave/npu
 * NPU状态
 */
router.get('/npu', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = brainwaveService.getNPUStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /brainwave/catapult
 * Catapult资源池统计
 */
router.get('/catapult', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = brainwaveService.getCatapultStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /brainwave/catapult/register
 * 注册数据中心节点
 */
router.post('/catapult/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = RegisterCatapultNodeSchema.parse(req.body);
    const node = {
      nodeId: validated.nodeId,
      dataCenter: validated.dataCenter,
      region: validated.region,
      fpgaCount: validated.fpgaCount,
      totalSRAM: validated.totalSRAM,
      liuScore: 0, // 初始值，由池计算
      bandwidth: validated.bandwidth,
      latency: validated.latency,
      isActive: validated.isActive,
    };
    const result = brainwaveService.registerCatapultNode(node);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /brainwave/precision/:modelId
 * 精度验证结果
 */
router.get('/precision/:modelId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelId } = req.params;
    const originals = req.query.originals
      ? String(req.query.originals).split(',').map(Number)
      : [];
    const quantized = req.query.quantized
      ? String(req.query.quantized).split(',').map(Number)
      : [];
    const threshold = req.query.threshold
      ? parseFloat(String(req.query.threshold))
      : 0.01;

    if (originals.length > 0 && quantized.length > 0) {
      const result = brainwaveService.validatePrecision(modelId, originals, quantized, threshold);
      res.json(result);
    } else {
      // 返回验证历史
      res.json({
        code: 0,
        data: {
          modelId,
          message: 'Precision validation history - provide originals and quantized as query params',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
