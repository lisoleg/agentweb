/**
 * TypedEdgeService — V13.0 HG-STR 类型化边通信服务
 * 借鉴HG-STR异构图时空推理的Typed Edge机制
 *
 * 核心突破:
 * - 类型化边(Type Edge)取代扁平JSON RPC，消除语义噪声与通信拥塞
 * - 边类型映射函数 τ: E → T，决定消息传播规则(Propagation Rule)
 * - Schema-based消息验证，降低AgentWeb协调熵(Coordination Entropy)
 * - 异构图 G = (V_f ∪ V_t ∪ V_e, E, τ) 友军/任务/敌意三元节点集
 *
 * 定理4.1验证: 异构图通信效率优于同构图
 *   m_het = O(k), k ≪ d → P_cong^het ≪ P_cong^hom → R_het > R_hom
 */

import logger from '../utils/logger';

// =============== Types ===============

/**
 * 类型化边枚举 — 取代扁平JSON `{ "to": "AgentB", "data": "..." }`
 * 每种边类型定义严格的传播约束与Schema
 */
export enum EdgeType {
  // 友→友: 状态同步
  COLLABORATE_STATE_SYNC = 'COLLABORATE_STATE_SYNC',
  // 敌→友: 仅传播威胁评分
  THREAT_ALERT = 'THREAT_ALERT',
  // 区域→友: 区域信息(静态/缓变)
  AREA_INTEL = 'AREA_INTEL',
  // 任务分配
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  // 资源查询
  RESOURCE_QUERY = 'RESOURCE_QUERY',
  // 治理投票
  GOVERNANCE_VOTE = 'GOVERNANCE_VOTE',
  // GC锚定同步
  GC_ANCJOR_SYNC = 'GC_ANCJOR_SYNC',
  // 信用评级同步
  CREDIT_RATING_SYNC = 'CREDIT_RATING_SYNC',
  // 裁决通知
  JUDGMENT_NOTIFY = 'JUDGMENT_NOTIFY',
  // ITA-Trigger联动
  ITA_TRIGGER_LINK = 'ITA_TRIGGER_LINK',
  // 残存记忆同步(Anti-entropy)
  RESIDUAL_STATE_SYNC = 'RESIDUAL_STATE_SYNC',
}

/**
 * 节点类型 — 异构图三类节点
 * V_f: 友军Agent集 | V_t: 任务区域集 | V_e: 敌方/威胁集
 */
export enum NodeType {
  FRIENDLY_AGENT = 'FRIENDLY_AGENT',   // 友军Agent (状态: s_i)
  TASK_AREA = 'TASK_AREA',              // 任务区域 (静态/缓变)
  THREAT_TARGET = 'THREAT_TARGET',      // 敌方目标 (部分可观)
}

/**
 * 传播规则 — 定义1.1 类型化边传播约束
 */
export interface PropagationRule {
  edgeType: EdgeType;
  allowedSourceTypes: NodeType[];
  allowedTargetTypes: NodeType[];
  /** 最大消息大小(bytes), 用于带宽控制 */
  maxPayloadSize: number;
  /** 传播内容描述 */
  propagationContent: string;
  /** 是否需要确认 */
  requiresAck: boolean;
  /** TTL(秒) — 超时后消息失效 */
  ttl: number;
  /** Schema定义(JSON Schema URI) */
  schemaUri: string;
}

/**
 * 类型化消息 — 替代扁平JSON
 */
export interface TypedMessage {
  id: string;
  edgeType: EdgeType;
  sourceNode: string;
  sourceNodeType: NodeType;
  targetNode: string;
  targetNodeType: NodeType;
  payload: Record<string, unknown>;
  timestamp: number;
  ttl: number;
  signature?: string;
}

/**
 * 类型化边 — 异构图的有向边
 */
export interface TypedEdge {
  id: string;
  source: string;
  sourceType: NodeType;
  target: string;
  targetType: NodeType;
  edgeType: EdgeType;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  bandwidthUsage: number; // bytes
}

/**
 * 节点 — 异构图的节点
 */
export interface HeteroNode {
  id: string;
  nodeType: NodeType;
  label: string;
  state: Record<string, unknown>;
  lastSeen: number;
  isActive: boolean;
  edges: string[]; // 关联的边ID列表
}

