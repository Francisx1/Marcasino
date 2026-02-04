// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGame
 * @notice Interface that all game contracts must implement
 */
interface IGame {
    /**
     * @notice Place a bet in the game
     * @param choice Player's choice/selection
     */
    function placeBet(uint8 choice) external payable;

    /**
     * @notice Claim winnings for a specific request
     * @param requestId VRF request ID
     */
    function claimWinnings(uint256 requestId) external;

    /**
     * @notice Get game statistics
     * @return totalBets Total number of bets placed
     * @return totalPayouts Total payouts distributed
     * @return activePlayers Number of active players
     */
    function getGameStats() external view returns (
        uint256 totalBets,
        uint256 totalPayouts,
        uint256 activePlayers
    );

    /**
     * @notice Get player's game history
     * @param player Player address
     * @return Number of games played
     */
    function getPlayerStats(address player) external view returns (uint256);

    /**
     * @notice Check if game is currently accepting bets
     * @return true if accepting bets
     */
    function isAcceptingBets() external view returns (bool);
}
