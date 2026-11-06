import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

// Config from environment
const PK = (process.env.PK || "").startsWith("0x") ? process.env.PK! : "0x" + process.env.PK!;
const WALLET = process.env.WALLET!;
const SLUG = process.env.SLUG!;
const PAYOUT = process.env.PAYOUT!;
const AMOUNT = process.env.AOUNT!; // base units
const API_URL = process.env.API_URL || "http://localhost:3000";

const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const CHAIN_ID = 1874;

const account = privateKeyToAccount(PK as `0x${string}`);

async function main() {
  // Read checkout to get amount + payout
  const checkoutRes = await fetch(`${API_URL}/v1/checkout/${SLUG}`);
  const checkout = await checkoutRes.json();
  const amount = checkout.amount;
  const to = checkout.merchant.payoutWallet;
  console.error(`Checkout: amount=${amount} to=${to} status=${checkout.status}`);

  // Generate nonce + timestamps
  const now = Math.floor(Date.now() / 1000);
  const nonce = "0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");

  // Sign EIP-3009 TransferWithAuthorization
  const signature = await account.signTypedData({
    domain: { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT as `0x${string}` },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: WALLET as `0x${string}`,
      to: to as `0x${string}`,
      value: BigInt(amount),
      validAfter: BigInt(now - 60),
      validBefore: BigInt(now + 600),
      nonce: nonce as `0x${string}`,
    },
  });

  console.error(`Signature: ${signature.slice(0, 20)}...`);

  // Submit authorization
  const authRes = await fetch(`${API_URL}/v1/checkout/${SLUG}/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: WALLET,
      to: to,
      value: amount,
      validAfter: String(now - 60),
      validBefore: String(now + 600),
      nonce,
      signature,
    }),
  });
  const authBody = await authRes.json();
  console.error(`Authorize: ${authRes.status} ${JSON.stringify(authBody)}`);

  if (!authRes.ok) {
    console.log(JSON.stringify({ error: authBody }));
    return;
  }

  // Poll for settlement
  console.error("Polling for settlement...");
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(`${API_URL}/v1/checkout/${SLUG}`);
    const poll = await pollRes.json();
    console.error(`  [${i}] status=${poll.status} txRef=${poll.txRef ?? "none"}`);
    if (poll.status === "succeeded") {
      console.log(JSON.stringify({ status: "succeeded", txRef: poll.txRef, paymentIntentId: poll.paymentIntentId }));
      return;
    }
    if (poll.status === "failed") {
      console.log(JSON.stringify({ status: "failed", error: "Payment failed on-chain" }));
      return;
    }
  }
  console.log(JSON.stringify({ status: "timeout", error: "Payment did not settle in 120s" }));
}

main().catch((e) => console.log(JSON.stringify({ error: e.message })));
