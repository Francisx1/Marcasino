// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITreasuryManager
 * @notice Interface for the Treasury Manager contract
 */
interface ITreasuryManager {
    function processBet(address player, uint256 amount) external returns (bool);
    
    function processPayout(
        address winner,
        uint256 amount,
        uint256 houseEdgeBps
    ) external;
    
    function minBetAmount() external view returns (uint256);
    function maxBetAmount() external view returns (uint256);
}
