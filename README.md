# 🍄 Marcasino - Super Mario Web3 Casino 🎰

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A provably fair, decentralized gaming platform with Super Mario theme, powered by Chainlink VRF for verifiable randomness.

## 🎮 Project Overview

Marcasino is an advanced decentralized application (dApp) that demonstrates mastery of blockchain development principles, smart contract composition patterns, and DeFi protocols. It features:

- ✅ **Provably Fair Gaming** - Chainlink VRF integration for verifiable randomness
- ✅ **Multiple Game Types** - Various betting mechanisms with Mario theme
- ✅ **Anti-Cheating Measures** - Commitment schemes and time-locked reveals
- ✅ **Treasury Management** - ETH and ERC-20 token support with automated payouts
- ✅ **Super Mario Theme** - Nostalgic 8-bit styled UI/UX

## 🏗️ Architecture

```
Marcasino/
├── README.md
├── contracts/              # Smart contracts (Hardhat)
│   ├── src/
│   │   ├── core/          # Core casino contracts
│   │   ├── games/         # Individual game implementations
│   │   ├── interfaces/    # Contract interfaces
│   │   └── libraries/     # Shared libraries
│   ├── test/              # Contract tests
│   ├── scripts/            # Hardhat scripts (deploy, local VRF fulfill, sepolia helpers)
│   └── hardhat.config.js
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── styles/       # CSS and themes
│   │   └── utils/        # Utilities
│   └── public/           # Static assets
├── docs/                 # Documentation
│   ├── architecture.md
│   ├── security-analysis.md
│   └── gas-optimization.md
├── scripts/              # (Optional) misc scripts
└── package.json
```

## 🎲 Implemented Games

### 1. Coin Flip (Mario vs Luigi)
- Simple binary outcome game
- Bet on Mario (heads) or Luigi (tails)
- Multiplier: 1.95x (5% house edge)
- **Features:** Commit-reveal scheme, VRF randomness, slashing deposits

### 2. Mystery Box Dice
- Roll for multipliers (1-100)
- Different prize tiers inspired by Mario items
- 4 risk levels: Mushroom (1.5x), Fire Flower (10x), Star (50x), 1-Up (98x)
- **Features:** Commit-reveal scheme, VRF randomness, tiered payouts

### 3. Power-Up Lottery
- Time-based raffle system
- Buy tickets with MCT tokens
- Random winner selection via VRF
- **Features:** ERC-20 token betting, round-based draws, VRF winner selection

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- Yarn or npm
- MetaMask or similar Web3 wallet
- Infura/Alchemy API key
- Chainlink VRF subscription

### Installation

```bash
# Install all workspaces (root + contracts + frontend)
npm run install:all
```

### Configuration

1. Copy `.env.example` to `.env` in both root and contracts directories:
```bash
cp .env.example .env
cp contracts/.env.example contracts/.env
```

2. Fill in your environment variables:
```
# Required for Sepolia testnet deployment
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=your_sepolia_rpc_url
ETHERSCAN_API_KEY=your_etherscan_key
VRF_SUBSCRIPTION_ID_SEPOLIA=your_chainlink_vrf_subscription_id

# Local testing (no configuration needed)
# Hardhat network uses default test accounts
```

### Development

```bash
# Terminal 1: start local Hardhat node
npm run node

# Terminal 2: deploy contracts to localhost
npm run deploy:local

# Terminal 3: start frontend
npm run dev:frontend
```

### Local testing (localhost)

On localhost, VRF is mocked and must be manually fulfilled.

```bash
# (Optional) skip commit-reveal delay during local testing
cd contracts
npm run time:advance

# Manually fulfill VRF requests (LOCAL ONLY)
REQUEST_ID=1 npx hardhat run --network localhost scripts/fulfill.js
```

**Note:** For detailed local testing guide including VRF fulfillment, see [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)

## 🔐 Security Features

- **Chainlink VRF Integration** - Cryptographically secure randomness
- **Commitment Schemes** - Prevent front-running
- **Time-Locked Reveals** - Fair gameplay mechanics
- **Reentrancy Guards** - Protection against reentrancy attacks
- **Access Control** - Role-based permissions
- **Emergency Pause** - Circuit breaker pattern

## 📊 Smart Contract Architecture

### Core Contracts

1. **MarcasinoCore.sol** - Main casino management contract
2. **VRFConsumerGame.sol** - Base contract for VRF v2.5 integration
3. **TreasuryManager.sol** - Betting pool and payout management with configurable risk controls
4. **MockERC20.sol** - ERC-20 token for lottery betting (MCT)

