// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title Phi402Settlement
 * @dev AEON x402-inspired HTTP 402 Semantic Micropayment Settlement
 *
 * Inspired by AEON's x402 protocol, enhanced with Φ-value gradient pricing:
 *
 * Core Flow (mirrors HTTP 402):
 * 1. Client sends HTTP request to server
 * 2. Server returns 402 + payment requirements
 * 3. Client signs ERC-3009 TransferWithAuthorization
 * 4. Settlement contract verifies & executes payment
 * 5. Server delivers content after payment confirmation
 *
 * Φ Gradient Pricing:
 * - Φ >= 0.75: FREE (high-value agents get free access)
 * - 0.40 <= Φ < 0.75: STANDARD rate (base price)
 * - Φ < 0.40: PREMIUM rate (2x base price, low-Φ agents pay more)
 *
 * ERC-3009 Integration:
 * - Gasless delegated transfers via signed authorization
 * - Server submits payment on behalf of client
 * - No human-in-the-loop required
 */
contract Phi402Settlement is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // =============== Structs ===============

    struct PaymentRequirement {
        address token;           // Payment token (e.g., USDC)
        uint256 amount;         // Base amount (in token decimals)
        address recipient;      // Payment recipient
        string resource;        // Resource identifier (API endpoint URL)
        uint256 validBefore;    // Authorization valid before timestamp
        uint256 validAfter;     // Authorization valid after timestamp
    }

    struct Settlement {
        address client;         // Payer
        address recipient;      // Payee
        address token;          // Token address
        uint256 amount;         // Amount paid
        uint256 clientPhi;      // Client's Φ score at payment time
        uint8 pricingTier;      // 0=FREE, 1=STANDARD, 2=PREMIUM
        bytes32 resourceHash;   // Hash of resource identifier
        uint256 settledAt;      // Settlement timestamp
        bool settled;           // Whether settled
    }

    struct PhiPricingConfig {
        uint256 freeThreshold;      // Φ >= this → FREE (default 7500 = 0.75)
        uint256 standardThreshold;  // Φ >= this → STANDARD (default 4000 = 0.40)
        uint256 premiumMultiplier;  // PREMIUM price multiplier (default 200 = 2.0x)
    }

    // =============== State Variables ===============

    IERC20 public immutable paymentToken;

    // Settlement tracking
    mapping(bytes32 => Settlement) private s_settlements;  // authorizationId => Settlement
    mapping(address => uint256) private s_clientTotalPaid;
    mapping(address => uint256) private s_recipientTotalReceived;
    mapping(address => uint256) private s_clientPhiScore;   // Client Φ scores (set by oracle)

    // Phi pricing
    PhiPricingConfig public phiPricing;
    uint256 public constant MAX_PHI = 10000;
    uint256 public constant HUNDRED_PERCENT = 100;

    // Fees
    uint256 public protocolFeeBps;     // Protocol fee in basis points (default 50 = 0.5%)
    address public feeRecipient;

    // ERC-3009 type hash for TransferWithAuthorization
    bytes32 public constant TRANSFER_WITH_AUTH_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    // Nonce tracking (ERC-3009)
    mapping(address => mapping(bytes32 => bool)) private s_authorizationState;

    // =============== Events ===============

    event PaymentRequested(address indexed client, address indexed recipient, uint256 baseAmount, string resource);
    event SettlementCompleted(
        bytes32 indexed authorizationId,
        address indexed client,
        address indexed recipient,
        uint256 amount,
        uint8 pricingTier,
        uint256 clientPhi,
        uint256 timestamp
    );
    event PhiScoreUpdated(address indexed client, uint256 oldScore, uint256 newScore);
    event PhiPricingUpdated(uint256 freeThreshold, uint256 standardThreshold, uint256 premiumMultiplier);
    event ProtocolFeeUpdated(uint256 oldBps, uint256 newBps);

    // =============== Constructor ===============

    constructor(
        address _paymentToken,
        address _feeRecipient
    ) Ownable(msg.sender) EIP712("Phi402Settlement", "1") {
        require(_paymentToken != address(0), "Invalid token");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
        protocolFeeBps = 50; // 0.5%

        phiPricing = PhiPricingConfig({
            freeThreshold: 7500,      // Φ >= 0.75 → FREE
            standardThreshold: 4000,  // Φ >= 0.40 → STANDARD
            premiumMultiplier: 200    // 2.0x for PREMIUM
        });
    }

    // =============== Settlement Functions ===============

    /**
     * @notice Settle a payment with ERC-3009 signed authorization
     * @dev Server calls this after receiving client's signed authorization
     * @param from Payer address
     * @param to Recipient address
     * @param value Base payment amount
     * @param validAfter Authorization valid after
     * @param validBefore Authorization valid before
     * @param nonce Unique nonce
     * @param v Signature component
     * @param r Signature component
     * @param s Signature component
     * @param resource Resource being paid for
     */
    function settleWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s,
        string calldata resource
    ) external whenNotPaused nonReentrant {
        // Check authorization not already used
        require(!s_authorizationState[from][nonce], "Authorization already used");

        // Verify ERC-3009 signature
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTH_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == from, "Invalid signature");

        // Check validity window
        require(block.timestamp > validAfter, "Not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");

        // Mark authorization as used
        s_authorizationState[from][nonce] = true;

        // Calculate Φ-adjusted price
        uint256 clientPhi = s_clientPhiScore[from];
        (uint256 finalAmount, uint8 pricingTier) = _calculatePhiPrice(value, clientPhi);

        // FREE tier: no payment required, just record
        if (pricingTier == 0) {
            bytes32 freeAuthId = keccak256(abi.encodePacked(from, to, value, nonce));
            s_settlements[freeAuthId] = Settlement({
                client: from,
                recipient: to,
                token: address(paymentToken),
                amount: 0,
                clientPhi: clientPhi,
                pricingTier: 0,
                resourceHash: keccak256(bytes(resource)),
                settledAt: block.timestamp,
                settled: true
            });

            emit SettlementCompleted(freeAuthId, from, to, 0, 0, clientPhi, block.timestamp);
            return;
        }

        // Calculate protocol fee
        uint256 fee = (finalAmount * protocolFeeBps) / 10000;
        uint256 recipientAmount = finalAmount - fee;

        // Transfer tokens
        paymentToken.safeTransferFrom(from, address(this), finalAmount);

        if (fee > 0) {
            paymentToken.safeTransfer(feeRecipient, fee);
        }
        paymentToken.safeTransfer(to, recipientAmount);

        // Record settlement
        bytes32 authId = keccak256(abi.encodePacked(from, to, value, nonce));
        s_settlements[authId] = Settlement({
            client: from,
            recipient: to,
            token: address(paymentToken),
            amount: finalAmount,
            clientPhi: clientPhi,
            pricingTier: pricingTier,
            resourceHash: keccak256(bytes(resource)),
            settledAt: block.timestamp,
            settled: true
        });

        s_clientTotalPaid[from] += finalAmount;
        s_recipientTotalReceived[to] += recipientAmount;

        emit SettlementCompleted(authId, from, to, finalAmount, pricingTier, clientPhi, block.timestamp);
    }

    /**
     * @notice Direct payment (no ERC-3009, simpler flow)
     * @param recipient Payment recipient
     * @param baseAmount Base payment amount
     * @param resource Resource being paid for
     */
    function payDirect(
        address recipient,
        uint256 baseAmount,
        string calldata resource
    ) external whenNotPaused nonReentrant {
        require(baseAmount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");

        uint256 clientPhi = s_clientPhiScore[msg.sender];
        (uint256 finalAmount, uint8 pricingTier) = _calculatePhiPrice(baseAmount, clientPhi);

        // FREE tier
        if (pricingTier == 0) {
            bytes32 directFreeAuthId = keccak256(abi.encodePacked(msg.sender, recipient, baseAmount, block.timestamp));
            s_settlements[directFreeAuthId] = Settlement({
                client: msg.sender,
                recipient: recipient,
                token: address(paymentToken),
                amount: 0,
                clientPhi: clientPhi,
                pricingTier: 0,
                resourceHash: keccak256(bytes(resource)),
                settledAt: block.timestamp,
                settled: true
            });

            emit SettlementCompleted(directFreeAuthId, msg.sender, recipient, 0, 0, clientPhi, block.timestamp);
            return;
        }

        // Calculate fee
        uint256 fee = (finalAmount * protocolFeeBps) / 10000;
        uint256 recipientAmount = finalAmount - fee;

        paymentToken.safeTransferFrom(msg.sender, address(this), finalAmount);

        if (fee > 0) {
            paymentToken.safeTransfer(feeRecipient, fee);
        }
        paymentToken.safeTransfer(recipient, recipientAmount);

        bytes32 directAuthId = keccak256(abi.encodePacked(msg.sender, recipient, baseAmount, block.timestamp));
        s_settlements[directAuthId] = Settlement({
            client: msg.sender,
            recipient: recipient,
            token: address(paymentToken),
            amount: finalAmount,
            clientPhi: clientPhi,
            pricingTier: pricingTier,
            resourceHash: keccak256(bytes(resource)),
            settledAt: block.timestamp,
            settled: true
        });

        s_clientTotalPaid[msg.sender] += finalAmount;
        s_recipientTotalReceived[recipient] += recipientAmount;

        emit SettlementCompleted(directAuthId, msg.sender, recipient, finalAmount, pricingTier, clientPhi, block.timestamp);
    }

    // =============== Φ Price Calculation ===============

    /**
     * @notice Calculate Φ-adjusted price
     * @param baseAmount Base price
     * @param clientPhi Client's Φ score
     * @return finalAmount Adjusted amount
     * @return pricingTier 0=FREE, 1=STANDARD, 2=PREMIUM
     */
    function calculatePhiPrice(uint256 baseAmount, uint256 clientPhi) external view returns (uint256 finalAmount, uint8 pricingTier) {
        return _calculatePhiPrice(baseAmount, clientPhi);
    }

    function _calculatePhiPrice(uint256 baseAmount, uint256 clientPhi) internal view returns (uint256 finalAmount, uint8 pricingTier) {
        if (clientPhi >= phiPricing.freeThreshold) {
            // FREE tier: high-Φ agents
            return (0, 0);
        } else if (clientPhi >= phiPricing.standardThreshold) {
            // STANDARD tier: base price
            return (baseAmount, 1);
        } else {
            // PREMIUM tier: multiplied price
            uint256 premiumAmount = (baseAmount * phiPricing.premiumMultiplier) / 100;
            return (premiumAmount, 2);
        }
    }

    // =============== Φ Score Management ===============

    /**
     * @notice Update client's Φ score (owner/oracle only)
     * @param client Client address
     * @param newScore New Φ score (0-10000)
     */
    function updateClientPhiScore(address client, uint256 newScore) external onlyOwner {
        require(newScore <= MAX_PHI, "Invalid Phi score");
        uint256 oldScore = s_clientPhiScore[client];
        s_clientPhiScore[client] = newScore;
        emit PhiScoreUpdated(client, oldScore, newScore);
    }

    /**
     * @notice Batch update Φ scores (oracle only)
     * @param clients Client addresses
     * @param scores New Φ scores
     */
    function batchUpdatePhiScores(address[] calldata clients, uint256[] calldata scores) external onlyOwner {
        require(clients.length == scores.length, "Length mismatch");
        for (uint256 i = 0; i < clients.length; i++) {
            require(scores[i] <= MAX_PHI, "Invalid Phi score");
            uint256 oldScore = s_clientPhiScore[clients[i]];
            s_clientPhiScore[clients[i]] = scores[i];
            emit PhiScoreUpdated(clients[i], oldScore, scores[i]);
        }
    }

    // =============== View Functions ===============

    function getSettlement(bytes32 authorizationId) external view returns (Settlement memory) {
        return s_settlements[authorizationId];
    }

    function getClientPhiScore(address client) external view returns (uint256) {
        return s_clientPhiScore[client];
    }

    function getClientTotalPaid(address client) external view returns (uint256) {
        return s_clientTotalPaid[client];
    }

    function getRecipientTotalReceived(address recipient) external view returns (uint256) {
        return s_recipientTotalReceived[recipient];
    }

    function getAuthorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return s_authorizationState[authorizer][nonce];
    }

    // =============== Admin ===============

    function setPhiPricing(
        uint256 freeThreshold,
        uint256 standardThreshold,
        uint256 premiumMultiplier
    ) external onlyOwner {
        require(freeThreshold > standardThreshold, "Invalid thresholds");
        require(premiumMultiplier >= 100, "Invalid multiplier");
        phiPricing = PhiPricingConfig(freeThreshold, standardThreshold, premiumMultiplier);
        emit PhiPricingUpdated(freeThreshold, standardThreshold, premiumMultiplier);
    }

    function setProtocolFee(uint256 newBps) external onlyOwner {
        require(newBps <= 1000, "Fee too high"); // Max 10%
        uint256 oldBps = protocolFeeBps;
        protocolFeeBps = newBps;
        emit ProtocolFeeUpdated(oldBps, newBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
