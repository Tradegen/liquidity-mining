// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

// Openzeppelin.
import "./openzeppelin-solidity/contracts/ERC20/SafeERC20.sol";
import "./openzeppelin-solidity/contracts/SafeMath.sol";
import "./openzeppelin-solidity/contracts/ReentrancyGuard.sol";

// Interfaces.
import "./interfaces/IReleaseSchedule.sol";

// Inheritance.
import "./interfaces/IReleaseEscrow.sol";

contract ReleaseEscrow is ReentrancyGuard, IReleaseEscrow {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    // When the release starts.
    uint256 public immutable override startTime;

    // Reward token contract address.
    IERC20 public immutable rewardToken;

    // StakingRewards contract.
    address public immutable beneficiary;

    // Schedule for release of tokens.
    IReleaseSchedule public immutable schedule;

    // Timestamp of the last withdrawal.
    uint256 public lastWithdrawalTime;

    // Total number of tokens that will be distributed.
    uint256 public override lifetimeRewards;

    // Number of tokens that have been claimed.
    uint256 public override distributedRewards;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _stakingRewards, address _rewardToken, address _schedule) {
        beneficiary = _stakingRewards;
        rewardToken = IERC20(_rewardToken);
        schedule = IReleaseSchedule(_schedule);
        startTime = IReleaseSchedule(_schedule).distributionStartTime();
        lastWithdrawalTime = IReleaseSchedule(_schedule).getStartOfCycle(1);
        lifetimeRewards = IReleaseSchedule(_schedule).getTokensForCycle(1).mul(2);
    }

    /* ========== VIEWS ========== */

    /**
     * @notice Returns true if release has already started.
     */
    function hasStarted() public view override returns (bool) {
        return block.timestamp >= startTime;
    }

    /**
     * @notice Returns the number of tokens left to distribute.
     */
    function remainingRewards() external view override returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /**
     * @notice Returns the number of tokens that have vested based on a schedule.
     */
    function releasedRewards() public view override returns (uint256) {
        return lifetimeRewards.sub(rewardToken.balanceOf(address(this)));
    }

    /**
     * @notice Returns the number of vested tokens that have not been claimed yet.
     */
    function unclaimedRewards() external view override returns (uint256) {
        return releasedRewards().sub(distributedRewards);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

   /**
     * @notice Withdraws tokens based on the current reward rate and the time since last withdrawal.
     * @dev This function is called by the StakingRewards contract whenever a user claims rewards.
     * @return uint256 Number of tokens claimed.
     */
    function withdraw() external override started onlyBeneficiary nonReentrant returns(uint256) {
        uint256 availableTokens = schedule.availableRewards(lastWithdrawalTime);
        
        lastWithdrawalTime = block.timestamp;
        distributedRewards = distributedRewards.add(availableTokens);
        rewardToken.safeTransfer(beneficiary, availableTokens);

        return availableTokens;
    }

    /* ========== MODIFIERS ========== */

    modifier started {
        require(hasStarted(), "ReleaseEscrow: Release has not started yet.");
        _;
    }

    modifier onlyBeneficiary {
        require((msg.sender == beneficiary),
                "ReleaseEscrow: Only the beneficiary can call this function.");
        _;
    }
}