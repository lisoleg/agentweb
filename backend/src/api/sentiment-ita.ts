/**
 * Sentiment ITA API Routes — V14.0 舆情ITA引擎（情绪优先·责任上移）
 * 挂载于 /api/v14/sentiment-ita
 *
 * 端点:
 * - GET /                — 服务信息
 * - POST /monitor        — 监测舆情情绪（核心入口）
 * - POST /escalate      — 上报总部（责任上移）
 * - POST /compensate    — 生成补偿方案（1小时内）
 * - POST /report        — 生成调查报告（48小时内）
 * - GET /event/:id      — 获取舆情事件
 * - GET /events         — 按状态查询事件列表
 * - GET /trigger/:id    — 获取ITA触发器
 * - GET /stats          — 获取舆情ITA统计
 */

import { Router, Request, Response } from 'express';
import { sentimentITAEngine, SentimentEvent, SentimentSeverity, SentimentStatus, CompensationPlan, InvestigationReport } from '../services/sentimentITAEngine';

const router = Router();

/**
 * GET / — 舆情ITA服务信息
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      version: '14.0.0',
      description: 'V14.0 舆情ITA引擎 — 情绪优先·责任上移（参考胖东来/长城汽车舆情处置逻辑）',
      inspiration: '《AgentWeb：中国式制度优势的技术映射》— 复合体理学 §4.1',
      endpoints: {
        monitor: 'POST /api/v14/sentiment-ita/monitor',
        escalate: 'POST /api/v14/sentiment-ita/escalate',
        compensate: 'POST /api/v14/sentiment-ita/compensate',
        report: 'POST /api/v14/sentiment-ita/report',
        event: 'GET /api/v14/sentiment-ita/event/:id',
        events: 'GET /api/v14/sentiment-ita/events?status=MONITORING',
        trigger: 'GET /api/v14/sentiment-ita/trigger/:id',
        stats: 'GET /api/v14/sentiment-ita/stats',
      },
      itaChain: {
        I: 'Information — 舆情情绪指数爆表',
        T: 'Trigger — 情绪得分>阈值 AND 成交量/提及量异常',
        A: 'Action — Draft Hold → Escalate → Compensate → Report',
      },
      analogies: {
        draftHold: '情绪优先 — 立即停发营销内容，不等确认',
        escalate: '责任上移 — 总部第一时间担责（"是我们的责任"），不甩锅给基层员工',
        compensate: '行动优先 — 1小时内出台补偿方案（退货/赔偿）',
        report: '透明优先 — 48小时后发布详细调查报告',
      },
    },
  });
});

/**
 * POST /monitor — 监测舆情情绪（核心入口）
 */
router.post('/monitor', (req: Request, res: Response) => {
  try {
    const { source, keyword, sentimentScore, volume, trend } = req.body;

    if (sentimentScore === undefined || volume === undefined) {
      res.status(400).json({ code: 1, message: 'sentimentScore and volume are required' });
      return;
    }

    const result = sentimentITAEngine.monitorSentiment(
      source || 'unknown',
      keyword || '',
      Number(sentimentScore),
      Number(volume),
      trend || 'STABLE',
    );

    if (!result.triggered) {
      res.json({ code: 0, data: { triggered: false, message: 'Sentiment normal, no action needed' } });
      return;
    }

    res.json({
      code: 0,
      data: {
        triggered: true,
        eventId: result.eventId,
        actions: result.actions,
        message: 'Sentiment alert triggered! Draft Hold ACTIVATED.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /escalate — 上报总部（责任上移）
 */
router.post('/escalate', (req: Request, res: Response) => {
  try {
    const { eventId, escalationNote } = req.body;
    if (!eventId) {
      res.status(400).json({ code: 1, message: 'eventId is required' });
      return;
    }

    const success = sentimentITAEngine.escalateToHQ(eventId, escalationNote || '');
    if (!success) {
      res.status(404).json({ code: 1, message: `Event ${eventId} not found` });
      return;
    }

    res.json({
      code: 0,
      data: { eventId, escalated: true },
      message: 'Escalated to HQ. HQ takes responsibility (not blaming frontline staff).',
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /compensate — 生成补偿方案（1小时内出台）
 */
router.post('/compensate', (req: Request, res: Response) => {
  try {
    const { eventId, type, budget, coverage } = req.body;
    if (!eventId || !type || budget === undefined) {
      res.status(400).json({ code: 1, message: 'eventId, type, and budget are required' });
      return;
    }

    const plan = sentimentITAEngine.generateCompensationPlan(
      eventId,
      type,
      Number(budget),
      coverage || 'all affected users',
    );

    if (!plan) {
      res.status(404).json({ code: 1, message: `Event ${eventId} not found` });
      return;
    }

    res.json({
      code: 0,
      data: plan,
      message: `Compensation plan generated. Deadline: ${new Date(plan.executionDeadline).toISOString()}`,
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * POST /report — 生成调查报告（48小时内发布）
 */
router.post('/report', (req: Request, res: Response) => {
  try {
    const { eventId, summary, rootCause, correctiveActions, preventiveMeasures } = req.body;
    if (!eventId || !summary || !rootCause) {
      res.status(400).json({ code: 1, message: 'eventId, summary, and rootCause are required' });
      return;
    }

    const report = sentimentITAEngine.generateInvestigationReport(
      eventId,
      summary,
      rootCause,
      correctiveActions || [],
      preventiveMeasures || [],
    );

    if (!report) {
      res.status(404).json({ code: 1, message: `Event ${eventId} not found` });
      return;
    }

    res.json({
      code: 0,
      data: report,
      message: `Investigation report started. Draft ETA: ${new Date(report.triggeredAt + 3600000).toISOString()}`,
    });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /event/:id — 获取舆情事件
 */
router.get('/event/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = sentimentITAEngine.getEvent(id);
    if (!event) {
      res.status(404).json({ code: 1, message: `Event ${id} not found` });
      return;
    }
    res.json({ code: 0, data: event });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /events — 按状态查询事件列表
 */
router.get('/events', (req: Request, res: Response) => {
  try {
    const status = req.query.status as SentimentStatus | undefined;
    const events = sentimentITAEngine.getEventsByStatus(status as any);
    res.json({ code: 0, data: events });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /trigger/:id — 获取ITA触发器
 */
router.get('/trigger/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trigger = sentimentITAEngine.getTrigger(id);
    if (!trigger) {
      res.status(404).json({ code: 1, message: `Trigger ${id} not found` });
      return;
    }
    res.json({ code: 0, data: trigger });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

/**
 * GET /stats — 获取舆情ITA统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = sentimentITAEngine.getStats();
    res.json({ code: 0, data: stats });
  } catch (error: any) {
    res.status(500).json({ code: 1, message: error.message });
  }
});

export default router;
