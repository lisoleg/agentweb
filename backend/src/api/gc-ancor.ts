/**
 * GC Ancor API Routes — V12.5 GC锚定层API
 * 挂载于 /api/v12/gc-ancor
 *
 * 端点:
 * - GET /                — 服务信息
 * - GET /anchor/:agent    — 获取Agent锚定状态
 * - GET /balance/:agent   — 获取Agent GC余额与健康度
 * - GET /ledger/:agent    — 获取Agent统一GC交易流水
 * - GET /records/:agent   — 获取Agent锚定记录(分页)
 * - GET /record/:id       — 获取单条锚定记录
 * - GET /epoch/:epoch     — 获取周期结算摘要
 * - GET /merkle/:epoch    — 获取周期Merkle根
 * - POST /settle          — 触发周期结算
 * - GET /penalties/:agent — 获取Agent惩罚记录
 * - GET /penalty/:id      — 获取单条惩罚记录
 * - POST /predict         — 惩罚预测
 * - POST /appeal          — 提交惩罚申诉
 * - GET /career/:agent    — 获取链上职业征信报告
 * - GET /trend/:agent     — 获取GC健康趋势
 * - GET /stats            — 获取GC总账统计
 */

import { Router, Request, Response } from 'express';
import { gcAncorService } from '../services/gcAncorService';
import { gcPenaltyService } from '../services/gcPenaltyService';
import { gcLedgerService } from '../services/gcLedgerService';

const router = Router();

/**
 * GET / — GC锚定层服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '12.5.0',
      description: 'V12.5 GC锚定层 — "代码即法律"自动奖惩 + 链上职业征信 + "做题家"机制',
      inspiration: '《皇帝的新衣与影子内阁》+ 《GSD-Coin终极推演》',
      endpoints: {
        anchor: '/api/v12/gc-ancor/anchor/:agent',
        balance: '/api/v12/gc-ancor/balance/:agent',
        ledger: '/api/v12/gc-ancor/ledger/:agent',
        records: '/api/v12/gc-ancor/records/:agent',
        record: '/api/v12/gc-ancor/record/:id',
        epoch: '/api/v12/gc-ancor/epoch/:epoch',
        merkle: '/api/v12/gc-ancor/merkle/:epoch',
        settle: 'POST /api/v12/gc-ancor/settle',
        penalties: '/api/v12/gc-ancor/penalties/:agent',
        penalty: '/api/v12/gc-ancor/penalty/:id',
        predict: 'POST /api/v12/gc-ancor/predict',
        appeal: 'POST /api/v12/gc-ancor/appeal',
        career: '/api/v12/gc-ancor/career/:agent',
        trend: '/api/v12/gc-ancor/trend/:agent',
        stats: '/api/v12/gc-ancor/stats',
      },
      anchorTypes: ['INCOME', 'CONSUMPTION', 'PENALTY', 'REWARD', 'STAKE', 'BURN'],
      penaltyLevels: ['NONE', 'WARNING', 'DOWNGRADE', 'EXPEL'],
    },
  });
});

/**
 * GET /anchor/:agent — 获取Agent锚定状态
 */
