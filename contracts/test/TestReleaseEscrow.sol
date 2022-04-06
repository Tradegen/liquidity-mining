// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

// Inheritance
import "../ReleaseEscrow.sol";

/**
 * Escrow to release tokens according to a schedule.
 */
contract TestReleaseEscrow is ReleaseEscrow {

    /* ========== CONSTRUCTOR ========== */

    constructor(address _stakingRewards, address _rewardToken, address _schedule) ReleaseEscrow(_stakingRewards, _rewardToken, _schedule) {
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function setLastWithdrawalTime(uint256 _lastWithdrawalTime) external {
        lastWithdrawalTime = _lastWithdrawalTime;
    }
}