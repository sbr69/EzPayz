# 05 · API, SDK, webhooks, x402

Base URL (dev): `http://localhost:4000`. Versioned under `/v1`. JSON. Names are **Proposed**; keep them stable once the SDK uses them.

## 1. Conventions

- Auth: `Authorization: Bearer sk_test_…` (server) or `pk_test_…` (browser, limited). Checkout pages use short-lived `clientSecret`.
- **Idempotency:** every POST accepts `Idempotency-Key`. Same key + same body → same response. Same key + different body → `409 idempotency_conflict`.
- **Amounts** are strings in token base units in the API (`"10000000"`); the SDK also accepts human decimals (`"10.00"`) and converts using the token's `decimals`.
- **Timestamps:** ISO-8601 UTC.
- **Pagination:** `?limit=&cursor=`.
- **Errors** (stable shape):
```json
{ "error": { "code": "invoice_expired", "message": "…", "request_id": "req_…", "details": {} } }
```
Stable codes: `unauthorized`, `forbidden`, `not_found`, `validation_error`, `idempotency_conflict`, `invoice_expired`, `invoice_tampered`, `already_paid`, `signature_invalid`, `authorization_expired`, `gasguard_rejected`, `relayer_unavailable`, `refund_exceeds_balance`, `chain_mismatch`, `rate_limited`.

## 2. Merchant resources

| Method & path | Purpose |
|---|---|
| `POST /v1/merchants` | Create merchant workspace (dashboard flow) |
| `POST /v1/merchants/:id/register-onchain` | Returns calldata for owner wallet to call `MerchantRegistry.register` |
| `POST /v1/payment-intents` | Create intent → `{ id, checkoutUrl, clientSecret, invoice: {payload, signature} }` |
| `GET  /v1/payment-intents/:id` | Retrieve (authoritative status) |
| `POST /v1/payment-intents/:id/authorize` | Payer submits signed EIP-3009 (clientSecret auth) |
| `POST /v1/payment-links` · `GET /v1/payment-links/:id` · `POST …/:id/disable` | Links |
| `POST /v1/refunds` · `GET /v1/refunds/:id` | Refund (see §4) |
| `GET  /v1/payments` | List with filters |
| `POST /v1/webhook-endpoints` · `GET …/deliveries` · `POST …/events/:id/replay` | Webhooks |
| `GET  /v1/capabilities` | Network, token, decimals, feature flags |
| `GET  /v1/relayer/status` | Operator view: WBT balance, budgets, pause state |
| `POST /v1/x402/resources` | Register a priced route for the paywall |
| `GET  /v1/discover` | Reads Arkiv: `?kind=x402&category=data&maxPrice=50000` |
| `POST /v1/cre/reports` | CRE workflow posts fulfilment results (HMAC/signature auth) |

### `POST /v1/payment-intents`
```json
{
  "amount": "10.00",
  "currency": "USDT",
  "reference": "order_1042",
  "description": "Pro plan, 1 month",
  "customer": { "email": "buyer@example.com" },
  "expires_in": 900,
  "fulfilment": { "url": "https://shop.example/api/orders/order_1042/status" }
}
```
Response (abridged):
```json
{
  "id": "pi_8f2…",
  "status": "requires_authorization",
  "checkoutUrl": "https://pay.stablegate.dev/c/pi_8f2…",
  "clientSecret": "pi_8f2…_secret_…",
  "invoice": { "payload": { "…": "…" }, "signature": "0x…", "keyId": "sk_…" }
}
```

### `POST /v1/payment-intents/:id/authorize`
```json
{ "from": "0xPayer", "validAfter": 0, "validBefore": 1790000000, "v": 27, "r": "0x…", "s": "0x…" }
```
Server checks: intent state, expiry, chain/token, signature recovery == `from`, nonce == expected binding, `from` has balance (eth_call), GasGuard. Returns `202` with `status: submitted` and the tx hash once broadcast. **Never `succeeded`**; clients poll or use webhooks.

## 3. Webhooks

Events: `payment.created|pending|succeeded|failed|expired|underpaid|overpaid|duplicate_detected`, `refund.created|succeeded|failed`, `invoice.paid`, `fulfilment.updated`, `x402.settled`, `exception.created`.

