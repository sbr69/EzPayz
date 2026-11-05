import "../src/config";
import { prisma } from "../src/db/client";

const API = "http://localhost:3000";

/**
 * Cross-merchant tenant isolation test (PRD §8.3, §24.4).
 * Verifies that Merchant A cannot read Merchant B's payment intents.
 */
async function main(): Promise<void> {
  // Register two merchants.
  const mkMerchant = async (email: string, name: string) => {
    const reg = await fetch(`${API}/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail: email, password: "testpass123", businessName: name }),
    });
    if (reg.status === 201) return (await reg.json()) as { token: string; merchantId: string };
    const login = await fetch(`${API}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessEmail: email, password: "testpass123" }),
    });
    return (await login.json()) as { token: string; merchantId: string };
  };

  const a = await mkMerchant("iso-a@example.com", "Merchant A");
  const b = await mkMerchant("iso-b@example.com", "Merchant B");
  console.log("Merchant A:", a.merchantId);
  console.log("Merchant B:", b.merchantId);

  // Set payout wallets (so payment intent creation works).
  await prisma.merchant.update({ where: { id: a.merchantId }, data: { payoutWallet: "0xa201EEE38742FE108556089F1F330dcC3944071A" } });
  await prisma.merchant.update({ where: { id: b.merchantId }, data: { payoutWallet: "0x116B846282713aa64d33DD4cA56157704Cba6279" } });

  // A creates a payment intent.
  const piRes = await fetch(`${API}/v1/payment-intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${a.token}`, "Idempotency-Key": "iso-" + Date.now() },
    body: JSON.stringify({ amount: "10000", description: "A's payment" }),
  });
  const pi = await piRes.json();
  const paymentIntentId: string = pi.id;
  console.log("A created payment intent:", paymentIntentId);

  // A can read it (200).
  const aRead = await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${a.token}` } });
  console.log("A reads own intent:", aRead.status, aRead.status === 200 ? "✓" : "✗");

  // B tries to read A's intent (should 404 — isolated).
  const bRead = await fetch(`${API}/v1/payment-intents/${paymentIntentId}`, { headers: { Authorization: `Bearer ${b.token}` } });
  console.log("B reads A's intent:", bRead.status, bRead.status === 404 ? "✓ (isolated)" : "✗ (LEAK!)");

  // B lists their own intents (should not include A's).
  const bList = await (await fetch(`${API}/v1/payment-intents`, { headers: { Authorization: `Bearer ${b.token}` } })).json();
  const bHasA = Array.isArray(bList) ? bList.some((p: { id: string }) => p.id === paymentIntentId) : false;
  console.log("B's list contains A's intent:", bHasA, bHasA ? "✗ (LEAK!)" : "✓ (isolated)");

  await prisma.$disconnect();

  const ok = aRead.status === 200 && bRead.status === 404 && !bHasA;
  if (!ok) { console.error("ISOLATION TEST FAILED"); process.exit(1); }
  console.log("Isolation test PASSED — Merchant A's data is not visible to Merchant B.");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
