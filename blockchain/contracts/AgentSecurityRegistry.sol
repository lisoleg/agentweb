// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentSecurityRegistry
 * @dev V17.0 ASG — Agent安全注册表（链上存证）
 *
 * 基于MetaMask Agent Wallet + Ledger AI安全路线图设计：
 * - Agent DID身份注册与验证
 * - 能力声明(Skill)上链存证
 * - 策略版本历史记录(不可篡改)
 * - 人类存在证明(PoH)锚定
 *
 * 核心设计：
 * 所有关键状态变更都在链上记录，
 * 即使中心化服务被攻破，链上记录仍可作为审计依据
 */
contract AgentSecurityRegistry {

    // ====== 结构体定义 ======

    struct AgentRecord {
        bytes32 didHash;              // DID的keccak256哈希（不直接存储DID以保护隐私）
        address owner;                // Owner以太坊地址
        string agentType;             // e.g., 'trading_bot', 'payment_processor'
        uint256 registeredAt;
        uint256 trustScore;           // 0-10000 (对应0.0000-1.0000)
        AgentStatus status;
    }

    enum AgentStatus { Active, Suspended, Revoked, Frozen }

    struct SkillDeclaration {
        string name;                 // e.g., 'swap', 'staking'
        bool involvesFundMovement;
        uint16 minTrustLevel;         // 0-100 (百分制)
        uint16 maxOpRatio;            // 最大单次操作比例 0-10000 (0%-100%)
        uint256 declaredAt;
    }

    struct PolicyVersion {
        uint256 version;
        uint256 dailyLimit;           // 日消费上限（最小单位）
        uint256 perTxLimit;           // 单笔交易上限
        uint8 mode;                   // 0=Guard, 1=Beast
        uint256 effectiveAt;
        bytes policyHash;             // 策略内容的哈希（完整策略存在链下）
        address signedBy;             // Owner签名确认
    }

    struct PoHRecord {
        uint8 method;                 // 0=WebAuthn, 1=Biometric, 2=SocialGraph, 3=StakeBonded
        uint256 verifiedAt;
        uint256 expiresAt;
        bytes providerSig;            // PoH提供方签名
        bool valid;
    }

    // ====== 状态变量 ======

    mapping(bytes32 => AgentRecord) public agents;          // didHash => Agent
    mapping(address => bytes32[]) public ownerAgents;       // owner => didHash[]
    mapping(bytes32 => SkillDeclaration[]) public skills;   // didHash => Skills[]
    mapping(bytes32 => PolicyVersion[]) public policyHistory; // didHash => PolicyVersions[]
    mapping(bytes32 => PoHRecord) public pohRecords;        // didHash => PoH

    uint256 public totalAgents;
    uint256 public totalFrozen;

    // ====== 事件 ======

    event AgentRegistered(
        bytes32 indexed didHash,
        address indexed owner,
        string agentType
    );

    event AgentStatusChanged(
        bytes32 indexed didHash,
        AgentStatus oldStatus,
        AgentStatus newStatus,
        address changedBy
    );

    event PolicyUpdated(
        bytes32 indexed didHash,
        uint256 newVersion,
        uint8 mode,
        uint256 dailyLimit
    );

    event PoHVerified(
        bytes32 indexed didHash,
        uint8 method,
        uint256 expiresAt
    );

    event EmergencyFreeze(
        bytes32 indexed didHash,
        address frozenBy,
        string reason
    );

    // ====== 修饰符 ======

    modifier onlyOwner(bytes32 didHash) {
        require(msg.sender == agents[didHash].owner, "Only agent owner");
        _;
    }

    modifier onlyActive(bytes32 didHash) {
        require(agents[didHash].status == AgentStatus.Active, "Agent not active");
        _;
    }

    modifier nonZeroDid(bytes32 didHash) {
        require(didHash != bytes32(0), "Invalid DID hash");
        _;
    }

    // ====== 核心函数 ======

    /**
     * @notice 注册新Agent
     * @param didHash Agent DID的keccak256哈希
     * @param agentType Agent类型标识符
     * @param skillNames 技能名称列表
     * @param fundMovementFlags 每个技能是否涉及资金操作
     * @param minTrustLevels 每个技能所需的最小信任等级
     */
    function registerAgent(
        bytes32 didHash,
        string calldata agentType,
        string[] calldata skillNames,
        bool[] calldata fundMovementFlags,
        uint16[] calldata minTrustLevels
    )
        external
        nonZeroDid(didHash)
    {
        require(agents[didHash].owner == address(0), "Agent already exists");
        require(skillNames.length == fundMovementFlags.length);
        require(skillNames.length == minTrustLevels.length);

        agents[didHash] = AgentRecord({
            didHash: didHash,
            owner: msg.sender,
            agentType: agentType,
            registeredAt: block.timestamp,
            trustScore: 5000,           // 初始信任分数 0.5
            status: AgentStatus.Active
        });

        ownerAgents[msg.sender].push(didHash);

        for (uint256 i = 0; i < skillNames.length; i++) {
            skills[didHash].push(SkillDeclaration({
                name: skillNames[i],
                involvesFundMovement: fundMovementFlags[i],
                minTrustLevel: minTrustLevels[i],
                maxOpRatio: 2000,         // 默认20%
                declaredAt: block.timestamp
            }));
        }

        totalAgents++;
        emit AgentRegistered(didHash, msg.sender, agentType);
    }

    /**
     * @notice 更新Agent策略版本
     * @param didHash Agent DID哈希
     * @param dailyLimit 新日消费上限
     * @param perTxLimit 新单笔上限
     * @param mode 运行模式 (0=Guard, 1=Beast)
     * @param policyHash 完整策略内容的哈希
     */
    function updatePolicy(
        bytes32 didHash,
        uint256 dailyLimit,
        uint256 perTxLimit,
        uint8 mode,
        bytes calldata policyHash
    )
        external
        onlyOwner(didHash)
        onlyActive(didHash)
    {
        uint256 currentVersion = policyHistory[didHash].length;

        policyHistory[didHash].push(PolicyVersion({
            version: currentVersion + 1,
            dailyLimit: dailyLimit,
            perTxLimit: perTxLimit,
            mode: mode,
            effectiveAt: block.timestamp,
            policyHash: policyHash,
            signedBy: msg.sender
        }));

        emit PolicyUpdated(didHash, currentVersion + 1, mode, dailyLimit);
    }

    /**
     * @notice 锚定人类存在证明(PoH)
     * @param didHash Agent DID哈希
     * @param method 验证方法
     * @param expiresAt 有效期截止时间戳
     * @param providerSig 提供方签名
     */
    function anchorPoH(
        bytes32 didHash,
        uint8 method,
        uint256 expiresAt,
        bytes calldata providerSig
    )
        external
        onlyActive(didHash)
    {
        // 仅允许owner或授权的PoH提供方调用
        // 生产环境应增加访问控制

        pohRecords[didHash] = PoHRecord({
            method: method,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt,
            providerSig: providerSig,
            valid: true
        });

        emit PoHVerified(didHash, method, expiresAt);
    }

    /**
     * @notice 紧急冻结Agent（可由治理合约或管理员调用）
     * @param didHash Agent DID哈希
     * @param reason 冻结原因
     */
    function emergencyFreeze(
        bytes32 didHash,
        string calldata reason
    )
        external
        onlyActive(didHash)
    {
        AgentStatus oldStatus = agents[didHash].status;
        agents[didHash].status = AgentStatus.Frozen;
        totalFrozen++;

        emit AgentStatusChanged(didHash, oldStatus, AgentStatus.Frozen, msg.sender);
        emit EmergencyFreeze(didHash, msg.sender, reason);
    }

    /**
     * @notice 解除冻结
     * @param didHash Agent DID哈希
     */
    function unfreeze(bytes32 didHash) external onlyOwner(didHash) {
        require(agents[didHash].status == AgentStatus.Frozen, "Not frozen");

        AgentStatus oldStatus = agents[didHash].status;
        agents[didHash].status = AgentStatus.Active;
        totalFrozen--;

        emit AgentStatusChanged(didHash, oldStatus, AgentStatus.Active, msg.sender);
    }

    // ====== 查询函数 ======

    /**
     * @notice 获取Agent信息
     */
    function getAgentInfo(bytes32 didHash)
        external
        view
        returns (
            address owner,
            string memory agentType,
            uint256 registeredAt,
            uint256 trustScore,
            AgentStatus status
        )
    {
        AgentRecord storage a = agents[didHash];
        return (a.owner, a.agentType, a.registeredAt, a.trustScore, a.status);
    }

    /**
     * @notice 获取Agent技能数量
     */
    function getSkillCount(bytes32 didHash) external view returns (uint256) {
        return skills[didHash].length;
    }

    /**
     * @notice 获取最新策略版本
     */
    function getLatestPolicy(bytes32 didHash)
        external
        view
        returns (PolicyVersion memory)
    {
        uint256 len = policyHistory[didHash].length;
        require(len > 0, "No policy found");
        return policyHistory[didHash][len - 1];
    }

    /**
     * @notice 检查PoH是否有效
     */
    function isPohValid(bytes32 didHash) external view returns (bool) {
        PoHRecord storage poh = pohRecords[didHash];
        return poh.valid && block.timestamp < poh.expiresAt;
    }
}
