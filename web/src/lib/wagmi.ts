import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { activeChain, botchainMainnet, botchainTestnet } from "./chain";

export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [botchainMainnet.id]: http(botchainMainnet.rpcUrls.default.http[0], { batch: { wait: 20 } }),
    [botchainTestnet.id]: http(botchainTestnet.rpcUrls.default.http[0], { batch: { wait: 20 } }),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
