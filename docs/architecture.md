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
│  ┌──────────────┐                          │
│  │ MarcasinoCore│                          │
│  └──────┬───────┘                          │
│         │                                   │
│         │  manages/authorizes               │
│         │                                   │
│  ┌──────▼───────────────────────────────┐  │
│  │    VRFConsumerGame (Abstract)        │  │
│  │  - requestRandomWords()              │  │
│  │  - fulfillRandomWords()              │  │
│  └──────┬───────────────────────────────┘  │
│         │ inherits                          │
│         │                                   │
│  ┌──────▼────────┐  ┌──────────────────┐  │
│  │  CoinFlipGame │  │   DiceGame       │  │
│  │  (commit-     │  │   (multi-tier    │  │
│  │   reveal)     │  │    payouts)      │  │
│  └───────────────┘  └──────────────────┘  │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   PowerUpLottery                   │    │
│  │   (round-based, MCT tokens)        │    │
│  └────────────────────────────────────┘    │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │       TreasuryManager.sol            │  │
│  │  - depositToken()                    │  │
│  │  - deductTokens()                    │  │
│  │  - payoutWinnings()                  │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │       MockERC20.sol (MCT)            │  │
│  │  - Used for lottery betting          │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
              ▲
              │ VRF Callback
              │
     ┌────────┴────────┐
     │ Chainlink VRF   │
     │ Coordinator     │
     │ (or Local Mock) │
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
│  │  - Home (/)                          │  │
│  │  - Games Lobby (/games)              │  │
│  │  - CoinFlip Game                     │  │
│  │  - Dice Game                         │  │
│  │  - Lottery Game                      │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Components Layer                │  │
│  │  - Header (Navigation + Wallet)      │  │
│  │  - Footer (Minimal)                  │  │
│  │  - Hero (Landing page)               │  │
│  │  - GameGrid (Game cards)             │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Hooks & State Management        │  │
│  │  - useAccount (Wagmi)                │  │
│  │  - useContractRead (Wagmi)           │  │
│  │  - useContractWrite (Wagmi)          │  │
│  │  - useChainId                        │  │
│  └────────────┬─────────────────────────┘  │
│               │                             │
│  ┌────────────▼─────────────────────────┐  │
│  │      Web3 Integration Layer          │  │
│  │  - Wagmi v2 + Viem                   │  │
│  │  - RainbowKit v2 (Wallet UI)         │  │
│  │  - Contract ABIs                     │  │
│  │  - Deployment Configs                │  │
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

**Purpose:** Centralized treasury for all game funds management

**Key Responsibilities:**
- Accept deposits (ETH and ERC-20 tokens including MCT)
- Process withdrawals for players
- Secure fund isolation (games don't hold funds directly)
- Execute payouts on behalf of authorized games
- Track token balances per player
- Risk management controls

**Key Features:**
- **Security Isolation**: Game contracts don't directly hold funds
- **Multi-token Support**: Handles ETH, MCT, and other ERC-20 tokens
- **Role-based Access**: Only authorized games can deduct/payout
- **Configurable Limits**: Min/max bet amounts, payout ratios
- **Emergency Controls**: Pause functionality for security

**Key Functions:**
```solidity
function depositToken(address token, uint256 amount) external
function deductTokens(address player, address token, uint256 amount) external onlyAuthorizedGame
function payoutWinnings(address winner, uint256 amount) external onlyAuthorizedGame
function setSupportedToken(address token, bool supported) external onlyOwner
function setMaxSinglePayoutRatio(uint256 ratio) external onlyOwner
```

**Treasury Flow:**
```
Player Wallet
   ↓ (deposit)
TreasuryManager (secure vault)
   ↓ (authorized deduction)
Game Contract (processes bet)
   ↓ (win)
TreasuryManager (payout)
   ↓
Player Wallet
```

### Game Contracts

**Implemented Games:**

1. **CoinFlipGame** - Binary outcome with commit-reveal
   - Prevents front-running via secret hash commitment
   - VRF determines Mario or Luigi win
   - 1.95x payout multiplier

2. **DiceGame** - Multi-tier outcome game
   - Risk levels: Mushroom, Fire Flower, Star, 1-Up
   - 1.5x to 98x payout multipliers
   - Commit-reveal protection

3. **PowerUpLottery** - Round-based raffle
   - Uses MCT token for tickets
   - Time-based rounds (60s local, 3600s testnet)
   - VRF selects winner from all participants

## Data Flow

### Betting Flow (CoinFlip/Dice)

```
1. User connects wallet (MetaMask/RainbowKit)
2. User selects game and bet amount
3. User commits bet with secret hash + slashing deposit
4. Game contract requests VRF randomness
5. User waits for VRF fulfillment (~2 minutes)
6. User reveals bet with original secret
7. Contract validates secret hash matches
8. Game calculates outcome based on VRF result
9. Treasury processes payout if player wins
10. Event emitted for frontend update
```

### Betting Flow (Lottery)

```
1. User gets MCT tokens (faucet on testnet)
2. User approves TreasuryManager to spend MCT
3. User deposits MCT into TreasuryManager
4. User buys lottery tickets (1 MCT each)
5. Round timer expires or admin ends round
6. Contract requests VRF for winner selection
7. VRF returns random number
8. Winner determined from ticket holders
9. Treasury pays out prize pool to winner
10. New round automatically starts
```

### Local VRF Testing Flow

For local development, Chainlink VRF doesn't auto-fulfill. Manual fulfillment required:

```
1. Game requests randomness → requestId = 1, 2, 3...
2. Check Hardhat node terminal for requestId
3. Run fulfill script:
   npx hardhat run scripts/fulfill-vrf.js --network localhost -- <requestId>
4. LocalVRFCoordinatorV2PlusMock fulfills the request
5. Game's fulfillRandomWords callback executed
6. User can now reveal/settle their bet
```

**Scripts for VRF:**
- `scripts/fulfill-vrf.js` - Simple VRF fulfillment (recommended)
- `scripts/fulfill.js` - Advanced VRF with custom random values

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
