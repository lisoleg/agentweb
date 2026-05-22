/**
 * SubDAO Routes
 * 子DAO本地化治理路由
 *
 * POST /api/v1/subdao/create — 创建子DAO
 * POST /api/v1/subdao/:subDaoId/join — 加入子DAO
 * POST /api/v1/subdao/:subDaoId/leave — 退出子DAO
 * POST /api/v1/subdao/:subDaoId/propose — 子DAO内提案
 * POST /api/v1/subdao/:subDaoId/vote — 子DAO内投票
 * GET /api/v1/subdao/list — 列出所有子DAO
 * GET /api/v1/subdao/:subDaoId — 子DAO详情
 * GET /api/v1/subdao/templates — 法规模板列表
 * POST /api/v1/subdao/cross-region — 跨区提案
 * GET /api/v1/subdao/compliance/:subDaoId — 合规检查
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { subDaoService, ProposalState } from '../services/subDaoService';

const router = Router();

// =============== Validation Schemas ===============

const CreateSubDAOSchema = z.object({
  countryCode: z.string().length(2, 'ISO 3166-1 alpha-2 required'),
  regionCode: z.string().min(1).max(10),
  name: z.string().min(1).max(100),
  customRule: z.object({
    minVotingPeriod: z.number().positive().optional(),
    maxVotingPeriod: z.number().positive().optional(),
    quorumRatio: z.number().min(0).max(1).optional(),
    approvalThreshold: z.number().min(0).max(1).optional(),
    requireKYC: z.boolean().optional(),
    maxStakeInfluence: z.number().min(0).max(1).optional(),
  }).optional(),
});

const ProposeSchema = z.object({
  description: z.string().min(1).max(2000),
  votingPeriodDays: z.number().min(1).max(30).default(7),
});

const VoteSchema = z.object({
  proposalId: z.string().min(1),
  support: z.boolean(),
  phiWeight: z.number().min(0).max(1).default(1.0),
});

const CrossRegionProposeSchema = z.object({
  description: z.string().min(1).max(2000),
  targetRegions: z.array(z.string().min(1)).min(1).max(10),
  votingPeriodDays: z.number().min(1).max(30).default(7),
});

// =============== Routes ===============

/**
 * POST /api/v1/subdao/create
 * 创建子DAO
 */
router.post('/create', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateSubDAOSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const subDao = subDaoService.createSubDAO({
      countryCode: validated.countryCode,
      regionCode: validated.regionCode,
      name: validated.name,
      customRule: validated.customRule,
    });

    // 创建者自动加入
    subDaoService.joinSubDAO(subDao.subDaoId, userId);

    logger.info('SubDAO created', { subDaoId: subDao.subDaoId, creator: userId });

    res.status(201).json({
      code: 0,
      data: subDao,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/subdao/:subDaoId/join
 * 加入子DAO
 */
router.post('/:subDaoId/join', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    subDaoService.joinSubDAO(subDaoId, userId);

    logger.info('User joined SubDAO', { subDaoId, userId });

    res.json({
      code: 0,
      message: 'Joined SubDAO successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/subdao/:subDaoId/leave
 * 退出子DAO
 */
router.post('/:subDaoId/leave', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    subDaoService.leaveSubDAO(subDaoId, userId);

    logger.info('User left SubDAO', { subDaoId, userId });

    res.json({
      code: 0,
      message: 'Left SubDAO successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/subdao/:subDaoId/propose
 * 子DAO内提案
 */
router.post('/:subDaoId/propose', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const validated = ProposeSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const proposal = subDaoService.createProposal({
      subDaoId,
      proposer: userId,
      description: validated.description,
      votingPeriodDays: validated.votingPeriodDays,
    });

    logger.info('SubDAO proposal created', { proposalId: proposal.proposalId, subDaoId, proposer: userId });

    res.status(201).json({
      code: 0,
      data: proposal,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/subdao/:subDaoId/vote
 * 子DAO内投票
 */
router.post('/:subDaoId/vote', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const validated = VoteSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    subDaoService.castVote({
      proposalId: validated.proposalId,
      voter: userId,
      support: validated.support,
      phiWeight: validated.phiWeight,
    });

    logger.info('Vote cast in SubDAO', { subDaoId, proposalId: validated.proposalId, voter: userId });

    res.json({
      code: 0,
      message: 'Vote cast successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subdao/list
 * 列出所有子DAO
 */
router.get('/list', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subDaos = subDaoService.listSubDAOs();
    res.json({
      code: 0,
      data: { subDaos, count: subDaos.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subdao/templates
 * 法规模板列表
 */
router.get('/templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = subDaoService.getJurisdictionTemplates();
    res.json({
      code: 0,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subdao/:subDaoId
 * 子DAO详情
 */
router.get('/:subDaoId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const subDao = subDaoService.getSubDAO(subDaoId);

    if (!subDao) {
      res.status(404).json({ code: 1004, message: 'SubDAO not found' });
      return;
    }

    res.json({
      code: 0,
      data: subDao,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/subdao/cross-region
 * 跨区提案
 */
router.post('/cross-region', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CrossRegionProposeSchema.parse(req.body);
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    // 需要指定来源子DAO（用户必须是该子DAO成员）
    const { sourceSubDaoId } = req.body;
    if (!sourceSubDaoId) {
      res.status(400).json({ code: 1001, message: 'sourceSubDaoId required' });
      return;
    }

    const proposal = subDaoService.createCrossRegionProposal({
      sourceSubDaoId,
      proposer: userId,
      description: validated.description,
      targetRegions: validated.targetRegions,
      votingPeriodDays: validated.votingPeriodDays,
    });

    logger.info('Cross-region proposal created', { proposalId: proposal.proposalId, sourceSubDaoId });

    res.status(201).json({
      code: 0,
      data: proposal,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subdao/compliance/:subDaoId
 * 合规检查
 */
router.get('/compliance/:subDaoId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subDaoId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ code: 3001, message: 'Unauthorized' });
      return;
    }

    const result = subDaoService.checkJurisdictionCompliance(subDaoId, userId);

    res.json({
      code: 0,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
