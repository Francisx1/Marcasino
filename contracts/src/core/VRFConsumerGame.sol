// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VRFConsumerGame
 * @notice Abstract base contract for games using Chainlink VRF
 * @dev Inherit this contract to add verifiable randomness to your game
 */
abstract contract VRFConsumerGame is VRFConsumerBaseV2Plus, ReentrancyGuard {
    // VRF Configuration
    IVRFCoordinatorV2Plus public immutable vrfCoordinator;
    bytes32 public immutable keyHash;
    uint256 public immutable subscriptionId;
    uint32 public callbackGasLimit;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    
    // Request tracking
    struct VRFRequest {
        bool fulfilled;
        bool exists;
        bool settled;
        bool refunded;
        uint256 replacedBy;
        uint256 randomWord;
        address player;
        address wagerToken;
        uint256 betAmount;
        uint256 timestamp;
        uint8 gameChoice;
    }
    
    mapping(uint256 => VRFRequest) public vrfRequests;

    uint256 public vrfTimeout;
    
    // Events
    event RandomnessRequested(uint256 indexed requestId, address indexed player);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);
    event RequestRetried(uint256 indexed oldRequestId, uint256 indexed newRequestId);
    event RequestRefunded(uint256 indexed requestId, address indexed player);
    event RequestSettled(uint256 indexed requestId);
    event AutoSettleFailed(uint256 indexed requestId, bytes reason);
    event VrfTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
    event CallbackGasLimitUpdated(uint32 oldLimit, uint32 newLimit);
    
    // Custom Errors
    error RequestNotFound(uint256 requestId);
    error RequestAlreadyFulfilled(uint256 requestId);
    error RequestNotFulfilled(uint256 requestId);
    error RequestAlreadySettled(uint256 requestId);
    error RequestAlreadyRefunded(uint256 requestId);
    error RequestNotTimedOut(uint256 requestId);
    error RequestWasReplaced(uint256 requestId, uint256 replacedBy);
    error InvalidCallbackGasLimit(uint32 provided);

    /**
     * @notice Constructor for VRF configuration
     * @param _vrfCoordinator Address of the VRF Coordinator
     * @param _keyHash The gas lane key hash
     * @param _subscriptionId The subscription ID for VRF
     * @param _callbackGasLimit Gas limit for the callback
     */
    constructor(
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;

        vrfTimeout = 600;
    }

    function setVrfTimeout(uint256 newTimeout) external onlyOwner {
        require(newTimeout >= 60 && newTimeout <= 1 days, "Invalid timeout");
        uint256 oldTimeout = vrfTimeout;
        vrfTimeout = newTimeout;
        emit VrfTimeoutUpdated(oldTimeout, newTimeout);
    }

    /**
     * @notice Request randomness from Chainlink VRF
     * @param player Address of the player
     * @param wagerToken Token address for wager (address(0) for ETH)
     * @param betAmount Amount of the bet
     * @param gameChoice Player's choice/selection
     * @return requestId The ID of the VRF request
     */
    function _requestRandomness(
        address player,
        address wagerToken,
        uint256 betAmount,
        uint8 gameChoice
    ) internal returns (uint256 requestId) {
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: REQUEST_CONFIRMATIONS,
            callbackGasLimit: callbackGasLimit,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
            )
        });

        requestId = vrfCoordinator.requestRandomWords(req);

        vrfRequests[requestId] = VRFRequest({
            fulfilled: false,
            exists: true,
            settled: false,
            refunded: false,
            replacedBy: 0,
            randomWord: 0,
            player: player,
            wagerToken: wagerToken,
            betAmount: betAmount,
            timestamp: block.timestamp,
            gameChoice: gameChoice
        });

        emit RandomnessRequested(requestId, player);
        return requestId;
    }

    /**
     * @notice Callback function used by VRF Coordinator
     * @param requestId The ID of the request
     * @param randomWords The random values returned by VRF
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        VRFRequest storage request = vrfRequests[requestId];
        
        if (!request.exists) revert RequestNotFound(requestId);
        if (request.fulfilled) revert RequestAlreadyFulfilled(requestId);

        request.fulfilled = true;
        request.randomWord = randomWords[0];

        emit RandomnessFulfilled(requestId, randomWords[0]);
    }

    /**
     * @notice Process the randomness result - must be implemented by child contracts
     * @param requestId The ID of the fulfilled request
     */
    function _processRandomness(uint256 requestId) internal virtual;

    function settleRequest(uint256 requestId) external nonReentrant {
        VRFRequest storage request = vrfRequests[requestId];
        if (!request.exists) revert RequestNotFound(requestId);
        if (request.replacedBy != 0) revert RequestWasReplaced(requestId, request.replacedBy);
        if (!request.fulfilled) revert RequestNotFulfilled(requestId);
        if (request.settled) revert RequestAlreadySettled(requestId);
        if (request.refunded) revert RequestAlreadyRefunded(requestId);

        request.settled = true;
        _processRandomness(requestId);
        emit RequestSettled(requestId);
    }

    function retryRequest(uint256 requestId) external nonReentrant returns (uint256 newRequestId) {
        VRFRequest storage request = vrfRequests[requestId];
        if (!request.exists) revert RequestNotFound(requestId);
        if (request.fulfilled) revert RequestAlreadyFulfilled(requestId);
        if (request.settled) revert RequestAlreadySettled(requestId);
        if (request.refunded) revert RequestAlreadyRefunded(requestId);
        if (request.replacedBy != 0) revert RequestWasReplaced(requestId, request.replacedBy);
        if (!_isTimedOut(requestId)) revert RequestNotTimedOut(requestId);

        newRequestId = _requestRandomness(
            request.player,
            request.wagerToken,
            request.betAmount,
            request.gameChoice
        );
        request.replacedBy = newRequestId;
        emit RequestRetried(requestId, newRequestId);
    }

    function refundRequest(uint256 requestId) external nonReentrant {
        VRFRequest storage request = vrfRequests[requestId];
        if (!request.exists) revert RequestNotFound(requestId);
        if (request.fulfilled) revert RequestAlreadyFulfilled(requestId);
        if (request.settled) revert RequestAlreadySettled(requestId);
        if (request.refunded) revert RequestAlreadyRefunded(requestId);
        if (request.replacedBy != 0) revert RequestWasReplaced(requestId, request.replacedBy);
        if (!_isTimedOut(requestId)) revert RequestNotTimedOut(requestId);

        request.refunded = true;
        _refundBet(requestId);
        emit RequestRefunded(requestId, request.player);
    }

    function _isTimedOut(uint256 requestId) internal view returns (bool) {
        VRFRequest storage request = vrfRequests[requestId];
        if (!request.exists) revert RequestNotFound(requestId);
        return (!request.fulfilled) && (block.timestamp >= request.timestamp + vrfTimeout);
    }

    function isTimedOut(uint256 requestId) external view returns (bool) {
        return _isTimedOut(requestId);
    }

    function _refundBet(uint256 requestId) internal virtual;

    /**
     * @notice Update the callback gas limit
     * @param newLimit New gas limit for callbacks
     */
    function setCallbackGasLimit(uint32 newLimit) external onlyOwner {
        if (newLimit < 50000 || newLimit > 2500000) {
            revert InvalidCallbackGasLimit(newLimit);
        }

        uint32 oldLimit = callbackGasLimit;
        callbackGasLimit = newLimit;

        emit CallbackGasLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Get request details
     * @param requestId The request ID to query
     * @return Request details
     */
    function getRequest(uint256 requestId) external view returns (VRFRequest memory) {
        return vrfRequests[requestId];
    }

    /**
     * @notice Check if a request has been fulfilled
     * @param requestId The request ID to check
     * @return true if fulfilled, false otherwise
     */
    function isRequestFulfilled(uint256 requestId) external view returns (bool) {
        return vrfRequests[requestId].fulfilled;
    }
}
