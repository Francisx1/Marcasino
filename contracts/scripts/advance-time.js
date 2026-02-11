const { ethers } = require("hardhat");

/**
 * Advance the blockchain time by a specified number of seconds
 * Useful for testing time-locked features like commit-reveal schemes
 */
async function main() {
  const seconds = process.argv[2] || 121; // Default to 121 seconds (just past REVEAL_DELAY)
  
  console.log(`⏰ Advancing blockchain time by ${seconds} seconds...`);
  
  // Increase time
  await ethers.provider.send("evm_increaseTime", [parseInt(seconds)]);
  
  // Mine a new block to apply the time change
  await ethers.provider.send("evm_mine", []);
  
  const block = await ethers.provider.getBlock("latest");
  console.log(`✅ Time advanced! New block timestamp: ${block.timestamp}`);
  console.log(`🍄 You can now reveal your bet!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
