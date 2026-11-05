# How to Use — EzPayz

A developer guide to integrating the EzPayz into your website. Accept gasless USDT payments, recurring subscriptions, and refunds on Whitechain Sepolia — with a typed SDK, React checkout widgets, signed webhooks, downloadable receipts, and amount helpers.

---

## Overview

The gateway lets a merchant:
1. **Create a payment intent** (server-side, via the SDK) for a specific USDT amount — using a **human-readable** amount like `"10.00"`.
2. **Show a checkout** to the customer (the React widget or the gateway's hosted checkout page).
3. The customer **signs an EIP-3009 authorization** with their wallet (MetaMask) — they pay **no gas**.
4. The gateway **relayer submits the transaction on-chain** (paying the WBT gas) + verifies settlement.
5. The merchant receives **USDT directly** to their payout wallet (non-custodial).
6. The merchant gets a **signed webhook** when the payment settles + a **downloadable receipt PDF**.
7. The customer is **redirected** to the merchant's `successUrl` (if provided).

The same flow supports **recurring subscriptions** (via a hosted checkout widget + on-chain contract) and **refunds** (merchant signs in the dashboard via Wagmi, relayer sponsors).

---

## Prerequisites

1. **A merchant account** on the gateway (register at `/v1/auth/register` or via the dashboard).
2. **API keys**: after registering, create a key pair (`POST /v1/api-keys`) — you get:
   - A **publishable key** (`pk_...`) — browser-safe, read-only scope (resolve checkout links, read payment intents by ID).
   - A **secret key** (`sk_...`) — server-only, full write access. Shown once; hashed at rest.
3. **A Whitechain Sepolia wallet** for your payout (where USDT arrives) — configured as the merchant's `payoutWallet`.
4. **The gateway running**: `pnpm dev` (API on :3000) + `pnpm worker` (relayer/webhook workers).
5. **The SDK built** (if integrating via npm): `cd packages/sdk && pnpm build` → generates `dist/index.js` (ESM) + `dist/browser-entry.global.js` (standalone `<script>` bundle). `dist/` is gitignored.

> **Security model**: the secret key never reaches the browser. When a payment intent is created (server-side), the gateway returns a short-lived **`clientSecret`** (15 min, signed) that the browser widget uses instead. A leaked `clientSecret` expires in minutes and is scoped to one checkout session.

---

## 1. Server-side integration (Node.js)

Install the SDK (see `packages/sdk/NPM_PUBLISH.md` for registry setup — Option A: GitHub Packages private, Option B: public npm):

```bash
pnpm add @ezpayz/sdk viem
```

Create a payment intent on your server (using the **secret** key):

```ts
import { WhitechainClient } from "@ezpayz/sdk";

const client = new WhitechainClient(
  process.env.WHITECHAIN_SECRET_KEY!,     // your secret API key (server-only)
  "http://localhost:3000"                  // the gateway API URL
);

// Create a payment intent for 10.00 USDT (human-readable; the gateway converts to base units internally)
const intent = await client.paymentIntents.create({
  amount: "10.00",                         // human-readable decimal (USDT has 6 decimals)
  description: "Pro plan subscription",
  customerEmail: "customer@example.com",
  successUrl: "https://yourapp.com/thankyou",   // optional — redirect after payment
  cancelUrl: "https://yourapp.com/cart",        // optional — redirect on failure
  metadata: { orderId: "12345" },               // optional — merchant reconciliation data
  idempotencyKey: "order-12345",                // optional, prevents duplicates
});

console.log(intent);
// { id: "pay_...", clientSecret: "cs_...", checkoutUrl: "/checkout/ck_...", checkoutSlug: "ck_...", amount: "10.00", amountBaseUnits: "10000000", payeeShield: {...} }
```

The `clientSecret` is a short-lived (15 min) signed token — pass it to the frontend widget. The `idempotencyKey` ensures creating the same intent twice returns the same result (no duplicate charges). The `amount` is echoed back in human-readable form; `amountBaseUnits` is the internal representation.

> **Amounts**: all public API amount fields accept human-readable decimal strings (`"10.00"`, `"0.50"`, `"0.01"`). The gateway converts to base units (USDT 6 decimals) internally. EIP-3009 authorization `value` fields are always base units (they're cryptographically bound to the contract). Use the SDK's `formatBaseUnits()` / `parseHumanAmount()` helpers for display.

### Other server-side methods

```ts
// Payment links (reusable URLs)
const link = await client.paymentLinks.create({ title: "Buy a coffee", amount: "2.00" });

// Invoices (with downloadable PDF receipt)
const invoice = await client.invoices.create({
  customerEmail: "customer@example.com",
  title: "Consulting — January",
  lineItems: [{ description: "10 hours dev", quantity: 10, unitPrice: "5.00" }],
});
// Download the paid receipt PDF: GET /v1/checkout/{checkoutSlug}/receipt.pdf (public, no auth required)
// Or for invoices: GET /v1/invoices/{invoiceId}/pdf (requires auth)

// Refunds (full or partial — human-readable amount)
const refund = await client.refunds.create({ paymentId: intent.id, amount: "5.00", reason: "partial refund" });

// Analytics
const overview = await client.analytics.overview();

// Subscriptions — create a hosted checkout session (returns clientSecret for the widget)
const subCheckout = await client.subscriptions.checkout({ planId: "plan_..." });
// { sessionId: "scs_...", checkoutSlug: "sc_...", clientSecret: "cs_..." }

// Subscriptions — record a mirror after the customer activates on-chain
const sub = await client.subscriptions.create({
  onChainSubscriptionId: "0x...", // the bytes32 subId from the on-chain createSubscription
  planId: "plan_...",
  payerWallet: "0x...",
});
```

### Downloadable invoice PDF

After a payment settles, the gateway generates a downloadable receipt PDF:
```ts
// Direct download link (browser or server)
// GET /v1/invoices/{invoiceId}/pdf
// → application/pdf attachment
```
The PDF includes merchant name, line items, total, status, paid date, and on-chain transaction hash. Email delivery is deferred for the MVP (stubbed); the PDF is the primary receipt mechanism.

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

Subscriptions use the deployed `SubscriptionContract` on Whitechain Sepolia. There are two integration paths:

### Path A — Hosted checkout widget (recommended, Stripe Billing model)

The merchant offers subscriptions **on their own website** via the hosted checkout widget:

1. **Create a plan** (server-side):
   ```ts
   // POST /v1/plans { name: "Pro Monthly", amount: "10.00", interval: "monthly", maxChargePerCycle: "10.00", cumulativeLimit: "100.00" }
   ```

2. **Create a subscription checkout session** (server-side):
   ```ts
   const session = await client.subscriptions.checkout({ planId: "plan_..." });
   // → { sessionId, checkoutSlug, clientSecret }
   ```

3. **Mount the widget** (client-side, using the `checkoutSlug`):
   The gateway's hosted page at `/#/real-subscription-checkout/<checkoutSlug>` handles the full flow:
   - Displays plan terms (amount, interval, caps, expiry, merchant payout).
   - Customer connects wallet → approves bounded ERC-20 allowance → calls `createSubscription(...)` on-chain.
   - Customer pays WBT gas for the initial approve + create (one-time setup).
   - Gateway mirrors the subscription + handles all renewals.

4. **The scheduler renews automatically** (gasless): the relayer calls `charge()` on the contract (paying WBT gas). The customer pays nothing for renewals.

5. **Webhook**: you get `subscription.renewal_succeeded` (or `subscription.renewal_failed`) on each cycle.

6. **Cancellation**: the customer calls `cancel()` on the contract (on-chain) + you can mark it cancelled via `POST /v1/subscriptions/:id/cancel`. The customer must also call `approve(contract, 0)` to revoke unused allowance.

### Path B — Manual on-chain activation (advanced)

1. The customer activates the subscription on-chain themselves (approve + createSubscription).
2. You record it server-side via `POST /v1/subscriptions` with the on-chain `subId`.

> **Fully gasless**: subscription setup, renewals, and cancellation are all gasless. The customer signs 2 EIP-712 messages at signup (Permit + createSubscriptionBySig) and 1 at cancel (cancelBySig). The relayer submits all transactions and pays WBT gas. The customer never submits a transaction or holds WBT.

---

## 5. Refunds

Refunds are merchant-authorized transfers from the merchant wallet to the original payer. The MVP signing path is **browser-based** (Wagmi in the gateway dashboard):

1. **Create a refund** (server-side or dashboard):
   ```ts
   const refund = await client.refunds.create({ paymentId: "pay_...", amount: "5.00", reason: "partial" });
   ```

2. **The merchant authorizes the refund in the dashboard**: the merchant connects their payout wallet via RainbowKit in the gateway dashboard. The dashboard prompts the wallet to sign an EIP-3009 `TransferWithAuthorization(from=merchant, to=original payer, value=refund)`. This is handled by the `RealRefundSign` component — no code needed from the merchant.

   Alternatively, submit the signed authorization programmatically:
   ```ts
   // POST /v1/refunds/:id/authorize { from, to, value, validAfter, validBefore, nonce, signature }
   ```

3. **The relayer submits** the refund on-chain (paying WBT gas) + verifies settlement.

4. **Webhook**: you get `refund.succeeded`. The original payment's status flips to `refunded` or `partially_refunded`.

> **MVP signing path**: browser (Wagmi in dashboard). The production-recommended approach is backend-signing (key never leaves the merchant server) — documented as a future enhancement.

---

## 6. MCP server (for AI agents)

The gateway includes an MCP (Model Context Protocol) server that exposes tools + documentation to AI agents like Claude Desktop, Cursor, and VS Code. An AI agent connected to this server can understand the gateway, read the full developer docs, and perform operations on behalf of a developer/merchant.

### Two connection modes

**Local (stdio — for Claude Desktop / Cursor):**

```bash
cd packages/mcp && pnpm build
```

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "whitechain": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": {
        "GATEWAY_SECRET_KEY": "wcp_sec_...",
        "GATEWAY_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Remote (HTTP — for any MCP client):**

The MCP server is mounted at `/mcp` on the gateway API. Connect via `mcp-remote`:
```json
{
  "mcpServers": {
    "whitechain": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp", "--header", "Authorization: Bearer ${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "wcp_sec_..." }
    }
  }
}
```

### What the AI agent can do

**Read documentation (resources):**
- `whitechain://docs/how-to-use` — full integration guide
- `whitechain://docs/prd` — product requirements document
- `whitechain://docs/flow` — end-to-end payment flow
- `whitechain://docs/eip-3009` — EIP-3009 verification report
- `whitechain://docs/api-reference` — complete REST API reference
- `whitechain://docs/sdk-guide` — SDK installation + usage
- `whitechain://status` — live gateway status

**Perform operations (tools — 11 available):**
- `create_payment_intent` — create a gasless USDT payment intent
- `list_payments` / `get_payment` — query payments
- `create_payment_link` — create a reusable payment link
- `create_refund` / `list_refunds` — manage refunds
- `list_customers` — search customers
- `list_subscriptions` / `create_plan` — manage subscriptions
- `get_analytics` — analytics overview
- `verify_webhook_signature` — verify a webhook HMAC signature

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GATEWAY_SECRET_KEY` | Yes | — | Merchant secret API key (`wcp_sec_...`) |
| `GATEWAY_API_URL` | No | `http://localhost:3000` | Gateway API URL |

### Example prompt

Once connected, ask the AI agent:
> "Create a 10.00 USDT payment intent for 'Pro plan' and give me the checkout URL."

The agent will call the `create_payment_intent` tool and return the checkout URL + clientSecret.

---

## Full example — a merchant website

```tsx
// server.ts — create a payment intent when the customer checks out (secret key, server-only)
import { WhitechainClient } from "@ezpayz/sdk";
const client = new WhitechainClient(process.env.WHITECHAIN_SECRET_KEY!, "http://localhost:3000");

app.post("/checkout", async (req, res) => {
  const intent = await client.paymentIntents.create({
    amount: "10.00",                     // human-readable
    description: "Order #" + req.body.orderId,
    successUrl: "https://yourapp.com/thankyou",
    cancelUrl: "https://yourapp.com/cart",
    metadata: { orderId: req.body.orderId },
    idempotencyKey: req.body.orderId,
  });
  res.json({ checkoutSlug: intent.checkoutSlug, clientSecret: intent.clientSecret });
});

// Checkout.tsx — the customer pays (clientSecret only, never the secret key)
import { useSignTypedData } from "wagmi";
import { WhitechainCheckout } from "@ezpayz/sdk";

function Checkout({ slug }: { slug: string }) {
  const { signTypedDataAsync } = useSignTypedData();
  return (
    <WhitechainCheckout
      checkoutSlug={slug}
      apiUrl="http://localhost:3000"
      signTypedData={signTypedDataAsync}
      onSuccess={(r) => console.log("Paid!", r.paymentIntentId, r.txRef)}
    />
  );
}

// webhooks.ts — confirm the order (signed webhook, source of truth)
import { verifyWebhookSignature } from "@ezpayz/sdk";
app.post("/webhooks", (req, res) => {
  if (!verifyWebhookSignature(SECRET, req.rawBody, req.headers["x-whitechain-signature"])) return res.status(401).end();
  const event = JSON.parse(req.rawBody);
  if (event.type === "payment.succeeded") fulfillOrder(event.payload.paymentIntentId);
  res.status(200).end();
});
```

The integration has three parts: server creates the intent (secret key) → frontend mounts the widget (clientSecret) → server verifies the webhook (signed). The browser redirect to `successUrl` is UX-only — the webhook is the authoritative settlement signal.

---

## Pros and cons

### Pros

- **Gasless for the payer**: the customer signs an EIP-3009 authorization + pays **zero gas**. The gateway relayer pays the WBT gas. This removes the biggest UX friction in crypto payments.
- **Human-readable amounts**: the public API accepts `"10.00"` (not `10000000` base units). The SDK converts internally. Developers never reason about 6-decimal token math at the API boundary.
- **Non-custodial**: USDT moves directly payer → merchant wallet. The gateway never holds funds. No custodial risk.
- **Publishable + secret key model**: the browser gets a publishable key (read-only) + a short-lived `clientSecret` per checkout session — never the secret key. Mirrors Stripe/Razorpay.
- **Return URLs**: `successUrl`/`cancelUrl` on payment intents — the checkout redirects the customer back to the merchant's site after settlement (UX-only; the webhook is the source of truth).
- **Downloadable receipt PDF**: server-rendered receipt PDF available on the checkout success page + dashboard. Public endpoint `GET /v1/checkout/:slug/receipt.pdf` (no auth — the customer has the checkout slug, not an API key). Also `GET /v1/invoices/:id/pdf` for merchant-created invoices (requires auth).
- **Hosted subscription checkout**: developers can offer subscriptions on their own site via the `<WhitechainSubscriptionCheckout/>` widget — same integration shape as one-time payments.
- **Refund signing via Wagmi**: merchants sign refund EIP-3009 authorizations in the dashboard via RainbowKit — no merchant backend needed for refunds.
- **Recurring on-chain**: subscriptions are enforced by a deployed, source-verified smart contract with per-cycle + cumulative caps — not just an off-chain schedule. The customer's exposure is bounded.
- **PayeeShield**: every payment request is signed by the gateway (EIP-712). The checkout widget verifies the signature before asking the customer to sign — protecting against tampered amounts/recipients.
- **GasGuard**: the relayer's pre-submission policy checks (chain/token allowlist, budgets, pause) prevent abuse of the sponsored-gas flow.
- **Typed SDK + React widgets**: a developer can integrate with a server client + `<WhitechainCheckout/>` + webhook verify.
- **Signed webhooks with retries**: HMAC-SHA256 signed delivery + BullMQ retries + exponential backoff (max 5 retries: 30s, 60s, 120s, 240s, 480s) + a replay endpoint.
- **Tenant isolation**: every merchant's data is scoped by `merchantId` — one merchant cannot read another's payments/customers.
- **Idempotency**: all write endpoints accept an `Idempotency-Key` — safe retries, no duplicate charges.
- **Configurable finality**: `confirmed` = 1 block (~1–2s), `finalized` = 5 blocks (~5s), configurable in `apps/api/src/config/settlement.ts`.
- **EVM-compatible**: standard viem/wagmi tooling works; no Whitechain-specific SDK needed.

### Cons

- **Testnet only (hackathon MVP)**: deployed on Whitechain Sepolia, not mainnet. Not production-ready.
- **Email is stubbed**: receipts/refund confirmations are logged, not actually sent (no SMTP wired). The downloadable PDF receipt is the primary receipt mechanism. Email will be wired in a later phase.
- **Single PayeeShield key**: one gateway-wide signing key (per-merchant keys deferred). If compromised, all requests are forgeable until rotated.
- **Relayer key in `.env`**: the relayer's private key is stored in an environment variable (not a KMS/HSM). Acceptable for a hackathon, not for production.
- **Webhook signing secret stored as plaintext** in the database (MVP; should be encrypted at rest).
- **Dashboard fully wired to live API**: auth is real (JWT from `POST /v1/auth/login` stored in `localStorage("wcp_token")`). `apiFetch` auto-attaches the JWT as a Bearer header on every request. The `useSyncRealData` hook fetches merchant profile + all list data (payments, refunds, subscriptions, exceptions, invoices, plans, links, webhooks, fulfilment) from the real API on dashboard mount and populates the Zustand store. All dashboard pages display real data. The real checkout, real subscription checkout, real refund signing, and onboarding wallet verification are fully wired to the live API.
- **No deploy yet**: the gateway runs locally. Vercel/Render deploy is pending (the owner is testing locally first).
- **Monthly interval = 30-day approximation on-chain**: the contract uses 2592000s for monthly; the backend scheduler handles real calendar timing, but the on-chain `nextDueTime` advances by 30 days.
- **WalletConnect not configured**: the RainbowKit config uses a placeholder projectId — MetaMask/injected works, but WalletConnect connections don't (until a real projectId is set).
- **GasGuard is minimal**: currently checks chain/token allowlist + global pause. Per-tx gas estimation, per-merchant rate limits, and nonce/replay protection are deferred.
- **Requires an external wallet**: the gasless flow still needs the customer to have an EVM wallet (MetaMask) to sign the EIP-3009 authorization. No embedded/account-abstraction wallet-less flow yet.
- **Single-token (USDT only)**: the gateway is built for the required test USDT. Multi-token support isn't implemented.
- **Refund backend-signing deferred**: the MVP uses browser-based Wagmi signing for refunds. The production-recommended backend-signing path (key never leaves merchant server) is documented but not implemented.
- **SDK built locally, not published**: the SDK builds to `dist/` via `pnpm build` (ESM + IIFE browser bundle). `dist/` is gitignored — run `pnpm build` after cloning. Publishing to a private npm registry (GitHub Packages) is documented in `packages/sdk/NPM_PUBLISH.md` but not yet executed. Public npm publishing (Option B) is documented for later.
