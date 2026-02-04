# 🏗️ Marcasino Architecture

## System Overview

Marcasino is a decentralized gaming platform built on Ethereum, utilizing Chainlink VRF for verifiable randomness. The architecture follows a modular design pattern with clear separation of concerns.

## Architecture Layers

### 1. Smart Contract Layer

```
┌─────────────────────────────────────────────┐
│           Smart Contract Layer              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌─────────────────┐ │
│  │ MarcasinoCore│◄─────┤ GameFactory     │ │
│  └──────┬───────┘      └─────────────────┘ │
│         │                                   │
│         │  owns/manages                     │
│         │                                   │
│  ┌──────▼───────────────────────────────┐  │
│  │    VRFConsumerGame (Abstract)        │  │
│  │  - requestRandomness()               │  │
│  │  - fulfillRandomWords()              │  │
│  └──────┬───────────────────────────────┘  │
│         │ inherits                          │
│         │                                   │
│  ┌──────▼────────┐    ┌─────────────────┐  │
│  │  Game1.sol    │    │  Game2.sol      │  │
│  │  (TBD)        │    │  (TBD)          │  │
│  └───────────────┘    └─────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │       TreasuryManager.sol            │  │
│  │  - deposit()                         │  │
│  │  - withdraw()                        │  │
│  │  - distributePrizes()                │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
              ▲
              │ VRF Callback
              │
     ┌────────┴────────┐
     │ Chainlink VRF   │
     │   Coordinator   │
     └─────────────────┘
```

### 2. Frontend Layer

```
┌─────────────────────────────────────────────┐
│            Frontend Layer (Next.js)         │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │        Pages / App Router            │  │
│  │  - Home                              │  │
│  │  - Game Lobby                        │  │
│  │  - Individual Games                  │  │
│  │  - Leaderboard                       │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Components Layer                │  │
│  │  - GameCard                          │  │
│  │  - BettingPanel                      │  │
│  │  - WalletConnect                     │  │
│  │  - MarioTheme Components             │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Hooks & State Management        │  │
│  │  - useContract                       │  │
│  │  - useGame                           │  │
│  │  - useWallet                         │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Web3 Integration Layer          │  │
│  │  - ethers.js                         │  │
│  │  - Contract ABIs                     │  │
│  │  - Event Listeners                   │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

## Core Components

### MarcasinoCore Contract

**Purpose:** Central management contract for the casino platform

**Key Responsibilities:**
- Game registration and management
- Access control and permissions
- Emergency pause functionality
- Protocol-wide settings

**Key Functions:**
```solidity
function registerGame(address gameContract) external onlyOwner
function pauseGame(address gameContract) external onlyOwner
function setHouseEdge(uint256 newEdge) external onlyOwner
function emergencyPause() external onlyOwner
```

### VRFConsumerGame (Abstract Base)

**Purpose:** Base contract for all games requiring randomness

**Key Responsibilities:**
- Interface with Chainlink VRF
- Handle VRF callbacks
- Manage request IDs
- Gas optimization for callbacks

**Key Functions:**
```solidity
function requestRandomness() internal returns (uint256 requestId)
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override
function getRandomResult(uint256 requestId) public view returns (uint256)
```

**VRF Integration Flow:**
```
User Action → Request Randomness → VRF Coordinator
                                         ↓
                                    Generate Random
                                         ↓
Game Contract ← Fulfill Callback ← VRF Coordinator
      ↓
Process Result → Update State → Emit Event → Payout
```

### TreasuryManager Contract

**Purpose:** Manage betting pools and payouts

**Key Responsibilities:**
- Accept deposits (ETH and ERC-20)
- Process withdrawals
- Calculate and distribute prizes
- Track house edge
- Maintain liquidity

**Key Functions:**
```solidity
function deposit() external payable
function withdraw(uint256 amount) external
function processBet(address player, uint256 amount) external returns (bool)
function payout(address winner, uint256 amount) external
```

### GameFactory Contract

**Purpose:** Deploy and manage game instances

**Key Responsibilities:**
- Deploy new game contracts
- Track game addresses
- Version management
- Upgrade patterns

## Data Flow

### Betting Flow

```
1. User connects wallet
2. User selects game
3. User places bet (approve + deposit)
4. Game contract receives bet
5. Game requests randomness from VRF
6. VRF returns random number
7. Game calculates outcome
8. Treasury processes payout
9. User receives winnings
10. Event emitted for frontend update
```

### Event-Driven Updates

```
Smart Contract Events
        ↓
    Event Listener (Frontend)
        ↓
    State Update (React)
        ↓
    UI Re-render
```

## Security Measures

### 1. Randomness Security
- Chainlink VRF for tamper-proof randomness
- Request-response pattern prevents manipulation
- Commitment schemes for user actions

### 2. Economic Security
- House edge ensures protocol sustainability
- Min/max bet limits prevent exploitation
- Treasury reserves for liquidity

### 3. Smart Contract Security
- OpenZeppelin contracts (battle-tested)
- Reentrancy guards on all payouts
- Access control for critical functions
- Emergency pause mechanism

### 4. MEV Protection
- Commit-reveal schemes
- Time-locked actions
- Fair ordering mechanisms

## Gas Optimization Strategies

1. **Storage Optimization**
   - Pack variables in structs
   - Use uint128 where possible
   - Minimize storage writes

2. **VRF Callback Optimization**
   - Keep callback logic minimal
   - Use events for heavy computations
   - Batch operations where possible

3. **Loop Optimization**
   - Avoid unbounded loops
   - Use pagination for large datasets
   - Cache array lengths

## Scalability Considerations

### Layer 2 Integration (Future)
- Polygon/Arbitrum deployment options
- Cross-chain bridge support
- Lower transaction costs

### State Management
- Efficient storage patterns
- Event-based architecture
- Off-chain computation where possible

## Technology Choices

### Why Chainlink VRF?
- Industry standard for on-chain randomness
- Cryptographically secure and verifiable
- Battle-tested in production
- Transparent proof generation

### Why Hardhat?
- Robust testing framework
- TypeScript support
- Extensive plugin ecosystem
- Great developer experience

### Why Next.js?
- Server-side rendering
- Optimal performance
- API routes for backend logic
- Excellent Web3 integration

## Future Enhancements

1. **Multi-chain Support**
   - Deploy on multiple networks
   - Cross-chain gaming

2. **NFT Integration**
   - Achievement NFTs
   - Game item NFTs
   - Profile customization

3. **Social Features**
   - Referral system
   - Tournaments
   - Leaderboards with rewards

4. **Advanced Games**
   - Multi-player games
   - More complex game mechanics
   - Progressive jackpots

## Testing Strategy

### Smart Contract Tests
- Unit tests for each contract
- Integration tests for workflows
- Fuzz testing for edge cases
- Gas profiling

### Frontend Tests
- Component unit tests
- E2E tests with Playwright
- Web3 integration tests
- UI/UX testing

## Deployment Strategy

1. **Local Development**
   - Hardhat network
   - Mock VRF coordinator

2. **Testnet Deployment**
   - Sepolia testnet
   - Real Chainlink VRF
   - Full testing

3. **Mainnet Deployment**
   - Gradual rollout
   - Monitoring and alerts
   - Emergency response plan

---

*This architecture is designed to be modular, secure, and scalable for the Marcasino project.*
