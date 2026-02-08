# 🍄 Local Testing Guide - Marcasino

## 🎯 Goal
Test your casino platform **completely locally** before deploying to Sepolia testnet.

---

## 📋 Prerequisites

✅ Node.js v20.18.0+ installed  
✅ All dependencies installed (`npm run install:all`)  
✅ MetaMask or similar Web3 wallet installed

---

## 🚀 Step-by-Step Local Testing

### Step 1: Start Local Blockchain

Open **Terminal 1** and run:

```bash
cd contracts
npm run node
```

**What this does:**
- Starts Hardhat local blockchain on `http://127.0.0.1:8545`
- Creates 20 test accounts with 10,000 ETH each
- Blockchain resets every time you restart

**Expected Output:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

🔥 **IMPORTANT:** Copy the private key of Account #0 for later!

---

### Step 2: Deploy Contracts Locally

Open **Terminal 2** (keep Terminal 1 running):

```bash
cd contracts

# Copy environment example
copy .env.example .env

# Deploy to local network
npm run deploy:local
```

**What this does:**
- Deploys all contracts to local blockchain
- Registers games
- Grants permissions
- Funds treasury with 10 ETH
- Saves deployment addresses to `deployments/localhost.json`

**Expected Output:**
```
🍄 Deploying Marcasino Contracts...

✅ MarcasinoCore deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ TreasuryManager deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
✅ CoinFlipGame deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
✅ DiceGame deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

💾 Deployment data saved to deployments/localhost.json
```

---

### Step 3: Configure MetaMask for Local Network

1. **Open MetaMask**
2. **Click network dropdown** → "Add Network" → "Add network manually"
3. **Enter details:**
   ```
   Network Name: Hardhat Local
   RPC URL: http://127.0.0.1:8545
   Chain ID: 31337
   Currency Symbol: ETH
   ```
4. **Save**

---

### Step 4: Import Test Account to MetaMask

