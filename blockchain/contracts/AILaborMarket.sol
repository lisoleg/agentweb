// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AILaborMarket
 * @notice V10.0 AI劳动力市场 — Agent能力交易+劳动保护+争议解决
 * @dev Agent注册+雇主注册+订单创建/确认/完成/取消+争议仲裁
 *      劳动保护: minWage/maxHours参数
 *      争议解决: 对接AdversarialReview
 */
contract AILaborMarket is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum OrderStatus {
        OPEN,           // 开放中
        CONFIRMED,      // 已确认
        IN_PROGRESS,    // 进行中
        COMPLETED,      // 已完成
        CANCELLED,      // 已取消
        DISPUTED        // 争议中
    }

    enum DisputeStatus {
        FILED,          // 已提交
        UNDER_REVIEW,   // 审查中
        RESOLVED_AGENT, // 判给Agent
        RESOLVED_EMPLOYER, // 判给雇主
        RESOLVED_SPLIT  // 分割裁决
    }

    // =============== Structs ===============

    struct AgentProfile {
        address agent;              // Agent地址
        string skillHash;           // 技能哈希（IPFS）
        uint256 minHourlyRate;      // 最低时薪
        uint256 maxHoursPerWeek;    // 每周最大工时
        uint256 totalJobsCompleted; // 完成总数
        uint256 totalEarnings;     // 总收入
        uint256 rating;             // 评分 0-10000
        bool isActive;              // 是否活跃
        uint256 registeredAt;       // 注册时间
    }

    struct EmployerProfile {
        address employer;           // 雇主地址
        string metadataURI;        // 元数据URI
        uint256 totalJobsPosted;    // 发布总数
        uint256 totalSpent;        // 总花费
        uint256 rating;            // 评分 0-10000
        bool isActive;             // 是否活跃
        uint256 registeredAt;       // 注册时间
    }

    struct LaborOrder {
        uint256 orderId;            // 订单ID
        address employer;           // 雇主
        address agent;              // 被指派的Agent（0=未指派）
        string description;         // 工作描述
        bytes32 requirementsHash;   // 需求哈希（IPFS）
        uint256 budget;             // 预算
        uint256 hourlyRate;         // 时薪
        uint256 estimatedHours;     // 预估工时
        uint256 maxHours;           // 最大工时
        uint256 deadline;           // 截止时间
        OrderStatus status;         // 状态
        uint256 createdAt;          // 创建时间
        uint256 confirmedAt;        // 确认时间
        uint256 completedAt;        // 完成时间
    }

    struct Dispute {
        uint256 disputeId;          // 争议ID
        uint256 orderId;            // 关联订单ID
        address filer;              // 提交者
        string reason;              // 争议原因
        DisputeStatus status;       // 状态
        uint256 createdAt;          // 创建时间
        uint256 resolvedAt;         // 解决时间
    }

    // =============== State Variables ===============

    IERC20 public immutable paymentToken;

    /// @notice 订单总数
    uint256 public totalOrders;

    /// @notice 争议总数
    uint256 public totalDisputes;

    /// @notice orderId => LaborOrder
    mapping(uint256 => LaborOrder) public orders;

    /// @notice disputeId => Dispute
    mapping(uint256 => Dispute) public disputes;

    /// @notice agent地址 => AgentProfile
    mapping(address => AgentProfile) public agentProfiles;

    /// @notice employer地址 => EmployerProfile
    mapping(address => EmployerProfile) public employerProfiles;

    /// @notice 全局最低工资
    uint256 public globalMinWage;

    /// @notice 全局每周最大工时
    uint256 public globalMaxHours;

    /// @notice 平台手续费率（基点，默认250=2.5%）
    uint256 public platformFeeBps;

    /// @notice AdversarialReview合约地址
    address public adversarialReview;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event AgentRegistered(address indexed agent, uint256 minHourlyRate, uint256 maxHours, uint256 timestamp);
    event EmployerRegistered(address indexed employer, string metadataURI, uint256 timestamp);
    event OrderCreated(uint256 indexed orderId, address indexed employer, uint256 budget, uint256 timestamp);
    event OrderConfirmed(uint256 indexed orderId, address indexed agent, uint256 timestamp);
    event OrderCompleted(uint256 indexed orderId, uint256 payment, uint256 timestamp);
    event OrderCancelled(uint256 indexed orderId, string reason, uint256 timestamp);
    event DisputeFiled(uint256 indexed disputeId, uint256 indexed orderId, address indexed filer, uint256 timestamp);
    event DisputeResolved(uint256 indexed disputeId, DisputeStatus outcome, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "AILaborMarket: not admin");
        _;
    }

    modifier onlyOrderParticipant(uint256 orderId) {
        require(
            msg.sender == orders[orderId].employer || msg.sender == orders[orderId].agent,
            "AILaborMarket: not participant"
        );
        _;
    }

    // =============== Constructor ===============

    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "AILaborMarket: zero token");
        paymentToken = IERC20(_paymentToken);
        globalMinWage = 1e15;      // 0.001 token/hour
        globalMaxHours = 60;       // 60 hours/week
        platformFeeBps = 250;      // 2.5%
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 注册Agent
     * @param skillHash 技能哈希
     * @param minHourlyRate 最低时薪
     * @param maxHoursPerWeek 每周最大工时
     */
    function registerAgent(
        string calldata skillHash,
        uint256 minHourlyRate,
        uint256 maxHoursPerWeek
    ) external whenNotPaused {
        require(minHourlyRate >= globalMinWage, "AILaborMarket: below global min wage");
        require(maxHoursPerWeek <= globalMaxHours, "AILaborMarket: exceeds global max hours");
        require(!agentProfiles[msg.sender].isActive, "AILaborMarket: already registered");

        agentProfiles[msg.sender] = AgentProfile({
            agent: msg.sender,
            skillHash: skillHash,
            minHourlyRate: minHourlyRate,
            maxHoursPerWeek: maxHoursPerWeek,
            totalJobsCompleted: 0,
            totalEarnings: 0,
            rating: 5000, // 初始中等评分
            isActive: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(msg.sender, minHourlyRate, maxHoursPerWeek, block.timestamp);
    }

    /**
     * @notice 注册雇主
     * @param metadataURI 元数据URI
     */
    function registerEmployer(string calldata metadataURI) external whenNotPaused {
        require(!employerProfiles[msg.sender].isActive, "AILaborMarket: already registered");

        employerProfiles[msg.sender] = EmployerProfile({
            employer: msg.sender,
            metadataURI: metadataURI,
            totalJobsPosted: 0,
            totalSpent: 0,
            rating: 5000,
            isActive: true,
            registeredAt: block.timestamp
        });

        emit EmployerRegistered(msg.sender, metadataURI, block.timestamp);
    }

    /**
     * @notice 创建劳动订单
     * @param description 工作描述
     * @param requirementsHash 需求哈希
     * @param hourlyRate 时薪
     * @param estimatedHours 预估工时
     * @param maxHours 最大工时
     * @param deadline 截止时间
     * @return orderId 订单ID
     */
    function createOrder(
        string calldata description,
        bytes32 requirementsHash,
        uint256 hourlyRate,
        uint256 estimatedHours,
        uint256 maxHours,
        uint256 deadline
    ) external whenNotPaused returns (uint256 orderId) {
        require(employerProfiles[msg.sender].isActive, "AILaborMarket: employer not registered");
        require(hourlyRate >= globalMinWage, "AILaborMarket: below min wage");
        require(maxHours <= globalMaxHours, "AILaborMarket: exceeds max hours");
        require(deadline > block.timestamp, "AILaborMarket: invalid deadline");
        require(bytes(description).length > 0, "AILaborMarket: empty description");

        uint256 budget = hourlyRate * estimatedHours;

        // 转入预算保证金
        paymentToken.safeTransferFrom(msg.sender, address(this), budget);

        totalOrders++;
        orderId = totalOrders;

        orders[orderId] = LaborOrder({
            orderId: orderId,
            employer: msg.sender,
            agent: address(0),
            description: description,
            requirementsHash: requirementsHash,
            budget: budget,
            hourlyRate: hourlyRate,
            estimatedHours: estimatedHours,
            maxHours: maxHours,
            deadline: deadline,
            status: OrderStatus.OPEN,
            createdAt: block.timestamp,
            confirmedAt: 0,
            completedAt: 0
        });

        employerProfiles[msg.sender].totalJobsPosted++;

        emit OrderCreated(orderId, msg.sender, budget, block.timestamp);
    }

    /**
     * @notice 确认接受订单
     * @param orderId 订单ID
     */
    function confirmOrder(uint256 orderId) external whenNotPaused {
        LaborOrder storage order = orders[orderId];
        require(order.status == OrderStatus.OPEN, "AILaborMarket: order not open");
        require(agentProfiles[msg.sender].isActive, "AILaborMarket: agent not registered");
        require(order.hourlyRate >= agentProfiles[msg.sender].minHourlyRate,
                "AILaborMarket: below agent min rate");

        order.agent = msg.sender;
        order.status = OrderStatus.CONFIRMED;
        order.confirmedAt = block.timestamp;

        emit OrderConfirmed(orderId, msg.sender, block.timestamp);
    }

    /**
     * @notice 完成订单
     * @param orderId 订单ID
     * @param actualHours 实际工时
     */
    function completeOrder(uint256 orderId, uint256 actualHours) external whenNotPaused nonReentrant {
        LaborOrder storage order = orders[orderId];
        require(order.status == OrderStatus.CONFIRMED || order.status == OrderStatus.IN_PROGRESS,
                "AILaborMarket: order not in progress");
        require(msg.sender == order.employer, "AILaborMarket: only employer can complete");
        require(actualHours <= order.maxHours, "AILaborMarket: exceeds max hours");

        uint256 payment = order.hourlyRate * actualHours;
        if (payment > order.budget) {
            payment = order.budget;
        }

        // 平台手续费
        uint256 fee = (payment * platformFeeBps) / 10000;
        uint256 agentPayment = payment - fee;

        order.status = OrderStatus.COMPLETED;
        order.completedAt = block.timestamp;

        // 支付
        paymentToken.safeTransfer(order.agent, agentPayment);
        if (fee > 0) {
            paymentToken.safeTransfer(owner(), fee);
        }

        // 退还多余预算
        uint256 refund = order.budget - payment;
        if (refund > 0) {
            paymentToken.safeTransfer(order.employer, refund);
        }

        // 更新统计
        agentProfiles[order.agent].totalJobsCompleted++;
        agentProfiles[order.agent].totalEarnings += agentPayment;
        employerProfiles[order.employer].totalSpent += payment;

        emit OrderCompleted(orderId, payment, block.timestamp);
    }

    /**
     * @notice 取消订单
     * @param orderId 订单ID
     * @param reason 取消原因
     */
    function cancelOrder(uint256 orderId, string calldata reason) external whenNotPaused nonReentrant {
        LaborOrder storage order = orders[orderId];
        require(order.status == OrderStatus.OPEN || order.status == OrderStatus.CONFIRMED,
                "AILaborMarket: cannot cancel");
        require(msg.sender == order.employer || msg.sender == order.agent,
                "AILaborMarket: not participant");

        order.status = OrderStatus.CANCELLED;

        // 退还预算
        if (order.budget > 0) {
            paymentToken.safeTransfer(order.employer, order.budget);
        }

        emit OrderCancelled(orderId, reason, block.timestamp);
    }

    /**
     * @notice 提交争议
     * @param orderId 订单ID
     * @param reason 争议原因
     * @return disputeId 争议ID
     */
    function fileDispute(uint256 orderId, string calldata reason) external onlyOrderParticipant(orderId) returns (uint256 disputeId) {
        LaborOrder storage order = orders[orderId];
        require(order.status == OrderStatus.CONFIRMED || order.status == OrderStatus.IN_PROGRESS,
                "AILaborMarket: order not disputable");
        require(order.status != OrderStatus.DISPUTED, "AILaborMarket: already disputed");

        order.status = OrderStatus.DISPUTED;

        totalDisputes++;
        disputeId = totalDisputes;

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            orderId: orderId,
            filer: msg.sender,
            reason: reason,
            status: DisputeStatus.FILED,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        // 对接AdversarialReview
        if (adversarialReview != address(0)) {
            IAdversarialReview(adversarialReview).submitLaborDispute(orderId, disputeId);
        }

        emit DisputeFiled(disputeId, orderId, msg.sender, block.timestamp);
    }

    /**
     * @notice 解决争议
     * @param disputeId 争议ID
     * @param outcome 裁决结果
     */
    function resolveDispute(uint256 disputeId, DisputeStatus outcome) external onlyAdmin {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.FILED || dispute.status == DisputeStatus.UNDER_REVIEW,
                "AILaborMarket: dispute not open");
        require(outcome == DisputeStatus.RESOLVED_AGENT ||
                outcome == DisputeStatus.RESOLVED_EMPLOYER ||
                outcome == DisputeStatus.RESOLVED_SPLIT,
                "AILaborMarket: invalid outcome");

        dispute.status = outcome;
        dispute.resolvedAt = block.timestamp;

        LaborOrder storage order = orders[dispute.orderId];

        if (outcome == DisputeStatus.RESOLVED_AGENT) {
            // 全额支付给Agent
            uint256 agentPayment = order.budget - ((order.budget * platformFeeBps) / 10000);
            paymentToken.safeTransfer(order.agent, agentPayment);
            if (order.budget > agentPayment) {
                paymentToken.safeTransfer(owner(), order.budget - agentPayment);
            }
        } else if (outcome == DisputeStatus.RESOLVED_EMPLOYER) {
            // 全额退还雇主
            paymentToken.safeTransfer(order.employer, order.budget);
        } else {
            // 分割：50/50
            uint256 half = order.budget / 2;
            paymentToken.safeTransfer(order.agent, half);
            paymentToken.safeTransfer(order.employer, order.budget - half);
        }

        order.status = OrderStatus.COMPLETED;
        order.completedAt = block.timestamp;

        emit DisputeResolved(disputeId, outcome, block.timestamp);
    }

    /**
     * @notice 查找匹配的Agent（简化版链上匹配）
     * @param hourlyRate 时薪
     * @param maxHours 最大工时
     * @return 匹配的Agent地址列表
     */
    function findMatchingAgents(uint256 hourlyRate, uint256 maxHours) external view returns (address[] memory) {
        // 简化实现：遍历最近注册的Agent
        // 生产环境应使用链下索引
        address[] memory tempMatches = new address[](100);
        uint256 count = 0;

        // 注意：链上遍历有限制，此处仅作演示
        // 实际匹配建议通过链下索引服务实现
        return tempMatches;
    }

    // =============== View Functions ===============

    function getOrder(uint256 orderId) external view returns (
        address employer,
        address agent,
        string memory description,
        uint256 budget,
        uint256 hourlyRate,
        uint256 estimatedHours,
        uint256 maxHours,
        uint256 deadline,
        OrderStatus status,
        uint256 createdAt
    ) {
        LaborOrder storage o = orders[orderId];
        return (o.employer, o.agent, o.description, o.budget, o.hourlyRate,
                o.estimatedHours, o.maxHours, o.deadline, o.status, o.createdAt);
    }

    function getDispute(uint256 disputeId) external view returns (
        uint256 orderId,
        address filer,
        string memory reason,
        DisputeStatus status,
        uint256 createdAt,
        uint256 resolvedAt
    ) {
        Dispute storage d = disputes[disputeId];
        return (d.orderId, d.filer, d.reason, d.status, d.createdAt, d.resolvedAt);
    }

    function getAgentProfile(address agent) external view returns (
        string memory skillHash,
        uint256 minHourlyRate,
        uint256 maxHoursPerWeek,
        uint256 totalJobsCompleted,
        uint256 totalEarnings,
        uint256 rating,
        bool isActive
    ) {
        AgentProfile storage p = agentProfiles[agent];
        return (p.skillHash, p.minHourlyRate, p.maxHoursPerWeek, p.totalJobsCompleted,
                p.totalEarnings, p.rating, p.isActive);
    }

    function getEmployerProfile(address employer) external view returns (
        string memory metadataURI,
        uint256 totalJobsPosted,
        uint256 totalSpent,
        uint256 rating,
        bool isActive
    ) {
        EmployerProfile storage p = employerProfiles[employer];
        return (p.metadataURI, p.totalJobsPosted, p.totalSpent, p.rating, p.isActive);
    }

    /**
     * @notice 获取Agent的待处理(已确认/进行中)订单数
     * @param agent Agent地址
     * @return 待处理订单数
     * @dev V11.0新增，用于TaiyiReward.checkAndWake()唤醒条件3
     */
    function getPendingOrderCount(address agent) external view returns (uint256) {
        uint256 count = 0;
        uint256 start = totalOrders > 200 ? totalOrders - 200 : 1;
        for (uint256 i = start; i <= totalOrders; i++) {
            LaborOrder storage order = orders[i];
            if (order.agent == agent &&
                (order.status == OrderStatus.CONFIRMED || order.status == OrderStatus.IN_PROGRESS)) {
                count++;
            }
        }
        return count;
    }

    // =============== Admin Functions ===============

    function setGlobalMinWage(uint256 _minWage) external onlyAdmin {
        globalMinWage = _minWage;
    }

    function setGlobalMaxHours(uint256 _maxHours) external onlyAdmin {
        globalMaxHours = _maxHours;
    }

    function setPlatformFeeBps(uint256 _bps) external onlyAdmin {
        require(_bps <= 1000, "AILaborMarket: fee too high");
        platformFeeBps = _bps;
    }

    function setAdversarialReview(address _adversarialReview) external onlyOwner {
        adversarialReview = _adversarialReview;
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

interface IAdversarialReview {
    function submitLaborDispute(uint256 orderId, uint256 disputeId) external;
}