router.get('/anchor/:agent', async (req: Request, res: Response) => {
  try {
    const state = await gcAncorService.getAgentAnchorState(req.params.agent);
    if (!state) {
      res.status(404).json({ code: 1, message: 'Agent anchor state not found' });
      return;
    }
    res.json({ code: 0, data: state });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /balance/:agent — 获取Agent GC余额与健康度
 */
router.get('/balance/:agent', async (req: Request, res: Response) => {
  try {
    const health = await gcAncorService.getGCHealth(req.params.agent);
    if (!health) {
      res.status(404).json({ code: 1, message: 'Agent GC health not found' });
      return;
    }
    res.json({ code: 0, data: health });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /ledger/:agent — 获取Agent统一GC交易流水
 */
router.get('/ledger/:agent', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;
    const typeFilter = req.query.type as string | undefined;

    const result = await gcLedgerService.getGCLedger(
      req.params.agent,
      from,
      limit,
      typeFilter ? Number(typeFilter) as any : undefined
    );

    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /records/:agent — 获取Agent锚定记录(分页)
 */
router.get('/records/:agent', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await gcAncorService.getAgentRecords(req.params.agent, from, limit);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /record/:id — 获取单条锚定记录
 */
router.get('/record/:id', async (req: Request, res: Response) => {
  try {
    const record = await gcAncorService.getAnchorRecord(parseInt(req.params.id, 10));
    if (!record) {
      res.status(404).json({ code: 1, message: 'Anchor record not found' });
      return;
    }
    res.json({ code: 0, data: record });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /epoch/:epoch — 获取周期结算摘要
 */
router.get('/epoch/:epoch', async (req: Request, res: Response) => {
  try {
    const summary = await gcAncorService.getEpochSummary(parseInt(req.params.epoch, 10));
    if (!summary) {
      res.status(404).json({ code: 1, message: 'Epoch summary not found' });
      return;
    }
    res.json({ code: 0, data: summary });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /merkle/:epoch — 获取周期Merkle根
 */
router.get('/merkle/:epoch', async (req: Request, res: Response) => {
  try {
    const merkleRoot = await gcAncorService.getEpochMerkleRoot(parseInt(req.params.epoch, 10));
    if (!merkleRoot) {
      res.status(404).json({ code: 1, message: 'Epoch merkle root not found' });
      return;
    }
    res.json({ code: 0, data: { epoch: parseInt(req.params.epoch, 10), merkleRoot } });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /settle — 触发周期结算（模拟）
 */
router.post('/settle', (req: Request, res: Response) => {
  const { epoch } = req.body;
  res.json({
    code: 0,
    data: {
      message: 'Epoch settlement request received',
      epoch: epoch || 'current',
      version: '12.5.0',
    },
  });
});

/**
 * GET /penalties/:agent — 获取Agent惩罚记录
 */
router.get('/penalties/:agent', async (req: Request, res: Response) => {
  try {
    const from = parseInt(req.query.from as string) || 0;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await gcPenaltyService.getAgentPenalties(req.params.agent, from, limit);
    res.json({ code: 0, data: result });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /penalty/:id — 获取单条惩罚记录
 */
router.get('/penalty/:id', async (req: Request, res: Response) => {
  try {
    const record = await gcPenaltyService.getPenaltyRecord(parseInt(req.params.id, 10));
    if (!record) {
      res.status(404).json({ code: 1, message: 'Penalty record not found' });
      return;
    }
    res.json({ code: 0, data: record });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /predict — 惩罚预测
 */
router.post('/predict', (req: Request, res: Response) => {
  const { gcBalance, metabolicRate } = req.body;
  if (gcBalance === undefined || metabolicRate === undefined) {
    res.status(400).json({ code: 1, message: 'gcBalance and metabolicRate are required' });
    return;
  }

  const prediction = gcPenaltyService.predictPenalty(
    Number(gcBalance),
    Number(metabolicRate)
  );

  res.json({ code: 0, data: prediction });
});

/**
 * POST /appeal — 提交惩罚申诉（模拟）
 */
router.post('/appeal', (req: Request, res: Response) => {
  const { penaltyId, evidenceHash } = req.body;
  if (!penaltyId || !evidenceHash) {
    res.status(400).json({ code: 1, message: 'penaltyId and evidenceHash are required' });
    return;
  }
  res.json({
    code: 0,
    data: {
      message: 'Appeal submitted to ConstitutionCourt',
      penaltyId,
      evidenceHash,
      version: '12.5.0',
    },
  });
});

/**
 * GET /career/:agent — 获取链上职业征信报告
 */
router.get('/career/:agent', async (req: Request, res: Response) => {
  try {
    const career = await gcLedgerService.getCareerCredit(req.params.agent);
    if (!career) {
      res.status(404).json({ code: 1, message: 'Career credit report not found' });
      return;
    }
    res.json({ code: 0, data: career });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /trend/:agent — 获取GC健康趋势
 */
router.get('/trend/:agent', async (req: Request, res: Response) => {
  try {
    const trend = await gcLedgerService.getHealthTrend(req.params.agent);
    if (!trend) {
      res.status(404).json({ code: 1, message: 'Health trend not found' });
      return;
    }
    res.json({ code: 0, data: trend });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 获取GC总账统计
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await gcLedgerService.getLedgerStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
