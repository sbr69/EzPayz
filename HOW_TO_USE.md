# How to Use — EzPayz

A developer guide to integrating the EzPayz into your website. Accept gasless USDT payments, recurring subscriptions, and refunds on Whitechain Sepolia — with a typed SDK, a React checkout widget, and signed webhooks.

---

## Overview

The gateway lets a merchant:
1. **Create a payment intent** (server-side, via the SDK) for a specific USDT amount.
2. **Show a checkout** to the customer (the React widget or your own UI).
3. The customer **signs an EIP-3009 authorization** with their wallet (MetaMask) — they pay **no gas**.
4. The gateway **relayer submits the transaction on-chain** (paying the WBT gas) + verifies settlement.
5. The merchant receives **USDT directly** to their payout wallet (non-custodial).
6. The merchant gets a **signed webhook** when the payment settles.

The same flow supports **recurring subscriptions** (via an on-chain contract) and **refunds** (merchant signs, relayer sponsors).

---

## Prerequisites

1. **A merchant account** on the gateway (register at `/v1/auth/register` or via the dashboard).
2. **API keys**: after registering, create a key pair (`POST /v1/api-keys`) — you get a **publishable** key (browser-safe) + a **secret** key (server-only, shown once).
3. **A Whitechain Sepolia wallet** for your payout (where USDT arrives) — configured as the merchant's `payoutWallet`.
4. **The gateway running**: `pnpm dev` (API on :3000) + `pnpm worker` (relayer/webhook workers). (Or the deployed URLs in production.)

---

## 1. Server-side integration (Node.js)

Install the SDK (from the monorepo, or `npm install @ezpayz/sdk` once published):

```bash
pnpm add @ezpayz/sdk viem
```

Create a payment intent on your server (using the **secret** key):

```ts
import { WhitechainClient } from "@ezpayz/sdk";

const client = new WhitechainClient(
  process.env.WHITECHAIN_SECRET_KEY!,     // your secret API key
  "http://localhost:3000"                  // the gateway API URL
);

// Create a payment intent for 10 USDT (10 * 10^6 base units)
const intent = await client.paymentIntents.create({
  amount: "10000000",                      // base units (USDT has 6 decimals)
  description: "Pro plan subscription",
  customerEmail: "customer@example.com",
  idempotencyKey: "order-12345",           // optional, prevents duplicates
});

console.log(intent);
// { id: "pay_...", checkoutUrl: "/checkout/ck_...", checkoutSlug: "ck_...", payeeShield: {...} }
```

The `checkoutSlug` is what you pass to the frontend widget. The `idempotencyKey` ensures creating the same intent twice returns the same result (no duplicate charges).

### Other server-side methods

```ts
// Payment links (reusable URLs)
const link = await client.paymentLinks.create({ title: "Buy a coffee", amount: "2000000" });

// Invoices
const invoice = await client.invoices.create({
  customerEmail: "customer@example.com",
  title: "Consulting — January",
  lineItems: [{ description: "10 hours dev", quantity: 10, unitPrice: "5000000" }],
});

// Refunds (full or partial)
const refund = await client.refunds.create({ paymentId: intent.id, amount: "5000000", reason: "partial refund" });

// Analytics
const overview = await client.analytics.overview();

// Subscriptions (after the customer activates on-chain)
const sub = await client.subscriptions.create({
  onChainSubscriptionId: "0x...", // the bytes32 subId from the on-chain createSubscription
  planId: "plan_...",
  payerWallet: "0x...",
});
```

---

## 2. Client-side integration (React checkout widget)

The customer pays via the `<WhitechainCheckout/>` widget. It needs a wallet signer — you provide it from wagmi's `useSignTypedData` hook (so the SDK stays free of heavy wallet deps).

### Install wagmi + RainbowKit in your app

```bash
pnpm add wagmi @rainbow-me/rainbowkit viem @tanstack/react-query
```

### Set up the wagmi config (Whitechain Sepolia)

```ts
// wagmiConfig.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, defineChain } from "viem";

const whitechain = defineChain({
  id: 1874,
  name: "Whitechain Sepolia",
  nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.whitechain.io"] } },
});

export const config = getDefaultConfig({
  appName: "My Store",
  projectId: "your-walletconnect-project-id", // https://cloud.walletconnect.com
  chains: [whitechain],
  transports: { [whitechain.id]: http() },
});
```

### Wrap your app with the providers

```tsx
// App.tsx
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";
import { config } from "./wagmiConfig";

const queryClient = new QueryClient();

export function App({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Render the checkout

```tsx
// CheckoutPage.tsx
import { useSignTypedData } from "wagmi";
import { WhitechainCheckout } from "@ezpayz/sdk";

