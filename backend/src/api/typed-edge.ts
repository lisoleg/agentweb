/**
 * Typed Edge API Routes — V13.0 HG-STR类型化边通信
 * 异构图管理 + 类型化消息传递 + 通信效率统计(定理4.1验证)
 */

import { Router, Request, Response } from 'express';
import { typedEdgeService, EdgeType, NodeType } from '../services/typedEdgeService';

const router = Router();

// =============== 图管理 ===============

// 创建异构图
router.post('/graph', (req: Request, res: Response) => {
  const { graphId } = req.body;
  if (!graphId) {
    res.status(400).json({ code: 1, message: 'graphId is required' });
    return;
  }
  const graph = typedEdgeService.createGraph(graphId);
  res.json({ code: 0, data: { id: graph.id, createdAt: graph.createdAt } });
});

// 列出所有图
router.get('/graph', (_req: Request, res: Response) => {
  const graphs = typedEdgeService.listGraphs();
  res.json({ code: 0, data: graphs });
});

// 获取图拓扑摘要
router.get('/graph/:graphId/summary', (req: Request, res: Response) => {
  const { graphId } = req.params;
  const summary = typedEdgeService.getGraphSummary(graphId);
  if (!summary) {
    res.status(404).json({ code: 1, message: 'Graph not found' });
    return;
  }
  res.json({ code: 0, data: summary });
});

// =============== 节点管理 ===============

// 添加节点
router.post('/graph/:graphId/node', (req: Request, res: Response) => {
  const { graphId } = req.params;
  const { id, nodeType, label, state } = req.body;
  if (!id || !nodeType) {
    res.status(400).json({ code: 1, message: 'id and nodeType are required' });
    return;
  }
  const result = typedEdgeService.addNode(graphId, {
    id,
    nodeType: nodeType as NodeType,
    label: label || id,
    state: state || {},
    lastSeen: Date.now() / 1000,
    isActive: true,
    edges: [],
  });
  res.json({ code: 0, data: { success: result } });
});

// 查询节点
router.get('/graph/:graphId/node/:nodeId', (req: Request, res: Response) => {
  const { graphId, nodeId } = req.params;
  const node = typedEdgeService.getNode(graphId, nodeId);
  if (!node) {
    res.status(404).json({ code: 1, message: 'Node not found' });
    return;
  }
  res.json({ code: 0, data: node });
});

// 按类型查询节点
router.get('/graph/:graphId/nodes/:nodeType', (req: Request, res: Response) => {
  const { graphId, nodeType } = req.params;
  const nodes = typedEdgeService.getNodesByType(graphId, nodeType as NodeType);
  res.json({ code: 0, data: nodes });
});

// =============== 边管理 ===============

// 添加类型化边
router.post('/graph/:graphId/edge', (req: Request, res: Response) => {
  const { graphId } = req.params;
  const { id, source, sourceType, target, targetType, edgeType } = req.body;
  if (!id || !source || !sourceType || !target || !targetType || !edgeType) {
    res.status(400).json({ code: 1, message: 'id, source, sourceType, target, targetType, edgeType are required' });
    return;
  }
  const result = typedEdgeService.addTypedEdge(graphId, {
    id,
    source,
    sourceType: sourceType as NodeType,
    target,
    targetType: targetType as NodeType,
    edgeType: edgeType as EdgeType,
    createdAt: Date.now() / 1000,
    lastActive: Date.now() / 1000,
    messageCount: 0,
    bandwidthUsage: 0,
  });
  if (result.success) {
    res.json({ code: 0, data: { success: true } });
  } else {
    res.status(400).json({ code: 1, message: result.error, semanticConflict: result.semanticConflict });
  }
});

// 按类型查询边
router.get('/graph/:graphId/edges', (req: Request, res: Response) => {
  const { graphId } = req.params;
  const { edgeType } = req.query;
  const result = typedEdgeService.getEdgesByType(graphId, edgeType as EdgeType | undefined);
  res.json({ code: 0, data: result });
});

// 获取节点的邻接边
router.get('/graph/:graphId/node/:nodeId/edges', (req: Request, res: Response) => {
  const { graphId, nodeId } = req.params;
  const edges = typedEdgeService.getNodeEdges(graphId, nodeId);
  res.json({ code: 0, data: edges });
});

// =============== 消息传递 ===============

// 发送类型化消息
router.post('/message', (req: Request, res: Response) => {
  const { edgeType, sourceNode, sourceNodeType, targetNode, targetNodeType, payload, ttl } = req.body;
  if (!edgeType || !sourceNode || !sourceNodeType || !targetNode || !targetNodeType) {
    res.status(400).json({ code: 1, message: 'edgeType, sourceNode, sourceNodeType, targetNode, targetNodeType are required' });
    return;
  }
  const result = typedEdgeService.sendMessage({
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    edgeType: edgeType as EdgeType,
    sourceNode,
    sourceNodeType: sourceNodeType as NodeType,
    targetNode,
    targetNodeType: targetNodeType as NodeType,
    payload: payload || {},
    timestamp: Date.now() / 1000,
    ttl: ttl || 30,
  });
  if (result.success) {
    res.json({ code: 0, data: { success: true, bandwidthSaved: result.bandwidthSaved } });
  } else {
    res.status(400).json({ code: 1, message: result.error });
  }
});

// 批量广播
router.post('/message/broadcast', (req: Request, res: Response) => {
  const { sourceNode, sourceNodeType, targetNodes, edgeType, payload } = req.body;
  if (!sourceNode || !sourceNodeType || !targetNodes || !edgeType) {
    res.status(400).json({ code: 1, message: 'sourceNode, sourceNodeType, targetNodes, edgeType are required' });
    return;
  }
  const result = typedEdgeService.broadcastMessage(
    sourceNode,
    sourceNodeType as NodeType,
    targetNodes,
    edgeType as EdgeType,
    payload || {}
  );
  res.json({ code: 0, data: result });
});

// =============== 传播规则 ===============

// 获取所有传播规则
router.get('/propagation-rules', (_req: Request, res: Response) => {
  const rules = typedEdgeService.getPropagationRules();
  res.json({ code: 0, data: rules });
});

// 获取特定类型传播规则
router.get('/propagation-rules/:edgeType', (req: Request, res: Response) => {
  const { edgeType } = req.params;
  const rule = typedEdgeService.getPropagationRule(edgeType as EdgeType);
  if (!rule) {
    res.status(404).json({ code: 1, message: 'Propagation rule not found' });
    return;
  }
  res.json({ code: 0, data: rule });
});

// =============== 通信效率统计(定理4.1) ===============

router.get('/efficiency', (_req: Request, res: Response) => {
  const stats = typedEdgeService.getCommunicationEfficiency();
  res.json({
    code: 0,
    data: stats,
    theorem: 'Theorem 4.1: R_het > R_hom (异构图任务成功率优于同构图)',
    proof: 'm_het = O(k), k ≪ d → P_cong^het ≪ P_cong^hom',
  });
});

export default router;
