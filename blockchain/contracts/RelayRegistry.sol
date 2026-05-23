// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RelayRegistry
 * @notice V12.0 通算一体分布式中继网络 — 中继器注册+质押+声誉+任务+惩罚
 * @dev 6GNetGPT"分布式算力+众筹协作"思想融合
 *      中继节点=消息传递+边缘算力，声誉评分与CreditRating联动
 */
contract RelayRegistry is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum TaskType { MESSAGE_RELAY, COMPUTE_RELAY }
    enum TaskStatus { PENDING, ASSIGNED, COMPLETED, FAILED, TIMED_OUT }

    // =============== Structs ===============

    struct RelayNode {
        address operator;
        uint256 stakeAmount;
        uint256 computeCapacity;    // 1-10000 相对值
        uint256[] supportedChains;
        uint256 totalRelayed;
        uint256 totalComputeTasks;
        uint256 successCount;
        uint256 failCount;
        uint256 reputationScore;    // 0-10000
        uint256 feeRate;            // 基点 (1bp = 0.01%)
        bool isActive;
        uint256 registeredAt;
        uint256 lastActiveAt;
    }

    struct RelayTask {
        bytes32 taskId;
        address requester;
        address assignedRelay;
        uint256 sourceChainId;
        uint256 targetChainId;
        bytes32 messageHash;
        TaskType taskType;
        uint256 computeUnits;
        uint256 fee;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
        bytes32 proofHash;
    }

    // =============== State Variables ===============

    /// @notice 最低质押金额
    uint256 public minimumStake;

    /// @notice 任务超时时间
    uint256 public timeoutPeriod;

    /// @notice 惩罚比例（基点，500 = 5%）
    uint256 public slashBps;

    /// @notice CreditRating合约地址
    address public creditRating;

    /// @notice operator => RelayNode
    mapping(address => RelayNode) public relayNodes;

    /// @notice taskId => RelayTask
    mapping(bytes32 => RelayTask) public relayTasks;

    /// @notice 所有已注册中继器地址
    address[] public relayList;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event RelayRegistered(address indexed operator, uint256 stakeAmount, uint256 computeCapacity, uint256 feeRate);
    event RelayStakeAdded(address indexed operator, uint256 amount);
    event TaskSubmitted(bytes32 indexed taskId, address indexed requester, uint256 targetChainId, TaskType taskType);
    event TaskAssigned(bytes32 indexed taskId, address indexed relay);
    event TaskCompleted(bytes32 indexed taskId, address indexed relay, bytes32 proofHash);
    event TaskFailed(bytes32 indexed taskId, address indexed relay);
    event RelaySlashed(address indexed relay, uint256 amount);
    event RelayDeregistered(address indexed operator, uint256 refundedStake);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "RelayRegistry: not admin");
        _;
    }

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {
        minimumStake = 1 ether;
        timeoutPeriod = 1 hours;
        slashBps = 500; // 5%
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 注册中继节点
     * @param supportedChains 支持的目标链ID列表
     * @param computeCapacity 计算能力 (1-10000)
     * @param feeRate 基础费率（基点）
     */
    function registerRelay(
        uint256[] calldata supportedChains,
        uint256 computeCapacity,
        uint256 feeRate
    ) external payable whenNotPaused {
        require(msg.value >= minimumStake, "RelayRegistry: insufficient stake");
        require(computeCapacity >= 1 && computeCapacity <= 10000, "RelayRegistry: invalid computeCapacity");
        require(feeRate > 0, "RelayRegistry: zero feeRate");
        require(!relayNodes[msg.sender].isActive, "RelayRegistry: already registered");

        RelayNode storage node = relayNodes[msg.sender];
        node.operator = msg.sender;
        node.stakeAmount = msg.value;
        node.computeCapacity = computeCapacity;
        node.supportedChains = supportedChains;
        node.totalRelayed = 0;
        node.totalComputeTasks = 0;
        node.successCount = 0;
        node.failCount = 0;
        node.reputationScore = 5000; // 初始声誉5000
        node.feeRate = feeRate;
        node.isActive = true;
        node.registeredAt = block.timestamp;
        node.lastActiveAt = block.timestamp;

        relayList.push(msg.sender);

        emit RelayRegistered(msg.sender, msg.value, computeCapacity, feeRate);
    }

    /**
     * @notice 增加质押
     */
    function addStake() external payable whenNotPaused {
        require(relayNodes[msg.sender].isActive, "RelayRegistry: not registered");
        require(msg.value > 0, "RelayRegistry: zero amount");
        relayNodes[msg.sender].stakeAmount += msg.value;
        emit RelayStakeAdded(msg.sender, msg.value);
    }

    /**
     * @notice 提交中继任务
     * @param targetChainId 目标链ID
     * @param messageHash 消息哈希
     * @param taskType 任务类型
     * @param computeUnits 计算任务量（COMPUTE_RELAY时有效）
     * @return taskId 任务ID
     */
    function submitRelayTask(
        uint256 targetChainId,
        bytes32 messageHash,
        TaskType taskType,
        uint256 computeUnits
    ) external payable whenNotPaused returns (bytes32 taskId) {
        require(msg.value > 0, "RelayRegistry: zero fee");

        taskId = keccak256(abi.encodePacked(
            msg.sender, targetChainId, messageHash, block.timestamp, relayList.length
        ));

        // 自动分配：找第一个活跃的支持目标链的中继
        address assignedRelay = _findBestRelay(targetChainId, taskType, computeUnits);

        RelayTask storage task = relayTasks[taskId];
        task.taskId = taskId;
        task.requester = msg.sender;
        task.assignedRelay = assignedRelay;
        task.sourceChainId = block.chainid;
        task.targetChainId = targetChainId;
        task.messageHash = messageHash;
        task.taskType = taskType;
        task.computeUnits = computeUnits;
        task.fee = msg.value;
        task.status = assignedRelay != address(0) ? TaskStatus.ASSIGNED : TaskStatus.PENDING;
        task.createdAt = block.timestamp;
        task.completedAt = 0;
        task.proofHash = bytes32(0);

        emit TaskSubmitted(taskId, msg.sender, targetChainId, taskType);
        if (assignedRelay != address(0)) {
            emit TaskAssigned(taskId, assignedRelay);
        }
    }

    /**
     * @notice 完成中继任务
     * @param taskId 任务ID
     * @param proofHash 完成证明哈希
     */
    function completeRelayTask(bytes32 taskId, bytes32 proofHash) external whenNotPaused {
        RelayTask storage task = relayTasks[taskId];
        require(task.status == TaskStatus.ASSIGNED, "RelayRegistry: task not assigned");
        require(task.assignedRelay == msg.sender, "RelayRegistry: not assigned relay");

        task.status = TaskStatus.COMPLETED;
        task.completedAt = block.timestamp;
        task.proofHash = proofHash;

        RelayNode storage node = relayNodes[msg.sender];
        node.successCount++;
        node.totalRelayed++;
        if (task.taskType == TaskType.COMPUTE_RELAY) {
            node.totalComputeTasks++;
        }
        node.lastActiveAt = block.timestamp;
        // 更新声誉: successCount / totalRelayed * 10000
        node.reputationScore = (node.successCount * 10000) / node.totalRelayed;

        // 转账中继费
        (bool sent, ) = payable(msg.sender).call{value: task.fee}("");
        require(sent, "RelayRegistry: fee transfer failed");

        emit TaskCompleted(taskId, msg.sender, proofHash);
    }

    /**
     * @notice 报告任务失败
     * @param taskId 任务ID
     */
    function reportTaskFailure(bytes32 taskId) external whenNotPaused {
        RelayTask storage task = relayTasks[taskId];
        require(task.status == TaskStatus.ASSIGNED, "RelayRegistry: task not assigned");
        require(
            task.requester == msg.sender || msg.sender == owner(),
            "RelayRegistry: not requester or owner"
        );

        task.status = TaskStatus.FAILED;
        task.completedAt = block.timestamp;

        RelayNode storage node = relayNodes[task.assignedRelay];
        node.failCount++;
        node.totalRelayed++;
        // 降声誉
        if (node.reputationScore > 500) {
            node.reputationScore -= 500;
        } else {
            node.reputationScore = 0;
        }
        // 扣质押 5%
        uint256 slashAmount = (node.stakeAmount * slashBps) / 10000;
        node.stakeAmount -= slashAmount;

        // 退还请求方费用
        (bool sent, ) = payable(task.requester).call{value: task.fee}("");
        require(sent, "RelayRegistry: refund failed");

        emit TaskFailed(taskId, task.assignedRelay);
    }

    /**
     * @notice 惩罚作恶中继（仅owner）
     * @param relay 中继器地址
     * @param amount 罚没金额
     */
    function slashRelay(address relay, uint256 amount) external onlyOwner {
        RelayNode storage node = relayNodes[relay];
        require(node.isActive, "RelayRegistry: not active");
        require(amount <= node.stakeAmount, "RelayRegistry: exceeds stake");

        node.stakeAmount -= amount;
        node.reputationScore = node.reputationScore > 2000 ? node.reputationScore - 2000 : 0;

        if (node.stakeAmount < minimumStake) {
            node.isActive = false;
        }

        emit RelaySlashed(relay, amount);
    }

    /**
     * @notice 中继器主动退出
     */
    function deregisterRelay() external whenNotPaused nonReentrant {
        RelayNode storage node = relayNodes[msg.sender];
        require(node.isActive, "RelayRegistry: not active");

        node.isActive = false;
        uint256 refund = node.stakeAmount;
        node.stakeAmount = 0;

        (bool sent, ) = payable(msg.sender).call{value: refund}("");
        require(sent, "RelayRegistry: refund failed");

        emit RelayDeregistered(msg.sender, refund);
    }

    // =============== View Functions ===============

    /**
     * @notice 获取中继器声誉分数
     */
    function getReputationScore(address relay) external view returns (uint256) {
        return relayNodes[relay].reputationScore;
    }

    /**
     * @notice 获取中继节点信息
     */
    function getRelayNode(address relay) external view returns (
        uint256 stakeAmount,
        uint256 computeCapacity,
        uint256 totalRelayed,
        uint256 successCount,
        uint256 failCount,
        uint256 reputationScore,
        uint256 feeRate,
        bool isActive,
        uint256 registeredAt,
        uint256 lastActiveAt
    ) {
        RelayNode storage node = relayNodes[relay];
        return (
            node.stakeAmount,
            node.computeCapacity,
            node.totalRelayed,
            node.successCount,
            node.failCount,
            node.reputationScore,
            node.feeRate,
            node.isActive,
            node.registeredAt,
            node.lastActiveAt
        );
    }

    /**
     * @notice 获取活跃中继数量
     */
    function getActiveRelayCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < relayList.length; i++) {
            if (relayNodes[relayList[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice 获取中继任务信息
     */
    function getRelayTask(bytes32 taskId) external view returns (
        address requester,
        address assignedRelay,
        uint256 targetChainId,
        TaskType taskType,
        uint256 fee,
        TaskStatus status,
        uint256 createdAt,
        uint256 completedAt
    ) {
        RelayTask storage task = relayTasks[taskId];
        return (
            task.requester,
            task.assignedRelay,
            task.targetChainId,
            task.taskType,
            task.fee,
            task.status,
            task.createdAt,
            task.completedAt
        );
    }

    /**
     * @notice 获取中继器支持的目标链
     */
    function getSupportedChains(address relay) external view returns (uint256[] memory) {
        return relayNodes[relay].supportedChains;
    }

    /**
     * @notice 检查中继器是否支持指定链
     */
    function supportsChain(address relay, uint256 chainId) external view returns (bool) {
        RelayNode storage node = relayNodes[relay];
        for (uint256 i = 0; i < node.supportedChains.length; i++) {
            if (node.supportedChains[i] == chainId) return true;
        }
        return false;
    }

    // =============== Internal Functions ===============

    /**
     * @dev 查找最优中继（简化：第一个活跃的支持目标链的节点）
     */
    function _findBestRelay(
        uint256 targetChainId,
        TaskType taskType,
        uint256 computeUnits
    ) internal view returns (address) {
        for (uint256 i = 0; i < relayList.length; i++) {
            RelayNode storage node = relayNodes[relayList[i]];
            if (!node.isActive) continue;

            // 检查支持目标链
            bool supportsTarget = false;
            for (uint256 j = 0; j < node.supportedChains.length; j++) {
                if (node.supportedChains[j] == targetChainId) {
                    supportsTarget = true;
                    break;
                }
            }
            if (!supportsTarget) continue;

            // COMPUTE_RELAY需检查算力
            if (taskType == TaskType.COMPUTE_RELAY) {
                if (node.computeCapacity < computeUnits) continue;
            }

            // 声誉阈值
            if (node.reputationScore < 2000) continue;

            return node.operator;
        }
        return address(0);
    }

    // =============== Admin Functions ===============

    function setCreditRating(address _creditRating) external onlyOwner {
        creditRating = _creditRating;
    }

    function setTimeoutPeriod(uint256 period) external onlyAdmin {
        require(period >= 10 minutes, "RelayRegistry: period too short");
        timeoutPeriod = period;
    }

    function setMinimumStake(uint256 amount) external onlyAdmin {
        minimumStake = amount;
    }

    function setSlashBps(uint256 bps) external onlyAdmin {
        require(bps <= 2000, "RelayRegistry: too high");
        slashBps = bps;
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