function CheckoutPage({ checkoutSlug }: { checkoutSlug: string }) {
  const { signTypedDataAsync } = useSignTypedData();

  return (
    <WhitechainCheckout
      checkoutSlug={checkoutSlug}
      apiUrl="http://localhost:3000"
      signTypedData={signTypedDataAsync}
      onSuccess={(result) => {
        console.log("Payment succeeded!", result.paymentIntentId, result.txRef);
        // redirect to success page, fulfill the order, etc.
      }}
      onError={(err) => console.error("Payment failed:", err.message)}
    />
  );
}
```

That's it. The widget:
1. Fetches the PayeeShield-signed payment request from the gateway.
2. Displays the merchant name, amount, recipient.
3. Lets the customer connect their wallet (RainbowKit).
4. On "Pay", signs the EIP-3009 `TransferWithAuthorization` (the customer pays **no gas**).
5. Submits the signature to the gateway → the relayer submits it on-chain + pays WBT gas.
6. Polls for settlement → `onSuccess` when the payment is `succeeded`.

### Using the gateway's own hosted checkout

If you don't want to embed the widget, redirect the customer to the gateway's hosted checkout:
```
http://localhost:5173/#/real-checkout/<checkoutSlug>
```

---

## 3. Webhooks (server-side)

When a payment settles (or fails), the gateway sends a signed webhook to your endpoint. Verify the signature + handle the event.

### Create a webhook endpoint (server-side)

```ts
const endpoint = await client.paymentLinks... // (or via the dashboard)
// POST /v1/webhooks { url: "https://yourapp.com/webhooks/whitechain", eventTypes: ["payment.succeeded", "payment.failed", "refund.succeeded"] }
```

### Verify + handle the webhook (Express example)

```ts
import { verifyWebhookSignature } from "@ezpayz/sdk";

app.post("/webhooks/whitechain", (req, res) => {
  const signature = req.headers["x-whitechain-signature"] as string;
  const rawBody = req.rawBody.toString("utf8"); // use raw body, not JSON-parsed

  if (!verifyWebhookSignature(WEBHOOK_SECRET, rawBody, signature)) {
    return res.status(401).send("invalid signature");
  }

  const event = JSON.parse(rawBody);
  switch (event.type) {
    case "payment.succeeded":
      // fulfill the order
      console.log("Payment succeeded:", event.payload.paymentIntentId, event.payload.txRef);
      break;
    case "payment.failed":
      // notify the customer
      break;
    case "refund.succeeded":
      // update the order status
      break;
  }

  res.status(200).send("ok");
});
```

### Webhook event types

| Event | When |
|---|---|
| `payment.succeeded` | A one-time payment settled on-chain |
| `payment.failed` | A one-time payment failed (reverted, GasGuard rejected, etc.) |
| `refund.succeeded` | A refund settled on-chain |
| `refund.failed` | A refund failed |
| `subscription.renewed` | A recurring charge settled |
| `subscription.renewal_failed` | A renewal failed |

The webhook payload includes the event type, the resource ID, the amount, + the on-chain tx hash. The signature is HMAC-SHA256 of the raw body with the endpoint's signing secret (shown once at creation).

---

## 4. Subscriptions

Subscriptions use the deployed `SubscriptionContract` on Whitechain Sepolia. The flow:

1. **Create a plan** (server-side):
   ```ts
   // POST /v1/plans { name: "Pro Monthly", amount: "10000000", interval: "monthly", maxChargePerCycle: "10000000", cumulativeLimit: "100000000" }
   ```

2. **The customer activates on-chain** (via their wallet): they `approve` the SubscriptionContract as a spender (up to the cumulative cap) + call `createSubscription(...)` on the contract. This costs the customer WBT gas (one-time setup).

3. **Record the subscription** (server-side):
   ```ts
   const sub = await client.subscriptions.create({
     onChainSubscriptionId: "0x...", // the bytes32 from the on-chain createSubscription
     planId: "plan_...",
     payerWallet: "0x...",
   });
   ```
   The backend reads `getSubscription()` from the contract + verifies the terms match the plan.

4. **The scheduler renews automatically**: the gateway worker polls for due subscriptions + the relayer calls `charge()` on the contract (paying WBT gas). The customer pays nothing for renewals.

5. **Webhook**: you get `subscription.renewed` (or `subscription.renewal_failed`) on each cycle.

6. **Cancellation**: the customer calls `cancel()` on the contract (on-chain) + you can mark it cancelled via `POST /v1/subscriptions/:id/cancel`.

---

## 5. Refunds

1. **Create a refund** (server-side):
   ```ts
   const refund = await client.refunds.create({ paymentId: "pay_...", amount: "5000000", reason: "partial" });
   ```

2. **The merchant authorizes the refund** (signs EIP-3009): the merchant's payout wallet signs a `TransferWithAuthorization(from=merchant, to=original payer, amount=refund)`. Submit it:
   ```ts
   // POST /v1/refunds/:id/authorize { from, to, value, validAfter, validBefore, nonce, signature }
   ```

3. **The relayer submits** the refund on-chain (paying WBT gas) + verifies settlement.

4. **Webhook**: you get `refund.succeeded`. The original payment's status flips to `refunded` or `partially_refunded`.

---

## Full example — a merchant website in ~30 lines

```tsx
// server.ts — create a payment intent when the customer checks out
import { WhitechainClient } from "@ezpayz/sdk";
const client = new WhitechainClient(process.env.SECRET_KEY!, "https://your-gateway.com");

