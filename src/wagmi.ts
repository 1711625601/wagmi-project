import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { mainnet, sepolia, bsc, bscTestnet } from "wagmi/chains";
import { defineChain } from "viem";

export function getConfig() {
  const hardhat = defineChain({
    id: 31337,
    name: "Hardhat",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["http://127.0.0.1:8545"] },
    },
  });
  return createConfig({
    chains: [hardhat, mainnet, sepolia, bsc, bscTestnet],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [hardhat.id]: http("http://127.0.0.1:8545"),
      [mainnet.id]: http(),
      [sepolia.id]: http(),
      [bsc.id]: http(),
      [bscTestnet.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
