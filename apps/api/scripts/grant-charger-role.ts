import "../src/config";
import { createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHARGER_ROLE, SUBSCRIPTION_CONTRACT_ADDRESS } from "../src/config/contracts";

// One-time admin action: grant CHARGER_ROLE to the relayer so it can call charge().
// The deployer (test payer) is the DEFAULT_ADMIN_ROLE; the relayer reuses the same key.
const RPC = process.env.WHITECHAIN_RPC_URL!;
const CHAIN_ID = Number(process.env.WHITECHAIN_CHAIN_ID);
const PAYER_KEY = process.env.TEST_PAYER_PRIVATE_KEY!;
const RELAYER = process.env.TEST_PAYER_ADDRESS!;

const CHAIN = defineChain({
  id: CHAIN_ID, name: "whitechain-sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ACCESS_CONTROL_ABI = [
  { inputs: [{ type: "bytes32" }, { type: "address" }], name: "grantRole", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "bytes32" }, { type: "address" }], name: "hasRole", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
] as const;

async function main(): Promise<void> {
  const pk = (/^0[xX]/.test(PAYER_KEY) ? PAYER_KEY : `0x${PAYER_KEY}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

  // Check if already granted (idempotent).
  const { createPublicClient } = await import("viem");
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
  const has = await publicClient.readContract({
    address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
    abi: ACCESS_CONTROL_ABI,
    functionName: "hasRole",
    args: [CHARGER_ROLE as `0x${string}`, RELAYER as `0x${string}`],
  }) as boolean;
  if (has) { console.log("Relayer already has CHARGER_ROLE — nothing to do."); return; }

  const tx = await walletClient.writeContract({
    chain: CHAIN, account,
    address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
    abi: ACCESS_CONTROL_ABI,
    functionName: "grantRole",
    args: [CHARGER_ROLE as `0x${string}`, RELAYER as `0x${string}`],
  });
  console.log("grantRole tx:", tx);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log("grantRole mined, status:", receipt.status);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
