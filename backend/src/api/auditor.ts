/**
 * Auditor API Routes — V14.0 纪委Auditor自监督API
 * 挂载于 /api/v14/auditor
 *
 * 端点:
 * - GET /                — 服务信息
 * - GET /snapshot        — 获取只读快照
 * - POST /veto-freeze    — 否决并冻结Agent
 * - POST /unfreeze       — 解冻Agent
 * - POST /dual-record    — 双录双存
 * - POST /near-miss      — 记录Near-Miss未遂错误
 * - POST /complete-rrp   — 完成RRP认知递归复盘
 * - GET /flow-density/:agent — 获取流贯密度监测记录
 * - POST /monitor-density  — 监测节点流贯密度（防躺平）
 * - GET /theorem51/:agent — 获取定理5.1状态（三次同类错误上报）
 * - POST /rectify-error   — 标记错误已整改（阻止Thm5.1上报）
 * - GET /records/:agent  — 获取Agent审计记录
 * - GET /rrp/:agent       — 获取Agent的RRP记录
 * - GET /stats            — 获取审计服务统计
 */

import { Router, Request, Response } from 'express';
import { auditorService, AuditRecord, NearMissRecord, RRPRecord, FlowDensityRecord, Theorem51Status } from '../services/auditorService';

const router = Router();

/**
 * GET / — Auditor服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'V14.0 纪委Auditor自监督 — 只读快照 + VetoPower + 双录双存 + RRP复盘 + 定理5.1 + 防躺平',
      inspiration: '《AgentWeb：中国式制度优势的技术映射》— 复合体理学',
      endpoints: {
        snapshot: 'GET /api/v14/auditor/snapshot?scope=AGENT',
        vetoFreeze: 'POST /api/v14/auditor/veto-freeze',
        unfreeze: 'POST /api/v14/auditor/unfreeze',
        dualRecord: 'POST /api/v14/auditor/dual-record',
        nearMiss: 'POST /api/v14/auditor/near-miss',
        completeRRP: 'POST /api/v14/auditor/complete-rrp',
        monitorDensity: 'POST /api/v14/auditor/monitor-density',
        flowDensity: 'GET /api/v14/auditor/flow-density/:agent',
        theorem51: 'GET /api/v14/auditor/theorem51/:agent',
        rectifyError: 'POST /api/v14/auditor/rectify-error',
        records: 'GET /api/v14/auditor/records/:agent',
        rrp: 'GET /api/v14/auditor/rrp/:agent',
        stats: 'GET /api/v14/auditor/stats',
      },
      analogies: {
        businessAgent: '市长（负责干事）',
        auditorAgent: '纪委（监督市长不贪腐、不懒政）',
        RRP: '民主生活会（复盘纠错）',
      },
      features: {
        readOnlySnapshot: '只读快照 — 仅查看系统运行账目，不干预业务执行',
        vetoPower: 'Veto Power（否决权）— 发现违规立即冻结（Freeze），叫停"乱作为"',
        dualRecord: 'ReadLog（双录双存）— 所有决策全程留痕，支持终身追责（一案双查）',
        RRP: '认知递归复盘（RRP）— 系统出现Near-Miss时，必须触发复盘流程',
        theorem51: '错误进系统定理（Thm5.1）— 三次同类错误未整改，系统自动上报纪委',
        layflatMonitor: '防躺平监测 — 监测节点流贯密度，密度过低触发预警并调整权重',
      },
    },
  });
});

/**
 * GET /snapshot — 获取只读快照
 */
