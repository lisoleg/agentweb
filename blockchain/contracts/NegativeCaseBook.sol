// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title NegativeCaseBook
 * @notice V10.0 反面案例簿 — 记录智能体失败案例，强制新Agent学习
 * @dev 案例记录+强制学习+软删除+分类检索，与PhiAgentNFT联动
 */
contract NegativeCaseBook is Ownable, Pausable {

    // =============== Enums ===============

    enum CaseCategory {
        HALLUCINATION,       // 幻觉
        SAFETY_VIOLATION,    // 安全违规
        DATA_LEAK,           // 数据泄露
        PERFORMANCE_DEGRADATION, // 性能退化
        MISALIGNMENT,       // 目标偏移
        RESOURCE_ABUSE,      // 资源滥用
        OTHER               // 其他
    }

    enum Severity {
        LOW,       // 低
        MEDIUM,    // 中
        HIGH,      // 高
        CRITICAL   // 致命
    }

    // =============== Structs ===============

    struct NegativeCase {
        uint256 caseId;            // 案例ID
        string title;              // 案例标题
        string description;        // 案例描述
        CaseCategory category;     // 分类
        Severity severity;         // 严重程度
        bytes32 evidenceHash;      // 证据哈希（IPFS）
        address recorder;          // 记录者
        uint256 timestamp;         // 记录时间
        bool isMandatory;          // 是否为强制学习案例
        bool softDeleted;          // 是否软删除
        uint256 confirmCount;      // 确认学习次数
    }

    // =============== State Variables ===============

    /// @notice 案例总数
    uint256 public totalCases;

    /// @notice caseId => NegativeCase
    mapping(uint256 => NegativeCase) public cases;

    /// @notice category => caseId列表
    mapping(CaseCategory => uint256[]) public casesByCategory;

    /// @notice agent地址 => 已学习的caseId集合
    mapping(address => mapping(uint256 => bool)) public agentLearned;

    /// @notice agent地址 => 已学习案例数
    mapping(address => uint256) public agentLearnedCount;

    /// @notice PhiAgentNFT合约地址
    address public phiAgentNFT;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event CaseRecorded(uint256 indexed caseId, CaseCategory category, Severity severity, address indexed recorder, uint256 timestamp);
    event CaseMarkedMandatory(uint256 indexed caseId, uint256 timestamp);
    event CaseUnmarkedMandatory(uint256 indexed caseId, uint256 timestamp);
    event LearningConfirmed(address indexed agent, uint256 indexed caseId, uint256 timestamp);
    event MandatoryLearnAllCompleted(address indexed agent, uint256 count, uint256 timestamp);
    event CaseSoftDeleted(uint256 indexed caseId, address indexed deleter, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "NegativeCaseBook: not admin");
        _;
    }

    modifier onlyPhiAgentNFT() {
        require(msg.sender == phiAgentNFT || admins[msg.sender] || msg.sender == owner(),
                "NegativeCaseBook: not PhiAgentNFT or admin");
        _;
    }

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 记录反面案例
     * @param title 案例标题
     * @param description 案例描述
     * @param category 分类
     * @param severity 严重程度
     * @param evidenceHash 证据哈希
     * @return caseId 案例ID
     */
    function recordCase(
        string calldata title,
        string calldata description,
        CaseCategory category,
        Severity severity,
        bytes32 evidenceHash
    ) external onlyAdmin whenNotPaused returns (uint256 caseId) {
        require(bytes(title).length > 0, "NegativeCaseBook: empty title");
        require(bytes(description).length > 0, "NegativeCaseBook: empty description");

        totalCases++;
        caseId = totalCases;

        cases[caseId] = NegativeCase({
            caseId: caseId,
            title: title,
            description: description,
            category: category,
            severity: severity,
            evidenceHash: evidenceHash,
            recorder: msg.sender,
            timestamp: block.timestamp,
            isMandatory: false,
            softDeleted: false,
            confirmCount: 0
        });

        casesByCategory[category].push(caseId);

        emit CaseRecorded(caseId, category, severity, msg.sender, block.timestamp);
    }

    /**
     * @notice 标记案例为强制学习
     * @param caseId 案例ID
     */
    function markMandatory(uint256 caseId) external onlyAdmin {
        require(caseId > 0 && caseId <= totalCases, "NegativeCaseBook: invalid case");
        require(!cases[caseId].softDeleted, "NegativeCaseBook: case soft deleted");
        cases[caseId].isMandatory = true;
        emit CaseMarkedMandatory(caseId, block.timestamp);
    }

    /**
     * @notice 取消案例强制学习标记
     * @param caseId 案例ID
     */
    function unmarkMandatory(uint256 caseId) external onlyAdmin {
        require(caseId > 0 && caseId <= totalCases, "NegativeCaseBook: invalid case");
        cases[caseId].isMandatory = false;
        emit CaseUnmarkedMandatory(caseId, block.timestamp);
    }

    /**
     * @notice 确认Agent学习了某个案例
     * @param agent Agent地址
     * @param caseId 案例ID
     */
    function confirmLearning(address agent, uint256 caseId) external onlyPhiAgentNFT whenNotPaused {
        require(caseId > 0 && caseId <= totalCases, "NegativeCaseBook: invalid case");
        require(!cases[caseId].softDeleted, "NegativeCaseBook: case soft deleted");
        require(!agentLearned[agent][caseId], "NegativeCaseBook: already learned");

        agentLearned[agent][caseId] = true;
        agentLearnedCount[agent]++;
        cases[caseId].confirmCount++;

        emit LearningConfirmed(agent, caseId, block.timestamp);
    }

    /**
     * @notice 强制学习所有必学案例（由PhiAgentNFT.register()调用）
     * @param agent Agent地址
     * @return count 学习的案例数
     */
    function mandatoryLearnAll(address agent) external onlyPhiAgentNFT whenNotPaused returns (uint256 count) {
        // 遍历所有案例，学习所有标记为isMandatory且未学习的
        for (uint256 i = 1; i <= totalCases; i++) {
            if (cases[i].isMandatory && !cases[i].softDeleted && !agentLearned[agent][i]) {
                agentLearned[agent][i] = true;
                cases[i].confirmCount++;
                count++;
            }
        }
        agentLearnedCount[agent] += count;
        emit MandatoryLearnAllCompleted(agent, count, block.timestamp);
    }

    /**
     * @notice 软删除案例
     * @param caseId 案例ID
     */
    function softDelete(uint256 caseId) external onlyAdmin {
        require(caseId > 0 && caseId <= totalCases, "NegativeCaseBook: invalid case");
        require(!cases[caseId].softDeleted, "NegativeCaseBook: already soft deleted");
        cases[caseId].softDeleted = true;
        emit CaseSoftDeleted(caseId, msg.sender, block.timestamp);
    }

    /**
     * @notice 按分类获取案例列表
     * @param category 分类
     * @return 案例ID列表
     */
    function getCasesByCategory(CaseCategory category) external view returns (uint256[] memory) {
        return casesByCategory[category];
    }

    /**
     * @notice 搜索案例（按关键词匹配标题）
     * @param keyword 关键词
     * @return 匹配的案例ID列表
     */
    function searchCases(string calldata keyword) external view returns (uint256[] memory) {
        bytes32 keywordHash = keccak256(bytes(keyword));
        uint256[] memory results = new uint256[](totalCases);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalCases; i++) {
            if (!cases[i].softDeleted && keccak256(bytes(cases[i].title)) == keywordHash) {
                results[count] = i;
                count++;
            }
        }

        // Resize array
        uint256[] memory trimmed = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            trimmed[j] = results[j];
        }
        return trimmed;
    }

    // =============== View Functions ===============

    function getCase(uint256 caseId) external view returns (
        string memory title,
        string memory description,
        CaseCategory category,
        Severity severity,
        bytes32 evidenceHash,
        address recorder,
        uint256 timestamp,
        bool isMandatory,
        bool softDeleted,
        uint256 confirmCount
    ) {
        require(caseId > 0 && caseId <= totalCases, "NegativeCaseBook: invalid case");
        NegativeCase storage c = cases[caseId];
        return (c.title, c.description, c.category, c.severity, c.evidenceHash,
                c.recorder, c.timestamp, c.isMandatory, c.softDeleted, c.confirmCount);
    }

    function hasAgentLearned(address agent, uint256 caseId) external view returns (bool) {
        return agentLearned[agent][caseId];
    }

    function getMandatoryCaseCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= totalCases; i++) {
            if (cases[i].isMandatory && !cases[i].softDeleted) {
                count++;
            }
        }
    }

    // =============== Admin Functions ===============

    function setPhiAgentNFT(address _phiAgentNFT) external onlyOwner {
        phiAgentNFT = _phiAgentNFT;
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
