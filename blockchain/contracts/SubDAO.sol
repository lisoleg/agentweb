// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SubDAO
 * @dev 子DAO本地化治理合约
 *
 * 基于地理区域的子DAO，支持本地化治理和法规合规。
 * 每个子DAO绑定一个地理区域（ISO 3166-1 alpha-2 + 地区代码），
 * 拥有独立的提案、投票机制，但受主DAO宪章约束。
 *
 * 核心设计：
 * - 区域绑定：子DAO与地理区域1:1映射
 * - 法规合规：不同区域可设置不同合规参数
 * - 跨区提案：支持子DAO之间的跨区提案路由
 * - Φ值加权：继承PhiStaking投票权计算
 */
contract SubDAO is Ownable, Pausable, ReentrancyGuard {

    // =============== Structs ===============

    struct JurisdictionRule {
        uint256 minVotingPeriod;      // 最短投票期（秒）
        uint256 maxVotingPeriod;      // 最长投票期（秒）
        uint256 quorumRatio;          // 法定人数比率 (0-10000, 2 decimals)
        uint256 approvalThreshold;    // 通过阈值 (0-10000, 2 decimals)
        bool requireKYC;             // 是否需要KYC
        uint256 maxStakeInfluence;    // 最大质押影响力 (0-10000)
        bool active;
    }

    struct SubDAOInfo {
        bytes32 subDaoId;             // 子DAO唯一标识
        string countryCode;          // ISO 3166-1 alpha-2
        string regionCode;           // 地区代码
        string name;                  // 子DAO名称
        address governanceToken;     // 治理代币地址
        address phiStaking;         // PhiStaking合约地址
        uint256 memberCount;        // 成员数量
        uint256 createdAt;          // 创建时间
        bool active;                 // 是否激活
    }

    struct SubDAOProposal {
        bytes32 proposalId;
        bytes32 subDaoId;
        address proposer;
        string description;
        bytes calldata_;
        uint256 deadline;
        uint256 forVotes;           // Φ加权赞成票
        uint256 againstVotes;       // Φ加权反对票
        uint256 totalVotingPower;   // 总投票权
        ProposalState state;
        bool isCrossRegion;         // 是否跨区提案
        bytes32[] targetRegions;    // 目标区域（跨区提案）
    }

    enum ProposalState {
        Pending,
        Active,
        Passed,
        Failed,
        Executed,
        Cancelled
    }

    // =============== State Variables ===============

    // subDaoId => SubDAOInfo
    mapping(bytes32 => SubDAOInfo) private s_subDaos;
    // countryCode+regionCode => subDaoId (区域1:1映射)
    mapping(bytes32 => bytes32) private s_regionToSubDao;
    // subDaoId => jurisdictionRule
    mapping(bytes32 => JurisdictionRule) private s_jurisdictionRules;
    // proposalId => SubDAOProposal
    mapping(bytes32 => SubDAOProposal) private s_proposals;
    // subDaoId => proposalIds
    mapping(bytes32 => bytes32[]) private s_subDaoProposals;
    // proposalId => voter => voted
    mapping(bytes32 => mapping(address => bool)) private s_hasVoted;
    // subDaoId => member => isMember
    mapping(bytes32 => mapping(address => bool)) private s_members;
    // 跨区提案: proposalId => subDaoId => voteResult
    mapping(bytes32 => mapping(bytes32 => bool)) private s_crossRegionApproval;

    uint256 private s_subDaoCount;
    uint256 private s_proposalCount;

    // 主DAO宪章约束
    uint256 public constant MAX_REGIONS_PER_PROPOSAL = 10;
    uint256 public constant MIN_PHI_WEIGHT_TO_PROPOSE = 100; // 1.00 Φ值（2 decimals）

    // =============== Events ===============

    event SubDAOCreated(bytes32 indexed subDaoId, string countryCode, string regionCode, string name, uint256 timestamp);
    event MemberJoined(bytes32 indexed subDaoId, address indexed member, uint256 timestamp);
    event MemberLeft(bytes32 indexed subDaoId, address indexed member, uint256 timestamp);
    event JurisdictionRuleSet(bytes32 indexed subDaoId, uint256 minVotingPeriod, uint256 maxVotingPeriod, uint256 quorumRatio);
    event ProposalCreated(bytes32 indexed proposalId, bytes32 indexed subDaoId, address indexed proposer, bool isCrossRegion);
    event VoteCast(bytes32 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalStateChanged(bytes32 indexed proposalId, ProposalState newState);
    event CrossRegionProposalRouted(bytes32 indexed proposalId, bytes32 targetSubDaoId);

    // =============== Constructor ===============

    constructor() Ownable(msg.sender) {}

    // =============== SubDAO Management ===============

    /**
     * @notice 创建子DAO
     * @param countryCode ISO 3166-1 alpha-2 国家代码
     * @param regionCode 地区代码
     * @param name 子DAO名称
     * @param governanceToken 治理代币地址
     * @param phiStaking PhiStaking合约地址
     */
    function createSubDAO(
        string calldata countryCode,
        string calldata regionCode,
        string calldata name,
        address governanceToken,
        address phiStaking
    ) external onlyOwner whenNotPaused returns (bytes32) {
        require(bytes(countryCode).length == 2, "Invalid country code");
        require(bytes(name).length > 0, "Name required");
        require(governanceToken != address(0), "Invalid token address");

        bytes32 regionKey = _regionKey(countryCode, regionCode);
        require(s_regionToSubDao[regionKey] == bytes32(0), "Region already has SubDAO");

        bytes32 subDaoId = keccak256(abi.encodePacked(countryCode, regionCode, block.timestamp, s_subDaoCount));

        s_subDaos[subDaoId] = SubDAOInfo({
            subDaoId: subDaoId,
            countryCode: countryCode,
            regionCode: regionCode,
            name: name,
            governanceToken: governanceToken,
            phiStaking: phiStaking,
            memberCount: 0,
            createdAt: block.timestamp,
            active: true
        });

        s_regionToSubDao[regionKey] = subDaoId;

        // 设置默认法规规则
        s_jurisdictionRules[subDaoId] = JurisdictionRule({
            minVotingPeriod: 1 days,
            maxVotingPeriod: 14 days,
            quorumRatio: 2000,       // 20%
            approvalThreshold: 5000, // 50%
            requireKYC: false,
            maxStakeInfluence: 10000, // 100% (不限制)
            active: true
        });

        s_subDaoCount++;

        emit SubDAOCreated(subDaoId, countryCode, regionCode, name, block.timestamp);
        return subDaoId;
    }

    /**
     * @notice 加入子DAO
     * @param subDaoId 子DAO ID
     */
    function joinSubDAO(bytes32 subDaoId) external whenNotPaused returns (bool) {
        require(s_subDaos[subDaoId].active, "SubDAO not active");
        require(!s_members[subDaoId][msg.sender], "Already a member");

        s_members[subDaoId][msg.sender] = true;
        s_subDaos[subDaoId].memberCount++;

        emit MemberJoined(subDaoId, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @notice 退出子DAO
     * @param subDaoId 子DAO ID
     */
    function leaveSubDAO(bytes32 subDaoId) external whenNotPaused returns (bool) {
        require(s_members[subDaoId][msg.sender], "Not a member");

        s_members[subDaoId][msg.sender] = false;
        s_subDaos[subDaoId].memberCount--;

        emit MemberLeft(subDaoId, msg.sender, block.timestamp);
        return true;
    }

    // =============== Jurisdiction Rules ===============

    /**
     * @notice 设置法规合规规则
     */
    function setJurisdictionRule(
        bytes32 subDaoId,
        uint256 minVotingPeriod,
        uint256 maxVotingPeriod,
        uint256 quorumRatio,
        uint256 approvalThreshold,
        bool requireKYC,
        uint256 maxStakeInfluence
    ) external onlyOwner returns (bool) {
        require(s_subDaos[subDaoId].active, "SubDAO not active");
        require(minVotingPeriod < maxVotingPeriod, "Invalid voting period");
        require(quorumRatio <= 10000, "Invalid quorum ratio");
        require(approvalThreshold <= 10000, "Invalid threshold");

        s_jurisdictionRules[subDaoId] = JurisdictionRule({
            minVotingPeriod: minVotingPeriod,
            maxVotingPeriod: maxVotingPeriod,
            quorumRatio: quorumRatio,
            approvalThreshold: approvalThreshold,
            requireKYC: requireKYC,
            maxStakeInfluence: maxStakeInfluence,
            active: true
        });

        emit JurisdictionRuleSet(subDaoId, minVotingPeriod, maxVotingPeriod, quorumRatio);
        return true;
    }

    /**
     * @notice 法规合规检查（内部）
     */
    function checkJurisdictionCompliance(
        bytes32 subDaoId,
        address voter,
        uint256 votingPeriod
    ) public view returns (bool compliant, string memory reason) {
        JurisdictionRule storage rule = s_jurisdictionRules[subDaoId];

        if (!rule.active) {
            return (true, "No active jurisdiction rule");
        }

        if (votingPeriod < rule.minVotingPeriod) {
            return (false, "Voting period below minimum");
        }
        if (votingPeriod > rule.maxVotingPeriod) {
            return (false, "Voting period exceeds maximum");
        }
        if (rule.requireKYC) {
            // KYC check placeholder — integrate with identity registry
            return (true, "KYC check bypassed (placeholder)");
        }

        return (true, "Compliant");
    }

    // =============== Proposals ===============

    /**
     * @notice 创建子DAO内提案
     */
    function createProposal(
        bytes32 subDaoId,
        string calldata description,
        bytes calldata calldata_,
        uint256 votingPeriodDays
    ) external whenNotPaused returns (bytes32) {
        require(s_subDaos[subDaoId].active, "SubDAO not active");
        require(s_members[subDaoId][msg.sender], "Not a member");
        require(bytes(description).length > 0, "Description required");
        require(votingPeriodDays >= 1 && votingPeriodDays <= 30, "Invalid voting period");

        // 法规合规检查
        uint256 votingPeriodSeconds = votingPeriodDays * 1 days;
        (bool compliant, string memory reason) = checkJurisdictionCompliance(
            subDaoId, msg.sender, votingPeriodSeconds
        );
        require(compliant, reason);

        bytes32 proposalId = keccak256(abi.encodePacked(subDaoId, msg.sender, block.timestamp, s_proposalCount));

        SubDAOProposal storage proposal = s_proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.subDaoId = subDaoId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.calldata_ = calldata_;
        proposal.deadline = block.timestamp + votingPeriodSeconds;
        proposal.state = ProposalState.Active;
        proposal.isCrossRegion = false;

        s_subDaoProposals[subDaoId].push(proposalId);
        s_proposalCount++;

        emit ProposalCreated(proposalId, subDaoId, msg.sender, false);
        return proposalId;
    }

    /**
     * @notice 创建跨区提案
     */
    function createCrossRegionProposal(
        bytes32 sourceSubDaoId,
        string calldata description,
        bytes calldata calldata_,
        bytes32[] calldata targetRegionKeys,
        uint256 votingPeriodDays
    ) external whenNotPaused returns (bytes32) {
        require(s_subDaos[sourceSubDaoId].active, "Source SubDAO not active");
        require(s_members[sourceSubDaoId][msg.sender], "Not a member of source SubDAO");
        require(targetRegionKeys.length > 0 && targetRegionKeys.length <= MAX_REGIONS_PER_PROPOSAL, "Invalid target count");

        uint256 votingPeriodSeconds = votingPeriodDays * 1 days;
        (bool compliant, string memory reason) = checkJurisdictionCompliance(
            sourceSubDaoId, msg.sender, votingPeriodSeconds
        );
        require(compliant, reason);

        bytes32 proposalId = keccak256(abi.encodePacked(sourceSubDaoId, "cross", msg.sender, block.timestamp, s_proposalCount));

        SubDAOProposal storage proposal = s_proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.subDaoId = sourceSubDaoId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.calldata_ = calldata_;
        proposal.deadline = block.timestamp + votingPeriodSeconds;
        proposal.state = ProposalState.Active;
        proposal.isCrossRegion = true;
        proposal.targetRegions = targetRegionKeys;

        s_subDaoProposals[sourceSubDaoId].push(proposalId);
        s_proposalCount++;

        // 路由到目标子DAO
        for (uint256 i = 0; i < targetRegionKeys.length; i++) {
            bytes32 targetSubDaoId = s_regionToSubDao[targetRegionKeys[i]];
            require(s_subDaos[targetSubDaoId].active, "Target SubDAO not active");
            emit CrossRegionProposalRouted(proposalId, targetSubDaoId);
        }

        emit ProposalCreated(proposalId, sourceSubDaoId, msg.sender, true);
        return proposalId;
    }

    /**
     * @notice 投票（Φ值加权）
     */
    function castVote(
        bytes32 proposalId,
        bool support
    ) external whenNotPaused nonReentrant returns (bool) {
        SubDAOProposal storage proposal = s_proposals[proposalId];
        require(proposal.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp <= proposal.deadline, "Voting deadline passed");
        require(!s_hasVoted[proposalId][msg.sender], "Already voted");
        require(s_members[proposal.subDaoId][msg.sender], "Not a member");

        // 获取投票权（从PhiStaking合约读取）
        uint256 votingPower = _getVotingPower(proposal.subDaoId, msg.sender);

        // 法规约束：限制最大质押影响力
        JurisdictionRule storage rule = s_jurisdictionRules[proposal.subDaoId];
        if (rule.active && rule.maxStakeInfluence < 10000) {
            uint256 maxPower = (proposal.totalVotingPower * rule.maxStakeInfluence) / 10000;
            votingPower = votingPower > maxPower ? maxPower : votingPower;
        }

        if (support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }

        proposal.totalVotingPower += votingPower;
        s_hasVoted[proposalId][msg.sender] = true;

        emit VoteCast(proposalId, msg.sender, support, votingPower);

        // 检查是否可以提前结束
        _checkProposalState(proposalId);

        return true;
    }

    /**
     * @notice 结算提案
     */
    function finalizeProposal(bytes32 proposalId) external whenNotPaused returns (ProposalState) {
        SubDAOProposal storage proposal = s_proposals[proposalId];
        require(proposal.state == ProposalState.Active, "Proposal not active");
        require(block.timestamp > proposal.deadline, "Voting not ended");

        JurisdictionRule storage rule = s_jurisdictionRules[proposal.subDaoId];

        // 法定人数检查
        uint256 quorumRequired = (proposal.totalVotingPower * rule.quorumRatio) / 10000;
        bool quorumReached = (proposal.forVotes + proposal.againstVotes) >= quorumRequired;

        // 通过阈值检查
        bool approvalReached = proposal.forVotes >= ((proposal.forVotes + proposal.againstVotes) * rule.approvalThreshold) / 10000;

        if (quorumReached && approvalReached) {
            proposal.state = ProposalState.Passed;
        } else {
            proposal.state = ProposalState.Failed;
        }

        emit ProposalStateChanged(proposalId, proposal.state);
        return proposal.state;
    }

    // =============== Internal Functions ===============

    function _regionKey(string memory countryCode, string memory regionCode) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(countryCode, regionCode));
    }

    function _getVotingPower(bytes32 subDaoId, address voter) internal view returns (uint256) {
        address phiStaking = s_subDaos[subDaoId].phiStaking;
        if (phiStaking == address(0)) {
            return 1; // Default: 1 vote per member
        }
        // 调用PhiStaking.getVotingPower(voter)
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory data) = phiStaking.staticcall(
            abi.encodeWithSignature("getVotingPower(address)", voter)
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (uint256));
        }
        return 1; // Fallback
    }

    function _checkProposalState(bytes32 proposalId) internal {
        // 简化实现：不在投票期间提前结束
        // 可扩展为：如果某一方向票数已超过可达成阈值，提前结束
    }

    // =============== View Functions ===============

    function getSubDAO(bytes32 subDaoId) external view returns (SubDAOInfo memory) {
        return s_subDaos[subDaoId];
    }

    function getSubDAOByRegion(string calldata countryCode, string calldata regionCode) external view returns (bytes32) {
        return s_regionToSubDao[_regionKey(countryCode, regionCode)];
    }

    function getJurisdictionRule(bytes32 subDaoId) external view returns (JurisdictionRule memory) {
        return s_jurisdictionRules[subDaoId];
    }

    function getProposal(bytes32 proposalId) external view returns (SubDAOProposal memory) {
        return s_proposals[proposalId];
    }

    function isMember(bytes32 subDaoId, address account) external view returns (bool) {
        return s_members[subDaoId][account];
    }

    function getSubDAOCount() external view returns (uint256) {
        return s_subDaoCount;
    }

    function getSubDAOProposals(bytes32 subDaoId) external view returns (bytes32[] memory) {
        return s_subDaoProposals[subDaoId];
    }

    // =============== Admin ===============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
