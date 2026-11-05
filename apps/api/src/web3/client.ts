import { createPublicClient, http, defineChain } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config";

export const CHAIN = defineChain({
  id: env.WHITECHAIN_CHAIN_ID,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [env.WHITECHAIN_RPC_URL] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.whitechain.io" } },
});

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(env.WHITECHAIN_RPC_URL) });

let relayerAccount: ReturnType<typeof privateKeyToAccount> | null = null;
let relayerWalletClient: ReturnType<typeof createWalletClient> | null = null;

function getRelayerKey(): `0x${string}` {
  const key = process.env.RELAYER_PRIVATE_KEY || process.env.TEST_PAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY (or TEST_PAYER_PRIVATE_KEY) not set");
  return (/^0[xX]/.test(key) ? key : `0x${key}`) as `0x${string}`;
}

export function getRelayerAccount() {
  if (!relayerAccount) relayerAccount = privateKeyToAccount(getRelayerKey());
  return relayerAccount;
}

export function getRelayerWalletClient() {
  if (!relayerWalletClient) {
    relayerWalletClient = createWalletClient({ account: getRelayerAccount(), chain: CHAIN, transport: http(env.WHITECHAIN_RPC_URL) });
  }
  return relayerWalletClient;
}