1. **MetaMask** → Click account icon → "Import Account"
2. **Paste Private Key** from Terminal 1 (Account #0)
   ```
   Example: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
3. **Import**
4. **Switch to "Hardhat Local" network**

You should see **~10,000 ETH** balance! 💰

---

### Step 5: Start Frontend

Open **Terminal 3** (keep Terminals 1 & 2 running):

```bash
cd frontend
npm run dev
```

**Expected Output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

---

### Step 6: Connect Frontend to Local Contracts

**Option A: Automatic (Recommended)**

The frontend will automatically use `localhost.json` deployment addresses.

**Option B: Manual Update**

Create `frontend/src/contracts/addresses.json`:

```json
{
  "31337": {
    "MarcasinoCore": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "TreasuryManager": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "CoinFlipGame": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    "DiceGame": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
  }
}
```

---

### Step 7: Test the Casino! 🎰

1. **Open browser:** http://localhost:3000
2. **Connect wallet** → Select MetaMask → Connect
3. **Switch to Hardhat Local network** in MetaMask
4. **Test Coin Flip:**
   - Click "Play Now" on Coin Flip game
   - Choose Mario (0) or Luigi (1)
   - Enter bet amount (e.g., 0.1 ETH)
   - Click "Commit Bet" → Confirm transaction
   - Wait 120 seconds (reveal delay)
   - Click "Reveal Bet" → Confirm transaction
   - Click "Settle Request" → Confirm transaction
   - **Manually fulfill VRF** (see Step 8)
   - Check if you won!

5. **Test Dice Game:**
   - Similar flow to Coin Flip with dice outcomes

6. **Test Power-Up Lottery:**
   - Click "Faucet + Deposit MCT" → Get tokens
   - Enter ticket count (e.g., 5)
   - Click "Buy Tickets" → Confirm transaction
   - Wait for round to end (60 seconds locally)
   - Click "Request Draw" → Confirm transaction
   - **Manually fulfill VRF** (see Step 8)
   - Click "Settle" → Confirm transaction
   - Check if you won!

---

### Step 8: Manually Fulfill VRF Requests (Local Testing Only)

Since local blockchain doesn't have real Chainlink VRF, you need to manually fulfill randomness requests.

**Open Terminal 4:**

```bash
cd contracts
npx hardhat run scripts/fulfill.js --network localhost
```

**If you need specific values:**
```bash
# With specific request ID and random word
REQUEST_ID=1 RANDOM_WORD=12345 npx hardhat run scripts/fulfill.js --network localhost

# Or use PowerShell
$env:REQUEST_ID="1"; $env:RANDOM_WORD="12345"; npx hardhat run scripts/fulfill.js --network localhost
```

**Expected Output:**
```
🎲 Fulfilling VRF request...
✅ Fulfilled request 1 with random word: 12345
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Wallet connects successfully
- [ ] Can see contract addresses
- [ ] Can commit bet (Coin Flip)
- [ ] Can reveal bet after delay
- [ ] Can settle request with VRF
- [ ] Can manually fulfill VRF locally
- [ ] Balance updates after bet/payout
- [ ] Can play Dice Game
- [ ] Can buy lottery tickets with MCT
- [ ] Can request lottery draw
- [ ] Can settle lottery with VRF
- [ ] Can see game history and VRF links

### Treasury Management
```bash
# Check treasury balance
cd contracts
npx hardhat console --network localhost

> const treasury = await ethers.getContractAt("TreasuryManager", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
> await ethers.provider.getBalance(treasury.address)
```

### Player Balance
```bash
> const player = "YOUR_METAMASK_ADDRESS"
> await treasury.playerBalances(player)
```

---

## 🔍 Common Issues & Solutions

### ❌ "Nonce too high" Error
**Cause:** MetaMask nonce out of sync with local blockchain

**Solution:**
1. MetaMask → Settings → Advanced → Clear activity tab data
2. Restart Hardhat node
3. Redeploy contracts

---

### ❌ "Contract not deployed" Error
**Cause:** Frontend using wrong contract addresses

**Solution:**
1. Check `deployments/localhost.json` exists
2. Copy addresses to frontend
3. Restart frontend dev server

---

### ❌ VRF Request Hangs
**Cause:** Local blockchain doesn't have real Chainlink VRF

**Solution:** Use the built-in fulfillment script:

```bash
# Terminal 4
cd contracts
npx hardhat run scripts/fulfill.js --network localhost
```

**For specific requests:**
```bash
REQUEST_ID=1 RANDOM_WORD=12345 npx hardhat run scripts/fulfill.js --network localhost
```

**Alternative: Manual fulfillment in console:**
```bash
npx hardhat console --network localhost

> const LocalVRFCoordinatorV2PlusMock = await ethers.getContractFactory("LocalVRFCoordinatorV2PlusMock")
> const coordinator = await LocalVRFCoordinatorV2PlusMock.attach("0x5FbDB2315678afecb367f032d93F642f64180aa3")
> await coordinator.fulfillRequest(1, 12345) // requestId, randomWord
```

---

## 🎯 Testing Without VRF (Quick Tests)

For faster testing without VRF delays:

1. Deploy mock game contracts (no VRF)
2. Use deterministic randomness
3. Test game logic only

**Create:** `contracts/src/games/CoinFlipGameMock.sol`

```solidity
// Remove VRF dependency
// Use block.timestamp or msg.sender for "randomness"
// FOR TESTING ONLY - NOT PRODUCTION!
```

---

## 📊 Monitor Activity

### View Logs
```bash
# Terminal 1 (Hardhat node) shows all transactions
# Look for:
eth_sendTransaction
eth_getTransactionReceipt
```

### Check Events
```bash
npx hardhat console --network localhost

> const game = await ethers.getContractAt("CoinFlipGame", "ADDRESS")
> const filter = game.filters.GamePlayed()
> const events = await game.queryFilter(filter)
> console.log(events)
```

---

## ✅ Ready for Sepolia?

Once you've tested locally and everything works:

1. **Get Sepolia ETH:**
   - Visit https://sepoliafaucet.com/
   - Request test ETH

2. **Set up Chainlink VRF:**
   - Go to https://vrf.chain.link/
   - Create subscription on Sepolia
   - Fund with LINK tokens
   - Add consumer contracts

3. **Deploy to Sepolia:**
   ```bash
   # Update .env with real values
   npm run deploy:sepolia
   ```

4. **Verify contracts:**
   ```bash
   npm run verify:sepolia
   ```

5. **Update frontend** to use Sepolia addresses

---

## 🎮 Complete Local Testing Workflow

```
┌─────────────────────────────────────────────────┐
│  1. Start Hardhat Node (Terminal 1)            │
│     ↓                                           │
│  2. Deploy Contracts (Terminal 2)              │
│     ↓                                           │
│  3. Start Frontend (Terminal 3)                │
│     ↓                                           │
│  4. Connect MetaMask to Hardhat Local          │
│     ↓                                           │
│  5. Commit Bet (Coin Flip/Dice)                │
│     ↓                                           │
│  6. Wait 120s → Reveal Bet                     │
│     ↓                                           │
│  7. Settle Request → Get Request ID             │
│     ↓                                           │
│  8. Fulfill VRF (Terminal 4)                   │
│     ↓                                           │
│  9. Check Results → Repeat                     │
│     ↓                                           │
│ 10. Test Lottery (Buy → Request → Fulfill)     │
│     ↓                                           │
│ 11. Make Changes → Restart & Redeploy          │
│     ↓                                           │
│ 12. Deploy to Sepolia 🚀                       │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Quick Commands Reference

```bash
# Start local blockchain
cd contracts && npm run node

# Deploy contracts locally
cd contracts && npm run deploy:local

# Run tests
cd contracts && npm run test

# Start frontend
cd frontend && npm run dev

# Fulfill VRF requests (local testing)
cd contracts && npx hardhat run scripts/fulfill.js --network localhost

# Clean restart
# 1. Ctrl+C all terminals
# 2. Delete deployments/localhost.json
# 3. Start fresh
```

---

## 🎉 You're Ready!

Your local testing environment is set up! Now you can:
- ✅ Test without spending real money
- ✅ Instant transactions (no waiting)
- ✅ Unlimited test ETH
- ✅ Fast iteration cycles
- ✅ Safe experimentation

**Let's-a go! 🍄**
