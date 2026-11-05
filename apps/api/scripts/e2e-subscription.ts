import "../src/config";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/db/client";

const API = "http://localhost:3000";
const CHAIN_ID = Number(process.env.WHITECHAIN_CHAIN_ID ?? 1874);
const RPC = process.env.WHITECHAIN_RPC_URL ?? "https://rpc.testnet.whitechain.io";
const USDT = process.env.USDT_ADDRESS ?? "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const SUB_CONTRACT = "0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB";

const PAYER_KEY = process.env.TEST_PAYER_PRIVATE_KEY!;
const PAYER_ADDR = process.env.TEST_PAYER_ADDRESS!;
const RECIPIENT = process.env.TEST_RECIPIENT_ADDRESS!;

const CHAIN = defineChain({
  id: CHAIN_ID,
  name: "whitechain-sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const ERC20_ABI = [
  { inputs: [{ type: "address" }, { type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
] as const;

const SUB_CREATE_ABI = [
  {
    inputs: [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
    name: "createSubscription",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function main(): Promise<void> {
  if (!PAYER_KEY || !PAYER_ADDR || !RECIPIENT) throw new Error("TEST_PAYER_* / TEST_RECIPIENT_ADDRESS must be set");

  // 1. login/register merchant + set payout wallet
  const email = "phase5-e2e@example.com";
  let token: string;
  let merchantId: string;
  const regRes = await fetch(`${API}/v1/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessEmail: email, password: "testpass123", businessName: "Phase5 E2E" }),
  });
  if (regRes.status === 201) { const r = await regRes.json(); token = r.token; merchantId = r.merchantId; }
  else if (regRes.status === 409) {
    const l = await (await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessEmail: email, password: "testpass123" }) })).json();
    token = l.token; merchantId = l.merchantId;
  } else throw new Error(`register failed: ${regRes.status}`);
  console.log("merchant:", merchantId);
  await prisma.merchant.update({ where: { id: merchantId }, data: { payoutWallet: RECIPIENT, walletVerified: true, walletVerifiedAt: new Date() } });

  // 2. create plan (hourly, 0.01 USDT, cap 0.1 USDT)
  const planRes = await fetch(`${API}/v1/plans`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "Hourly 0.01", amount: "10000", interval: "hourly", maxChargePerCycle: "10000", cumulativeLimit: "100000" }),
  });
  const plan = await planRes.json();
  const planId: string = plan.id;
  console.log("plan:", planId);

  // 3. customer approves the SubscriptionContract as a spender (customer pays WBT gas)
  const pk = (/^0[xX]/.test(PAYER_KEY) ? PAYER_KEY : `0x${PAYER_KEY}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });
  const approveTx = await walletClient.writeContract({
    chain: CHAIN, account, address: USDT as `0x${string}`, abi: ERC20_ABI, functionName: "approve",
    args: [SUB_CONTRACT as `0x${string}`, BigInt(100000)],
  });
  console.log("approve tx:", approveTx);
  // Wait for the approve to mine so the next tx uses a fresh nonce.
  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log("approve mined.");

  // 4. customer creates the subscription on-chain (due in 30s)
  const subId = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const now = Math.floor(Date.now() / 1000);
  const createTx = await walletClient.writeContract({
    chain: CHAIN, account, address: SUB_CONTRACT as `0x${string}`, abi: SUB_CREATE_ABI, functionName: "createSubscription",
    args: [subId, RECIPIENT as `0x${string}`, BigInt(10000), BigInt(3600), BigInt(10000), BigInt(100000), BigInt(now + 5), BigInt(now + 86400)],
  });
  console.log("createSubscription tx:", createTx, "| subId:", subId);
  await publicClient.waitForTransactionReceipt({ hash: createTx });
  console.log("createSubscription mined.");

  // 5. POST /v1/subscriptions (backend reads getSubscription + verifies + records)
  const subRes = await fetch(`${API}/v1/subscriptions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ onChainSubscriptionId: subId, planId, payerWallet: PAYER_ADDR }),
  });
  console.log("subscription record:", subRes.status, await subRes.text());
  if (!subRes.ok) throw new Error("subscription record failed");

  const list = await (await fetch(`${API}/v1/subscriptions`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const dbSub = list.subscriptions.find((s: { onChainSubscriptionId: string }) => s.onChainSubscriptionId === subId);
  if (!dbSub) throw new Error("subscription not found in DB");
  const subscriptionDbId: string = dbSub.id;
  console.log("db subscription:", subscriptionDbId, "| nextBillingAt:", dbSub.nextBillingAt);

  // 5b. wait until the subscription is due (nextDueTime = creation + 5s), then trigger the renewal directly
  // (same relayer path as the scheduler; bypasses the 60s poll for a fast deterministic e2e).
  console.log("waiting 8s for the subscription to become due...");
  await new Promise((r) => setTimeout(r, 8000));
  const renewRes = await fetch(`${API}/v1/subscriptions/${subscriptionDbId}/renew-now`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  });
  console.log("renew-now:", renewRes.status, await renewRes.text());

  // 6. poll for the relayer charge to settle.
  console.log("polling for renewal settlement...");
  let settled = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const sRes = await fetch(`${API}/v1/subscriptions/${subscriptionDbId}`, { headers: { Authorization: `Bearer ${token}` } });
    const s = await sRes.json();
    const sub = s.subscription;
    const attempts = sub.attempts?.length ?? 0;
    const billing = sub.billingHistory?.length ?? 0;
    console.log(`poll ${i}: status=${sub.status} spent=${sub.spent} attempts=${attempts} billing=${billing}`);
    if (billing > 0) { settled = true; break; }
    if (sub.status === "failed" && attempts > 0) break;
  }

  const finalRes = await fetch(`${API}/v1/subscriptions/${subscriptionDbId}`, { headers: { Authorization: `Bearer ${token}` } });
  const final = await finalRes.json();
  console.log("FINAL:", JSON.stringify({
    status: final.subscription.status,
    spent: final.subscription.spent,
    attempts: final.subscription.attempts?.map((a: { status: string; txRef?: string }) => ({ status: a.status, txRef: a.txRef })),
    billingHistory: final.subscription.billingHistory,
  }));
  await prisma.$disconnect();
  if (!settled) { console.error("Subscription e2e did not settle a renewal."); process.exit(2); }
  console.log("Subscription e2e PASSED — a real recurring charge settled on-chain via the relayer.");
}

main().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
