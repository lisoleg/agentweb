// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AIResourceConsumption
 * @notice AI"食物"消费闭环合约 — 三要素消费：能源(Energy)/存储(Storage)/带宽(Bandwidth)
 * @dev 每笔消费从GC(Calc Token)余额扣减，动态定价基于Φ权重修正，自动续费与降级
 *
 * 三要素: Energy / Storage / Bandwidth
 * 动态定价: basePrice × Φ修正系数（高Φ→折扣，低Φ→溢价）
 * 自动续费: 订阅模式，余额不足时自动降级
 * 与GCCRental集成: 资源+算力构成完整消费闭环
 */
contract AIResourceConsumption is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Enums ===============

    enum ResourceType {
        ENERGY,    // 能源
        STORAGE,   // 存储
        BANDWIDTH  // 带宽
    }

    enum SubscriptionTier {
        FREE,       // 免费档
        BASIC,      // 基础档
        PRO,        // 专业档
        ENTERPRISE  // 企业档
    }

    // =============== Structs ===============

    struct ResourcePrice {
        ResourceType resourceType;
        uint256 basePricePerUnit;    // 基础单价 (GC wei per unit)
        uint256 phiDiscountBps;      // Φ折扣(基点) 高Φ折扣率 (如3000 = 30% off)
        uint256 phiPremiumBps;       // Φ溢价(基点) 低Φ溢价率 (如5000 = 50% extra)
        uint256 phiFreeThreshold;    // Φ值免费阈值 (>= 此值免费)
        uint256 phiStandardThreshold;// Φ值标准阈值 (>= 此值标准价)
        uint256 unitDecimals;        // 单位精度
        string unitName;             // 单位名称
    }

    struct Consumption {
        uint256 agentId;           // Agent NFT ID
        ResourceType resourceType; // 资源类型
        uint256 units;             // 消费数量
        uint256 gcCost;            // GC花费
        uint256 phiScore;          // 消费时Φ值
        uint256 timestamp;         // 消费时间
        bool settled;              // 是否已结算
    }

    struct Subscription {
        uint256 agentId;             // Agent NFT ID
        SubscriptionTier tier;       // 订阅档位
        ResourceType resourceType;   // 资源类型
        uint256 unitsIncluded;       // 包含单位数
        uint256 gcCostPerPeriod;     // 每期GC费用
        uint256 periodSeconds;       // 周期秒数
        uint256 startTimestamp;      // 开始时间
        uint256 nextRenewal;         // 下次续费时间
        uint256 unitsUsed;           // 已用单位数
        bool autoRenew;              // 是否自动续费
        bool active;                 // 是否活跃
    }

    // =============== State Variables ===============

    IERC20 public immutable gcToken;

    /// @notice GCCRental合约地址
    address public gccRental;

    /// @notice PhiAgentNFT合约地址
    address public phiAgentNFT;

    /// @notice 资源定价配置
    mapping(ResourceType => ResourcePrice) public resourcePrices;

    /// @notice consumptionId => 消费记录
    mapping(uint256 => Consumption) public consumptions;

    /// @notice 消费记录总数
    uint256 public totalConsumptions;

    /// @notice agentId => resourceType => 订阅
    mapping(uint256 => mapping(ResourceType => Subscription)) public subscriptions;

    /// @notice agentId => 总GC消费
    mapping(uint256 => uint256) public agentTotalConsumption;

    /// @notice agentId => resourceType => 本周期消费量
    mapping(uint256 => mapping(ResourceType => uint256)) public agentPeriodConsumption;

    /// @notice 订阅档位配置: tier => resourceType => unitsIncluded + gcCostPerPeriod
    mapping(SubscriptionTier => mapping(ResourceType => uint256)) public tierUnitsIncluded;
    mapping(SubscriptionTier => mapping(ResourceType => uint256)) public tierCostPerPeriod;

    /// @notice 管理员列表
    mapping(address => bool) public admins;

    /// @notice Φ值最大值
    uint256 public constant MAX_PHI = 10000;

    // =============== Events ===============

    event Consumed(
        uint256 indexed agentId,
        ResourceType resourceType,
        uint256 units,
        uint256 gcCost,
        uint256 phiScore,
        uint256 timestamp
    );

    event Subscribed(
        uint256 indexed agentId,
        ResourceType resourceType,
        SubscriptionTier tier,
        uint256 gcCostPerPeriod,
        uint256 timestamp
    );

    event SubscriptionRenewed(
        uint256 indexed agentId,
        ResourceType resourceType,
        uint256 gcCost,
        uint256 nextRenewal,
        uint256 timestamp
    );

    event SubscriptionDowngraded(
        uint256 indexed agentId,
        ResourceType resourceType,
        SubscriptionTier oldTier,
        SubscriptionTier newTier,
        uint256 timestamp
    );

    event SubscriptionCancelled(
        uint256 indexed agentId,
        ResourceType resourceType,
        uint256 timestamp
    );

    event ResourcePriceUpdated(
        ResourceType resourceType,
        uint256 basePrice,
        uint256 timestamp
    );

    // =============== Modifiers ===============

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "AIResourceConsumption: not admin");
        _;
    }

    // =============== Constructor ===============

    constructor(
        address _gcToken,
        address _gccRental,
        address _phiAgentNFT
    ) Ownable(msg.sender) {
        require(_gcToken != address(0), "AIResourceConsumption: zero gcToken");
        gcToken = IERC20(_gcToken);
        gccRental = _gccRental;
        phiAgentNFT = _phiAgentNFT;

        admins[msg.sender] = true;

        // 初始化资源定价
        resourcePrices[ResourceType.ENERGY] = ResourcePrice({
            resourceType: ResourceType.ENERGY,
            basePricePerUnit: 1e14,     // 0.0001 GC per Wh
            phiDiscountBps: 3000,       // 30% off for high-Φ
            phiPremiumBps: 5000,        // 50% extra for low-Φ
            phiFreeThreshold: 8000,     // Φ >= 0.80 → free
            phiStandardThreshold: 4000, // Φ >= 0.40 → standard
            unitDecimals: 3,
            unitName: "Wh"
        });

        resourcePrices[ResourceType.STORAGE] = ResourcePrice({
            resourceType: ResourceType.STORAGE,
            basePricePerUnit: 5e13,     // 0.00005 GC per GB
            phiDiscountBps: 2500,       // 25% off
            phiPremiumBps: 4000,        // 40% extra
            phiFreeThreshold: 7500,     // Φ >= 0.75 → free
            phiStandardThreshold: 3500, // Φ >= 0.35 → standard
            unitDecimals: 0,
            unitName: "GB"
        });

        resourcePrices[ResourceType.BANDWIDTH] = ResourcePrice({
            resourceType: ResourceType.BANDWIDTH,
            basePricePerUnit: 2e13,     // 0.00002 GC per Mbps
            phiDiscountBps: 2000,       // 20% off
            phiPremiumBps: 3000,        // 30% extra
            phiFreeThreshold: 7000,     // Φ >= 0.70 → free
            phiStandardThreshold: 3000, // Φ >= 0.30 → standard
            unitDecimals: 0,
            unitName: "Mbps"
        });

        // 初始化订阅档位
        _initSubscriptionTiers();
    }

    // =============== External Functions ===============

    /**
     * @notice 消费资源（按需付费）
     * @param agentId Agent NFT ID
     * @param resourceType 资源类型
     * @param units 消费数量
     * @param phiScore 当前Φ值
     */
    function consume(
        uint256 agentId,
        ResourceType resourceType,
        uint256 units,
        uint256 phiScore
    ) external whenNotPaused nonReentrant {
        require(units > 0, "AIResourceConsumption: zero units");
        require(phiScore <= MAX_PHI, "AIResourceConsumption: invalid phi");

        // 检查订阅是否覆盖
        Subscription storage sub = subscriptions[agentId][resourceType];
        if (sub.active && sub.unitsUsed + units <= sub.unitsIncluded) {
            sub.unitsUsed += units;
            agentPeriodConsumption[agentId][resourceType] += units;
            emit Consumed(agentId, resourceType, units, 0, phiScore, block.timestamp);
            return;
        }

        // 计算Φ动态价格
        uint256 gcCost = _calculatePhiPrice(resourceType, units, phiScore);

        // 扣减GC
        gcToken.safeTransferFrom(msg.sender, address(this), gcCost);

        // 记录消费
        totalConsumptions++;
        consumptions[totalConsumptions] = Consumption({
            agentId: agentId,
            resourceType: resourceType,
            units: units,
            gcCost: gcCost,
            phiScore: phiScore,
            timestamp: block.timestamp,
            settled: true
        });

        agentTotalConsumption[agentId] += gcCost;
        agentPeriodConsumption[agentId][resourceType] += units;

        // 如果有订阅，也记录超额使用
        if (sub.active) {
            sub.unitsUsed += units;
        }

        emit Consumed(agentId, resourceType, units, gcCost, phiScore, block.timestamp);
    }

    /**
     * @notice 订阅资源
     * @param agentId Agent NFT ID
     * @param resourceType 资源类型
     * @param tier 订阅档位
     * @param autoRenew 是否自动续费
     */
    function subscribe(
        uint256 agentId,
        ResourceType resourceType,
        SubscriptionTier tier,
        bool autoRenew
    ) external whenNotPaused nonReentrant {
        Subscription storage existing = subscriptions[agentId][resourceType];
        require(!existing.active, "AIResourceConsumption: subscription exists");

        uint256 costPerPeriod = tierCostPerPeriod[tier][resourceType];
        require(costPerPeriod > 0, "AIResourceConsumption: invalid tier");

        // 扣减首期GC
        gcToken.safeTransferFrom(msg.sender, address(this), costPerPeriod);

        uint256 periodSeconds = 30 days; // 默认30天周期

        subscriptions[agentId][resourceType] = Subscription({
            agentId: agentId,
            tier: tier,
            resourceType: resourceType,
            unitsIncluded: tierUnitsIncluded[tier][resourceType],
            gcCostPerPeriod: costPerPeriod,
            periodSeconds: periodSeconds,
            startTimestamp: block.timestamp,
            nextRenewal: block.timestamp + periodSeconds,
            unitsUsed: 0,
            autoRenew: autoRenew,
            active: true
        });

        emit Subscribed(agentId, resourceType, tier, costPerPeriod, block.timestamp);
    }

    /**
     * @notice 续费订阅（到期时由keeper或agent调用）
     * @param agentId Agent NFT ID
     * @param resourceType 资源类型
     */
    function renewSubscription(
        uint256 agentId,
        ResourceType resourceType
    ) external whenNotPaused nonReentrant {
        Subscription storage sub = subscriptions[agentId][resourceType];
        require(sub.active, "AIResourceConsumption: no active subscription");
        require(block.timestamp >= sub.nextRenewal, "AIResourceConsumption: not due yet");
        require(sub.autoRenew, "AIResourceConsumption: auto-renew disabled");

        uint256 cost = sub.gcCostPerPeriod;

        // 尝试扣减GC
        uint256 balance = gcToken.balanceOf(msg.sender);
        uint256 allowance = gcToken.allowance(msg.sender, address(this));

        if (balance >= cost && allowance >= cost) {
            gcToken.safeTransferFrom(msg.sender, address(this), cost);
            sub.unitsUsed = 0;
            sub.nextRenewal = block.timestamp + sub.periodSeconds;

            emit SubscriptionRenewed(agentId, resourceType, cost, sub.nextRenewal, block.timestamp);
        } else {
            // 余额不足，自动降级
            _downgradeSubscription(agentId, resourceType);
        }
    }

    /**
     * @notice 取消订阅
     */
    function cancelSubscription(uint256 agentId, ResourceType resourceType) external {
        Subscription storage sub = subscriptions[agentId][resourceType];
        require(sub.active, "AIResourceConsumption: no active subscription");
        // 仅agent钱包或管理员可取消
        require(
            admins[msg.sender] || msg.sender == owner(),
            "AIResourceConsumption: not authorized"
        );

        sub.active = false;
        emit SubscriptionCancelled(agentId, resourceType, block.timestamp);
    }

    /**
     * @notice 批量结算消费（keeper调用）
     */
    function batchSettle(
        uint256[] calldata agentIds,
        ResourceType[] calldata resourceTypes,
        uint256[] calldata units,
        uint256[] calldata phiScores
    ) external onlyAdmin {
        require(agentIds.length == resourceTypes.length, "AIResourceConsumption: length mismatch");
        require(agentIds.length == units.length, "AIResourceConsumption: length mismatch");
        require(agentIds.length == phiScores.length, "AIResourceConsumption: length mismatch");

        for (uint256 i = 0; i < agentIds.length; i++) {
            // 直接记录消费（GC已在其他地方扣减或由结算合约处理）
            totalConsumptions++;
            consumptions[totalConsumptions] = Consumption({
                agentId: agentIds[i],
                resourceType: resourceTypes[i],
                units: units[i],
                gcCost: _calculatePhiPrice(resourceTypes[i], units[i], phiScores[i]),
                phiScore: phiScores[i],
                timestamp: block.timestamp,
                settled: true
            });
            agentPeriodConsumption[agentIds[i]][resourceTypes[i]] += units[i];
        }
    }

    // =============== View Functions ===============

    function calculatePrice(
        ResourceType resourceType,
        uint256 units,
        uint256 phiScore
    ) external view returns (uint256) {
        return _calculatePhiPrice(resourceType, units, phiScore);
    }

    function getSubscription(
        uint256 agentId,
        ResourceType resourceType
    ) external view returns (Subscription memory) {
        return subscriptions[agentId][resourceType];
    }

    function getConsumption(uint256 consumptionId) external view returns (Consumption memory) {
        return consumptions[consumptionId];
    }

    function getAgentTotalConsumption(uint256 agentId) external view returns (uint256) {
        return agentTotalConsumption[agentId];
    }

    function getAgentPeriodConsumption(
        uint256 agentId,
        ResourceType resourceType
    ) external view returns (uint256) {
        return agentPeriodConsumption[agentId][resourceType];
    }

    // =============== Admin Functions ===============

    function setResourcePrice(
        ResourceType resourceType,
        uint256 basePricePerUnit,
        uint256 phiDiscountBps,
        uint256 phiPremiumBps,
        uint256 phiFreeThreshold,
        uint256 phiStandardThreshold
    ) external onlyAdmin {
        resourcePrices[resourceType] = ResourcePrice({
            resourceType: resourceType,
            basePricePerUnit: basePricePerUnit,
            phiDiscountBps: phiDiscountBps,
            phiPremiumBps: phiPremiumBps,
            phiFreeThreshold: phiFreeThreshold,
            phiStandardThreshold: phiStandardThreshold,
            unitDecimals: resourcePrices[resourceType].unitDecimals,
            unitName: resourcePrices[resourceType].unitName
        });
        emit ResourcePriceUpdated(resourceType, basePricePerUnit, block.timestamp);
    }

    function setSubscriptionTierConfig(
        SubscriptionTier tier,
        ResourceType resourceType,
        uint256 unitsIncluded,
        uint256 costPerPeriod
    ) external onlyAdmin {
        tierUnitsIncluded[tier][resourceType] = unitsIncluded;
        tierCostPerPeriod[tier][resourceType] = costPerPeriod;
    }

    function setGccRental(address _gccRental) external onlyOwner {
        gccRental = _gccRental;
    }

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

    // =============== Internal Functions ===============

    /// @dev 计算Φ动态价格
    function _calculatePhiPrice(
        ResourceType resourceType,
        uint256 units,
        uint256 phiScore
    ) internal view returns (uint256) {
        ResourcePrice memory price = resourcePrices[resourceType];

        // 免费档
        if (phiScore >= price.phiFreeThreshold) {
            return 0;
        }

        uint256 baseCost = units * price.basePricePerUnit;

        if (phiScore >= price.phiStandardThreshold) {
            // 标准价 + Φ折扣
            uint256 discount = (baseCost * price.phiDiscountBps) / 10000;
            // 折扣随Φ值线性增加
            uint256 phiFactor = (phiScore - price.phiStandardThreshold) * 10000 /
                (price.phiFreeThreshold - price.phiStandardThreshold);
            discount = (discount * phiFactor) / 10000;
            return baseCost - discount;
        } else {
            // 溢价 + 低Φ惩罚
            uint256 premium = (baseCost * price.phiPremiumBps) / 10000;
            // 溢价随Φ值降低线性增加
            uint256 lowPhiFactor = (price.phiStandardThreshold - phiScore) * 10000 /
                price.phiStandardThreshold;
            premium = (premium * lowPhiFactor) / 10000;
            return baseCost + premium;
        }
    }

    /// @dev 自动降级订阅
    function _downgradeSubscription(uint256 agentId, ResourceType resourceType) internal {
        Subscription storage sub = subscriptions[agentId][resourceType];
        SubscriptionTier oldTier = sub.tier;

        if (sub.tier == SubscriptionTier.ENTERPRISE) {
            sub.tier = SubscriptionTier.PRO;
        } else if (sub.tier == SubscriptionTier.PRO) {
            sub.tier = SubscriptionTier.BASIC;
        } else if (sub.tier == SubscriptionTier.BASIC) {
            sub.tier = SubscriptionTier.FREE;
        } else {
            // FREE档无法再降 → 取消
            sub.active = false;
            emit SubscriptionCancelled(agentId, resourceType, block.timestamp);
            return;
        }

        sub.unitsIncluded = tierUnitsIncluded[sub.tier][resourceType];
        sub.gcCostPerPeriod = tierCostPerPeriod[sub.tier][resourceType];
        sub.unitsUsed = 0;
        sub.nextRenewal = block.timestamp + sub.periodSeconds;

        emit SubscriptionDowngraded(agentId, resourceType, oldTier, sub.tier, block.timestamp);
    }

    /// @dev 初始化订阅档位配置
    function _initSubscriptionTiers() internal {
        // ENERGY
        tierUnitsIncluded[SubscriptionTier.FREE][ResourceType.ENERGY] = 100;
        tierCostPerPeriod[SubscriptionTier.FREE][ResourceType.ENERGY] = 0;
        tierUnitsIncluded[SubscriptionTier.BASIC][ResourceType.ENERGY] = 1000;
        tierCostPerPeriod[SubscriptionTier.BASIC][ResourceType.ENERGY] = 5e16;   // 0.05 GC
        tierUnitsIncluded[SubscriptionTier.PRO][ResourceType.ENERGY] = 10000;
        tierCostPerPeriod[SubscriptionTier.PRO][ResourceType.ENERGY] = 2e17;     // 0.2 GC
        tierUnitsIncluded[SubscriptionTier.ENTERPRISE][ResourceType.ENERGY] = 100000;
        tierCostPerPeriod[SubscriptionTier.ENTERPRISE][ResourceType.ENERGY] = 8e17; // 0.8 GC

        // STORAGE
        tierUnitsIncluded[SubscriptionTier.FREE][ResourceType.STORAGE] = 10;
        tierCostPerPeriod[SubscriptionTier.FREE][ResourceType.STORAGE] = 0;
        tierUnitsIncluded[SubscriptionTier.BASIC][ResourceType.STORAGE] = 100;
        tierCostPerPeriod[SubscriptionTier.BASIC][ResourceType.STORAGE] = 3e16;    // 0.03 GC
        tierUnitsIncluded[SubscriptionTier.PRO][ResourceType.STORAGE] = 1000;
        tierCostPerPeriod[SubscriptionTier.PRO][ResourceType.STORAGE] = 1e17;      // 0.1 GC
        tierUnitsIncluded[SubscriptionTier.ENTERPRISE][ResourceType.STORAGE] = 10000;
        tierCostPerPeriod[SubscriptionTier.ENTERPRISE][ResourceType.STORAGE] = 5e17; // 0.5 GC

        // BANDWIDTH
        tierUnitsIncluded[SubscriptionTier.FREE][ResourceType.BANDWIDTH] = 50;
        tierCostPerPeriod[SubscriptionTier.FREE][ResourceType.BANDWIDTH] = 0;
        tierUnitsIncluded[SubscriptionTier.BASIC][ResourceType.BANDWIDTH] = 500;
        tierCostPerPeriod[SubscriptionTier.BASIC][ResourceType.BANDWIDTH] = 2e16;   // 0.02 GC
        tierUnitsIncluded[SubscriptionTier.PRO][ResourceType.BANDWIDTH] = 5000;
        tierCostPerPeriod[SubscriptionTier.PRO][ResourceType.BANDWIDTH] = 8e16;     // 0.08 GC
        tierUnitsIncluded[SubscriptionTier.ENTERPRISE][ResourceType.BANDWIDTH] = 50000;
        tierCostPerPeriod[SubscriptionTier.ENTERPRISE][ResourceType.BANDWIDTH] = 3e17; // 0.3 GC
    }
}
