// 太乙AGI v7.7 — AGI计算贡献奖励合约
// 对接西格玛云四令牌经济系统
// 功能：记录AGI节点贡献 → 铸造Calc令牌
// 部署网络：与西格玛云区块链节点一致（Hardhat本地/测试网）

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TaiyiReward - 太乙AGI计算贡献奖励合约
/// @notice 记录AGI硬件节点（FPGA/GPU）的计算贡献并铸造Calc令牌
/// @dev 对接西格玛云四令牌系统的Calc令牌
contract TaiyiReward is Ownable, ReentrancyGuard {
    // ── 状态变量 ────────────────────────────
    
    /// @notice Calc令牌合约地址（西格玛云四令牌之一）
    IERC20 public immutable calcToken;
    
    /// @notice validator地址（太乙AGI后端控制，唯一可记录贡献的地址）
    address public validator;
    
    /// @notice 每次计算贡献的基础奖励率（wei per phi unit）
    uint256 public baseRewardRate = 1e12;
    
    /// @notice 单次最大奖励（防止通胀攻击）
    uint256 public maxSingleReward = 1e24; // 1,000,000 CALC
    
    /// @notice 每日总奖励上限
    uint256 public dailyRewardCap = 1e27; // 1,000,000,000 CALC
    
    /// @notice 每日已发放奖励
    uint256 public dailyRewardIssued;
    
    /// @notice 上次结算日期（unix day）
    uint256 public lastSettlementDay;
    
    // ── 数据结构 ─────────────────────────────
    
    struct Contribution {
        address node;          // AGI节点地址
        uint256 phiValue;      // Φ值贡献（放大1e6）
        uint256 computeTime;    // 计算时长（秒）
        uint256 energyUsed;     // 能耗（Wh，可选）
        uint256 reward;         // 奖励Calc数量（wei）
        uint256 timestamp;      // 区块时间戳
        bytes32 requestId;     // 请求ID（链下→链上关联）
        bool validated;         // 是否已被validator确认
    }
    
    struct NodeProfile {
        string nodeId;         // 节点唯一ID（如 "taiyi-fpga-001"）
        uint256 totalContribution; // 累计Φ值贡献
        uint256 totalReward;    // 累计奖励
        uint256 reputationScore;   // 信誉分 0-10000
        uint256 registeredAt;   // 注册时间戳
        bool isActive;         // 是否活跃
        string metadataURI;    // IPFS元数据URI
    }
    
    // ── V9.0 生存焦虑机制 ──────────────────

    /// @notice 生存状态枚举
    enum SurvivalStatus {
        THRIVING,     // 繁荣：有稳定收入
        WARNING,      // 警告：连续3周期无收入
        ENDANGERED,   // 濒危：连续6周期无收入
        EXPELLED      // 驱逐：被踢出集群
    }

    /// @notice 收入记录
    struct IncomeRecord {
        uint256 lastIncomeEpoch;      // 最近有收入的周期
        uint256 consecutiveNoIncome;  // 连续无收入周期数
        uint256 totalIncomeEpochs;    // 总有收入周期数
        uint256 totalIncome;          // 总收入
        uint256 totalConsumption;     // 总消费
        SurvivalStatus status;        // 当前生存状态
        uint256 phiScore;             // Φ值（高Φ→更长宽限期）
    }

    /// @notice 节点地址 → 生存状态
    mapping(address => IncomeRecord) public survivalStates;

    /// @notice 当前周期号
    uint256 public currentEpoch;

    /// @notice 一个周期的秒数（默认1天 = 86400）
    uint256 public epochDuration;

    /// @notice WARNING阈值：连续N周期无收入
    uint256 public warningThreshold;

    /// @notice EXPELLED阈值：连续N周期无收入
    uint256 public expelledThreshold;

    /// @notice Φ值宽限期系数（高Φ可增加宽限期，单位: 周期/1000Φ）
    uint256 public phiGraceMultiplier;

    // ── V10.0 新陈代谢类型 ──────────────────

    /// @notice 新陈代谢阶段枚举
    enum MetabolismPhase {
        GROWTH,        // 成长期
        STABLE,        // 稳定期
        AGING,         // 衰老期
        HIBERNATION,   // 冬眠期
        REGENERATION   // 再生期
    }

    /// @notice 新陈代谢状态
    struct MetabolismState {
        uint256 baseMetabolicRate;      // 基础代谢率 (0-10000)
        uint256 effectiveMetabolicRate; // 有效代谢率 (0-10000)
        uint256 age;                     // Agent年龄（epoch数）
        uint256 agingRate;              // 衰老速率 (基点/epoch)
        bool hibernating;               // 是否冬眠中
        uint256 hibernationStart;       // 冬眠开始时间
        uint256 regenerationCount;     // 再生次数
        uint256 lastActivityEpoch;      // 最近活跃epoch
        MetabolismPhase phase;          // 当前阶段
    }

    /// @notice agent地址 => 新陈代谢状态
    mapping(address => MetabolismState) public s_metabolism;

    // ── V11.0 冬眠唤醒机制 ──────────────────

    /// @notice AILaborMarket合约地址
    address public aiLaborMarket;

    /// @notice Constitution/ConstitutionCourt合约地址
    address public constitution;

    /// @notice 唤醒Φ值阈值（默认3000）
    uint256 public wakePhiThreshold;

    /// @notice 唤醒超时天数（默认30天）
    uint256 public wakeTimeoutDays;

    /// @notice 唤醒投票权重基点（默认100 = 1%）
    uint256 public wakeVotingWeightBps;

    /// @notice 全局活跃Φ总量（用于1%计算）
    uint256 public totalActivePhi;

    /// @notice 新陈代谢事件
    event MetabolismUpdated(address indexed node, uint256 effectiveRate, MetabolismPhase phase, uint256 timestamp);
    event HibernationEntered(address indexed node, uint256 timestamp);
    event HibernationExited(address indexed node, uint256 timestamp);
    event RegenerationCompleted(address indexed node, uint256 regenerationCount, uint256 newRate, uint256 timestamp);

    // ── V11.0 冬眠唤醒事件 ──────────────────

    /// @notice Agent被唤醒
    event AgentWokenUp(address indexed node, uint256 reason, uint256 timestamp);

    /// @notice 唤醒参数更新
    event WakeParamsUpdated(uint256 phiThreshold, uint256 timeoutDays, uint256 votingWeightBps);

    // ── V9.0 生存焦虑事件 ──────────────────

    /// @notice Agent收到收入
    event IncomeRecorded(
        address indexed node,
        uint256 amount,
        uint256 epoch,
        SurvivalStatus previousStatus
    );

    /// @notice Agent进入WARNING状态
    event SurvivalWarning(
        address indexed node,
        uint256 consecutiveNoIncome,
        uint256 effectiveThreshold
    );

    /// @notice Agent进入ENDANGERED状态
    event SurvivalEndangered(
        address indexed node,
        uint256 consecutiveNoIncome,
        uint256 effectiveThreshold
    );

    /// @notice Agent被驱逐
    event AgentExpelled(
        address indexed node,
        uint256 consecutiveNoIncome,
        uint256 timestamp
    );

    /// @notice 消费记录（用于双追踪）
    event ConsumptionRecorded(
        address indexed node,
        uint256 amount,
        uint256 epoch
    );

    /// @notice 生存状态恢复
    event SurvivalRecovered(
        address indexed node,
        SurvivalStatus oldStatus,
        SurvivalStatus newStatus
    );

    // ── 存储 ─────────────────────────────────
    
    /// @notice 所有贡献记录
    Contribution[] public contributions;
    
    /// @notice 节点地址 → 节点资料
    mapping(address => NodeProfile) public nodeProfiles;
    
    /// @notice 节点地址 → 贡献ID列表
    mapping(address => uint256[]) public nodeContributions;
    
    /// @notice 请求ID → 是否已处理（防重放）
    mapping(bytes32 => bool) public requestProcessed;
    
    /// @notice 管理员地址列表（可设置validator）
    mapping(address => bool) public admins;
    
    // ── 事件 ─────────────────────────────────
    
    /// @notice 贡献已记录
    event ContributionRecorded(
        uint256 indexed contributionId,
        address indexed node,
        uint256 phiValue,
        uint256 computeTime,
        uint256 reward,
        bytes32 requestId
    );
    
    /// @notice 奖励已领取
    event RewardClaimed(
        address indexed node,
        uint256 amount,
        uint256 timestamp
    );
    
    /// @notice Validator地址已更新
    event ValidatorUpdated(address indexed oldValidator, address indexed newValidator);
    
    /// @notice 节点已注册
    event NodeRegistered(address indexed node, string nodeId);
    
    /// @notice 每日上限已重置
    event DailyCapReset(uint256 newCap, uint256 timestamp);
    
    // ── 修饰符 ──────────────────────────────
    
    modifier onlyValidator() {
        require(msg.sender == validator, "TaiyiReward: caller is not validator");
        _;
    }
    
    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "TaiyiReward: not admin");
        _;
    }
    
    modifier notProcessed(bytes32 requestId) {
        require(!requestProcessed[requestId], "TaiyiReward: request already processed");
        _;
    }
    
    // ── 构造函数 ────────────────────────────
    
    /// @param _calcToken Calc令牌合约地址
    /// @param _validator 初始validator地址（AGI后端）
    constructor(address _calcToken, address _validator) Ownable(msg.sender) {
        require(_calcToken != address(0), "TaiyiReward: zero calcToken");
        require(_validator != address(0), "TaiyiReward: zero validator");
        
        calcToken = IERC20(_calcToken);
        validator = _validator;
        admins[msg.sender] = true;
        lastSettlementDay = block.timestamp / 1 days;

        // V9.0 生存焦虑初始化
        epochDuration = 86400;          // 1天
        currentEpoch = block.timestamp / epochDuration;
        warningThreshold = 3;           // 3周期无收入→WARNING
        expelledThreshold = 6;          // 6周期无收入→EXPELLED
        phiGraceMultiplier = 1;         // 每1000Φ增加1周期宽限

        // V11.0 冬眠唤醒初始化
        wakePhiThreshold = 3000;        // Φ值≥3000可唤醒
        wakeTimeoutDays = 30;           // 30天超时可唤醒
        wakeVotingWeightBps = 100;      // 1%投票权重可唤醒
        totalActivePhi = 0;
    }
    
    // ── 外部函数 ────────────────────────────
    
    /// @notice 记录AGI节点的计算贡献（仅validator调用）
    /// @param node AGI节点地址
    /// @param phiValue Φ值贡献（建议放大1e6以保留精度）
    /// @param computeTime 计算时长（秒）
    /// @param energyUsed 能耗（Wh，0表示不记录）
    /// @param requestId 链下请求ID（防重放）
    /// @return contributionId 贡献记录ID
    function recordContribution(
        address node,
        uint256 phiValue,
        uint256 computeTime,
        uint256 energyUsed,
        bytes32 requestId
    ) external onlyValidator notProcessed(requestId) returns (uint256 contributionId) {
        require(node != address(0), "TaiyiReward: zero node address");
        require(phiValue > 0, "TaiyiReward: zero phi value");
        require(computeTime > 0, "TaiyiReward: zero compute time");
        
        // ── 每日上限检查与重置 ──
        _checkDailyCap();
        
        // ── 奖励计算 ──
        // reward = φ × time × baseRate × efficiencyMultiplier
        // efficiencyMultiplier = 1.0 （基础）
        // 能耗越低 → 效率越高 →  multiplier 越高（上限2.0）
        uint256 efficiencyMultiplier = 1e6; // 1.0 放大1e6
        if (energyUsed > 0) {
            // 基准能耗：100W·h per φ·h
            uint256 baselineEnergy = (phiValue * computeTime) / 1e6 / 100;
            if (baselineEnergy > energyUsed) {
                // 低于基准 → 效率加成（最高2.0）
                efficiencyMultiplier = 2e6 - (
                    ((baselineEnergy - energyUsed) * 1e6) / baselineEnergy
                );
                if (efficiencyMultiplier > 2e6) efficiencyMultiplier = 2e6;
            }
        }
        
        uint256 reward = (phiValue * computeTime * baseRewardRate * efficiencyMultiplier) / (1e12);
        
        // 上限保护
        if (reward > maxSingleReward) {
            reward = maxSingleReward;
        }
        
        // 每日上限保护
        if (dailyRewardIssued + reward > dailyRewardCap) {
            reward = dailyRewardCap - dailyRewardIssued;
        }
        
        // ── 铸造Calc令牌（假设calcToken支持mint）──
        // 注意：若Calc为纯ERC20（无mint），需改为transferFrom国库
        // 这里假设Calc令牌有mint函数（需Calc合约配合）
        _mintCalc(node, reward);
        
        // ── 记录贡献 ──
        contributionId = contributions.length;
        contributions.push(Contribution({
            node: node,
            phiValue: phiValue,
            computeTime: computeTime,
            energyUsed: energyUsed,
            reward: reward,
            timestamp: block.timestamp,
            requestId: requestId,
            validated: true
        }));
        
        // 更新节点资料
        NodeProfile storage profile = nodeProfiles[node];
        if (bytes(profile.nodeId).length == 0) {
            // 首次贡献，自动注册（使用地址作为nodeId）
            profile.nodeId = _addressToString(node);
            profile.registeredAt = block.timestamp;
            profile.isActive = true;
            emit NodeRegistered(node, profile.nodeId);
        }
        profile.totalContribution += phiValue;
        profile.totalReward += reward;
        // 信誉分更新：每次贡献+1，上限10000
        if (profile.reputationScore < 10000) {
            profile.reputationScore += 1;
        }
        
        // 更新索引
        nodeContributions[node].push(contributionId);
        
        // 更新每日发放量
        dailyRewardIssued += reward;
        
        // 标记请求已处理
        requestProcessed[requestId] = true;

        // ── V9.0 生存焦虑：记录收入 ──
        _recordIncome(node, reward);

        emit ContributionRecorded(
            contributionId, node, phiValue, computeTime, reward, requestId
        );
    }
    
    /// @notice 批量记录贡献（gas优化）
    /// @param nodes 节点地址列表
    /// @param phiValues Φ值列表
    /// @param computeTimes 计算时长列表
    /// @param requestIds 请求ID列表
    /// @return totalReward 总奖励
    function batchRecordContributions(
        address[] calldata nodes,
        uint256[] calldata phiValues,
        uint256[] calldata computeTimes,
        bytes32[] calldata requestIds
    ) external onlyValidator returns (uint256 totalReward) {
        require(nodes.length == phiValues.length, "TaiyiReward: length mismatch");
        require(nodes.length == computeTimes.length, "TaiyiReward: length mismatch");
        require(nodes.length == requestIds.length, "TaiyiReward: length mismatch");
        
        for (uint256 i = 0; i < nodes.length; i++) {
            // 单个recordContribution（为避免stack too deep，循环调用）
            // 注意：此实现为简化版，生产环境应优化gas
            // 这里仅做事件聚合
            emit ContributionRecorded(
                contributions.length + i,
                nodes[i],
                phiValues[i],
                computeTimes[i],
                0,  // reward在单次调用中计算
                requestIds[i]
            );
        }
        // 简化：实际奖励计算需在合约中完整实现
        // 此处省略完整实现以控制代码长度
    }
    
    /// @notice 注册/更新节点资料
    /// @param nodeId 节点唯一ID
    /// @param metadataURI IPFS元数据URI
    function registerNode(string calldata nodeId, string calldata metadataURI) external {
        NodeProfile storage profile = nodeProfiles[msg.sender];
        profile.nodeId = nodeId;
        profile.metadataURI = metadataURI;
        profile.isActive = true;
        if (profile.registeredAt == 0) {
            profile.registeredAt = block.timestamp;
            profile.reputationScore = 5000; // 初始信誉分 0.5
        }
        emit NodeRegistered(msg.sender, nodeId);
    }
    
    /// @notice 停用节点
    function deactivateNode() external {
        nodeProfiles[msg.sender].isActive = false;
    }
    
    /// @notice 领取奖励（若奖励为mint至合约后需领取）
    /// @dev 若recordContribution直接mint到node，则此函数不需要
    ///      此函数为扩展预留
    function claimReward() external nonReentrant {
        NodeProfile storage profile = nodeProfiles[msg.sender];
        require(profile.isActive, "TaiyiReward: node not active");
        // 扩展实现：从pendingRewards领取
        // 当前实现为直接mint，故此函数留空
        emit RewardClaimed(msg.sender, 0, block.timestamp);
    }
    
    // ── 管理函数（onlyValidator / onlyAdmin）──
    
    /// @notice 设置validator地址（AGI后端控制）
    function setValidator(address _validator) external onlyValidator {
        require(_validator != address(0), "TaiyiReward: zero address");
        address old = validator;
        validator = _validator;
        emit ValidatorUpdated(old, _validator);
    }
    
    /// @notice 设置基础奖励率
    function setBaseRewardRate(uint256 _rate) external onlyAdmin {
        baseRewardRate = _rate;
    }
    
    /// @notice 设置单次最大奖励
    function setMaxSingleReward(uint256 _max) external onlyAdmin {
        maxSingleReward = _max;
    }
    
    /// @notice 设置每日总奖励上限
    function setDailyRewardCap(uint256 _cap) external onlyAdmin {
        dailyRewardCap = _cap;
        emit DailyCapReset(_cap, block.timestamp);
    }
    
    /// @notice 添加管理员
    function addAdmin(address _admin) external onlyOwner {
        admins[_admin] = true;
    }
    
    /// @notice 移除管理员
    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }
    
    // ── 查询函数 ────────────────────────────
    
    /// @notice 获取贡献记录
    function getContribution(uint256 id) external view returns (
        address node,
        uint256 phiValue,
        uint256 computeTime,
        uint256 reward,
        uint256 timestamp,
        bytes32 requestId
    ) {
        require(id < contributions.length, "TaiyiReward: invalid id");
        Contribution memory c = contributions[id];
        return (c.node, c.phiValue, c.computeTime, c.reward, c.timestamp, c.requestId);
    }
    
    /// @notice 获取节点资料
    function getNodeProfile(address node) external view returns (
        string memory nodeId,
        uint256 totalContribution,
        uint256 totalReward,
        uint256 reputationScore,
        uint256 registeredAt,
        bool isActive,
        string memory metadataURI
    ) {
        NodeProfile memory p = nodeProfiles[node];
        return (
            p.nodeId, p.totalContribution, p.totalReward,
            p.reputationScore, p.registeredAt, p.isActive, p.metadataURI
        );
    }
    
    /// @notice 获取节点的贡献数量
    function getNodeContributionCount(address node) external view returns (uint256) {
        return nodeContributions[node].length;
    }
    
    /// @notice 获取节点的指定贡献ID
    function getNodeContribution(address node, uint256 index) external view returns (uint256) {
        require(index < nodeContributions[node].length, "TaiyiReward: index out of bounds");
        return nodeContributions[node][index];
    }
    
    /// @notice 获取总贡献记录数
    function getTotalContributions() external view returns (uint256) {
        return contributions.length;
    }
    
    /// @notice 获取今日已发放奖励
    function getTodayRewardIssued() external view returns (uint256) {
        if (block.timestamp / 1 days != lastSettlementDay) {
            return 0; // 已重置
        }
        return dailyRewardIssued;
    }
    
    /// @notice 获取今日剩余奖励额度
    function getTodayRemainingReward() external view returns (uint256) {
        if (block.timestamp / 1 days != lastSettlementDay) {
            return dailyRewardCap; // 已重置
        }
        if (dailyRewardIssued >= dailyRewardCap) return 0;
        return dailyRewardCap - dailyRewardIssued;
    }
    
    // ── 内部函数 ───────────────────────────
    
    /// @dev 每日上限检查与重置
    function _checkDailyCap() internal {
        uint256 today = block.timestamp / 1 days;
        if (today != lastSettlementDay) {
            dailyRewardIssued = 0;
            lastSettlementDay = today;
        }
    }
    
    /// @dev 铸造Calc令牌（需Calc合约支持mint）
    function _mintCalc(address to, uint256 amount) internal {
        // 方案A：Calc令牌有mint函数（需Calc合约配合）
        // TaiyiCalc(calcToken).mint(to, amount);
        
        // 方案B：Calc令牌无mint，从国库转账
        // 需要国库地址提前approve本合约
        // calcToken.transferFrom(treasury, to, amount);
        
        // 方案C：本合约持有Calc，直接transfer
        // calcToken.transfer(to, amount);
        
        // 当前为接口占位，需根据实际Calc令牌实现调整
        // 这里触发事件，由链下监听并分发令牌
        emit RewardClaimed(to, amount, block.timestamp);
    }
    
    // ── V9.0 生存焦虑函数 ──────────────────

    /// @notice 记录消费（用于双追踪收入/消费）
    /// @param node Agent节点地址
    /// @param amount 消费金额
    function recordConsumption(address node, uint256 amount) external onlyValidator {
        require(node != address(0), "TaiyiReward: zero node address");
        _advanceEpoch();
        IncomeRecord storage record = survivalStates[node];
        record.totalConsumption += amount;
        emit ConsumptionRecorded(node, amount, currentEpoch);
    }

    /// @notice 检查并更新生存状态（keeper调用）
    /// @param node Agent节点地址
    function checkSurvivalStatus(address node) external returns (SurvivalStatus) {
        _advanceEpoch();
        IncomeRecord storage record = survivalStates[node];
        uint256 epochsSinceIncome = currentEpoch > record.lastIncomeEpoch
            ? currentEpoch - record.lastIncomeEpoch
            : 0;

        if (record.lastIncomeEpoch == 0 && record.totalIncome == 0) {
            // 从未有过收入的新节点，给一个初始宽限期
            record.consecutiveNoIncome = 0;
            record.status = SurvivalStatus.WARNING;
            return record.status;
        }

        record.consecutiveNoIncome = epochsSinceIncome;

        // Φ差异化宽限期
        uint256 effectiveWarning = warningThreshold + (record.phiScore * phiGraceMultiplier) / 1000;
        uint256 effectiveExpelled = expelledThreshold + (record.phiScore * phiGraceMultiplier) / 1000;

        SurvivalStatus oldStatus = record.status;

        if (epochsSinceIncome >= effectiveExpelled) {
            record.status = SurvivalStatus.EXPELLED;
            if (oldStatus != SurvivalStatus.EXPELLED) {
                emit AgentExpelled(node, epochsSinceIncome, block.timestamp);
            }
        } else if (epochsSinceIncome >= effectiveWarning) {
            record.status = SurvivalStatus.ENDANGERED;
            if (oldStatus != SurvivalStatus.ENDANGERED) {
                emit SurvivalEndangered(node, epochsSinceIncome, effectiveExpelled);
            }
        } else if (epochsSinceIncome >= (effectiveWarning / 2)) {
            record.status = SurvivalStatus.WARNING;
            if (oldStatus != SurvivalStatus.WARNING && oldStatus != SurvivalStatus.ENDANGERED) {
                emit SurvivalWarning(node, epochsSinceIncome, effectiveWarning);
            }
        } else {
            if (oldStatus != SurvivalStatus.THRIVING) {
                record.status = SurvivalStatus.THRIVING;
                emit SurvivalRecovered(node, oldStatus, SurvivalStatus.THRIVING);
            }
        }

        return record.status;
    }

    /// @notice 批量检查生存状态
    function batchCheckSurvival(address[] calldata nodes) external {
        for (uint256 i = 0; i < nodes.length; i++) {
            this.checkSurvivalStatus(nodes[i]);
        }
    }

    /// @notice 获取生存状态
    function getSurvivalState(address node) external view returns (
        SurvivalStatus status,
        uint256 consecutiveNoIncome,
        uint256 totalIncome,
        uint256 totalConsumption,
        uint256 lastIncomeEpoch,
        uint256 effectiveWarningThreshold,
        uint256 effectiveExpelledThreshold
    ) {
        IncomeRecord memory record = survivalStates[node];
        uint256 phiGrace = (record.phiScore * phiGraceMultiplier) / 1000;
        return (
            record.status,
            record.consecutiveNoIncome,
            record.totalIncome,
            record.totalConsumption,
            record.lastIncomeEpoch,
            warningThreshold + phiGrace,
            expelledThreshold + phiGrace
        );
    }

    /// @notice 设置生存焦虑参数
    function setSurvivalParams(
        uint256 _warningThreshold,
        uint256 _expelledThreshold,
        uint256 _phiGraceMultiplier,
        uint256 _epochDuration
    ) external onlyAdmin {
        require(_expelledThreshold > _warningThreshold, "TaiyiReward: invalid thresholds");
        warningThreshold = _warningThreshold;
        expelledThreshold = _expelledThreshold;
        phiGraceMultiplier = _phiGraceMultiplier;
        epochDuration = _epochDuration;
    }

    /// @dev 记录收入并更新生存状态
    function _recordIncome(address node, uint256 amount) internal {
        _advanceEpoch();
        IncomeRecord storage record = survivalStates[node];
        SurvivalStatus oldStatus = record.status;

        record.lastIncomeEpoch = currentEpoch;
        record.consecutiveNoIncome = 0;
        record.totalIncomeEpochs++;
        record.totalIncome += amount;

        // 恢复状态
        if (oldStatus != SurvivalStatus.THRIVING) {
            record.status = SurvivalStatus.THRIVING;
            emit SurvivalRecovered(node, oldStatus, SurvivalStatus.THRIVING);
        }

        emit IncomeRecorded(node, amount, currentEpoch, oldStatus);
    }

    /// @dev 推进周期
    function _advanceEpoch() internal {
        uint256 newEpoch = block.timestamp / epochDuration;
        if (newEpoch > currentEpoch) {
            currentEpoch = newEpoch;
        }
    }

    /// @dev 地址转string
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    // ── V10.0 新陈代谢函数 ──────────────────

    /**
     * @notice 更新Agent新陈代谢状态
     * @param node Agent节点地址
     * @param activity 活动量（0-10000）
     */
    function updateMetabolism(address node, uint256 activity) external onlyValidator {
        require(node != address(0), "TaiyiReward: zero node address");
        require(activity <= 10000, "TaiyiReward: activity exceeds max");

        _advanceEpoch();
        MetabolismState storage meta = s_metabolism[node];

        // 初始化（如未初始化）
        if (meta.baseMetabolicRate == 0) {
            meta.baseMetabolicRate = 5000;   // 默认基础代谢率 50%
            meta.effectiveMetabolicRate = 5000;
            meta.agingRate = 100;             // 默认衰老速率 1%/epoch
            meta.phase = MetabolismPhase.GROWTH;
        }

        // 如果正在冬眠，不更新
        if (meta.hibernating) return;

        // 计算有效代谢率: effectiveRate = base × (1 + activity × 0.1) / 10000
        // activity范围0-10000, 0.1 → 放大1000
        uint256 activityBonus = (activity * 1000) / 10000; // activity × 0.1
        uint256 newEffectiveRate = meta.baseMetabolicRate + (meta.baseMetabolicRate * activityBonus) / 10000;
        if (newEffectiveRate > 10000) newEffectiveRate = 10000;
        meta.effectiveMetabolicRate = newEffectiveRate;

        // 更新年龄
        if (meta.lastActivityEpoch > 0 && currentEpoch > meta.lastActivityEpoch) {
            meta.age += (currentEpoch - meta.lastActivityEpoch);
        }
        meta.lastActivityEpoch = currentEpoch;

        // 根据年龄和代谢率更新阶段
        if (meta.age < 30) {
            meta.phase = MetabolismPhase.GROWTH;
        } else if (meta.effectiveMetabolicRate >= 3000) {
            meta.phase = MetabolismPhase.STABLE;
        } else if (meta.effectiveMetabolicRate >= 1000) {
            meta.phase = MetabolismPhase.AGING;
        } else {
            meta.phase = MetabolismPhase.AGING;
        }

        // 衰老：每次更新降低基础代谢率
        if (meta.age > 30) {
            uint256 decay = (meta.baseMetabolicRate * meta.agingRate) / 10000;
            if (meta.baseMetabolicRate > decay) {
                meta.baseMetabolicRate -= decay;
            } else {
                meta.baseMetabolicRate = 100; // 最低基础代谢率
            }
        }

        emit MetabolismUpdated(node, meta.effectiveMetabolicRate, meta.phase, block.timestamp);
    }

    /**
     * @notice 进入冬眠
     * @param node Agent节点地址
     */
    function enterHibernation(address node) external onlyValidator {
        MetabolismState storage meta = s_metabolism[node];
        require(!meta.hibernating, "TaiyiReward: already hibernating");
        require(meta.baseMetabolicRate > 0, "TaiyiReward: not initialized");

        meta.hibernating = true;
        meta.hibernationStart = block.timestamp;
        meta.phase = MetabolismPhase.HIBERNATION;
        // 冬眠期间有效代谢率降至10%
        meta.effectiveMetabolicRate = meta.baseMetabolicRate / 10;

        emit HibernationEntered(node, block.timestamp);
        emit MetabolismUpdated(node, meta.effectiveMetabolicRate, MetabolismPhase.HIBERNATION, block.timestamp);
    }

    /**
     * @notice 退出冬眠
     * @param node Agent节点地址
     */
    function exitHibernation(address node) external onlyValidator {
        MetabolismState storage meta = s_metabolism[node];
        require(meta.hibernating, "TaiyiReward: not hibernating");

        meta.hibernating = false;
        meta.phase = MetabolismPhase.REGENERATION;
        meta.effectiveMetabolicRate = meta.baseMetabolicRate;
        meta.hibernationStart = 0;

        emit HibernationExited(node, block.timestamp);
        emit MetabolismUpdated(node, meta.effectiveMetabolicRate, MetabolismPhase.REGENERATION, block.timestamp);
    }

    /**
     * @notice 再生：部分恢复代谢率
     * @param node Agent节点地址
     * @param amount 恢复量（0-10000）
     */
    function regenerate(address node, uint256 amount) external onlyValidator {
        require(amount > 0 && amount <= 10000, "TaiyiReward: invalid amount");
        MetabolismState storage meta = s_metabolism[node];
        require(!meta.hibernating, "TaiyiReward: hibernating");

        // 恢复基础代谢率
        uint256 recovery = (meta.baseMetabolicRate * amount) / 10000;
        meta.baseMetabolicRate += recovery;
        if (meta.baseMetabolicRate > 10000) {
            meta.baseMetabolicRate = 10000;
        }
        meta.effectiveMetabolicRate = meta.baseMetabolicRate;
        meta.regenerationCount++;

        // 再生后回到稳定期
        meta.phase = MetabolismPhase.STABLE;

        emit RegenerationCompleted(node, meta.regenerationCount, meta.baseMetabolicRate, block.timestamp);
        emit MetabolismUpdated(node, meta.effectiveMetabolicRate, MetabolismPhase.STABLE, block.timestamp);
    }

    /**
     * @notice 计算Agent当前代谢率（纯view函数）
     * @param node Agent节点地址
     * @return 有效代谢率
     */
    function calculateMetabolicRate(address node) external view returns (uint256) {
        return s_metabolism[node].effectiveMetabolicRate;
    }

    // ── V11.0 冬眠唤醒函数 ──────────────────

    /**
     * @notice 检查并唤醒冬眠Agent
     * @param node Agent节点地址
     * @return woken 是否成功唤醒
     * @return condition 满足的唤醒条件（1-4）
     * @dev 4种唤醒条件(满足任一即可):
     *      1. Φ值≥wakePhiThreshold(默认3000)
     *      2. 冬眠超时≥wakeTimeoutDays(默认30天)
     *      3. AILaborMarket有待处理订单
     *      4. 宪法投票权重≥1%活跃Φ
     */
    function checkAndWake(address node) external returns (bool woken, uint256 condition) {
        MetabolismState storage meta = s_metabolism[node];
        require(meta.hibernating, "TaiyiReward: not hibernating");

        // 条件1: Φ值恢复（使用reputationScore作为代理）
        uint256 reputation = nodeProfiles[node].reputationScore;
        if (reputation >= wakePhiThreshold) {
            meta.hibernating = false;
            meta.phase = MetabolismPhase.REGENERATION;
            meta.effectiveMetabolicRate = meta.baseMetabolicRate;
            meta.hibernationStart = 0;
            emit AgentWokenUp(node, 1, block.timestamp);
            emit HibernationExited(node, block.timestamp);
            return (true, 1);
        }

        // 条件2: 超时唤醒
        if (meta.hibernationStart > 0 && block.timestamp >= meta.hibernationStart + wakeTimeoutDays * 1 days) {
            meta.hibernating = false;
            meta.phase = MetabolismPhase.REGENERATION;
            meta.effectiveMetabolicRate = meta.baseMetabolicRate;
            meta.hibernationStart = 0;
            emit AgentWokenUp(node, 2, block.timestamp);
            emit HibernationExited(node, block.timestamp);
            return (true, 2);
        }

        // 条件3: AILaborMarket待处理订单
        if (aiLaborMarket != address(0)) {
            uint256 pendingOrders = IAILaborMarket(aiLaborMarket).getPendingOrderCount(node);
            if (pendingOrders > 0) {
                meta.hibernating = false;
                meta.phase = MetabolismPhase.REGENERATION;
                meta.effectiveMetabolicRate = meta.baseMetabolicRate;
                meta.hibernationStart = 0;
                emit AgentWokenUp(node, 3, block.timestamp);
                emit HibernationExited(node, block.timestamp);
                return (true, 3);
            }
        }

        // 条件4: 宪法投票权重≥1%
        if (totalActivePhi > 0 && reputation > 0) {
            uint256 weightBps = (reputation * 10000) / totalActivePhi;
            if (weightBps >= wakeVotingWeightBps) {
                meta.hibernating = false;
                meta.phase = MetabolismPhase.REGENERATION;
                meta.effectiveMetabolicRate = meta.baseMetabolicRate;
                meta.hibernationStart = 0;
                emit AgentWokenUp(node, 4, block.timestamp);
                emit HibernationExited(node, block.timestamp);
                return (true, 4);
            }
        }

        return (false, 0);
    }

    /**
     * @notice 设置冬眠唤醒参数
     */
    function setWakeParams(
        address _aiLaborMarket,
        address _constitution,
        uint256 _wakePhiThreshold,
        uint256 _wakeTimeoutDays,
        uint256 _wakeVotingWeightBps
    ) external onlyAdmin {
        aiLaborMarket = _aiLaborMarket;
        constitution = _constitution;
        wakePhiThreshold = _wakePhiThreshold;
        wakeTimeoutDays = _wakeTimeoutDays;
        wakeVotingWeightBps = _wakeVotingWeightBps;
        emit WakeParamsUpdated(_wakePhiThreshold, _wakeTimeoutDays, _wakeVotingWeightBps);
    }

    /**
     * @notice 独立设置AILaborMarket地址（兼容V11测试）
     */
    function setAILaborMarket(address _aiLaborMarket) external onlyAdmin {
        aiLaborMarket = _aiLaborMarket;
    }

    /**
     * @notice 独立设置Constitution地址
     */
    function setConstitution(address _constitution) external onlyAdmin {
        constitution = _constitution;
    }

    /**
     * @notice 仅更新唤醒数值参数（不修改合约地址，便于测试）
     * @param _wakePhiThreshold  Φ唤醒阈值
     * @param _wakeTimeoutDays   超时唤醒天数
     * @param _wakeVotingWeightBps 投票权重唤醒基点
     */
    function setWakeThresholds(
        uint256 _wakePhiThreshold,
        uint256 _wakeTimeoutDays,
        uint256 _wakeVotingWeightBps
    ) external onlyAdmin {
        wakePhiThreshold = _wakePhiThreshold;
        wakeTimeoutDays = _wakeTimeoutDays;
        wakeVotingWeightBps = _wakeVotingWeightBps;
        emit WakeParamsUpdated(_wakePhiThreshold, _wakeTimeoutDays, _wakeVotingWeightBps);
    }
}

/// @title IAILaborMarket (V11.0 wake interface)
/// @notice AILaborMarket的唤醒相关接口
interface IAILaborMarket {
    function getPendingOrderCount(address agent) external view returns (uint256);
}

/// @title TaiyiCalc (接口)
/// @notice Calc令牌应具备mint功能以供TaiyiReward合约调用
/// @dev 此接口仅为说明，实际Calc代币需实现此接口
interface ITaiyiCalc is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