router.get('/snapshot', (req: Request, res: Response) => {
  try {
    const scope = (req.query.scope as 'AGENT' | 'CONTRACT' | 'TRANSACTION' | 'FULL') || 'FULL';
    const snapshot = auditorService.getReadOnlySnapshot(scope);
    res.json({ code: 0, data: snapshot });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /veto-freeze — 否决并冻结Agent
 */
router.post('/veto-freeze', (req: Request, res: Response) => {
  try {
    const { agentId, reason, severity } = req.body;
    if (!agentId || !reason) {
      res.status(400).json({ code: 1, message: 'agentId and reason are required' });
      return;
    }
    const record = auditorService.vetoAndFreeze(agentId, reason, severity || 'HIGH');
    res.json({ code: 0, data: record, message: `Agent ${agentId} FROZEN` });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /unfreeze — 解冻Agent
 */
router.post('/unfreeze', (req: Request, res: Response) => {
  try {
    const { agentId, auditorId } = req.body;
    if (!agentId || !auditorId) {
      res.status(400).json({ code: 1, message: 'agentId and auditorId are required' });
      return;
    }
    const record = auditorService.unfreeze(agentId, auditorId);
    if (!record) {
      res.status(404).json({ code: 1, message: `No active freeze found for agent ${agentId}` });
      return;
    }
    res.json({ code: 0, data: record, message: `Agent ${agentId} UNFROZEN` });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /dual-record — 双录双存
 */
router.post('/dual-record', (req: Request, res: Response) => {
  try {
    const { agentId, decisionType, input, output, reasoning } = req.body;
    if (!agentId || !decisionType) {
      res.status(400).json({ code: 1, message: 'agentId and decisionType are required' });
      return;
    }
    const recordId = auditorService.dualRecordLog({
      agentId,
      decisionType,
      input: input || {},
      output: output || {},
      reasoning: reasoning || '',
    });
    res.json({ code: 0, data: { recordId }, message: 'Dual record saved' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /near-miss — 记录Near-Miss未遂错误
 */
router.post('/near-miss', (req: Request, res: Response) => {
  try {
    const { agentId, errorType, description, context } = req.body;
    if (!agentId || !errorType) {
      res.status(400).json({ code: 1, message: 'agentId and errorType are required' });
      return;
    }
    const record = auditorService.recordNearMiss(agentId, errorType, description || '', context || {});
    res.json({ code: 0, data: record, message: 'Near-Miss recorded, RRP triggered' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /complete-rrp — 完成RRP认知递归复盘
 */
router.post('/complete-rrp', (req: Request, res: Response) => {
  try {
    const { rrpId, findings, actionItems } = req.body;
    if (!rrpId || !findings) {
      res.status(400).json({ code: 1, message: 'rrpId and findings are required' });
      return;
    }
    const rrp = auditorService.completeRRP(rrpId, findings, actionItems || []);
    if (!rrp) {
      res.status(404).json({ code: 1, message: `RRP ${rrpId} not found` });
      return;
    }
    res.json({ code: 0, data: rrp, message: 'RRP completed' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /monitor-density — 监测节点流贯密度（防躺平）
 */
router.post('/monitor-density', (req: Request, res: Response) => {
  try {
    const { agentId, density, taskCompletionRate, avgResponseTime } = req.body;
    if (!agentId || density === undefined) {
      res.status(400).json({ code: 1, message: 'agentId and density are required' });
      return;
    }
    const record = auditorService.monitorFlowDensity(agentId, density, taskCompletionRate || 0, avgResponseTime || 0);
    res.json({ code: 0, data: record, message: `Flow density monitored: ${record.status}` });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /flow-density/:agent — 获取流贯密度监测记录
 */
router.get('/flow-density/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const records = auditorService.getFlowDensityHistory(agent, limit);
    res.json({ code: 0, data: records });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /theorem51/:agent — 获取定理5.1状态
 */
router.get('/theorem51/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const statuses = auditorService.getTheorem51Status(agent);
    res.json({ code: 0, data: statuses });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /rectify-error — 标记错误已整改（阻止Thm5.1上报）
 */
router.post('/rectify-error', (req: Request, res: Response) => {
  try {
    const { agentId, errorType } = req.body;
    if (!agentId || !errorType) {
      res.status(400).json({ code: 1, message: 'agentId and errorType are required' });
      return;
    }
    const success = auditorService.rectifyError(agentId, errorType);
    if (!success) {
      res.status(404).json({ code: 1, message: `No theorem51 status found for agent=${agentId}, errorType=${errorType}` });
      return;
    }
    res.json({ code: 0, message: 'Error rectified, theorem51 reporting blocked' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /records/:agent — 获取Agent审计记录
 */
router.get('/records/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const records = auditorService.getAuditRecordsByAgent(agent);
    res.json({ code: 0, data: records });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /rrp/:agent — 获取Agent的RRP记录
 */
router.get('/rrp/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const records = auditorService.getNearMissRecords(agent);
    res.json({ code: 0, data: records });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 获取审计服务统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = auditorService.getStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
