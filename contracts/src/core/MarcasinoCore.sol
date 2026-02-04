// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MarcasinoCore
 * @notice Main contract for managing the Marcasino gaming platform
 * @dev Handles game registration, access control, and global settings
 */
contract MarcasinoCore is AccessControl, Pausable, ReentrancyGuard {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // State variables
    uint256 public houseEdge; // In basis points (100 = 1%)
    uint256 public constant MAX_HOUSE_EDGE = 1000; // 10% maximum
    uint256 public constant MIN_HOUSE_EDGE = 100; // 1% minimum

    address public treasuryManager;
    
    // Game tracking
    mapping(address => bool) public isRegisteredGame;
    address[] public registeredGames;
    
    // Events
    event GameRegistered(address indexed gameContract, string gameName);
    event GamePaused(address indexed gameContract);
    event GameUnpaused(address indexed gameContract);
    event HouseEdgeUpdated(uint256 oldEdge, uint256 newEdge);
    event TreasuryManagerUpdated(address oldTreasury, address newTreasury);

    // Custom Errors
    error InvalidHouseEdge(uint256 provided);
    error GameAlreadyRegistered(address gameContract);
    error GameNotRegistered(address gameContract);
    error InvalidAddress();

    /**
     * @notice Constructor sets up initial roles and house edge
     * @param _initialHouseEdge Initial house edge in basis points
     */
    constructor(uint256 _initialHouseEdge) {
        if (_initialHouseEdge < MIN_HOUSE_EDGE || _initialHouseEdge > MAX_HOUSE_EDGE) {
            revert InvalidHouseEdge(_initialHouseEdge);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        houseEdge = _initialHouseEdge;
    }

    /**
     * @notice Register a new game contract
     * @param gameContract Address of the game contract
     * @param gameName Name of the game
     */
    function registerGame(
        address gameContract,
        string calldata gameName
    ) external onlyRole(ADMIN_ROLE) {
        if (gameContract == address(0)) revert InvalidAddress();
        if (isRegisteredGame[gameContract]) revert GameAlreadyRegistered(gameContract);

        isRegisteredGame[gameContract] = true;
        registeredGames.push(gameContract);
        _grantRole(GAME_ROLE, gameContract);

        emit GameRegistered(gameContract, gameName);
    }

    /**
     * @notice Update the house edge
     * @param newEdge New house edge in basis points
     */
    function setHouseEdge(uint256 newEdge) external onlyRole(ADMIN_ROLE) {
        if (newEdge < MIN_HOUSE_EDGE || newEdge > MAX_HOUSE_EDGE) {
            revert InvalidHouseEdge(newEdge);
        }

        uint256 oldEdge = houseEdge;
        houseEdge = newEdge;

        emit HouseEdgeUpdated(oldEdge, newEdge);
    }

    /**
     * @notice Set the treasury manager contract
     * @param _treasuryManager Address of the treasury manager
     */
    function setTreasuryManager(address _treasuryManager) external onlyRole(ADMIN_ROLE) {
        if (_treasuryManager == address(0)) revert InvalidAddress();

        address oldTreasury = treasuryManager;
        treasuryManager = _treasuryManager;

        emit TreasuryManagerUpdated(oldTreasury, _treasuryManager);
    }

    /**
     * @notice Emergency pause all games
     */
    function emergencyPause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause after emergency
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get all registered game addresses
     * @return Array of game contract addresses
     */
    function getRegisteredGames() external view returns (address[] memory) {
        return registeredGames;
    }

    /**
     * @notice Get the number of registered games
     * @return Number of games
     */
    function getGameCount() external view returns (uint256) {
        return registeredGames.length;
    }

    /**
     * @notice Check if the platform is operational
     * @return true if not paused, false otherwise
     */
    function isOperational() external view returns (bool) {
        return !paused();
    }
}
