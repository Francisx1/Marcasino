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
├── scripts/              # Deployment scripts
└── package.json
```

## 🎲 Game Options (Choose 2 for Implementation)

### Option 1: Coin Flip (Mario vs Luigi)
- Simple binary outcome game
- Bet on Mario (heads) or Luigi (tails)
- Multiplier: 1.95x (5% house edge)
- **Difficulty:** Easy to implement

### Option 2: Mystery Box Dice
- Roll for multipliers (1-100)
- Different prize tiers inspired by Mario items
- 4 risk levels: Mushroom (1.5x), Fire Flower (10x), Star (50x), 1-Up (98x)
- **Difficulty:** Medium

### Option 3: Power-Up Lottery
- Time-based raffle system
- Buy tickets with coins
- Random winner selection via VRF
- **Difficulty:** Medium

### Option 4: Bowser's Castle Prediction Market
- Binary outcome predictions
- Community-driven betting pools
- Time-locked resolution
- **Difficulty:** Hard

### Option 5: Toad's Card Game
- Simplified poker/blackjack
- Multiplayer support
- Turn-based mechanics
- **Difficulty:** Hard

**Note:** Contracts for Options 1 & 2 are already implemented as examples. Final game selection to be determined.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.x
- Yarn or npm
- MetaMask or similar Web3 wallet
- Infura/Alchemy API key
- Chainlink VRF subscription

### Installation

```bash
# Install dependencies
npm install

# Install contract dependencies
cd contracts && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
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
# Start local Hardhat blockchain (Terminal 1)
cd contracts
npm run node

# Deploy contracts locally (Terminal 2)
cd contracts
npm run deploy:local

# Start frontend development server (Terminal 3)
cd frontend
npm run dev

# Run tests
cd contracts
npm test
```

**Note:** For detailed local testing guide, see [LOCAL_TESTING_GUIDE.md](LOCAL_TESTING_GUIDE.md)

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
2. **VRFConsumerGame.sol** - Base contract for VRF integration
3. **TreasuryManager.sol** - Betting pool and payout management
4. **GameFactory.sol** - Factory for deploying new games

### Game Contracts

1. **CoinFlipGame.sol** - Example: Binary outcome game (Mario vs Luigi)
2. **DiceGame.sol** - Example: Variable multiplier dice game
3. **[TBD]** - Final game selection pending

## 🎨 Frontend Features

- **Super Mario 8-bit Theme** - Pixel-perfect nostalgic design
- **Web3 Integration** - MetaMask, WalletConnect support
- **Real-time Updates** - Live game state via WebSockets
- **Responsive Design** - Mobile-friendly interface
- **Sound Effects** - Classic Mario sounds
- **Leaderboards** - Top players tracking

## 🧪 Testing

```bash
# Run all tests
npm run test

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
cd contracts
npm run deploy:sepolia
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
- Chainlink VRF v2

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
- [x] Implement example games (CoinFlip + Dice)
- [x] Frontend development with Super Mario theme
- [x] Basic testing suite (Core + Treasury)
- [x] Security documentation
- [x] Local testing guide
- [ ] Finalize game selection (choose 2)
- [ ] Comprehensive game testing
- [ ] Chainlink VRF integration testing
- [ ] Sepolia testnet deployment
- [ ] Frontend contract integration
- [ ] Security audit (optional)

## 📞 Contact

Project Link: [https://github.com/Francisx1/Marcasino](https://github.com/Francisx1/Marcasino)

---

**Remember:** It's-a me, Mario! Let's-a go! 🍄✨
