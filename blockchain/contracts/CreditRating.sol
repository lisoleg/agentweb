// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CreditRating
 * @notice V12.5 可信零知识信用证明体系 — 五维度评分+七级等级+推理链+联动
 * @dev 6GNetGPT"模型可信/可解释+数据隐私"思想融合 + GSD-Coin锚定层
 *      五维度: Φ贡献(25%) + 法院参与(20%) + 劳动市场(25%) + 中继贡献(15%) + GC健康度(15%)
 *      七级: AAA/AA/A/BBB/BB/B/CCC
 *      联动: 费率(AAA×0.7~CCC×1.5) + 权限(BBB+紧急投票) + 担保(A+可担保)
 *      衰减: 每30天-100，活跃参与可恢复
 *      GC维度: 余额/收入稳定性/消费健康度 (来自GCAncor锚定层)
 */
contract CreditRating is Ownable, Pausable {

    // =============== Enums ===============

    enum CreditGrade { AAA, AA, A, BBB, BB, B, CCC }

    // =============== Structs ===============

    struct CreditDimensions {
        uint256 phiScore;       // Φ值维度 (权重25%) 0-10000
        uint256 courtScore;     // 法院参与维度 (权重20%) 0-10000
        uint256 laborScore;     // 劳动市场维度 (权重25%) 0-10000
        uint256 relayScore;     // 中继贡献维度 (权重15%) 0-10000
        uint256 gcScore;        // GC健康度维度 (权重15%) 0-10000 — V12.5新增
    }

    struct RatingProof {
        uint256 oldScore;
        uint256 newScore;
        uint256 phiContribution;
        uint256 courtContribution;
        uint256 laborContribution;
        uint256 relayContribution;
        uint256 gcContribution;
        uint256 penaltyContribution;
        bytes32 evidenceRoot;
        uint256 timestamp;
    }

    struct AgentCredit {
        uint256 totalScore;         // 0-10000
        CreditGrade grade;
        CreditDimensions dimensions;
        uint256 lastUpdated;
        uint256 decayRate;          // 每30天衰减量（默认100）
    }

    // =============== Constants ===============

    uint256 public constant DECAY_INTERVAL = 30 days;
    uint256 public constant PHI_WEIGHT = 2500;     // 25% (was 30%)
    uint256 public constant COURT_WEIGHT = 2000;   // 20% (was 25%)
    uint256 public constant LABOR_WEIGHT = 2500;   // 25%
    uint256 public constant RELAY_WEIGHT = 1500;   // 15% (was 20%)
    uint256 public constant GC_WEIGHT = 1500;     // 15% — V12.5新增

    // =============== State Variables ===============

    /// @notice PhiStaking合约地址
    address public phiStaking;

    /// @notice ConstitutionCourt合约地址
    address public constitutionCourt;

    /// @notice AILaborMarket合约地址
    address public laborMarket;

    /// @notice RelayRegistry合约地址
    address public relayRegistry;

    /// @notice GCAncor合约地址 — V12.5新增
    address public gcAncor;

    /// @notice agent => AgentCredit
    mapping(address => AgentCredit) public agentCredits;

    /// @notice agent => RatingProof (最近一次)
    mapping(address => RatingProof) public ratingProofs;

    /// @notice 管理员
    mapping(address => bool) public admins;

    /// @notice 默认衰减率
    uint256 public defaultDecayRate;

    // =============== Events ===============

    event CreditUpdated(address indexed agent, uint256 oldScore, uint256 newScore, CreditGrade grade);
    event GradeChanged(address indexed agent, CreditGrade oldGrade, CreditGrade newGrade);
    event DecayApplied(address indexed agent, uint256 decayedAmount, uint256 newScore);

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "CreditRating: not admin");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _phiStaking,
        address _constitutionCourt,
        address _laborMarket,
        address _relayRegistry
    ) Ownable(msg.sender) {
        phiStaking = _phiStaking;
        constitutionCourt = _constitutionCourt;
        laborMarket = _laborMarket;
        relayRegistry = _relayRegistry;
        defaultDecayRate = 100;
        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 更新Agent信用评分
     * @param agent Agent地址
     * @param dims 四维度分数
     * @param evidenceRoot 证据Merkle根
     */
    function updateCreditScore(
        address agent,
        CreditDimensions calldata dims,
        bytes32 evidenceRoot
    ) external onlyAdmin {
        require(dims.phiScore <= 10000, "CreditRating: phiScore overflow");
        require(dims.courtScore <= 10000, "CreditRating: courtScore overflow");
        require(dims.laborScore <= 10000, "CreditRating: laborScore overflow");
        require(dims.relayScore <= 10000, "CreditRating: relayScore overflow");
        require(dims.gcScore <= 10000, "CreditRating: gcScore overflow");

        AgentCredit storage credit = agentCredits[agent];
        uint256 oldScore = credit.totalScore;
        CreditGrade oldGrade = credit.grade;

        // 五维度加权计算总分
        uint256 newScore = (
            dims.phiScore * PHI_WEIGHT +
            dims.courtScore * COURT_WEIGHT +
            dims.laborScore * LABOR_WEIGHT +
            dims.relayScore * RELAY_WEIGHT +
            dims.gcScore * GC_WEIGHT
        ) / 10000;

        // 计算各维度贡献值
        uint256 phiContrib = dims.phiScore * PHI_WEIGHT / 10000;
        uint256 courtContrib = dims.courtScore * COURT_WEIGHT / 10000;
        uint256 laborContrib = dims.laborScore * LABOR_WEIGHT / 10000;
        uint256 relayContrib = dims.relayScore * RELAY_WEIGHT / 10000;
        uint256 gcContrib = dims.gcScore * GC_WEIGHT / 10000;

        // 更新信用数据
        credit.totalScore = newScore;
        credit.dimensions = dims;
        credit.grade = _scoreToGrade(newScore);
        credit.lastUpdated = block.timestamp;
        if (credit.decayRate == 0) {
            credit.decayRate = defaultDecayRate;
        }

        // 生成RatingProof
        ratingProofs[agent] = RatingProof({
            oldScore: oldScore,
            newScore: newScore,
            phiContribution: phiContrib,
            courtContribution: courtContrib,
            laborContribution: laborContrib,
            relayContribution: relayContrib,
            gcContribution: gcContrib,
            penaltyContribution: 0,
            evidenceRoot: evidenceRoot,
            timestamp: block.timestamp
        });

        emit CreditUpdated(agent, oldScore, newScore, credit.grade);
        if (oldGrade != credit.grade) {
            emit GradeChanged(agent, oldGrade, credit.grade);
        }
    }

    /**
     * @notice 应用信用衰减
     * @param agent Agent地址
     */
    function applyDecay(address agent) external whenNotPaused {
        AgentCredit storage credit = agentCredits[agent];
        require(credit.totalScore > 0, "CreditRating: no credit");
        require(
            block.timestamp >= credit.lastUpdated + DECAY_INTERVAL,
            "CreditRating: not yet decay time"
        );

        uint256 elapsed = block.timestamp - credit.lastUpdated;
        uint256 periods = elapsed / DECAY_INTERVAL;
        uint256 decayAmount = periods * credit.decayRate;

        CreditGrade oldGrade = credit.grade;

        if (decayAmount >= credit.totalScore) {
            credit.totalScore = 0;
        } else {
            credit.totalScore -= decayAmount;
        }

        credit.grade = _scoreToGrade(credit.totalScore);
        credit.lastUpdated = block.timestamp;

        emit DecayApplied(agent, decayAmount, credit.totalScore);
        if (oldGrade != credit.grade) {
            emit GradeChanged(agent, oldGrade, credit.grade);
        }
    }

    // =============== View Functions ===============

    /**
     * @notice 获取信用等级
     */
    function getCreditGrade(address agent) external view returns (uint8) {
        return uint8(agentCredits[agent].grade);
    }

    /**
     * @notice 获取信用总分
     */
    function getCreditScore(address agent) external view returns (uint256) {
        return agentCredits[agent].totalScore;
    }

    /**
     * @notice 获取评级推理链
     */
    function getRatingProof(address agent) external view returns (
        uint256 oldScore,
        uint256 newScore,
        uint256 phiContribution,
        uint256 courtContribution,
        uint256 laborContribution,
        uint256 relayContribution,
        uint256 gcContribution,
        uint256 penaltyContribution,
        bytes32 evidenceRoot,
        uint256 timestamp
    ) {
        RatingProof storage proof = ratingProofs[agent];
        return (
            proof.oldScore,
            proof.newScore,
            proof.phiContribution,
            proof.courtContribution,
            proof.laborContribution,
            proof.relayContribution,
            proof.gcContribution,
            proof.penaltyContribution,
            proof.evidenceRoot,
            proof.timestamp
        );
    }

    /**
     * @notice 获取费率乘数（联动：AAA→7000, AA→8000, ..., CCC→15000 基点）
     */
    function getFeeMultiplier(address agent) external view returns (uint256) {
        CreditGrade grade = agentCredits[agent].grade;
        if (grade == CreditGrade.AAA) return 7000;
        if (grade == CreditGrade.AA) return 8000;
        if (grade == CreditGrade.A) return 9000;
        if (grade == CreditGrade.BBB) return 10000;
        if (grade == CreditGrade.BB) return 12000;
        if (grade == CreditGrade.B) return 14000;
        return 15000; // CCC
    }

    /**
     * @notice BBB以上可投紧急案件
     */
    function canVoteEmergency(address agent) external view returns (bool) {
        CreditGrade grade = agentCredits[agent].grade;
        return uint8(grade) <= uint8(CreditGrade.BBB);
    }

    /**
     * @notice A以上可为新Agent担保
     */
    function canVouch(address agent) external view returns (bool) {
        CreditGrade grade = agentCredits[agent].grade;
        return uint8(grade) <= uint8(CreditGrade.A);
    }

    /**
     * @notice 获取完整信用信息
     */
    function getFullCredit(address agent) external view returns (
        uint256 totalScore,
        uint8 grade,
        uint256 phiScore,
        uint256 courtScore,
        uint256 laborScore,
        uint256 relayScore,
        uint256 gcScore,
        uint256 lastUpdated,
        uint256 decayRate
    ) {
        AgentCredit storage credit = agentCredits[agent];
        return (
            credit.totalScore,
            uint8(credit.grade),
            credit.dimensions.phiScore,
            credit.dimensions.courtScore,
            credit.dimensions.laborScore,
            credit.dimensions.relayScore,
            credit.dimensions.gcScore,
            credit.lastUpdated,
            credit.decayRate
        );
    }

    /**
     * @notice 分数到等级映射（纯函数）
     */
    function scoreToGrade(uint256 score) external pure returns (CreditGrade) {
        return _scoreToGrade(score);
    }

    // =============== Internal Functions ===============

    function _scoreToGrade(uint256 score) internal pure returns (CreditGrade) {
        if (score >= 9000) return CreditGrade.AAA;
        if (score >= 8000) return CreditGrade.AA;
        if (score >= 7000) return CreditGrade.A;
        if (score >= 6000) return CreditGrade.BBB;
        if (score >= 4000) return CreditGrade.BB;
        if (score >= 2000) return CreditGrade.B;
        return CreditGrade.CCC;
    }

    // =============== Admin Functions ===============

    function setDecayRate(address agent, uint256 rate) external onlyAdmin {
        require(rate <= 1000, "CreditRating: rate too high");
        agentCredits[agent].decayRate = rate;
    }

    function setDefaultDecayRate(uint256 rate) external onlyAdmin {
        require(rate <= 1000, "CreditRating: rate too high");
        defaultDecayRate = rate;
    }

    function setPhiStaking(address _phiStaking) external onlyOwner {
        phiStaking = _phiStaking;
    }

    function setConstitutionCourt(address _court) external onlyOwner {
        constitutionCourt = _court;
    }

    function setLaborMarket(address _laborMarket) external onlyOwner {
        laborMarket = _laborMarket;
    }

    function setRelayRegistry(address _relayRegistry) external onlyOwner {
        relayRegistry = _relayRegistry;
    }

    function setGcAncor(address _gcAncor) external onlyOwner {
        gcAncor = _gcAncor;
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
