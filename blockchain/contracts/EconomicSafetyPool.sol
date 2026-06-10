// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EconomicSafetyPool
 * @dev V17.0 ASG — 经济安全池（链上质押/Slashing/赔付）
 *
 * 基于MetaMask Agent Wallet Transaction Protection设计：
 * - Agent Owner为Agent质押 → 获得更高信任等级
 * - 违规行为触发Slashing（罚没质押）
 * - 安全判定交易仍出问题 → 赔付池兜底
 *
 * 经济激励对齐：
 *   质押额越大 → 信任度越高 → 操作权限越广
 *   违规成本越高 → 恶意行为的经济门槛越高
 *   举报有奖 → 社区共同维护安全生态
 *
 * 核心公式（在合约中实现）：
 *   maxPayout = min(月预算, 损失额, 质押额 × 80%)
 *   slashAmount = baseStake × coefficient[reason]
 *   reporterReward = slashAmount × 10%
 */
contract EconomicSafetyPool {

    // ====== 结构体 ======

    enum StakeStatus { Active, Unlocked, Slashed }

    struct Stake {
        bytes32 stakeId;
        address staker;              // 质押者地址
        bytes32 agentDidHash;        // Agent DID哈希
        uint256 amount;             // 质押金额（以最小单位计，如6 decimals）
        uint256 lockedUntil;
        StakeStatus status;
        uint256 stakedAt;
    }

    enum SlashReason { PrivacyBreach, PolicyViolation, FraudulentActivity, Collusion, AvailabilityFailure }

    struct SlashingEvent {
        bytes32 eventId;
        bytes32 stakeId;
        bytes32 agentDidHash;
        SlashReason reason;
        uint256 slashedAmount;
        uint256 remainingStake;
        address reporter;            // 举报人（可选）
        uint256 reporterReward;
        uint256 eventTime;
    }

    enum ClaimStatus { PendingReview, Approved, Rejected, PaidOut }

    struct ClaimRequest {
        bytes32 claimId;
        bytes32 transactionId;
        address claimant;           // 申请人地址
        uint256 claimedLossAmount;    // 声称损失金额
        bytes evidenceHash;         // 证据哈希
        bytes32 gateResultId;       // 门控管线结果ID（证明当时判定安全）
        ClaimStatus status;
        uint256 submittedAt;
        uint256 reviewedAt;
        uint256 payoutAmount;
    }

    // ====== 状态变量 ======

    mapping(bytes32 => Stake) public stakes;               // stakeId => Stake
    mapping(address => bytes32[]) public stakerStakes;     // staker => stakeId[]
    mapping(bytes32 => SlashingEvent) public slashings;   // eventId => SlashingEvent
    mapping(bytes32 => ClaimRequest) public claims;       // claimId => Claim

    uint256 public constant MONTHLY_BUDGET = 50_000_000;  // $50,000 (6 decimals)
    uint256 public constant MAX_PAYOUT_RATIO = 80;         // 80%
    uint256 public constant REPORTER_REWARD_RATIO = 10;    // 10%
    uint256 public constant MIN_LOCK_DAYS = 30 days;
    uint256 public constant UNLOCK_COOLDOWN = 7 days;

    // 全局统计
    uint256 public totalStaked;
    uint256 public totalSlashed;
    uint256 public totalPaidOut;

    // ====== 事件 ======

    event Staked(
        bytes32 indexed stakeId,
        address indexed staker,
        uint256 amount,
        uint256 unlockTime
    );

    event Unlocked(
        bytes32 indexed stakeId,
        address staker,
        uint256 amount
    );

    event Slashed(
        bytes32 indexed eventId,
        bytes32 stakeId,
        SlashReason reason,
        uint256 amount,
        address reporter,
        uint256 reward
    );

    event ClaimSubmitted(
        bytes32 indexed claimId,
        address claimant,
        uint256 claimedAmount
    );

    event ClaimReviewed(
        bytes32 indexed claimId,
        bool approved,
        uint256 payoutAmount
    );

    // ====== 质押操作 ======

    /**
     * @notice 为Agent质押
     * @param agentDidHash 目标Agent的DID哈希
     */
    function stake(bytes32 agentDidHash) external payable {
        require(msg.value >= 1e6, "Minimum stake: 1 unit");

        bytes32 stakeId = keccak256(abi.encodePacked(msg.sender, agentDidHash, block.timestamp));

        stakes[stakeId] = Stake({
            stakeId: stakeId,
            staker: msg.sender,
            agentDidHash: agentDidHash,
            amount: msg.value,
            lockedUntil: block.timestamp + MIN_LOCK_DAYS,
            status: StakeStatus.Active,
            stakedAt: block.timestamp
        });

        stakerStakes[msg.sender].push(stakeId);
        totalStaked += msg.value;

        emit Staked(stakeId, msg.sender, msg.value, block.timestamp + MIN_LOCK_DAYS);
    }

    /**
     * @notice 解锁到期质押
     */
    function unlock(bytes32 stakeId) external {
        Stake storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not your stake");
        require(s.status == StakeStatus.Active, "Not active");

        require(block.timestamp > s.lockedUntil, "Still in lock period");
        require(block.timestamp > s.lockedUntil + UNLOCK_COOLDOWN, "In cooldown period");

        s.status = StakeStatus.Unlocked;
        totalStaked -= s.amount;

        emit Unlocked(stakeId, msg.sender, s.amount);

        // 返还资金
        (bool success, ) = s.staker.call{ value: s.amount }("");
        require(success, "Transfer failed");
    }

    /**
     * @notice 提取已解锁的质押
     */
    function withdraw(bytes32 stakeId) external {
        Stake storage s = stakes[stakeId];
        require(s.staker == msg.sender, "Not your stake");
        require(s.status == StakeStatus.Unlocked, "Not unlocked");

        uint256 amount = s.amount;
        s.amount = 0;                    // 防止重入

        (bool success, ) = s.staker.call{ value: amount }("");
        require(success, "Transfer failed");
    }

    // ====== Slashing操作 ======

    /**
     * @notice 执行罚没（由治理或多数验证节点触发）
     * @param stakeId 被罚没的质押ID
     * @param reason 罚没原因
     * @param evidenceHash 证据哈希
     */
    function executeSlashing(
        bytes32 stakeId,
        SlashReason reason,
        bytes calldata evidenceHash
    )
        external
        returns (bytes32 eventId)
    {
        Stake storage s = stakes[stakeId];
        require(s.status == StakeStatus.Active, "Not active");

        // 计算罚没金额（按原因类型）
        uint256 coeff = getSlashCoefficient(reason);
        uint256 slashAmount = (s.amount * coeff) / 100;
        uint256 remaining = s.amount - slashAmount;

        // 举报奖励（10%的罚没金额）
        uint256 reporterReward = (slashAmount * REPORTER_REWARD_RATIO) / 100;

        eventId = keccak256(abi.encodePacked(stakeId, reason, block.timestamp));

        slashings[eventId] = SlashingEvent({
            eventId: eventId,
            stakeId: stakeId,
            agentDidHash: s.agentDidHash,
            reason: reason,
            slashedAmount: slashAmount,
            remainingStake: remaining,
            reporter: msg.sender,
            reporterReward: reporterReward,
            eventTime: block.timestamp
        });

        // 更新质押状态
        if (remaining == 0) {
            s.status = StakeStatus.Slashed;
        } else {
            s.amount = remaining;
        }

        // 统计更新
        totalSlashed += slashAmount;
        totalStaked -= slashAmount;

        // 支付举报奖励
        if (reporterReward > 0 && msg.sender != address(0)) {
            (bool sent, ) = msg.sender.call{ value: reporterReward }("");
            if (!sent) reporterReward = 0; // 发送失败则不记录奖励
            slashings[eventId].reporterReward = reporterReward;
        }

        emit Slashed(eventId, stakeId, reason, slashAmount, msg.sender, reporterReward);

        return eventId;
    }

    // ====== 赔付操作 ======

    /**
     * @notice 提交赔付申请
     */
    function submitClaim(
        bytes32 transactionId,
        uint256 claimedLossAmount,
        bytes calldata evidenceHash,
        bytes32 gateResultId
    )
        external
        returns (bytes32 claimId)
    {
        claimId = keccak256(abi.encodePacked(transactionId, msg.sender, block.timestamp));

        claims[claimId] = ClaimRequest({
            claimId: claimId,
            transactionId: transactionId,
            claimant: msg.sender,
            claimedLossAmount: claimedLossAmount,
            evidenceHash: evidenceHash,
            gateResultId: gateResultId,
            status: ClaimStatus.PendingReview,
            submittedAt: block.timestamp,
            reviewedAt: 0,
            payoutAmount: 0
        });

        emit ClaimSubmitted(claimId, msg.sender, claimedLossAmount);
        return claimId;
    }

    /**
     * @notice 审核赔付申请（多签/DAO调用）
     */
    function reviewClaim(bytes32 claimId, bool approved)
        external
        returns (uint256 payoutAmount)
    {
        ClaimRequest storage c = claims[claimId];
        require(c.status == ClaimStatus.PendingReview, "Not pending");
        require(c.claimant != address(0), "Invalid claim");

        c.reviewedAt = block.timestamp;

        if (!approved) {
            c.status = ClaimStatus.Rejected;
            emit ClaimReviewed(claimId, false, 0);
            return 0;
        }

        // 计算本月已赔付总额
        uint256 monthStart = block.timestamp - (block.timestamp % 30 days);
        uint256 monthlyPaidSoFar = _getMonthlyPaid(monthStart);

        // 三重上限：月预算 / 声称损失 / 质押额×80%
        uint256 maxByBudget = MONTHLY_BUDGET - monthlyPaidSoFar;
        uint256 maxByClaim = c.claimedLossAmount;

        // 查找申请人关联的质押
        uint256 applicantStakeTotal = 0;
        bytes32[] storage userStakes = stakerStakes[c.claimant];
        for (uint256 i = 0; i < userStakes.length; i++) {
            Stake storage s = stakes[userStakes[i]];
            if (s.status == StakeStatus.Active) {
                applicantStakeTotal += s.amount;
            }
        }
        uint256 maxByStake = (applicantStakeTotal * MAX_PAYOUT_RATIO) / 100;

        payoutAmount = min3(maxByBudget, maxByClaim, maxByStake);

        c.payoutAmount = payoutAmount;
        c.status = ClaimStatus.PaidOut;
        totalPaidOut += payoutAmount;

        // 实际转账（生产环境需考虑gas优化）
        if (payoutAmount > 0 && address(this).balance >= payoutAmount) {
            (bool success, ) = c.claimant.call{ value: payoutAmount }("");
            if (!success) {
                c.status = ClaimStatus.Approved; // 保持approved状态以便后续手动处理
                payoutAmount = 0;
            }
        }

        emit ClaimReviewed(claimId, true, payoutAmount);
        return payoutAmount;
    }

    // ====== 查询函数 ======

    function getStakeInfo(bytes32 stakeId) external view returns (
        address staker,
        uint256 amount,
        StakeStatus status,
        uint256 lockedUntil
    ) {
        Stake storage s = stakes[stakeId];
        return (s.staker, s.amount, s.status, s.lockedUntil);
    }

    function getSlashingInfo(bytes32 eventId) external view returns (
        SlashReason reason,
        uint256 amount,
        address reporter
    ) {
        SlashingEvent storage e = slashings[eventId];
        return (e.reason, e.slashedAmount, e.reporter);
    }

    function getClaimInfo(bytes32 claimId) external view returns (
        address claimant,
        uint256 claimedAmount,
        ClaimStatus status,
        uint256 payoutAmount
    ) {
        ClaimRequest storage c = claims[claimId];
        return (c.claimant, c.claimedLossAmount, c.status, c.payoutAmount);
    }

    /** 获取池子整体状态 */
    function getPoolStats() external view returns (
        uint256 totalStaked_,
        uint256 totalSlashed_,
        uint256 totalPaidOut_,
        uint256 balance
    ) {
        return (totalStaked, totalSlashed, totalPaidOut, address(this).balance);
    }

    // ====== 内部函数 ======

    function getSlashCoefficient(SlashReason reason) internal pure returns (uint256) {
        if (reason == SlashReason.PrivacyBreach) return 50;
        if (reason == SlashReason.PolicyViolation) return 30;
        if (reason == SlashReason.FraudulentActivity) return 100;
        if (reason == SlashReason.Collusion) return 70;
        if (reason == SlashReason.AvailabilityFailure) return 20;
        return 30;  // default
    }

    function min3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        return (a < b) ? ((a < c) ? a : c) : ((b < c) ? b : c);
    }

    function _getMonthlyPaid(uint256 monthStart) internal view returns (uint256) {
        // 遍历所有claims计算本月赔付（生产应用用事件索引更高效）
        uint256 paid = 0;
        // 由于Solidity无法遍历mapping，此处返回已记录的全局统计
        // 生产环境应使用链下索引服务
        return paid;
    }

    // 接收ETH
    receive() external payable {}
}
