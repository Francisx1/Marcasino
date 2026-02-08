// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/VRFConsumerGame.sol";
import "../interfaces/IMarcasinoCore.sol";
import "../interfaces/ITreasuryManager.sol";

contract DiceGame is VRFConsumerGame {
    IMarcasinoCore public immutable core;
    ITreasuryManager public immutable treasury;

    uint256 public constant REVEAL_DELAY = 120;
    uint256 public constant REVEAL_TIMEOUT = 600;
    uint256 public constant SLASHING_DEPOSIT = 0.002 ether;

    uint8 public constant TIER_MUSHROOM = 0;
    uint8 public constant TIER_STAR = 1;
    uint8 public constant TIER_ONEUP = 2;

    struct TierConfig {
        uint16 winChanceBps;
        uint32 multiplierBps;
    }

    struct Commitment {
        bytes32 hash;
        uint256 timestamp;
        uint256 deposit;
    }

    struct BetResult {
        bool exists;
        bool win;
        uint8 tier;
        uint256 roll;
        address player;
        address wagerToken;
        uint256 betAmount;
        uint256 payoutAmount;
    }

    mapping(uint8 => TierConfig) public tierConfigs;
    mapping(address => Commitment) public commitments;
    mapping(uint256 => BetResult) public results;

    event BetCommitted(address indexed player, bytes32 commitment);
    event BetRevealed(uint256 indexed requestId, address indexed player, uint8 tier, address wagerToken, uint256 amount);
    event BetResolved(uint256 indexed requestId, address indexed player, uint8 tier, uint256 roll, bool win, uint256 payoutAmount);
    event CommitmentSlashed(address indexed player, uint256 amount);

    error NotOperational();
    error InvalidTier();
    error CommitmentMissing();
    error CommitmentNotReady();
    error CommitmentExpired();
    error InvalidDeposit();
    error InvalidReveal();

    constructor(
        address _core,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerGame(_vrfCoordinator, _keyHash, _subscriptionId, _callbackGasLimit) {
        core = IMarcasinoCore(_core);
        treasury = ITreasuryManager(IMarcasinoCore(_core).treasuryManager());

        tierConfigs[TIER_MUSHROOM] = TierConfig({winChanceBps: 7000, multiplierBps: 15000});
        tierConfigs[TIER_STAR] = TierConfig({winChanceBps: 2000, multiplierBps: 100000});
        tierConfigs[TIER_ONEUP] = TierConfig({winChanceBps: 200, multiplierBps: 500000});
    }

    function commitBet(bytes32 commitment) external payable {
        if (!core.isOperational()) revert NotOperational();
        if (msg.value != SLASHING_DEPOSIT) revert InvalidDeposit();

        commitments[msg.sender] = Commitment({
            hash: commitment,
            timestamp: block.timestamp,
            deposit: msg.value
        });

        emit BetCommitted(msg.sender, commitment);
    }

    function revealBet(
        uint8 tier,
        address wagerToken,
        uint256 amount,
        bytes32 secret
    ) external returns (uint256 requestId) {
        if (!core.isOperational()) revert NotOperational();
        if (tier > TIER_ONEUP) revert InvalidTier();

        Commitment memory c = commitments[msg.sender];
        if (c.hash == bytes32(0)) revert CommitmentMissing();
        if (block.timestamp < c.timestamp + REVEAL_DELAY) revert CommitmentNotReady();
        if (block.timestamp > c.timestamp + REVEAL_DELAY + REVEAL_TIMEOUT) revert CommitmentExpired();

        bytes32 expected = keccak256(abi.encodePacked(msg.sender, tier, wagerToken, amount, secret));
        if (expected != c.hash) revert InvalidReveal();

        delete commitments[msg.sender];
        (bool success, ) = payable(msg.sender).call{value: c.deposit}("");
        require(success, "Deposit refund failed");

        if (wagerToken == address(0)) {
            treasury.processBet(msg.sender, amount);
        } else {
            treasury.processTokenBet(msg.sender, wagerToken, amount);
        }

        requestId = _requestRandomness(msg.sender, wagerToken, amount, tier);
        emit BetRevealed(requestId, msg.sender, tier, wagerToken, amount);
    }

    function slashExpiredCommit(address player) external {
        Commitment memory c = commitments[player];
        if (c.hash == bytes32(0)) revert CommitmentMissing();
        if (block.timestamp <= c.timestamp + REVEAL_DELAY + REVEAL_TIMEOUT) revert CommitmentNotReady();

        delete commitments[player];
        (bool success, ) = payable(address(treasury)).call{value: c.deposit}("");
        require(success, "Slash transfer failed");
        emit CommitmentSlashed(player, c.deposit);
    }

    function _processRandomness(uint256 requestId) internal override {
        VRFRequest memory r = vrfRequests[requestId];
        if (!r.exists || !r.fulfilled) revert RequestNotFulfilled(requestId);

        TierConfig memory cfg = tierConfigs[r.gameChoice];
        if (cfg.winChanceBps == 0) revert InvalidTier();

        uint256 roll = r.randomWord % 10000;
        bool win = roll < cfg.winChanceBps;

        uint256 payoutAmount = 0;
        if (win) {
            payoutAmount = (r.betAmount * cfg.multiplierBps) / 10000;
            if (r.wagerToken == address(0)) {
                treasury.processPayout(r.player, payoutAmount, core.houseEdge());
            } else {
                treasury.processTokenPayout(r.player, r.wagerToken, payoutAmount, core.houseEdge());
            }
        }

        results[requestId] = BetResult({
            exists: true,
            win: win,
            tier: r.gameChoice,
            roll: roll,
            player: r.player,
            wagerToken: r.wagerToken,
            betAmount: r.betAmount,
            payoutAmount: payoutAmount
        });

        emit BetResolved(requestId, r.player, r.gameChoice, roll, win, payoutAmount);
    }

    function _refundBet(uint256 requestId) internal override {
        VRFRequest memory r = vrfRequests[requestId];
        if (r.wagerToken == address(0)) {
            treasury.refundBet(r.player, r.betAmount);
        } else {
            treasury.refundTokenBet(r.player, r.wagerToken, r.betAmount);
        }
    }

    function getOutcome(uint256 requestId) external view returns (BetResult memory) {
        return results[requestId];
    }
}
