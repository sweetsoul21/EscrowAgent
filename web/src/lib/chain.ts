import { defineChain } from "viem";
import { CHAIN_ID } from "./contract";

export const botchainMainnet = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.botchain.ai"] } },
  blockExplorers: { default: { name: "BOT Scan", url: "https://scan.botchain.ai" } },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

export const botchainTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "tBOT", symbol: "tBOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
  blockExplorers: { default: { name: "BOT Scan Testnet", url: "https://scan.bohr.life" } },
  testnet: true,
});

/** The chain the escrow contract lives on. The deploy script decides this. */
export const activeChain = CHAIN_ID === 677 ? botchainMainnet : botchainTestnet;
export const isMainnet = activeChain.id === 677;
export const explorer = activeChain.blockExplorers.default.url;

export const txUrl = (hash: string) => `${explorer}/tx/${hash}`;
export const addressUrl = (address: string) => `${explorer}/address/${address}`;
