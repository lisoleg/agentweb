// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentRegistry
 * @dev Agent registration and management contract for AgentWeb
 *
 * Features:
 * - Register AI agents with metadata
 * - Update agent reputation score
 * - Query agent information
 * - List all registered agents
 */
contract AgentRegistry is Ownable, Pausable, ReentrancyGuard {
    // =============== Structs ===============

    struct Agent {
        string agentId; // Unique agent ID
        address owner; // Agent owner address
        string name; // Agent name
        string description; // Agent description
        string endpoint; // API endpoint URL
        string[] capabilities; // List of capability strings
        uint256 reputation; // Reputation score (0-10000, 2 decimals)
        uint256 stakeAmount; // Staked amount
        uint256 registeredAt; // Registration timestamp
        uint256 updatedAt; // Last update timestamp
        bool active; // Active status
    }

    // =============== State Variables ===============

    uint256 private s_agentCount;
    mapping(string => Agent) private s_agents;
    mapping(address => string[]) private s_ownerAgents;
    mapping(uint256 => string) private s_agentIds; // Index to agentId

    // =============== Events ===============

    event AgentRegistered(
        string indexed agentId,
        address indexed owner,
        string name,
        uint256 timestamp
    );

    event AgentUpdated(
        string indexed agentId,
        address indexed owner,
        uint256 timestamp
    );

    event ReputationUpdated(
        string indexed agentId,
        int256 delta,
        uint256 newReputation,
        uint256 timestamp
    );

    event AgentDeactivated(
        string indexed agentId,
        address indexed owner,
        uint256 timestamp
    );

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {}

    // =============== External Functions ===============

    /**
     * @notice Register a new agent
     * @param agentId Unique agent ID
     * @param name Agent name
     * @param description Agent description
     * @param endpoint API endpoint URL
     * @param capabilities Array of capability strings
     */
    function registerAgent(
        string calldata agentId,
        string calldata name,
        string calldata description,
        string calldata endpoint,
        string[] calldata capabilities
    ) external whenNotPaused nonReentrant returns (bool) {
        require(bytes(agentId).length > 0, "Invalid agentId");
        require(bytes(name).length > 0, "Invalid name");
        require(s_agents[agentId].owner == address(0), "Agent already registered");

        // Create agent
        s_agents[agentId] = Agent({
            agentId: agentId,
            owner: msg.sender,
            name: name,
            description: description,
            endpoint: endpoint,
            capabilities: capabilities,
            reputation: 0,
            stakeAmount: 0,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true
        });

        // Update indexes
        s_ownerAgents[msg.sender].push(agentId);
        s_agentIds[s_agentCount] = agentId;
        s_agentCount++;

        emit AgentRegistered(agentId, msg.sender, name, block.timestamp);

        return true;
    }

    /**
     * @notice Update agent information
     * @param agentId Agent ID to update
     * @param name New name (empty string to keep unchanged)
     * @param description New description (empty string to keep unchanged)
     * @param endpoint New endpoint (empty string to keep unchanged)
     * @param capabilities New capabilities (empty to keep unchanged)
     */
    function updateAgent(
        string calldata agentId,
        string calldata name,
        string calldata description,
        string calldata endpoint,
        string[] calldata capabilities
    ) external whenNotPaused nonReentrant returns (bool) {
        require(s_agents[agentId].owner != address(0), "Agent not found");
        require(s_agents[agentId].owner == msg.sender || msg.sender == owner(), "Not authorized");

        Agent storage agent = s_agents[agentId];

        if (bytes(name).length > 0) {
            agent.name = name;
        }
        if (bytes(description).length > 0) {
            agent.description = description;
        }
        if (bytes(endpoint).length > 0) {
            agent.endpoint = endpoint;
        }
        if (capabilities.length > 0) {
            agent.capabilities = capabilities;
        }
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(agentId, msg.sender, block.timestamp);

        return true;
    }

    /**
     * @notice Update agent reputation (only owner or authorized caller)
     * @param agentId Agent ID
     * @param delta Reputation change (can be negative)
     */
    function updateReputation(
        string calldata agentId,
        int256 delta
    ) external onlyOwner returns (bool) {
        require(s_agents[agentId].owner != address(0), "Agent not found");

        Agent storage agent = s_agents[agentId];

        if (delta >= 0) {
            agent.reputation += uint256(delta);
        } else {
            uint256 absDelta = uint256(-delta);
            require(agent.reputation >= absDelta, "Reputation cannot go below 0");
            agent.reputation -= absDelta;
        }

        agent.updatedAt = block.timestamp;

        emit ReputationUpdated(agentId, delta, agent.reputation, block.timestamp);

        return true;
    }

    /**
     * @notice Deactivate an agent (owner only)
     * @param agentId Agent ID to deactivate
     */
    function deactivateAgent(string calldata agentId) external onlyOwner returns (bool) {
        require(s_agents[agentId].owner != address(0), "Agent not found");

        s_agents[agentId].active = false;
        s_agents[agentId].updatedAt = block.timestamp;

        emit AgentDeactivated(agentId, s_agents[agentId].owner, block.timestamp);

        return true;
    }

    /**
     * @notice Stake tokens for an agent (placeholder - integrate with PhiStaking)
     * @param agentId Agent ID
     */
    function stakeForAgent(string calldata agentId) external payable whenNotPaused {
        require(s_agents[agentId].owner != address(0), "Agent not found");
        require(msg.value > 0, "Stake amount must be > 0");

        s_agents[agentId].stakeAmount += msg.value;
        s_agents[agentId].updatedAt = block.timestamp;

        emit AgentUpdated(agentId, s_agents[agentId].owner, block.timestamp);
    }

    // =============== View Functions ===============

    /**
     * @notice Get agent information
     * @param agentId Agent ID
     * @return Agent struct
     */
    function getAgent(string calldata agentId)
        external
        view
        returns (
            string memory,
            address,
            string memory,
            string memory,
            string memory,
            string[] memory,
            uint256,
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        require(s_agents[agentId].owner != address(0), "Agent not found");

        Agent memory agent = s_agents[agentId];

        return (
            agent.agentId,
            agent.owner,
            agent.name,
            agent.description,
            agent.endpoint,
            agent.capabilities,
            agent.reputation,
            agent.stakeAmount,
            agent.registeredAt,
            agent.updatedAt,
            agent.active
        );
    }

    /**
     * @notice Get agents by owner address
     * @param owner Owner address
     * @return Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view returns (string[] memory) {
        return s_ownerAgents[owner];
    }

    /**
     * @notice Get total agent count
     * @return Agent count
     */
    function getAgentCount() external view returns (uint256) {
        return s_agentCount;
    }

    /**
     * @notice Get agent ID by index
     * @param index Index in the list
     * @return Agent ID
     */
    function getAgentIdByIndex(uint256 index) external view returns (string memory) {
        require(index < s_agentCount, "Index out of bounds");
        return s_agentIds[index];
    }

    /**
     * @notice Check if agent exists
     * @param agentId Agent ID
     * @return True if agent exists
     */
    function agentExists(string calldata agentId) external view returns (bool) {
        return s_agents[agentId].owner != address(0);
    }

    // =============== Admin Functions ===============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
