import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { defineChain } from "viem";

export const whitechainSepolia = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.whitechain.io" } },
});

// Demo projectId — WalletConnect cloud won't work without a real one, but the injected
// (MetaMask) connector works. Set a real projectId at https://cloud.walletconnect.com for WC.
export const wagmiConfig = getDefaultConfig({
  appName: "EzPayz",
  projectId: "whitechain-pay-demo",
  chains: [whitechainSepolia],
  transports: { [whitechainSepolia.id]: http() },
});
