// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PrivacyPreservingRegistry (PPCL 隐私保护注册表)
 * @dev V16.0 智能合约 — 在链上管理加密记录、View Key授权和合规证明
 *
 * 核心功能：
 * 1. 加密记录注册（存储Merkle Commitment而非明文）
 * 2. View Key 授权日志（链上不可篡改的授权记录）
 * 3. ZK 合规证明验证（on-chain proof verification）
 * 4. 披露审计追踪（所有访问操作上链存证）
 */
contract PrivacyPreservingRegistry {

    // ============================================================================
    // 状态变量
    // ============================================================================

    address public owner;
    bool public encryptByDefault = true;

    // 记录ID → Merkle Commitment（仅存承诺值，不存明文或密文）
    mapping(string => RecordCommitment) public recordCommitments;

    // View Key ID → 授权元数据
    mapping(string => ViewKeyAuthorization) public viewKeyAuthorizations;

    // ZK Proof ID → 验证状态
    mapping(string => ProofVerification) public proofVerifications;

    // 用户地址 → 已颁发Key计数
    mapping(address => uint256) public userKeyCount;

    // 全局统计
    uint256 public totalRecords;
    uint256 public totalViewKeys;
    uint256 public totalProofs;
    uint256 public totalDisclosures;

    // ============================================================================
    // 数据结构
    // ============================================================================

    struct RecordCommitment {
        string recordId;
        string merkleCommitment;      // SHA-256 哈希
        address owner;
        string recordType;
        uint256 createdAt;
        bool exists;
        bool revoked;
    }

    struct ViewKeyAuthorization {
        string keyId;
        string targetRecordId;
        address grantedTo;
        address grantedBy;
        uint8 purposeCode;           // 1=Audit 2=Regulatory 3=Counterparty 4=RiskControl 5=Dispute
        uint256 validFrom;
        uint256 validUntil;
        uint256 maxUses;
        uint256 usedCount;
        bool active;
        uint256 revokedAt;
    }

    struct ProofVerification {
        string proofId;
        uint8 proofTypeCode;         // 1=FundsOrigin 2=Sanction 3=TravelRule 4=Identity
        address submitter;
        bytes32 publicInputHash;
        bool verified;
        uint256 validUntil;
        uint256 submittedAt;
    }

    struct DisclosureEvent {
        string logId;
        string viewKeyId;
        address accessedBy;
        string targetRecordId;
        uint8 purposeCode;
        uint256 timestamp;
    }

    // ============================================================================
    // 事件
    // ============================================================================

    event RecordRegistered(
        string indexed recordId,
        address indexed owner,
        string recordType,
        string merkleCommitment
    );

    event ViewKeyIssued(
        string indexed keyId,
        address indexed grantedTo,
        string targetRecordId,
        uint8 purposeCode
    );

    event ViewKeyRevoked(
        string indexed keyId,
        address revokedBy,
        string reason
    );

    event ProofVerified(
        string indexed proofId,
        address indexed submitter,
        uint8 proofTypeCode,
        bool isValid
    );

    event DisclosureLogged(
        string indexed logId,
        string viewKeyId,
        address accessedBy,
        uint256 timestamp
    );

    // ============================================================================
    // 修饰符
    // ============================================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier isActiveKey(string memory keyId) {
        ViewKeyAuthorization storage auth = viewKeyAuthorizations[keyId];
        require(auth.active, "Key not active");
        require(block.timestamp >= auth.validFrom, "Key not yet valid");
        require(block.timestamp <= auth.validUntil || auth.validUntil == 0, "Key expired");
        require(auth.usedCount < auth.maxUses || auth.maxUses == 0, "Key usage exceeded");
        _;
    }

    // ============================================================================
    // 构造函数
    // ============================================================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================================================
    // L1: 加密记录注册
    // ============================================================================

    /**
     * @dev 注册新的加密记录
     * @param recordId 记录唯一标识（链下生成）
     * @param merkleCommitment Merkle承诺值（SHA-256哈希）
     * @param recordType 记录类型标签
     * 注意：实际数据不上链，只上链承诺值用于后续ZK证明验证
     */
    function registerRecord(
        string calldata recordId,
        string calldata merkleCommitment,
        string calldata recordType
    ) external returns (bool) {
        require(recordCommitments[recordId].exists == false, "Record already exists");
        require(bytes(merkleCommitment).length > 0, "Empty commitment");

        recordCommitments[recordId] = RecordCommitment({
            recordId: recordId,
            merkleCommitment: merkleCommitment,
            owner: msg.sender,
            recordType: recordType,
            createdAt: block.timestamp,
            exists: true,
            revoked: false
        });

        totalRecords++;
        emit RecordRegistered(recordId, msg.sender, recordType, merkleCommitment);
        return true;
    }

    /**
     * @dev 验证记录完整性（对比提交的commitment与已注册值）
     */
    function verifyRecordIntegrity(
        string calldata recordId,
        string calldata providedCommitment
    ) external view returns (bool) {
        return keccak256(bytes(providedCommitment)) ==
               keccak256(bytes(recordCommitments[recordId].merkleCommitment));
    }

    /**
     * @dev 撤销记录（紧急情况）
     */
    function revokeRecord(string calldata recordId) external onlyOwner {
        require(recordCommitments[recordId].exists, "Not found");
        recordCommitments[recordId].revoked = true;
    }

    // ============================================================================
    // L2: View Key 授权
    // ============================================================================

    /**
     * @dev 注册 View Key 授权（链上存证）
     */
    function authorizeViewKey(
        string calldata keyId,
        string calldata targetRecordId,
        address grantedTo,
        uint8 purposeCode,
        uint256 validUntil,
        uint256 maxUses
    ) external returns (bool) {
        require(viewKeyAuthorizations[keyId].active == false, "Key already authorized");

        viewKeyAuthorizations[keyId] = ViewKeyAuthorization({
            keyId: keyId,
            targetRecordId: targetRecordId,
            grantedTo: grantedTo,
            grantedBy: msg.sender,
            purposeCode: purposeCode,
            validFrom: block.timestamp,
            validUntil: validUntil,
            maxUses: maxUses,
            usedCount: 0,
            active: true,
            revokedAt: 0
        });

        userKeyCount[msg.sender]++;
        totalViewKeys++;
        emit ViewKeyIssued(keyId, grantedTo, targetRecordId, purposeCode);
        return true;
    }

    /**
     * @dev 使用 View Key 并记录披露事件
     */
    function useViewKeyAndLog(
        string calldata keyId,
        string calldata targetRecordId,
        string calldata logId
    ) external isActiveKey(keyId) returns (bool) {
        ViewKeyAuthorization storage auth = viewKeyAuthorizations[keyId];

        require(auth.grantedTo == msg.sender || auth.targetRecordId == targetRecordId, "Unauthorized");

        auth.usedCount++;
        totalDisclosures++;

        emit DisclosureLogged(logId, keyId, msg.sender, block.timestamp);

        if (auth.usedCount >= auth.maxUses && auth.maxUses > 0) {
            auth.active = false;
        }
        return true;
    }

    /**
     * @dev 撤销 View Key
     */
    function revokeViewKeyAuthorization(
        string calldata keyId,
        string calldata reason
    ) external {
        ViewKeyAuthorization storage auth = viewKeyAuthorizations[keyId];
        require(auth.active, "Already inactive");
        require(
            msg.sender == auth.grantedBy || msg.sender == owner,
            "Not authorized"
        );

        auth.active = false;
        auth.revokedAt = block.timestamp;
        emit ViewKeyRevoked(keyId, msg.sender, reason);
    }

    // ============================================================================
    // L3: ZK 合规证明
    // ============================================================================

    /**
     * @dev 提交ZK证明以供链上验证
     * @param proofId 证明标识
     * @param proofTypeCode 证明类型码
     * @param publicInputHash 公开输入的哈希（保护隐私：不直接上链原始输入）
     * @param validUntil 证明有效期
     * @notice 实际的SNARK验证应在预确认阶段完成，此处为存证+时间戳锚定
     */
    function submitComplianceProof(
        string calldata proofId,
        uint8 proofTypeCode,
        bytes32 publicInputHash,
        uint256 validUntil
    ) external returns (bool) {
        require(proofVerifications[proofId].submittedAt == 0, "Proof already exists");

        proofVerifications[proofId] = ProofVerification({
            proofId: proofId,
            proofTypeCode: proofTypeCode,
            submitter: msg.sender,
            publicInputHash: publicInputHash,
            verified: false,       // 默认未验证，需oracle/relay确认
            validUntil: validUntil,
            submittedAt: block.timestamp
        });

        totalProofs++;
        emit ProofVerified(proofId, msg.sender, proofTypeCode, false);
        return true;
    }

    /**
     * @dev 标记证明为已验证（仅owner或指定验证者）
     */
    function markProofVerified(
        string calldata proofId,
        bool isValid
    ) external onlyOwner {
        require(proofVerifications[proofId].submittedAt > 0, "Not found");
        proofVerifications[proofId].verified = isValid;
        emit ProofVerified(
            proofId,
            proofVerifications[proofId].submitter,
            proofVerifications[proofId].proofTypeCode,
            isValid
        );
    }

    // ============================================================================
    // 查询函数
    // ============================================================================

    /**
     * @dev 获取记录是否存在且有效
     */
    function isRecordValid(string calldata recordId) external view returns (bool) {
        RecordCommitment storage r = recordCommitments[recordId];
        return r.exists && !r.revoked;
    }

    /**
     * @dev 获取用户统计数据
     */
    function getUserStats(address user)
        external view
        returns (
            uint256 keysIssued,
            uint256 recordsOwned,
            uint256 proofsSubmitted
        )
    {
        return (userKeyCount[user], 0, 0);  // records需要遍历
    }

    /**
     * @dev 获取全局统计
     */
    function getGlobalStats()
        external view
        returns (
            uint256 records,
            uint256 viewKeys,
            uint256 proofs,
            uint256 disclosures
        )
    {
        return (totalRecords, totalViewKeys, totalProofs, totalDisclosures);
    }
}
