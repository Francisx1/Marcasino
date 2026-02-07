// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VRFConsumerGame
 * @notice Abstract base contract for games using Chainlink VRF
 * @dev Inherit this contract to add verifiable randomness to your game
 */
abstract contract VRFConsumerGame is VRFConsumerBaseV2, Ownable, ReentrancyGuard {
    // VRF Configuration
    VRFCoordinatorV2Interface public immutable vrfCoordinator;
    bytes32 public immutable keyHash;
    uint64 public immutable subscriptionId;
    uint32 public callbackGasLimit;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    
    // Request tracking
    struct VRFRequest {
        bool fulfilled;
        bool exists;
        uint256 randomWord;
        address player;
        uint256 betAmount;
        uint256 timestamp;
        uint8 gameChoice;
    }
    
    mapping(uint256 => VRFRequest) public vrfRequests;
    
    // Events
    event RandomnessRequested(uint256 indexed requestId, address indexed player);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);
    event CallbackGasLimitUpdated(uint32 oldLimit, uint32 newLimit);
    
    // Custom Errors
    error RequestNotFound(uint256 requestId);
    error RequestAlreadyFulfilled(uint256 requestId);
    error RequestNotFulfilled(uint256 requestId);
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
        uint64 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
    }

    /**
     * @notice Request randomness from Chainlink VRF
     * @param player Address of the player
     * @param betAmount Amount of the bet
     * @param gameChoice Player's choice/selection
     * @return requestId The ID of the VRF request
     */
    function _requestRandomness(
        address player,
        uint256 betAmount,
        uint8 gameChoice
    ) internal returns (uint256 requestId) {
        requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            callbackGasLimit,
            1 // numWords - request only 1 random word
        );

        vrfRequests[requestId] = VRFRequest({
            fulfilled: false,
            exists: true,
            randomWord: 0,
            player: player,
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
        uint256[] memory randomWords
    ) internal override {
        VRFRequest storage request = vrfRequests[requestId];
        
        if (!request.exists) revert RequestNotFound(requestId);
        if (request.fulfilled) revert RequestAlreadyFulfilled(requestId);

        request.fulfilled = true;
        request.randomWord = randomWords[0];

        emit RandomnessFulfilled(requestId, randomWords[0]);
        
        // Call the game-specific processing function
        _processRandomness(requestId);
    }

    /**
     * @notice Process the randomness result - must be implemented by child contracts
     * @param requestId The ID of the fulfilled request
     */
    function _processRandomness(uint256 requestId) internal virtual;

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
