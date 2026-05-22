// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SigmaBridge
 * @dev 跨链桥接协议合约
 *
 * 实现资产在Ethereum、BSV、其他L1/L2之间的无缝转移。
 * 采用锁定-铸造（Lock-Mint）/ 销毁-解锁（Burn-Unlock）模式。
 *
 * 核心设计：
 * - Φ值加权验证者集合，2/3签名阈值
 * - 支持多链：Ethereum(1)、BSV(1+)、Arbitrum(42161)、Optimism(10)、Polygon(137)
 * - 安全机制：超时退款、紧急暂停、每日限额
 * - 跨链消息格式：(chainId, nonce, payload, signatures[])
 */
contract SigmaBridge is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Structs ===============

    struct ValidatorInfo {
        address validator;
        uint256 phiWeight;       // Φ值权重 (0-10000)
        bool active;
        uint256 totalSigned;     // 累计签名次数
        uint256 totalSlashed;   // 累计惩罚次数
    }

    struct ChainConfig {
        uint256 chainId;        // 目标链ID
        string name;            // 链名称
        address bridgeContract; // 目标链桥合约地址（bytes20编码）
        bool active;
        uint256 dailyLimit;    // 每日限额 (token数量)
        uint256 dailyUsed;     // 当日已用
        uint256 lastResetTime; // 上次重置时间
    }

    struct BridgeRequest {
        bytes32 requestId;
        uint256 sourceChainId;
        uint256 targetChainId;
        address token;
        address sender;
        bytes20 recipient;      // 目标链接收地址（兼容不同链地址格式）
        uint256 amount;
        uint256 nonce;
        BridgeRequestState state;
        uint256 createdAt;
        uint256 deadline;       // 超时时间
        uint256 validatorSignCount;
        uint256 validatorPhiWeight;
    }

    enum BridgeRequestState {
        Pending,        // 等待验证者签名
        Locked,         // 源链已锁定
        Minted,         // 目标链已铸造
        BurnInitiated,  // 源链发起销毁
        Unlocked,       // 目标链已解锁
        Completed,      // 完成
        Refunded,       // 已退款
        Failed          // 失败
    }

    // =============== State Variables ===============

    uint256 public immutable CHAIN_ID; // 当前链ID

    // 验证者集合
    mapping(address => ValidatorInfo) private s_validators;
    address[] private s_validatorList;
    uint256 private s_totalPhiWeight;

    // 链配置
    mapping(uint256 => ChainConfig) private s_chains;
    uint256[] private s_supportedChains;

    // 桥接请求
    mapping(bytes32 => BridgeRequest) private s_requests;
    mapping(bytes32 => mapping(address => bool)) private s_requestSignatures; // requestId => validator => signed
    bytes32[] private s_requestList;

    uint256 private s_nonce;
    uint256 public constant SIGNATURE_THRESHOLD = 6667;  // 2/3 = 66.67% (10000 basis points)
    uint256 public constant REQUEST_TIMEOUT = 1 hours;
    uint256 public constant MIN_BRIDGE_AMOUNT = 1e15;    // 最小桥接数量
    uint256 public constant MAX_VALIDATORS = 50;

    // =============== Events ===============

    event ValidatorAdded(address indexed validator, uint256 phiWeight);
    event ValidatorRemoved(address indexed validator);
    event ValidatorPhiUpdated(address indexed validator, uint256 oldWeight, uint256 newWeight);
    event ChainAdded(uint256 indexed chainId, string name);
    event ChainDeactivated(uint256 indexed chainId);
    event BridgeRequested(bytes32 indexed requestId, uint256 sourceChain, uint256 targetChain, address token, uint256 amount);
    event BridgeLocked(bytes32 indexed requestId, uint256 validatorSignCount, uint256 totalPhiWeight);
    event BridgeMinted(bytes32 indexed requestId, bytes20 recipient, uint256 amount);
    event BridgeBurnInitiated(bytes32 indexed requestId, address token, uint256 amount);
    event BridgeUnlocked(bytes32 indexed requestId, bytes20 recipient, uint256 amount);
    event BridgeRefunded(bytes32 indexed requestId, address recipient, uint256 amount);
    event BridgeFailed(bytes32 indexed requestId, string reason);

    // =============== Constructor ===============

    constructor(uint256 _chainId) Ownable(msg.sender) {
        CHAIN_ID = _chainId;
    }

    // =============== Validator Management ===============

    function addValidator(address validator, uint256 phiWeight) external onlyOwner returns (bool) {
        require(validator != address(0), "Invalid validator");
        require(!s_validators[validator].active, "Already active");
        require(s_validatorList.length < MAX_VALIDATORS, "Max validators reached");
        require(phiWeight > 0 && phiWeight <= 10000, "Invalid phi weight");

        s_validators[validator] = ValidatorInfo({
            validator: validator,
            phiWeight: phiWeight,
            active: true,
            totalSigned: 0,
            totalSlashed: 0
        });
        s_validatorList.push(validator);
        s_totalPhiWeight += phiWeight;

        emit ValidatorAdded(validator, phiWeight);
        return true;
    }

    function removeValidator(address validator) external onlyOwner returns (bool) {
        require(s_validators[validator].active, "Not active");

        s_totalPhiWeight -= s_validators[validator].phiWeight;
        s_validators[validator].active = false;

        // Remove from list
        for (uint256 i = 0; i < s_validatorList.length; i++) {
            if (s_validatorList[i] == validator) {
                s_validatorList[i] = s_validatorList[s_validatorList.length - 1];
                s_validatorList.pop();
                break;
            }
        }

        emit ValidatorRemoved(validator);
        return true;
    }

    function updateValidatorPhi(address validator, uint256 newPhiWeight) external onlyOwner returns (bool) {
        require(s_validators[validator].active, "Not active");
        require(newPhiWeight > 0 && newPhiWeight <= 10000, "Invalid phi weight");

        uint256 oldWeight = s_validators[validator].phiWeight;
        s_totalPhiWeight = s_totalPhiWeight - oldWeight + newPhiWeight;
        s_validators[validator].phiWeight = newPhiWeight;

        emit ValidatorPhiUpdated(validator, oldWeight, newPhiWeight);
        return true;
    }

    // =============== Chain Management ===============

    function addChain(
        uint256 chainId,
        string calldata name,
        address bridgeContract,
        uint256 dailyLimit
    ) external onlyOwner returns (bool) {
        require(!s_chains[chainId].active, "Chain already added");
        require(bytes(name).length > 0, "Name required");

        s_chains[chainId] = ChainConfig({
            chainId: chainId,
            name: name,
            bridgeContract: bridgeContract,
            active: true,
            dailyLimit: dailyLimit,
            dailyUsed: 0,
            lastResetTime: block.timestamp
        });
        s_supportedChains.push(chainId);

        emit ChainAdded(chainId, name);
        return true;
    }

    function deactivateChain(uint256 chainId) external onlyOwner returns (bool) {
        require(s_chains[chainId].active, "Chain not active");
        s_chains[chainId].active = false;

        emit ChainDeactivated(chainId);
        return true;
    }

    // =============== Bridge Operations ===============

    /**
     * @notice 发起锁定（Lock-Mint模式：源链锁定→目标链铸造）
     * @param targetChainId 目标链ID
     * @param token ERC20代币地址（address(0)表示原生代币）
     * @param recipient 目标链接收地址
     * @param amount 桥接数量
     */
    function lock(
        uint256 targetChainId,
        address token,
        bytes20 recipient,
        uint256 amount
    ) external payable whenNotPaused nonReentrant returns (bytes32) {
        require(s_chains[targetChainId].active, "Target chain not active");
        require(amount >= MIN_BRIDGE_AMOUNT, "Below minimum amount");
        require(recipient != bytes20(0), "Invalid recipient");

        ChainConfig storage chain = s_chains[targetChainId];
        _resetDailyIfNeeded(chain);

        require(chain.dailyUsed + amount <= chain.dailyLimit, "Daily limit exceeded");

        // 创建桥接请求
        bytes32 requestId = keccak256(abi.encodePacked(
            CHAIN_ID, targetChainId, msg.sender, token, amount, s_nonce, block.timestamp
        ));

        BridgeRequest storage request = s_requests[requestId];
        request.requestId = requestId;
        request.sourceChainId = CHAIN_ID;
        request.targetChainId = targetChainId;
        request.token = token;
        request.sender = msg.sender;
        request.recipient = recipient;
        request.amount = amount;
        request.nonce = s_nonce;
        request.state = BridgeRequestState.Pending;
        request.createdAt = block.timestamp;
        request.deadline = block.timestamp + REQUEST_TIMEOUT;

        s_requestList.push(requestId);
        s_nonce++;

        // 锁定资产
        if (token == address(0)) {
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        chain.dailyUsed += amount;
        request.state = BridgeRequestState.Locked;

        emit BridgeRequested(requestId, CHAIN_ID, targetChainId, token, amount);
        emit BridgeLocked(requestId, 0, 0);
        return requestId;
    }

    /**
     * @notice 验证者签名确认桥接请求
     */
    function signBridgeRequest(bytes32 requestId) external whenNotPaused returns (bool) {
        require(s_validators[msg.sender].active, "Not an active validator");
        require(s_requests[requestId].state == BridgeRequestState.Locked, "Invalid request state");
        require(!s_requestSignatures[requestId][msg.sender], "Already signed");

        BridgeRequest storage request = s_requests[requestId];
        require(block.timestamp <= request.deadline, "Request expired");

        s_requestSignatures[requestId][msg.sender] = true;
        request.validatorSignCount++;
        request.validatorPhiWeight += s_validators[msg.sender].phiWeight;
        s_validators[msg.sender].totalSigned++;

        // 检查是否达到2/3阈值
        if (request.validatorPhiWeight >= (s_totalPhiWeight * SIGNATURE_THRESHOLD) / 10000) {
            emit BridgeLocked(requestId, request.validatorSignCount, request.validatorPhiWeight);
        }

        return true;
    }

    /**
     * @notice 目标链铸造（验证者确认后调用）
     */
    function mint(
        bytes32 requestId,
        uint256 sourceChainId,
        address token,
        bytes20 recipient,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bool) {
        BridgeRequest storage request = s_requests[requestId];

        // 如果请求不存在，创建铸造记录
        if (request.requestId == bytes32(0)) {
            request.requestId = requestId;
            request.sourceChainId = sourceChainId;
            request.targetChainId = CHAIN_ID;
            request.token = token;
            request.recipient = recipient;
            request.amount = amount;
            request.state = BridgeRequestState.Minted;
            s_requestList.push(requestId);
        } else {
            require(request.state == BridgeRequestState.Locked, "Invalid state for mint");
            require(
                request.validatorPhiWeight >= (s_totalPhiWeight * SIGNATURE_THRESHOLD) / 10000,
                "Insufficient validator signatures"
            );
            request.state = BridgeRequestState.Minted;
        }

        // 铸造代币给接收者（简化：从合约余额转移）
        if (token == address(0)) {
            payable(address(recipient)).transfer(amount);
        } else {
            IERC20(token).safeTransfer(address(recipient), amount);
        }

        emit BridgeMinted(requestId, recipient, amount);
        return true;
    }

    /**
     * @notice 发起销毁（Burn-Unlock模式：源链销毁→目标链解锁）
     */
    function burn(
        uint256 targetChainId,
        address token,
        bytes20 recipient,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bytes32) {
        require(s_chains[targetChainId].active, "Target chain not active");

        bytes32 requestId = keccak256(abi.encodePacked(
            "burn", CHAIN_ID, targetChainId, msg.sender, token, amount, s_nonce, block.timestamp
        ));

        BridgeRequest storage request = s_requests[requestId];
        request.requestId = requestId;
        request.sourceChainId = CHAIN_ID;
        request.targetChainId = targetChainId;
        request.token = token;
        request.sender = msg.sender;
        request.recipient = recipient;
        request.amount = amount;
        request.nonce = s_nonce;
        request.state = BridgeRequestState.BurnInitiated;
        request.createdAt = block.timestamp;
        request.deadline = block.timestamp + REQUEST_TIMEOUT;

        s_requestList.push(requestId);
        s_nonce++;

        // 销毁代币（简化：转移到黑洞地址）
        if (token == address(0)) {
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(0x000000000000000000000000000000000000dEaD), amount);
        }

        emit BridgeBurnInitiated(requestId, token, amount);
        return requestId;
    }

    /**
     * @notice 目标链解锁
     */
    function unlock(
        bytes32 requestId,
        address token,
        bytes20 recipient,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bool) {
        BridgeRequest storage request = s_requests[requestId];
        require(request.state == BridgeRequestState.BurnInitiated, "Invalid state for unlock");
        require(
            request.validatorPhiWeight >= (s_totalPhiWeight * SIGNATURE_THRESHOLD) / 10000 || msg.sender == owner(),
            "Insufficient signatures or not owner"
        );

        request.state = BridgeRequestState.Unlocked;

        if (token == address(0)) {
            payable(address(recipient)).transfer(amount);
        } else {
            IERC20(token).safeTransfer(address(recipient), amount);
        }

        emit BridgeUnlocked(requestId, recipient, amount);
        return true;
    }

    /**
     * @notice 超时退款
     */
    function refund(bytes32 requestId) external nonReentrant returns (bool) {
        BridgeRequest storage request = s_requests[requestId];
        require(request.state == BridgeRequestState.Locked, "Invalid state for refund");
        require(block.timestamp > request.deadline, "Not expired yet");
        require(request.sender == msg.sender || msg.sender == owner(), "Not authorized");

        request.state = BridgeRequestState.Refunded;

        // 退还资产
        if (request.token == address(0)) {
            payable(request.sender).transfer(request.amount);
        } else {
            IERC20(request.token).safeTransfer(request.sender, request.amount);
        }

        emit BridgeRefunded(requestId, request.sender, request.amount);
        return true;
    }

    // =============== Internal Functions ===============

    function _resetDailyIfNeeded(ChainConfig storage chain) internal {
        if (block.timestamp >= chain.lastResetTime + 1 days) {
            chain.dailyUsed = 0;
            chain.lastResetTime = block.timestamp;
        }
    }

    // =============== View Functions ===============

    function getValidator(address validator) external view returns (ValidatorInfo memory) {
        return s_validators[validator];
    }

    function getValidatorCount() external view returns (uint256) {
        return s_validatorList.length;
    }

    function getTotalPhiWeight() external view returns (uint256) {
        return s_totalPhiWeight;
    }

    function getChain(uint256 chainId) external view returns (ChainConfig memory) {
        return s_chains[chainId];
    }

    function getSupportedChains() external view returns (uint256[] memory) {
        return s_supportedChains;
    }

    function getBridgeRequest(bytes32 requestId) external view returns (BridgeRequest memory) {
        return s_requests[requestId];
    }

    function hasValidatorSigned(bytes32 requestId, address validator) external view returns (bool) {
        return s_requestSignatures[requestId][validator];
    }

    function isBridgeConfirmed(bytes32 requestId) external view returns (bool) {
        BridgeRequest storage request = s_requests[requestId];
        return request.validatorPhiWeight >= (s_totalPhiWeight * SIGNATURE_THRESHOLD) / 10000;
    }

    // =============== Admin ===============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // 紧急提取
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }
}
