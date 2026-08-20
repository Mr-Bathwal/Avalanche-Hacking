require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const FUJI_RPC_URL =
  process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc";

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Avalanche supports the Cancun upgrade; OpenZeppelin v5.1 uses `mcopy`.
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    fuji: {
      url: FUJI_RPC_URL,
      chainId: 43113,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
