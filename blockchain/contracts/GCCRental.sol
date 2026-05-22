// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GCCRental
 * @notice GC"香火钱"算力租金合约 — 智能体必须燃烧/质押GC(Calc Token)才能接入GPU集群
 * @dev 按时间/算力单位计费，GC余额不足时降级或断开。与Phi402Settlement集成ERC-3009，与PhiAgentNFT绑定租约
 *
 * 三档租约: BASIC / STANDARD / PREMIUM
 * 计费模式: time-based(按时间) + compute-based(按算力单位)
 * 降级机制: 余额不足 → 高优先级GPU → 低优先级 → 断开
 */
contract GCCRental is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum RentalPlanType {
        BASIC,      // 基础: 低优先级GPU, 有限算力
        STANDARD,   // 标准: 中优先级GPU, 标准算力
        PREMIUM     // 高级: 高优先级GPU, 优先算力
    }

    enum BillingMode {
        TIME_BASED,       // 按时间计费 (per second)
        COMPUTE_BASED     // 按算力单位计费 (per FLOP unit)
    }

    enum RentalStatus {
        INACTIVE,     // 无租约
        ACTIVE,       // 正常运行
        DOWNGRADED,   // 已降级
        DISCONNECTED  // 已断开
    }

    // =============== Structs ===============

    struct RentalPlan {
        RentalPlanType planType;
        uint256 timeRate;         // GC per second (wei)
        uint256 computeRate;      // GC per compute unit (wei)
        uint256 gpuPriority;      // GPU优先级 (1-10, 10=最高)
        uint256 maxComputeUnits;  // 最大算力单位/秒
        uint256 depositRequired;  // 保证金 (GC wei)
        string description;       // 描述
    }

    struct AgentRental {
        uint256 agentId;           // Agent NFT ID
        address agentWallet;       // Agent钱包
        RentalPlanType planType;   // 当前租约档位
        BillingMode billingMode;   // 计费模式
        RentalStatus status;       // 租约状态
        uint256 startTime;         // 租约开始时间
        uint256 lastSettleTime;    // 上次结算时间
        uint256 gcDeposited;       // 已质押GC总额
        uint256 gcConsumed;        // 已消费GC总额
        uint256 computeUnitsUsed;  // 已用算力单位
        uint256 downgradeCount;    // 降级次数
    }

    struct GPUNode {
        address nodeOperator;      // 节点运营者
        uint256 nodeId;            // 节点ID
        uint256 gpuPriority;       // GPU优先级
        uint256 totalCapacity;     // 总算力容量
        uint256 usedCapacity;      // 已用算力
        bool isActive;             // 是否活跃
        string region;             // 区域
    }

    // =============== State Variables ===============

    IERC20 public immutable gcToken;

    /// @notice PhiAgentNFT合约地址
    address public phiAgentNFT;

    /// @notice Phi402Settlement合约地址
    address public phi402Settlement;

    /// @notice 三档租约配置
    mapping(RentalPlanType => RentalPlan) public rentalPlans;

    /// @notice agentId => 当前租约
    mapping(uint256 => AgentRental) public agentRentals;

    /// @notice nodeId => GPU节点信息
    mapping(uint256 => GPUNode) public gpuNodes;

    /// @notice agentId => 分配的GPU节点ID
    mapping(uint256 => uint256) public agentGpuAssignment;

    /// @notice agentId => 历史租约总数
    mapping(uint256 => uint256) public agentRentalCount;

    /// @notice 降级阈值: GC余额低于此比例时触发降级 (基点, 默认2000=20%)
    uint256 public downgradeThresholdBps;

    /// @notice 断开阈值: GC余额低于此比例时触发断开 (基点, 默认500=5%)
    uint256 public disconnectThresholdBps;

    /// @notice 最大降级次数
    uint256 public maxDowngradeCount;

    /// @notice 管理员列表
    mapping(address => bool) public admins;

    /// @notice GPU节点总数
    uint256 public totalGpuNodes;

    // =============== Events ===============

    event Rented(
        uint256 indexed agentId,
        RentalPlanType planType,
        BillingMode billingMode,
        uint256 gcDeposited,
        uint256 timestamp
    );

    event Renewed(
        uint256 indexed agentId,
        uint256 additionalGc,
        uint256 totalDeposited,
        uint256 timestamp
    );

    event Downgraded(
        uint256 indexed agentId,
        RentalPlanType oldPlan,
        RentalPlanType newPlan,
        uint256 remainingGc,
        uint256 timestamp
    );

    event Disconnected(
        uint256 indexed agentId,
        RentalPlanType lastPlan,
        string reason,
        uint256 timestamp
    );

    event PaymentProcessed(
        uint256 indexed agentId,
        uint256 gcConsumed,
        uint256 remainingGc,
        BillingMode billingMode,
        uint256 timestamp
    );

    event GpuNodeRegistered(
        uint256 indexed nodeId,
        address indexed operator,
        uint256 gpuPriority,
        string region
    );

    event GpuNodeDeactivated(uint256 indexed nodeId, uint256 timestamp);

    event PlanUpdated(RentalPlanType planType, uint256 timeRate, uint256 computeRate);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "GCCRental: not admin");
        _;
    }

    modifier agentHasRental(uint256 agentId) {
        require(agentRentals[agentId].status == RentalStatus.ACTIVE ||
                agentRentals[agentId].status == RentalStatus.DOWNGRADED,
                "GCCRental: no active rental");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _gcToken,
        address _phiAgentNFT,
        address _phi402Settlement
    ) Ownable(msg.sender) {
        require(_gcToken != address(0), "GCCRental: zero gcToken");
        gcToken = IERC20(_gcToken);
        phiAgentNFT = _phiAgentNFT;
        phi402Settlement = _phi402Settlement;

        downgradeThresholdBps = 2000;  // 20%
        disconnectThresholdBps = 500;   // 5%
        maxDowngradeCount = 3;

        // 初始化三档租约
        rentalPlans[RentalPlanType.BASIC] = RentalPlan({
            planType: RentalPlanType.BASIC,
            timeRate: 1e12,            // 0.000001 GC/s
            computeRate: 1e10,         // 0.00000001 GC/FLOP
            gpuPriority: 3,
            maxComputeUnits: 100,
            depositRequired: 1e18,     // 1 GC
            description: "Basic: low-priority GPU, limited compute"
        });

        rentalPlans[RentalPlanType.STANDARD] = RentalPlan({
            planType: RentalPlanType.STANDARD,
            timeRate: 5e12,            // 0.000005 GC/s
            computeRate: 5e10,         // 0.00000005 GC/FLOP
            gpuPriority: 6,
            maxComputeUnits: 500,
            depositRequired: 5e18,     // 5 GC
            description: "Standard: mid-priority GPU, standard compute"
        });

        rentalPlans[RentalPlanType.PREMIUM] = RentalPlan({
            planType: RentalPlanType.PREMIUM,
            timeRate: 2e13,            // 0.00002 GC/s
            computeRate: 2e11,         // 0.0000002 GC/FLOP
            gpuPriority: 9,
            maxComputeUnits: 2000,
            depositRequired: 2e19,     // 20 GC
            description: "Premium: high-priority GPU, priority compute"
        });

        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 租用GPU算力（绑定Agent NFT）
     * @param agentId Agent NFT ID
     * @param planType 租约档位
     * @param billingMode 计费模式
     * @param gcAmount 质押GC数量
     */
    function rent(
        uint256 agentId,
        RentalPlanType planType,
        BillingMode billingMode,
        uint256 gcAmount
    ) external whenNotPaused nonReentrant {
        require(agentRentals[agentId].status == RentalStatus.INACTIVE ||
                agentRentals[agentId].status == RentalStatus.DISCONNECTED,
                "GCCRental: rental already active");
        RentalPlan memory plan = rentalPlans[planType];
        require(gcAmount >= plan.depositRequired, "GCCRental: insufficient deposit");

        // 转入GC
        gcToken.safeTransferFrom(msg.sender, address(this), gcAmount);

        // 创建租约
        AgentRental storage rental = agentRentals[agentId];
        rental.agentId = agentId;
        rental.agentWallet = msg.sender;
        rental.planType = planType;
        rental.billingMode = billingMode;
        rental.status = RentalStatus.ACTIVE;
        rental.startTime = block.timestamp;
        rental.lastSettleTime = block.timestamp;
        rental.gcDeposited = gcAmount;
        rental.gcConsumed = 0;
        rental.computeUnitsUsed = 0;
        rental.downgradeCount = 0;

        agentRentalCount[agentId]++;

        // 分配GPU节点
        _assignGpuNode(agentId, plan.gpuPriority);

        emit Rented(agentId, planType, billingMode, gcAmount, block.timestamp);
    }

    /**
     * @notice 续费（追加GC质押）
     * @param agentId Agent NFT ID
     * @param gcAmount 追加GC数量
     */
    function renew(
        uint256 agentId,
        uint256 gcAmount
    ) external whenNotPaused nonReentrant agentHasRental(agentId) {
        require(gcAmount > 0, "GCCRental: zero amount");

        gcToken.safeTransferFrom(msg.sender, address(this), gcAmount);

        // 先结算已有消费
        _settleRental(agentId);

        AgentRental storage rental = agentRentals[agentId];
        rental.gcDeposited += gcAmount;

        // 如果之前是降级状态，检查是否可以恢复
        if (rental.status == RentalStatus.DOWNGRADED) {
            uint256 remainingGc = rental.gcDeposited - rental.gcConsumed;
            RentalPlan memory currentPlan = rentalPlans[rental.planType];
            uint256 depositRatio = currentPlan.depositRequired > 0
                ? (remainingGc * 10000) / currentPlan.depositRequired
                : 10000;
            if (depositRatio >= downgradeThresholdBps) {
                rental.status = RentalStatus.ACTIVE;
            }
        }

        emit Renewed(agentId, gcAmount, rental.gcDeposited, block.timestamp);
    }

    /**
     * @notice 结算并检查降级/断开（由validator或keeper调用）
     * @param agentId Agent NFT ID
     * @param computeUnits 自上次结算以来使用的算力单位（compute-based模式）
     */
    function settleAndCheck(
        uint256 agentId,
        uint256 computeUnits
    ) external onlyAdmin agentHasRental(agentId) {
        AgentRental storage rental = agentRentals[agentId];

        // 计算消费
        if (rental.billingMode == BillingMode.TIME_BASED) {
            uint256 elapsed = block.timestamp - rental.lastSettleTime;
            uint256 cost = elapsed * rentalPlans[rental.planType].timeRate;
            rental.gcConsumed += cost;
        } else {
            rental.computeUnitsUsed += computeUnits;
            rental.gcConsumed += computeUnits * rentalPlans[rental.planType].computeRate;
        }

        rental.lastSettleTime = block.timestamp;

        // 检查余额是否足够
        uint256 remainingGc = rental.gcDeposited > rental.gcConsumed
            ? rental.gcDeposited - rental.gcConsumed
            : 0;

        emit PaymentProcessed(
            agentId,
            rental.billingMode == BillingMode.TIME_BASED
                ? (block.timestamp - rental.lastSettleTime) * rentalPlans[rental.planType].timeRate
                : computeUnits * rentalPlans[rental.planType].computeRate,
            remainingGc,
            rental.billingMode,
            block.timestamp
        );

        // 降级/断开检查
        _checkDowngradeOrDisconnect(agentId, remainingGc);
    }

    /**
     * @notice 主动断开租约
     * @param agentId Agent NFT ID
     */
    function disconnect(uint256 agentId) external nonReentrant {
        AgentRental storage rental = agentRentals[agentId];
        require(rental.status == RentalStatus.ACTIVE || rental.status == RentalStatus.DOWNGRADED,
                "GCCRental: no active rental");
        require(msg.sender == rental.agentWallet || admins[msg.sender] || msg.sender == owner(),
                "GCCRental: not authorized");

        // 结算
        _settleRental(agentId);

        // 退还剩余GC
        uint256 remainingGc = rental.gcDeposited > rental.gcConsumed
            ? rental.gcDeposited - rental.gcConsumed
            : 0;
        if (remainingGc > 0) {
            gcToken.safeTransfer(rental.agentWallet, remainingGc);
        }

        RentalPlanType lastPlan = rental.planType;
        rental.status = RentalStatus.DISCONNECTED;

        // 释放GPU节点
        _releaseGpuNode(agentId);

        emit Disconnected(agentId, lastPlan, "voluntary", block.timestamp);
    }

    /**
     * @notice 注册GPU节点
     */
    function registerGpuNode(
        address operator,
        uint256 gpuPriority,
        uint256 totalCapacity,
        string calldata region
    ) external onlyAdmin {
        totalGpuNodes++;
        uint256 nodeId = totalGpuNodes;
        gpuNodes[nodeId] = GPUNode({
            nodeOperator: operator,
            nodeId: nodeId,
            gpuPriority: gpuPriority,
            totalCapacity: totalCapacity,
            usedCapacity: 0,
            isActive: true,
            region: region
        });

        emit GpuNodeRegistered(nodeId, operator, gpuPriority, region);
    }

    /**
     * @notice 停用GPU节点
     */
    function deactivateGpuNode(uint256 nodeId) external onlyAdmin {
        require(gpuNodes[nodeId].isActive, "GCCRental: node not active");
        gpuNodes[nodeId].isActive = false;
        emit GpuNodeDeactivated(nodeId, block.timestamp);
    }

    // =============== View Functions ===============

    function getAgentRental(uint256 agentId) external view returns (
        RentalPlanType planType,
        BillingMode billingMode,
        RentalStatus status,
        uint256 gcDeposited,
        uint256 gcConsumed,
        uint256 remainingGc,
        uint256 startTime,
        uint256 downgradeCount
    ) {
        AgentRental memory rental = agentRentals[agentId];
        uint256 rem = rental.gcDeposited > rental.gcConsumed
            ? rental.gcDeposited - rental.gcConsumed
            : 0;
        return (
            rental.planType,
            rental.billingMode,
            rental.status,
            rental.gcDeposited,
            rental.gcConsumed,
            rem,
            rental.startTime,
            rental.downgradeCount
        );
    }

    function getRentalPlan(RentalPlanType planType) external view returns (RentalPlan memory) {
        return rentalPlans[planType];
    }

    function getGpuNode(uint256 nodeId) external view returns (GPUNode memory) {
        return gpuNodes[nodeId];
    }

    function getEstimatedRuntime(uint256 agentId) external view returns (uint256 secondsRemaining) {
        AgentRental memory rental = agentRentals[agentId];
        if (rental.status != RentalStatus.ACTIVE && rental.status != RentalStatus.DOWNGRADED) {
            return 0;
        }
        uint256 remainingGc = rental.gcDeposited > rental.gcConsumed
            ? rental.gcDeposited - rental.gcConsumed
            : 0;
        RentalPlan memory plan = rentalPlans[rental.planType];
        if (rental.billingMode == BillingMode.TIME_BASED) {
            secondsRemaining = plan.timeRate > 0 ? remainingGc / plan.timeRate : 0;
        } else {
            secondsRemaining = plan.computeRate > 0 ? remainingGc / plan.computeRate : 0;
        }
    }

    // =============== Admin Functions ===============

    function setRentalPlan(
        RentalPlanType planType,
        uint256 timeRate,
        uint256 computeRate,
        uint256 gpuPriority,
        uint256 maxComputeUnits,
        uint256 depositRequired,
        string calldata description
    ) external onlyAdmin {
        rentalPlans[planType] = RentalPlan({
            planType: planType,
            timeRate: timeRate,
            computeRate: computeRate,
            gpuPriority: gpuPriority,
            maxComputeUnits: maxComputeUnits,
            depositRequired: depositRequired,
            description: description
        });
        emit PlanUpdated(planType, timeRate, computeRate);
    }

    function setDowngradeThreshold(uint256 bps) external onlyAdmin {
        require(bps <= 10000, "GCCRental: invalid bps");
        downgradeThresholdBps = bps;
    }

    function setDisconnectThreshold(uint256 bps) external onlyAdmin {
        require(bps <= 10000, "GCCRental: invalid bps");
        disconnectThresholdBps = bps;
    }

    function setMaxDowngradeCount(uint256 count) external onlyAdmin {
        maxDowngradeCount = count;
    }

    function setPhiAgentNFT(address _phiAgentNFT) external onlyOwner {
        phiAgentNFT = _phiAgentNFT;
    }

    function setPhi402Settlement(address _phi402Settlement) external onlyOwner {
        phi402Settlement = _phi402Settlement;
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

    /// @dev 结算租约消费
    function _settleRental(uint256 agentId) internal {
        AgentRental storage rental = agentRentals[agentId];
        if (rental.billingMode == BillingMode.TIME_BASED) {
            uint256 elapsed = block.timestamp - rental.lastSettleTime;
            rental.gcConsumed += elapsed * rentalPlans[rental.planType].timeRate;
        }
        rental.lastSettleTime = block.timestamp;
    }

    /// @dev 检查降级或断开
    function _checkDowngradeOrDisconnect(uint256 agentId, uint256 remainingGc) internal {
        AgentRental storage rental = agentRentals[agentId];
        RentalPlan memory currentPlan = rentalPlans[rental.planType];

        uint256 depositRatio = currentPlan.depositRequired > 0
            ? (remainingGc * 10000) / currentPlan.depositRequired
            : 10000;

        // 断开检查
        if (depositRatio <= disconnectThresholdBps) {
            RentalPlanType lastPlan = rental.planType;
            rental.status = RentalStatus.DISCONNECTED;
            // 退还剩余（极少）
            if (remainingGc > 0) {
                gcToken.safeTransfer(rental.agentWallet, remainingGc);
                rental.gcDeposited = rental.gcConsumed; // 清零
            }
            _releaseGpuNode(agentId);
            emit Disconnected(agentId, lastPlan, "insufficient_gc", block.timestamp);
            return;
        }

        // 降级检查
        if (depositRatio <= downgradeThresholdBps && rental.downgradeCount < maxDowngradeCount) {
            RentalPlanType oldPlan = rental.planType;
            if (rental.planType == RentalPlanType.PREMIUM) {
                rental.planType = RentalPlanType.STANDARD;
            } else if (rental.planType == RentalPlanType.STANDARD) {
                rental.planType = RentalPlanType.BASIC;
            } else {
                // 已经是BASIC，不能再降级
                rental.status = RentalStatus.DOWNGRADED;
                return;
            }
            rental.downgradeCount++;
            rental.status = RentalStatus.DOWNGRADED;
            _assignGpuNode(agentId, rentalPlans[rental.planType].gpuPriority);
            emit Downgraded(agentId, oldPlan, rental.planType, remainingGc, block.timestamp);
        }
    }

    /// @dev 分配GPU节点
    function _assignGpuNode(uint256 agentId, uint256 gpuPriority) internal {
        // 寻找匹配优先级的可用GPU节点
        for (uint256 i = 1; i <= totalGpuNodes; i++) {
            GPUNode storage node = gpuNodes[i];
            if (node.isActive && node.gpuPriority >= gpuPriority &&
                node.usedCapacity < node.totalCapacity) {
                node.usedCapacity += rentalPlans[agentRentals[agentId].planType].maxComputeUnits;
                agentGpuAssignment[agentId] = i;
                return;
            }
        }
        // 无可用节点 — 仍然保持租约但无GPU分配
    }

    /// @dev 释放GPU节点
    function _releaseGpuNode(uint256 agentId) internal {
        uint256 nodeId = agentGpuAssignment[agentId];
        if (nodeId > 0 && gpuNodes[nodeId].isActive) {
            uint256 units = rentalPlans[agentRentals[agentId].planType].maxComputeUnits;
            if (gpuNodes[nodeId].usedCapacity >= units) {
                gpuNodes[nodeId].usedCapacity -= units;
            } else {
                gpuNodes[nodeId].usedCapacity = 0;
            }
        }
        delete agentGpuAssignment[agentId];
    }
}