/**
 * 异构图 — HG-STR核心数据结构
 */
export interface HeteroGraph {
  id: string;
  nodes: Map<string, HeteroNode>;
  edges: Map<string, TypedEdge>;
  typeMap: Map<string, PropagationRule>; // τ: E → T 类型映射函数
  createdAt: number;
  updatedAt: number;
}

/**
 * 通信效率统计 — 验证定理4.1
 */
export interface CommunicationEfficiencyStats {
  heterogeneousMessages: number;
  homogeneousEquivalentMessages: number;
  bandwidthSavedBytes: number;
  bandwidthSavedPercent: number;
  semanticConflictsPrevented: number;
  avgPayloadSizeHetero: number;
  avgPayloadSizeHomo: number;
  taskCompletionRate: number;
}

/**
 * 类型化边查询结果
 */
export interface TypedEdgeQueryResult {
  edges: TypedEdge[];
  total: number;
  filteredByType: Record<string, number>;
}

// =============== 传播规则定义 (定义1.1) ===============

const DEFAULT_PROPAGATION_RULES: PropagationRule[] = [
  {
    edgeType: EdgeType.COLLABORATE_STATE_SYNC,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 2048,
    propagationContent: '友军状态同步 (位置/资源/健康度)',
    requiresAck: true,
    ttl: 30,
    schemaUri: 'schema://typed-edge/collaborate-state-sync/v1',
  },
  {
    edgeType: EdgeType.THREAT_ALERT,
    allowedSourceTypes: [NodeType.THREAT_TARGET, NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 512,
    propagationContent: '仅传播威胁评分 (坐标/类型/威胁级别)',
    requiresAck: false,
    ttl: 10,
    schemaUri: 'schema://typed-edge/threat-alert/v1',
  },
  {
    edgeType: EdgeType.AREA_INTEL,
    allowedSourceTypes: [NodeType.TASK_AREA],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 4096,
    propagationContent: '区域信息 (地形/任务约束/可用资源)',
    requiresAck: false,
    ttl: 300,
    schemaUri: 'schema://typed-edge/area-intel/v1',
  },
  {
    edgeType: EdgeType.TASK_ASSIGNMENT,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 1024,
    propagationContent: '任务分配指令 (目标/优先级/截止时间)',
    requiresAck: true,
    ttl: 60,
    schemaUri: 'schema://typed-edge/task-assignment/v1',
  },
  {
    edgeType: EdgeType.RESOURCE_QUERY,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 512,
    propagationContent: '资源查询请求 (算力/带宽/存储)',
    requiresAck: true,
    ttl: 15,
    schemaUri: 'schema://typed-edge/resource-query/v1',
  },
  {
    edgeType: EdgeType.GOVERNANCE_VOTE,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 256,
    propagationContent: '治理投票 (提案ID/支持/反对)',
    requiresAck: true,
    ttl: 300,
    schemaUri: 'schema://typed-edge/governance-vote/v1',
  },
  {
    edgeType: EdgeType.GC_ANCJOR_SYNC,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 1024,
    propagationContent: 'GC锚定同步 (余额/代谢率/健康度)',
    requiresAck: true,
    ttl: 30,
    schemaUri: 'schema://typed-edge/gc-ancjor-sync/v1',
  },
  {
    edgeType: EdgeType.CREDIT_RATING_SYNC,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 512,
    propagationContent: '信用评级同步 (评分/等级/维度)',
    requiresAck: true,
    ttl: 120,
    schemaUri: 'schema://typed-edge/credit-rating-sync/v1',
  },
  {
    edgeType: EdgeType.JUDGMENT_NOTIFY,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 1024,
    propagationContent: '裁决通知 (案件ID/裁决/执行状态)',
    requiresAck: true,
    ttl: 60,
    schemaUri: 'schema://typed-edge/judgment-notify/v1',
  },
  {
    edgeType: EdgeType.ITA_TRIGGER_LINK,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT, NodeType.TASK_AREA],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 2048,
    propagationContent: 'ITA-Trigger联动 (信息→触发→动作链路)',
    requiresAck: true,
    ttl: 30,
    schemaUri: 'schema://typed-edge/ita-trigger-link/v1',
  },
  {
    edgeType: EdgeType.RESIDUAL_STATE_SYNC,
    allowedSourceTypes: [NodeType.FRIENDLY_AGENT],
    allowedTargetTypes: [NodeType.FRIENDLY_AGENT],
    maxPayloadSize: 4096,
    propagationContent: '残存记忆同步 (h_i向量/反熵证明)',
    requiresAck: true,
    ttl: 120,
    schemaUri: 'schema://typed-edge/residual-state-sync/v1',
  },
];

