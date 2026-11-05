# @ezpayz/sdk

The SDK for the EzPayz. Accept gasless USDT payments, recurring subscriptions, and refunds on Whitechain Sepolia.

## Install

See `NPM_PUBLISH.md` for registry setup (Option A: GitHub Packages private / Option B: public npm).

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
import { useSignTypedData } from "wagmi";
import { WhitechainCheckout } from "@ezpayz/sdk";

function Checkout({ checkoutSlug }: { checkoutSlug: string }) {
  const { signTypedDataAsync } = useSignTypedData();
  return (
    <WhitechainCheckout
      checkoutSlug={checkoutSlug}
      apiUrl="http://localhost:3000"
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
| `WhitechainClient` | Server-side client (secret key). Payment intents, links, invoices, refunds, subscriptions, analytics. |
| `WhitechainCheckout` | React widget for gasless one-time USDT checkout. |
| `WhitechainError` | Structured error class with `code`, `message`, `statusCode`. |
| `verifyWebhookSignature` | HMAC-SHA256 webhook signature verification. |
| `formatBaseUnits` / `parseHumanAmount` | Amount conversion helpers (human-readable ↔ base units). |

## Credentials

| Credential | Where | Scope |
|---|---|---|
| Secret key (`sk_...`) | Server only | Full write access |
| Publishable key (`pk_...`) | Browser | Read-only |
| `clientSecret` | Browser (per checkout) | Short-lived (15 min) |

Never put the secret key in browser code.
