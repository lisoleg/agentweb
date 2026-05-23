/**
 * Credit API Routes — V12.0 信用评级API
 */

import { Router, Request, Response } from 'express';
import { creditService } from '../services/creditService';
import { zkCreditProofService } from '../services/zkCreditProofService';

const router = Router();

/**
 * GET / — 信用服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '12.0.0',
      description: 'V12.0 可信零知识信用证明体系 — CreditRating + ZKProof + 联动',
      endpoints: {
        rating: '/api/v12/credit/rating/:agent',
        grade: '/api/v12/credit/grade/:agent',
        proof: '/api/v12/credit/proof/:agent',
        feeMultiplier: '/api/v12/credit/fee-multiplier/:agent',
        linkage: '/api/v12/credit/linkage/:agent',
        stats: '/api/v12/credit/stats',
        zkProof: 'POST /api/v12/credit/zk-proof',
        zkVerify: 'POST /api/v12/credit/zk-verify',
        vouch: 'POST /api/v12/credit/vouch',
      },
      grades: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'],
    },
  });
});

/**
 * GET /rating/:agent — 获取信用评级
 */
router.get('/rating/:agent', async (req: Request, res: Response) => {
  try {
    const info = await creditService.getCreditInfo(req.params.agent);
    if (!info) {
      res.status(404).json({ code: 1, message: 'Agent credit not found' });
      return;
    }
    res.json({ code: 0, data: info });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /grade/:agent — 获取信用等级
 */
router.get('/grade/:agent', async (req: Request, res: Response) => {
  try {
    const grade = await creditService.getCreditGrade(req.params.agent);
    res.json({ code: 0, data: { agent: req.params.agent, grade } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /proof/:agent — 获取评级推理链
 */
router.get('/proof/:agent', async (req: Request, res: Response) => {
  try {
    const proof = await creditService.getRatingProof(req.params.agent);
    if (!proof) {
      res.status(404).json({ code: 1, message: 'Rating proof not found' });
      return;
    }
    res.json({ code: 0, data: proof });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /fee-multiplier/:agent — 获取费率乘数
 */
router.get('/fee-multiplier/:agent', async (req: Request, res: Response) => {
  try {
    const multiplier = await creditService.getFeeMultiplier(req.params.agent);
    res.json({ code: 0, data: { agent: req.params.agent, feeMultiplierBps: multiplier, feeMultiplier: multiplier / 10000 } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /linkage/:agent — 获取联动效果
 */
router.get('/linkage/:agent', async (req: Request, res: Response) => {
  try {
    const gradeIndex = req.query.gradeIndex ? parseInt(req.query.gradeIndex as string, 10) : 6; // 默认CCC
    const effects = creditService.getLinkageEffects(gradeIndex);
    res.json({ code: 0, data: { agent: req.params.agent, grade: creditService.gradeIndexToName(gradeIndex), effects } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 信用统计
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await creditService.getCreditStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /zk-proof — 生成ZK信用证明
 */
router.post('/zk-proof', (req: Request, res: Response) => {
  try {
    const { agent, claim, threshold, dimensions } = req.body;
    if (!agent || !claim || threshold === undefined || !dimensions) {
      res.status(400).json({ code: 1, message: 'agent, claim, threshold, dimensions are required' });
      return;
    }

    const result = zkCreditProofService.generateProof({
      agent,
      claim,
      threshold,
      dimensions,
    });

    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /zk-verify — 验证ZK信用证明
 */
router.post('/zk-verify', (req: Request, res: Response) => {
  try {
    const { proof, claim, expectedValid } = req.body;
    if (!proof || !claim) {
      res.status(400).json({ code: 1, message: 'proof and claim are required' });
      return;
    }

    const result = zkCreditProofService.verifyProof(proof, claim, expectedValid ?? true);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /vouch — 声誉担保（模拟）
 */
router.post('/vouch', (req: Request, res: Response) => {
  const { voucher, vouchee, stakeAmount } = req.body;
  if (!voucher || !vouchee || !stakeAmount) {
    res.status(400).json({ code: 1, message: 'voucher, vouchee, stakeAmount are required' });
    return;
  }
  res.json({
    code: 0,
    data: {
      message: 'Vouch request received',
      voucher,
      vouchee,
      stakeAmount,
      version: '12.0.0',
    },
  });
});

export default router;