### Game Contracts

1. **CoinFlipGame.sol** - Binary outcome game with commit-reveal and VRF randomness
2. **DiceGame.sol** - Variable multiplier dice game with tiered payouts
3. **PowerUpLottery.sol** - Time-based lottery with ERC-20 token betting
4. **LocalVRFCoordinatorV2PlusMock.sol** - Local testing VRF coordinator mock

## 🎨 Frontend Features

- **Super Mario 8-bit Theme** - Pixel-perfect nostalgic design
- **Web3 Integration** - MetaMask, RainbowKit wallet support
- **Responsive Design** - Mobile-friendly interface
- **Real-time Game State** - Live updates via blockchain events
- **Clean UI** - Minimalist game-focused interface

## 🧪 Testing

```bash
# Run all contract tests (from repo root)
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test contracts/test/MarcasinoCore.test.js
```

## 📦 Deployment

### Testnet Deployment (Sepolia)

1. Get Sepolia ETH from faucet: https://sepoliafaucet.com
2. Create Chainlink VRF subscription: https://vrf.chain.link
3. Fund subscription with LINK tokens
4. Update `.env` with VRF subscription ID
5. Deploy:

```bash
npm run deploy:sepolia
```

### Sepolia VRF Notes (Testnet)

- **Fulfillment is automatic on Sepolia**: Chainlink VRF nodes call `fulfillRandomWords` on-chain. You cannot (and should not) run `scripts/fulfill.js` on Sepolia.
- **Settlement is a separate transaction**: after `fulfilled=true`, call `settleRequest(requestId)` to resolve the game and write the result.
- The frontend auto-refreshes `fulfilled/settled` status and shows a Chainlink Explorer link for the VRF request.

### Useful Sepolia helper scripts

```bash
# Raise Treasury payout ratio on Sepolia (testnet convenience)
cd contracts
npx hardhat run --network sepolia scripts/set-treasury-payout-ratio-sepolia.js

# Redeploy only the Lottery contract (PowerUpLottery) and sync deployments JSON
npx hardhat run --network sepolia scripts/redeploy-lottery.js
```

### Troubleshooting: `settleRequest` Reverts With `PayoutTooLarge`

If `settleRequest` reverts with `PayoutTooLarge(...)`, the Treasury risk limit is blocking the payout (default `maxSinglePayoutRatio`).

For testnet testing, you can temporarily raise the ratio on the deployed Sepolia TreasuryManager:

```bash
cd contracts
npx hardhat run --network sepolia scripts/set-treasury-payout-ratio-sepolia.js
```

You can override the value (1..100) with:

```bash
cd contracts
TREASURY_MAX_SINGLE_PAYOUT_RATIO=20 npx hardhat run --network sepolia scripts/set-treasury-payout-ratio-sepolia.js
```

### Verification (After deployment)

```bash
npm run verify:sepolia
```

**Note:** Mainnet deployment not recommended for academic project

## 🔗 Technical Stack

**Blockchain:**
- Solidity ^0.8.20
- Hardhat
- OpenZeppelin Contracts
- Chainlink VRF v2.5

**Frontend:**
- Next.js 16.1.6 (Turbopack)
- React 18
- TypeScript
- Wagmi v2 + Viem (Web3 integration)
- RainbowKit v2 (Wallet connection)
- TailwindCSS (Super Mario theme)
- Framer Motion (animations)

## 📚 Documentation

For detailed documentation, see:
- [Architecture](docs/architecture.md)
- [Security Analysis](docs/security-analysis.md)
- [Gas Optimization](docs/gas-optimization.md)

## 🤝 Contributing

This is an academic project. Contributions and suggestions are welcome!

## ⚖️ License

MIT License - see LICENSE file for details


## 🔮 Roadmap

- [x] Complete smart contract architecture
- [x] Implement three games (CoinFlip, Dice, PowerUpLottery)
- [x] Frontend development with Super Mario theme
- [x] Comprehensive testing suite (Core + Treasury + Games)
- [x] Chainlink VRF v2.5 integration with local mock
- [x] Local testing environment with VRF fulfillment
- [x] Sepolia testnet deployment with VRF v2.5
- [x] Configurable TreasuryManager risk controls
- [x] ERC-20 token integration for lottery
- [x] Frontend deployment configuration sync
- [x] Comprehensive frontend contract integration
- [x] UI cleanup and optimization
- [x] Security audit (optional)

