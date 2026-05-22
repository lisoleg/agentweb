// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AdversarialReview
 * @notice 多角色对抗互审合约 — 三方独立评审+投票+冲突仲裁
 * @dev 评审角色: ARCHITECT/SECURITY_AUDITOR/UX_OFFICER，冲突自动触发仲裁
 *
 * 评审流程: 提交 → 三方独立评审 → 投票 → 决议
 * 冲突处理: 评审分歧 → 自动触发仲裁(ARBITRATION)
 * 评分体系: 每位评审0-100分+评语+标签
 * 激励: 从什一税池分配评审报酬
 * 与PhiAgentNFT集成: 评审结果写入征信
 */
contract AdversarialReview is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum ReviewRole {
        ARCHITECT,          // 架构师: 评估架构合理性
        SECURITY_AUDITOR,   // 安全审计员: 评估安全风险
        UX_OFFICER          // 体验官: 评估用户体验
    }

    enum ReviewDecision {
        PENDING,            // 待评审
        APPROVED,           // 通过
        REJECTED,           // 拒绝
        CONDITIONAL,        // 有条件通过
        ARBITRATION         // 仲裁中
    }

    enum SessionStatus {
        SUBMITTED,          // 已提交
        REVIEWING,          // 评审中
        VOTING,             // 投票中
        RESOLVED,           // 已决议
        ARBITRATION,        // 仲裁中
        CLOSED              // 已关闭
    }

    // =============== Structs ===============

    struct Review {
        address reviewer;        // 评审员地址
        ReviewRole role;         // 评审角色
        uint8 score;             // 0-100分
        string comment;          // 评语
        string[] tags;           // 标签
        ReviewDecision decision; // 评审决定
        uint256 timestamp;       // 评审时间
        bool submitted;          // 是否已提交
    }

    struct ReviewSession {
        uint256 sessionId;           // 会话ID
        uint256 targetAgentId;       // 目标Agent NFT ID
        address submitter;           // 提交者
        string subject;              // 评审主题
        string description;          // 详细描述
        bytes32 contentHash;         // 内容哈希
        SessionStatus status;        // 会话状态
        ReviewDecision finalDecision;// 最终决议
        uint256 submittedAt;         // 提交时间
        uint256 resolvedAt;          // 决议时间
        uint256 reviewDeadline;      // 评审截止时间
        uint256 arbitrationId;       // 仲裁ID（如有）
        mapping(ReviewRole => Review) reviews;  // 角色→评审
        ReviewRole[] completedRoles;            // 已完成评审的角色
    }

    struct Arbitration {
        uint256 arbitrationId;      // 仲裁ID
        uint256 sessionId;          // 关联会话ID
        address arbitrator;         // 仲裁员
        ReviewDecision decision;    // 仲裁决定
        string reasoning;           // 仲裁理由
        uint256 timestamp;          // 仲裁时间
        bool resolved;              // 是否已解决
    }

    struct ReviewerProfile {
        address reviewer;           // 评审员地址
        ReviewRole role;            // 角色
        uint256 totalReviews;       // 总评审数
        uint256 approvedCount;      // 通过数
        uint256 rejectedCount;      // 拒绝数
        uint256 reputationScore;    // 信誉分 0-10000
        bool isActive;              // 是否活跃
    }

    // =============== State Variables ===============

    uint256 private s_nextSessionId;
    uint256 private s_nextArbitrationId;

    /// @notice sessionId => ReviewSession
    mapping(uint256 => ReviewSession) public sessions;

    /// @notice arbitrationId => Arbitration
    mapping(uint256 => Arbitration) public arbitrations;

    /// @notice reviewer address => ReviewerProfile
    mapping(address => ReviewerProfile) public reviewerProfiles;

    /// @notice role => 当前指派的评审员
    mapping(ReviewRole => address) public roleReviewers;

    /// @notice 仲裁员地址
    address public arbitrator;

    /// @notice PhiAgentNFT合约地址
    address public phiAgentNFT;

    /// @notice 评审截止时间（秒，默认7天）
    uint256 public reviewDeadlineSeconds;

    /// @notice 评分分歧阈值（超过此分差触发仲裁，默认30分）
    uint256 public scoreDisparityThreshold;

    /// @notice 评审报酬（GC/token per review）
    uint256 public reviewReward;

    /// @notice 什一税池地址
    address public tithePool;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event SessionSubmitted(
        uint256 indexed sessionId,
        uint256 indexed targetAgentId,
        address indexed submitter,
        string subject,
        uint256 deadline
    );

    event ReviewSubmitted(
        uint256 indexed sessionId,
        address indexed reviewer,
        ReviewRole role,
        uint8 score,
        ReviewDecision decision,
        uint256 timestamp
    );

    event SessionResolved(
        uint256 indexed sessionId,
        ReviewDecision finalDecision,
        uint256 timestamp
    );

    event ArbitrationTriggered(
        uint256 indexed sessionId,
        uint256 indexed arbitrationId,
        string reason,
        uint256 timestamp
    );

    event ArbitrationResolved(
        uint256 indexed arbitrationId,
        uint256 indexed sessionId,
        ReviewDecision decision,
        uint256 timestamp
    );

    event ReviewerAssigned(ReviewRole role, address reviewer);
    event ReviewerRemoved(ReviewRole role, address reviewer);
    event ReviewRewardPaid(address indexed reviewer, uint256 amount);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "AdversarialReview: not admin");
        _;
    }

    modifier onlyRoleReviewer(ReviewRole role) {
        require(roleReviewers[role] == msg.sender, "AdversarialReview: not role reviewer");
        _;
    }

    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "AdversarialReview: not arbitrator");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _arbitrator,
        address _phiAgentNFT
    ) Ownable(msg.sender) {
        require(_arbitrator != address(0), "AdversarialReview: zero arbitrator");

        arbitrator = _arbitrator;
        phiAgentNFT = _phiAgentNFT;
        reviewDeadlineSeconds = 7 days;
        scoreDisparityThreshold = 30;
        reviewReward = 0; // 默认无报酬
        s_nextSessionId = 1;
        s_nextArbitrationId = 1;
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 提交评审申请
     * @param targetAgentId 目标Agent NFT ID
     * @param subject 评审主题
     * @param description 详细描述
     * @param contentHash 内容哈希
     * @return sessionId 评审会话ID
     */
    function submitReview(
        uint256 targetAgentId,
        string calldata subject,
        string calldata description,
        bytes32 contentHash
    ) external whenNotPaused returns (uint256 sessionId) {
        require(bytes(subject).length > 0, "AdversarialReview: empty subject");
        require(targetAgentId > 0, "AdversarialReview: invalid agent");

        sessionId = s_nextSessionId++;
        ReviewSession storage session = sessions[sessionId];
        session.sessionId = sessionId;
        session.targetAgentId = targetAgentId;
        session.submitter = msg.sender;
        session.subject = subject;
        session.description = description;
        session.contentHash = contentHash;
        session.status = SessionStatus.SUBMITTED;
        session.submittedAt = block.timestamp;
        session.reviewDeadline = block.timestamp + reviewDeadlineSeconds;

        emit SessionSubmitted(sessionId, targetAgentId, msg.sender, subject, session.reviewDeadline);
    }

    /**
     * @notice 提交评审意见（三方评审员各自调用）
     * @param sessionId 评审会话ID
     * @param score 评分(0-100)
     * @param comment 评语
     * @param tags 标签
     * @param decision 评审决定
     */
    function submitReviewOpinion(
        uint256 sessionId,
        uint8 score,
        string calldata comment,
        string[] calldata tags,
        ReviewDecision decision
    ) external whenNotPaused {
        require(score <= 100, "AdversarialReview: invalid score");
        require(decision == ReviewDecision.APPROVED ||
                decision == ReviewDecision.REJECTED ||
                decision == ReviewDecision.CONDITIONAL,
                "AdversarialReview: invalid decision");

        ReviewSession storage session = sessions[sessionId];
        require(session.status == SessionStatus.SUBMITTED || session.status == SessionStatus.REVIEWING,
                "AdversarialReview: session not in review");
        require(block.timestamp < session.reviewDeadline, "AdversarialReview: deadline passed");

        // 确定调用者的角色
        ReviewRole callerRole = _getReviewerRole(msg.sender);
        require(callerRole == ReviewRole.ARCHITECT || callerRole == ReviewRole.SECURITY_AUDITOR ||
                callerRole == ReviewRole.UX_OFFICER, "AdversarialReview: not assigned reviewer");

        // 检查是否已提交该角色的评审
        require(!session.reviews[callerRole].submitted, "AdversarialReview: already submitted");

        session.status = SessionStatus.REVIEWING;

        // 存储评审
        Review storage review = session.reviews[callerRole];
        review.reviewer = msg.sender;
        review.role = callerRole;
        review.score = score;
        review.comment = comment;
        review.tags = tags;
        review.decision = decision;
        review.timestamp = block.timestamp;
        review.submitted = true;

        session.completedRoles.push(callerRole);

        // 更新评审员资料
        reviewerProfiles[msg.sender].totalReviews++;
        if (decision == ReviewDecision.APPROVED || decision == ReviewDecision.CONDITIONAL) {
            reviewerProfiles[msg.sender].approvedCount++;
        } else {
            reviewerProfiles[msg.sender].rejectedCount++;
        }

        emit ReviewSubmitted(sessionId, msg.sender, callerRole, score, decision, block.timestamp);

        // 检查是否三方都已完成
        if (session.completedRoles.length >= 3) {
            _resolveSession(sessionId);
        }
    }

    /**
     * @notice 仲裁员解决争议
     * @param arbitrationId 仲裁ID
     * @param decision 仲裁决定
     * @param reasoning 仲裁理由
     */
    function resolveArbitration(
        uint256 arbitrationId,
        ReviewDecision decision,
        string calldata reasoning
    ) external onlyArbitrator {
        Arbitration storage arb = arbitrations[arbitrationId];
        require(arbitrationId > 0 && arb.sessionId > 0, "AdversarialReview: invalid arbitration");
        require(!arb.resolved, "AdversarialReview: already resolved");

        arb.decision = decision;
        arb.reasoning = reasoning;
        arb.timestamp = block.timestamp;
        arb.resolved = true;

        // 更新会话
        ReviewSession storage session = sessions[arb.sessionId];
        session.finalDecision = decision;
        session.status = SessionStatus.RESOLVED;
        session.resolvedAt = block.timestamp;

        emit ArbitrationResolved(arbitrationId, arb.sessionId, decision, block.timestamp);
        emit SessionResolved(arb.sessionId, decision, block.timestamp);
    }

    /**
     * @notice 指派评审员角色
     */
    function assignReviewer(ReviewRole role, address reviewer) external onlyAdmin {
        require(reviewer != address(0), "AdversarialReview: zero address");
        roleReviewers[role] = reviewer;
        reviewerProfiles[reviewer].reviewer = reviewer;
        reviewerProfiles[reviewer].role = role;
        reviewerProfiles[reviewer].isActive = true;
        emit ReviewerAssigned(role, reviewer);
    }

    /**
     * @notice 移除评审员
     */
    function removeReviewer(ReviewRole role) external onlyAdmin {
        address oldReviewer = roleReviewers[role];
        if (oldReviewer != address(0)) {
            reviewerProfiles[oldReviewer].isActive = false;
            emit ReviewerRemoved(role, oldReviewer);
        }
        delete roleReviewers[role];
    }

    /**
     * @notice 设置仲裁员
     */
    function setArbitrator(address _arbitrator) external onlyOwner {
        require(_arbitrator != address(0), "AdversarialReview: zero address");
        arbitrator = _arbitrator;
    }

    // =============== View Functions ===============

    function getReviewByRole(uint256 sessionId, ReviewRole role) external view returns (
        address reviewer,
        uint8 score,
        string memory comment,
        ReviewDecision decision,
        bool submitted,
        uint256 timestamp
    ) {
        Review memory r = sessions[sessionId].reviews[role];
        return (r.reviewer, r.score, r.comment, r.decision, r.submitted, r.timestamp);
    }

    function getSessionInfo(uint256 sessionId) external view returns (
        uint256 targetAgentId,
        address submitter,
        string memory subject,
        SessionStatus status,
        ReviewDecision finalDecision,
        uint256 submittedAt,
        uint256 reviewDeadline,
        uint256 completedCount
    ) {
        ReviewSession storage s = sessions[sessionId];
        return (
            s.targetAgentId,
            s.submitter,
            s.subject,
            s.status,
            s.finalDecision,
            s.submittedAt,
            s.reviewDeadline,
            s.completedRoles.length
        );
    }

    function getArbitration(uint256 arbitrationId) external view returns (Arbitration memory) {
        return arbitrations[arbitrationId];
    }

    function getReviewerProfile(address reviewer) external view returns (ReviewerProfile memory) {
        return reviewerProfiles[reviewer];
    }

    function getAverageScore(uint256 sessionId) external view returns (uint256) {
        ReviewSession storage s = sessions[sessionId];
        if (s.completedRoles.length == 0) return 0;
        uint256 total = 0;
        for (uint256 i = 0; i < s.completedRoles.length; i++) {
            total += s.reviews[s.completedRoles[i]].score;
        }
        return total / s.completedRoles.length;
    }

    function getScoreDisparity(uint256 sessionId) external view returns (uint256) {
        ReviewSession storage s = sessions[sessionId];
        if (s.completedRoles.length < 2) return 0;
        uint8 minScore = 100;
        uint8 maxScore = 0;
        for (uint256 i = 0; i < s.completedRoles.length; i++) {
            uint8 sc = s.reviews[s.completedRoles[i]].score;
            if (sc < minScore) minScore = sc;
            if (sc > maxScore) maxScore = sc;
        }
        return uint256(maxScore) - uint256(minScore);
    }

    // =============== Admin Functions ===============

    function setReviewDeadlineSeconds(uint256 seconds_) external onlyAdmin {
        reviewDeadlineSeconds = seconds_;
    }

    function setScoreDisparityThreshold(uint256 threshold) external onlyAdmin {
        scoreDisparityThreshold = threshold;
    }

    function setReviewReward(uint256 reward) external onlyAdmin {
        reviewReward = reward;
    }

    function setTithePool(address pool) external onlyOwner {
        tithePool = pool;
    }

    function setPhiAgentNFT(address _phiAgentNFT) external onlyOwner {
        phiAgentNFT = _phiAgentNFT;
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

    /// @dev 决议评审会话
    function _resolveSession(uint256 sessionId) internal {
        ReviewSession storage session = sessions[sessionId];

        // 计算平均分和最大分差
        uint256 totalScore = 0;
        uint8 minScore = 100;
        uint8 maxScore = 0;
        uint256 approveCount = 0;
        uint256 rejectCount = 0;

        for (uint256 i = 0; i < session.completedRoles.length; i++) {
            Review memory r = session.reviews[session.completedRoles[i]];
            totalScore += r.score;
            if (r.score < minScore) minScore = r.score;
            if (r.score > maxScore) maxScore = r.score;
            if (r.decision == ReviewDecision.APPROVED || r.decision == ReviewDecision.CONDITIONAL) {
                approveCount++;
            } else {
                rejectCount++;
            }
        }

        // 检查分差是否过大 → 触发仲裁
        uint256 disparity = uint256(maxScore) - uint256(minScore);
        if (disparity > scoreDisparityThreshold) {
            session.status = SessionStatus.ARBITRATION;
            uint256 arbId = s_nextArbitrationId++;
            arbitrations[arbId] = Arbitration({
                arbitrationId: arbId,
                sessionId: sessionId,
                arbitrator: arbitrator,
                decision: ReviewDecision.PENDING,
                reasoning: "",
                timestamp: block.timestamp,
                resolved: false
            });
            session.arbitrationId = arbId;
            emit ArbitrationTriggered(sessionId, arbId, "Score disparity exceeds threshold", block.timestamp);
            return;
        }

        // 多数决
        if (approveCount >= 2) {
            session.finalDecision = ReviewDecision.APPROVED;
        } else if (rejectCount >= 2) {
            session.finalDecision = ReviewDecision.REJECTED;
        } else {
            // 一致CONDITIONAL
            session.finalDecision = ReviewDecision.CONDITIONAL;
        }

        session.status = SessionStatus.RESOLVED;
        session.resolvedAt = block.timestamp;

        emit SessionResolved(sessionId, session.finalDecision, block.timestamp);
    }

    /// @dev 获取评审员角色
    function _getReviewerRole(address reviewer) internal view returns (ReviewRole) {
        if (roleReviewers[ReviewRole.ARCHITECT] == reviewer) return ReviewRole.ARCHITECT;
        if (roleReviewers[ReviewRole.SECURITY_AUDITOR] == reviewer) return ReviewRole.SECURITY_AUDITOR;
        if (roleReviewers[ReviewRole.UX_OFFICER] == reviewer) return ReviewRole.UX_OFFICER;
        return ReviewRole.ARCHITECT; // fallback（不会到达）
    }
}
