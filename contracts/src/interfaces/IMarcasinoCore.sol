// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMarcasinoCore
 * @notice Interface for the Marcasino Core contract
 */
interface IMarcasinoCore {
    function isRegisteredGame(address game) external view returns (bool);
    function houseEdge() external view returns (uint256);
    function treasuryManager() external view returns (address);
    function isOperational() external view returns (bool);
}