app.post("/checkout", async (req, res) => {
  const intent = await client.paymentIntents.create({
    amount: "10000000", // 10 USDT
    description: "Order #" + req.body.orderId,
    idempotencyKey: req.body.orderId,
  });
  res.json({ checkoutSlug: intent.checkoutSlug });
});

// Checkout.tsx — the customer pays
import { useSignTypedData } from "wagmi";
import { WhitechainCheckout } from "@ezpayz/sdk";

function Checkout({ slug }: { slug: string }) {
  const { signTypedDataAsync } = useSignTypedData();
  return (
    <WhitechainCheckout
      checkoutSlug={slug}
      apiUrl="https://your-gateway.com"
      signTypedData={signTypedDataAsync}
      onSuccess={(r) => alert("Paid! tx: " + r.txRef)}
    />
  );
}

// webhooks.ts — confirm the order
import { verifyWebhookSignature } from "@ezpayz/sdk";
app.post("/webhooks", (req, res) => {
  if (!verifyWebhookSignature(SECRET, req.rawBody, req.headers["x-whitechain-signature"])) return res.status(401).end();
  const event = JSON.parse(req.rawBody);
  if (event.type === "payment.succeeded") fulfillOrder(event.payload.paymentIntentId);
  res.status(200).end();
});
```

---

## Pros and cons

### Pros

- **Gasless for the payer**: the customer signs an EIP-3009 authorization + pays **zero gas**. The gateway relayer pays the WBT gas. This removes the biggest UX friction in crypto payments.
- **Non-custodial**: USDT moves directly payer → merchant wallet. The gateway never holds funds. No custodial risk.
- **Recurring on-chain**: subscriptions are enforced by a deployed, source-verified smart contract with per-cycle + cumulative caps — not just an off-chain schedule. The customer's exposure is bounded.
- **PayeeShield**: every payment request is signed by the gateway (EIP-712). The checkout widget verifies the signature before asking the customer to sign — protecting against tampered amounts/recipients.
- **GasGuard**: the relayer's pre-submission policy checks (chain/token allowlist, budgets, pause) prevent abuse of the sponsored-gas flow.
- **Typed SDK + React widget**: a developer can integrate in ~30 lines (server client + `<WhitechainCheckout/>` + webhook verify).
- **Signed webhooks with retries**: HMAC-SHA256 signed delivery + BullMQ retries + a replay endpoint.
- **Tenant isolation**: every merchant's data is scoped by `merchantId` — one merchant cannot read another's payments/customers.
- **Idempotency**: all write endpoints accept an `Idempotency-Key` — safe retries, no duplicate charges.
- **Fast finality**: Whitechain Sepolia ~1s blocks → settlement in ~5s.
- **EVM-compatible**: standard viem/wagmi tooling works; no Whitechain-specific SDK needed.

### Cons

- **Testnet only (hackathon MVP)**: deployed on Whitechain Sepolia, not mainnet. Not production-ready.
- **Email is stubbed**: receipts/refund confirmations are logged, not actually sent (no SMTP wired).
- **Single PayeeShield key**: one gateway-wide signing key (per-merchant keys deferred). If compromised, all requests are forgeable until rotated.
- **Relayer key in `.env`**: the relayer's private key is stored in an environment variable (not a KMS/HSM). Acceptable for a hackathon, not for production.
- **Webhook signing secret stored as plaintext** in the database (MVP; should be encrypted at rest).
- **Dashboard UI is partially mock**: the real checkout (`/real-checkout/:slug`) is wired to the live API, but the merchant dashboard pages still run on the mock adapter. Full dashboard wiring is incremental.
- **No deploy yet**: the gateway runs locally. Vercel/Render deploy is pending (the owner is testing locally first).
- **Monthly interval = 30-day approximation on-chain**: the contract uses 2592000s for monthly; the backend scheduler handles real calendar timing, but the on-chain `nextDueTime` advances by 30 days.
- **WalletConnect not configured**: the RainbowKit config uses a placeholder projectId — MetaMask/injected works, but WalletConnect connections don't (until a real projectId is set).
- **GasGuard is minimal**: currently checks chain/token allowlist + global pause. Per-tx gas estimation, per-merchant rate limits, and nonce/replay protection are deferred.
- **Requires an external wallet**: the gasless flow still needs the customer to have an EVM wallet (MetaMask) to sign the EIP-3009 authorization. No embedded/account-abstraction wallet-less flow yet.
- **Single-token (USDT only)**: the gateway is built for the required test USDT. Multi-token support isn't implemented.
