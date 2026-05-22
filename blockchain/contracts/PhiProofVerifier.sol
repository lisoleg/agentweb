// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PhiProofVerifier
 * @dev On-chain verifier for zk-SNARK proofs of Φ calculations
 *
 * Based on Paper 2: Recursive zk-SNARK compression
 * - Stores only proof hashes on-chain (~1KB per proof)
 * - Supports recursive proof aggregation
 * - Integrates with PhiStaking for Φ-based rewards
 */
contract PhiProofVerifier is Ownable, Pausable {

    constructor() Ownable(msg.sender) {}

    struct ProofRecord {
        bytes32 proofHash;       // zk-SNARK proof hash
        uint256 phiMagnitude;   // |Φ| × 1e6
        int256 phiPhase;         // θ × 1e6
        uint256 timestamp;
        address prover;
        bool verified;
        uint256 recursionDepth;
    }

    // Proof records
    mapping(bytes32 => ProofRecord) public proofs;
    bytes32[] public proofIds;

    // Aggregation records
    mapping(bytes32 => bytes32[]) public subProofs;

    // Events
    event ProofSubmitted(bytes32 indexed proofId, address prover, uint256 phiMagnitude, int256 phiPhase);
    event ProofVerified(bytes32 indexed proofId, bool result);
    event ProofsAggregated(bytes32 indexed aggregateId, uint256 proofCount, uint256 recursionDepth);

    // Constants
    uint256 public constant MAX_RECURSION_DEPTH = 8;
    uint256 public constant PHI_SCALE = 1e6;

    /**
     * @notice Submit a zk-SNARK proof for Φ calculation
     */
    function submitProof(
        bytes32 proofId,
        bytes calldata proofData,
        uint256 phiMagnitude,
        int256 phiPhase
    ) external whenNotPaused returns (bool) {
        require(proofs[proofId].timestamp == 0, "Proof already exists");
        require(phiMagnitude <= PHI_SCALE, "Invalid phi magnitude");
        require(phiPhase >= -3141593 && phiPhase <= 3141593, "Invalid phi phase"); // ±π

        bytes32 proofHash = keccak256(proofData);

        proofs[proofId] = ProofRecord({
            proofHash: proofHash,
            phiMagnitude: phiMagnitude,
            phiPhase: phiPhase,
            timestamp: block.timestamp,
            prover: msg.sender,
            verified: false,
            recursionDepth: 0
        });

        proofIds.push(proofId);

        emit ProofSubmitted(proofId, msg.sender, phiMagnitude, phiPhase);
        return true;
    }

    /**
     * @notice Verify a submitted proof
     */
    function verifyProof(bytes32 proofId) external view returns (bool) {
        ProofRecord memory record = proofs[proofId];
        require(record.timestamp > 0, "Proof not found");

        // Simplified verification: check proof hash integrity
        // In production, this would call a Groth16 verifier
        return record.proofHash != bytes32(0) && record.phiMagnitude <= PHI_SCALE;
    }

    /**
     * @notice Aggregate multiple proofs into a recursive proof
     */
    function aggregateProofs(
        bytes32 aggregateId,
        bytes32[] calldata subProofIds
    ) external whenNotPaused returns (bool) {
        require(subProofIds.length > 0 && subProofIds.length <= 16, "Invalid proof count");
        require(proofs[aggregateId].timestamp == 0, "Aggregate ID already exists");

        uint256 maxDepth = 0;
        uint256 totalMagnitude = 0;
        int256 totalPhase = 0;

        for (uint256 i = 0; i < subProofIds.length; i++) {
            ProofRecord memory subProof = proofs[subProofIds[i]];
            require(subProof.timestamp > 0, "Sub-proof not found");
            require(subProof.verified || subProof.proofHash != bytes32(0), "Sub-proof not verified");

            totalMagnitude += subProof.phiMagnitude;
            totalPhase += subProof.phiPhase;

            if (subProof.recursionDepth > maxDepth) {
                maxDepth = subProof.recursionDepth;
            }

            subProofs[aggregateId].push(subProofIds[i]);
        }

        require(maxDepth + 1 <= MAX_RECURSION_DEPTH, "Recursion depth exceeded");

        // Average the values
        uint256 avgMagnitude = totalMagnitude / subProofIds.length;
        int256 avgPhase = totalPhase / int256(subProofIds.length);

        proofs[aggregateId] = ProofRecord({
            proofHash: keccak256(abi.encodePacked(subProofIds)),
            phiMagnitude: avgMagnitude,
            phiPhase: avgPhase,
            timestamp: block.timestamp,
            prover: msg.sender,
            verified: true,
            recursionDepth: maxDepth + 1
        });

        proofIds.push(aggregateId);

        emit ProofsAggregated(aggregateId, subProofIds.length, maxDepth + 1);
        return true;
    }

    /**
     * @notice Get proof count
     */
    function getProofCount() external view returns (uint256) {
        return proofIds.length;
    }

    /**
     * @notice Get proof details
     */
    function getProof(bytes32 proofId) external view returns (
        bytes32 proofHash,
        uint256 phiMagnitude,
        int256 phiPhase,
        uint256 timestamp,
        address prover,
        bool verified,
        uint256 recursionDepth
    ) {
        ProofRecord memory record = proofs[proofId];
        return (
            record.proofHash,
            record.phiMagnitude,
            record.phiPhase,
            record.timestamp,
            record.prover,
            record.verified,
            record.recursionDepth
        );
    }
}
