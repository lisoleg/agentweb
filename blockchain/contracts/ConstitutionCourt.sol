// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ConstitutionCourt
 * @notice V11.0 宪法法院 — 宪法修正案的司法审查
 * @dev 独立于Constitution合约的司法审查层
 *      流程: submitConstitutionalCase → VOTING → renderJudgment (UPHOLD/OVERTURN/REMAND)
 *      紧急案件: submitEmergencyCase → PENDING → approveEmergencyCase → VOTING → renderJudgment
 *      投票: 依赖PhiStaking.getVotingPower(), 67%阈值 (6700/10000基点)
 *      OVERTURN: 仅标记修正案FAILED，不自动回滚
 *      REMAND: 仅通知，发回重审
 */
contract ConstitutionCourt is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum CaseState {
        PENDING,    // 等待批准（仅紧急案件）
        VOTING,     // 投票中
        RESOLVED,   // 已判决
        DISMISSED   // 已驳回
    }

    enum JudgmentType {
        NONE,       // 未判决
        UPHOLD,     // 维持修正案
        OVERTURN,   // 推翻修正案（标记FAILED）
        REMAND      // 发回重审（通知）
    }

    // =============== Structs ===============

    struct ConstitutionCase {
        uint256 caseId;
        uint256 amendmentId;
        address filer;
        string reason;
        bytes32 evidenceHash;
        CaseState state;
        bool isEmergency;
        bool emergencyApproved;
        uint256 votingStart;
        uint256 votingEnd;
        uint256 yesVotes;          // 赞成票（维持修正案的voting power总和）
        uint256 noVotes;           // 反对票（推翻/发回的voting power总和）
        uint256 totalVoters;
        JudgmentType judgment;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votePower;
    }

    // =============== State Variables ===============

    /// @notice 案件总数
    uint256 public totalCases;

    /// @notice caseId => ConstitutionCase
    mapping(uint256 => ConstitutionCase) public cases;

    /// @notice 判决通过阈值（基点，6700 = 67%）
    uint256 public approvalThreshold;

    /// @notice 普通案件投票期（默认14天）
    uint256 public standardVotingPeriod;

    /// @notice 紧急案件投票期（默认3天）
    uint256 public emergencyVotingPeriod;

    /// @notice Constitution合约地址
    address public constitution;

    /// @notice PhiStaking合约地址
    address public phiStaking;

    /// @notice 管理员
    mapping(address => bool) public admins;

    /// @notice 案件AI分析报告哈希 (caseId => IPFS hash)
    mapping(uint256 => bytes32) public caseAnalysisHashes;

    /// @notice 案件模拟结果哈希 (caseId => IPFS hash)
    mapping(uint256 => bytes32) public caseSimulationHashes;

    // =============== Events ===============

    event CaseSubmitted(uint256 indexed caseId, uint256 indexed amendmentId, address indexed filer, bool isEmergency, uint256 timestamp);
    event EmergencyCaseApproved(uint256 indexed caseId, address indexed approver, uint256 timestamp);
    event VoteCast(uint256 indexed caseId, address indexed voter, bool support, uint256 votingPower, uint256 timestamp);
    event JudgmentRendered(uint256 indexed caseId, JudgmentType judgment, uint256 yesVotes, uint256 noVotes, uint256 timestamp);
    event CaseDismissed(uint256 indexed caseId, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "ConstitutionCourt: not admin");
        _;
    }

    // =============== Constructor ===============

    constructor(address _constitution, address _phiStaking) Ownable(msg.sender) {
        require(_constitution != address(0), "ConstitutionCourt: zero constitution");
        require(_phiStaking != address(0), "ConstitutionCourt: zero phiStaking");

        constitution = _constitution;
        phiStaking = _phiStaking;
        approvalThreshold = 6700;      // 67%
        standardVotingPeriod = 14 days;
        emergencyVotingPeriod = 3 days;
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 提交普通宪法审查案件
     * @param amendmentId 目标修正案ID
     * @param reason 审查原因
     * @param evidenceHash 证据哈希（IPFS）
     * @return caseId 案件ID
     */
    function submitConstitutionalCase(
        uint256 amendmentId,
        string calldata reason,
        bytes32 evidenceHash
    ) external whenNotPaused returns (uint256 caseId) {
        require(bytes(reason).length > 0, "ConstitutionCourt: empty reason");

        totalCases++;
        caseId = totalCases;

        ConstitutionCase storage c = cases[caseId];
        c.caseId = caseId;
        c.amendmentId = amendmentId;
        c.filer = msg.sender;
        c.reason = reason;
        c.evidenceHash = evidenceHash;
        c.state = CaseState.VOTING;
        c.isEmergency = false;
        c.emergencyApproved = false;
        c.votingStart = block.timestamp;
        c.votingEnd = block.timestamp + standardVotingPeriod;
        c.yesVotes = 0;
        c.noVotes = 0;
        c.totalVoters = 0;
        c.judgment = JudgmentType.NONE;

        emit CaseSubmitted(caseId, amendmentId, msg.sender, false, block.timestamp);
    }

    /**
     * @notice 提交紧急宪法审查案件
     * @param amendmentId 目标修正案ID
     * @param reason 审查原因
     * @param evidenceHash 证据哈希（IPFS）
     * @return caseId 案件ID
     */
    function submitEmergencyCase(
        uint256 amendmentId,
        string calldata reason,
        bytes32 evidenceHash
    ) external whenNotPaused returns (uint256 caseId) {
        require(bytes(reason).length > 0, "ConstitutionCourt: empty reason");

        totalCases++;
        caseId = totalCases;

        ConstitutionCase storage c = cases[caseId];
        c.caseId = caseId;
        c.amendmentId = amendmentId;
        c.filer = msg.sender;
        c.reason = reason;
        c.evidenceHash = evidenceHash;
        c.state = CaseState.PENDING;
        c.isEmergency = true;
        c.emergencyApproved = false;
        c.votingStart = 0;
        c.votingEnd = 0;
        c.yesVotes = 0;
        c.noVotes = 0;
        c.totalVoters = 0;
        c.judgment = JudgmentType.NONE;

        emit CaseSubmitted(caseId, amendmentId, msg.sender, true, block.timestamp);
    }

    /**
     * @notice 批准紧急案件进入投票（仅owner）
     * @param caseId 案件ID
     */
    function approveEmergencyCase(uint256 caseId) external onlyOwner whenNotPaused {
        ConstitutionCase storage c = cases[caseId];
        require(c.state == CaseState.PENDING, "ConstitutionCourt: not pending");
        require(c.isEmergency, "ConstitutionCourt: not emergency");
        require(!c.emergencyApproved, "ConstitutionCourt: already approved");

        c.emergencyApproved = true;
        c.state = CaseState.VOTING;
        c.votingStart = block.timestamp;
        c.votingEnd = block.timestamp + emergencyVotingPeriod;

        emit EmergencyCaseApproved(caseId, msg.sender, block.timestamp);
    }

    /**
     * @notice 对案件投票
     * @param caseId 案件ID
     * @param support true=维持修正案, false=反对修正案
     */
    function voteOnCase(uint256 caseId, bool support) external whenNotPaused {
        ConstitutionCase storage c = cases[caseId];
        require(c.state == CaseState.VOTING, "ConstitutionCourt: not in voting");
        require(block.timestamp < c.votingEnd, "ConstitutionCourt: voting period ended");
        require(!c.hasVoted[msg.sender], "ConstitutionCourt: already voted");

        uint256 votingPower = IPhiStaking(phiStaking).getVotingPower(msg.sender);
        require(votingPower > 0, "ConstitutionCourt: no voting power");

        c.hasVoted[msg.sender] = true;
        c.votePower[msg.sender] = votingPower;
        c.totalVoters++;

        if (support) {
            c.yesVotes += votingPower;
        } else {
            c.noVotes += votingPower;
        }

        emit VoteCast(caseId, msg.sender, support, votingPower, block.timestamp);
    }

    /**
     * @notice 判决案件（投票期结束后）
     * @param caseId 案件ID
     * @return judgment 判决结果
     */
    function renderJudgment(uint256 caseId) external whenNotPaused returns (JudgmentType judgment) {
        ConstitutionCase storage c = cases[caseId];
        require(c.state == CaseState.VOTING, "ConstitutionCourt: not in voting");
        require(block.timestamp >= c.votingEnd, "ConstitutionCourt: voting period not ended");

        uint256 totalVotes = c.yesVotes + c.noVotes;

        if (totalVotes == 0) {
            // 无投票 → 驳回
            c.state = CaseState.DISMISSED;
            c.judgment = JudgmentType.NONE;
            emit CaseDismissed(caseId, block.timestamp);
            return JudgmentType.NONE;
        }

        // yesVotes = 支持维持修正案 (true票)
        // noVotes  = 支持推翻修正案 (false票)
        uint256 yesRate = (c.yesVotes * 10000) / totalVotes;

        if (yesRate >= approvalThreshold) {
            // ≥67% 赞成维持 → UPHOLD
            c.judgment = JudgmentType.UPHOLD;
        } else if ((c.noVotes * 10000) / totalVotes >= approvalThreshold) {
            // ≥67% 支持推翻 → OVERTURN（标记修正案FAILED）
            c.judgment = JudgmentType.OVERTURN;
            _markAmendmentFailed(c.amendmentId);
        } else {
            // 未达到任意67%阈值 → REMAND（发回重议）
            c.judgment = JudgmentType.REMAND;
        }

        c.state = CaseState.RESOLVED;

        emit JudgmentRendered(caseId, c.judgment, c.yesVotes, c.noVotes, block.timestamp);
        return c.judgment;
    }

    // =============== View Functions ===============

    /**
     * @notice 获取案件信息
     */
    function getCase(uint256 caseId) external view returns (
        uint256 amendmentId,
        address filer,
        string memory reason,
        bytes32 evidenceHash,
        CaseState state,
        bool isEmergency,
        bool emergencyApproved,
        uint256 votingStart,
        uint256 votingEnd,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVoters,
        JudgmentType judgment
    ) {
        ConstitutionCase storage c = cases[caseId];
        return (
            c.amendmentId,
            c.filer,
            c.reason,
            c.evidenceHash,
            c.state,
            c.isEmergency,
            c.emergencyApproved,
            c.votingStart,
            c.votingEnd,
            c.yesVotes,
            c.noVotes,
            c.totalVoters,
            c.judgment
        );
    }

    /**
     * @notice 检查地址是否已投票
     */
    function hasVoted(uint256 caseId, address voter) external view returns (bool) {
        return cases[caseId].hasVoted[voter];
    }

    /**
     * @notice 获取投票权重
     */
    function getVotePower(uint256 caseId, address voter) external view returns (uint256) {
        return cases[caseId].votePower[voter];
    }

    /**
     * @notice 获取案件批准率（基点）
     */
    function getApprovalRate(uint256 caseId) external view returns (uint256) {
        ConstitutionCase storage c = cases[caseId];
        uint256 total = c.yesVotes + c.noVotes;
        if (total == 0) return 0;
        return (c.yesVotes * 10000) / total;
    }

    /**
     * @notice 附加AI分析报告哈希（仅admin）
     * @param caseId 案件ID
     * @param analysisHash IPFS哈希
     */
    function attachAnalysis(uint256 caseId, bytes32 analysisHash) external onlyAdmin {
        require(cases[caseId].caseId != 0, "ConstitutionCourt: case not found");
        caseAnalysisHashes[caseId] = analysisHash;
    }

    /**
     * @notice 附加模拟结果哈希（仅admin）
     * @param caseId 案件ID
     * @param simulationHash IPFS哈希
     */
    function attachSimulation(uint256 caseId, bytes32 simulationHash) external onlyAdmin {
        require(cases[caseId].caseId != 0, "ConstitutionCourt: case not found");
        caseSimulationHashes[caseId] = simulationHash;
    }

    /**
     * @notice 获取案件完整元数据（含分析/模拟）
     * @param caseId 案件ID
     * @return analysisHash AI分析报告哈希
     * @return simulationHash 模拟结果哈希
     * @return approvalRate 当前赞成率（基点）
     * @return timeRemaining 投票剩余时间（秒）
     */
    function getCaseMetadata(uint256 caseId) external view returns (
        bytes32 analysisHash,
        bytes32 simulationHash,
        uint256 approvalRate,
        uint256 timeRemaining
    ) {
        ConstitutionCase storage c = cases[caseId];
        analysisHash = caseAnalysisHashes[caseId];
        simulationHash = caseSimulationHashes[caseId];
        uint256 total = c.yesVotes + c.noVotes;
        approvalRate = total == 0 ? 0 : (c.yesVotes * 10000) / total;
        timeRemaining = c.votingEnd > block.timestamp ? c.votingEnd - block.timestamp : 0;
    }

    // =============== Internal Functions ===============

    /**
     * @dev OVERTURN判决仅记录事件，不自动修改Constitution状态
     *      链下监听器处理修正案状态变更
     */
    function _markAmendmentFailed(uint256 amendmentId) internal {
        // 仅发事件通知，链下监听器负责标记修正案FAILED
        emit JudgmentRendered(0, JudgmentType.OVERTURN, 0, 0, block.timestamp);
    }

    // =============== Admin Functions ===============

    function setApprovalThreshold(uint256 threshold) external onlyAdmin {
        require(threshold > 5000 && threshold <= 10000, "ConstitutionCourt: invalid threshold");
        approvalThreshold = threshold;
    }

    function setStandardVotingPeriod(uint256 period) external onlyAdmin {
        require(period >= 1 days, "ConstitutionCourt: period too short");
        standardVotingPeriod = period;
    }

    function setEmergencyVotingPeriod(uint256 period) external onlyAdmin {
        require(period >= 1 hours, "ConstitutionCourt: period too short");
        emergencyVotingPeriod = period;
    }

    function setConstitution(address _constitution) external onlyOwner {
        constitution = _constitution;
    }

    function setPhiStaking(address _phiStaking) external onlyOwner {
        phiStaking = _phiStaking;
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
}

// =============== Interfaces ===============

interface IPhiStaking {
    function getVotingPower(address user) external view returns (uint256);
}

interface IConstitution {
    function getAmendmentInfo(uint256 amendmentId) external view returns (
        uint256 targetClauseId,
        string memory title,
        string memory description,
        address proposer,
        uint8 state,
        uint256 discussionStart,
        uint256 votingStart,
        uint256 yesVotes,
        uint256 noVotes
    );
}
