// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationStaking
 * @notice V12.0 声誉担保合约 — 高评级Agent可担保新Agent
 * @dev 6GNetGPT"众筹协作"思想融合
 *      A+评级Agent质押Σ代币为新Agent担保
 *      被担保者行为良好→担保者获奖励；违约→罚没
 */
contract ReputationStaking is Ownable {

    // =============== Structs ===============

    struct Vouch {
        address voucher;       // 担保者
        address vouchee;       // 被担保者
        uint256 stakeAmount;   // 质押金额
        bool isActive;         // 是否活跃
        uint256 createdAt;     // 创建时间
        uint256 releasedAt;    // 释放时间（0表示未释放）
    }

    // =============== Constants ===============

    uint256 public constant MIN_VOUCH_STAKE = 0.5 ether;
    uint256 public constant MIN_HOLD_PERIOD = 30 days;

    // =============== State Variables ===============

    /// @notice CreditRating合约地址
    address public creditRating;

    /// @notice voucher => vouchee => Vouch
    mapping(address => mapping(address => Vouch)) public vouches;

    /// @notice vouchee => 所有担保者列表
    mapping(address => address[]) public voucheeVouchers;

    /// @notice voucher => 担保总额
    mapping(address => uint256) public totalVouchStake;

    /// @notice 罚没资金接收地址
    address public treasury;

    // =============== Events ===============

    event VouchCreated(address indexed voucher, address indexed vouchee, uint256 stakeAmount);
    event VouchReleased(address indexed voucher, address indexed vouchee, uint256 stakeAmount);
    event VouchSlashed(address indexed voucher, address indexed vouchee, uint256 slashAmount);

    // =============== Constructor ===============

    constructor(address _creditRating) Ownable(msg.sender) {
        creditRating = _creditRating;
        treasury = msg.sender;
    }

    // =============== External Functions ===============

    /**
     * @notice 为新Agent做声誉担保
     * @param vouchee 被担保者地址
     */
    function vouchFor(address vouchee) external payable {
        require(msg.value >= MIN_VOUCH_STAKE, "ReputationStaking: insufficient stake");
        require(vouchee != msg.sender, "ReputationStaking: cannot vouch for self");
        require(vouches[msg.sender][vouchee].voucher == address(0), "ReputationStaking: already vouched");

        // 检查调用者是否有担保资格（A+评级）
        require(
            ICreditRatingForVouch(creditRating).canVouch(msg.sender),
            "ReputationStaking: not eligible to vouch"
        );

        vouches[msg.sender][vouchee] = Vouch({
            voucher: msg.sender,
            vouchee: vouchee,
            stakeAmount: msg.value,
            isActive: true,
            createdAt: block.timestamp,
            releasedAt: 0
        });

        voucheeVouchers[vouchee].push(msg.sender);
        totalVouchStake[msg.sender] += msg.value;

        emit VouchCreated(msg.sender, vouchee, msg.value);
    }

    /**
     * @notice 释放担保（需30天后）
     * @param vouchee 被担保者地址
     */
    function releaseVouch(address vouchee) external {
        Vouch storage v = vouches[msg.sender][vouchee];
        require(v.voucher == msg.sender, "ReputationStaking: not your vouch");
        require(v.isActive, "ReputationStaking: not active");
        require(
            block.timestamp >= v.createdAt + MIN_HOLD_PERIOD,
            "ReputationStaking: hold period not elapsed"
        );

        v.isActive = false;
        v.releasedAt = block.timestamp;
        uint256 refund = v.stakeAmount;
        v.stakeAmount = 0;
        totalVouchStake[msg.sender] -= refund;

        (bool sent, ) = payable(msg.sender).call{value: refund}("");
        require(sent, "ReputationStaking: refund failed");

        emit VouchReleased(msg.sender, vouchee, refund);
    }

    /**
     * @notice 罚没担保质押（仅owner，被担保者违约时）
     * @param voucher 担保者
     * @param vouchee 被担保者
     */
    function slashVouch(address voucher, address vouchee) external onlyOwner {
        Vouch storage v = vouches[voucher][vouchee];
        require(v.isActive, "ReputationStaking: not active");

        v.isActive = false;
        v.releasedAt = block.timestamp;
        uint256 slashAmount = v.stakeAmount;
        v.stakeAmount = 0;
        totalVouchStake[voucher] -= slashAmount;

        (bool sent, ) = payable(treasury).call{value: slashAmount}("");
        require(sent, "ReputationStaking: slash transfer failed");

        emit VouchSlashed(voucher, vouchee, slashAmount);
    }

    // =============== View Functions ===============

    /**
     * @notice 获取被担保者的所有活跃担保
     */
    function getActiveVouches(address vouchee) external view returns (
        address[] memory vouchers,
        uint256[] memory stakes
    ) {
        address[] storage allVouchers = voucheeVouchers[vouchee];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < allVouchers.length; i++) {
            if (vouches[allVouchers[i]][vouchee].isActive) {
                activeCount++;
            }
        }

        vouchers = new address[](activeCount);
        stakes = new uint256[](activeCount);
        uint256 idx = 0;

        for (uint256 i = 0; i < allVouchers.length; i++) {
            Vouch storage v = vouches[allVouchers[i]][vouchee];
            if (v.isActive) {
                vouchers[idx] = v.voucher;
                stakes[idx] = v.stakeAmount;
                idx++;
            }
        }
    }

    /**
     * @notice 检查Agent是否有活跃担保
     */
    function hasActiveVouch(address vouchee) external view returns (bool) {
        address[] storage allVouchers = voucheeVouchers[vouchee];
        for (uint256 i = 0; i < allVouchers.length; i++) {
            if (vouches[allVouchers[i]][vouchee].isActive) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice 获取担保信息
     */
    function getVouch(address voucher, address vouchee) external view returns (
        uint256 stakeAmount,
        bool isActive,
        uint256 createdAt,
        uint256 releasedAt
    ) {
        Vouch storage v = vouches[voucher][vouchee];
        return (v.stakeAmount, v.isActive, v.createdAt, v.releasedAt);
    }

    // =============== Admin Functions ===============

    function setCreditRating(address _creditRating) external onlyOwner {
        creditRating = _creditRating;
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
}

// =============== Interfaces ===============

interface ICreditRatingForVouch {
    function canVouch(address agent) external view returns (bool);
}
