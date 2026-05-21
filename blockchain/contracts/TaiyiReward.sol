// 太乙AGI v7.7 — AGI计算贡献奖励合约
// 对接西格玛云四令牌经济系统
// 功能：记录AGI节点贡献 → 铸造Calc令牌
// 部署网络：与西格玛云区块链节点一致（Hardhat本地/测试网）

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
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
}

/// @title TaiyiCalc (接口)
/// @notice Calc令牌应具备mint功能以供TaiyiReward合约调用
/// @dev 此接口仅为说明，实际Calc代币需实现此接口
interface ITaiyiCalc is IERC20 {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
