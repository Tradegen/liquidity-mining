// SPDX-License-Identifier: MIT
// solhint-disable not-rely-on-time

pragma solidity ^0.8.3;

// OpenZeppelin
import "./openzeppelin-solidity/contracts/Math.sol";
import "./openzeppelin-solidity/contracts/Ownable.sol";
import "./openzeppelin-solidity/contracts/SafeMath.sol";
import "./openzeppelin-solidity/contracts/ReentrancyGuard.sol";
import "./openzeppelin-solidity/contracts/ERC20/SafeERC20.sol";

// Interfaces
import "./interfaces/IReleaseEscrow.sol";

// Inheritance
import "./interfaces/IStakingRewards.sol";

contract StakingRewards is IStakingRewards, ReentrancyGuard, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public rewardsToken; // TGEN
    IERC20 public stakingToken; // TGEN-CELO LP token
    IReleaseEscrow public releaseEscrow;
    address public poolAddress;
    address public xTGEN;

    uint256 public startTime;

    uint256 public totalAvailableRewards;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _rewardsToken, address _stakingToken, address _xTGEN) Ownable() {
        rewardsToken = IERC20(_rewardsToken);
        stakingToken = IERC20(_stakingToken);
        xTGEN = _xTGEN;
    }

    /* ========== VIEWS ========== */

    /**
     * @dev Calculates the amount of unclaimed rewards the user has available.
     * @param account address of the user.
     * @return (uint256) amount of available unclaimed rewards.
     */
    function earned(address account) public view override returns (uint256) {
        return balanceOf[account].mul(rewardPerTokenStored.sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Stakes LP tokens in the farm.
     * @param amount number of tokens to stake.
     */
    function stake(uint256 amount) external override nonReentrant releaseEscrowIsSet updateReward(msg.sender) {
        require(amount > 0, "StakingRewards: Amount must be positive.");

        totalSupply = totalSupply.add(amount);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    /**
     * @dev Withdraws LP tokens from the farm.
     * @param amount number of tokens to stake.
     */
    function withdraw(uint256 amount) public override nonReentrant releaseEscrowIsSet updateReward(msg.sender) {
        require(amount > 0, "StakingRewards: Amount must be positive.");

        _withdraw(msg.sender, amount);
    }

    /**
     * @dev Claims available rewards for the user.
     */
    function getReward() public override nonReentrant releaseEscrowIsSet {
        rewards[msg.sender] = earned(msg.sender);
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;

        _getReward();

        if (totalSupply == 0) {
            _claimReward();
        }
    }

    /**
     * @dev Withdraws all LP tokens a user has staked.
     */
    function exit() external override releaseEscrowIsSet updateReward(msg.sender) {
        _withdraw(msg.sender, balanceOf[msg.sender]);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Updates available rewards for the contracts and claims user's share of rewards.
     */
    function _getReward() internal {
        uint256 availableRewards = releaseEscrow.withdraw();
        if (totalSupply == 0) {
            rewardsToken.safeTransfer(xTGEN, availableRewards);
        }
        else {
            _addReward(availableRewards);
            _claimReward();
        }
    }

    /**
     * @dev Claims available rewards for the user.
     */
    function _claimReward() internal {
        uint256 reward = rewards[msg.sender];

        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @dev Updates the available rewards for the StakingRewards contract, based on the release schedule.
     * @param _reward number of tokens to add to the StakingRewards contract.
     */
    function _addReward(uint256 _reward) internal {
        rewardPerTokenStored = rewardPerTokenStored.add(_reward.mul(1e18).div(totalSupply));
        totalAvailableRewards = totalAvailableRewards.add(_reward);

        emit RewardAdded(_reward);
    }

    function _withdraw(address _user, uint _amount) internal {
        totalSupply = totalSupply.sub(_amount);
        balanceOf[_user] = balanceOf[_user].sub(_amount);

        stakingToken.safeTransfer(_user, _amount);

        emit Withdrawn(_user, _amount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Sets the address of the ReleaseEscrow contract.
     * @notice This function can only be called once, and must be called before users can interact with StakingRewards contract.
     */
    function setReleaseEscrow(address _releaseEscrow) external onlyOwner releaseEscrowIsNotSet {
        require(_releaseEscrow != address(0), "StakingRewards: invalid address.");

        releaseEscrow = IReleaseEscrow(_releaseEscrow);
        startTime = releaseEscrow.startTime();

        emit SetReleaseEscrow(_releaseEscrow, startTime);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        _getReward();

        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    modifier releaseEscrowIsSet() {
        require(address(releaseEscrow) != address(0), "StakingRewards: ReleaseEscrow contract must be set before calling this function.");
        _;
    }

    modifier releaseEscrowIsNotSet() {
        require(address(releaseEscrow) == address(0), "StakingRewards: ReleaseEscrow contract already set.");
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event SetReleaseEscrow(address releaseEscrowAddress, uint256 startTime);
}