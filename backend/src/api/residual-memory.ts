/**
 * Residual Memory API Routes — V13.0 HG-STR残存记忆+弱连通容错
 * GRU残存记忆 + Anti-entropy同步 + Gossip+TTL缓存
 */

import { Router, Request, Response } from 'express';
import { residualMemoryService } from '../services/residualMemoryService';
import { gossipSyncService, GossipMessageType, GossipPriority } from '../services/gossipSyncService';

const router = Router();

// =============== 残存记忆 ===============

// 初始化Agent残存记忆
router.post('/agent', (req: Request, res: Response) => {
  const { agentId, dimension } = req.body;
  if (!agentId) {
    res.status(400).json({ code: 1, message: 'agentId is required' });
    return;
  }
  const state = residualMemoryService.initializeAgent(agentId, dimension || 64);
  res.json({ code: 0, data: { agentId: state.agentId, dimension: state.dimension, version: state.version } });
});

// 获取Agent残存状态
router.get('/agent/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const state = residualMemoryService.getState(agentId);
  if (!state) {
    res.status(404).json({ code: 1, message: 'Agent state not found' });
    return;
  }
  res.json({ code: 0, data: state });
});

// 更新隐状态
router.post('/agent/:agentId/hidden-state', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { inputVector } = req.body;
  if (!inputVector || !Array.isArray(inputVector)) {
    res.status(400).json({ code: 1, message: 'inputVector (number[]) is required' });
    return;
  }
  const success = residualMemoryService.updateHiddenState(agentId, inputVector);
  res.json({ code: 0, data: { success } });
});

// 记录邻居快照
router.post('/agent/:agentId/neighbor-snapshot', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { neighborId, lastKnownState, ttl } = req.body;
  if (!neighborId) {
    res.status(400).json({ code: 1, message: 'neighborId is required' });
    return;
  }
  const success = residualMemoryService.recordNeighborSnapshot(agentId, {
    agentId: neighborId,
    lastKnownState: lastKnownState || {},
    snapshotAt: Date.now() / 1000,
    ttl: ttl || 3600,
    isValid: true,
  });
  res.json({ code: 0, data: { success } });
});

// 记录威胁快照
router.post('/agent/:agentId/threat-snapshot', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { threatId, threatType, severity, lastKnownPosition, ttl } = req.body;
  if (!threatId) {
    res.status(400).json({ code: 1, message: 'threatId is required' });
    return;
  }
  const success = residualMemoryService.recordThreatSnapshot(agentId, {
    threatId,
    threatType: threatType || 'UNKNOWN',
    severity: severity || 0.5,
    lastKnownPosition: lastKnownPosition || {},
    snapshotAt: Date.now() / 1000,
    ttl: ttl || 1800,
    isValid: true,
  });
  res.json({ code: 0, data: { success } });
});

// 标记断链
router.post('/agent/:agentId/disconnect', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const success = residualMemoryService.markDisconnected(agentId);
  res.json({ code: 0, data: { success, note: 'Agent凭h_i继续运行(残存记忆), 无需中央重规划' } });
});

// 断链期间动作记录
router.post('/agent/:agentId/disconnected-action', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { actionType, actionParams } = req.body;
  if (!actionType) {
    res.status(400).json({ code: 1, message: 'actionType is required' });
    return;
  }
  const success = residualMemoryService.recordActionDuringDisconnection(agentId, actionType, actionParams || {});
  res.json({ code: 0, data: { success } });
});

// 反熵同步
router.post('/agent/:agentId/anti-entropy-sync', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { remoteVersion, remoteState } = req.body;
  if (remoteVersion === undefined) {
    res.status(400).json({ code: 1, message: 'remoteVersion is required' });
    return;
  }
  const result = residualMemoryService.performAntiEntropySync(agentId, remoteVersion, remoteState || {});
  res.json({
    code: 0,
    data: result,
    theorem: 'Theorem 4.2: T_GRU ≪ T_noMem (残存记忆系统恢复远快于无记忆重规划)',
  });
});

