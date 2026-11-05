import "../src/config";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/db/client";

const API = "http://localhost:3000";
const CHAIN_ID = Number(process.env.WHITECHAIN_CHAIN_ID ?? 1874);
const USDT = process.env.USDT_ADDRESS ?? "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const PAYER_KEY = process.env.TEST_PAYER_PRIVATE_KEY!;
const PAYER_ADDR = process.env.TEST_PAYER_ADDRESS!;
const MERCHANT_KEY = process.env.TEST_RECIPIENT_PRIVATE_KEY!; // merchant payout wallet key
const MERCHANT_ADDR = process.env.TEST_RECIPIENT_ADDRESS!;

const USDT_DOMAIN = { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT as `0x${string}` } as const;
const TWA_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ],
} as const;

function pk(k: string): `0x${string}` { return (/^0[xX]/.test(k) ? k : `0x${k}`) as `0x${string}`; }

async function signTWA(signerKey: string, from: string, to: string, value: bigint) {
  const account = privateKeyToAccount(pk(signerKey));
  const now = Math.floor(Date.now() / 1000);
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + 600);
  const signature = await account.signTypedData({
    domain: USDT_DOMAIN, types: TWA_TYPES, primaryType: "TransferWithAuthorization",
    message: { from: from as `0x${string}`, to: to as `0x${string}`, value, validAfter, validBefore, nonce },
  });
  return { from, to, value: value.toString(), validAfter: validAfter.toString(), validBefore: validBefore.toString(), nonce, signature };
}

async function main(): Promise<void> {
  if (!PAYER_KEY || !MERCHANT_KEY) throw new Error("TEST_PAYER_PRIVATE_KEY + TEST_RECIPIENT_PRIVATE_KEY required");

  // 1. login merchant + set payout = 0x116B
  const email = "phase6-refund@example.com";
  let token: string; let merchantId: string;
  const regRes = await fetch(`${API}/v1/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessEmail: email, password: "testpass123", businessName: "Phase6 Refund" }) });
  if (regRes.status === 201) { const r = await regRes.json(); token = r.token; merchantId = r.merchantId; }
  else if (regRes.status === 409) { const l = await (await fetch(`${API}/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessEmail: email, password: "testpass123" }) })).json(); token = l.token; merchantId = l.merchantId; }
  else throw new Error(`register failed: ${regRes.status}`);
  await prisma.merchant.update({ where: { id: merchantId }, data: { payoutWallet: MERCHANT_ADDR, walletVerified: true, walletVerifiedAt: new Date() } });
  console.log("merchant:", merchantId);

  // 2. create payment intent (0.01 USDT)
  const piRes = await fetch(`${API}/v1/payment-intents`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": "refund-e2e-" + Date.now() }, body: JSON.stringify({ amount: "10000", description: "refund e2e" }) });
  const pi = await piRes.json();
  const paymentIntentId: string = pi.id;
  const checkoutSlug: string = pi.checkoutSlug;
  console.log("paymentIntent:", paymentIntentId);

  // 3. payer signs + authorizes (from=payer 0xa201, to=merchant 0x116B)
  const payerAuth = await signTWA(PAYER_KEY, PAYER_ADDR, MERCHANT_ADDR, 10000n);
  const authRes = await fetch(`${API}/v1/checkout/${checkoutSlug}/authorize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payerAuth) });
  console.log("authorize payment:", authRes.status, await authRes.text());

  // 4. poll payment until succeeded
  let paymentSucceeded = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await (await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    console.log(`payment poll ${i}: status=${s.paymentIntent?.status}`);
    if (s.paymentIntent?.status === "succeeded") { paymentSucceeded = true; break; }
    if (s.paymentIntent?.status === "failed") break;
  }
  if (!paymentSucceeded) throw new Error("Payment did not succeed — cannot refund");

  // 5. create refund
  const refundRes = await fetch(`${API}/v1/refunds`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ paymentId: paymentIntentId, amount: "10000", reason: "refund e2e" }) });
  const refund = await refundRes.json();
  console.log("refund created:", refundRes.status, JSON.stringify(refund));
  if (!refundRes.ok) throw new Error("refund create failed");
  const refundId: string = refund.id;

  // 6. merchant signs the refund authorization (from=merchant 0x116B, to=payer 0xa201)
  const merchantAuth = await signTWA(MERCHANT_KEY, MERCHANT_ADDR, PAYER_ADDR, 10000n);
  const refundAuthRes = await fetch(`${API}/v1/refunds/${refundId}/authorize`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(merchantAuth) });
  console.log("refund authorize:", refundAuthRes.status, await refundAuthRes.text());
  if (!refundAuthRes.ok) throw new Error("refund authorize failed");

  // 7. poll refund until succeeded
  let refundSucceeded = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await (await fetch(`${API}/v1/refunds/${refundId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
    console.log(`refund poll ${i}: status=${s.refund?.status} txRef=${s.refund?.txRef ?? "(none)"}`);
    if (s.refund?.status === "succeeded") { refundSucceeded = true; break; }
    if (s.refund?.status === "failed") break;
  }

  // final
  const finalPayment = await (await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const finalRefund = await (await fetch(`${API}/v1/refunds/${refundId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  console.log("FINAL payment:", JSON.stringify({ status: finalPayment.paymentIntent?.status, refundedAmount: finalPayment.paymentIntent?.refundedAmount }));
  console.log("FINAL refund:", JSON.stringify({ status: finalRefund.refund?.status, txRef: finalRefund.refund?.txRef, settledAt: finalRefund.refund?.settledAt }));
  await prisma.$disconnect();
  if (!refundSucceeded) { console.error("Refund e2e did not settle."); process.exit(2); }
  console.log("Refund e2e PASSED — a real refund settled on-chain (merchant → original payer) via the relayer.");
}

main().catch((e) => { console.error("E2E FAILED:", e.message); process.exit(1); });
