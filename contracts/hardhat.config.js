require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const key = process.env.PRIVATE_KEY;
const accounts = key ? [key] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 500 }, viaIR: true },
  },
  paths: { sources: "./src", tests: "./test" },
  networks: {
    botchain: {
      url: process.env.BOTCHAIN_RPC || "https://rpc.bohr.life",
      chainId: 968,
      accounts,
    },
    botchainMainnet: {
      url: process.env.BOTCHAIN_MAINNET_RPC || "https://rpc.botchain.ai",
      chainId: 677,
      accounts,
    },
  },
  etherscan: {
    apiKey: { botchain: "empty", botchainMainnet: "empty" },
    customChains: [
      {
        network: "botchain",
        chainId: 968,
        urls: { apiURL: "https://scan.bohr.life/api", browserURL: "https://scan.bohr.life" },
      },
      {
        network: "botchainMainnet",
        chainId: 677,
        urls: { apiURL: "https://scan.botchain.ai/api", browserURL: "https://scan.botchain.ai" },
      },
    ],
  },
  sourcify: { enabled: false },
};
