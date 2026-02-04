# ⛽ Gas Optimization Guide - Marcasino

## Overview

Gas optimization is crucial for a gaming platform where users make frequent transactions. This document outlines strategies to minimize gas costs while maintaining security and functionality.

## Gas Cost Priorities

### Target Metrics

| Operation | Target Gas | Max Acceptable |
|-----------|-----------|----------------|
| Place Bet | < 100k | 150k |
| Claim Winnings | < 80k | 120k |
| VRF Request | < 120k | 180k |
| VRF Callback | < 100k | 150k |

## Optimization Strategies

### 1. Storage Optimization

#### Variable Packing

```solidity
// ❌ Bad: Uses 3 storage slots (96 bytes)
struct PlayerBad {
    uint256 totalBets;      // 32 bytes - slot 0
    uint256 totalWins;      // 32 bytes - slot 1
    address playerAddress;  // 20 bytes - slot 2
    bool isActive;          // 1 byte  - slot 2 (wasted space)
}

// ✅ Good: Uses 2 storage slots (64 bytes)
struct PlayerGood {
    address playerAddress;  // 20 bytes - slot 0
    uint96 totalBets;       // 12 bytes - slot 0
    uint96 totalWins;       // 12 bytes - slot 1
    bool isActive;          // 1 byte  - slot 1
    // Saves 32 bytes per struct!
}
```

**Savings:** ~20,000 gas per SSTORE operation

#### Use Smaller Types When Possible

```solidity
// ✅ Optimize for bet amounts (max ~79 million ETH with uint96)
uint96 public betAmount;      // 12 bytes vs 32 bytes
uint32 public timestamp;       // 4 bytes vs 32 bytes
uint16 public gameType;        // 2 bytes vs 32 bytes
```

### 2. Memory vs Storage

```solidity
// ❌ Bad: Reading storage in loop
function calculateTotalBets() external view returns (uint256) {
    uint256 total;
    for (uint256 i = 0; i < players.length; i++) {
        total += players[i].totalBets; // SLOAD every iteration
    }
    return total;
}

// ✅ Good: Load to memory once
function calculateTotalBets() external view returns (uint256) {
    uint256 total;
    uint256 playerCount = players.length; // Cache length
    for (uint256 i = 0; i < playerCount; i++) {
        Player memory player = players[i]; // Load to memory
        total += player.totalBets;
    }
    return total;
}
```

**Savings:** ~2,100 gas per SLOAD avoided

### 3. Event Optimization

```solidity
// ✅ Use indexed parameters for filtering (max 3)
event BetPlaced(
    address indexed player,
    uint256 indexed gameId,
    uint256 indexed requestId,
    uint256 amount  // Non-indexed for data
);

// ✅ Pack event data efficiently
event GameResult(
    uint256 indexed requestId,
    uint256 randomWord,
    bool won,
    uint256 payout
);
```

### 4. Function Optimization

#### Short-Circuit Evaluation

```solidity
// ✅ Put cheaper checks first
function placeBet(uint256 amount) external {
    require(amount >= MIN_BET, "Too small");        // Cheap check
    require(amount <= MAX_BET, "Too large");        // Cheap check
    require(!paused, "Game paused");                // Storage read
    require(players[msg.sender].isActive, "Inactive"); // Storage read
}
```

#### Function Visibility

```solidity
// ✅ Use external for functions only called externally
function placeBet(uint256 amount) external payable {
    // calldata is cheaper than memory for external functions
}

// ✅ Use private/internal when possible
function _processWin(address player) private {
    // No need for public/external overhead
}
```

### 5. Loop Optimization

```solidity
// ❌ Bad: Unbounded loops
function distributePrizes() external {
    for (uint256 i = 0; i < allPlayers.length; i++) {
        // Could run out of gas!
    }
}

// ✅ Good: Paginated loops
function distributePrizes(uint256 startIndex, uint256 endIndex) 
    external 
{
    require(endIndex <= allPlayers.length, "Invalid range");
    require(endIndex - startIndex <= 50, "Batch too large");
    
    for (uint256 i = startIndex; i < endIndex; i++) {
        _distributePrize(allPlayers[i]);
    }
}
```

### 6. Calldata Optimization

```solidity
// ✅ Use calldata for read-only parameters
function placeBets(
    uint256[] calldata amounts,  // calldata (cheaper)
    uint8[] calldata choices
) external {
    for (uint256 i = 0; i < amounts.length; i++) {
        // Process each bet
    }
}
```

**Savings:** ~60 gas per 32 bytes for calldata vs memory

### 7. Mapping vs Array

```solidity
// ✅ Use mappings for random access
mapping(address => Player) public players;

// ✅ Use arrays for iteration (with pagination)
address[] public playerAddresses;

// ⚠️ Consider trade-offs
// Mappings: O(1) access, can't iterate
// Arrays: Can iterate, expensive to remove from middle
```

### 8. Custom Errors (Solidity 0.8.4+)

```solidity
// ❌ Old: String errors (expensive)
require(amount >= MIN_BET, "Bet too small");

// ✅ New: Custom errors (cheaper)
error BetTooSmall(uint256 amount, uint256 minimum);

if (amount < MIN_BET) {
    revert BetTooSmall(amount, MIN_BET);
}
```

