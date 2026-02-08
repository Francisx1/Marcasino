// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

interface IVRFV2PlusConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

contract LocalVRFCoordinatorV2PlusMock {
    uint256 private _nextRequestId = 1;

    mapping(uint256 => address) public requestConsumer;

    event RandomWordsRequested(uint256 indexed requestId, address indexed consumer);
    event RandomWordsFulfilled(uint256 indexed requestId, address indexed consumer, uint256 randomWord);

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256 requestId) {
        requestId = _nextRequestId++;
        requestConsumer[requestId] = msg.sender;
        emit RandomWordsRequested(requestId, msg.sender);
    }

    function fulfillRequest(uint256 requestId, uint256 randomWord) external {
        address consumer = requestConsumer[requestId];
        require(consumer != address(0), "Unknown requestId");

        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;

        IVRFV2PlusConsumer(consumer).rawFulfillRandomWords(requestId, words);
        emit RandomWordsFulfilled(requestId, consumer, randomWord);
    }
}
