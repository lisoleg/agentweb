/**
 * Hierarchical Planner API Routes — V13.0 HG-STR分层Planner
 * 三层决策(L1战略+L2战役+L3战术) + ITA-Trigger引擎
 */

import { Router, Request, Response } from 'express';
import { hierarchicalPlannerService, MacroGoal } from '../services/hierarchicalPlannerService';
import { itaTriggerEngine, TriggerStatus } from '../services/itaTriggerEngine';

const router = Router();

// =============== 分层Planner ===============

// 执行三层决策
router.post('/plan', async (req: Request, res: Response) => {
  const { agentId, situation, observation } = req.body;
  if (!agentId || !situation || !observation) {
    res.status(400).json({ code: 1, message: 'agentId, situation, observation are required' });
    return;
  }
  try {
    const decision = await hierarchicalPlannerService.plan(agentId, situation, observation);
    res.json({ code: 0, data: decision });
  } catch (error) {
    res.status(500).json({ code: 1, message: (error as Error).message });
  }
});

// 报告决策结果
router.post('/outcome', (req: Request, res: Response) => {
  const { agentId, outcome, duration, lessons } = req.body;
  if (!agentId || !outcome) {
    res.status(400).json({ code: 1, message: 'agentId and outcome are required' });
    return;
  }
  hierarchicalPlannerService.reportOutcome(agentId, outcome, duration || 0, lessons || []);
  res.json({ code: 0, data: { success: true } });
});

// 获取当前活跃决策
router.get('/decision/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const decision = hierarchicalPlannerService.getActiveDecision(agentId);
  res.json({ code: 0, data: decision });
});

// 获取决策历史
router.get('/decision/:agentId/history', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const limit = parseInt(req.query.limit as string) || 20;
  const history = hierarchicalPlannerService.getDecisionHistory(agentId, limit);
  res.json({ code: 0, data: history });
});

// 获取Planner统计
router.get('/stats', (_req: Request, res: Response) => {
  const stats = hierarchicalPlannerService.getStats();
  res.json({ code: 0, data: stats });
});

// 获取L1战略层规则
router.get('/macro-rules', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      rules: Object.values(MacroGoal).map(goal => ({
        goal,
        description: _getMacroGoalDescription(goal),
      })),
      note: 'L1战略层: 全局态势 → Goal ∈ {Search, Engage, RTB, Observe, Emergency, Collaborate, Hibernate}',
    },
  });
});

// =============== ITA-Trigger引擎 ===============

// 注册ITA-Trigger
router.post('/ita-trigger', (req: Request, res: Response) => {
  const trigger = req.body;
  if (!trigger.id || !trigger.name || !trigger.information || !trigger.trigger || !trigger.actions) {
    res.status(400).json({ code: 1, message: 'id, name, information, trigger, actions are required' });
    return;
  }
  const result = itaTriggerEngine.registerTrigger(trigger);
  if (result.success) {
    res.json({ code: 0, data: { success: true, triggerId: trigger.id } });
  } else {
    res.status(400).json({ code: 1, message: result.error });
  }
});

// 注销ITA-Trigger
router.delete('/ita-trigger/:triggerId', (req: Request, res: Response) => {
  const { triggerId } = req.params;
  const success = itaTriggerEngine.unregisterTrigger(triggerId);
  res.json({ code: 0, data: { success } });
});

// 获取Trigger
router.get('/ita-trigger/:triggerId', (req: Request, res: Response) => {
  const { triggerId } = req.params;
  const trigger = itaTriggerEngine.getTrigger(triggerId);
  if (!trigger) {
    res.status(404).json({ code: 1, message: 'Trigger not found' });
    return;
  }
  res.json({ code: 0, data: trigger });
});

// 列出Triggers
router.get('/ita-trigger', (req: Request, res: Response) => {
  const { status } = req.query;
  const triggers = itaTriggerEngine.listTriggers(status as TriggerStatus | undefined);
  res.json({ code: 0, data: triggers });
});

// 评估信息(手动触发)
router.post('/ita-trigger/:triggerId/evaluate', (req: Request, res: Response) => {
  const { triggerId } = req.params;
  const { value, context } = req.body;
  if (value === undefined) {
    res.status(400).json({ code: 1, message: 'value is required' });
    return;
  }
  const result = itaTriggerEngine.evaluateInformation(triggerId, value, context || {});
  res.json({ code: 0, data: result });
});

// 批量扫描
router.post('/ita-trigger/scan', (req: Request, res: Response) => {
  const { values, context } = req.body;
  if (!values) {
    res.status(400).json({ code: 1, message: 'values (Map<string, unknown>) is required' });
    return;
  }
  const results = itaTriggerEngine.scanAllTriggers(
    new Map(Object.entries(values)),
    context || {}
  );
  res.json({ code: 0, data: results });
});

// 获取触发历史
router.get('/ita-trigger-history', (req: Request, res: Response) => {
  const { triggerId } = req.query;
  const limit = parseInt(req.query.limit as string) || 50;
  const history = itaTriggerEngine.getFireHistory(triggerId as string | undefined, limit);
  res.json({ code: 0, data: history });
});

// 获取ITA统计
router.get('/ita-stats', (_req: Request, res: Response) => {
  const stats = itaTriggerEngine.getStats();
  res.json({
    code: 0,
    data: stats,
    prophecyP2: '医疗AgentWeb中, 带ITA-Trigger的预警系统误报率比纯弹窗系统低40%',
  });
});

// =============== Helper ===============

function _getMacroGoalDescription(goal: MacroGoal): string {
  const descriptions: Record<string, string> = {
    SEARCH: '搜索/发现: 无活跃任务时主动探索',
    ENGAGE: '交战/执行: 存在待处理威胁且资源充足',
    RTB: '返回基地: 系统负载过高释放资源',
    OBSERVE: '观察等待: 默认或不确定时的保守策略',
    EMERGENCY: '紧急干预: GC余额不足或危急状况',
    COLLABORATE: '协同合作: 有任务且有可用协作者',
    HIBERNATE: '休眠节能: 无任务且资源不足',
  };
  return descriptions[goal] || '';
}

export default router;
