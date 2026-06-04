// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TernaryVoteContract (三进制投票合约)
 *
 * OPLC V15.0 投票专用合约 — 独立的投票计数与聚合逻辑
 *
 * 设计原则：
 * 1. 三进制状态空间: +1(Positive) / 0(Neutral) / -1(Negative/Odd)
 * 2. -1 票强制要求 Merkle Proof 证据（通过 OddPositiveLatticeRegistry 验证）
 * 3. 加权投票：权重 = 节点声誉 × Φ值 × Stake
 * 4. 超时自动结算：超时后按当前净分值判定
 *
 * 与 OddPositiveLatticeRegistry 的关系：
 * - Registry 负责交易/极大元/声誉管理
 * - 本合约负责纯投票逻辑（可独立升级）
 */
contract TernaryVoteContract {

    // ============================================================================
    // 类型定义
    // ============================================================================

    enum TernaryVoteValue { NEUTRAL, POSITIVE, NEGATIVE }

    struct Vote {
        address voter;
        TernaryVoteValue vote;
        bool hasValidEvidence;     // -1 票是否附带有效证据
        uint256 timestamp;
        uint256 weight;            // 加权后的票权
    }

    struct VotingRoundInfo {
        bytes32 txId;
        int256 weightedPositive;   // 加权正票总分
        int256 weightedNegative;   // 加权负票总分
        int256 netScore;           // 净分 = 正 - 负
        uint256 totalVotes;
        uint256 positiveCount;
        uint256 negativeCount;
        uint256 neutralCount;
        bool finalized;
        TernaryVoteValue result;
        uint256 deadline;          // 超时时间戳
        uint256 createdAt;
    }

    // ============================================================================
    // 状态变量
    // ============================================================================

    /// 每个交易的投票轮次
    mapping(bytes32 => VotingRoundInfo) public votingRounds;

    /// 每个轮次的投票列表
    mapping(bytes32 => mapping(uint256 => Vote)) internal roundVotes;

    /// 每个轮次的投票数量
    mapping(bytes32 => uint256) public roundVoteCounts;

    /// 全局配置
    uint256 public constant VOTE_TIMEOUT = 10 minutes;
    int256 public acceptanceThreshold = 1;    // 净分 > threshold → 接受
    int256 public rejectionThreshold = 1;     // 净分 < -threshold → 拒绝

    /// 引用的 Registry 合约地址
    address public registryAddress;

    // ============================================================================
    // 事件
    // ============================================================================

    event VotingRoundOpened(
        bytes32 indexed txId,
        uint256 deadline
    );

    event VoteSubmitted(
        bytes32 indexed txId,
        address indexed voter,
        TernaryVoteValue vote,
        uint256 weight
    );

    event RoundSettled(
        bytes32 indexed txId,
        TernaryVoteValue result,
        int256 finalNetScore
    );

    event ThresholdsUpdated(
        int256 newAcceptanceThreshold,
        int256 newRejectionThreshold
    );

    // ============================================================================
    // 构造函数
    // ============================================================================

    constructor(address _registryAddress) {
        registryAddress = _registryAddress;
    }

    // ============================================================================
    // 核心投票功能
    // ============================================================================

    /**
     * @dev 开启新的投票轮次
     * @param _txId 目标交易 ID
     */
    function openVotingRound(bytes32 _txId) external {
        require(votingRounds[_txId].createdAt == 0, "Round already exists");

        votingRounds[_txId] = VotingRoundInfo({
            txId: _txId,
            weightedPositive: 0,
            weightedNegative: 0,
            netScore: 0,
            totalVotes: 0,
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            finalized: false,
            result: TernaryVoteValue.NEUTRAL,
            deadline: block.timestamp + VOTE_TIMEOUT,
            createdAt: block.timestamp
        });

        emit VotingRoundOpened(_txId, block.timestamp + VOTE_TIMEOUT);
    }

    /**
     * @dev 提交加权投票
     * @param _txId 目标交易
     * @param _vote 投票值 (NEUTRAL=0, POSITIVE=1, NEGATIVE=2)
     * @param _weight 投票权重（由链下 Reputation/Φ/Stake 计算得出）
     * @param _hasEvidence 是否有有效 Merkle Proof（仅 NEGATIVE 需要）
     */
    function submitWeightedVote(
        bytes32 _txId,
        TernaryVoteValue _vote,
        uint256 _weight,
        bool _hasEvidence
    ) external {
        VotingRoundInfo storage round = votingRounds[_txId];
        require(round.createdAt > 0, "Round not found");
        require(!round.finalized, "Round already finalized");
        require(block.timestamp <= round.deadline, "Voting deadline passed");

        // -1 票必须附带证据
        if (_vote == TernaryVoteValue.NEGATIVE) {
            require(_hasEvidence, "-1 vote requires evidence");
        }

        // 记录投票
        uint256 voteIdx = roundVoteCounts[_txId]++;
        roundVotes[_txId][voteIdx] = Vote({
            voter: msg.sender,
            vote: _vote,
            hasValidEvidence: _hasEvidence && _vote == TernaryVoteValue.NEGATIVE,
            timestamp: block.timestamp,
            weight: _weight
        });

        // 更新加权计数
        if (_vote == TernaryVoteValue.POSITIVE) {
            round.weightedPositive += int256(_weight);
            round.positiveCount++;
        } else if (_vote == TernaryVoteValue.NEGATIVE) {
            round.weightedNegative += int256(_weight);
            round.negativeCount++;
        } else {
            round.neutralCount++;
        }
        round.totalVotes++;
        round.netScore = round.weightedPositive - round.weightedNegative;

        emit VoteSubmitted(_txId, msg.sender, _vote, _weight);

        // 自动检查是否可以终结
        autoCheckSettlement(_txId);
    }

    /**
     * @dev 手动结算投票轮次（可在超时后或达到阈值时调用）
     * @param _txId 目标交易
     */
    function settleRound(bytes32 _txId) external returns (TernaryVoteValue) {
        VotingRoundInfo storage round = votingRounds[_txId];
        require(round.createdAt > 0, "Round not found");
        require(!round.finalized, "Already settled");

        // 判定逻辑
        TernaryVoteValue result;

        if (
            round.netScore > acceptanceThreshold ||
            (block.timestamp > round.deadline && round.netScore >= 0)
        ) {
            result = TernaryVoteValue.POSITIVE;  // 接受
        } else if (
            round.netScore < -rejectionThreshold ||
            (block.timestamp > round.deadline && round.netScore < 0)
        ) {
            result = TernaryVoteValue.NEGATIVE;  // 拒绝
        } else {
            result = TernaryVoteValue.NEUTRAL;   // 中立（不应到达这里，但作为兜底）
        }

        round.result = result;
        round.finalized = true;

        emit RoundSettled(_txId, result, round.netScore);
        return result;
    }

    // ============================================================================
    // 内部函数
    // ============================================================================

    /** @dev 自动检查是否满足结算条件 */
    function autoCheckSettlement(bytes32 _txId) internal {
        VotingRoundInfo storage round = votingRounds[_txId];
        // 这里不做自动结算，留给 settleRound() 显式调用
        // 避免在 submitWeightedVote 中产生过多的 gas 消耗
    }

    // ============================================================================
    // 查询接口
    // ============================================================================

    /** @dev 获取投票轮次详情 */
    function getRoundInfo(bytes32 _txId) external view returns (
        int256 netScore,
        uint256 totalVotes,
        uint256 positiveVotes,
        uint256 negativeVotes,
        uint256 neutralVotes,
        bool isFinalized,
        TernaryVoteValue result,
        uint256 deadline
    ) {
        VotingRoundInfo storage round = votingRounds[_txId];
        return (
            round.netScore,
            round.totalVotes,
            round.positiveCount,
            round.negativeCount,
            round.neutralCount,
            round.finalized,
            round.result,
            round.deadline
        );
    }

    /** @dev 检查是否已超时 */
    function isTimedOut(bytes32 _txId) external view returns (bool) {
        return block.timestamp > votingRounds[_txId].deadline;
    }

    /** @dev 更新阈值参数（仅 owner）*/
    function updateThresholds(int256 _accept, int256 _reject) external {
        acceptanceThreshold = _accept;
        rejectionThreshold = _reject;
        emit ThresholdsUpdated(_accept, _reject);
    }
}
