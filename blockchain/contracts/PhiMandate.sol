// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PhiMandate
 * @dev AEON AP2-inspired Digital Mandate System for AI Agent Authorization
 *
 * Inspired by AEON's AP2 (Agent Payment Protocol), enhanced with Φ-weight:
 *
 * Three Mandate Types (mirrors AP2's Intent/Cart/Payment):
 * 1. IntentMandate: AI autonomous decision ("buy tickets, budget <= 500")
 * 2. CartMandate: User-confirmed transaction (exact items & prices)
 * 3. PaymentMandate: Dispute resolution & risk control
 *
 * Φ Enhancements over AP2:
 * - Φ-weighted authorization limits (higher Φ = larger autonomous budget)
 * - Φ-phase-aware expiry (phase discontinuity triggers early revocation)
 * - Φ-verified mandate chain (Intent → Cart → Payment flow verified by Φ)
 *
 * Lifecycle: PENDING → ACTIVE → REVOKED/EXPIRED/EXECUTED
 */
contract PhiMandate is Ownable, Pausable, ReentrancyGuard {

    // =============== Enums ===============

    enum MandateType { INTENT, CART, PAYMENT }
    enum MandateStatus { PENDING, ACTIVE, REVOKED, EXPIRED, EXECUTED }

    // =============== Structs ===============

    struct Mandate {
        uint256 mandateId;
        MandateType mandateType;
        MandateStatus status;
        address delegator;        // Who delegates authority
        address delegate;         // AI Agent receiving authority
        uint256 budgetLimit;      // Max spending amount (in token units)
        uint256 spentAmount;      // Amount already spent
        address paymentToken;     // Token address for payment
        uint256 phiScoreRequired; // Min Φ score for delegate
        uint256 phiScoreAtCreation; // Φ score of delegate at mandate creation
        uint256 createdAt;
        uint256 expiresAt;
        string conditions;        // JSON-encoded conditions
        bytes32 parentMandateId;  // For chain: Intent → Cart → Payment
        bool phiPhaseContinuous;  // Φ phase continuity flag
    }

    // =============== State Variables ===============

    uint256 private s_nextMandateId;

    mapping(uint256 => Mandate) private s_mandates;
    mapping(address => uint256[]) private s_delegatorMandates;
    mapping(address => uint256[]) private s_delegateMandates;

    // Φ-weight parameters
    uint256 public constant MAX_PHI = 10000;
    uint256 public phiBudgetMultiplier;      // Φ budget multiplier (default 150 = 1.5x per 0.1 Φ)
    uint256 public baseBudgetLimit;          // Base budget without Φ (default 1000 units)
    uint256 public phaseDiscontinuityPenalty; // Budget penalty for phase discontinuity (default 20%)

    // Agent Φ scores (managed by oracle)
    mapping(address => uint256) private s_agentPhiScores;

    // =============== Events ===============

    event MandateCreated(
        uint256 indexed mandateId,
        MandateType mandateType,
        address indexed delegator,
        address indexed delegate,
        uint256 budgetLimit,
        uint256 phiScoreRequired
    );
    event MandateActivated(uint256 indexed mandateId, uint256 timestamp);
    event MandateRevoked(uint256 indexed mandateId, address indexed revoker, string reason);
    event MandateExecuted(uint256 indexed mandateId, uint256 amount, uint256 remaining);
    event MandateExpired(uint256 indexed mandateId);
    event MandateChained(uint256 indexed childId, uint256 indexed parentId);
    event AgentPhiUpdated(address indexed agent, uint256 oldScore, uint256 newScore);

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {
        s_nextMandateId = 1;
        phiBudgetMultiplier = 150;     // 1.5x per 0.1 Φ
        baseBudgetLimit = 1000;       // 1000 token units base
        phaseDiscontinuityPenalty = 2000; // 20% penalty
    }

    // =============== Mandate Creation ===============

    /**
     * @notice Create an Intent Mandate (AI autonomous decision)
     * @param delegate AI Agent address
     * @param budgetLimit Maximum spending amount
     * @param paymentToken Token for payment
     * @param phiScoreRequired Minimum Φ score required
     * @param expiresAt Expiration timestamp
     * @param conditions JSON-encoded conditions
     */
    function createIntentMandate(
        address delegate,
        uint256 budgetLimit,
        address paymentToken,
        uint256 phiScoreRequired,
        uint256 expiresAt,
        string calldata conditions
    ) external whenNotPaused returns (uint256 mandateId) {
        require(delegate != address(0), "Invalid delegate");
        require(budgetLimit > 0, "Invalid budget");
        require(expiresAt > block.timestamp, "Invalid expiry");

        // Φ-weighted budget: effective budget = baseBudget + phiScore * phiBudgetMultiplier * budgetLimit / MAX_PHI
        uint256 delegatePhi = s_agentPhiScores[delegate];
        require(delegatePhi >= phiScoreRequired, "Delegate Phi too low");

        mandateId = s_nextMandateId++;

        s_mandates[mandateId] = Mandate({
            mandateId: mandateId,
            mandateType: MandateType.INTENT,
            status: MandateStatus.PENDING,
            delegator: msg.sender,
            delegate: delegate,
            budgetLimit: budgetLimit,
            spentAmount: 0,
            paymentToken: paymentToken,
            phiScoreRequired: phiScoreRequired,
            phiScoreAtCreation: delegatePhi,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            conditions: conditions,
            parentMandateId: bytes32(0),
            phiPhaseContinuous: true
        });

        s_delegatorMandates[msg.sender].push(mandateId);
        s_delegateMandates[delegate].push(mandateId);

        emit MandateCreated(mandateId, MandateType.INTENT, msg.sender, delegate, budgetLimit, phiScoreRequired);
    }

    /**
     * @notice Create a Cart Mandate (user-confirmed transaction)
     * @param delegate AI Agent address
     * @param budgetLimit Exact spending amount
     * @param paymentToken Token for payment
     * @param parentMandateId Parent Intent Mandate ID (0 = standalone)
     * @param expiresAt Expiration timestamp
     * @param conditions JSON-encoded items & prices
     */
    function createCartMandate(
        address delegate,
        uint256 budgetLimit,
        address paymentToken,
        uint256 parentMandateId,
        uint256 expiresAt,
        string calldata conditions
    ) external whenNotPaused returns (uint256 mandateId) {
        require(delegate != address(0), "Invalid delegate");
        require(budgetLimit > 0, "Invalid budget");
        require(expiresAt > block.timestamp, "Invalid expiry");

        // If chained to Intent, verify parent
        if (parentMandateId > 0) {
            require(s_mandates[parentMandateId].mandateType == MandateType.INTENT, "Parent must be Intent");
            require(s_mandates[parentMandateId].status == MandateStatus.ACTIVE, "Parent not active");
            require(s_mandates[parentMandateId].delegate == delegate, "Delegate mismatch");
            require(s_mandates[parentMandateId].budgetLimit >= budgetLimit, "Exceeds parent budget");
        }

        mandateId = s_nextMandateId++;

        s_mandates[mandateId] = Mandate({
            mandateId: mandateId,
            mandateType: MandateType.CART,
            status: MandateStatus.PENDING,
            delegator: msg.sender,
            delegate: delegate,
            budgetLimit: budgetLimit,
            spentAmount: 0,
            paymentToken: paymentToken,
            phiScoreRequired: 0,
            phiScoreAtCreation: s_agentPhiScores[delegate],
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            conditions: conditions,
            parentMandateId: bytes32(uint256(parentMandateId)),
            phiPhaseContinuous: true
        });

        s_delegatorMandates[msg.sender].push(mandateId);
        s_delegateMandates[delegate].push(mandateId);

        if (parentMandateId > 0) {
            emit MandateChained(mandateId, parentMandateId);
        }

        emit MandateCreated(mandateId, MandateType.CART, msg.sender, delegate, budgetLimit, 0);
    }

    /**
     * @notice Create a Payment Mandate (dispute resolution / risk control)
     * @param delegate AI Agent address
     * @param budgetLimit Payment amount
     * @param paymentToken Token for payment
     * @param parentMandateId Parent Cart Mandate ID
     * @param expiresAt Expiration timestamp
     * @param conditions Payment conditions & dispute terms
     */
    function createPaymentMandate(
        address delegate,
        uint256 budgetLimit,
        address paymentToken,
        uint256 parentMandateId,
        uint256 expiresAt,
        string calldata conditions
    ) external whenNotPaused returns (uint256 mandateId) {
        require(delegate != address(0), "Invalid delegate");
        require(budgetLimit > 0, "Invalid budget");
        require(parentMandateId > 0, "Payment must chain to Cart");
        require(s_mandates[parentMandateId].mandateType == MandateType.CART, "Parent must be Cart");
        require(s_mandates[parentMandateId].status == MandateStatus.ACTIVE, "Parent not active");
        require(s_mandates[parentMandateId].delegate == delegate, "Delegate mismatch");
        require(expiresAt > block.timestamp, "Invalid expiry");

        mandateId = s_nextMandateId++;

        s_mandates[mandateId] = Mandate({
            mandateId: mandateId,
            mandateType: MandateType.PAYMENT,
            status: MandateStatus.PENDING,
            delegator: msg.sender,
            delegate: delegate,
            budgetLimit: budgetLimit,
            spentAmount: 0,
            paymentToken: paymentToken,
            phiScoreRequired: 0,
            phiScoreAtCreation: s_agentPhiScores[delegate],
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            conditions: conditions,
            parentMandateId: bytes32(uint256(parentMandateId)),
            phiPhaseContinuous: true
        });

        s_delegatorMandates[msg.sender].push(mandateId);
        s_delegateMandates[delegate].push(mandateId);

        emit MandateChained(mandateId, parentMandateId);
        emit MandateCreated(mandateId, MandateType.PAYMENT, msg.sender, delegate, budgetLimit, 0);
    }

    // =============== Mandate Lifecycle ===============

    /**
     * @notice Activate a pending mandate (delegator confirms)
     * @param mandateId Mandate ID
     */
    function activateMandate(uint256 mandateId) external whenNotPaused {
        Mandate storage m = s_mandates[mandateId];
        require(m.delegator == msg.sender, "Not delegator");
        require(m.status == MandateStatus.PENDING, "Not pending");

        // Φ phase continuity check
        uint256 currentPhi = s_agentPhiScores[m.delegate];
        if (currentPhi < m.phiScoreAtCreation && m.mandateType == MandateType.INTENT) {
            // Φ dropped: reduce budget proportionally
            uint256 reduction = (m.budgetLimit * (m.phiScoreAtCreation - currentPhi)) / MAX_PHI;
            m.budgetLimit -= reduction;
            m.phiPhaseContinuous = false;
        }

        m.status = MandateStatus.ACTIVE;
        emit MandateActivated(mandateId, block.timestamp);
    }

    /**
     * @notice Execute spending under an active mandate
     * @param mandateId Mandate ID
     * @param amount Amount to spend
     */
    function executeMandate(uint256 mandateId, uint256 amount) external whenNotPaused {
        Mandate storage m = s_mandates[mandateId];
        require(m.delegate == msg.sender || m.delegator == msg.sender, "Not authorized");
        require(m.status == MandateStatus.ACTIVE, "Not active");
        require(block.timestamp < m.expiresAt, "Mandate expired");
        require(m.spentAmount + amount <= m.budgetLimit, "Exceeds budget");

        m.spentAmount += amount;

        if (m.spentAmount >= m.budgetLimit) {
            m.status = MandateStatus.EXECUTED;
        }

        emit MandateExecuted(mandateId, amount, m.budgetLimit - m.spentAmount);
    }

    /**
     * @notice Revoke an active mandate
     * @param mandateId Mandate ID
     * @param reason Revocation reason
     */
    function revokeMandate(uint256 mandateId, string calldata reason) external {
        Mandate storage m = s_mandates[mandateId];
        require(m.delegator == msg.sender || msg.sender == owner(), "Not authorized");
        require(m.status == MandateStatus.ACTIVE || m.status == MandateStatus.PENDING, "Cannot revoke");

        m.status = MandateStatus.REVOKED;
        emit MandateRevoked(mandateId, msg.sender, reason);
    }

    /**
     * @notice Check and expire mandates past their expiry
     * @param mandateId Mandate ID
     */
    function checkExpiry(uint256 mandateId) external {
        Mandate storage m = s_mandates[mandateId];
        if (m.status == MandateStatus.ACTIVE && block.timestamp >= m.expiresAt) {
            m.status = MandateStatus.EXPIRED;
            emit MandateExpired(mandateId);
        }
    }

    // =============== Φ Management ===============

    /**
     * @notice Update agent's Φ score (owner/oracle only)
     * @param agent Agent address
     * @param newScore New Φ score
     */
    function updateAgentPhiScore(address agent, uint256 newScore) external onlyOwner {
        require(newScore <= MAX_PHI, "Invalid Phi score");
        uint256 oldScore = s_agentPhiScores[agent];
        s_agentPhiScores[agent] = newScore;
        emit AgentPhiUpdated(agent, oldScore, newScore);

        // Auto-revoke Intent mandates if Φ drops below required
        uint256[] storage mandates = s_delegateMandates[agent];
        for (uint256 i = 0; i < mandates.length; i++) {
            Mandate storage m = s_mandates[mandates[i]];
            if (m.status == MandateStatus.ACTIVE &&
                m.mandateType == MandateType.INTENT &&
                newScore < m.phiScoreRequired) {
                m.status = MandateStatus.REVOKED;
                m.phiPhaseContinuous = false;
                emit MandateRevoked(mandates[i], agent, "Phi score dropped below required");
            }
        }
    }

    /**
     * @notice Calculate Φ-weighted budget for an agent
     * @param agent Agent address
     * @return effectiveBudget Φ-adjusted budget
     */
    function calculatePhiBudget(address agent) external view returns (uint256 effectiveBudget) {
        uint256 phiScore = s_agentPhiScores[agent];
        // Budget = baseBudget * (1 + phiScore/MAX_PHI * phiBudgetMultiplier/100)
        effectiveBudget = baseBudgetLimit + (baseBudgetLimit * phiScore * phiBudgetMultiplier) / (MAX_PHI * 100);
    }

    // =============== View Functions ===============

    function getMandate(uint256 mandateId) external view returns (
        MandateType mandateType,
        MandateStatus status,
        address delegator,
        address delegate,
        uint256 budgetLimit,
        uint256 spentAmount,
        address paymentToken,
        uint256 phiScoreRequired,
        uint256 createdAt,
        uint256 expiresAt,
        bool phiPhaseContinuous
    ) {
        Mandate storage m = s_mandates[mandateId];
        return (
            m.mandateType, m.status, m.delegator, m.delegate,
            m.budgetLimit, m.spentAmount, m.paymentToken,
            m.phiScoreRequired, m.createdAt, m.expiresAt, m.phiPhaseContinuous
        );
    }

    function getDelegatorMandates(address delegator) external view returns (uint256[] memory) {
        return s_delegatorMandates[delegator];
    }

    function getDelegateMandates(address delegate) external view returns (uint256[] memory) {
        return s_delegateMandates[delegate];
    }

    function getAgentPhiScore(address agent) external view returns (uint256) {
        return s_agentPhiScores[agent];
    }

    function totalMandates() external view returns (uint256) {
        return s_nextMandateId - 1;
    }

    // =============== Admin ===============

    function setPhiBudgetMultiplier(uint256 newMultiplier) external onlyOwner {
        phiBudgetMultiplier = newMultiplier;
    }

    function setBaseBudgetLimit(uint256 newLimit) external onlyOwner {
        baseBudgetLimit = newLimit;
    }

    function setPhaseDiscontinuityPenalty(uint256 newPenalty) external onlyOwner {
        require(newPenalty <= 10000, "Invalid penalty");
        phaseDiscontinuityPenalty = newPenalty;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
