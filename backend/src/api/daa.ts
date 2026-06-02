/**
 * DAA Metric API Routes — V14.0 DAA度量 + GUI减法引擎
 * 挂载于 /api/v14/daa
 *
 * 端点:
 * - GET /                — 服务信息
 * - POST /record         — 记录DAA度量
 * - GET /stats/:agent   — 获取Agent的DAA统计
 * - POST /gui-register   — 注册GUI组件进行减法追踪
 * - POST /gui-subtract   — 执行GUI减法（逐步简化直至消失）
 * - GET /gui-stats     — 获取GUI减法统计
 * - POST /step-back     — 政府退后（定规则、供API）
 * - POST /update-social  — 更新社会Agent数量
 * - GET /step-back-stats — 获取政府退后统计
 * - GET /report/:agent  — 获取Agent综合度量报告
 */

import { Router, Request, Response } from 'express';
import { daaMetricService, DAAMetric, GUISubtraction, GovernmentStepBack } from '../services/dAAMetricService';

const router = Router();

/**
 * GET / — DAA度量服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'V14.0 DAA度量 + GUI减法引擎 — 不考核忙碌程度，只考核任务实际推进距离',
      inspiration: '《AgentWeb：中国式制度优势的技术映射》— 复合体理学 §5.3',
      endpoints: {
        record: 'POST /api/v14/daa/record',
        stats: 'GET /api/v14/daa/stats/:agentId?windowDays=7',
        guiRegister: 'POST /api/v14/daa/gui-register',
        guiSubtract: 'POST /api/v14/daa/gui-subtract',
        guiStats: 'GET /api/v14/daa/gui-stats?agentId=xxx',
        stepBack: 'POST /api/v14/daa/step-back',
        updateSocial: 'POST /api/v14/daa/update-social',
        stepBackStats: 'GET /api/v14/daa/step-back-stats',
        report: 'GET /api/v14/daa/report/:agentId',
      },
      coreConcepts: {
        DAA: 'Distance-Advanced Along Assignment — 不考核忙碌程度，只考核任务实际推进距离',
        guiSubtraction: '界面交互逐步简化直至消失，能力隐性化（用户越熟悉越简单）',
        governmentStepBack: '政府退后机制：定规则、供API，前台创造力交给社会Agent',
        antiInvolution: '反内卷：traditionalWorkload高但DAA低 = 内卷标识',
      },
      formulas: {
        DAA: 'DAA = Σ(task_complexity × completion_rate × impact_factor) / time_window',
        antiInvolution: 'traditionalWorkload > 5000 AND DAA < 3000 → INVOLUTION_FLAG',
        guiDisappearance: 'userAdaptationRate > 8000 → 界面开始消失',
      },
    },
  });
});

/**
 * POST /record — 记录DAA度量（核心入口）
 */
router.post('/record', (req: Request, res: Response) => {
  try {
    const { agentId, assignmentId, taskComplexity, completionRate, impactFactor, timeWindow, traditionalWorkload } = req.body;

    if (!agentId || !assignmentId || taskComplexity === undefined) {
      res.status(400).json({ code: 1, message: 'agentId, assignmentId, and taskComplexity are required' });
      return;
    }

    const record = daaMetricService.recordDAA(
      agentId,
      assignmentId,
      Number(taskComplexity),
      Number(completionRate) || 5000,
      Number(impactFactor) || 5000,
      Number(timeWindow) || 604800,
      Number(traditionalWorkload) || 0,
    );

    res.json({
      code: 0,
      data: record,
      message: record.antiInvolutionFlag ? 'WARNING: Involution detected!' : 'DAA recorded successfully',
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats/:agent — 获取Agent的DAA统计
 */
router.get('/stats/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const windowDays = parseInt(req.query.windowDays as string) || 7;
    const stats = daaMetricService.getDAAStats(agent, windowDays);
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /gui-register — 注册GUI组件进行减法追踪
 */
router.post('/gui-register', (req: Request, res: Response) => {
  try {
    const { agentId, componentType, originalComplexity } = req.body;

    if (!agentId || !componentType) {
      res.status(400).json({ code: 1, message: 'agentId and componentType are required' });
      return;
    }

    const record = daaMetricService.registerGUIComponent(
      agentId,
      componentType,
      Number(originalComplexity) || 5000,
    );

    res.json({ code: 0, data: record, message: 'GUI component registered for subtraction' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /gui-subtract — 执行GUI减法（逐步简化直至消失）
 */
router.post('/gui-subtract', (req: Request, res: Response) => {
  try {
    const { componentId, userAdaptationRate } = req.body;

    if (!componentId || userAdaptationRate === undefined) {
      res.status(400).json({ code: 1, message: 'componentId and userAdaptationRate are required' });
      return;
    }

    const record = daaMetricService.performGUISubtraction(
      componentId,
      Number(userAdaptationRate),
    );

    if (!record) {
      res.status(404).json({ code: 1, message: `Component ${componentId} not found` });
      return;
    }

    res.json({
      code: 0,
      data: record,
      message: record.isInvisible ? 'Component INVISIBLE (capability implicit)' : 'GUI subtraction performed',
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /gui-stats — 获取GUI减法统计
 */
router.get('/gui-stats', (req: Request, res: Response) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const stats = daaMetricService.getGUISubtractionStats(agentId);
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /step-back — 政府退后（定规则、供API）
 */
router.post('/step-back', (req: Request, res: Response) => {
  try {
    const { domain, ruleSet, apiList } = req.body;

    if (!domain || !ruleSet || !Array.isArray(ruleSet)) {
      res.status(400).json({ code: 1, message: 'domain and ruleSet (array) are required' });
      return;
    }

    const record = daaMetricService.governmentStepBack(
      domain,
      ruleSet,
      Array.isArray(apiList) ? apiList : [],
    );

    res.json({
      code: 0,
      data: record,
      message: 'Government stepped back. Creativity delegated to social Agents.',
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /update-social — 更新社会Agent数量
 */
router.post('/update-social', (req: Request, res: Response) => {
  try {
    const { recordId, count, innovationIndex } = req.body;

    if (!recordId) {
      res.status(400).json({ code: 1, message: 'recordId is required' });
      return;
    }

    const record = daaMetricService.updateSocialAgentCount(
      recordId,
      Number(count) || 0,
      Number(innovationIndex) || 5000,
    );

    if (!record) {
      res.status(404).json({ code: 1, message: `Record ${recordId} not found` });
      return;
    }

    res.json({ code: 0, data: record, message: 'Social agent count updated' });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /step-back-stats — 获取政府退后统计
 */
router.get('/step-back-stats', (_req: Request, res: Response) => {
  try {
    const stats = daaMetricService.getStepBackStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /report/:agent — 获取Agent综合度量报告
 */
router.get('/report/:agent', (req: Request, res: Response) => {
  try {
    const { agent } = req.params;
    const report = daaMetricService.getComprehensiveReport(agent);
    res.json({ code: 0, data: report });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
