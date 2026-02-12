// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/VRFConsumerGame.sol";
import "../interfaces/IMarcasinoCore.sol";
import "../interfaces/ITreasuryManager.sol";

contract PowerUpLottery is VRFConsumerGame {
    IMarcasinoCore public immutable core;
    ITreasuryManager public immutable treasury;

    address public immutable ticketToken;
    uint256 public immutable ticketPrice;
    uint256 public immutable roundDuration;

    uint256 public constant MAX_TICKETS_PER_BUY = 50;

    struct Round {
        uint256 startTime;
        uint256 endTime;
        uint256 ticketCount;
        uint256 prizePool;
        bool drawRequested;
        bool settled;
        uint256 requestId;
        address winner;
    }

    uint256 public currentRoundId;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(uint256 => address)) public ticketOwners; // roundId => ticketIndex => owner
    mapping(uint256 => uint256) public requestIdToRoundId;

    struct LotteryResult {
        bool exists;
        uint256 roundId;
        uint256 winningTicketIndex;
        address winner;
        uint256 prizePool;
    }

    mapping(uint256 => LotteryResult) public resultsByRequestId;

    event TicketsPurchased(uint256 indexed roundId, address indexed player, uint256 count, uint256 totalCost);
    event DrawRequested(uint256 indexed roundId, uint256 indexed requestId, uint256 ticketCount, uint256 prizePool);
    event WinnerSelected(uint256 indexed roundId, uint256 indexed requestId, address indexed winner, uint256 winningTicketIndex, uint256 payoutAmount);
    event NewRoundStarted(uint256 indexed roundId, uint256 startTime, uint256 endTime);

    error NotOperational();
    error RoundNotActive(uint256 roundId);
    error RoundNotEnded(uint256 roundId);
    error NoTickets(uint256 roundId);
    error DrawAlreadyRequested(uint256 roundId);
    error RoundAlreadySettled(uint256 roundId);
    error InvalidCount();
    error BetTooLarge(uint256 provided, uint256 maximum);

    constructor(
        address _core,
        address _ticketToken,
        uint256 _ticketPrice,
        uint256 _roundDuration,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerGame(_vrfCoordinator, _keyHash, _subscriptionId, _callbackGasLimit) {
        core = IMarcasinoCore(_core);
        treasury = ITreasuryManager(IMarcasinoCore(_core).treasuryManager());

        ticketToken = _ticketToken;
        ticketPrice = _ticketPrice;
        roundDuration = _roundDuration;

        _startNewRound();
    }

    function buyTickets(uint256 count) external {
        if (!core.isOperational()) revert NotOperational();
        if (count == 0) revert InvalidCount();
        if (count > MAX_TICKETS_PER_BUY) revert InvalidCount();

        Round storage r = rounds[currentRoundId];
        // Round timing starts when the first ticket is purchased.
        if (r.endTime != 0 && block.timestamp >= r.endTime) revert RoundNotActive(currentRoundId);
        if (r.ticketCount == 0) {
            r.startTime = block.timestamp;
            r.endTime = block.timestamp + roundDuration;
        }

        uint256 totalCost = ticketPrice * count;

        uint256 maxBet = treasury.maxBetAmount();
        if (totalCost > maxBet) revert BetTooLarge(totalCost, maxBet);
        treasury.processTokenBet(msg.sender, ticketToken, totalCost);

        uint256 startIndex = r.ticketCount;
        for (uint256 i = 0; i < count; i++) {
            ticketOwners[currentRoundId][startIndex + i] = msg.sender;
        }
        r.ticketCount += count;
        r.prizePool += totalCost;

        emit TicketsPurchased(currentRoundId, msg.sender, count, totalCost);
    }

    function requestDraw() external returns (uint256 requestId) {
        if (!core.isOperational()) revert NotOperational();

        Round storage r = rounds[currentRoundId];
        if (r.endTime == 0 || block.timestamp < r.endTime) revert RoundNotEnded(currentRoundId);
        if (r.ticketCount == 0) revert NoTickets(currentRoundId);
        if (r.drawRequested) revert DrawAlreadyRequested(currentRoundId);

        r.drawRequested = true;
        requestId = _requestRandomness(address(this), ticketToken, r.prizePool, 0);
        r.requestId = requestId;
        requestIdToRoundId[requestId] = currentRoundId;

        emit DrawRequested(currentRoundId, requestId, r.ticketCount, r.prizePool);
    }

    function settleDraw(uint256 requestId) external {
        this.settleRequest(requestId);
    }

    function _processRandomness(uint256 requestId) internal override {
        uint256 roundId = requestIdToRoundId[requestId];
        Round storage r = rounds[roundId];
        if (r.settled) revert RoundAlreadySettled(roundId);
        if (r.ticketCount == 0) revert NoTickets(roundId);

        VRFRequest memory req = vrfRequests[requestId];
        uint256 winningIndex = req.randomWord % r.ticketCount;
        address winner = ticketOwners[roundId][winningIndex];

        uint256 payoutAmount = r.prizePool;
        treasury.processTokenPayout(winner, ticketToken, payoutAmount, core.houseEdge());

        r.settled = true;
        r.winner = winner;

        resultsByRequestId[requestId] = LotteryResult({
            exists: true,
            roundId: roundId,
            winningTicketIndex: winningIndex,
            winner: winner,
            prizePool: r.prizePool
        });

        emit WinnerSelected(roundId, requestId, winner, winningIndex, payoutAmount);

        if (roundId == currentRoundId) {
            _startNewRound();
        }
    }

    function _refundBet(uint256) internal pure override {
        revert("Lottery refund not supported");
    }

    function getCurrentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function _startNewRound() internal {
        currentRoundId += 1;
        uint256 startTime = 0;
        uint256 endTime = 0;

        rounds[currentRoundId] = Round({
            startTime: startTime,
            endTime: endTime,
            ticketCount: 0,
            prizePool: 0,
            drawRequested: false,
            settled: false,
            requestId: 0,
            winner: address(0)
        });

        emit NewRoundStarted(currentRoundId, startTime, endTime);
    }
}
