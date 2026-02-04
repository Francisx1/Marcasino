// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TreasuryManager
 * @notice Manages the casino treasury, bets, and payouts
 * @dev Handles ETH and ERC-20 token deposits, withdrawals, and prize distribution
 */
contract TreasuryManager is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // Treasury settings
    uint256 public constant MIN_RESERVE_RATIO = 20; // 20% minimum reserve
    uint256 public constant MAX_SINGLE_PAYOUT_RATIO = 5; // 5% of balance max per payout
    
    uint256 public totalBetsReceived;
    uint256 public totalPayoutsProcessed;
    uint256 public houseEarnings;

    // Bet limits
    uint256 public minBetAmount;
    uint256 public maxBetAmount;

    // Player balances
    mapping(address => uint256) public playerBalances;
    
    // Supported ERC-20 tokens
    mapping(address => bool) public supportedTokens;
    mapping(address => uint256) public tokenBalances; // token => total balance

    // Events
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event BetPlaced(address indexed player, address indexed game, uint256 amount);
    event PayoutProcessed(address indexed player, uint256 amount, address indexed game);
    event TokenSupported(address indexed token, bool supported);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event HouseEarningsWithdrawn(address indexed recipient, uint256 amount);

    // Custom Errors
    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientTreasuryBalance(uint256 available, uint256 required);
    error PayoutTooLarge(uint256 amount, uint256 maximum);
    error BetOutOfRange(uint256 amount, uint256 min, uint256 max);
    error InvalidAmount();
    error InvalidAddress();
    error TokenNotSupported(address token);
    error TransferFailed();

    /**
     * @notice Constructor sets initial bet limits
     * @param _minBet Minimum bet amount in wei
     * @param _maxBet Maximum bet amount in wei
     */
    constructor(uint256 _minBet, uint256 _maxBet) {
        require(_minBet > 0 && _maxBet > _minBet, "Invalid bet limits");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);

        minBetAmount = _minBet;
        maxBetAmount = _maxBet;
    }

    /**
     * @notice Deposit ETH to player balance
     */
    function deposit() external payable whenNotPaused {
        if (msg.value == 0) revert InvalidAmount();

        playerBalances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw from player balance
     * @param amount Amount to withdraw in wei
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (playerBalances[msg.sender] < amount) {
            revert InsufficientBalance(playerBalances[msg.sender], amount);
        }

        playerBalances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Process a bet from a game contract
     * @param player Address of the player
     * @param amount Bet amount
     * @return success True if bet was processed
     */
    function processBet(
        address player,
        uint256 amount
    ) external onlyRole(GAME_ROLE) whenNotPaused returns (bool) {
        if (amount < minBetAmount || amount > maxBetAmount) {
            revert BetOutOfRange(amount, minBetAmount, maxBetAmount);
        }

        if (playerBalances[player] < amount) {
            revert InsufficientBalance(playerBalances[player], amount);
        }

        playerBalances[player] -= amount;
        totalBetsReceived += amount;

        emit BetPlaced(player, msg.sender, amount);
        return true;
    }

    /**
     * @notice Process a payout to a winner
     * @param winner Address of the winner
     * @param amount Payout amount
     * @param houseEdgeBps House edge in basis points
     */
    function processPayout(
        address winner,
        uint256 amount,
        uint256 houseEdgeBps
    ) external onlyRole(GAME_ROLE) whenNotPaused nonReentrant {
        if (winner == address(0)) revert InvalidAddress();

        // Calculate house earnings
        uint256 houseAmount = (amount * houseEdgeBps) / 10000;
        uint256 playerPayout = amount - houseAmount;

        // Check treasury has enough balance
        uint256 maxPayout = (address(this).balance * MAX_SINGLE_PAYOUT_RATIO) / 100;
        if (playerPayout > maxPayout) {
            revert PayoutTooLarge(playerPayout, maxPayout);
        }

        // Check minimum reserve is maintained
        uint256 reserveRequired = (totalBetsReceived * MIN_RESERVE_RATIO) / 100;
        if (address(this).balance - playerPayout < reserveRequired) {
            revert InsufficientTreasuryBalance(address(this).balance, reserveRequired);
        }

        playerBalances[winner] += playerPayout;
        houseEarnings += houseAmount;
        totalPayoutsProcessed += playerPayout;

        emit PayoutProcessed(winner, playerPayout, msg.sender);
    }

    /**
     * @notice Update bet limits
     * @param _minBet New minimum bet amount
     * @param _maxBet New maximum bet amount
     */
    function setBetLimits(
        uint256 _minBet,
        uint256 _maxBet
    ) external onlyRole(ADMIN_ROLE) {
        require(_minBet > 0 && _maxBet > _minBet, "Invalid limits");

        minBetAmount = _minBet;
        maxBetAmount = _maxBet;

        emit BetLimitsUpdated(_minBet, _maxBet);
    }

    /**
     * @notice Withdraw house earnings
     * @param recipient Address to receive the earnings
     * @param amount Amount to withdraw
     */
    function withdrawHouseEarnings(
        address recipient,
        uint256 amount
    ) external onlyRole(TREASURY_ROLE) nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount > houseEarnings) {
            revert InsufficientBalance(houseEarnings, amount);
        }

        houseEarnings -= amount;

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit HouseEarningsWithdrawn(recipient, amount);
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Get treasury statistics
     * @return balance Current ETH balance
     * @return totalBets Total bets received
     * @return totalPayouts Total payouts processed
     * @return earnings House earnings
     */
    function getTreasuryStats() external view returns (
        uint256 balance,
        uint256 totalBets,
        uint256 totalPayouts,
        uint256 earnings
    ) {
        return (
            address(this).balance,
            totalBetsReceived,
            totalPayoutsProcessed,
            houseEarnings
        );
    }

    /**
     * @notice Get available payout amount
     * @return Maximum amount that can be paid out
     */
    function getAvailablePayoutAmount() external view returns (uint256) {
        return (address(this).balance * MAX_SINGLE_PAYOUT_RATIO) / 100;
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
