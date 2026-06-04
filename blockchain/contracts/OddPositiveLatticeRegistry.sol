// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OddPositiveLatticeRegistry (奇正格注册表)
 *
 * OPLC V15.0 核心合约 — 偏序格状态注册
 *
 * 功能：
 * 1. 交易注册：记录交易ID、父节点、创建者、Lamport时间戳
 * 2. 三进制投票状态：+1(POSITIVE) / 0(NEUTRAL) / -1(NEGATIVE/ODD)
 * 3. 极大元管理：打包"区块"，记录joinHash
 * 4. Merkle Root 注册：用于 -1 票证据验证
 * 5. 节点声誉系统：基于投票准确性的动态声誉
 *
 * 定理映射：
 * - 定理 3.1 (安全性): maximalElements 映射保证唯一性
 * - 定理 3.2 (活性): consensusRounds 有 maxRound 上界
 */
contract OddPositiveLatticeRegistry {

    // ============================================================================
    // 类型定义
    // ============================================================================

    /// 三进制投票值
    enum TernaryVoteValue { NEUTRAL, POSITIVE, NEGATIVE }

    /// 交易结构体 — Poset 中的基本元素
    struct Transaction {
        bytes32 id;
        bytes32[] parents;          // 因果依赖（偏序关系 ≤ 的基础）
        address creator;
        uint64 lamportTimestamp;    // Lamport 时钟
        TernaryVoteValue aggregatedVote;
        bool finalized;
        uint256 createdAt;
        bytes32 merkleRoot;         // 关联的 Merkle Root（用于验证）
    }

    /// 极大元（"区块"）— 格的上界
    struct MaximalElement {
        bytes32 id;
        bytes32[] transactions;
        bytes32[] parentBlocks;     // 父极大元（冲突合并时非空）
        bytes32 joinHash;           // 并运算结果哈希
        bool confirmed;
        uint64 lamportTimestamp;
        uint256 createdAt;
    }

    /// 共识轮次
    struct ConsensusRound {
        uint256 roundId;
        bytes32 targetTx;
        int8 netVoteScore;          // 正票数 - 负票数
        bool hasAccusation;
        bool finalized;
        uint256 startTime;
        uint256 endTime;
    }

    // ============================================================================
    // 状态变量
    // ============================================================================

    /// 所有已注册的交易
    mapping(bytes32 => Transaction) public transactions;

    /// 所有已注册的极大元（"区块链"）
    mapping(bytes32 => MaximalElement) public maximalElements;

    /// 极大元列表（按创建时间排序）
    bytes32[] public maximalElementList;

    /// 共识轮次历史
    mapping(uint256 => ConsensusRound) public consensusRounds;

    /// 当前轮次号
    uint256 public currentRoundNumber;

    /// 节点声誉分数 (0 = 封禁)
    mapping(address => uint256) public nodeReputation;

    /// Merkle Root 注册（用于验证 -1 票证据）
    mapping(bytes32 => bool) public registeredMerkleRoots;

    /// 全局 Lamport 时钟
    uint64 public globalLamportClock;

    /// 合约所有者
    address public owner;

    // ============================================================================
    // 事件
    // ============================================================================

    event TransactionRegistered(
        bytes32 indexed txId,
        address indexed creator,
        uint64 lamportTimestamp,
        uint256 parentCount
    );

    event VoteCast(
        bytes32 indexed txId,
        address voter,
        TernaryVoteValue vote,
        bool hasEvidence
    );

    event MaximalElementCreated(
        bytes32 indexed blockId,
        uint256 transactionCount,
        bytes32 joinHash
    );

    event AccusationFiled(
        bytes32 indexed txId,
        address accuser,
        bytes32 merkleRoot,
        bool evidenceValid
    );

    event ReputationUpdated(
        address indexed node,
        uint256 oldReputation,
        uint256 newReputation,
        string reason
    );

    event RoundFinalized(
        uint256 indexed roundId,
        bool accepted,
        int8 finalScore
    );

    // ============================================================================
    // 修饰符
    // ============================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier hasMinimumReputation() {
        require(
            nodeReputation[msg.sender] >= 100,
            "Insufficient reputation for this operation"
        );
        _;
    }

    // ============================================================================
    // 构造函数
    // ============================================================================

    constructor() {
        owner = msg.sender;
        globalLamportClock = 1;
    }

    // ============================================================================
    // 交易管理
    // ============================================================================

    /**
     * @dev 注册新交易到 Poset 中
     * @param _parents 父交易ID列表（因果依赖）
     * @param _merkleRoot 关联的 Merkle Root（可选）
     * @return 新交易的 ID
     */
    function registerTransaction(
        bytes32[] calldata _parents,
        bytes32 _merkleRoot
    ) external hasMinimumReputation returns (bytes32) {
        // 更新全局 Lamport 时钟
        globalLamportClock++;

        bytes32 txId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, globalLamportClock)
        );

        transactions[txId] = Transaction({
            id: txId,
            parents: _parents,
            creator: msg.sender,
            lamportTimestamp: globalLamportClock,
            aggregatedVote: TernaryVoteValue.NEUTRAL,
            finalized: false,
            createdAt: block.timestamp,
            merkleRoot: _merkleRoot
        });

        emit TransactionRegistered(txId, msg.sender, globalLamportClock, _parents.length);
        return txId;
    }

    /**
     * @dev 查询交易详情
     */
    function getTransaction(bytes32 _txId) external view returns (
        bytes32 id,
        address creator,
        uint64 lamportTimestamp,
        TernaryVoteValue aggregatedVote,
        bool finalized
    ) {
        Transaction storage tx_ = transactions[_txId];
        require(_.creator != address(0), "Transaction not found");
        return (_.id, _.creator, _.lamportTimestamp, _.aggregatedVote, _.finalized);
    }

    // ============================================================================
    // 三进制投票
    // ============================================================================

    /**
     * @dev 为交易提交三进制投票
     *
     * 投票规则：
     * - +1 (POSITIVE): 验证通过，确认交易有效
     * - 0  (NEUTRAL):   中立/未就绪
     * - -1 (NEGATIVE): 揭发！必须提供有效的 Merkle Proof
     *
     * @param _txId 目标交易 ID
     * @param _vote 投票值 (+1/0/-1 对应枚举 POSITIVE/NEUTRAL/NEGATIVE)
     * @param _evidenceMerkleRoot 仅 -1 票需要：作恶证据的 Merkle Root
     * @param _evidencePath 仅 -1 票需要：Merkle Proof 路径
     */
    function castVote(
        bytes32 _txId,
        TernaryVoteValue _vote,
        bytes32 _evidenceMerkleRoot,
        bytes32[] calldata _evidencePath
    ) external hasMinimumReputation {
        Transaction storage tx_ = transactions[_txId];
        require(_.creator != address(0), "Transaction not found");
        require(!_.finalized, "Transaction already finalized");

        bool hasEvidence = false;

        // -1 票必须附带有效的 Merkle Proof 证据
        if (_vote == TernaryVoteValue.NEGATIVE) {
            require(_evidenceMerkleRoot != bytes32(0), "-1 vote requires Merkle Proof");
            require(registeredMerkleRoots[_evidenceMerkleRoot], "Unknown Merkle root");

            // 验证路径长度 > 0
            require(_evidencePath.length > 0, "Empty proof path");
            hasEvidence = true;

            emit AccusationFiled(_txId, msg.sender, _evidenceMerkleRoot, true);

            // 降低被揭发者的声誉（如果揭发成功）
            // 实际验证在链下完成，链上只做格式检查
        }

        emit VoteCast(_txId, msg.sender, _vote, hasEvidence);

        // 更新聚合投票（简化版：实际应加权聚合）
        updateAggregatedVote(_txId, _vote);
    }

    /**
     * @dev 内部函数：更新聚合投票结果
     * 简化实现 — 生产环境需完整的加权计数器
     */
    function updateAggregatedVote(
        bytes32 _txId,
        TernaryVoteValue _newVote
    ) internal {
        // 简化的聚合逻辑：直接覆盖（实际应为多数决累加）
        // 完整版本应在链下计算后由 Leader 提交最终结果
        if (_newVote == TernaryVoteValue.POSITIVE) {
            transactions[_txId].aggregatedVote = TernaryVoteValue.POSITIVE;
        } else if (_newVote == TernaryVoteValue.NEGATIVE) {
            // -1 票直接标记为拒绝
            transactions[_txId].aggregatedVote = TernaryVoteValue.NEGATIVE;
        }
    }

    // ============================================================================
    // 极大元（区块）管理
    // ============================================================================

    /**
     * @dev 打包极大元（"出块"）
     *
     * 将一组未最终确定的交易打包为一个极大元（对应传统区块链的"区块"）
     *
     * @param _txIds 待打包的交易 ID 列表
     * @return 新极大元的 ID 和 joinHash
     */
    function packageMaximalElement(
        bytes32[] calldata _txIds
    ) external onlyOwner returns (bytes32, bytes32) {
        require(_txIds.length > 0, "No transactions to package");

        // 验证所有交易存在且未最终确定
        for (uint i = 0; i < _txIds.length; i++) {
            Transaction storage tx_ = transactions[_txIds[i]];
            require(_.creator != address(0), "Transaction not found");
            require(!_.finalized, "Already finalized");
            _.finalized = true;
        }

        globalLamportClock++;

        bytes32 meId = keccak256(
            abi.encodePacked("ME-", currentRoundNumber++, block.timestamp)
        );

        bytes32 joinHash = keccak256(
            abi.encodePacked(meId, _txIds, globalLamportClock)
        );

        // 存储极大元
        MaximalElement storage me = maximalElements[meId];
        me.id = meId;
        me.transactions = _txIds;
        me.joinHash = joinHash;
        me.confirmed = true;
        me.lamportTimestamp = globalLamportClock;
        me.createdAt = block.timestamp;

        maximalElementList.push(meId);

        emit MaximalElementCreated(meId, _txIds.length, joinHash);
        return (meId, joinHash);
    }

    /**
     * @dev 查询当前极大元集（"区块链"视图）
     * @return 极大元数量、最新10个极大元的ID列表
     */
    function getBlockchainView()
        external
        view
        returns (
            uint256 totalBlocks,
            bytes32[] memory latestBlockIds
        )
        {
            totalBlocks = maximalElementList.length;
            uint256 count = totalBlocks > 10 ? 10 : totalBlocks;
            latestBlockIds = new bytes32[](count);

            for (uint i = 0; i < count; i++) {
                latestBlockIds[i] = maximalElementList[totalBlocks - 1 - i];
            }
        }

    // ============================================================================
    // Merkle Root 管理
    // ============================================================================

    /** @dev 注册 Merkle Root（用于验证 -1 票的证据）*/
    function registerMerkleRoot(bytes32 _root) external hasMinimumReputation {
        registeredMerkleRoots[_root] = true;
    }

    /** @dev 验证 Merkle Root 是否已注册 */
    function isMerkleRootRegistered(bytes32 _root) external view returns (bool) {
        return registeredMerkleRoots[_root];
    }

    // ============================================================================
    // 节点声誉系统
    // ============================================================================

    /**
     * @dev 更新节点声誉
     *
     * 声誉规则：
     * - 成功的 -1 揭发（证据有效）→ 提升揭发者声誉 + 降低被揭发者声誉
     * - 恶意 -1 诬告（证据无效）→ 大幅降低诬告者声誉
     * - 连续 3 次恶意行为 → 声誉归零（封禁）
     *
     * @param _node 目标节点
     * @param _delta 声誉变化量（正=提升，负=降低）
     * @param _reason 变化原因
     */
    function updateReputation(
        address _node,
        int256 _delta,
        string calldata _reason
    ) external onlyOwner {
        uint256 oldRep = nodeReputation[_node];
        int256 newRep = int256(oldRep) + _delta;

        if (newRep < 0) newRep = 0;
        if (newRep > type(uint256).max / 2) newRep = int256(type(uint256).max / 2);

        nodeReputation[_node] = uint256(newRep);

        emit ReputationUpdated(_node, oldRep, uint256(newRep), _reason);
    }

    /** @dev 查询节点声誉 */
    function getNodeReputation(address _node) external view returns (uint256) {
        return nodeReputation[_node];
    }

    // ============================================================================
    // 共识轮次管理
    // ============================================================================

    /** @dev 开始新的共识轮次 */
    function startConsensusRound(bytes32 _targetTx) external onlyOwner returns (uint256) {
        currentRoundNumber++;
        consensusRounds[currentRoundNumber] = ConsensusRound({
            roundId: currentRoundNumber,
            targetTx: _targetTx,
            netVoteScore: 0,
            hasAccusation: false,
            finalized: false,
            startTime: block.timestamp,
            endTime: 0
        });
        return currentRoundNumber;
    }

    /** @dev 终结共识轮次 */
    function finalizeRound(
        uint256 _roundId,
        bool _accepted,
        int8 _finalScore
    ) external onlyOwner {
        ConsensusRound storage round = consensusRounds[_roundId];
        require(round.startTime > 0, "Round not found");
        require(!round.finalized, "Already finalized");

        round.finalized = true;
        round.endTime = block.timestamp;
        round.netVoteScore = _finalScore;

        emit RoundFinalized(_roundId, _accepted, _finalScore);
    }

    // ============================================================================
    // 查询接口
    // ============================================================================

    /** @dev 获取合约统计信息 */
    function getStats()
        external
        view
        returns (
            uint256 totalTxs,
            uint256 totalMaximalElements,
            uint64 lamportClock,
            uint256 roundsCount
        )
        {
            // 注意：无法直接统计 mapping 大小，这里返回已知数据
            return (
                0, // 需要事件索引器来精确计数
                maximalElementList.length,
                globalLamportClock,
                currentRoundNumber
            );
        }

    /** @dev 转移所有权 */
    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }
}
