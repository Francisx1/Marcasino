const hre = require("hardhat");

async function main() {
  console.log("🍄 Deploying Marcasino Contracts...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Configuration
  const HOUSE_EDGE = 100; // 1% in basis points
  const MIN_BET = hre.ethers.parseEther("0.01"); // 0.01 ETH
  const MAX_BET = hre.ethers.parseEther("1000.0");  // 1000 (also used as token units for MCT)
  
  // VRF Configuration
  let VRF_COORDINATOR = process.env.VRF_COORDINATOR_SEPOLIA || "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625";
  let VRF_KEY_HASH = process.env.VRF_KEY_HASH_SEPOLIA || "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c";
  let VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID_SEPOLIA || "0";
  const CALLBACK_GAS_LIMIT = 100000;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("\n🧪 Deploying LocalVRFCoordinatorV2PlusMock for local testing...");
    const LocalVRFCoordinatorV2PlusMock = await hre.ethers.getContractFactory(
      "LocalVRFCoordinatorV2PlusMock"
    );
    const localVrf = await LocalVRFCoordinatorV2PlusMock.deploy();
    await localVrf.waitForDeployment();
    VRF_COORDINATOR = await localVrf.getAddress();
    VRF_KEY_HASH = hre.ethers.ZeroHash;
    VRF_SUBSCRIPTION_ID = "1";
    console.log("✅ Local VRF Coordinator deployed to:", VRF_COORDINATOR);
  }

  // 1. Deploy MarcasinoCore
  console.log("\n📦 Deploying MarcasinoCore...");
  const MarcasinoCore = await hre.ethers.getContractFactory("MarcasinoCore");
  const marcasinoCore = await MarcasinoCore.deploy(HOUSE_EDGE);
  await marcasinoCore.waitForDeployment();
  const marcasinoCoreAddress = await marcasinoCore.getAddress();
  console.log("✅ MarcasinoCore deployed to:", marcasinoCoreAddress);

  // 2. Deploy TreasuryManager
  console.log("\n📦 Deploying TreasuryManager...");
  const TreasuryManager = await hre.ethers.getContractFactory("TreasuryManager");
  const treasuryManager = await TreasuryManager.deploy(MIN_BET, MAX_BET);
  await treasuryManager.waitForDeployment();
  const treasuryManagerAddress = await treasuryManager.getAddress();
  console.log("✅ TreasuryManager deployed to:", treasuryManagerAddress);

  // 2.5 Deploy Mock Token (MCT)
  console.log("\n🪙 Deploying MockERC20 (MCT)...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const initialSupply = hre.ethers.parseUnits("10000", 18);
  const mockToken = await MockERC20.deploy();
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("✅ MockERC20 deployed to:", mockTokenAddress);

  console.log("\n🔧 Enabling MCT in Treasury...");
  const txEnable = await treasuryManager.setSupportedToken(mockTokenAddress, true);
  await txEnable.wait();
  console.log("✅ MCT supported in Treasury");

  // 3. Set Treasury Manager in Core
  console.log("\n🔗 Linking TreasuryManager to Core...");
  const tx1 = await marcasinoCore.setTreasuryManager(treasuryManagerAddress);
  await tx1.wait();
  console.log("✅ Treasury linked successfully");

  // 4. Deploy CoinFlipGame
  console.log("\n📦 Deploying CoinFlipGame...");
  const CoinFlipGame = await hre.ethers.getContractFactory("CoinFlipGame");
  const coinFlipGame = await CoinFlipGame.deploy(
    marcasinoCoreAddress,
    VRF_COORDINATOR,
    VRF_KEY_HASH,
    VRF_SUBSCRIPTION_ID,
    CALLBACK_GAS_LIMIT
  );
  await coinFlipGame.waitForDeployment();
  const coinFlipGameAddress = await coinFlipGame.getAddress();
  console.log("✅ CoinFlipGame deployed to:", coinFlipGameAddress);

  // 5. Deploy DiceGame
  console.log("\n📦 Deploying DiceGame...");
  const DiceGame = await hre.ethers.getContractFactory("DiceGame");
  const diceGame = await DiceGame.deploy(
    marcasinoCoreAddress,
    VRF_COORDINATOR,
    VRF_KEY_HASH,
    VRF_SUBSCRIPTION_ID,
    CALLBACK_GAS_LIMIT
  );
  await diceGame.waitForDeployment();
  const diceGameAddress = await diceGame.getAddress();
  console.log("✅ DiceGame deployed to:", diceGameAddress);

  // 5.5 Deploy PowerUpLottery
  console.log("\n📦 Deploying PowerUpLottery...");
  const PowerUpLottery = await hre.ethers.getContractFactory("PowerUpLottery");
  const TICKET_PRICE = hre.ethers.parseUnits("1", 18); // 1 MCT
  const ROUND_DURATION = (hre.network.name === "localhost" || hre.network.name === "hardhat")
    ? 60
    : 3600;
  const powerUpLottery = await PowerUpLottery.deploy(
    marcasinoCoreAddress,
    mockTokenAddress,
    TICKET_PRICE,
    ROUND_DURATION,
    VRF_COORDINATOR,
    VRF_KEY_HASH,
    VRF_SUBSCRIPTION_ID,
    CALLBACK_GAS_LIMIT
  );
  await powerUpLottery.waitForDeployment();
  const powerUpLotteryAddress = await powerUpLottery.getAddress();
  console.log("✅ PowerUpLottery deployed to:", powerUpLotteryAddress);

  // 6. Register games in Core
  console.log("\n🎮 Registering games...");
  const tx2 = await marcasinoCore.registerGame(coinFlipGameAddress, "CoinFlip");
  await tx2.wait();
  console.log("✅ CoinFlip registered");

  const tx3 = await marcasinoCore.registerGame(diceGameAddress, "Dice");
  await tx3.wait();
  console.log("✅ Dice registered");

  const tx3b = await marcasinoCore.registerGame(powerUpLotteryAddress, "PowerUpLottery");
  await tx3b.wait();
  console.log("✅ PowerUpLottery registered");

  // 7. Grant GAME_ROLE to games in Treasury
  console.log("\n🔑 Granting permissions...");
  const GAME_ROLE = await treasuryManager.GAME_ROLE();
  
  const tx4 = await treasuryManager.grantRole(GAME_ROLE, coinFlipGameAddress);
  await tx4.wait();
  console.log("✅ CoinFlip granted GAME_ROLE");

  const tx5 = await treasuryManager.grantRole(GAME_ROLE, diceGameAddress);
  await tx5.wait();
  console.log("✅ Dice granted GAME_ROLE");

  const tx5b = await treasuryManager.grantRole(GAME_ROLE, powerUpLotteryAddress);
  await tx5b.wait();
  console.log("✅ PowerUpLottery granted GAME_ROLE");

  // 8. Configure TreasuryManager for testnet (e.g., raise maxSinglePayoutRatio)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\n🔧 Configuring TreasuryManager for testnet...");
    const txConfig = await treasuryManager.setMaxSinglePayoutRatio(10); // 10%
    await txConfig.wait();
    console.log("✅ TreasuryManager maxSinglePayoutRatio set to 10%");
  }

  // 9. Fund Treasury (optional, for testing)
  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("\n💰 Funding Treasury for testing...");
    const fundAmount = hre.ethers.parseEther("10.0");
    const tx6 = await deployer.sendTransaction({
      to: treasuryManagerAddress,
      value: fundAmount,
    });
    await tx6.wait();
    console.log("✅ Treasury funded with 10 ETH");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE! 🎉");
  console.log("=".repeat(50));
  console.log("\n📋 Deployment Summary:");
  console.log("├─ MarcasinoCore:   ", marcasinoCoreAddress);
  console.log("├─ TreasuryManager: ", treasuryManagerAddress);
  console.log("├─ CoinFlipGame:    ", coinFlipGameAddress);
  console.log("├─ DiceGame:        ", diceGameAddress);
  console.log("├─ PowerUpLottery:  ", powerUpLotteryAddress);
  console.log("└─ MockERC20 (MCT): ", mockTokenAddress);
  console.log("\n⚙️  Configuration:");
  console.log("├─ House Edge:      ", HOUSE_EDGE / 100, "%");
  console.log("├─ Min Bet:         ", hre.ethers.formatEther(MIN_BET), "ETH");
  console.log("├─ Max Bet:         ", hre.ethers.formatEther(MAX_BET), "ETH");
  console.log("└─ Network:         ", hre.network.name);

  // Save deployment addresses
  const fs = require("fs");
  const deploymentData = {
    network: hre.network.name,
    timestamp: new Date().toISOString(),
    contracts: {
      MarcasinoCore: marcasinoCoreAddress,
      TreasuryManager: treasuryManagerAddress,
      CoinFlipGame: coinFlipGameAddress,
      DiceGame: diceGameAddress,
      PowerUpLottery: powerUpLotteryAddress,
      MockToken: mockTokenAddress,
    },
    config: {
      houseEdge: HOUSE_EDGE,
      minBet: MIN_BET.toString(),
      maxBet: MAX_BET.toString(),
      vrfCoordinator: VRF_COORDINATOR,
      vrfKeyHash: VRF_KEY_HASH,
      vrfSubscriptionId: VRF_SUBSCRIPTION_ID.toString(),
      revealDelay: 120,
      vrfTimeout: 600,
      slashingDeposit: hre.ethers.parseEther("0.002").toString(),
    }
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  fs.writeFileSync(
    `${deploymentsDir}/${hre.network.name}.json`,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("\n💾 Deployment data saved to deployments/" + hre.network.name + ".json");

  // Copy to frontend for easy integration
  const frontendDeploymentsDir = "../frontend/public/deployments";
  if (!fs.existsSync(frontendDeploymentsDir)) {
    fs.mkdirSync(frontendDeploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    `${frontendDeploymentsDir}/${hre.network.name}.json`,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("💾 Deployment data copied to frontend/public/deployments/" + hre.network.name + ".json");

  // Verification note
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\n📝 To verify contracts on Etherscan, run:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${marcasinoCoreAddress} ${HOUSE_EDGE}`);
    console.log(`npx hardhat verify --network ${hre.network.name} ${treasuryManagerAddress} ${MIN_BET} ${MAX_BET}`);
  }

  console.log("\n🍄 Let's-a go! 🍄\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
