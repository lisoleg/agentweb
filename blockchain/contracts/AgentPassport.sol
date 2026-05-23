// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentPassport
 * @notice V11.0 Agent通行证 — 跨链身份与信用凭证
 * @dev 记录Agent的Φ值、信用分、案件Merkle根
 *      creditScore = baseScore(5000) + totalCaseCount*100 - lostCaseCount*200
 *      creditScore范围: 0-10000
 */
contract AgentPassport is Ownable {

    // =============== Structs ===============

    struct Passport {
        address agent;
        uint256 phiValue;          // Φ值 (0-10000)
        uint256 creditScore;       // 信用分 (0-10000)
        bytes32 caseMerkleRoot;    // 案件记录Merkle根
        uint256 lostCaseCount;     // 败诉案件数
        uint256 totalCaseCount;    // 参与案件总数
        uint256 issuedAt;          // 签发时间
        uint256 lastUpdated;       // 最后更新时间
        bool active;               // 是否有效
    }

    // =============== State Variables ===============

    /// @notice passport总数
    uint256 public totalPassports;

    /// @notice 基础信用分（默认5000）
    uint256 public baseCreditScore;

    /// @notice 每参与一个案件的信用分增加
    uint256 public creditPerCase;

    /// @notice 每败诉一个案件的信用分减少
    uint256 public creditLostPerCase;

    /// @notice 最大信用分
    uint256 public maxCreditScore;

    /// @notice 最小信用分
    uint256 public minCreditScore;

    /// @notice agent地址 => Passport
    mapping(address => Passport) public passports;

    /// @notice agent地址 => 是否已签发
    mapping(address => bool) public hasPassport;

    /// @notice NegativeCaseBook合约地址
    address public negativeCaseBook;

    /// @notice PhiStaking合约地址
    address public phiStaking;

    /// @notice ConstitutionCourt合约地址
    address public constitutionCourt;

    /// @notice 管理员
    mapping(address => bool) public admins;

    // =============== Events ===============

    event PassportIssued(address indexed agent, uint256 creditScore, uint256 timestamp);
    event PhiValueUpdated(address indexed agent, uint256 oldPhi, uint256 newPhi, uint256 timestamp);
    event CreditScoreUpdated(address indexed agent, uint256 oldScore, uint256 newScore, uint256 timestamp);
    event CaseMerkleRootUpdated(address indexed agent, bytes32 oldRoot, bytes32 newRoot, uint256 timestamp);
    event LostCaseIncremented(address indexed agent, uint256 lostCount, uint256 totalCases, uint256 timestamp);
    event PassportRevoked(address indexed agent, uint256 timestamp);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "AgentPassport: not admin");
        _;
    }

    modifier onlyPassportHolder(address agent) {
        require(hasPassport[agent], "AgentPassport: no passport");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _negativeCaseBook,
        address _phiStaking,
        address _constitutionCourt
    ) Ownable(msg.sender) {
        negativeCaseBook = _negativeCaseBook;
        phiStaking = _phiStaking;
        constitutionCourt = _constitutionCourt;
        baseCreditScore = 5000;
        creditPerCase = 100;
        creditLostPerCase = 200;
        maxCreditScore = 10000;
        minCreditScore = 0;
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 签发Agent通行证
     * @param agent Agent地址
     * @param phiValue 初始Φ值
     * @return 是否成功
     */
    function issuePassport(address agent, uint256 phiValue) external onlyAdmin returns (bool) {
        require(agent != address(0), "AgentPassport: zero address");
        require(!hasPassport[agent], "AgentPassport: already issued");
        require(phiValue <= 10000, "AgentPassport: phiValue exceeds max");

        totalPassports++;

        Passport storage p = passports[agent];
        p.agent = agent;
        p.phiValue = phiValue;
        p.creditScore = baseCreditScore;
        p.caseMerkleRoot = bytes32(0);
        p.lostCaseCount = 0;
        p.totalCaseCount = 0;
        p.issuedAt = block.timestamp;
        p.lastUpdated = block.timestamp;
        p.active = true;

        hasPassport[agent] = true;

        emit PassportIssued(agent, baseCreditScore, block.timestamp);
        return true;
    }

    /**
     * @notice 更新Φ值
     * @param agent Agent地址
     * @param newPhiValue 新Φ值
     */
    function updatePhiValue(address agent, uint256 newPhiValue) external onlyAdmin onlyPassportHolder(agent) {
        require(newPhiValue <= 10000, "AgentPassport: phiValue exceeds max");
        Passport storage p = passports[agent];
        uint256 oldPhi = p.phiValue;
        p.phiValue = newPhiValue;
        p.lastUpdated = block.timestamp;

        emit PhiValueUpdated(agent, oldPhi, newPhiValue, block.timestamp);
    }

    /**
     * @notice 更新信用分（重新计算）
     * @param agent Agent地址
     */
    function updateCreditScore(address agent) external onlyAdmin onlyPassportHolder(agent) {
        Passport storage p = passports[agent];
        uint256 oldScore = p.creditScore;

        // creditScore = baseScore + totalCaseCount*creditPerCase - lostCaseCount*creditLostPerCase
        uint256 newScore = baseCreditScore
            + p.totalCaseCount * creditPerCase
            - p.lostCaseCount * creditLostPerCase;

        // Clamp to 0-10000
        if (newScore > maxCreditScore) {
            newScore = maxCreditScore;
        }
        // Underflow check: if subtraction would underflow, newScore would wrap
        // We need to handle the case where lostCaseCount makes it negative
        uint256 deduction = p.lostCaseCount * creditLostPerCase;
        uint256 addition = baseCreditScore + p.totalCaseCount * creditPerCase;
        if (deduction > addition) {
            newScore = minCreditScore;
        }

        p.creditScore = newScore;
        p.lastUpdated = block.timestamp;

        emit CreditScoreUpdated(agent, oldScore, newScore, block.timestamp);
    }

    /**
     * @notice 更新案件Merkle根
     * @param agent Agent地址
     * @param newRoot 新的Merkle根
     */
    function updateCaseMerkleRoot(address agent, bytes32 newRoot) external onlyAdmin onlyPassportHolder(agent) {
        Passport storage p = passports[agent];
        bytes32 oldRoot = p.caseMerkleRoot;
        p.caseMerkleRoot = newRoot;
        p.lastUpdated = block.timestamp;

        emit CaseMerkleRootUpdated(agent, oldRoot, newRoot, block.timestamp);
    }

    /**
     * @notice 增加败诉案件数
     * @param agent Agent地址
     */
    function incrementLostCases(address agent) external onlyAdmin onlyPassportHolder(agent) {
        Passport storage p = passports[agent];
        p.lostCaseCount++;
        p.totalCaseCount++;
        p.lastUpdated = block.timestamp;

        // Auto-update credit score
        uint256 oldScore = p.creditScore;
        uint256 newScore = _calculateCreditScore(p.totalCaseCount, p.lostCaseCount);
        p.creditScore = newScore;

        emit LostCaseIncremented(agent, p.lostCaseCount, p.totalCaseCount, block.timestamp);
        emit CreditScoreUpdated(agent, oldScore, newScore, block.timestamp);
    }

    /**
     * @notice 撤销通行证
     * @param agent Agent地址
     */
    function revokePassport(address agent) external onlyAdmin onlyPassportHolder(agent) {
        Passport storage p = passports[agent];
        p.active = false;
        p.lastUpdated = block.timestamp;

        emit PassportRevoked(agent, block.timestamp);
    }

    // =============== View Functions ===============

    /**
     * @notice 获取通行证信息
     */
    function getPassport(address agent) external view returns (
        uint256 phiValue,
        uint256 creditScore,
        bytes32 caseMerkleRoot,
        uint256 lostCaseCount,
        uint256 totalCaseCount,
        uint256 issuedAt,
        uint256 lastUpdated,
        bool active
    ) {
        require(hasPassport[agent], "AgentPassport: no passport");
        Passport storage p = passports[agent];
        return (
            p.phiValue,
            p.creditScore,
            p.caseMerkleRoot,
            p.lostCaseCount,
            p.totalCaseCount,
            p.issuedAt,
            p.lastUpdated,
            p.active
        );
    }

    /**
     * @notice 获取案件Merkle根
     */
    function getPassportMerkleRoot(address agent) external view returns (bytes32) {
        require(hasPassport[agent], "AgentPassport: no passport");
        return passports[agent].caseMerkleRoot;
    }

    /**
     * @notice 计算信用分（纯view函数，不影响状态）
     */
    function calculateCreditScore(uint256 totalCases, uint256 lostCases) external view returns (uint256) {
        return _calculateCreditScore(totalCases, lostCases);
    }

    // =============== Internal Functions ===============

    /**
     * @dev 计算信用分: baseScore + totalCases*creditPerCase - lostCases*creditLostPerCase
     *      结果钳制在 [minCreditScore, maxCreditScore] 范围
     */
    function _calculateCreditScore(uint256 totalCases, uint256 lostCases) internal view returns (uint256) {
        uint256 addition = baseCreditScore + totalCases * creditPerCase;
        uint256 deduction = lostCases * creditLostPerCase;

        if (deduction > addition) {
            return minCreditScore;
        }

        uint256 score = addition - deduction;
        if (score > maxCreditScore) {
            return maxCreditScore;
        }
        return score;
    }

    // =============== Admin Functions ===============

    function setBaseCreditScore(uint256 score) external onlyAdmin {
        baseCreditScore = score;
    }

    function setCreditParams(uint256 perCase, uint256 lostPerCase) external onlyAdmin {
        creditPerCase = perCase;
        creditLostPerCase = lostPerCase;
    }

    function setNegativeCaseBook(address _negativeCaseBook) external onlyOwner {
        negativeCaseBook = _negativeCaseBook;
    }

    function setPhiStaking(address _phiStaking) external onlyOwner {
        phiStaking = _phiStaking;
    }

    function setConstitutionCourt(address _constitutionCourt) external onlyOwner {
        constitutionCourt = _constitutionCourt;
    }

    function addAdmin(address _admin) external onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }
}