Envelope:
```json
{ "id": "evt_…", "type": "payment.succeeded", "created": "2026-…Z",
  "merchant_id": "mer_…", "api_version": "2026-10-01", "data": { "payment": { … } } }
```
Headers: `StableGate-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + body)>`. Reject if `|now − t| > 300s`. Consumers dedupe on `id`. Retries: exponential backoff (e.g. 1m, 5m, 30m, 2h, 12h) for up to 24h; every attempt logged; manual replay available.

## 4. Refunds

`POST /v1/refunds` `{ "payment_id": "pay_…", "amount": "2.50", "reason": "customer_request" }` (+ `Idempotency-Key`).

- Server rejects `amount > remaining` (`refund_exceeds_balance`). The contract also enforces the cap.
- Response includes `signingRequest` (EIP-712 typed data) when the router path is used. The dashboard asks the merchant's payout wallet to sign, then calls `POST /v1/refunds/:id/authorize`.
- Status becomes `succeeded` only after the observer sees `RefundSettled` and confirmations pass.
- If router path is unavailable, `mode: "manual"`: merchant sends a normal transfer; observer matches and records it.

## 5. SDK (`@stablegate/sdk`, server) and widget (`@stablegate/react`)

### The "20 lines" target

**Merchant server (Express):**
```ts
import { StableGate } from "@stablegate/sdk";
import { webhookHandler } from "@stablegate/middleware";

const sg = new StableGate({ secretKey: process.env.SG_SECRET_KEY! });

app.post("/checkout", async (req, res) => {
  const intent = await sg.paymentIntents.create({
    amount: "10.00", currency: "USDT", reference: req.body.orderId,
  }, { idempotencyKey: req.body.orderId });
  res.json({ id: intent.id, clientSecret: intent.clientSecret });
});

app.post("/webhooks/stablegate", webhookHandler({
  secret: process.env.SG_WEBHOOK_SECRET!,
  onEvent: async (evt) => { if (evt.type === "payment.succeeded") await fulfil(evt.data.payment.reference); },
}));
```
**Browser (React):**
```tsx
import { StableGateCheckout } from "@stablegate/react";
<StableGateCheckout intentId={id} clientSecret={secret}
  onStatus={(s) => s === "succeeded" && showThanks()} />
```
Rule: browser callbacks update the UI only. Fulfilment happens from the webhook or `sg.paymentIntents.retrieve()` on the server.

### x402 paywall (merchant API)
```ts
import { stablegatePaywall } from "@stablegate/middleware";
app.use(stablegatePaywall({
  secretKey: process.env.SG_SECRET_KEY!,
  routes: { "GET /api/prices": { price: "0.01", description: "Latest price feed" } },
}));
```
The middleware advertises x402 requirements and calls our facilitator for `verify` and `settle`. *(Unverified: whether we also support the official `@x402/express` middleware pointing at our facilitator URL; prefer that for ecosystem compatibility if it works.)*

### Agent client
```ts
import { createAgentFetch } from "@stablegate/agent"; // thin wrapper in apps/demo-agent
const pay = createAgentFetch({ signer, policy: { maxPerCall: "0.05", maxPerDay: "2.00" } });
const res = await pay("https://merchant.example/api/prices");
```

## 6. x402 facilitator endpoints

| Endpoint | Behavior |
|---|---|
| `GET /x402/supported` | Lists supported scheme(s) (`exact`), network (Whitechain Sepolia), asset (USDT) |
| `POST /x402/verify` | Validates payload: scheme, network, asset, `payTo == registered payout`, amount ≥ price, validity window, signature recovery, payer balance, not-yet-used nonce |
| `POST /x402/settle` | Runs GasGuard; relayer calls `settleOpen`; waits for inclusion; returns tx hash |

Payload and response field names must follow the current x402 spec. **Verify against `https://www.x402.org/` and the `@x402/*` packages before implementing.** Do not copy another facilitator's code.

## 7. Dashboard routes (apps/web)

`/` overview · `/payments` · `/payments/[id]` · `/links` · `/refunds` · `/developers` (keys, webhooks, deliveries, quickstart) · `/x402` · `/discover` · `/exceptions` · `/operator` (relayer, GasGuard) · hosted checkout at `/c/[intentId]` · `/l/[slug]`.
