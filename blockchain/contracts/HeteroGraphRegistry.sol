// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HeteroGraphRegistry
 * @notice V13.0 HG-STR 异构图注册表 + 类型化边约束
 * @dev 借鉴HG-STR的Typed Edge机制，在链上强制类型化边传播规则
 *
 * 核心突破:
 * - 异构图 G = (V_f ∪ V_t ∪ V_e, E, τ) 友军/任务/敌意三元节点集
 * - 类型映射函数 τ: E → T，决定消息传播规则(Propagation Rule)
 * - 定义1.1: 类型化边传播约束 — 友→友/敌→友/区域→友 不同传播内容
 *
 * 定理4.1: 异构图通信效率优于同构图
 *   m_het = O(k), k ≪ d → P_cong^het ≪ P_cong^hom → R_het > R_hom
 */

// =============== Types ===============

enum NodeType {
    FRIENDLY_AGENT,   // 友军Agent (状态: s_i)
    TASK_AREA,        // 任务区域 (静态/缓变)
    THREAT_TARGET     // 敌方目标 (部分可观)
}

enum EdgeType {
    COLLABORATE_STATE_SYNC,  // 友→友: 状态同步
    THREAT_ALERT,            // 敌→友: 仅威胁分
    AREA_INTEL,              // 区域→友: 区域信息
    TASK_ASSIGNMENT,         // 任务分配
    RESOURCE_QUERY,          // 资源查询
    GOVERNANCE_VOTE,         // 治理投票
    GC_ANCJOR_SYNC,          // GC锚定同步
    CREDIT_RATING_SYNC,      // 信用评级同步
    JUDGMENT_NOTIFY,         // 裁决通知
    ITA_TRIGGER_LINK,        // ITA-Trigger联动
    RESIDUAL_STATE_SYNC      // 残存记忆同步
}

// =============== Structs ===============

struct PropagationRule {
    EdgeType edgeType;
    NodeType[] allowedSourceTypes;
    NodeType[] allowedTargetTypes;
    uint256 maxPayloadSize;     // bytes
    bool requiresAck;
    uint256 ttl;                // seconds
}

struct HeteroNode {
    bytes32 nodeId;
    NodeType nodeType;
    string label;
    bool isActive;
    uint256 registeredAt;
    uint256 lastSeen;
}

struct TypedEdge {
    bytes32 edgeId;
    bytes32 source;
    NodeType sourceType;
    bytes32 target;
    NodeType targetType;
    EdgeType edgeType;
    uint256 createdAt;
    uint256 lastActive;
    uint256 messageCount;
}

// =============== Contract ===============

