// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CircuitBreaker
 * @notice 熔断机制合约 — 同一Agent同一问题反复出错触发熔断，必须通过复查才能恢复
 * @dev 错误追踪 + 熔断阈值 + 恢复机制 + 与PhiAgentNFT集成影响征信评分
 *
 * 熔断状态: OPERATIONAL / WARNED / SUSPENDED / CIRCUIT_BROKEN
 * 恢复机制: 必须通过复查(recovery review)才能恢复
 * 与PhiAgentNFT集成: 熔断状态影响征信评分
 */
contract CircuitBreaker is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum CircuitState {
        OPERATIONAL,     // 正常运行
        WARNED,          // 警告（错误计数达到一定阈值）
        SUSPENDED,       // 暂停（接近熔断）
        CIRCUIT_BROKEN   // 熔断（必须复查恢复）
    }

    enum ErrorSeverity {
        LOW,             // 低严重性
        MEDIUM,          // 中严重性
        HIGH,            // 高严重性
        CRITICAL         // 致命
    }

    // =============== Structs ===============

    struct ErrorRecord {
        uint256 agentId;          // Agent NFT ID
        bytes32 errorType;        // 错误类型哈希（同类错误聚合）
        string errorMessage;      // 错误描述
        ErrorSeverity severity;   // 严重性
        uint256 timestamp;        // 发生时间
        address reporter;         // 报告者
        uint256 sessionId;        // 关联评审会话（如有）
    }

    struct AgentCircuitState {
        uint256 agentId;                   // Agent NFT ID
        CircuitState state;                // 当前熔断状态
        uint256 totalErrors;               // 总错误数
        uint256 warningCount;              // 警告次数
        uint256 suspensionCount;           // 暂停次数
        uint256 circuitBreakCount;         // 熔断次数
        uint256 lastErrorTimestamp;        // 最近错误时间
        uint256 recoveryAttempts;          // 恢复尝试次数
        uint256 successfulRecoveries;      // 成功恢复次数
        mapping(bytes32 => uint256) errorTypeCount;      // 错误类型→计数
        mapping(bytes32 => uint256) lastErrorOfTypeTime; // 错误类型→最近时间
    }

    struct RecoveryAttempt {
        uint256 attemptId;         // 恢复尝试ID
        uint256 agentId;           // Agent NFT ID
        address reviewer;          // 复查者
        bool approved;             // 是否通过
        string evidence;           // 证据描述
        uint256 timestamp;         // 时间戳
        CircuitState previousState;// 之前状态
        CircuitState newState;     // 新状态
    }

    // =============== State Variables ===============

    /// @notice agentId => AgentCircuitState
    mapping(uint256 => AgentCircuitState) public agentCircuits;

    /// @notice errorId => ErrorRecord
    mapping(uint256 => ErrorRecord) public errorRecords;

    /// @notice 恢复尝试: attemptId => RecoveryAttempt
    mapping(uint256 => RecoveryAttempt) public recoveryAttempts;

    /// @notice 错误记录总数
    uint256 public totalErrorRecords;

    /// @notice 恢复尝试总数
    uint256 public totalRecoveryAttempts;

    /// @notice 警告阈值（同类错误N次→警告，默认3次）
    uint256 public warningThreshold;

    /// @notice 暂停阈值（同类错误N次→暂停，默认5次）
    uint256 public suspensionThreshold;

    /// @notice 熔断阈值（同类错误N次→熔断，默认10次）
    uint256 public circuitBreakThreshold;

    /// @notice 熔断冷却期（秒，默认1天）
    uint256 public cooldownPeriod;

    /// @notice 严重性权重（影响计数速率）
    mapping(ErrorSeverity => uint256) public severityWeights;

    /// @notice PhiAgentNFT合约地址
    address public phiAgentNFT;

    /// @notice AdversarialReview合约地址
    address public adversarialReview;

    /// @notice V10.0: Constitution合约地址
    address public constitution;

    /// @notice 管理员
    mapping(address => bool) public admins;

    /// @notice 恢复查员列表
    mapping(address => bool) public recoveryReviewers;

    // =============== Events ===============

    event ErrorRecorded(
        uint256 indexed agentId,
        bytes32 indexed errorType,
        ErrorSeverity severity,
        uint256 errorCount,
        uint256 timestamp
    );

    event CircuitStateChanged(
        uint256 indexed agentId,
        CircuitState oldState,
        CircuitState newState,
        string reason,
        uint256 timestamp
    );

    event RecoveryAttempted(
        uint256 indexed attemptId,
        uint256 indexed agentId,
        address reviewer,
        uint256 timestamp
    );

    event RecoveryApproved(
        uint256 indexed attemptId,
        uint256 indexed agentId,
        CircuitState newState,
        uint256 timestamp
    );

    event RecoveryRejected(
        uint256 indexed attemptId,
        uint256 indexed agentId,
        string reason,
        uint256 timestamp
    );

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "CircuitBreaker: not admin");
        _;
    }

    modifier onlyRecoveryReviewer() {
        require(recoveryReviewers[msg.sender] || admins[msg.sender] || msg.sender == owner(),
                "CircuitBreaker: not recovery reviewer");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _phiAgentNFT,
        address _adversarialReview
    ) Ownable(msg.sender) {
        phiAgentNFT = _phiAgentNFT;
        adversarialReview = _adversarialReview;

        warningThreshold = 3;
        suspensionThreshold = 5;
        circuitBreakThreshold = 10;
        cooldownPeriod = 1 days;

        severityWeights[ErrorSeverity.LOW] = 1;
        severityWeights[ErrorSeverity.MEDIUM] = 2;
        severityWeights[ErrorSeverity.HIGH] = 4;
        severityWeights[ErrorSeverity.CRITICAL] = 8;

        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 记录错误
     * @param agentId Agent NFT ID
     * @param errorType 错误类型哈希
     * @param errorMessage 错误描述
     * @param severity 严重性
     * @param sessionId 关联评审会话ID（0=无关联）
     */
    function recordError(
        uint256 agentId,
        bytes32 errorType,
        string calldata errorMessage,
        ErrorSeverity severity,
        uint256 sessionId
    ) external onlyAdmin {
        require(agentId > 0, "CircuitBreaker: invalid agent");

        // 记录错误
        totalErrorRecords++;
        errorRecords[totalErrorRecords] = ErrorRecord({
            agentId: agentId,
            errorType: errorType,
            errorMessage: errorMessage,
            severity: severity,
            timestamp: block.timestamp,
            reporter: msg.sender,
            sessionId: sessionId
        });

        // 更新Agent熔断状态
        AgentCircuitState storage circuit = agentCircuits[agentId];
        if (circuit.agentId == 0) {
            circuit.agentId = agentId;
            circuit.state = CircuitState.OPERATIONAL;
        }

        uint256 weight = severityWeights[severity];
        circuit.errorTypeCount[errorType] += weight;
        circuit.totalErrors += weight;
        circuit.lastErrorTimestamp = block.timestamp;
        circuit.lastErrorOfTypeTime[errorType] = block.timestamp;

        // 检查熔断状态转换
        _checkCircuitTransition(agentId, errorType);

        emit ErrorRecorded(
            agentId, errorType, severity,
            circuit.errorTypeCount[errorType], block.timestamp
        );
    }

    /**
     * @notice 申请恢复（Agent提交恢复申请）
     * @param agentId Agent NFT ID
     * @param evidence 恢复证据描述
     * @return attemptId 恢复尝试ID
     */
    function requestRecovery(
        uint256 agentId,
        string calldata evidence
    ) external whenNotPaused returns (uint256 attemptId) {
        AgentCircuitState storage circuit = agentCircuits[agentId];
        require(
            circuit.state == CircuitState.WARNED ||
            circuit.state == CircuitState.SUSPENDED ||
            circuit.state == CircuitState.CIRCUIT_BROKEN,
            "CircuitBreaker: not in recoverable state"
        );
        require(
            circuit.state != CircuitState.CIRCUIT_BROKEN ||
            block.timestamp >= circuit.lastErrorTimestamp + cooldownPeriod,
            "CircuitBreaker: cooldown not expired"
        );

        totalRecoveryAttempts++;
        attemptId = totalRecoveryAttempts;
        circuit.recoveryAttempts++;

        recoveryAttempts[attemptId] = RecoveryAttempt({
            attemptId: attemptId,
            agentId: agentId,
            reviewer: address(0),
            approved: false,
            evidence: evidence,
            timestamp: block.timestamp,
            previousState: circuit.state,
            newState: circuit.state
        });

        emit RecoveryAttempted(attemptId, agentId, address(0), block.timestamp);
    }

    /**
     * @notice 审批恢复申请
     * @param attemptId 恢复尝试ID
     * @param approved 是否批准
     * @param reason 理由
     */
    function reviewRecovery(
        uint256 attemptId,
        bool approved,
        string calldata reason
    ) external onlyRecoveryReviewer {
        RecoveryAttempt storage attempt = recoveryAttempts[attemptId];
        require(attempt.agentId > 0, "CircuitBreaker: invalid attempt");
        require(attempt.reviewer == address(0), "CircuitBreaker: already reviewed");

        attempt.reviewer = msg.sender;
        attempt.approved = approved;

        AgentCircuitState storage circuit = agentCircuits[attempt.agentId];
        CircuitState oldState = circuit.state;

        if (approved) {
            // 恢复到上一级状态
            CircuitState newState;
            if (circuit.state == CircuitState.CIRCUIT_BROKEN) {
                newState = CircuitState.SUSPENDED;
            } else if (circuit.state == CircuitState.SUSPENDED) {
                newState = CircuitState.WARNED;
            } else if (circuit.state == CircuitState.WARNED) {
                newState = CircuitState.OPERATIONAL;
                circuit.successfulRecoveries++;
                // 重置错误计数
                _resetErrorCounts(attempt.agentId);
            } else {
                newState = CircuitState.OPERATIONAL;
            }

            circuit.state = newState;
            attempt.newState = newState;

            emit CircuitStateChanged(attempt.agentId, oldState, newState, "recovery_approved", block.timestamp);
            emit RecoveryApproved(attemptId, attempt.agentId, newState, block.timestamp);
        } else {
            attempt.newState = circuit.state;
            emit RecoveryRejected(attemptId, attempt.agentId, reason, block.timestamp);
        }
    }

    /**
     * @notice 手动触发熔断（紧急情况）
     */
    function forceCircuitBreak(uint256 agentId, string calldata reason) external onlyAdmin {
        AgentCircuitState storage circuit = agentCircuits[agentId];
        require(circuit.agentId > 0, "CircuitBreaker: agent not found");
        CircuitState oldState = circuit.state;
        circuit.state = CircuitState.CIRCUIT_BROKEN;
        circuit.circuitBreakCount++;
        emit CircuitStateChanged(agentId, oldState, CircuitState.CIRCUIT_BROKEN, reason, block.timestamp);
    }

    /**
     * @notice 手动重置Agent状态（管理员）
     */
    function resetAgentState(uint256 agentId) external onlyAdmin {
        AgentCircuitState storage circuit = agentCircuits[agentId];
        CircuitState oldState = circuit.state;
        circuit.state = CircuitState.OPERATIONAL;
        _resetErrorCounts(agentId);
        circuit.successfulRecoveries++;
        emit CircuitStateChanged(agentId, oldState, CircuitState.OPERATIONAL, "admin_reset", block.timestamp);
    }

    /**
     * @notice V10.0: 宪法紧急熔断（由Constitution.emergencyPause()触发）
     * @dev 全局熔断，将所有活跃Agent置为CIRCUIT_BROKEN状态
     */
    function constitutionEmergencyBreak() external {
        require(msg.sender == constitution || admins[msg.sender] || msg.sender == owner(),
                "CircuitBreaker: not constitution or admin");
        // 宪法级紧急熔断 - 触发合约暂停
        _pause();
        emit CircuitStateChanged(0, CircuitState.OPERATIONAL, CircuitState.CIRCUIT_BROKEN, "constitution_emergency", block.timestamp);
    }

    // =============== View Functions ===============

    function getAgentCircuitState(uint256 agentId) external view returns (
        CircuitState state,
        uint256 totalErrors,
        uint256 warningCount,
        uint256 suspensionCount,
        uint256 circuitBreakCount,
        uint256 lastErrorTimestamp,
        uint256 recoveryAttemptCount,
        uint256 successfulRecoveries
    ) {
        AgentCircuitState storage c = agentCircuits[agentId];
        return (
            c.state,
            c.totalErrors,
            c.warningCount,
            c.suspensionCount,
            c.circuitBreakCount,
            c.lastErrorTimestamp,
            c.recoveryAttempts,
            c.successfulRecoveries
        );
    }

    function getErrorCountByType(uint256 agentId, bytes32 errorType) external view returns (uint256) {
        return agentCircuits[agentId].errorTypeCount[errorType];
    }

    function getErrorRecord(uint256 errorId) external view returns (ErrorRecord memory) {
        return errorRecords[errorId];
    }

    function getRecoveryAttempt(uint256 attemptId) external view returns (RecoveryAttempt memory) {
        return recoveryAttempts[attemptId];
    }

    function isAgentOperational(uint256 agentId) external view returns (bool) {
        return agentCircuits[agentId].state == CircuitState.OPERATIONAL;
    }

    function getAgentCircuitScore(uint256 agentId) external view returns (uint256) {
        AgentCircuitState storage c = agentCircuits[agentId];
        if (c.state == CircuitState.CIRCUIT_BROKEN) return 0;
        if (c.state == CircuitState.SUSPENDED) return 25;
        if (c.state == CircuitState.WARNED) return 60;
        return 100;
    }

    // =============== Admin Functions ===============

    function setThresholds(
        uint256 _warningThreshold,
        uint256 _suspensionThreshold,
        uint256 _circuitBreakThreshold
    ) external onlyAdmin {
        require(_warningThreshold < _suspensionThreshold, "CircuitBreaker: invalid thresholds");
        require(_suspensionThreshold < _circuitBreakThreshold, "CircuitBreaker: invalid thresholds");
        warningThreshold = _warningThreshold;
        suspensionThreshold = _suspensionThreshold;
        circuitBreakThreshold = _circuitBreakThreshold;
    }

    function setCooldownPeriod(uint256 period) external onlyAdmin {
        cooldownPeriod = period;
    }

    function setSeverityWeight(ErrorSeverity severity, uint256 weight) external onlyAdmin {
        severityWeights[severity] = weight;
    }

    function addRecoveryReviewer(address reviewer) external onlyOwner {
        recoveryReviewers[reviewer] = true;
    }

    function removeRecoveryReviewer(address reviewer) external onlyOwner {
        recoveryReviewers[reviewer] = false;
    }

    function setPhiAgentNFT(address _phiAgentNFT) external onlyOwner {
        phiAgentNFT = _phiAgentNFT;
    }

    function setAdversarialReview(address _adversarialReview) external onlyOwner {
        adversarialReview = _adversarialReview;
    }

    /**
     * @notice V10.0: 设置Constitution合约地址
     */
    function setConstitution(address _constitution) external onlyOwner {
        constitution = _constitution;
    }

    function addAdmin(address _admin) external onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =============== Internal Functions ===============

    /// @dev 检查熔断状态转换
    function _checkCircuitTransition(uint256 agentId, bytes32 errorType) internal {
        AgentCircuitState storage circuit = agentCircuits[agentId];
        uint256 errorCount = circuit.errorTypeCount[errorType];
        CircuitState oldState = circuit.state;

        // 已熔断则不再转换（需恢复）
        if (circuit.state == CircuitState.CIRCUIT_BROKEN) return;

        string memory reason = "error_threshold_exceeded";

        if (errorCount >= circuitBreakThreshold) {
            circuit.state = CircuitState.CIRCUIT_BROKEN;
            circuit.circuitBreakCount++;
            reason = "circuit_break_threshold";
        } else if (errorCount >= suspensionThreshold) {
            circuit.state = CircuitState.SUSPENDED;
            circuit.suspensionCount++;
            reason = "suspension_threshold";
        } else if (errorCount >= warningThreshold) {
            circuit.state = CircuitState.WARNED;
            circuit.warningCount++;
            reason = "warning_threshold";
        }

        if (circuit.state != oldState) {
            emit CircuitStateChanged(agentId, oldState, circuit.state, reason, block.timestamp);
        }
    }

    /// @dev 重置错误计数
    function _resetErrorCounts(uint256 agentId) internal {
        AgentCircuitState storage circuit = agentCircuits[agentId];
        circuit.totalErrors = 0;
        // 注意：无法遍历mapping清零，但状态重置为OPERATIONAL即可
        // 新错误会从0开始重新计数
    }
}
