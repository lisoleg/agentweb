/**
 * LiLiFa API Routes — V14.0 情理法三层决策引擎（法·理·情）
 * 挂载于 /api/v14/li-li-fa
 *
 * 端点:
 * - GET /                — 服务信息
 * - POST /decide        — 执行三层决策（核心入口）
 * - POST /rule           — 添加规则
 * - GET /rules           — 按类型查询规则
 * - GET /decision/:id   — 获取决策结果
 * - GET /stats           — 获取引擎统计
 */

import { Router, Request, Response } from 'express';
import { liLiFaEngine, DecisionRequest, DecisionLayer, RuleType, Rule, DecisionResult, DecisionOption } from '../services/liLiFaEngine';

const router = Router();

/**
 * GET / — 情理法引擎信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'V14.0 情理法三层决策引擎 — 法(Protocol)刚性契约 + 理(Procedure)柔性流程 + 情(Human-Override)中道余量',
      inspiration: '《AgentWeb：中国式制度优势的技术映射》— 复合体理学 §1.2',
      endpoints: {
        decide: 'POST /api/v14/li-li-fa/decide',
        addRule: 'POST /api/v14/li-li-fa/rule',
        rules: 'GET /api/v14/li-li-fa/rules?type=HARD_CONSTRAINT',
        decision: 'GET /api/v14/li-li-fa/decision/:id',
        stats: 'GET /api/v14/li-li-fa/stats',
      },
     三层架构: {
        FA: '法(Protocol) — 刚性契约：硬性规则、法规、红线（不可违反）',
        LI: '理(Procedure) — 柔性流程：优化目标、道义逻辑、可解释推理（计算核=机器）',
        QING: '情(Human-Override) — 中道余量：人类override、情境化裁量（算计核=人类）',
      },
      analogies: {
        FA: '法律/合同/协议 — 必须遵守',
        LI: '优化算法/概率推理 — 最优解',
        QING: '民主生活会/情境裁量 — 中道智能',
      },
      zhongdaoLogic: '法规 × 道义抉择：当法规与道义冲突时，引入"中道余量"（情）进行情境化裁量',
    },
  });
});

/**
 * POST /decide — 执行三层决策（核心入口）
 */
router.post('/decide', (req: Request, res: Response) => {
  try {
    const { agentId, context, options, requiredLayer } = req.body;

    if (!agentId || !options || !Array.isArray(options) || options.length === 0) {
      res.status(400).json({ code: 1, message: 'agentId and options (non-empty array) are required' });
      return;
    }

    const requestId = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const request: DecisionRequest = {
      id: requestId,
      timestamp: Date.now(),
      agentId,
      context: context || {},
      options: options as DecisionOption[],
      requiredLayer: requiredLayer as DecisionLayer | undefined,
    };

    const result = liLiFaEngine.decide(request);

    res.json({
      code: 0,
      data: result,
      message: `Decision completed using ${result.layerUsed} layer`,
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /rule — 添加规则
 */
router.post('/rule', (req: Request, res: Response) => {
  try {
    const { id, type, description, condition, weight, source } = req.body;

    if (!id || !type || !description) {
      res.status(400).json({ code: 1, message: 'id, type, and description are required' });
      return;
    }

    const rule: Rule = {
      id,
      type: type as RuleType,
      description,
      condition: condition || 'true',
      weight: weight !== undefined ? Number(weight) : 5000,
      source: source || 'PROTOCOL',
    };

    liLiFaEngine.addRule(rule);

    res.json({ code: 0, data: rule, message: `Rule ${id} added` });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /rules — 按类型查询规则
 */
router.get('/rules', (req: Request, res: Response) => {
  try {
    const type = req.query.type as RuleType | undefined;
    const rules = type ? liLiFaEngine.getRulesByType(type) : Array.from(liLiFaEngine['rules'].values());
    res.json({ code: 0, data: rules });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /decision/:id — 获取决策结果
 */
router.get('/decision/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const decision = liLiFaEngine.getDecision(id);
    if (!decision) {
      res.status(404).json({ code: 1, message: `Decision ${id} not found` });
      return;
    }
    res.json({ code: 0, data: decision });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 获取引擎统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = liLiFaEngine.getStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
