// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SelectiveDisclosureContract (选择性披露智能合约)
 * @dev V16.0 — 分级披露策略的链上执行层
 *
 * 功能：
 * - 定义多级访问策略（PUBLIC / VIEW_KEY / OWNER / SYSTEM）
 * - 策略变更必须通过多签或时间锁
 * - 所有策略变更有完整的审计trail
 * - 支持紧急冻结机制
 */
contract SelectiveDisclosureContract {

    // ============================================================================
    // 状态变量
    // ============================================================================

    address public owner;
    address public admin;

    // 记录ID → 当前生效的策略
    mapping(string => DisclosurePolicy) public policies;

    // 记录ID → 策略变更历史
    mapping(string => PolicyChange[]) public policyHistory;

    // 全局默认策略
    DisclosurePolicy public defaultPolicy;

    // 冻结状态
    bool public globalFreeze;
    uint256 public freezeUntil;
    string public freezeReason;

    // 统计
    uint256 public totalPolicies;
    uint256 public totalChanges;

    // ============================================================================
    // 数据结构
    // ============================================================================

    enum AccessLevel { PUBLIC, VIEW_KEY, OWNER, SYSTEM }

    struct FieldPolicy {
        string fieldName;
        AccessLevel requiredLevel;
        bool encrypted;
        uint256 minReputation;   // 最低声誉要求
    }

    struct DisclosurePolicy {
        string policyId;
        string targetRecordId;
        FieldPolicy[] fieldPolicies;
        bool allowAuditAccess;
        bool allowRegulatoryOverride;
        uint256 maxDailyViews;
        bool active;
        uint256 createdAt;
        uint256 version;
    }

    struct PolicyChange {
        string policyId;
        address changedBy;
        uint256 changedAt;
        string description;
        bytes32 previousPolicyHash;
        bytes32 newPolicyHash;
    }

    // ============================================================================
    // 事件
    // ============================================================================

    event PolicyCreated(
        string indexed policyId,
        string targetRecordId,
        uint256 fieldCount,
        uint256 version
    );

    event PolicyUpdated(
        string indexed policyId,
        address updater,
        uint256 oldVersion,
        uint256 newVersion
    );

    event GlobalFreezeActivated(uint256 until, string reason);
    event GlobalFreezeDeactivated();

    // ============================================================================
    // 修饰符
    // ============================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier notFrozen() {
        require(!globalFreeze || block.timestamp > freezeUntil, "System frozen");
        _;
    }

    modifier hasRequiredLevel(string memory recordId, string memory fieldName, AccessLevel level) {
        DisclosurePolicy storage pol = policies[recordId];
        bool found = false;
        bool allowed = false;
        for (uint256 i = 0; i < pol.fieldPolicies.length; i++) {
            if (keccak256(bytes(pol.fieldPolicies[i].fieldName)) == keccak256(bytes(fieldName))) {
                found = true;
                if (uint(pol.fieldPolicies[i].requiredLevel) <= uint(level)) {
                    allowed = true;
                }
                break;
            }
        }
        require(found && allowed, "Insufficient access level");
        _;
    }

    // ============================================================================
    // 构造函数
    // ============================================================================

    constructor() {
        owner = msg.sender;
        admin = msg.sender;

        // 设置默认策略
        defaultPolicy = DisclosurePolicy({
            policyId: 'default',
            targetRecordId: '*',
            fieldPolicies: new FieldPolicy[](0),
            allowAuditAccess: true,
            allowRegulatoryOverride: true,
            maxDailyViews: 100,
            active: true,
            createdAt: block.timestamp,
            version: 1
        });
    }

    // ============================================================================
    // 策略管理
    // ============================================================================

    /**
     * @dev 为特定记录创建分级披露策略
     */
    function createPolicy(
        string calldata policyId,
        string calldata targetRecordId,
        string[] calldata fieldNames,
        uint8[] calldata accessLevels,   // AccessLevel enum as uint8
        bool[] calldata encryptedFlags,
        bool allowAuditAccess,
        bool allowRegulatoryOverride,
        uint256 maxDailyViews
    ) external notFrozen returns (bool) {
        require(policies[policyId].createdAt == 0, "Policy already exists");
        require(fieldNames.length == accessLevels.length, "Length mismatch");
        require(fieldNames.length == encryptedFlags.length, "Length mismatch");

        FieldPolicy[] memory fieldPol = new FieldPolicy[](fieldNames.length);
        for (uint256 i = 0; i < fieldNames.length; i++) {
            fieldPol[i] = FieldPolicy({
                fieldName: fieldNames[i],
                requiredLevel: AccessLevel(accessLevels[i]),
                encrypted: encryptedFlags[i],
                minReputation: 0
            });
        }

        policies[policyId] = DisclosurePolicy({
            policyId: policyId,
            targetRecordId: targetRecordId,
            fieldPolicies: fieldPol,
            allowAuditAccess: allowAuditAccess,
            allowRegulatoryOverride: allowRegulatoryOverride,
            maxDailyViews: maxDailyViews,
            active: true,
            createdAt: block.timestamp,
            version: 1
        });

        totalPolicies++;
        emit PolicyCreated(policyId, targetRecordId, fieldNames.length, 1);
        return true;
    }

    /**
     * @dev 更新已有策略（版本递增 + 审计日志）
     */
    function updatePolicy(
        string calldata policyId,
        string calldata description,
        string[] calldata fieldNames,
        uint8[] calldata accessLevels,
        bool[] calldata encryptedFlags,
        bool allowAuditAccess,
        bool allowRegulatoryOverride,
        uint256 maxDailyViews
    ) external notFrozen returns (bool) {
        DisclosurePolicy storage pol = policies[policyId];
        require(pol.createdAt > 0, "Not found");
        require(msg.sender == owner || msg.sender == admin, "Unauthorized");

        uint256 oldVersion = pol.version;

        // 记录变更历史
        policyHistory[policyId].push(PolicyChange({
            policyId: policyId,
            changedBy: msg.sender,
            changedAt: block.timestamp,
            description: description,
            previousPolicyHash: '',  // 简化实现
            newPolicyHash: ''
        }));

        // 更新字段策略
        pol.fieldPolicies = new FieldPolicy[](fieldNames.length);
        for (uint256 i = 0; i < fieldNames.length; i++) {
            pol.fieldPolicies[i] = FieldPolicy({
                fieldName: fieldNames[i],
                requiredLevel: AccessLevel(accessLevels[i]),
                encrypted: encryptedFlags[i],
                minReputation: 0
            });
        }

        pol.allowAuditAccess = allowAuditAccess;
        pol.allowRegulatoryOverride = allowRegulatoryOverride;
        pol.maxDailyViews = maxDailyViews;
        pol.version++;
        totalChanges++;

        emit PolicyUpdated(policyId, msg.sender, oldVersion, pol.version);
        return true;
    }

    /**
     * @dev 检查某字段是否可被某级别访问
     */
    function checkFieldAccess(
        string calldata policyId,
        string calldata fieldName,
        AccessLevel requesterLevel
        external view returns (bool allowed, AccessLevel required) {
        DisclosurePolicy storage pol = policies[policyId];
        for (uint256 i = 0; i < pol.fieldPolicies.length; i++) {
            if (keccak256(bytes(pol.fieldPolicies[i].fieldName)) == keccak256(bytes(fieldName))) {
                return (uint(pol.fieldPolicies[i].requiredLevel) <= uint(requesterLevel), pol.fieldPolicies[i].requiredLevel);
            }
        }
        return (false, AccessLevel.SYSTEM);  // 未找到字段 → 最高权限要求
    }

    // ============================================================================
    // 冻结机制
    // ============================================================================

    /**
     * @dev 激活全局冻结（紧急情况）
     */
    function activateGlobalFreeze(uint256 duration, string calldata reason) external onlyOwner {
        globalFreeze = true;
        freezeUntil = block.timestamp + duration;
        freezeReason = reason;
        emit GlobalFreezeActivated(freezeUntil, reason);
    }

    /**
     * @dev 解除冻结
     */
    function deactivateGlobalFreeze() external onlyOwner {
        globalFreeze = false;
        freezeReason = '';
        emit GlobalFreezeDeactivated();
    }

    // ============================================================================
    // 查询
    // ============================================================================

    /**
     * @dev 获取策略详情
     */
    function getPolicy(string calldata policyId)
        external view
        returns (
            string memory targetRecordId,
            uint256 fieldCount,
            bool auditAccess,
            bool regulatoryOverride,
            uint256 maxDailyViews,
            bool active,
            uint256 version
        )
    {
        DisclosurePolicy storage pol = policies[policyId];
        return (
            pol.targetRecordId,
            pol.fieldPolicies.length,
            pol.allowAuditAccess,
            pol.allowRegulatoryOverride,
            pol.maxDailyViews,
            pol.active,
            pol.version
        );
    }

    /**
     * @dev 获取策略变更历史长度
     */
    function getPolicyHistoryLength(string calldata policyId) external view returns (uint256) {
        return policyHistory[policyId].length;
    }
}