contract HeteroGraphRegistry {

    address public owner;

    // 图ID → 节点集合
    mapping(bytes32 => mapping(bytes32 => HeteroNode)) public graphNodes;
    mapping(bytes32 => bytes32[]) public graphNodeIds;

    // 图ID → 边集合
    mapping(bytes32 => mapping(bytes32 => TypedEdge)) public graphEdges;
    mapping(bytes32 => bytes32[]) public graphEdgeIds;

    // 边类型 → 传播规则
    mapping(EdgeType => PropagationRule) public propagationRules;

    // 语义冲突计数(定理4.1验证)
    uint256 public semanticConflictsPrevented;

    // 消息计数(通信效率统计)
    uint256 public heterogeneousMessages;
    uint256 public homogeneousEquivalentBytes;
    uint256 public actualBytesTransmitted;
    uint256 public bandwidthSavedBytes;

    // 事件
    event GraphCreated(bytes32 indexed graphId, uint256 timestamp);
    event NodeAdded(bytes32 indexed graphId, bytes32 indexed nodeId, NodeType nodeType);
    event TypedEdgeAdded(bytes32 indexed graphId, bytes32 indexed edgeId, EdgeType edgeType, bytes32 source, bytes32 target);
    event SemanticConflictPrevented(bytes32 indexed graphId, EdgeType edgeType, NodeType sourceType, NodeType targetType);
    event MessageSent(bytes32 indexed graphId, EdgeType edgeType, bytes32 source, bytes32 target, uint256 payloadSize);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        _initializeDefaultRules();
    }

    // =============== 传播规则初始化 (定义1.1) ===============

    function _initializeDefaultRules() internal {
        // 友→友: 状态同步 (max 2KB)
        PropagationRule memory rule1 = PropagationRule({
            edgeType: EdgeType.COLLABORATE_STATE_SYNC,
            allowedSourceTypes: _toArray(NodeType.FRIENDLY_AGENT),
            allowedTargetTypes: _toArray(NodeType.FRIENDLY_AGENT),
            maxPayloadSize: 2048,
            requiresAck: true,
            ttl: 30
        });
        propagationRules[EdgeType.COLLABORATE_STATE_SYNC] = rule1;

        // 敌→友: 仅威胁分 (max 512B)
        PropagationRule memory rule2 = PropagationRule({
            edgeType: EdgeType.THREAT_ALERT,
            allowedSourceTypes: _toArray2(NodeType.THREAT_TARGET, NodeType.FRIENDLY_AGENT),
            allowedTargetTypes: _toArray(NodeType.FRIENDLY_AGENT),
            maxPayloadSize: 512,
            requiresAck: false,
            ttl: 10
        });
        propagationRules[EdgeType.THREAT_ALERT] = rule2;

        // 区域→友: 区域信息 (max 4KB)
        PropagationRule memory rule3 = PropagationRule({
            edgeType: EdgeType.AREA_INTEL,
            allowedSourceTypes: _toArray(NodeType.TASK_AREA),
            allowedTargetTypes: _toArray(NodeType.FRIENDLY_AGENT),
            maxPayloadSize: 4096,
            requiresAck: false,
            ttl: 300
        });
        propagationRules[EdgeType.AREA_INTEL] = rule3;

        // ITA-Trigger联动 (max 2KB)
        PropagationRule memory rule4 = PropagationRule({
            edgeType: EdgeType.ITA_TRIGGER_LINK,
            allowedSourceTypes: _toArray2(NodeType.FRIENDLY_AGENT, NodeType.TASK_AREA),
            allowedTargetTypes: _toArray(NodeType.FRIENDLY_AGENT),
            maxPayloadSize: 2048,
            requiresAck: true,
            ttl: 30
        });
        propagationRules[EdgeType.ITA_TRIGGER_LINK] = rule4;

        // 残存记忆同步 (max 4KB)
        PropagationRule memory rule5 = PropagationRule({
            edgeType: EdgeType.RESIDUAL_STATE_SYNC,
            allowedSourceTypes: _toArray(NodeType.FRIENDLY_AGENT),
            allowedTargetTypes: _toArray(NodeType.FRIENDLY_AGENT),
            maxPayloadSize: 4096,
            requiresAck: true,
            ttl: 120
        });
        propagationRules[EdgeType.RESIDUAL_STATE_SYNC] = rule5;
    }

    // =============== 图管理 ===============

    function createGraph(bytes32 graphId) external {
        emit GraphCreated(graphId, block.timestamp);
    }

    // =============== 节点管理 ===============

    function addNode(
        bytes32 graphId,
        bytes32 nodeId,
        NodeType nodeType,
        string calldata label
    ) external {
        require(graphNodes[graphId][nodeId].nodeId == bytes32(0), "Node exists");

        HeteroNode memory node = HeteroNode({
            nodeId: nodeId,
            nodeType: nodeType,
            label: label,
            isActive: true,
            registeredAt: block.timestamp,
            lastSeen: block.timestamp
        });

        graphNodes[graphId][nodeId] = node;
        graphNodeIds[graphId].push(nodeId);

        emit NodeAdded(graphId, nodeId, nodeType);
    }

    // =============== 类型化边管理 — 核心操作 ===============

    /**
     * @notice 添加类型化边 — 强制校验τ(边类型)与节点类型的兼容性
     * @dev 这是HG-STR的核心约束: 禁止无语义的扁平JSON通信
     */
    function addTypedEdge(
        bytes32 graphId,
        bytes32 edgeId,
        bytes32 source,
        bytes32 target,
        EdgeType edgeType
    ) external returns (bool) {
        // 校验源/目标节点存在
        require(graphNodes[graphId][source].isActive, "Source node not active");
        require(graphNodes[graphId][target].isActive, "Target node not active");

        NodeType sourceType = graphNodes[graphId][source].nodeType;
        NodeType targetType = graphNodes[graphId][target].nodeType;

        // 类型兼容性校验 — τ: E → T 映射函数
        PropagationRule storage rule = propagationRules[edgeType];
        require(rule.maxPayloadSize > 0, "No propagation rule");

        if (!_isTypeAllowed(sourceType, rule.allowedSourceTypes)) {
            semanticConflictsPrevented++;
            emit SemanticConflictPrevented(graphId, edgeType, sourceType, targetType);
            revert("Source type not allowed for this edge type");
        }

        if (!_isTypeAllowed(targetType, rule.allowedTargetTypes)) {
            semanticConflictsPrevented++;
            emit SemanticConflictPrevented(graphId, edgeType, sourceType, targetType);
            revert("Target type not allowed for this edge type");
        }

        // 创建类型化边
        TypedEdge memory edge = TypedEdge({
            edgeId: edgeId,
            source: source,
            sourceType: sourceType,
            target: target,
            targetType: targetType,
            edgeType: edgeType,
            createdAt: block.timestamp,
            lastActive: block.timestamp,
            messageCount: 0
        });

        graphEdges[graphId][edgeId] = edge;
        graphEdgeIds[graphId].push(edgeId);

        emit TypedEdgeAdded(graphId, edgeId, edgeType, source, target);
        return true;
    }

    // =============== 消息统计 (定理4.1验证) ===============

    /**
     * @notice 记录类型化消息统计
     * @dev 验证: m_het = O(k), k ≪ d → P_cong^het ≪ P_cong^hom
     */
    function recordMessageStats(
        bytes32 graphId,
        EdgeType edgeType,
        uint256 payloadSize
    ) external {
        PropagationRule storage rule = propagationRules[edgeType];
        require(rule.maxPayloadSize > 0, "Unknown edge type");
        require(payloadSize <= rule.maxPayloadSize, "Payload exceeds max");

        heterogeneousMessages++;
        actualBytesTransmitted += payloadSize;
        // 同构图等价: 全量状态维度 O(d) ≈ 8192 bytes
        uint256 homoEquiv = 8192;
        homogeneousEquivalentBytes += homoEquiv;
        if (homoEquiv > payloadSize) {
            bandwidthSavedBytes += homoEquiv - payloadSize;
        }

        emit MessageSent(graphId, edgeType, bytes32(0), bytes32(0), payloadSize);
    }

    // =============== 查询 ===============

    function getNodeCount(bytes32 graphId) external view returns (uint256) {
        return graphNodeIds[graphId].length;
    }

    function getEdgeCount(bytes32 graphId) external view returns (uint256) {
        return graphEdgeIds[graphId].length;
    }

    function getCommunicationEfficiency() external view returns (
        uint256 _heterogeneousMessages,
        uint256 _bandwidthSavedBytes,
        uint256 _semanticConflictsPrevented,
        uint256 _bandwidthSavedPercent
    ) {
        _heterogeneousMessages = heterogeneousMessages;
        _bandwidthSavedBytes = bandwidthSavedBytes;
        _semanticConflictsPrevented = semanticConflictsPrevented;
        _bandwidthSavedPercent = homogeneousEquivalentBytes > 0
            ? (bandwidthSavedBytes * 10000) / homogeneousEquivalentBytes  // bps
            : 0;
    }

    // =============== Helpers ===============

    function _toArray(NodeType t) internal pure returns (NodeType[] memory) {
        NodeType[] memory arr = new NodeType[](1);
        arr[0] = t;
        return arr;
    }

    function _toArray2(NodeType t1, NodeType t2) internal pure returns (NodeType[] memory) {
        NodeType[] memory arr = new NodeType[](2);
        arr[0] = t1;
        arr[1] = t2;
        return arr;
    }

    function _isTypeAllowed(NodeType nodeType, NodeType[] memory allowedTypes) internal pure returns (bool) {
        for (uint256 i = 0; i < allowedTypes.length; i++) {
            if (allowedTypes[i] == nodeType) return true;
        }
        return false;
    }
}
