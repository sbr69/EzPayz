# @ezpayz/sdk

The SDK for the EzPayz. Accept gasless USDT payments, recurring subscriptions, and refunds on Whitechain Sepolia.

## Install

The SDK is not yet published to npm. To use it locally:

```bash
# From the monorepo root
cd packages/sdk && pnpm build
# → dist/index.js (ESM) + dist/browser-entry.global.js (standalone <script>) + dist/index.d.ts
```

Then either:
- **In the monorepo:** import directly from `packages/sdk/src/`
- **As a local package:** `npm install ../packages/sdk` (after build)
- **Publish to a private registry:** see `NPM_PUBLISH.md` (Option A: GitHub Packages / Option B: public npm)

Once published, the standard install will work:
```bash
npm install @ezpayz/sdk viem
```

## Quick start

### Server-side — create a payment intent (secret key)

```ts
import { WhitechainClient } from "@ezpayz/sdk";

const client = new WhitechainClient(
  process.env.WHITECHAIN_SECRET_KEY!,  // server-only
  "http://localhost:3000"
);

const intent = await client.paymentIntents.create({
  amount: "10.00",                    // human-readable (SDK converts to base units)
  description: "Pro plan",
  successUrl: "https://yourapp.com/thankyou",
  cancelUrl: "https://yourapp.com/cart",
});

// Returns: { id, clientSecret, checkoutSlug, checkoutUrl, amount, amountBaseUnits, payeeShield }
```

### Client-side — mount the checkout widget (clientSecret only)

```tsx
import { useAccount, useSignTypedData } from "wagmi";
import { WhitechainCheckout } from "@ezpayz/sdk";

function Checkout({ checkoutSlug }: { checkoutSlug: string }) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  return (
    <WhitechainCheckout
      checkoutSlug={checkoutSlug}
      apiUrl="http://localhost:3000"
      payerAddress={address!}            // required — the connected wallet address
      signTypedData={signTypedDataAsync}
      onSuccess={(r) => console.log("Paid!", r.paymentIntentId, r.txRef)}
      onError={(e) => console.error(e.message)}
    />
  );
}
```

### Amount helpers

```ts
import { formatBaseUnits, parseHumanAmount } from "@ezpayz/sdk";

formatBaseUnits("10000000")  // → "10.00"  (base units → human-readable)
parseHumanAmount("10.00")    // → "10000000" (human-readable → base units)
```

## Exports

| Export | Description |
|---|---|
| `WhitechainClient` | Server-side client (secret key). Payment intents, links, invoices, refunds, subscriptions, analytics, products, webhooks, API keys, plans, usage. |
| `WhitechainCheckout` | React widget for gasless one-time USDT checkout. |
| `WhitechainSubscriptionCheckout` | React widget for gasless subscription checkout (Permit + createSubscriptionBySig). |
| `WhitechainError` | Structured error class with `code`, `message`, `statusCode`. |
| `verifyWebhookSignature` | HMAC-SHA256 webhook signature verification. |
| `formatBaseUnits` / `parseHumanAmount` | Amount conversion helpers (human-readable ↔ base units). |
| `x402Fetch` | Drop-in `fetch()` replacement for AI agents — auto-handles HTTP 402 payments via gasless EIP-3009. |
| `verifyWebhookSignature` | HMAC-SHA256 webhook signature verification. |
| `formatBaseUnits` / `parseHumanAmount` | Amount conversion helpers (human-readable ↔ base units). |

## Credentials

| Credential | Where | Scope |
|---|---|---|
| Secret key (`sk_...`) | Server only | Full write access |
| Publishable key (`pk_...`) | Browser | Read-only |
| `clientSecret` | Browser (per checkout) | Short-lived (15 min) |

Never put the secret key in browser code.