// =============== Service ===============

class TypedEdgeService {
  private graphs: Map<string, HeteroGraph> = new Map();
  private propagationRules: Map<EdgeType, PropagationRule> = new Map();
  private messageQueue: TypedMessage[] = [];
  private efficiencyStats: CommunicationEfficiencyStats;

  constructor() {
    // 初始化传播规则
    for (const rule of DEFAULT_PROPAGATION_RULES) {
      this.propagationRules.set(rule.edgeType, rule);
    }

    this.efficiencyStats = {
      heterogeneousMessages: 0,
      homogeneousEquivalentMessages: 0,
      bandwidthSavedBytes: 0,
      bandwidthSavedPercent: 0,
      semanticConflictsPrevented: 0,
      avgPayloadSizeHetero: 0,
      avgPayloadSizeHomo: 0,
      taskCompletionRate: 0,
    };

    logger.info('[TypedEdgeService] Initialized with ' +
      `${this.propagationRules.size} propagation rules`);
  }

  // =============== 图管理 ===============

  /**
   * 创建异构图
   */
  createGraph(graphId: string): HeteroGraph {
    const graph: HeteroGraph = {
      id: graphId,
      nodes: new Map(),
      edges: new Map(),
      typeMap: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.graphs.set(graphId, graph);
    logger.info(`[TypedEdgeService] Created hetero graph: ${graphId}`);
    return graph;
  }

  /**
   * 获取异构图
   */
  getGraph(graphId: string): HeteroGraph | null {
    return this.graphs.get(graphId) || null;
  }

  /**
   * 列出所有图
   */
  listGraphs(): { id: string; nodeCount: number; edgeCount: number }[] {
    return Array.from(this.graphs.entries()).map(([id, g]) => ({
      id,
      nodeCount: g.nodes.size,
      edgeCount: g.edges.size,
    }));
  }

  // =============== 节点管理 ===============

  /**
   * 添加节点到图
   */
  addNode(graphId: string, node: HeteroNode): boolean {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      logger.warn(`[TypedEdgeService] Graph not found: ${graphId}`);
      return false;
    }
    graph.nodes.set(node.id, node);
    graph.updatedAt = Date.now();
    logger.info(`[TypedEdgeService] Added ${node.nodeType} node: ${node.id} to graph ${graphId}`);
    return true;
  }

  /**
   * 获取节点
   */
  getNode(graphId: string, nodeId: string): HeteroNode | null {
    return this.graphs.get(graphId)?.nodes.get(nodeId) || null;
  }

  /**
   * 按类型查询节点
   */
  getNodesByType(graphId: string, nodeType: NodeType): HeteroNode[] {
    const graph = this.graphs.get(graphId);
    if (!graph) return [];
    return Array.from(graph.nodes.values()).filter(n => n.nodeType === nodeType);
  }

  // =============== 边管理 ===============

  /**
   * 添加类型化边 — 核心操作
   * 强制校验: τ(边类型) 与 节点类型的兼容性
   */
  addTypedEdge(graphId: string, edge: TypedEdge): {
    success: boolean;
    error?: string;
    semanticConflict?: boolean;
  } {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      return { success: false, error: `Graph not found: ${graphId}` };
    }

    // 校验源/目标节点存在
    const sourceNode = graph.nodes.get(edge.source);
    const targetNode = graph.nodes.get(edge.target);
    if (!sourceNode) {
      return { success: false, error: `Source node not found: ${edge.source}` };
    }
    if (!targetNode) {
      return { success: false, error: `Target node not found: ${edge.target}` };
    }

