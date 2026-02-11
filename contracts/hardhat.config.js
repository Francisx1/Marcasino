require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // --- 新增下面这部分 ---
  paths: {
    sources: "./src", // 告诉 Hardhat：去 src 文件夹找合约，别去 contracts 找
  },
  // --------------------
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "", // 从 .env 读取 Alchemy URL
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [], // 读取私钥
    },
    hardhat: {
      chainId: 31337,
      blockGasLimit: 30000000, // Increase block gas limit for VRF operations
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      blockGasLimit: 30000000, // Match hardhat network settings
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};