// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SigmaBridgeV2
 * @notice V11.0 跨链桥接协议 V2 — 带Passport的Φ衰减跨链迁徙
 * @dev 独立于SigmaBridge（V1），不继承V1
 *      核心功能: lockWithPassport → mintWithPassport → markMigrated
 *      Φ衰减: targetPhi = sourcePhi * decayRate / 10000
 *      decayRate默认9500 (= 0.95, 即5%衰减)
 *      迁徙状态: NONE → LOCKED → MINTED → MIGRATED
 */
contract SigmaBridgeV2 is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum MigrationState {
        NONE,       // 未开始
        LOCKED,     // 源链已锁定
        MINTED,     // 目标链已铸造
        MIGRATED    // 已完成迁徙
    }

    // =============== Structs ===============

    struct PassportData {
        uint256 phiValue;          // Φ值
        uint256 creditScore;       // 信用分
        bytes32 caseMerkleRoot;    // 案件Merkle根
        uint256 lostCaseCount;     // 败诉数
    }

    struct MigrationRequest {
        bytes32 requestId;
        address agent;
        uint256 sourceChainId;
        uint256 targetChainId;
        uint256 amount;            // 桥接资产数量
        PassportData passportData;
        uint256 decayedPhi;        // 衰减后的Φ值
        MigrationState state;
        uint256 createdAt;
        uint256 completedAt;
    }

    // =============== State Variables ===============

    /// @notice 当前链ID
    uint256 public immutable CHAIN_ID;

    /// @notice Φ衰减率（基点，9500 = 5%衰减）
    uint256 public decayRate;

    /// @notice 请求总数
    uint256 public totalRequests;

    /// @notice requestId => MigrationRequest
    mapping(bytes32 => MigrationRequest) public migrationRequests;

    /// @notice agent地址 => 是否已完成迁徙
    mapping(address => bool) public hasMigrated;

    /// @notice AgentPassport合约地址
    address public agentPassport;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event LockedWithPassport(
        bytes32 indexed requestId,
        address indexed agent,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 amount,
        uint256 sourcePhi,
        uint256 timestamp
    );
    event MintedWithPassport(
        bytes32 indexed requestId,
        address indexed agent,
        uint256 decayedPhi,
        uint256 creditScore,
        uint256 timestamp
    );
    event MarkedMigrated(
        bytes32 indexed requestId,
        address indexed agent,
        uint256 timestamp
    );
    event DecayRateUpdated(uint256 oldRate, uint256 newRate);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "SigmaBridgeV2: not admin");
        _;
    }

    // =============== Constructor ===============

    constructor(uint256 _chainId, address _agentPassport) Ownable(msg.sender) {
        CHAIN_ID = _chainId;
        agentPassport = _agentPassport;
        decayRate = 9500;  // 5% decay by default
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 锁定资产并携带Passport数据
     * @param targetChainId 目标链ID
     * @param token ERC20代币地址
     * @param amount 桥接数量
     * @param passportData Passort数据
     * @return requestId 请求ID
     */
    function lockWithPassport(
        uint256 targetChainId,
        address token,
        uint256 amount,
        PassportData calldata passportData
    ) external whenNotPaused nonReentrant returns (bytes32 requestId) {
        require(amount > 0, "SigmaBridgeV2: zero amount");
        require(passportData.phiValue <= 10000, "SigmaBridgeV2: invalid phiValue");
        require(passportData.creditScore <= 10000, "SigmaBridgeV2: invalid creditScore");

        // 生成请求ID
        requestId = keccak256(abi.encodePacked(
            CHAIN_ID, targetChainId, msg.sender, amount, totalRequests, block.timestamp
        ));

        // 锁定资产
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        totalRequests++;

        MigrationRequest storage req = migrationRequests[requestId];
        req.requestId = requestId;
        req.agent = msg.sender;
        req.sourceChainId = CHAIN_ID;
        req.targetChainId = targetChainId;
        req.amount = amount;
        req.passportData = passportData;
        req.decayedPhi = 0;  // 将在mint时计算
        req.state = MigrationState.LOCKED;
        req.createdAt = block.timestamp;
        req.completedAt = 0;

        emit LockedWithPassport(
            requestId, msg.sender, CHAIN_ID, targetChainId, amount,
            passportData.phiValue, block.timestamp
        );
    }

    /**
     * @notice 在目标链铸造并应用Φ衰减
     * @param requestId 请求ID
     * @param agent Agent地址
     * @param sourceChainId 源链ID
     * @param amount 铸造数量
     * @param passportData 源链Passport数据
     * @return decayedPhi 衰减后的Φ值
     */
    function mintWithPassport(
        bytes32 requestId,
        address agent,
        uint256 sourceChainId,
        uint256 amount,
        PassportData calldata passportData
    ) external whenNotPaused nonReentrant returns (uint256 decayedPhi) {
        MigrationRequest storage req = migrationRequests[requestId];

        if (req.state == MigrationState.NONE) {
            // 新请求：从目标链视角创建
            req.requestId = requestId;
            req.agent = agent;
            req.sourceChainId = sourceChainId;
            req.targetChainId = CHAIN_ID;
            req.amount = amount;
            req.passportData = passportData;
            req.createdAt = block.timestamp;
        } else {
            require(req.state == MigrationState.LOCKED, "SigmaBridgeV2: invalid state");
            require(req.agent == agent, "SigmaBridgeV2: agent mismatch");
        }

        // 计算Φ衰减: targetPhi = sourcePhi * decayRate / 10000
        decayedPhi = (passportData.phiValue * decayRate) / 10000;
        req.decayedPhi = decayedPhi;
        req.state = MigrationState.MINTED;

        emit MintedWithPassport(
            requestId, agent, decayedPhi, passportData.creditScore, block.timestamp
        );
    }

    /**
     * @notice 标记迁徙完成
     * @param requestId 请求ID
     */
    function markMigrated(bytes32 requestId) external onlyAdmin {
        MigrationRequest storage req = migrationRequests[requestId];
        require(req.state == MigrationState.MINTED, "SigmaBridgeV2: not minted");

        req.state = MigrationState.MIGRATED;
        req.completedAt = block.timestamp;
        hasMigrated[req.agent] = true;

        emit MarkedMigrated(requestId, req.agent, block.timestamp);
    }

    // =============== View Functions ===============

    /**
     * @notice 获取迁徙请求
     */
    function getMigrationRequest(bytes32 requestId) external view returns (
        address agent,
        uint256 sourceChainId,
        uint256 targetChainId,
        uint256 amount,
        uint256 sourcePhi,
        uint256 decayedPhi,
        uint256 creditScore,
        MigrationState state,
        uint256 createdAt
    ) {
        MigrationRequest storage req = migrationRequests[requestId];
        return (
            req.agent,
            req.sourceChainId,
            req.targetChainId,
            req.amount,
            req.passportData.phiValue,
            req.decayedPhi,
            req.passportData.creditScore,
            req.state,
            req.createdAt
        );
    }

    /**
     * @notice 计算衰减后的Φ值（纯view）
     */
    function calculateDecayedPhi(uint256 sourcePhi) external view returns (uint256) {
        return (sourcePhi * decayRate) / 10000;
    }

    /**
     * @notice 检查Agent是否已迁徙
     */
    function isAgentMigrated(address agent) external view returns (bool) {
        return hasMigrated[agent];
    }

    // =============== Admin Functions ===============

    function setDecayRate(uint256 newRate) external onlyAdmin {
        require(newRate > 0 && newRate <= 10000, "SigmaBridgeV2: invalid rate");
        uint256 oldRate = decayRate;
        decayRate = newRate;
        emit DecayRateUpdated(oldRate, newRate);
    }

    function setAgentPassport(address _agentPassport) external onlyOwner {
        agentPassport = _agentPassport;
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
