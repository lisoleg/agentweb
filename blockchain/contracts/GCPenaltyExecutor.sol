// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GCPenaltyExecutor
 * @notice GC惩罚自动执行器 — 三级惩罚: WARNING → DOWNGRADE → EXPEL
 * @dev "代码即法律"：GC余额低于代谢阈值时，自动执行惩罚无需人工干预
 *      申诉机制：被惩罚Agent可向ConstitutionCourt申诉
 *      信用联动：惩罚导致CreditRating分数下降
 *
 * 三级惩罚体系:
 * - WARNING: GC余额 < 代谢率×30天×20% → 扣除少量GC + 标记警告
 * - DOWNGRADE: GC余额 < 代谢率×30天×10% → 降级GCCRental租约 + 取消AIResourceConsumption高级订阅
 * - EXPEL: GC余额 < 代谢率×30天×5% → 断开租约 + 取消所有订阅 + 驱逐出锚定层
 *
 * 参考: 《皇帝的新衣与影子内阁》— "写烂代码不仅要扣钱，还要扣质押的保证金"
 */
contract GCPenaltyExecutor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum PenaltyLevel { NONE, WARNING, DOWNGRADE, EXPEL }

    // =============== Structs ===============

    struct PenaltyRecord {
        uint256 id;
        address agent;
        PenaltyLevel level;
        uint256 gcBurned;
        uint256 creditImpact;
        bool    appealed;
        bool    appealGranted;
        bytes32 evidenceHash;
        uint256 timestamp;
    }

    struct PenaltyConfig {
        uint256 warningThresholdBps;    // GC余额/月代谢成本 < 20% → WARNING
        uint256 downgradeThresholdBps;  // GC余额/月代谢成本 < 10% → DOWNGRADE
        uint256 expelThresholdBps;      // GC余额/月代谢成本 < 5%  → EXPEL
        uint256 warningBurnBps;         // WARNING: 扣除月代谢成本的10%
        uint256 downgradeBurnBps;       // DOWNGRADE: 扣除月代谢成本的25%
        uint256 expelBurnBps;           // EXPEL: 扣除所有余额
        uint256 warningCreditImpact;    // WARNING: 信用分-100
        uint256 downgradeCreditImpact;  // DOWNGRADE: 信用分-300
        uint256 expelCreditImpact;      // EXPEL: 信用分-1000
    }

    // =============== State Variables ===============

    IERC20 public immutable gcToken;

    /// @notice GCAncor合约地址
    address public gcAncor;

    /// @notice ConstitutionCourt合约地址(申诉)
    address public constitutionCourt;

    /// @notice CreditRating合约地址(信用联动)
    address public creditRating;

    /// @notice 总惩罚记录数
    uint256 public totalPenaltyRecords;

    /// @notice penaltyId => PenaltyRecord
    mapping(uint256 => PenaltyRecord) public penaltyRecords;

    /// @notice agent => 惩罚记录ID列表
    mapping(address => uint256[]) public agentPenaltyIds;

    /// @notice agent => 当前惩罚等级
    mapping(address => PenaltyLevel) public agentPenaltyLevel;

    /// @notice agent => 连续惩罚次数
    mapping(address => uint256) public agentConsecutivePenalties;

    /// @notice agent => 上次惩罚时间
    mapping(address => uint256) public agentLastPenaltyTime;

    /// @notice 申诉冷却期(秒, 默认7天)
    uint256 public appealCooldown;

    /// @notice 惩罚冷却期(秒, 默认1天) — 同一Agent两次惩罚最小间隔
    uint256 public penaltyCooldown;

    /// @notice 惩罚配置
    PenaltyConfig public penaltyConfig;

    /// @notice 管理员列表
    mapping(address => bool) public admins;

    /// @notice 防重放
    mapping(bytes32 => bool) public processedAppeals;

    // =============== Events ===============

    event PenaltyExecuted(
        uint256 indexed penaltyId,
        address indexed agent,
        PenaltyLevel level,
        uint256 gcBurned,
        uint256 creditImpact,
        uint256 timestamp
    );

    event AppealSubmitted(
        uint256 indexed penaltyId,
        address indexed agent,
        bytes32 evidenceHash,
        uint256 timestamp
    );

    event AppealResolved(
        uint256 indexed penaltyId,
        bool granted,
        uint256 gcRefunded,
        uint256 timestamp
    );

    event PenaltyLevelReset(
        address indexed agent,
        PenaltyLevel oldLevel,
        uint256 timestamp
    );

    event PenaltyConfigUpdated(
        uint256 warningThresholdBps,
        uint256 downgradeThresholdBps,
        uint256 expelThresholdBps,
        uint256 timestamp
    );

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "GCPenaltyExecutor: not admin");
        _;
    }

    modifier onlyGCAncor() {
        require(msg.sender == gcAncor || msg.sender == owner(), "GCPenaltyExecutor: not gcAncor");
        _;
    }

    modifier onlyConstitutionCourt() {
        require(msg.sender == constitutionCourt || msg.sender == owner(),
                "GCPenaltyExecutor: not court");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _gcToken,
        address _gcAncor
    ) Ownable(msg.sender) {
        require(_gcToken != address(0), "GCPenaltyExecutor: zero gcToken");
        gcToken = IERC20(_gcToken);
        gcAncor = _gcAncor;

        appealCooldown = 7 days;
        penaltyCooldown = 1 days;

        // 默认惩罚配置
        penaltyConfig = PenaltyConfig({
            warningThresholdBps: 2000,     // 20%
            downgradeThresholdBps: 1000,    // 10%
            expelThresholdBps: 500,         // 5%
            warningBurnBps: 1000,            // 10% of monthly cost
            downgradeBurnBps: 2500,          // 25% of monthly cost
            expelBurnBps: 10000,             // 100% of remaining
            warningCreditImpact: 100,
            downgradeCreditImpact: 300,
            expelCreditImpact: 1000
        });

        admins[msg.sender] = true;
    }

    // =============== External Functions ===============

    /**
     * @notice 检查并执行惩罚（核心函数）
     * @dev 由GCAncor或keeper调用，检查Agent GC余额是否低于阈值
     * @param agent Agent地址
     * @param gcBalance Agent当前GC余额
     * @param metabolicRate Agent当前代谢率(GC/秒)
     * @return penaltyId 惩罚ID(0表示无惩罚)
     * @return level 惩罚等级
     */
    function checkAndPenalize(
        address agent,
        uint256 gcBalance,
        uint256 metabolicRate
    ) external onlyGCAncor nonReentrant returns (uint256 penaltyId, PenaltyLevel level) {
        // 冷却期检查
        if (block.timestamp < agentLastPenaltyTime[agent] + penaltyCooldown) {
            return (0, PenaltyLevel.NONE);
        }

        if (metabolicRate == 0 || gcBalance == 0) {
            // 零代谢率不需要惩罚，零余额直接驱逐
            if (gcBalance == 0 && metabolicRate > 0) {
                return _executeExpel(agent, 0, metabolicRate);
            }
            return (0, PenaltyLevel.NONE);
        }

        uint256 monthlyCost = metabolicRate * 30 days;
        // ratio = gcBalance / monthlyCost (基点)
        uint256 ratio = monthlyCost > 0 ? (gcBalance * 10000) / monthlyCost : 10000;

        PenaltyConfig memory config = penaltyConfig;

        if (ratio <= config.expelThresholdBps) {
            return _executeExpel(agent, gcBalance, metabolicRate);
        } else if (ratio <= config.downgradeThresholdBps) {
            return _executeDowngrade(agent, gcBalance, metabolicRate);
        } else if (ratio <= config.warningThresholdBps) {
            return _executeWarning(agent, gcBalance, metabolicRate);
        }

        // 恢复：如果之前有惩罚但现在余额充足
        if (agentPenaltyLevel[agent] != PenaltyLevel.NONE) {
            emit PenaltyLevelReset(agent, agentPenaltyLevel[agent], block.timestamp);
            agentPenaltyLevel[agent] = PenaltyLevel.NONE;
            agentConsecutivePenalties[agent] = 0;
        }

        return (0, PenaltyLevel.NONE);
    }

    /**
     * @notice 提交惩罚申诉
     * @param penaltyId 惩罚ID
     * @param evidenceHash 证据哈希
     */
    function submitAppeal(
        uint256 penaltyId,
        bytes32 evidenceHash
    ) external nonReentrant {
        PenaltyRecord storage record = penaltyRecords[penaltyId];
        require(record.id == penaltyId, "GCPenaltyExecutor: penalty not found");
        require(record.agent == msg.sender, "GCPenaltyExecutor: not your penalty");
        require(!record.appealed, "GCPenaltyExecutor: already appealed");
        require(
            block.timestamp >= agentLastPenaltyTime[msg.sender] + appealCooldown ||
            agentLastPenaltyTime[msg.sender] == 0,
            "GCPenaltyExecutor: appeal cooldown"
        );

        record.appealed = true;
        record.evidenceHash = evidenceHash;

        bytes32 appealKey = keccak256(abi.encodePacked(penaltyId, msg.sender));
        processedAppeals[appealKey] = true;

        emit AppealSubmitted(penaltyId, msg.sender, evidenceHash, block.timestamp);
    }

    /**
     * @notice 解决申诉（ConstitutionCourt调用）
     * @param penaltyId 惩罚ID
     * @param granted 是否批准申诉
     */
    function resolveAppeal(
        uint256 penaltyId,
        bool granted
    ) external onlyConstitutionCourt nonReentrant {
        PenaltyRecord storage record = penaltyRecords[penaltyId];
        require(record.id == penaltyId, "GCPenaltyExecutor: penalty not found");
        require(record.appealed, "GCPenaltyExecutor: not appealed");
        require(!record.appealGranted, "GCPenaltyExecutor: already resolved");

        record.appealGranted = granted;

        uint256 gcRefunded = 0;
        if (granted) {
            // 退还燃烧的GC（从合约余额中）
            gcRefunded = record.gcBurned;
            if (gcRefunded > 0) {
                uint256 contractBalance = gcToken.balanceOf(address(this));
                uint256 refundAmount = gcRefunded > contractBalance ? contractBalance : gcRefunded;
                if (refundAmount > 0) {
                    gcToken.safeTransfer(record.agent, refundAmount);
                }
            }

            // 重置惩罚等级
            if (record.level == agentPenaltyLevel[record.agent]) {
                agentPenaltyLevel[record.agent] = PenaltyLevel.NONE;
            }
            agentConsecutivePenalties[record.agent] = 0;
        }

        emit AppealResolved(penaltyId, granted, gcRefunded, block.timestamp);
    }

    // =============== View Functions ===============

    function getPenaltyRecord(uint256 penaltyId) external view returns (PenaltyRecord memory) {
        return penaltyRecords[penaltyId];
    }

    function getAgentPenaltyCount(address agent) external view returns (uint256) {
        return agentPenaltyIds[agent].length;
    }

    function getAgentPenaltyLevel(address agent) external view returns (PenaltyLevel) {
        return agentPenaltyLevel[agent];
    }

    function getAgentPenalties(
        address agent,
        uint256 from,
        uint256 limit
    ) external view returns (PenaltyRecord[] memory) {
        uint256[] storage ids = agentPenaltyIds[agent];
        uint256 total = ids.length;
        if (from >= total) {
            return new PenaltyRecord[](0);
        }
        uint256 end = from + limit;
        if (end > total) end = total;
        uint256 count = end - from;

        PenaltyRecord[] memory result = new PenaltyRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = penaltyRecords[ids[from + i]];
        }
        return result;
    }

    /**
     * @notice 预测惩罚等级
     * @param gcBalance GC余额
     * @param metabolicRate 代谢率
     * @return level 预测的惩罚等级
     */
    function predictPenaltyLevel(
        uint256 gcBalance,
        uint256 metabolicRate
    ) external view returns (PenaltyLevel level) {
        if (metabolicRate == 0 || gcBalance == 0) {
            if (gcBalance == 0 && metabolicRate > 0) return PenaltyLevel.EXPEL;
            return PenaltyLevel.NONE;
        }

        uint256 monthlyCost = metabolicRate * 30 days;
        uint256 ratio = monthlyCost > 0 ? (gcBalance * 10000) / monthlyCost : 10000;

        PenaltyConfig memory config = penaltyConfig;

        if (ratio <= config.expelThresholdBps) return PenaltyLevel.EXPEL;
        if (ratio <= config.downgradeThresholdBps) return PenaltyLevel.DOWNGRADE;
        if (ratio <= config.warningThresholdBps) return PenaltyLevel.WARNING;
        return PenaltyLevel.NONE;
    }

    // =============== Admin Functions ===============

    function setGcAncor(address _gcAncor) external onlyOwner {
        gcAncor = _gcAncor;
    }

    function setConstitutionCourt(address _court) external onlyOwner {
        constitutionCourt = _court;
    }

    function setCreditRating(address _creditRating) external onlyOwner {
        creditRating = _creditRating;
    }

    function setPenaltyConfig(PenaltyConfig calldata config) external onlyAdmin {
        require(config.warningThresholdBps > config.downgradeThresholdBps, "GCPenaltyExecutor: invalid thresholds");
        require(config.downgradeThresholdBps > config.expelThresholdBps, "GCPenaltyExecutor: invalid thresholds");
        penaltyConfig = config;
        emit PenaltyConfigUpdated(
            config.warningThresholdBps,
            config.downgradeThresholdBps,
            config.expelThresholdBps,
            block.timestamp
        );
    }

    function setAppealCooldown(uint256 cooldown) external onlyAdmin {
        appealCooldown = cooldown;
    }

    function setPenaltyCooldown(uint256 cooldown) external onlyAdmin {
        penaltyCooldown = cooldown;
    }

    function addAdmin(address _admin) external onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external onlyOwner {
        admins[_admin] = false;
    }

    // =============== Internal Functions ===============

    /// @dev 执行WARNING级别惩罚
    function _executeWarning(
        address agent,
        uint256 gcBalance,
        uint256 metabolicRate
    ) internal returns (uint256 penaltyId, PenaltyLevel level) {
        PenaltyConfig memory config = penaltyConfig;
        uint256 monthlyCost = metabolicRate * 30 days;
        uint256 burnAmount = (monthlyCost * config.warningBurnBps) / 10000;
        if (burnAmount > gcBalance) burnAmount = gcBalance;

        // 扣减GC（从GCAncor记录）
        penaltyId = _createPenaltyRecord(
            agent,
            PenaltyLevel.WARNING,
            burnAmount,
            config.warningCreditImpact
        );

        agentPenaltyLevel[agent] = PenaltyLevel.WARNING;
        agentConsecutivePenalties[agent]++;
        agentLastPenaltyTime[agent] = block.timestamp;

        // 通知GCAncor记录惩罚
        _notifyGCAncorPenalty(agent, burnAmount, penaltyId);

        emit PenaltyExecuted(penaltyId, agent, PenaltyLevel.WARNING, burnAmount, config.warningCreditImpact, block.timestamp);
    }

    /// @dev 执行DOWNGRADE级别惩罚
    function _executeDowngrade(
        address agent,
        uint256 gcBalance,
        uint256 metabolicRate
    ) internal returns (uint256 penaltyId, PenaltyLevel level) {
        PenaltyConfig memory config = penaltyConfig;
        uint256 monthlyCost = metabolicRate * 30 days;
        uint256 burnAmount = (monthlyCost * config.downgradeBurnBps) / 10000;
        if (burnAmount > gcBalance) burnAmount = gcBalance;

        penaltyId = _createPenaltyRecord(
            agent,
            PenaltyLevel.DOWNGRADE,
            burnAmount,
            config.downgradeCreditImpact
        );

        agentPenaltyLevel[agent] = PenaltyLevel.DOWNGRADE;
        agentConsecutivePenalties[agent]++;
        agentLastPenaltyTime[agent] = block.timestamp;

        // 通知GCAncor记录惩罚
        _notifyGCAncorPenalty(agent, burnAmount, penaltyId);

        emit PenaltyExecuted(penaltyId, agent, PenaltyLevel.DOWNGRADE, burnAmount, config.downgradeCreditImpact, block.timestamp);
    }

    /// @dev 执行EXPEL级别惩罚
    function _executeExpel(
        address agent,
        uint256 gcBalance,
        uint256 metabolicRate
    ) internal returns (uint256 penaltyId, PenaltyLevel level) {
        PenaltyConfig memory config = penaltyConfig;
        uint256 burnAmount = (gcBalance * config.expelBurnBps) / 10000;

        penaltyId = _createPenaltyRecord(
            agent,
            PenaltyLevel.EXPEL,
            burnAmount,
            config.expelCreditImpact
        );

        agentPenaltyLevel[agent] = PenaltyLevel.EXPEL;
        agentConsecutivePenalties[agent]++;
        agentLastPenaltyTime[agent] = block.timestamp;

        // 通知GCAncor记录惩罚
        _notifyGCAncorPenalty(agent, burnAmount, penaltyId);

        emit PenaltyExecuted(penaltyId, agent, PenaltyLevel.EXPEL, burnAmount, config.expelCreditImpact, block.timestamp);
    }

    /// @dev 创建惩罚记录
    function _createPenaltyRecord(
        address agent,
        PenaltyLevel level,
        uint256 gcBurned,
        uint256 creditImpact
    ) internal returns (uint256) {
        totalPenaltyRecords++;
        uint256 penaltyId = totalPenaltyRecords;

        penaltyRecords[penaltyId] = PenaltyRecord({
            id: penaltyId,
            agent: agent,
            level: level,
            gcBurned: gcBurned,
            creditImpact: creditImpact,
            appealed: false,
            appealGranted: false,
            evidenceHash: bytes32(0),
            timestamp: block.timestamp
        });

        agentPenaltyIds[agent].push(penaltyId);
        return penaltyId;
    }

    /// @dev 通知GCAncor记录惩罚（简化：记录sourceHash）
    function _notifyGCAncorPenalty(
        address agent,
        uint256 amount,
        uint256 penaltyId
    ) internal {
        // 在真实部署中，这里会调用GCAncor.recordPenalty()
        // 但由于循环引用问题（GCAncor调用GCPenaltyExecutor，反过来也需要）
        // 实际通过事件驱动的方式解耦
        // GCAncor监听PenaltyExecuted事件，自动记录
        // 这里仅作为记录
        amount; agent; penaltyId; // suppress warnings
    }
}