**Savings:** ~50 gas per revert

### 9. Immutable and Constant

```solidity
// ✅ Use constant for compile-time values
uint256 public constant MIN_BET = 0.01 ether;
bytes32 public constant VRF_KEY_HASH = 0x...;

// ✅ Use immutable for constructor-set values
address public immutable vrfCoordinator;
uint64 public immutable subscriptionId;

constructor(address _coordinator, uint64 _subId) {
    vrfCoordinator = _coordinator;
    subscriptionId = _subId;
}
```

**Savings:** ~2,100 gas per SLOAD (constant/immutable vs storage)

### 10. Batch Operations

```solidity
// ✅ Batch operations to amortize fixed costs
function placeBetsBatch(
    uint256[] calldata amounts,
    uint8[] calldata choices
) external payable {
    require(amounts.length == choices.length, "Length mismatch");
    
    uint256 totalBet;
    for (uint256 i = 0; i < amounts.length; i++) {
        totalBet += amounts[i];
        _processBet(msg.sender, amounts[i], choices[i]);
    }
    
    require(msg.value == totalBet, "Incorrect payment");
}
```

## VRF-Specific Optimizations

### Callback Gas Limit

```solidity
// ✅ Set appropriate callback gas limit
uint32 public callbackGasLimit = 100000; // Adjust based on game logic

// ✅ Minimal logic in callback
function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
) internal override {
    // Only store the result
    vrfRequests[requestId].randomWord = randomWords[0];
    vrfRequests[requestId].fulfilled = true;
    
    // Emit event for off-chain processing
    emit RandomnessFulfilled(requestId, randomWords[0]);
}

// ✅ Process game logic separately
function processGameResult(uint256 requestId) external {
    VRFRequest memory request = vrfRequests[requestId];
    require(request.fulfilled, "Not fulfilled");
    
    // Heavy computation here doesn't affect callback gas
    bool won = _determineWinner(request.randomWord, request.choice);
    if (won) {
        _processPayout(request.player, request.amount);
    }
}
```

### Request Optimization

```solidity
// ✅ Request only needed number of random words
function requestRandomness() internal returns (uint256) {
    // Request 1 word if only 1 is needed
    return vrfCoordinator.requestRandomWords(
        keyHash,
        subscriptionId,
        requestConfirmations,
        callbackGasLimit,
        1  // numWords - only request what you need
    );
}
```

## Assembly Optimizations (Advanced)

```solidity
// ⚠️ Use with caution - only for critical paths
function efficientTransfer(address to, uint256 amount) internal {
    assembly {
        // Load free memory pointer
        let ptr := mload(0x40)
        
        // Store transfer data
        mstore(ptr, amount)
        
        // Call transfer
        let success := call(
            gas(),
            to,
            amount,
            0,
            0,
            0,
            0
        )
        
        // Revert if failed
        if iszero(success) {
            revert(0, 0)
        }
    }
}
```

**Note:** Assembly should only be used when absolutely necessary and after thorough testing.

## Gas Profiling Tools

### Hardhat Gas Reporter

```javascript
// hardhat.config.js
module.exports = {
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 21,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  }
};
```

### Foundry Gas Snapshots

```bash
forge snapshot
forge snapshot --diff
```

## Optimization Checklist

### Before Deployment

- [ ] Run gas reporter on all tests
- [ ] Profile most-used functions
- [ ] Verify storage layout is packed
- [ ] Check for redundant storage reads
- [ ] Validate loop bounds
- [ ] Test with realistic data sizes
- [ ] Compare against benchmarks

### Common Anti-Patterns to Avoid

- ❌ Reading storage in loops
- ❌ Unbounded loops
- ❌ Unnecessary storage writes
- ❌ String error messages
- ❌ Public visibility when external works
- ❌ Memory when calldata works
- ❌ Redundant checks
- ❌ Inefficient data structures

## Gas Cost Examples

### Typical Transaction Costs (Ethereum Mainnet)

| Operation | Gas Cost | At 50 Gwei | At 100 Gwei |
|-----------|----------|------------|-------------|
| Place Bet | 80,000 | $2.40 | $4.80 |
| VRF Request | 120,000 | $3.60 | $7.20 |
| VRF Callback | 100,000 | $3.00 | $6.00 |
| Claim Win | 70,000 | $2.10 | $4.20 |

*Assuming ETH = $2,000*

## L2 Deployment Benefits

### Cost Comparison

| Network | Avg Gas Cost | Multiplier |
|---------|--------------|------------|
| Ethereum | $5.00 | 1x |
| Polygon | $0.10 | 0.02x |
| Arbitrum | $0.50 | 0.1x |
| Optimism | $0.40 | 0.08x |

**Recommendation:** Consider deploying on Polygon or Arbitrum for significantly lower user costs.

## Monitoring and Continuous Optimization

### Metrics to Track

1. **Average gas per game type**
2. **Gas cost trends over time**
3. **Most expensive functions**
4. **User complaints about costs**

### Regular Reviews

- Monthly gas profiling
- Quarterly optimization sprints
- Annual architecture review

---

**Remember:** Optimize for readability first, then optimize for gas. Premature optimization can lead to bugs.
