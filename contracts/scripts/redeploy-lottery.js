const hre = require('hardhat');

async function main() {
  const fs = require('fs');
  const path = require('path');

  const networkName = hre.network.name;
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Please deploy core contracts first.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  if (!deploymentData?.contracts?.MarcasinoCore || !deploymentData?.contracts?.TreasuryManager || !deploymentData?.contracts?.MockToken) {
    throw new Error('Deployment file missing required contract addresses (MarcasinoCore/TreasuryManager/MockToken).');
  }

  const marcasinoCoreAddress = deploymentData.contracts.MarcasinoCore;
  const treasuryManagerAddress = deploymentData.contracts.TreasuryManager;
  const mockTokenAddress = deploymentData.contracts.MockToken;

  const VRF_COORDINATOR = deploymentData?.config?.vrfCoordinator;
  const VRF_KEY_HASH = deploymentData?.config?.vrfKeyHash;
  const VRF_SUBSCRIPTION_ID = deploymentData?.config?.vrfSubscriptionId;

  if (!VRF_COORDINATOR || !VRF_KEY_HASH || !VRF_SUBSCRIPTION_ID) {
    throw new Error('Deployment config missing VRF settings (vrfCoordinator/vrfKeyHash/vrfSubscriptionId).');
  }

  const CALLBACK_GAS_LIMIT = process.env.VRF_CALLBACK_GAS_LIMIT
    ? Number(process.env.VRF_CALLBACK_GAS_LIMIT)
    : 250000;

  const ROUND_DURATION = process.env.LOTTERY_ROUND_DURATION
    ? Number(process.env.LOTTERY_ROUND_DURATION)
    : (networkName === 'localhost' || networkName === 'hardhat' || networkName === 'sepolia')
      ? 60
      : 3600;

  const GAME_NAME = process.env.LOTTERY_GAME_NAME || 'PowerUpLotteryV2';

  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n🚀 Redeploying PowerUpLottery on ${networkName} as ${deployer.address}`);
  console.log('Using:');
  console.log('├─ MarcasinoCore:   ', marcasinoCoreAddress);
  console.log('├─ TreasuryManager: ', treasuryManagerAddress);
  console.log('├─ MockToken (MCT): ', mockTokenAddress);
  console.log('├─ Round Duration:  ', ROUND_DURATION, 'seconds');
  console.log('├─ Callback Gas:    ', CALLBACK_GAS_LIMIT);
  console.log('└─ Game Name:       ', GAME_NAME);

  const PowerUpLottery = await hre.ethers.getContractFactory('PowerUpLottery');
  const TICKET_PRICE = hre.ethers.parseUnits('1', 18);

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
  console.log('\n✅ PowerUpLottery deployed to:', powerUpLotteryAddress);

  const treasuryManager = await hre.ethers.getContractAt('TreasuryManager', treasuryManagerAddress);
  const GAME_ROLE = await treasuryManager.GAME_ROLE();
  const txGrant = await treasuryManager.grantRole(GAME_ROLE, powerUpLotteryAddress);
  await txGrant.wait();
  console.log('✅ Granted TreasuryManager GAME_ROLE to PowerUpLottery');

  // Register in Core for tracking/permissions (Core GAME_ROLE)
  const marcasinoCore = await hre.ethers.getContractAt('MarcasinoCore', marcasinoCoreAddress);
  try {
    const txReg = await marcasinoCore.registerGame(powerUpLotteryAddress, GAME_NAME);
    await txReg.wait();
    console.log(`✅ Registered in MarcasinoCore as ${GAME_NAME}`);
  } catch (e) {
    console.log('⚠️  Skipped Core registerGame (may already be registered or caller lacks ADMIN_ROLE):', e?.message || String(e));
  }

  // Save updated deployment addresses
  const updated = {
    ...deploymentData,
    timestamp: new Date().toISOString(),
    contracts: {
      ...deploymentData.contracts,
      PowerUpLottery: powerUpLotteryAddress,
    },
  };

  fs.writeFileSync(deploymentPath, JSON.stringify(updated, null, 2));
  console.log(`\n💾 Updated deployment file: ${deploymentPath}`);

  const frontendDeploymentsDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'deployments');
  if (!fs.existsSync(frontendDeploymentsDir)) {
    fs.mkdirSync(frontendDeploymentsDir, { recursive: true });
  }
  const frontendDeploymentPath = path.join(frontendDeploymentsDir, `${networkName}.json`);
  fs.writeFileSync(frontendDeploymentPath, JSON.stringify(updated, null, 2));
  console.log(`💾 Copied deployment to frontend: ${frontendDeploymentPath}`);

  console.log('\n🍄 Done. Restart frontend to pick up new deployment JSON if needed.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
