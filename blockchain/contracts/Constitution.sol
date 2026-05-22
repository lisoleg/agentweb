// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Constitution
 * @notice V10.0 宪法合约 — Σ-Cloud最高治理规则，核心条款不可修改，修正案需67%通过
 * @dev 修正案流程: proposeAmendment → DISCUSSION → VOTING → PASSED/FAILED
 *      紧急暂停: emergencyPause/emergencyUnpause → 触发CircuitBreaker
 *      投票: 依赖PhiStaking.getVotingPower()
 */
contract Constitution is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum AmendmentState {
        DISCUSSION,   // 讨论期
        VOTING,       // 投票期
        PASSED,       // 已通过
        FAILED        // 已否决
    }

    // =============== Structs ===============

    struct Clause {
        uint256 clauseId;        // 条款ID
        string title;            // 条款标题
        string content;          // 条款内容（IPFS hash或链上文本）
        bool isCore;             // 是否为核心条款（不可修正）
        uint256 createdAt;       // 创建时间
        bool active;             // 是否生效
    }

    struct Amendment {
        uint256 amendmentId;     // 修正案ID
        uint256 targetClauseId;  // 目标条款ID
        string title;            // 修正案标题
        string description;      // 修正案描述
        string proposedContent;  // 提议的新内容
        address proposer;        // 提议者
        AmendmentState state;    // 修正案状态
        uint256 discussionStart; // 讨论开始时间
        uint256 votingStart;     // 投票开始时间
        uint256 votingEnd;       // 投票结束时间
        uint256 yesVotes;        // 赞成票数（voting power总和）
        uint256 noVotes;         // 反对票数
        uint256 totalVoters;     // 参与投票人数
        mapping(address => bool) hasVoted;     // 是否已投票
        mapping(address => uint256) votePower; // 投票时使用的voting power
    }

    // =============== State Variables ===============

    /// @notice 条款总数
    uint256 public totalClauses;

    /// @notice 修正案总数
    uint256 public totalAmendments;

    /// @notice 条款ID => Clause
    mapping(uint256 => Clause) public clauses;

    /// @notice 修正案ID => Amendment
    mapping(uint256 => Amendment) public amendments;

    /// @notice 修正案通过阈值（基点，6700 = 67%）
    uint256 public amendmentApprovalThreshold;

    /// @notice 讨论期时长（秒，默认7天）
    uint256 public discussionPeriod;

    /// @notice 投票期时长（秒，默认7天）
    uint256 public votingPeriod;

    /// @notice 提案最低voting power
    uint256 public minProposalVotingPower;

    /// @notice PhiStaking合约地址
    address public phiStaking;

    /// @notice CircuitBreaker合约地址
    address public circuitBreaker;

    /// @notice 管理员
    mapping(address => bool) public admins;

    /// @notice 宪法是否紧急暂停中
    bool public constitutionPaused;

    // =============== Events ===============

    event ClauseCreated(uint256 indexed clauseId, string title, bool isCore, uint256 timestamp);
    event AmendmentProposed(uint256 indexed amendmentId, uint256 indexed targetClauseId, address indexed proposer, uint256 timestamp);
    event AmendmentStateChanged(uint256 indexed amendmentId, AmendmentState oldState, AmendmentState newState, uint256 timestamp);
    event VoteCast(uint256 indexed amendmentId, address indexed voter, bool support, uint256 votingPower, uint256 timestamp);
    event AmendmentResolved(uint256 indexed amendmentId, bool passed, uint256 yesVotes, uint256 noVotes, uint256 timestamp);
    event ConstitutionPaused(address indexed trigger, string reason, uint256 timestamp);
    event ConstitutionUnpaused(address indexed trigger, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Constitution: not admin");
        _;
    }

    modifier onlyAmendable(uint256 clauseId) {
        require(clauses[clauseId].active, "Constitution: clause not active");
        require(!clauses[clauseId].isCore, "Constitution: core clause not amendable");
        _;
    }

    modifier notConstitutionPaused() {
        require(!constitutionPaused, "Constitution: constitution paused");
        _;
    }

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {
        amendmentApprovalThreshold = 6700;  // 67%
        discussionPeriod = 7 days;
        votingPeriod = 7 days;
        minProposalVotingPower = 1000e18;   // 1000 tokens minimum
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 创建条款
     * @param title 条款标题
     * @param content 条款内容
     * @param isCore 是否为核心条款
     * @return clauseId 条款ID
     */
    function createClause(
        string calldata title,
        string calldata content,
        bool isCore
    ) external onlyAdmin returns (uint256 clauseId) {
        totalClauses++;
        clauseId = totalClauses;
        clauses[clauseId] = Clause({
            clauseId: clauseId,
            title: title,
            content: content,
            isCore: isCore,
            createdAt: block.timestamp,
            active: true
        });
        emit ClauseCreated(clauseId, title, isCore, block.timestamp);
    }

    /**
     * @notice 提出修正案
     * @param targetClauseId 目标条款ID
     * @param title 修正案标题
     * @param description 修正案描述
     * @param proposedContent 提议的新内容
     * @return amendmentId 修正案ID
     */
    function proposeAmendment(
        uint256 targetClauseId,
        string calldata title,
        string calldata description,
        string calldata proposedContent
    ) external notConstitutionPaused whenNotPaused returns (uint256 amendmentId) {
        require(clauses[targetClauseId].active, "Constitution: target clause not active");
        require(!clauses[targetClauseId].isCore, "Constitution: core clause not amendable");
        require(bytes(title).length > 0, "Constitution: empty title");

        // 检查提案者voting power
        if (phiStaking != address(0)) {
            uint256 power = IPhiStaking(phiStaking).getVotingPower(msg.sender);
            require(power >= minProposalVotingPower, "Constitution: insufficient voting power to propose");
        }

        totalAmendments++;
        amendmentId = totalAmendments;

        Amendment storage amendment = amendments[amendmentId];
        amendment.amendmentId = amendmentId;
        amendment.targetClauseId = targetClauseId;
        amendment.title = title;
        amendment.description = description;
        amendment.proposedContent = proposedContent;
        amendment.proposer = msg.sender;
        amendment.state = AmendmentState.DISCUSSION;
        amendment.discussionStart = block.timestamp;
        amendment.votingStart = 0;
        amendment.votingEnd = 0;
        amendment.yesVotes = 0;
        amendment.noVotes = 0;
        amendment.totalVoters = 0;

        emit AmendmentProposed(amendmentId, targetClauseId, msg.sender, block.timestamp);
    }

    /**
     * @notice 推进修正案到投票阶段（讨论期结束后）
     * @param amendmentId 修正案ID
     */
    function advanceToVoting(uint256 amendmentId) external notConstitutionPaused whenNotPaused {
        Amendment storage amendment = amendments[amendmentId];
        require(amendment.state == AmendmentState.DISCUSSION, "Constitution: not in discussion");
        require(
            block.timestamp >= amendment.discussionStart + discussionPeriod,
            "Constitution: discussion period not ended"
        );

        AmendmentState oldState = amendment.state;
        amendment.state = AmendmentState.VOTING;
        amendment.votingStart = block.timestamp;
        amendment.votingEnd = block.timestamp + votingPeriod;

        emit AmendmentStateChanged(amendmentId, oldState, AmendmentState.VOTING, block.timestamp);
    }

    /**
     * @notice 对修正案投票
     * @param amendmentId 修正案ID
     * @param support 是否赞成
     */
    function voteOnAmendment(uint256 amendmentId, bool support) external notConstitutionPaused whenNotPaused {
        Amendment storage amendment = amendments[amendmentId];
        require(amendment.state == AmendmentState.VOTING, "Constitution: not in voting");
        require(block.timestamp < amendment.votingEnd, "Constitution: voting ended");
        require(!amendment.hasVoted[msg.sender], "Constitution: already voted");

        // 获取投票权
        uint256 votingPower = 0;
        if (phiStaking != address(0)) {
            votingPower = IPhiStaking(phiStaking).getVotingPower(msg.sender);
        }
        require(votingPower > 0, "Constitution: no voting power");

        amendment.hasVoted[msg.sender] = true;
        amendment.votePower[msg.sender] = votingPower;
        amendment.totalVoters++;

        if (support) {
            amendment.yesVotes += votingPower;
        } else {
            amendment.noVotes += votingPower;
        }

        emit VoteCast(amendmentId, msg.sender, support, votingPower, block.timestamp);
    }

    /**
     * @notice 结算修正案（投票期结束后）
     * @param amendmentId 修正案ID
     */
    function resolveAmendment(uint256 amendmentId) external notConstitutionPaused whenNotPaused {
        Amendment storage amendment = amendments[amendmentId];
        require(amendment.state == AmendmentState.VOTING, "Constitution: not in voting");
        require(block.timestamp >= amendment.votingEnd, "Constitution: voting not ended");

        uint256 totalVotes = amendment.yesVotes + amendment.noVotes;
        bool passed = false;

        if (totalVotes > 0) {
            uint256 approvalRate = (amendment.yesVotes * 10000) / totalVotes;
            passed = approvalRate >= amendmentApprovalThreshold;
        }

        AmendmentState oldState = amendment.state;
        if (passed) {
            amendment.state = AmendmentState.PASSED;
            // 更新条款内容
            Clause storage clause = clauses[amendment.targetClauseId];
            clause.content = amendment.proposedContent;
        } else {
            amendment.state = AmendmentState.FAILED;
        }

        emit AmendmentStateChanged(amendmentId, oldState, amendment.state, block.timestamp);
        emit AmendmentResolved(amendmentId, passed, amendment.yesVotes, amendment.noVotes, block.timestamp);
    }

    /**
     * @notice 紧急暂停宪法（触发CircuitBreaker）
     * @param reason 暂停原因
     */
    function emergencyPause(string calldata reason) external onlyAdmin {
        require(!constitutionPaused, "Constitution: already paused");
        constitutionPaused = true;

        // 触发CircuitBreaker（如果已连接）
        if (circuitBreaker != address(0)) {
            ICircuitBreaker(circuitBreaker).constitutionEmergencyBreak();
        }

        emit ConstitutionPaused(msg.sender, reason, block.timestamp);
    }

    /**
     * @notice 解除宪法暂停
     */
    function emergencyUnpause() external onlyAdmin {
        require(constitutionPaused, "Constitution: not paused");
        constitutionPaused = false;
        emit ConstitutionUnpaused(msg.sender, block.timestamp);
    }

    // =============== View Functions ===============

    function getClause(uint256 clauseId) external view returns (
        string memory title,
        string memory content,
        bool isCore,
        uint256 createdAt,
        bool active
    ) {
        Clause storage c = clauses[clauseId];
        return (c.title, c.content, c.isCore, c.createdAt, c.active);
    }

    function getAmendmentInfo(uint256 amendmentId) external view returns (
        uint256 targetClauseId,
        string memory title,
        string memory description,
        address proposer,
        AmendmentState state,
        uint256 discussionStart,
        uint256 votingStart,
        uint256 votingEnd,
        uint256 yesVotes,
        uint256 noVotes,
        uint256 totalVoters
    ) {
        Amendment storage a = amendments[amendmentId];
        return (
            a.targetClauseId, a.title, a.description, a.proposer, a.state,
            a.discussionStart, a.votingStart, a.votingEnd,
            a.yesVotes, a.noVotes, a.totalVoters
        );
    }

    function hasAddressVoted(uint256 amendmentId, address voter) external view returns (bool) {
        return amendments[amendmentId].hasVoted[voter];
    }

    function getAmendmentApprovalRate(uint256 amendmentId) external view returns (uint256) {
        Amendment storage a = amendments[amendmentId];
        uint256 total = a.yesVotes + a.noVotes;
        if (total == 0) return 0;
        return (a.yesVotes * 10000) / total;
    }

    // =============== Admin Functions ===============

    function setAmendmentApprovalThreshold(uint256 threshold) external onlyAdmin {
        require(threshold > 5000 && threshold <= 10000, "Constitution: invalid threshold");
        amendmentApprovalThreshold = threshold;
    }

    function setDiscussionPeriod(uint256 period) external onlyAdmin {
        require(period >= 1 days, "Constitution: period too short");
        discussionPeriod = period;
    }

    function setVotingPeriod(uint256 period) external onlyAdmin {
        require(period >= 1 days, "Constitution: period too short");
        votingPeriod = period;
    }

    function setMinProposalVotingPower(uint256 power) external onlyAdmin {
        minProposalVotingPower = power;
    }

    function setPhiStaking(address _phiStaking) external onlyOwner {
        phiStaking = _phiStaking;
    }

    function setCircuitBreaker(address _circuitBreaker) external onlyOwner {
        circuitBreaker = _circuitBreaker;
    }

    function deactivateClause(uint256 clauseId) external onlyAdmin {
        clauses[clauseId].active = false;
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

interface ICircuitBreaker {
    function constitutionEmergencyBreak() external;
}
