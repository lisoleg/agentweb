// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title PhiAgentNFT
 * @dev ERC-8004 inspired Agent Identity NFT with Three Registries
 *
 * Inspired by AEON's ERC-8004 standard, enhanced with Φ-value:
 *
 * Three Registries:
 * 1. Identity Registry: ERC-721 + URIStorage NFT identity
 * 2. PhiReputation Registry: Φ-weighted feedback & scoring
 * 3. PhiValidation Registry: Verification with staking/zkML/TEE proofs
 *
 * Φ Enhancements over ERC-8004:
 * - Reputation weighted by Φ value (higher Φ = more trusted feedback)
 * - Validation tied to Φ phase continuity (phase-aware verification)
 * - Agent wallet bound to Φ resonance score
 */
contract PhiAgentNFT is ERC721, ERC721URIStorage, Ownable, Pausable, ReentrancyGuard {

    // =============== Structs ===============

    struct AgentMeta {
        uint256 agentId;           // NFT tokenId
        address owner;            // NFT holder
        address agentWallet;      // Operational wallet (separate from NFT holder)
        uint256 phiScore;         // Φ value (0-10000, 2 decimals)
        int256 phiPhase;          // Φ phase angle (-3141593 to 3141593)
        uint256 registeredAt;
        bool active;
    }

    struct Feedback {
        address client;           // Feedback submitter
        int128 value;             // Score (e.g., 0-100)
        uint8 valueDecimals;      // Decimal places (0-18)
        string tag1;              // Primary category (e.g., "accuracy", "uptime")
        string tag2;              // Sub-category (optional)
        bool revoked;
        uint64 feedbackIndex;
    }

    struct Validation {
        address validator;        // Validator address
        uint256 agentId;          // Target agent
        bytes32 requestHash;      // Request identifier
        uint8 responseType;       // 0=StakeReExec, 1=ZkML, 2=TEE, 3=Arbiter
        uint8 result;             // 0-100 (0=fail, 100=pass)
        bytes32 responseHash;     // Evidence hash
        string tag;               // Custom classification
        uint256 timestamp;
    }

    // =============== State Variables ===============

    uint256 private s_nextAgentId;

    // Agent identity
    mapping(uint256 => AgentMeta) private s_agents;

    // Reputation: agentId => client => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => uint64)) private s_clientFeedbackCount;
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) private s_feedbacks;
    mapping(uint256 => address[]) private s_agentClients;

    // Validation: requestHash => Validation
    mapping(bytes32 => Validation) private s_validations;
    mapping(uint256 => bytes32[]) private s_agentValidations;
    mapping(address => bytes32[]) private s_validatorRequests;

    // Φ-weight parameters
    uint256 public constant MAX_PHI = 10000;
    uint256 public reputationPhiWeight;     // Φ weight in reputation (0-10000, default 3000 = 30%)
    uint256 public validationPhiThreshold;  // Min Φ for validator (default 5000 = 0.50)

    /// @notice V10.0: NegativeCaseBook合约地址
    address public negativeCaseBook;

    // =============== Events ===============

    // Identity
    event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI, uint256 timestamp);
    event AgentURIUpdated(uint256 indexed agentId, string newURI, address updatedBy);
    event AgentWalletSet(uint256 indexed agentId, address newWallet);
    event AgentWalletCleared(uint256 indexed agentId);
    event PhiScoreUpdated(uint256 indexed agentId, uint256 oldScore, uint256 newScore);
    event PhiPhaseUpdated(uint256 indexed agentId, int256 oldPhase, int256 newPhase);

    // Reputation
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string tag1,
        string tag2
    );
    event FeedbackRevoked(uint256 indexed agentId, address indexed client, uint64 feedbackIndex);
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed client,
        uint64 feedbackIndex,
        address indexed responder,
        string responseURI,
        bytes32 responseHash
    );

    // Validation
    event ValidationRequested(
        address indexed validator,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        string requestURI,
        bytes32 requestHash2
    );
    event ValidationResponded(
        address indexed validator,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 responseType,
        uint8 result,
        string tag
    );

    // =============== Constructor ===============

    constructor() ERC721("PhiAgentNFT", "PHIAG") Ownable(msg.sender) {
        s_nextAgentId = 1;
        reputationPhiWeight = 3000;    // 30% Φ weight
        validationPhiThreshold = 5000; // Φ ≥ 0.50 to be validator
    }

    // =============== Identity Registry ===============

    /**
     * @notice Register a new Agent, minting an NFT
     * @param agentURI URI pointing to agent registration file (IPFS/HTTPS/base64)
     * @return agentId The newly minted agent ID
     */
    function register(string calldata agentURI) external whenNotPaused returns (uint256 agentId) {
        agentId = s_nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        s_agents[agentId] = AgentMeta({
            agentId: agentId,
            owner: msg.sender,
            agentWallet: msg.sender,   // Default wallet = NFT holder
            phiScore: 0,
            phiPhase: 0,
            registeredAt: block.timestamp,
            active: true
        });

        // V10.0: 强制学习所有必学反面案例
        if (negativeCaseBook != address(0)) {
            INegativeCaseBook(negativeCaseBook).mandatoryLearnAll(msg.sender);
        }

        emit AgentRegistered(agentId, msg.sender, agentURI, block.timestamp);
    }

    /**
     * @notice Update agent URI
     * @param agentId Agent ID
     * @param newURI New registration file URI
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit AgentURIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Set agent operational wallet
     * @param agentId Agent ID
     * @param newWallet New operational wallet address
     */
    function setAgentWallet(uint256 agentId, address newWallet) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        require(newWallet != address(0), "Invalid wallet");
        s_agents[agentId].agentWallet = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    /**
     * @notice Update agent Φ score (owner only)
     * @param agentId Agent ID
     * @param newScore New Φ score (0-10000)
     */
    function updatePhiScore(uint256 agentId, uint256 newScore) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent not found");
        require(newScore <= MAX_PHI, "Invalid Phi score");
        uint256 oldScore = s_agents[agentId].phiScore;
        s_agents[agentId].phiScore = newScore;
        emit PhiScoreUpdated(agentId, oldScore, newScore);
    }

    /**
     * @notice Update agent Φ phase (owner only)
     * @param agentId Agent ID
     * @param newPhase New Φ phase (-3141593 to 3141593)
     */
    function updatePhiPhase(uint256 agentId, int256 newPhase) external onlyOwner {
        require(_ownerOf(agentId) != address(0), "Agent not found");
        require(newPhase >= -3141593 && newPhase <= 3141593, "Invalid Phi phase");
        int256 oldPhase = s_agents[agentId].phiPhase;
        s_agents[agentId].phiPhase = newPhase;
        emit PhiPhaseUpdated(agentId, oldPhase, newPhase);
    }

    /**
     * @notice Deactivate agent
     * @param agentId Agent ID
     */
    function deactivateAgent(uint256 agentId) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        s_agents[agentId].active = false;
    }

    // On transfer, clear agentWallet (safety measure from ERC-8004)
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            // Transfer (not mint/burn) - clear wallet for safety
            s_agents[tokenId].agentWallet = address(0);
            s_agents[tokenId].owner = to;
            emit AgentWalletCleared(tokenId);
        }
        return super._update(to, tokenId, auth);
    }

    // =============== Reputation Registry ===============

    /**
     * @notice Give feedback to an agent
     * @param agentId Target agent
     * @param value Score value
     * @param valueDecimals Decimal places (0-18)
     * @param tag1 Primary category
     * @param tag2 Sub-category
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2
    ) external whenNotPaused {
        require(_ownerOf(agentId) != address(0), "Agent not found");
        require(valueDecimals <= 18, "Invalid decimals");
        require(msg.sender != ownerOf(agentId), "Cannot feedback own agent");

        uint64 feedbackIndex = s_clientFeedbackCount[agentId][msg.sender];

        s_feedbacks[agentId][msg.sender][feedbackIndex] = Feedback({
            client: msg.sender,
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            revoked: false,
            feedbackIndex: feedbackIndex
        });

        // Track client if first feedback
        if (feedbackIndex == 0) {
            s_agentClients[agentId].push(msg.sender);
        }

        s_clientFeedbackCount[agentId][msg.sender]++;

        emit FeedbackGiven(agentId, msg.sender, feedbackIndex, value, valueDecimals, tag1, tag2);
    }

    /**
     * @notice Revoke previously given feedback
     * @param agentId Agent ID
     * @param feedbackIndex Index of feedback to revoke
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage fb = s_feedbacks[agentId][msg.sender][feedbackIndex];
        require(fb.client == msg.sender, "Not your feedback");
        require(!fb.revoked, "Already revoked");

        fb.revoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Append response to a feedback (Agent or third party)
     * @param agentId Agent ID
     * @param client Client who gave feedback
     * @param feedbackIndex Feedback index
     * @param responseURI URI of response document
     * @param responseHash Hash of response document
     */
    function appendResponse(
        uint256 agentId,
        address client,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external {
        require(_ownerOf(agentId) != address(0), "Agent not found");
        require(s_feedbacks[agentId][client][feedbackIndex].client == client, "Feedback not found");

        emit ResponseAppended(agentId, client, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    /**
     * @notice Get Φ-weighted reputation summary
     * @param agentId Agent ID
     * @param clientAddresses Trusted client addresses for Sybil resistance
     * @param tag1 Filter by tag1 (empty = all)
     * @return count Number of valid feedbacks
     * @return phiWeightedScore Φ-weighted aggregate score
     */
    function getPhiWeightedSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1
    ) external view returns (uint64 count, int128 phiWeightedScore) {
        uint256 agentPhi = s_agents[agentId].phiScore;

        int128 totalWeightedValue = 0;
        uint64 validCount = 0;

        for (uint256 i = 0; i < clientAddresses.length; i++) {
            address client = clientAddresses[i];
            uint64 totalFeedbacks = s_clientFeedbackCount[agentId][client];

            for (uint64 j = 0; j < totalFeedbacks; j++) {
                Feedback storage fb = s_feedbacks[agentId][client][j];
                if (fb.revoked) continue;
                if (bytes(tag1).length > 0 && !_stringsEqual(fb.tag1, tag1)) continue;

                // Φ-weighted: feedback value * (1 + agentPhi/MAX_PHI * reputationPhiWeight/MAX_PHI)
                // Simplified: weight = 1 + (agentPhi * reputationPhiWeight) / (MAX_PHI * MAX_PHI)
                // For int128, we scale by 10000 and divide later
                int128 weight = int128(uint128(10000 + (agentPhi * reputationPhiWeight) / 1000));
                totalWeightedValue += (fb.value * weight) / 10000;
                validCount++;
            }
        }

        return (validCount, validCount > 0 ? totalWeightedValue / int128(uint128(validCount)) : int128(0));
    }

    /**
     * @notice Read a specific feedback
     */
    function readFeedback(
        uint256 agentId,
        address client,
        uint64 feedbackIndex
    ) external view returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool revoked) {
        Feedback storage fb = s_feedbacks[agentId][client][feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.revoked);
    }

    /**
     * @notice Get agent's client list
     */
    function getAgentClients(uint256 agentId) external view returns (address[] memory) {
        return s_agentClients[agentId];
    }

    // =============== Validation Registry ===============

    /**
     * @notice Request validation for an agent
     * @param validatorAddress Address of validator
     * @param agentId Agent to validate
     * @param requestURI URI of validation request data
     * @param requestHash Hash of request data
     */
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external whenNotPaused {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        require(s_agents[agentId].phiScore >= validationPhiThreshold, "Agent Phi below threshold");

        s_validations[requestHash] = Validation({
            validator: validatorAddress,
            agentId: agentId,
            requestHash: requestHash,
            responseType: 0,
            result: 0,
            responseHash: bytes32(0),
            tag: "",
            timestamp: block.timestamp
        });

        s_agentValidations[agentId].push(requestHash);
        s_validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequested(validatorAddress, agentId, requestHash, requestURI, requestHash);
    }

    /**
     * @notice Submit validation response
     * @param requestHash Original request hash
     * @param responseType Validation type (0=StakeReExec, 1=ZkML, 2=TEE, 3=Arbiter)
     * @param result Validation result (0-100)
     * @param responseHash Hash of evidence
     * @param tag Custom classification
     */
    function validationResponse(
        bytes32 requestHash,
        uint8 responseType,
        uint8 result,
        bytes32 responseHash,
        string calldata tag
    ) external {
        Validation storage v = s_validations[requestHash];
        require(v.validator == msg.sender, "Not designated validator");
        require(v.agentId != 0, "Request not found");
        require(result <= 100, "Invalid result");

        v.responseType = responseType;
        v.result = result;
        v.responseHash = responseHash;
        v.tag = tag;
        v.timestamp = block.timestamp;

        emit ValidationResponded(msg.sender, v.agentId, requestHash, responseType, result, tag);
    }

    /**
     * @notice Get validation status
     */
    function getValidationStatus(bytes32 requestHash) external view returns (
        address validator,
        uint256 agentId,
        uint8 responseType,
        uint8 result,
        bytes32 responseHash,
        string memory tag,
        uint256 timestamp
    ) {
        Validation storage v = s_validations[requestHash];
        return (v.validator, v.agentId, v.responseType, v.result, v.responseHash, v.tag, v.timestamp);
    }

    /**
     * @notice Get Φ-phase-aware validation summary for an agent
     * @param agentId Agent ID
     * @param validatorAddresses Trusted validators
     * @param tag Filter by tag (empty = all)
     * @return count Number of validations
     * @return avgResult Average result (0-100)
     * @return phaseContinuityScore Φ phase continuity score (0-10000)
     */
    function getPhiValidationSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 avgResult, uint256 phaseContinuityScore) {
        uint256 totalResult = 0;
        uint64 validCount = 0;

        bytes32[] storage allValidations = s_agentValidations[agentId];
        for (uint256 i = 0; i < allValidations.length; i++) {
            Validation storage v = s_validations[allValidations[i]];
            if (v.result == 0 && v.timestamp > 0) continue; // Pending
            if (bytes(tag).length > 0 && !_stringsEqual(v.tag, tag)) continue;

            // Check if validator is in trusted list
            bool trusted = false;
            for (uint256 j = 0; j < validatorAddresses.length; j++) {
                if (v.validator == validatorAddresses[j]) {
                    trusted = true;
                    break;
                }
            }
            if (!trusted && validatorAddresses.length > 0) continue;

            totalResult += v.result;
            validCount++;
        }

        avgResult = validCount > 0 ? uint8(totalResult / validCount) : 0;

        // Phase continuity: based on Φ phase score
        // Higher Φ score → higher continuity
        int256 phase = s_agents[agentId].phiPhase;
        // |cos(θ)| approximation: 1 - θ²/2 for small θ
        uint256 absPhase = phase >= 0 ? uint256(phase) : uint256(-phase);
        uint256 phaseSquared = (absPhase * absPhase) / 1e6;
        phaseContinuityScore = phaseSquared < 10000 ? 10000 - phaseSquared : 0;

        return (validCount, avgResult, phaseContinuityScore);
    }

    /**
     * @notice Get all validation requests for an agent
     */
    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory) {
        return s_agentValidations[agentId];
    }

    // =============== View Functions ===============

    function getAgentInfo(uint256 agentId) external view returns (
        address nftOwner,
        address wallet,
        uint256 phiScore,
        int256 phiPhase,
        uint256 registeredAt,
        bool active
    ) {
        AgentMeta storage a = s_agents[agentId];
        return (a.owner, a.agentWallet, a.phiScore, a.phiPhase, a.registeredAt, a.active);
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return s_agents[agentId].agentWallet;
    }

    function totalAgents() external view returns (uint256) {
        return s_nextAgentId - 1;
    }

    // =============== Admin ===============

    function setReputationPhiWeight(uint256 weight) external onlyOwner {
        require(weight <= 10000, "Invalid weight");
        reputationPhiWeight = weight;
    }

    function setValidationPhiThreshold(uint256 threshold) external onlyOwner {
        require(threshold <= MAX_PHI, "Invalid threshold");
        validationPhiThreshold = threshold;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice V10.0: 设置NegativeCaseBook合约地址
     */
    function setNegativeCaseBook(address _negativeCaseBook) external onlyOwner {
        negativeCaseBook = _negativeCaseBook;
    }

    // =============== Internal ===============

    function _stringsEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    // =============== ERC721 Overrides ===============

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

// =============== V10.0 Interfaces ===============

interface INegativeCaseBook {
    function mandatoryLearnAll(address agent) external returns (uint256);
}
