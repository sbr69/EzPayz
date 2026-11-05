import "../src/config";
import { publicClient } from "../src/web3/client";
import { SUBSCRIPTION_ABI } from "../src/web3/subscriptionAbi";
import { SUBSCRIPTION_CONTRACT_ADDRESS } from "../src/config/contracts";

// The subId created on-chain in the earlier e2e run (createSubscription mined).
const SUB_ID = "0x94bdd9930bc6f8006684006fd776c5ecd88a2479ddd59b221d66a4fabace6d70";

async function main(): Promise<void> {
  const result = await publicClient.readContract({
    address: SUBSCRIPTION_CONTRACT_ADDRESS as `0x${string}`,
    abi: SUBSCRIPTION_ABI,
    functionName: "getSubscription",
    args: [SUB_ID as `0x${string}`],
  });
  console.log("typeof result:", typeof result);
  console.log("Array.isArray:", Array.isArray(result));
  console.log("result (raw):", result);
  if (Array.isArray(result)) {
    console.log("length:", result.length);
    for (let i = 0; i < result.length; i++) console.log(`  [${i}]:`, result[i]?.toString?.() ?? result[i]);
  } else if (result && typeof result === "object") {
    console.log("keys:", Object.keys(result));
  }
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