## ✅ SC6107 Option 4 Alignment (On-Chain Verifiable Random Game Platform)

This project is designed to satisfy the SC6107 Option 4 requirements: a provably fair on-chain gaming platform using verifiable randomness.

### Verifiable Randomness (Chainlink VRF)

- Chainlink VRF v2.5 is integrated via a shared base contract (`VRFConsumerGame.sol`).
- Requests and outcomes are recorded on-chain and exposed to the frontend for verification.
- On Sepolia, VRF fulfillment is performed automatically by Chainlink nodes (no manual fulfill on testnet).
- Local development uses a mock VRF coordinator and a local-only fulfillment script.

### Game Implementations (>= 2)

- CoinFlip (commit–reveal + VRF outcome)
- Dice (tiered multipliers + commit–reveal + VRF outcome)
- PowerUpLottery (ticket-based raffle + VRF winner selection)

### Betting & Treasury Management

- Supports ETH and ERC-20 betting (MCT for lottery).
- Funds are isolated in `TreasuryManager.sol` with configurable risk controls (min/max bet, payout ratio, reserve checks).
- Payouts are credited to an internal balance in the treasury and can be withdrawn to the wallet from the frontend.

### Anti-Cheating & Fairness (Anti-MEV)

- Commit–reveal scheme for games where the player chooses an action before randomness is requested.
- Time-locked reveals and expiration windows.
- Slashing deposits for malicious or non-revealed commitments.

### Operational Considerations

- VRF callback gas limitations are handled by separating VRF fulfillment from settlement (manual `settleRequest(requestId)` step).
- Frontend polls request state (`fulfilled/settled`) and provides links to verify VRF requests on Chainlink Explorer.
- Scripts are provided for testnet troubleshooting (e.g., adjusting treasury payout ratio).

## 🎤 Marcasino Presentation Script (SC6107)

### Speaker 1: Oscar (Introduction → Architecture)

Hello everyone, today we present Marcasino, a provably fair Web3 gaming platform deployed on the Sepolia testnet.

Traditional online games rely on centralized servers, which makes fairness and transparency difficult to verify.
Our goal is to design a fully on-chain lottery system where randomness, fund management, and settlement are all publicly verifiable.

Marcasino integrates Chainlink VRF for cryptographically secure randomness, an isolated treasury contract for fund protection, and a commit–reveal mechanism to mitigate front-running and MEV attacks.

This slide shows the overall system architecture, including the frontend Web3 interface, smart contracts, treasury management, and VRF oracle interaction that together form a complete decentralized gaming workflow.

Next, Zhang He will introduce the smart contract design and core technical mechanisms.

### Speaker 2: Zhang He (Smart Contract → Security → VRF)

Thank you. I will explain the smart contract design and key technical decisions.

Our system is built around a VRF-based game contract that securely requests randomness from Chainlink and records each request on-chain for verification.

To protect user funds, we separate gameplay logic from treasury management, reducing the attack surface and ensuring secure payout.

We also implement a commit–reveal mechanism to prevent front-running before randomness is generated, which improves fairness in public blockchain environments.

Together, VRF randomness, treasury isolation, and anti-MEV protection create a provably fair and secure on-chain gaming system.

Next, Wang Xunye will demonstrate the user interaction flow and real on-chain results.

### Speaker 3: Wang Xunye (User Flow → Results → Demo Intro)

Thank you. This slide shows the complete on-chain user interaction flow.

Players first deposit MCT tokens into the treasury and purchase lottery tickets transparently on-chain.

Then Chainlink VRF generates verifiable randomness to determine the winner, followed by on-chain settlement and payout.

Here we show real transaction execution and live Web3 interaction on the Sepolia testnet, confirming that the full system works end-to-end.

In conclusion, Marcasino demonstrates a functional, secure, and verifiably fair decentralized gaming platform.

Now we will present a short live demo.

### Demo Script (1 Minute Live Demonstration)

We will quickly demonstrate the full workflow:

1. Connect wallet
2. Deposit tokens
3. Purchase a lottery ticket
4. Request a VRF draw
5. Wait for VRF fulfillment
6. Settle the request and show the winner and prize withdrawal

## 📞 Contact

Project Link: [https://github.com/Francisx1/Marcasino](https://github.com/Francisx1/Marcasino)

---

**Remember:** It's-a me, Mario! Let's-a go! 🍄✨
