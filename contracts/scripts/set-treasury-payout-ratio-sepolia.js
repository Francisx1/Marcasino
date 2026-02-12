const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

function loadDeployments(networkName) {
  const p = path.join(__dirname, '..', 'deployments', `${networkName}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const networkName = hre.network.name;
  if (networkName !== 'sepolia') {
    throw new Error(`This script is intended for sepolia. Current network: ${networkName}`);
  }

  const ratioArg = process.argv[2] || process.env.TREASURY_MAX_SINGLE_PAYOUT_RATIO || '100';
  const ratio = Number(ratioArg);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 100) {
    throw new Error(`Invalid ratio: ${ratioArg}. Must be 1..100`);
  }

  const deployment = loadDeployments(networkName);
  const treasuryAddress =
    process.env.TREASURY_MANAGER_ADDRESS || deployment?.contracts?.TreasuryManager;

  if (!treasuryAddress) {
    throw new Error(
      'TreasuryManager address not found. Set TREASURY_MANAGER_ADDRESS or ensure deployments/sepolia.json exists.'
    );
  }

  const [signer] = await hre.ethers.getSigners();

  console.log('network   :', networkName);
  console.log('signer    :', await signer.getAddress());
  console.log('treasury  :', treasuryAddress);
  console.log('new ratio :', ratio);

  const treasury = await hre.ethers.getContractAt('TreasuryManager', treasuryAddress, signer);
  const before = await treasury.maxSinglePayoutRatio();
  console.log('before maxSinglePayoutRatio:', before.toString());

  const tx = await treasury.setMaxSinglePayoutRatio(ratio);
  console.log('tx hash:', tx.hash);
  const rc = await tx.wait();
  console.log('mined block:', rc.blockNumber);

  const after = await treasury.maxSinglePayoutRatio();
  console.log('after maxSinglePayoutRatio:', after.toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