// 获取有效邻居快照
router.get('/agent/:agentId/neighbors', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const snapshots = residualMemoryService.getValidNeighborSnapshots(agentId);
  res.json({ code: 0, data: snapshots });
});

// 获取有效威胁快照
router.get('/agent/:agentId/threats', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const snapshots = residualMemoryService.getValidThreatSnapshots(agentId);
  res.json({ code: 0, data: snapshots });
});

// 残存记忆统计(定理4.2验证)
router.get('/stats', (_req: Request, res: Response) => {
  const stats = residualMemoryService.getStats();
  res.json({ code: 0, data: stats });
});

// 反熵同步历史
router.get('/sync-history', (req: Request, res: Response) => {
  const { agentId } = req.query;
  const limit = parseInt(req.query.limit as string) || 20;
  const history = residualMemoryService.getSyncHistory(agentId as string | undefined, limit);
  res.json({ code: 0, data: history });
});

// 清理过期快照
router.post('/cleanup', (_req: Request, res: Response) => {
  const result = residualMemoryService.cleanupExpiredSnapshots();
  res.json({ code: 0, data: result });
});

// =============== Gossip同步 ===============

// 注册Agent到Gossip网络
router.post('/gossip/agent', (req: Request, res: Response) => {
  const { agentId, fanout } = req.body;
  if (!agentId) {
    res.status(400).json({ code: 1, message: 'agentId is required' });
    return;
  }
  const state = gossipSyncService.registerAgent(agentId, fanout || 3);
  res.json({ code: 0, data: { agentId: state.agentId, fanout: state.fanout } });
});

// 添加邻居
router.post('/gossip/neighbor', (req: Request, res: Response) => {
  const { agentId, neighborId } = req.body;
  if (!agentId || !neighborId) {
    res.status(400).json({ code: 1, message: 'agentId and neighborId are required' });
    return;
  }
  const success = gossipSyncService.addNeighbor(agentId, neighborId);
  res.json({ code: 0, data: { success } });
});

// 发送Gossip消息
router.post('/gossip/send', (req: Request, res: Response) => {
  const { sourceAgent, messageType, payload, priority, ttl } = req.body;
  if (!sourceAgent || !messageType) {
    res.status(400).json({ code: 1, message: 'sourceAgent and messageType are required' });
    return;
  }
  const result = gossipSyncService.sendGossip(
    sourceAgent,
    messageType as GossipMessageType,
    payload || {},
    priority !== undefined ? priority as GossipPriority : GossipPriority.MEDIUM,
    ttl || 3600
  );
  res.json({ code: 0, data: result });
});

// 执行Gossip传播轮次
router.post('/gossip/round', (_req: Request, res: Response) => {
  const result = gossipSyncService.runGossipRound();
  res.json({ code: 0, data: result });
});

// Agent心跳
router.post('/gossip/heartbeat/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const success = gossipSyncService.heartbeat(agentId);
  res.json({ code: 0, data: { success } });
});

// 检测离线Agent
router.get('/gossip/offline', (req: Request, res: Response) => {
  const timeout = parseInt(req.query.timeout as string) || 120;
  const offline = gossipSyncService.detectOfflineAgents(timeout);
  res.json({ code: 0, data: { offlineAgents: offline } });
});

// Gossip统计
router.get('/gossip/stats', (_req: Request, res: Response) => {
  const stats = gossipSyncService.getStats();
  res.json({
    code: 0,
    data: stats,
    prophecyP1: '50节点AgentWeb中, 异构边(Typed Edge)组任务完成率比同构组高15%',
  });
});

// TTL缓存查询
router.get('/gossip/cache/:agentId/:key', (req: Request, res: Response) => {
  const { agentId, key } = req.params;
  const entry = gossipSyncService.queryCache(agentId, key);
  if (!entry) {
    res.status(404).json({ code: 1, message: 'Cache entry not found or expired' });
    return;
  }
  res.json({ code: 0, data: entry });
});

export default router;
