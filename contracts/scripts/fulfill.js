const hre = require("hardhat");

async function main() {
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    throw new Error(
      `scripts/fulfill.js is only for local testing (localhost/hardhat) with LocalVRFCoordinatorV2PlusMock.\n` +
        `On Sepolia, fulfillment is performed automatically by Chainlink VRF nodes (you cannot manually fulfill).\n` +
        `Instead, wait for the VRF callback and then call settleRequest(requestId), or use scripts/commit-reveal-sepolia.js which can auto-settle.`
    );
  }

  const requestIdArg = process.argv[2] || process.env.REQUEST_ID;
  if (!requestIdArg) {
    throw new Error(
      "Usage:\n" +
        "  node scripts/fulfill.js <requestId> [randomWord]\n" +
        "or (recommended for localhost network):\n" +
        "  REQUEST_ID=2 npx hardhat run --network localhost scripts/fulfill.js\n" +
        "  (PowerShell) $env:REQUEST_ID=2; npx hardhat run --network localhost scripts/fulfill.js"
    );
  }

  const requestId = BigInt(requestIdArg);
  const randomWordArg = process.argv[3] || process.env.RANDOM_WORD;
  const randomWord = randomWordArg ? BigInt(randomWordArg) : BigInt(Date.now());

  const fs = require("fs");
  const path = require("path");
  const primaryDeploymentsPath = path.join(
    __dirname,
    "..",
    "deployments",
    `${hre.network.name}.json`
  );
  const localhostDeploymentsPath = path.join(
    __dirname,
    "..",
    "deployments",
    "localhost.json"
  );

  let deploymentsPath = primaryDeploymentsPath;
  if (!fs.existsSync(deploymentsPath) && fs.existsSync(localhostDeploymentsPath)) {
    deploymentsPath = localhostDeploymentsPath;
  }
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      `Missing deployments file: ${primaryDeploymentsPath} (also tried ${localhostDeploymentsPath})`
    );
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  const coordinatorAddress = deployment.config.vrfCoordinator;
  if (!coordinatorAddress) {
    throw new Error("Missing config.vrfCoordinator in deployments json");
  }

  const code = await hre.ethers.provider.getCode(coordinatorAddress);
  if (!code || code === "0x") {
    throw new Error(
      `VRF coordinator address has no contract code on the current network.\n` +
        `- current hre.network.name: ${hre.network.name}\n` +
        `- deployments file used: ${deploymentsPath}\n` +
        `- coordinatorAddress: ${coordinatorAddress}\n\n` +
        `This usually means you ran the script via 'node', which uses the in-process Hardhat network, not your running localhost node.\n` +
        `Run instead:\n` +
        `  npx hardhat run scripts/fulfill.js --network localhost -- ${requestId.toString()}\n`
    );
  }

  console.log("Fulfilling request...", {
    network: deployment.network || hre.network.name,
    coordinatorAddress,
    requestId: requestId.toString(),
    randomWord: randomWord.toString(),
  });

  const Coordinator = await hre.ethers.getContractFactory("LocalVRFCoordinatorV2PlusMock");
  const coordinator = Coordinator.attach(coordinatorAddress);

  const tx = await coordinator.fulfillRequest(requestId, randomWord);
  await tx.wait();

  console.log("✅ Fulfilled");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
