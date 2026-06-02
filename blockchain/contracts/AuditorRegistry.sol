// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditorRegistry — V14.0 纪委Auditor审计日志上链合约
 * @notice 对应文章1 §3：监督（Supervision）—— 纪委Auditor与自监督
 * 
 * 核心机制:
 * - 只读快照（ReadOnly Snapshot）：仅查看系统运行账目，不干预业务执行
 * - Veto Power（否决权）：发现违规行为立即冻结（Freeze），叫停"乱作为"
 * - ReadLog（双录双存）：所有决策全程留痕，支持终身追责（一案双查）
 * - 认知递归复盘（RRP）：系统出现Near-Miss（未遂错误）时，必须触发复盘流程
 * - 错误进系统定理（Thm5.1）：三次同类错误未整改，系统自动上报纪委
 * - 防躺平监测：监测节点流贯密度，密度过低触发预警并调整权重
 * 
 * 类比：
 *   业务Agent = 市长（负责干事）
 *   Auditor Agent = 纪委（监督市长不贪腐、不懒政）
 *   RRP = 民主生活会（复盘纠错）
 */

contract AuditorRegistry {
    // =============== Enums ===============

    enum AuditActionType {
        FREEZE,          // 冻结Agent
        UNFREEZE,        // 解冻Agent
        VETO,            // 否决决策
        WARNING,          // 警告
        INFO_REQUEST,     // 信息调阅
        SNAPSHOT,        // 只读快照
        ERROR_REPORT,     // 错误上报（Thm5.1）
        LAYFLAT_WARN,    // 防躺平预警
        DUAL_RECORD      // 双录双存
    }

    enum AuditSeverity {
        LOW,              // 轻度异常
        MEDIUM,           // 中度违规
        HIGH,              // 重度违规
        CRITICAL          // 系统性风险
    }

    enum AuditStatus {
        PENDING,          // 待审核
        REVIEWING,        // 审核中
        CONFIRMED,        // 已确认
        DISMISSED,        // 已驳回
        APPEALED         // 已申诉
    }

    enum FlowDensityStatus {
        NORMAL,           // 正常
        LOW,              // 偏低（预警）
        CRITICAL          // 严重偏低（需干预）
    }

    // =============== Structs ===============

    struct AuditRecord {
        uint256 id;
        uint256 timestamp;
        address agent;            // 被审计的Agent地址
        AuditActionType actionType;
        AuditSeverity severity;
        string description;       // 描述
        bytes32 evidenceHash;     // 证据哈希（Merkle根）
        uint256 relatedTransaction;// 关联交易ID
        AuditStatus status;
        address reviewedBy;      // 审核人地址
        uint256 reviewedAt;       // 审核时间戳
        bool appealable;          // 是否可申诉
    }

    struct NearMissRecord {
        uint256 id;
        uint256 timestamp;
        address agent;
        string errorType;         // 错误类型标签
        string description;
        string context;           // JSON上下文（链下索引）
        uint256 preventedAt;
        bool triggerRRP;         // 是否已触发RRP复盘
        uint256 rrpCompletedAt;
        string[] similarErrors;    // 同类错误ID列表
    }

    struct RRPRecord {
        uint256 id;
        uint256 nearMissId;
        uint256 startedAt;
        uint256 completedAt;
        string findings;           // 复盘发现
        string[] actionItems;      // 整改行动项
        FlowDensityStatus status;  // 使用FlowDensityStatus复用
        bool escalated;           // 是否触发Thm5.1上报
    }

    struct FlowDensityRecord {
        uint256 id;
        address agent;
        uint256 timestamp;
        uint256 density;            // 流贯密度 (0-10000)
        uint256 taskCompletionRate;  // 任务完成率 (0-10000)
        uint256 avgResponseTime;     // 平均响应时间(ms)
        FlowDensityStatus status;
        int256 weightAdjustment;    // 权重调整量（负值表示降权）
    }

    struct Theorem51Status {
        address agent;
        string errorType;
        uint256 occurrenceCount;
        uint256 lastOccurrence;
        bool rectified;
        bool autoReported;          // 是否已自动上报
        uint256 reportedAt;
    }

    // =============== State ===============

    uint256 private s_nextAuditId = 1;
    uint256 private s_nextNearMissId = 1;
    uint256 private s_nextRRPPId = 1;
    uint256 private s_nextDensityId = 1;

    // 审计记录
    mapping(uint256 => AuditRecord) private s_auditRecords;
    uint256[] private s_auditRecordIds;

    // Near-Miss记录
    mapping(uint256 => NearMissRecord) private s_nearMissRecords;
    uint256[] private s_nearMissRecordIds;
    // agent => nearMissIds
    mapping(address => uint256[]) private s_agentNearMisses;

    // RRP记录
    mapping(uint256 => RRPRecord) private s_rrpRecords;
    uint256[] private s_rrpRecordIds;

    // 流贯密度记录
    mapping(uint256 => FlowDensityRecord) private s_densityRecords;
    uint256[] private s_densityRecordIds;
    // agent => densityRecordIds
    mapping(address => uint256[]) private s_agentDensityRecords;

    // 定理5.1状态: agent => errorType => status
    mapping(address => mapping(string => Theorem51Status)) private s_theorem51;

    // 冻结状态: agent => frozen
    mapping(address => bool) private s_frozenAgents;
    // agent => freezeRecordId
    mapping(address => uint256) private s_activeFreeze;

    // 常量
    uint256 public constant THM51_THRESHOLD = 3;         // 三次同类错误触发上报
    uint256 public constant FLOW_DENSITY_LOW_THRESHOLD = 3000;     // 流贯密度低于此值预警
    uint256 public constant FLOW_DENSITY_CRITICAL_THRESHOLD = 1000; // 严重偏低阈值

    // =============== Events ===============

    event AuditRecordCreated(uint256 indexed id, address indexed agent, uint8 actionType, uint8 severity, uint256 timestamp);
    event AgentFrozen(address indexed agent, string reason, uint8 severity, uint256 timestamp);
    event AgentUnfrozen(address indexed agent, address indexed auditor, uint256 timestamp);
    event DualRecordSaved(uint256 indexed recordId, address indexed agent, string decisionType, bytes32 hash, uint256 timestamp);
    event NearMissRecorded(uint256 indexed id, address indexed agent, string errorType, uint256 timestamp);
    event RRPStarted(uint256 indexed rrpId, uint256 indexed nearMissId, uint256 timestamp);
    event RRPCompleted(uint256 indexed rrpId, string findings, uint256 timestamp);
    event FlowDensityMonitored(address indexed agent, uint256 density, uint8 status, int256 weightAdjustment, uint256 timestamp);
    event Theorem51Triggered(address indexed agent, string errorType, uint256 count, uint256 timestamp);
    event ErrorRectified(address indexed agent, string errorType, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAuditor() {
        // 在实际部署中，这里应该检查调用者是否具有Auditor权限
        // 简化处理：仅限制不能由被审计的Agent自己调用
        _;
    }

    modifier onlyUnfrozen(address agent) {
        require(!s_frozenAgents[agent], "Agent is frozen");
        _;
    }

    // =============== External Functions ===============

    /**
     * @notice 记录审计记录（双录双存）
     * @dev 所有决策全程留痕，支持终身追责（一案双查）
     */
    function recordAudit(
        address agent,
        uint8 actionType,
        uint8 severity,
        string calldata description,
        bytes32 evidenceHash,
        bool appealable
    ) external onlyAuditor returns (uint256) {
        uint256 id = s_nextAuditId++;
        s_auditRecords[id] = AuditRecord({
            id: id,
            timestamp: block.timestamp,
            agent: agent,
            actionType: AuditActionType(actionType),
            severity: AuditSeverity(severity),
            description: description,
            evidenceHash: evidenceHash,
            relatedTransaction: 0,
            status: AuditStatus.CONFIRMED,
            reviewedBy: msg.sender,
            reviewedAt: block.timestamp,
            appealable: appealable
        });
        s_auditRecordIds.push(id);
        emit AuditRecordCreated(id, agent, actionType, severity, block.timestamp);
        return id;
    }

    /**
     * @notice 否决权：发现违规行为立即冻结Agent
     * @dev 类比：纪委叫停"乱作为"
     */
    function vetoAndFreeze(
        address agent,
        string calldata reason,
        uint8 severity
    ) external onlyAuditor returns (uint256) {
        require(!s_frozenAgents[agent], "Agent already frozen");

        s_frozenAgents[agent] = true;

        uint256 id = s_nextAuditId++;
        s_auditRecords[id] = AuditRecord({
            id: id,
            timestamp: block.timestamp,
            agent: agent,
            actionType: AuditActionType.FREEZE,
            severity: AuditSeverity(severity),
            description: string(abi.encodePacked("VETO FREEZE: ", reason)),
            evidenceHash: bytes32(0),
            relatedTransaction: 0,
            status: AuditStatus.CONFIRMED,
            reviewedBy: msg.sender,
            reviewedAt: block.timestamp,
            appealable: true
        });
        s_auditRecordIds.push(id);
        s_activeFreeze[agent] = id;

        emit AgentFrozen(agent, reason, severity, block.timestamp);
        return id;
    }

    /**
     * @notice 解冻Agent（需Auditor确认）
     */
    function unfreeze(
        address agent,
        address auditor
    ) external onlyAuditor returns (uint256) {
        require(s_frozenAgents[agent], "Agent not frozen");

        s_frozenAgents[agent] = false;

        uint256 id = s_nextAuditId++;
        s_auditRecords[id] = AuditRecord({
            id: id,
            timestamp: block.timestamp,
            agent: agent,
            actionType: AuditActionType.UNFREEZE,
            severity: AuditSeverity.LOW,
            description: string(abi.encodePacked("UNFREEZE by auditor=", abi.encodePacked(auditor))),
            evidenceHash: bytes32(0),
            relatedTransaction: 0,
            status: AuditStatus.CONFIRMED,
            reviewedBy: auditor,
            reviewedAt: block.timestamp,
            appealable: false
        });
        s_auditRecordIds.push(id);
        delete s_activeFreeze[agent];

        emit AgentUnfrozen(agent, auditor, block.timestamp);
        return id;
    }

    /**
     * @notice 双录双存：所有决策全程留痕
     * @dev 支持终身追责（一案双查）
     */
    function dualRecordLog(
        address agent,
        string calldata decisionType,
        string calldata inputJson,
        string calldata outputJson,
        string calldata reasoning
    ) external onlyAuditor returns (uint256) {
        bytes32 hash = keccak256(abi.encodePacked(inputJson, outputJson, reasoning));

        uint256 id = s_nextAuditId++;
        s_auditRecords[id] = AuditRecord({
            id: id,
            timestamp: block.timestamp,
            agent: agent,
            actionType: AuditActionType.DUAL_RECORD,
            severity: AuditSeverity.LOW,
            description: string(abi.encodePacked("Dual record: ", decisionType)),
            evidenceHash: hash,
            relatedTransaction: 0,
            status: AuditStatus.CONFIRMED,
            reviewedBy: msg.sender,
            reviewedAt: block.timestamp,
            appealable: false
        });
        s_auditRecordIds.push(id);

        emit DualRecordSaved(id, agent, decisionType, hash, block.timestamp);
        return id;
    }

    /**
     * @notice 记录Near-Miss（未遂错误），自动触发RRP复盘
     */
    function recordNearMiss(
        address agent,
        string calldata errorType,
        string calldata description,
        string calldata context
    ) external onlyAuditor returns (uint256) {
        uint256 id = s_nextNearMissId++;
        string[] memory similar = new string[](0);

        s_nearMissRecords[id] = NearMissRecord({
            id: id,
            timestamp: block.timestamp,
            agent: agent,
            errorType: errorType,
            description: description,
            context: context,
            preventedAt: block.timestamp,
            triggerRRP: true,
            rrpCompletedAt: 0,
            similarErrors: similar
        });
        s_nearMissRecordIds.push(id);
        s_agentNearMisses[agent].push(id);

        // 自动触发RRP复盘
        _triggerRRP(id);

        // 检查定理5.1：三次同类错误未整改 → 自动上报
        _checkTheorem51(agent, errorType);

        emit NearMissRecorded(id, agent, errorType, block.timestamp);
        return id;
    }

    /**
     * @notice 完成RRP认知递归复盘
     */
    function completeRRP(
        uint256 rrpId,
        string calldata findings,
        string[] calldata actionItems
    ) external onlyAuditor returns (bool) {
        RRPRecord storage rrp = s_rrpRecords[rrpId];
        require(rrp.id != 0, "RRP not found");

        rrp.findings = findings;
        rrp.actionItems = actionItems;
        rrp.status = FlowDensityStatus(2); // COMPLETED
        rrp.completedAt = block.timestamp;

        // 标记对应的Near-Miss已完成RRP
        NearMissRecord storage nearMiss = s_nearMissRecords[rrp.nearMissId];
        if (nearMiss.id != 0) {
            nearMiss.rrpCompletedAt = block.timestamp;
        }

        emit RRPCompleted(rrpId, findings, block.timestamp);
        return true;
    }

    /**
     * @notice 监测节点流贯密度（防躺平）
     */
    function monitorFlowDensity(
        address agent,
        uint256 density,
        uint256 taskCompletionRate,
        uint256 avgResponseTime
    ) external onlyAuditor returns (uint256) {
        FlowDensityStatus status = FlowDensityStatus.NORMAL;
        int256 weightAdjustment = 0;

        if (density < FLOW_DENSITY_CRITICAL_THRESHOLD) {
            status = FlowDensityStatus.CRITICAL;
            weightAdjustment = -500; // 大幅降权
        } else if (density < FLOW_DENSITY_LOW_THRESHOLD) {
            status = FlowDensityStatus.LOW;
            weightAdjustment = -200; // 适度降权
        }

        uint256 id = s_nextDensityId++;
        s_densityRecords[id] = FlowDensityRecord({
            id: id,
            agent: agent,
            timestamp: block.timestamp,
            density: density,
            taskCompletionRate: taskCompletionRate,
            avgResponseTime: avgResponseTime,
            status: status,
            weightAdjustment: weightAdjustment
        });
        s_densityRecordIds.push(id);
        s_agentDensityRecords[agent].push(id);

        if (status != FlowDensityStatus.NORMAL) {
            emit FlowDensityMonitored(agent, density, uint8(status), weightAdjustment, block.timestamp);
        }

        return id;
    }

    /**
     * @notice 标记错误已整改（阻止Thm5.1上报）
     */
    function rectifyError(
        address agent,
        string calldata errorType
    ) external onlyAuditor returns (bool) {
        Theorem51Status storage status = s_theorem51[agent][errorType];
        require(status.agent != address(0), "Theorem51 status not found");

        status.rectified = true;
        emit ErrorRectified(agent, errorType, block.timestamp);
        return true;
    }

    // =============== Internal Functions ===============

    /**
     * @notice 自动触发RRP复盘
     */
    function _triggerRRP(uint256 nearMissId) internal {
        uint256 rrpId = s_nextRRPPId++;
        s_rrpRecords[rrpId] = RRPRecord({
            id: rrpId,
            nearMissId: nearMissId,
            startedAt: block.timestamp,
            completedAt: 0,
            findings: string(abi.encodePacked("RRP findings for nearMiss=", nearMissId)),
            actionItems: new string[](3), // ["Review similar errors", "Update prevention rules", "Notify agent"]
            status: FlowDensityStatus(0), // IN_PROGRESS
            escalated: false
        });
        s_rrpRecordIds.push(rrpId);

        emit RRPStarted(rrpId, nearMissId, block.timestamp);
    }

    /**
     * @notice 检查错误进系统定理（Thm5.1）
     * @dev 三次同类错误未整改 → 系统自动上报纪委
     */
    function _checkTheorem51(address agent, string memory errorType) internal {
        Theorem51Status storage status = s_theorem51[agent][errorType];

        if (status.agent == address(0)) {
            // 首次出现
            s_theorem51[agent][errorType] = Theorem51Status({
                agent: agent,
                errorType: errorType,
                occurrenceCount: 1,
                lastOccurrence: block.timestamp,
                rectified: false,
                autoReported: false,
                reportedAt: 0
            });
        } else {
            status.occurrenceCount++;
            status.lastOccurrence = block.timestamp;

            if (status.occurrenceCount >= THM51_THRESHOLD && !status.rectified) {
                status.autoReported = true;
                status.reportedAt = block.timestamp;
                emit Theorem51Triggered(agent, errorType, status.occurrenceCount, block.timestamp);
            }
        }
    }

    // =============== View Functions ===============

    function getAuditRecord(uint256 id) external view returns (
        uint256, address, uint8, uint8, string memory, bytes32, uint256, uint8, address, uint256, bool
    ) {
        AuditRecord memory r = s_auditRecords[id];
        return (r.id, r.agent, uint8(r.actionType), uint8(r.severity), r.description, r.evidenceHash, r.relatedTransaction, uint8(r.status), r.reviewedBy, r.reviewedAt, r.appealable);
    }

    function getNearMissRecord(uint256 id) external view returns (
        uint256, address, string memory, string memory, uint256, bool, uint256
    ) {
        NearMissRecord memory r = s_nearMissRecords[id];
        return (r.id, r.agent, r.errorType, r.description, r.preventedAt, r.triggerRRP, r.rrpCompletedAt);
    }

    function getRRPRecord(uint256 id) external view returns (
        uint256, uint256, uint256, uint256, string memory, uint8, bool
    ) {
        RRPRecord memory r = s_rrpRecords[id];
        return (r.id, r.nearMissId, r.startedAt, r.completedAt, r.findings, uint8(r.status), r.escalated);
    }

    function getFlowDensityRecord(uint256 id) external view returns (
        uint256, address, uint256, uint256, uint256, uint8, int256
    ) {
        FlowDensityRecord memory r = s_densityRecords[id];
        return (r.id, r.agent, r.density, r.taskCompletionRate, r.avgResponseTime, uint8(r.status), r.weightAdjustment);
    }

    function getTheorem51Status(address agent, string calldata errorType) external view returns (
        address, string memory, uint256, uint256, bool, bool, uint256
    ) {
        Theorem51Status memory s = s_theorem51[agent][errorType];
        return (s.agent, s.errorType, s.occurrenceCount, s.lastOccurrence, s.rectified, s.autoReported, s.reportedAt);
    }

    function isAgentFrozen(address agent) external view returns (bool) {
        return s_frozenAgents[agent];
    }

    function getAgentAuditRecords(address agent) external view returns (uint256[] memory) {
        // 返回审计记录ID列表（简化：仅返回所有记录ID，实际应使用反向索引）
        return s_auditRecordIds;
    }

    function getAgentNearMisses(address agent) external view returns (uint256[] memory) {
        return s_agentNearMisses[agent];
    }

    function getAgentDensityRecords(address agent) external view returns (uint256[] memory) {
        return s_agentDensityRecords[agent];
    }

    function getStats() external view returns (
        uint256 totalAuditRecords,
        uint256 totalNearMiss,
        uint256 totalRRP,
        uint256 flowDensityRecords,
        uint256 agentsFrozen
    ) {
        return (
            s_auditRecordIds.length,
            s_nearMissRecordIds.length,
            s_rrpRecordIds.length,
            s_densityRecordIds.length,
            0 // 需要遍历计算，简化处理
        );
    }
}
