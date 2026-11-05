import "../src/config";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/db/client";

const API = "http://localhost:3000";
const CHAIN_ID = Number(process.env.WHITECHAIN_CHAIN_ID ?? 1874);
const USDT = process.env.USDT_ADDRESS ?? "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const PAYER_KEY = process.env.TEST_PAYER_PRIVATE_KEY!;
const PAYER_ADDR = process.env.TEST_PAYER_ADDRESS!;
const RECIPIENT = process.env.TEST_RECIPIENT_ADDRESS!; // merchant payout wallet

async function main(): Promise<void> {
  if (!PAYER_KEY || !PAYER_ADDR || !RECIPIENT) {
    throw new Error("TEST_PAYER_PRIVATE_KEY / TEST_PAYER_ADDRESS / TEST_RECIPIENT_ADDRESS must be set in .env");
  }

  // 1. Register (or login) a merchant.
  const email = "phase4-e2e@example.com";
  let token: string;
  let merchantId: string;
  const regRes = await fetch(`${API}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessEmail: email, password: "testpass123", businessName: "Phase4 E2E" }),
  });
  if (regRes.status === 201) {
    const reg = await regRes.json();
    token = reg.token;
    merchantId = reg.merchantId;
  } else if (regRes.status === 409) {
    const loginRes = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail: email, password: "testpass123" }),
    });
    const login = await loginRes.json();
    token = login.token;
    merchantId = login.merchantId;
  } else {
    throw new Error(`register failed: ${regRes.status} ${await regRes.text()}`);
  }
  console.log("merchant:", merchantId);

  // 2. Set the payout wallet directly (no merchant-update route yet) -> test recipient.
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { payoutWallet: RECIPIENT, walletVerified: true, walletVerifiedAt: new Date() },
  });
  console.log("payoutWallet set:", RECIPIENT);

  // 3. Create a payment intent (0.01 USDT = 10000 base units).
  const idemKey = "e2e-" + Date.now();
  const piRes = await fetch(`${API}/v1/payment-intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Idempotency-Key": idemKey },
    body: JSON.stringify({ amount: "10000", description: "gasless e2e" }),
  });
  if (!piRes.ok) throw new Error(`create intent failed: ${piRes.status} ${await piRes.text()}`);
  const pi = await piRes.json();
  const paymentIntentId: string = pi.id;
  const checkoutSlug: string = pi.checkoutSlug;
  console.log("paymentIntent:", paymentIntentId, "| slug:", checkoutSlug);

  // 4. Sign TransferWithAuthorization (test payer signs; relayer will submit).
  const pk = (/^0[xX]/.test(PAYER_KEY) ? PAYER_KEY : `0x${PAYER_KEY}`) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const value = BigInt(10000);
  const now = Math.floor(Date.now() / 1000);
  const validAfter = BigInt(now - 60);
  const validBefore = BigInt(now + 600);
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const domain = { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT as `0x${string}` } as const;
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;
  const message = {
    from: PAYER_ADDR as `0x${string}`,
    to: RECIPIENT as `0x${string}`,
    value,
    validAfter,
    validBefore,
    nonce,
  };
  const signature = await account.signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
  console.log("signed TransferWithAuthorization (sig prefix):", signature.slice(0, 18) + "...");

  // 5. POST authorize (public; validates signature + GasGuard + enqueues relayer).
  const authRes = await fetch(`${API}/v1/checkout/${checkoutSlug}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: PAYER_ADDR,
      to: RECIPIENT,
      value: "10000",
      validAfter: validAfter.toString(),
      validBefore: validBefore.toString(),
      nonce,
      signature,
    }),
  });
  console.log("authorize:", authRes.status, await authRes.text());
  if (!authRes.ok) throw new Error("authorize failed");

  // 6. Poll the payment status (the worker relays + settles asynchronously).
  let finalStatus = "unknown";
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const sRes = await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${token}` } });
    const s = await sRes.json();
    const status = s.paymentIntent?.status;
    const txRef = s.paymentIntent?.txRef;
    console.log(`poll ${i}: status=${status} txRef=${txRef ?? "(none)"}`);
    if (status === "succeeded" || status === "failed") {
      finalStatus = status;
      break;
    }
  }

  const finalRes = await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${token}` } });
  const final = await finalRes.json();
  console.log(
    "FINAL:",
    JSON.stringify({
      status: final.paymentIntent?.status,
      txRef: final.paymentIntent?.txRef,
      receivedAmount: final.paymentIntent?.receivedAmount,
      settledAt: final.paymentIntent?.settledAt,
    })
  );
  await prisma.$disconnect();
  if (finalStatus !== "succeeded") {
    console.error("E2E did not reach succeeded.");
    process.exit(2);
  }
  console.log("Gasless e2e PASSED.");
}

main().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
