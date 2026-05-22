/**
 * Hardhat Configuration
 * Ethereum L2 (Optimism) deployment setup
 */

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
    },

    // Optimism Goerli Testnet
    goerli: {
      url: process.env.ETH_RPC_URL || "https://goerli.optimism.io",
      accounts: process.env.ETH_PRIVATE_KEY ? [process.env.ETH_PRIVATE_KEY] : [],
      chainId: 420,
    },

    // Optimism Mainnet
    mainnet: {
      url: process.env.ETH_RPC_URL || "https://mainnet.optimism.io",
      accounts: process.env.ETH_PRIVATE_KEY ? [process.env.ETH_PRIVATE_KEY] : [],
      chainId: 10,
    },
  },

  // TypeChain configuration
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },

  // Gas reporter
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD",
    outputFile: process.env.GAS_REPORT_FILENAME,
  },
};

export default config;
