const hre = require('hardhat');

async function main() {
  const treasuryAddress = '0x54e09bc035F2dde6334187372412608550a15755';
  const coinFlipGameAddress = '0xC932044456580986235924c106D870e74419cc87';

  const [signer] = await hre.ethers.getSigners();
  console.log('network:', hre.network.name);
  console.log('signer :', await signer.getAddress());
  console.log('treasury:', treasuryAddress);
  console.log('coinflip:', coinFlipGameAddress);

  const treasury = await hre.ethers.getContractAt('TreasuryManager', treasuryAddress);
  const role = await treasury.GAME_ROLE();

  const before = await treasury.hasRole(role, coinFlipGameAddress);
  console.log('hasRole before:', before);
  if (before) {
    console.log('Already granted. Nothing to do.');
    return;
  }

  console.log('Granting GAME_ROLE...');
  const tx = await treasury.grantRole(role, coinFlipGameAddress);
  console.log('tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('mined in block:', receipt.blockNumber);

  const after = await treasury.hasRole(role, coinFlipGameAddress);
  console.log('hasRole after:', after);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
