// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PhiStaking
 * @dev Staking contract with Φ-based reward calculation
 *
 * Features:
 * - Stake Phi tokens
 * - Unstake with time lock
 * - Calculate rewards based on Φ value
 * - voting power calculation
 */
contract PhiStaking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============== Structs ===============

    struct StakeInfo {
        uint256 amount; // Staked amount
        uint256 phiValue; // Φ value (0-10000, 2 decimals)
        int256 phiPhase;       // EML phase angle (-3141593 to 3141593, i.e. ±π × 1e6)
        uint256 rewardDebt; // Reward debt
        uint256 lastUpdateTime; // Last update timestamp
        uint256 lockEndTime; // Lock end time (0 = no lock)
    }

    // =============== State Variables ===============

    IERC20 public immutable stakingToken; // Phi Token (ERC-20)
    uint256 public rewardPerTokenStored; // Accumulated reward per token
    uint256 public lastUpdateTime; // Last reward update
    uint256 public rewardRate; // Reward rate per second
    uint256 public totalStaked; // Total staked amount
    uint256 public minStakeAmount; // Minimum stake amount
    uint256 public maxStakeAmount; // Maximum stake amount per user
    uint256 public lockDuration; // Default lock duration in seconds

    // Phi value related
    uint256 public constant MAX_PHI_VALUE = 10000; // 100.00%
    uint256 public phiBoostRate; // Reward boost based on Φ (0-10000)

    // User stakes: user => StakeInfo
    mapping(address => StakeInfo) private s_stakes;

    // Reward per token paid: user => amount
    mapping(address => uint256) private s_rewardPerTokenPaid;
    mapping(address => uint256) public s_rewards; // Pending rewards

    // =============== Events ===============

    event Staked(address indexed user, uint256 amount, uint256 phiValue, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardPaid(address indexed user, uint256 reward, uint256 timestamp);
    event PhiValueUpdated(address indexed user, uint256 oldPhiValue, uint256 newPhiValue);
    event PhiPhaseUpdated(address indexed user, int256 oldPhiPhase, int256 newPhiPhase);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event LockDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // =============== Constructor ===============

    constructor(
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _minStakeAmount,
        uint256 _maxStakeAmount
    ) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        require(_rewardRate > 0, "Invalid reward rate");

        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        minStakeAmount = _minStakeAmount;
        maxStakeAmount = _maxStakeAmount;
        phiBoostRate = 5000; // Default 50% boost at max Φ
        lockDuration = 0; // No lock by default
    }

    // =============== External Functions ===============

    /**
     * @notice Stake tokens
     * @param amount Amount to stake
     * @param phiValue Φ value (0-10000)
     */
    function stake(uint256 amount, uint256 phiValue)
        external
        whenNotPaused
        nonReentrant
        returns (bool)
    {
        require(amount >= minStakeAmount, "Amount below minimum");
        require(
            s_stakes[msg.sender].amount + amount <= maxStakeAmount,
            "Exceeds maximum"
        );
        require(phiValue <= MAX_PHI_VALUE, "Invalid Phi value");

        // Update rewards
        _updateReward(msg.sender);

        // Transfer tokens
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Update stake info
        StakeInfo storage stakeInfo = s_stakes[msg.sender];
        uint256 oldPhiValue = stakeInfo.phiValue;

        stakeInfo.amount += amount;
        stakeInfo.phiValue = phiValue; // Update Φ value
        stakeInfo.lastUpdateTime = block.timestamp;

        totalStaked += amount;

        emit Staked(msg.sender, amount, phiValue, block.timestamp);
        if (oldPhiValue != phiValue) {
            emit PhiValueUpdated(msg.sender, oldPhiValue, phiValue);
        }

        return true;
    }

    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount)
        external
        whenNotPaused
        nonReentrant
        returns (bool)
    {
        StakeInfo storage stakeInfo = s_stakes[msg.sender];
        require(stakeInfo.amount >= amount, "Insufficient staked amount");
        require(amount > 0, "Amount must be > 0");

        // Check lock time
        if (stakeInfo.lockEndTime > 0) {
            require(block.timestamp >= stakeInfo.lockEndTime, "Tokens are locked");
        }

        // Update rewards
        _updateReward(msg.sender);

        // Update stake info
        stakeInfo.amount -= amount;
        stakeInfo.lastUpdateTime = block.timestamp;

        totalStaked -= amount;

        // Transfer tokens back
        stakingToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, block.timestamp);

        return true;
    }

    /**
     * @notice Claim pending rewards
     */
    function claimReward() external nonReentrant returns (bool) {
        _updateReward(msg.sender);

        uint256 reward = s_rewards[msg.sender];
        require(reward > 0, "No rewards to claim");

        s_rewards[msg.sender] = 0;
        s_rewardPerTokenPaid[msg.sender] = rewardPerTokenStored;

        // Transfer reward tokens
        stakingToken.safeTransfer(msg.sender, reward);

        emit RewardPaid(msg.sender, reward, block.timestamp);

        return true;
    }

    /**
     * @notice Update user's Φ phase angle
     * @param newPhiPhase New Φ phase (×1e6, -3141593 to 3141593)
     */
    function updatePhiPhase(int256 newPhiPhase) external returns (bool) {
        require(newPhiPhase >= -3141593 && newPhiPhase <= 3141593, "Invalid Phi phase");

        _updateReward(msg.sender);

        StakeInfo storage stakeInfo = s_stakes[msg.sender];
        int256 oldPhiPhase = stakeInfo.phiPhase;
        stakeInfo.phiPhase = newPhiPhase;
        stakeInfo.lastUpdateTime = block.timestamp;

        emit PhiPhaseUpdated(msg.sender, oldPhiPhase, newPhiPhase);

        return true;
    }

    /**
     * @notice Update user's Φ value
     * @param newPhiValue New Φ value (0-10000)
     */
    function updatePhiValue(uint256 newPhiValue) external returns (bool) {
        require(newPhiValue <= MAX_PHI_VALUE, "Invalid Phi value");

        _updateReward(msg.sender);

        StakeInfo storage stakeInfo = s_stakes[msg.sender];
        uint256 oldPhiValue = stakeInfo.phiValue;

        stakeInfo.phiValue = newPhiValue;
        stakeInfo.lastUpdateTime = block.timestamp;

        emit PhiValueUpdated(msg.sender, oldPhiValue, newPhiValue);

        return true;
    }

    /**
     * @notice Calculate current reward for a user
     * @param user User address
     * @return Pending reward amount
     */
    function calculateReward(address user) external view returns (uint256) {
        StakeInfo memory stakeInfo = s_stakes[user];
        if (stakeInfo.amount == 0) {
            return s_rewards[user];
        }

        // Calculate reward with Φ boost
        uint256 timeStaked = block.timestamp - stakeInfo.lastUpdateTime;
        uint256 baseReward = (stakeInfo.amount * rewardRate * timeStaked) / 1e18;

        // Apply Φ boost: reward *= (1 + phiBoostRate * phiValue / MAX_PHI_VALUE)
        uint256 phiBoost = (baseReward * phiBoostRate * stakeInfo.phiValue) /
            (MAX_PHI_VALUE * 10000);
        uint256 totalReward = baseReward + phiBoost;

        return s_rewards[user] + totalReward;
    }

    /**
     * @notice Get voting power (based on stake and Φ value)
     * @param user User address
     * @return Voting power
     */
    function getVotingPower(address user) external view returns (uint256) {
        StakeInfo memory stakeInfo = s_stakes[user];
        if (stakeInfo.amount == 0) {
            return 0;
        }

        // Base: stakeAmount * (1 + phiValue / MAX_PHI_VALUE)
        uint256 phiMultiplier = 10000 + stakeInfo.phiValue;

        // Phase correction: |cos(θ)| boost
        // phiPhase is in ×1e6, so |cos(θ)| ≈ 1 - (θ²/2) for small θ
        int256 phaseSquared = (stakeInfo.phiPhase * stakeInfo.phiPhase) / 1e6;
        uint256 phaseBoost = phaseSquared > 0 ? uint256(phaseSquared) / 2 : 0;
        if (phaseBoost > 10000) phaseBoost = 10000; // cap at 100%

        uint256 totalMultiplier = phiMultiplier + phaseBoost;

        return (stakeInfo.amount * totalMultiplier) / 10000;
    }

    /**
     * @notice Get stake info for a user
     * @param user User address
     * @return amount Staked amount
     * @return phiValue Φ value
     * @return pendingReward Pending reward
     * @return _lastUpdateTime Last update timestamp
     * @return _lockEndTime Lock end time
     */
    function getStakeInfo(address user)
        external
        view
        returns (
            uint256 amount,
            uint256 phiValue,
            uint256 pendingReward,
            uint256 _lastUpdateTime,
            uint256 _lockEndTime
        )
    {
        StakeInfo memory stakeInfo = s_stakes[user];
        return (
            stakeInfo.amount,
            stakeInfo.phiValue,
            this.calculateReward(user),
            stakeInfo.lastUpdateTime,
            stakeInfo.lockEndTime
        );
    }

    // =============== Internal Functions ===============

    /**
     * @dev Update reward for a user
     * @param user User address
     */
    function _updateReward(address user) internal {
        rewardPerTokenStored = _rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (user != address(0)) {
            s_rewards[user] = this.calculateReward(user);
            s_rewardPerTokenPaid[user] = rewardPerTokenStored;
        }
    }

    /**
     * @dev Calculate reward per token
     * @return Reward per token
     */
    function _rewardPerToken() internal view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }

        return (
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalStaked)
        );
    }

    // =============== Admin Functions ===============

    /**
     * @notice Set reward rate (owner only)
     * @param newRewardRate New reward rate
     */
    function setRewardRate(uint256 newRewardRate) external onlyOwner {
        _updateReward(address(0));
        uint256 oldRate = rewardRate;
        rewardRate = newRewardRate;
        emit RewardRateUpdated(oldRate, newRewardRate);
    }

    /**
     * @notice Set Φ boost rate (owner only)
     * @param newBoostRate New boost rate (0-10000 = 0%-100%)
     */
    function setPhiBoostRate(uint256 newBoostRate) external onlyOwner {
        require(newBoostRate <= 10000, "Invalid boost rate");
        phiBoostRate = newBoostRate;
    }

    /**
     * @notice Set lock duration (owner only)
     * @param newLockDuration New lock duration in seconds
     */
    function setLockDuration(uint256 newLockDuration) external onlyOwner {
        uint256 oldDuration = lockDuration;
        lockDuration = newLockDuration;
        emit LockDurationUpdated(oldDuration, newLockDuration);
    }

    /**
     * @notice Pause staking (owner only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause staking (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // =============== View Functions ===============

    /**
     * @notice Get total staked amount
     * @return Total staked
     */
    function getTotalStaked() external view returns (uint256) {
        return totalStaked;
    }

    /**
     * @notice Check if user has staked
     * @param user User address
     * @return True if user has staked
     */
    function hasStaked(address user) external view returns (bool) {
        return s_stakes[user].amount > 0;
    }
}