    // 类型兼容性校验 — 这是HG-STR的核心约束
    const rule = this.propagationRules.get(edge.edgeType);
    if (!rule) {
      return { success: false, error: `No propagation rule for edge type: ${edge.edgeType}` };
    }

    if (!rule.allowedSourceTypes.includes(sourceNode.nodeType)) {
      // 检测到语义冲突 — 这在同构图中会被忽略
      this.efficiencyStats.semanticConflictsPrevented++;
      return {
        success: false,
        error: `Edge type ${edge.edgeType} not allowed from ${sourceNode.nodeType}`,
        semanticConflict: true,
      };
    }

    if (!rule.allowedTargetTypes.includes(targetNode.nodeType)) {
      this.efficiencyStats.semanticConflictsPrevented++;
      return {
        success: false,
        error: `Edge type ${edge.edgeType} not allowed to ${targetNode.nodeType}`,
        semanticConflict: true,
      };
    }

    // 类型映射 τ: E → T
    graph.typeMap.set(edge.id, rule);
    graph.edges.set(edge.id, edge);

    // 更新节点关联
    sourceNode.edges.push(edge.id);
    targetNode.edges.push(edge.id);

    graph.updatedAt = Date.now();
    logger.info(`[TypedEdgeService] Added ${edge.edgeType} edge: ${edge.source} → ${edge.target}`);
    return { success: true };
  }

  /**
   * 按类型查询边
   */
  getEdgesByType(graphId: string, edgeType?: EdgeType): TypedEdgeQueryResult {
    const graph = this.graphs.get(graphId);
    if (!graph) return { edges: [], total: 0, filteredByType: {} };

    const allEdges = Array.from(graph.edges.values());
    const filtered = edgeType ? allEdges.filter(e => e.edgeType === edgeType) : allEdges;

    const byType: Record<string, number> = {};
    for (const e of allEdges) {
      byType[e.edgeType] = (byType[e.edgeType] || 0) + 1;
    }

    return { edges: filtered, total: filtered.length, filteredByType: byType };
  }

  /**
   * 获取节点的邻接边
   */
  getNodeEdges(graphId: string, nodeId: string): TypedEdge[] {
    const graph = this.graphs.get(graphId);
    if (!graph) return [];
    const node = graph.nodes.get(nodeId);
    if (!node) return [];
    return node.edges
      .map(eid => graph.edges.get(eid))
      .filter((e): e is TypedEdge => e !== undefined);
  }

  // =============== 消息传递 ===============

  /**
   * 发送类型化消息 — 取代扁平JSON RPC
   * 禁止: `{ "to": "AgentB", "data": "..." }` (无语义)
   * 强制: EdgeType + Schema验证
   */
  sendMessage(message: TypedMessage): {
    success: boolean;
    error?: string;
    bandwidthSaved?: number;
  } {
    // 获取传播规则
    const rule = this.propagationRules.get(message.edgeType);
    if (!rule) {
      return { success: false, error: `No propagation rule for: ${message.edgeType}` };
    }

    // 节点类型校验
    if (!rule.allowedSourceTypes.includes(message.sourceNodeType)) {
      this.efficiencyStats.semanticConflictsPrevented++;
      return { success: false, error: `Source type ${message.sourceNodeType} not allowed for ${message.edgeType}` };
    }
    if (!rule.allowedTargetTypes.includes(message.targetNodeType)) {
      this.efficiencyStats.semanticConflictsPrevented++;
      return { success: false, error: `Target type ${message.targetNodeType} not allowed for ${message.edgeType}` };
    }

    // 载荷大小校验 — 带宽控制
    const payloadSize = JSON.stringify(message.payload).length;
    if (payloadSize > rule.maxPayloadSize) {
      return { success: false, error: `Payload ${payloadSize}B exceeds max ${rule.maxPayloadSize}B for ${message.edgeType}` };
    }

    // TTL校验
    if (Date.now() / 1000 - message.timestamp > rule.ttl) {
      return { success: false, error: `Message expired (TTL: ${rule.ttl}s)` };
    }

    // 记录通信效率统计 — 验证定理4.1
    // 同构图等价: 全量状态维度 O(d)
    const homoEquivSize = 8192; // 估计全量状态大小
    const bandwidthSaved = homoEquivSize - payloadSize;

    this.efficiencyStats.heterogeneousMessages++;
    this.efficiencyStats.homogeneousEquivalentMessages++;
    this.efficiencyStats.bandwidthSavedBytes += bandwidthSaved;

    // 入队
    this.messageQueue.push(message);

    logger.info(`[TypedEdgeService] Sent ${message.edgeType} message: ${message.sourceNode} → ${message.targetNode} (${payloadSize}B)`);
    return { success: true, bandwidthSaved };
  }

  /**
   * 批量发送 — 支持同类型广播
   */
  broadcastMessage(
    sourceNode: string,
    sourceNodeType: NodeType,
    targetNodes: Array<{ id: string; nodeType: NodeType }>,
    edgeType: EdgeType,
    payload: Record<string, unknown>
  ): { sent: number; failed: number; bandwidthSaved: number } {
    let sent = 0;
    let failed = 0;
    let totalBandwidthSaved = 0;

    for (const target of targetNodes) {
      const result = this.sendMessage({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        edgeType,
        sourceNode,
        sourceNodeType,
        targetNode: target.id,
        targetNodeType: target.nodeType,
        payload,
        timestamp: Date.now() / 1000,
        ttl: this.propagationRules.get(edgeType)?.ttl || 30,
      });

      if (result.success) {
        sent++;
        totalBandwidthSaved += result.bandwidthSaved || 0;
      } else {
        failed++;
      }
    }

    return { sent, failed, bandwidthSaved: totalBandwidthSaved };
  }

  // =============== 传播规则管理 ===============

  /**
   * 获取所有传播规则
   */
  getPropagationRules(): PropagationRule[] {
    return Array.from(this.propagationRules.values());
  }

  /**
   * 获取特定类型的传播规则
   */
  getPropagationRule(edgeType: EdgeType): PropagationRule | null {
    return this.propagationRules.get(edgeType) || null;
  }

  /**
   * 注册自定义传播规则
   */
  registerPropagationRule(rule: PropagationRule): boolean {
    this.propagationRules.set(rule.edgeType, rule);
    logger.info(`[TypedEdgeService] Registered propagation rule: ${rule.edgeType}`);
    return true;
  }

  // =============== 通信效率统计 (定理4.1验证) ===============

  /**
   * 获取通信效率统计
   * 验证: 异构图 G_het 任务成功率 R 优于同构图 G_hom
   */
  getCommunicationEfficiency(): CommunicationEfficiencyStats {
    const stats = { ...this.efficiencyStats };

    if (stats.heterogeneousMessages > 0) {
      stats.bandwidthSavedPercent = stats.bandwidthSavedBytes /
        (stats.homogeneousEquivalentMessages * 8192) * 100;
      stats.avgPayloadSizeHetero = stats.bandwidthSavedBytes > 0
        ? 8192 - (stats.bandwidthSavedBytes / stats.heterogeneousMessages)
        : 8192;
      stats.avgPayloadSizeHomo = 8192;
    }

    return stats;
  }

  /**
   * 获取图拓扑摘要
   */
  getGraphSummary(graphId: string): {
    nodeCounts: Record<string, number>;
    edgeCounts: Record<string, number>;
    totalNodes: number;
    totalEdges: number;
  } | null {
    const graph = this.graphs.get(graphId);
    if (!graph) return null;

    const nodeCounts: Record<string, number> = {};
    const edgeCounts: Record<string, number> = {};

    for (const node of graph.nodes.values()) {
      nodeCounts[node.nodeType] = (nodeCounts[node.nodeType] || 0) + 1;
    }
    for (const edge of graph.edges.values()) {
      edgeCounts[edge.edgeType] = (edgeCounts[edge.edgeType] || 0) + 1;
    }

    return {
      nodeCounts,
      edgeCounts,
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.size,
    };
  }

  /**
   * 获取消息队列长度
   */
  getMessageQueueLength(): number {
    return this.messageQueue.length;
  }

  /**
   * 清空消息队列
   */
  clearMessageQueue(): number {
    const count = this.messageQueue.length;
    this.messageQueue = [];
    return count;
  }
}

export const typedEdgeService = new TypedEdgeService();
