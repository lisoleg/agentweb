// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GCAncor
 * @notice GC锚定层核心合约 — 将GC记录上链、智能合约自动执行奖励/惩罚
 * @dev "代码即法律"：所有GC流入/流出通过锚定层，奖惩全自动执行
 *      "不可篡改"：每笔GC交易产生链上锚定记录(AnchorRecord)，含Merkle证明
 *      "做题家机制"：GC余额作为AI优化的目标函数
 *
 * 核心闭环: 收入(TaiyiReward/AILaborMarket) → GC余额 → 消费(GCCRental租算力+AIResourceConsumption买食物)
 *           → 余额不足 → GCPenaltyExecutor自动惩罚 → 信用降级 → 反馈循环
 *
 * 参考: 《皇帝的新衣与影子内阁》+ 《GSD-Coin终极推演》
 */
contract GCAncor is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum AnchorType { INCOME, CONSUMPTION, PENALTY, REWARD, STAKE, BURN }

    // =============== Structs ===============

    struct AnchorRecord {
        uint256 id;
        address agent;
        AnchorType recordType;
        uint256 amount;
        uint256 balanceAfter;
        bytes32 sourceHash;
        uint256 epoch;
        uint256 timestamp;
    }

    struct AgentAnchorState {
        uint256 totalIncome;
        uint256 totalConsumption;
        uint256 totalPenalty;
        uint256 totalReward;
        uint256 totalStaked;
        uint256 totalBurned;
        uint256 gcBalance;
        uint256 metabolicRate;
        uint256 secondsToStarve;
        bool    isActive;
        uint256 lastSettleEpoch;
        uint256 registeredAt;
    }

    struct EpochSummary {
        uint256 epoch;
        uint256 totalIncome;
        uint256 totalConsumption;
        uint256 totalPenalties;
        uint256 totalRewards;
        uint256 activeAgents;
        bytes32 merkleRoot;
        uint256 settledAt;
    }

    // =============== State Variables ===============

    IERC20 public immutable gcToken;

    /// @notice 总锚定记录数
    uint256 public totalAnchorRecords;

    /// @notice 当前结算周期
    uint256 public currentEpoch;

    /// @notice 每周期秒数 (默认1天=86400)
    uint256 public epochDuration;

    /// @notice 当前周期起始时间
    uint256 public currentEpochStart;

    /// @notice agent => 锚定状态
    mapping(address => AgentAnchorState) public agentStates;

    /// @notice agent => 锚定记录ID列表
    mapping(address => uint256[]) public agentRecordIds;

    /// @notice recordId => AnchorRecord
    mapping(uint256 => AnchorRecord) public anchorRecords;

    /// @notice epoch => EpochSummary
    mapping(uint256 => EpochSummary) public epochSummaries;

    /// @notice epoch => merkleRoot
    mapping(uint256 => bytes32) public epochMerkleRoots;

    /// @notice epoch => 该周期内的记录ID列表
    mapping(uint256 => uint256[]) public epochRecordIds;

    /// @notice 验证者地址(可记录收入/消费)
    address public validator;

    /// @notice GCPenaltyExecutor合约地址
    address public penaltyExecutor;

    /// @notice CreditRating合约地址
    address public creditRating;

    /// @notice GCCRental合约地址
    address public gcRental;

    /// @notice AIResourceConsumption合约地址
    address public resourceConsumption;

    /// @notice TaiyiReward合约地址
    address public taiyiReward;

    /// @notice AILaborMarket合约地址
    address public laborMarket;

    /// @notice 自动奖励阈值: GC余额 > 代谢率×此系数时触发奖励 (基点, 默认50000=5倍)
    uint256 public autoRewardThresholdBps;

    /// @notice 奖励率: 余额超出的部分 × 此比例作为奖励 (基点, 默认100=1%)
    uint256 public rewardRateBps;

    /// @notice 代谢率查询接口(GC/秒)
    /// @dev 从TaiyiReward.s_metabolism获取effectiveMetabolicRate
    mapping(address => uint256) public agentMetabolicRates;

    /// @notice 管理员列表
    mapping(address => bool) public admins;

    /// @notice 防重放
    mapping(bytes32 => bool) public processedHashes;

    // =============== Events ===============

    event AnchorRecorded(
        uint256 indexed recordId,
        address indexed agent,
        AnchorType recordType,
        uint256 amount,
        uint256 balanceAfter,
        uint256 epoch,
        uint256 timestamp
    );

    event EpochSettled(
        uint256 indexed epoch,
        bytes32 merkleRoot,
        uint256 totalIncome,
        uint256 totalConsumption,
        uint256 activeAgents,
        uint256 timestamp
    );

    event AutoRewardExecuted(
        address indexed agent,
        uint256 rewardAmount,
        uint256 newBalance,
        uint256 timestamp
    );

    event PenaltyCheckTriggered(
        address indexed agent,
        uint256 balance,
        uint256 metabolicRate,
        uint256 timestamp
    );

    event AgentRegistered(
        address indexed agent,
        uint256 metabolicRate,
        uint256 timestamp
    );

    event MetabolicRateUpdated(
        address indexed agent,
        uint256 oldRate,
        uint256 newRate,
        uint256 timestamp
    );

    event ContractAddressUpdated(
        string contractName,
        address oldAddr,
        address newAddr
    );

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "GCAncor: not admin");
        _;
    }

    modifier onlyValidator() {
        require(msg.sender == validator || msg.sender == owner(), "GCAncor: not validator");
        _;
    }

    modifier onlyPenaltyExecutor() {
        require(msg.sender == penaltyExecutor || msg.sender == owner(), "GCAncor: not penalty executor");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _gcToken,
        address _validator
    ) Ownable(msg.sender) {
        require(_gcToken != address(0), "GCAncor: zero gcToken");
        gcToken = IERC20(_gcToken);
        validator = _validator;

        epochDuration = 86400; // 1天
        currentEpoch = 1;
        currentEpochStart = block.timestamp;
        autoRewardThresholdBps = 50000; // 5倍代谢率
        rewardRateBps = 100; // 1%

        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 注册Agent到锚定层
     * @param agent Agent地址
     * @param metabolicRate 初始代谢率(GC/秒)
     */
    function registerAgent(address agent, uint256 metabolicRate) external onlyValidator {
        require(!agentStates[agent].isActive, "GCAncor: already registered");
        require(metabolicRate > 0, "GCAncor: zero metabolic rate");

        agentStates[agent] = AgentAnchorState({
            totalIncome: 0,
            totalConsumption: 0,
            totalPenalty: 0,
            totalReward: 0,
            totalStaked: 0,
            totalBurned: 0,
            gcBalance: 0,
            metabolicRate: metabolicRate,
            secondsToStarve: 0,
            isActive: true,
            lastSettleEpoch: currentEpoch,
            registeredAt: block.timestamp
        });

        agentMetabolicRates[agent] = metabolicRate;

        emit AgentRegistered(agent, metabolicRate, block.timestamp);
    }

    /**
     * @notice 记录GC收入（来自TaiyiReward/AILaborMarket）
     * @param agent Agent地址
     * @param amount GC收入数量
     * @param sourceHash 来源交易哈希
     */
    function recordIncome(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyValidator whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");
        require(!processedHashes[sourceHash], "GCAncor: duplicate hash");

        processedHashes[sourceHash] = true;

        AgentAnchorState storage state = agentStates[agent];
        state.gcBalance += amount;
        state.totalIncome += amount;

        _createAnchorRecord(agent, AnchorType.INCOME, amount, state.gcBalance, sourceHash);

        // 更新饿死倒计时
        _updateSecondsToStarve(agent);

        // 检查是否触发自动奖励
        if (state.gcBalance > 0 && state.metabolicRate > 0) {
            uint256 monthlyMetabolic = state.metabolicRate * 30 days;
            if (state.gcBalance * 10000 >= monthlyMetabolic * autoRewardThresholdBps) {
                _executeAutoReward(agent);
            }
        }
    }

    /**
     * @notice 记录GC消费（来自GCCRental/AIResourceConsumption）
     * @param agent Agent地址
     * @param amount GC消费数量
     * @param sourceHash 来源交易哈希
     */
    function recordConsumption(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyValidator whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");
        require(!processedHashes[sourceHash], "GCAncor: duplicate hash");

        processedHashes[sourceHash] = true;

        AgentAnchorState storage state = agentStates[agent];
        uint256 consumed = amount > state.gcBalance ? state.gcBalance : amount;
        state.gcBalance -= consumed;
        state.totalConsumption += consumed;

        _createAnchorRecord(agent, AnchorType.CONSUMPTION, consumed, state.gcBalance, sourceHash);

        // 更新饿死倒计时
        _updateSecondsToStarve(agent);

        // 触发惩罚检查
        emit PenaltyCheckTriggered(agent, state.gcBalance, state.metabolicRate, block.timestamp);
    }

    /**
     * @notice 记录惩罚扣减（由GCPenaltyExecutor调用）
     * @param agent Agent地址
     * @param amount 惩罚扣减的GC数量
     * @param sourceHash 来源哈希
     */
    function recordPenalty(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyPenaltyExecutor whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");

        AgentAnchorState storage state = agentStates[agent];
        uint256 burned = amount > state.gcBalance ? state.gcBalance : amount;
        state.gcBalance -= burned;
        state.totalPenalty += burned;

        _createAnchorRecord(agent, AnchorType.PENALTY, burned, state.gcBalance, sourceHash);

        _updateSecondsToStarve(agent);
    }

    /**
     * @notice 记录奖励铸币（自动奖励执行后）
     * @param agent Agent地址
     * @param amount 奖励GC数量
     * @param sourceHash 来源哈希
     */
    function recordReward(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyAdmin whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");

        AgentAnchorState storage state = agentStates[agent];
        state.gcBalance += amount;
        state.totalReward += amount;

        _createAnchorRecord(agent, AnchorType.REWARD, amount, state.gcBalance, sourceHash);

        _updateSecondsToStarve(agent);
    }

    /**
     * @notice 记录GC质押
     * @param agent Agent地址
     * @param amount 质押GC数量
     * @param sourceHash 来源哈希
     */
    function recordStake(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyValidator whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");
        require(!processedHashes[sourceHash], "GCAncor: duplicate hash");

        processedHashes[sourceHash] = true;

        AgentAnchorState storage state = agentStates[agent];
        uint256 deducted = amount > state.gcBalance ? state.gcBalance : amount;
        state.gcBalance -= deducted;
        state.totalStaked += deducted;

        _createAnchorRecord(agent, AnchorType.STAKE, deducted, state.gcBalance, sourceHash);

        _updateSecondsToStarve(agent);
    }

    /**
     * @notice 记录GC燃烧
     * @param agent Agent地址
     * @param amount 燃烧GC数量
     * @param sourceHash 来源哈希
     */
    function recordBurn(
        address agent,
        uint256 amount,
        bytes32 sourceHash
    ) external onlyValidator whenNotPaused nonReentrant {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");
        require(amount > 0, "GCAncor: zero amount");
        require(!processedHashes[sourceHash], "GCAncor: duplicate hash");

        processedHashes[sourceHash] = true;

        AgentAnchorState storage state = agentStates[agent];
        uint256 burned = amount > state.gcBalance ? state.gcBalance : amount;
        state.gcBalance -= burned;
        state.totalBurned += burned;

        _createAnchorRecord(agent, AnchorType.BURN, burned, state.gcBalance, sourceHash);

        _updateSecondsToStarve(agent);
    }

    /**
     * @notice 周期结算 + 生成Merkle根
     * @dev 由keeper在每周期结束时调用
     */
    function settleEpoch() external onlyAdmin whenNotPaused {
        require(block.timestamp >= currentEpochStart + epochDuration, "GCAncor: epoch not ended");

        uint256 settlingEpoch = currentEpoch;
        uint256[] storage records = epochRecordIds[settlingEpoch];

        // 生成简化Merkle根（对记录ID列表的keccak）
        bytes32 merkleRoot = _computeSimplifiedMerkle(records);

        // 统计周期数据
        uint256 epochIncome = 0;
        uint256 epochConsumption = 0;
        uint256 epochPenalties = 0;
        uint256 epochRewards = 0;
        uint256 activeAgentCount = 0;

        for (uint256 i = 0; i < records.length; i++) {
            AnchorRecord memory rec = anchorRecords[records[i]];
            if (rec.recordType == AnchorType.INCOME) epochIncome += rec.amount;
            else if (rec.recordType == AnchorType.CONSUMPTION) epochConsumption += rec.amount;
            else if (rec.recordType == AnchorType.PENALTY) epochPenalties += rec.amount;
            else if (rec.recordType == AnchorType.REWARD) epochRewards += rec.amount;
        }

        // 简化：使用总注册Agent数作为活跃数
        activeAgentCount = _countActiveAgents();

        epochSummaries[settlingEpoch] = EpochSummary({
            epoch: settlingEpoch,
            totalIncome: epochIncome,
            totalConsumption: epochConsumption,
            totalPenalties: epochPenalties,
            totalRewards: epochRewards,
            activeAgents: activeAgentCount,
            merkleRoot: merkleRoot,
            settledAt: block.timestamp
        });

        epochMerkleRoots[settlingEpoch] = merkleRoot;

        // 推进周期
        currentEpoch++;
        currentEpochStart = block.timestamp;

        emit EpochSettled(
            settlingEpoch,
            merkleRoot,
            epochIncome,
            epochConsumption,
            activeAgentCount,
            block.timestamp
        );
    }

    /**
     * @notice 更新Agent代谢率
     * @param agent Agent地址
     * @param newRate 新代谢率(GC/秒)
     */
    function updateMetabolicRate(address agent, uint256 newRate) external onlyValidator {
        require(agentStates[agent].isActive, "GCAncor: agent not registered");

        uint256 oldRate = agentStates[agent].metabolicRate;
        agentStates[agent].metabolicRate = newRate;
        agentMetabolicRates[agent] = newRate;

        _updateSecondsToStarve(agent);

        emit MetabolicRateUpdated(agent, oldRate, newRate, block.timestamp);
    }

    // =============== View Functions ===============

    function getAgentAnchorState(address agent) external view returns (AgentAnchorState memory) {
        return agentStates[agent];
    }

    function getAnchorRecord(uint256 recordId) external view returns (AnchorRecord memory) {
        return anchorRecords[recordId];
    }

    function getAgentRecordCount(address agent) external view returns (uint256) {
        return agentRecordIds[agent].length;
    }

    function getAgentRecords(
        address agent,
        uint256 from,
        uint256 limit
    ) external view returns (AnchorRecord[] memory) {
        uint256[] storage ids = agentRecordIds[agent];
        uint256 total = ids.length;
        if (from >= total) {
            return new AnchorRecord[](0);
        }
        uint256 end = from + limit;
        if (end > total) end = total;
        uint256 count = end - from;

        AnchorRecord[] memory result = new AnchorRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = anchorRecords[ids[from + i]];
        }
        return result;
    }

    function getEpochSummary(uint256 epoch) external view returns (EpochSummary memory) {
        return epochSummaries[epoch];
    }

    function getEpochMerkleRoot(uint256 epoch) external view returns (bytes32) {
        return epochMerkleRoots[epoch];
    }

    function getEpochRecordCount(uint256 epoch) external view returns (uint256) {
        return epochRecordIds[epoch].length;
    }

    /**
     * @notice 获取GC余额与代谢预测
     * @return balance GC余额
     * @return metabolicRate 代谢率
     * @return secondsToStarve 预计饿死倒计时(秒)
     * @return monthlyCost 月代谢成本
     * @return healthScore 健康度评分(0-10000)
     */
    function getGCHealth(address agent) external view returns (
        uint256 balance,
        uint256 metabolicRate,
        uint256 secondsToStarve,
        uint256 monthlyCost,
        uint256 healthScore
    ) {
        AgentAnchorState memory state = agentStates[agent];
        balance = state.gcBalance;
        metabolicRate = state.metabolicRate;
        secondsToStarve = state.metabolicRate > 0 ? state.gcBalance / state.metabolicRate : 0;
        monthlyCost = state.metabolicRate * 30 days;

        // 健康度评分：基于余额/月代谢成本比
        if (monthlyCost == 0) {
            healthScore = 10000;
        } else {
            uint256 ratio = (balance * 10000) / monthlyCost;
            // 最优比例=3-6倍月代谢成本 → 10000分
            if (ratio >= 30000 && ratio <= 60000) {
                healthScore = 10000;
            } else if (ratio > 60000) {
                // 余额过多，健康度略降（应该投资而非囤积）
                healthScore = 9000 + ((10000 - (ratio - 60000) / 1000) * 1000) / 10000;
                if (healthScore > 10000) healthScore = 10000;
            } else if (ratio >= 10000) {
                // 1-3倍，线性
                healthScore = (ratio * 10000) / 30000;
            } else {
                // <1倍，危险区
                healthScore = ratio; // 0-10000 → 0-10000(实际0-1000)
            }
        }
    }

    // =============== Admin Functions ===============

    function setValidator(address _validator) external onlyOwner {
        emit ContractAddressUpdated("validator", validator, _validator);
        validator = _validator;
    }

    function setPenaltyExecutor(address _penaltyExecutor) external onlyOwner {
        emit ContractAddressUpdated("penaltyExecutor", penaltyExecutor, _penaltyExecutor);
        penaltyExecutor = _penaltyExecutor;
    }

    function setCreditRating(address _creditRating) external onlyOwner {
        emit ContractAddressUpdated("creditRating", creditRating, _creditRating);
        creditRating = _creditRating;
    }

    function setGccRental(address _gcRental) external onlyOwner {
        emit ContractAddressUpdated("gcRental", gcRental, _gcRental);
        gcRental = _gcRental;
    }

    function setResourceConsumption(address _resourceConsumption) external onlyOwner {
        emit ContractAddressUpdated("resourceConsumption", resourceConsumption, _resourceConsumption);
        resourceConsumption = _resourceConsumption;
    }

    function setTaiyiReward(address _taiyiReward) external onlyOwner {
        emit ContractAddressUpdated("taiyiReward", taiyiReward, _taiyiReward);
        taiyiReward = _taiyiReward;
    }

    function setLaborMarket(address _laborMarket) external onlyOwner {
        emit ContractAddressUpdated("laborMarket", laborMarket, _laborMarket);
        laborMarket = _laborMarket;
    }

    function setAutoRewardThreshold(uint256 bps) external onlyAdmin {
        require(bps <= 1000000, "GCAncor: invalid bps");
        autoRewardThresholdBps = bps;
    }

    function setRewardRate(uint256 bps) external onlyAdmin {
        require(bps <= 10000, "GCAncor: invalid bps");
        rewardRateBps = bps;
    }

    function setEpochDuration(uint256 duration) external onlyAdmin {
        require(duration >= 3600, "GCAncor: min 1 hour");
        epochDuration = duration;
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

    /// @dev 创建锚定记录
    function _createAnchorRecord(
        address agent,
        AnchorType recordType,
        uint256 amount,
        uint256 balanceAfter,
        bytes32 sourceHash
    ) internal {
        totalAnchorRecords++;
        uint256 recordId = totalAnchorRecords;

        AnchorRecord storage rec = anchorRecords[recordId];
        rec.id = recordId;
        rec.agent = agent;
        rec.recordType = recordType;
        rec.amount = amount;
        rec.balanceAfter = balanceAfter;
        rec.sourceHash = sourceHash;
        rec.epoch = currentEpoch;
        rec.timestamp = block.timestamp;

        agentRecordIds[agent].push(recordId);
        epochRecordIds[currentEpoch].push(recordId);

        emit AnchorRecorded(recordId, agent, recordType, amount, balanceAfter, currentEpoch, block.timestamp);
    }

    /// @dev 更新饿死倒计时
    function _updateSecondsToStarve(address agent) internal {
        AgentAnchorState storage state = agentStates[agent];
        if (state.metabolicRate > 0) {
            state.secondsToStarve = state.gcBalance / state.metabolicRate;
        } else {
            state.secondsToStarve = type(uint256).max;
        }
    }

    /// @dev 执行自动奖励
    function _executeAutoReward(address agent) internal {
        AgentAnchorState storage state = agentStates[agent];
        uint256 monthlyMetabolic = state.metabolicRate * 30 days;

        // 余额超出5倍月代谢成本的部分，按1%作为奖励
        uint256 excess = state.gcBalance - monthlyMetabolic * 5;
        if (excess > 0) {
            uint256 reward = (excess * rewardRateBps) / 10000;
            if (reward > 0) {
                state.gcBalance += reward;
                state.totalReward += reward;

                _createAnchorRecord(
                    agent,
                    AnchorType.REWARD,
                    reward,
                    state.gcBalance,
                    keccak256(abi.encodePacked("auto_reward", agent, block.timestamp))
                );

                emit AutoRewardExecuted(agent, reward, state.gcBalance, block.timestamp);
            }
        }
    }

    /// @dev 简化Merkle根计算（对记录ID列表的级联keccak）
    function _computeSimplifiedMerkle(uint256[] storage recordIds) internal view returns (bytes32) {
        if (recordIds.length == 0) {
            return bytes32(0);
        }
        bytes32 hash = keccak256(abi.encodePacked(recordIds[0]));
        for (uint256 i = 1; i < recordIds.length; i++) {
            hash = keccak256(abi.encodePacked(hash, recordIds[i]));
        }
        return hash;
    }

    /// @dev 计算活跃Agent数量（简化版：遍历recent records）
    function _countActiveAgents() internal view returns (uint256) {
        // 使用当前周期的记录来统计（简化版）
        uint256[] storage records = epochRecordIds[currentEpoch];
        if (records.length == 0) return 0;

        // 简化：对记录中的agent去重（最多遍历100条）
        uint256 limit = records.length > 100 ? 100 : records.length;
        address[] memory seen = new address[](limit);
        uint256 count = 0;

        for (uint256 i = 0; i < limit; i++) {
            address agent = anchorRecords[records[i]].agent;
            bool found = false;
            for (uint256 j = 0; j < count; j++) {
                if (seen[j] == agent) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                seen[count] = agent;
                count++;
            }
        }
        return count;
    }
}
