/**
 * Court V2 API Routes — V12.0 裁决增强API
 * 内生AI裁决分析 + 判决沙盘预演 + 意图驱动查询 + 推理链
 */

import { Router, Request, Response } from 'express';
import { judgmentAnalysisEngine } from '../services/judgmentAnalysisEngine';
import { judgmentSimulator, SimulationInput } from '../services/judgmentSimulator';

const router = Router();

// =============== 裁决分析 ===============

/**
 * GET /analysis/:caseId — 获取案件AI分析
 */
router.get('/analysis/:caseId', async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid caseId' });
      return;
    }

    // 模拟数据（实际从合约读取投票记录）
    const mockVotes = [
      { voter: '0xAAA1', votingPower: BigInt(5000), support: true, timestamp: Date.now() / 1000 - 100 },
      { voter: '0xAAA2', votingPower: BigInt(8000), support: true, timestamp: Date.now() / 1000 - 200 },
      { voter: '0xBBB1', votingPower: BigInt(200), support: false, timestamp: Date.now() / 1000 - 50 },
      { voter: '0xCCC1', votingPower: BigInt(50), support: false, timestamp: Date.now() / 1000 - 30 },
      { voter: '0xDDD1', votingPower: BigInt(3000), support: true, timestamp: Date.now() / 1000 - 150 },
    ];

    const report = judgmentAnalysisEngine.analyzeVotingPattern(caseId, mockVotes, BigInt(1000000));

    res.json({
      code: 0,
      data: {
        caseId,
        analysis: {
          clusters: report.clusters.map(c => ({
            ...c,
            totalPower: c.totalPower.toString(),
          })),
          anomalies: report.anomalies,
          impactPredictions: report.impactPredictions,
          summary: report.summary,
        },
        generatedAt: report.timestamp,
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

// =============== 判决沙盘预演 ===============

/**
 * POST /simulate — 判决沙盘模拟
 */
router.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { caseId, hypotheticalVotes, supportRateChange } = req.body;

    if (!caseId) {
      res.status(400).json({ code: 1, message: 'caseId is required' });
      return;
    }

    // 模拟当前投票数据
    const input: SimulationInput = {
      caseId: parseInt(caseId, 10),
      currentYesVotes: BigInt(req.body.currentYesVotes || '5000000000000000000000'),
      currentNoVotes: BigInt(req.body.currentNoVotes || '2000000000000000000000'),
      totalVoters: req.body.totalVoters || 10,
      votingEndTimestamp: req.body.votingEndTimestamp || Math.floor(Date.now() / 1000) + 864000,
      hypotheticalVotes: hypotheticalVotes ? {
        yesPower: BigInt(hypotheticalVotes.yesPower || '0'),
        noPower: BigInt(hypotheticalVotes.noPower || '0'),
      } : undefined,
      supportRateChange,
    };

    const result = judgmentSimulator.simulate(input);

    res.json({
      code: 0,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

// =============== 意图驱动查询 ===============

/**
 * POST /query — 意图驱动裁决查询
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ code: 1, message: 'query is required' });
      return;
    }

    // 模拟NLU解析（V13.0接入真实NLU模型）
    const parsedIntent = parseNaturalLanguageQuery(query);

    res.json({
      code: 0,
      data: {
        originalQuery: query,
        parsedIntent,
        results: [],
        note: 'V12.0模拟模式 - NLU解析待V13.0实现',
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

// =============== 判决推理链 ===============

/**
 * GET /reasoning/:caseId — 获取判决推理链
 */
router.get('/reasoning/:caseId', async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(req.params.caseId, 10);
    if (isNaN(caseId)) {
      res.status(400).json({ code: 1, message: 'Invalid caseId' });
      return;
    }

    // 模拟推理链数据
    const reasoningChain = {
      caseId,
      nodes: [
        { id: 'vote-start', type: 'event', label: '投票开始', data: { timestamp: Date.now() / 1000 - 864000 } },
        { id: 'vote-cast-1', type: 'action', label: 'Φ5000投票支持', data: { voter: '0xAAA1', power: '5000', support: true } },
        { id: 'vote-cast-2', type: 'action', label: 'Φ8000投票支持', data: { voter: '0xAAA2', power: '8000', support: true } },
        { id: 'vote-cast-3', type: 'action', label: 'Φ3000投票反对', data: { voter: '0xBBB1', power: '3000', support: false } },
        { id: 'threshold-check', type: 'decision', label: '阈值检查', data: { yesRate: '81.25%', threshold: '67%' } },
        { id: 'judgment', type: 'result', label: '判决: UPHOLD', data: { judgment: 'UPHOLD', yesVotes: '13000', noVotes: '3000' } },
      ],
      edges: [
        { from: 'vote-start', to: 'vote-cast-1' },
        { from: 'vote-cast-1', to: 'vote-cast-2' },
        { from: 'vote-cast-2', to: 'vote-cast-3' },
        { from: 'vote-cast-3', to: 'threshold-check' },
        { from: 'threshold-check', to: 'judgment' },
      ],
    };

    res.json({
      code: 0,
      data: reasoningChain,
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

// =============== 辅助函数 ===============

function parseNaturalLanguageQuery(query: string): {
  intent: string;
  filters: Record<string, string>;
  timeRange?: string;
} {
  const lower = query.toLowerCase();
  const filters: Record<string, string> = {};

  if (lower.includes('overtur') || lower.includes('推翻')) {
    filters.judgment = 'OVERTURN';
  }
  if (lower.includes('uphold') || lower.includes('维持')) {
    filters.judgment = 'UPHOLD';
  }
  if (lower.includes('remand') || lower.includes('发回')) {
    filters.judgment = 'REMAND';
  }
  if (lower.includes('emergen') || lower.includes('紧急')) {
    filters.isEmergency = 'true';
  }
  if (lower.includes('30') || lower.includes('三十天') || lower.includes('recent')) {
    filters.timeRange = '30d';
  }

  return {
    intent: 'QUERY_CASES',
    filters,
    timeRange: filters.timeRange,
  };
}

export default router;
