# EzPayz — Manual Testing Guide (Demo Day)

Step-by-step instructions to verify the two headline features before the judge demo:
**(A)** the real USDT payment gateway (payment link → hosted checkout → on-chain settlement)
and **(B)** x402 agent payments (HTTP 402 → gasless USDT micropayment → settlement).

Two modes exist — know which one you are in:

| | Demo mode (`VITE_DEMO_MODE=true`) | Real mode (flag off/unset) |
|---|---|---|
| Login | `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` (from `apps/web/.env.local`) — intercepted in the frontend | Any account registered through `POST /v1/auth/register` (sign-up page) |
| Data | Seeded in-browser (Zustand), nothing touches a DB or chain | Real API (`VITE_API_URL`), real Prisma DB, real Whitechain Sepolia txs |
| Payment links | Visible in the dashboard only — **not payable** at `/l/<slug>` (the resolver always calls the real API) | Fully payable end-to-end |
| Wallet | "Demo wallet (simulated)" fallback | MetaMask / injected wallet on chain 1874 |

---

## Part 1 — Demo-mode walkthrough (2 minutes, zero setup)

1. `pnpm dev:web` → open `http://localhost:5174`.
2. Sign in with the demo credentials from `apps/web/.env.local` (default: `demo@whitechain.dev` / `demodemo123`).
3. Tour: Dashboard (KPIs, volume chart, renewals, transactions) → Payments → Payment Links (open one, see QR) → Subscriptions → GasGuard → Developers → x402.
4. Everything is labeled simulated; the amber banner + header pill say so. Nothing is broadcast on-chain.

Use this path when you need a working product tour without any backend.

---

## Part 2 — Real payment gateway (payment link → on-chain settlement)

### Prerequisites

- [ ] API running: `pnpm --filter @ezpayz/api dev` (Fastify on :3000)
- [ ] **Worker running** (separate terminal): `pnpm --filter @ezpayz/api worker` — the relayer that submits the gasless payment. Without it, checkout authorizes but never settles.
- [ ] `apps/web/.env.local`: `VITE_API_URL=http://localhost:3000` (or the Render URL) and `VITE_DEMO_MODE=false`. Restart `pnpm dev:web` after changing env.
- [ ] Root `.env` populated: `DATABASE_URL`, `REDIS_URL`, `RELAYER_PRIVATE_KEY` (funded with WBT from <https://faucet.testnet.whitechain.io>), `JWT_SECRET`, `PAYEESHIELD_SIGNING_KEY`.
- [ ] Customer wallet: MetaMask on **Whitechain Sepolia** (chain 1874, hex `0x752`, RPC `https://rpc.testnet.whitechain.io`) holding **test USDT** (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`). WBT gas is **not** required for one-time payments (gasless) — only the merchant's relayer pays gas.
- [ ] If using the deployed Render API instead of local: expect a ~60 s cold start on the first request.

### Steps

1. **Register a merchant** — sign-up page (`/sign-up`) with any email/password (min 8 chars).
   ⚠️ The seeded Acme/Globex merchants **cannot log in** (placeholder password hashes). Always register fresh.
2. **Set the payout wallet** — Settings → Payout wallet → connect MetaMask → verify ownership (sign challenge) → save. This is the address that receives USDT.
3. **Create a payment link** — Payment Links → New → type "Fixed", amount e.g. `0.10` USDT, title "Judge demo". Copy the link `…/#/l/<slug>`.
4. **Pay as a customer** — open the link in a **second browser profile** (no merchant session):
   - `/l/<slug>` resolves and redirects to the hosted checkout `/real-checkout/<slug>`.
   - Verify the PayeeShield row shows the verified merchant request (recipient, amount, token, chain).
   - Connect MetaMask → the page blocks you on the wrong network until you switch to chain 1874.
   - Click **Pay** → MetaMask asks for a **signature only (no gas fee)** — this is the EIP-3009 `TransferWithAuthorization`.
5. **Expected result** (within ~5–60 s):
   - Checkout flips to the drawn-check success screen with amount + truncated tx hash.
   - "Explorer" opens `https://explorer.testnet.whitechain.io/tx/<hash>` — a real USDT `Transfer` to the payout wallet.
   - "Receipt" downloads `receipt.pdf`.
   - Merchant dashboard → Payments now lists the payment as **Succeeded**; webhook events appear in Developers → Event Logs.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Failed to fetch" when signing up / logging in** | The browser never reached the API. Two causes: **(1)** you are on `localhost` and the **deployed** API is a stale build whose CORS allow-list only includes the Vercel origin — redeploy the API on Render (Manual Deploy → latest commit), or run the API locally and point `VITE_API_URL=http://localhost:3000`. **(2)** the Render service is asleep — the first request wakes it (up to ~60 s); retry once. |
| Stuck on "Relayer queued…" then timeout | Worker not running, or relayer wallet has no WBT — fund it and re-run |
| Checkout blocked on network | MetaMask not on chain 1874 — use the in-page switch prompt |
| `404 Payment link not found` at `/l/<slug>` | The link was created in **demo** mode (mock) — create it under a real login |
| First API call hangs ~60 s | Render free-tier cold start — retry |
| Signature requested looks like a transfer | It isn't — the EIP-3009 message authorizes a transfer the *relayer* submits; you pay zero gas |

---

## Part 3 — x402 agent payments (HTTP 402 micropayments)

Flow: agent calls a paid API → `402 Payment Required` + requirements → agent signs a gasless EIP-3009 USDT authorization → facilitator verifies + settles → agent retries with proof → gets the content. The **agent needs test USDT but zero WBT**.

### Prerequisites

- [ ] API + worker running (as above) — the API is the **facilitator** (`/v1/x402/verify`, `/v1/x402/settle`).
- [ ] A merchant **secret key** (`wcp_sec_…`): sign in as a real merchant → Developers → API keys → create → copy the secret (**shown once** — it is never stored or displayed again).
  ⚠️ **Do not use a publishable key** (`wcp_pub_…`): `/v1/x402/settle` rejects it with **403** ("Publishable keys cannot perform write operations"), so payments get delivered but never settle on-chain and never appear in the dashboard. The dashboard's generated snippet contains a `wcp_sec_PASTE_YOUR_SECRET_KEY` placeholder — replace it with your real secret.
- [ ] An agent wallet funded with **test USDT** (the pre-configured `TEST_PAYER_*` wallet in root `.env` works).
- [ ] Node 20+.

### Step 1 — merchant server (the paid API)

Create `x402-demo/server.mjs`:

```js
// npm install express @ezpayz/x402
import express from "express";
import { ezPayzPaymentMiddleware } from "@ezpayz/x402";

const app = express();

app.use(
  ezPayzPaymentMiddleware({
    facilitatorUrl: "http://localhost:3000/v1/x402", // or https://ezpayz-api.onrender.com/v1/x402
    secretKey: "wcp_sec_PASTE_YOUR_SECRET_KEY",
    routes: {
      "GET /api/data": {
        price: "0.01",                                  // USDT
        payTo: "PASTE_MERCHANT_PAYOUT_WALLET",          // receives the micropayment
        description: "Premium market data",
      },
    },
  }),
);

app.get("/api/data", (_req, res) => res.json({ ok: true, secret: "premium data for paying agents" }));

app.listen(4021, () => console.log("Paid API on http://localhost:4021/api/data"));
```

(The same snippet is generated by the dashboard at Developers → x402, prefilled with your key + payout wallet.)

### Step 2 — agent client

Create `x402-demo/agent.mjs`:

```js
// npm install @ezpayz/sdk
import { x402Fetch } from "@ezpayz/sdk";

const res = await x402Fetch("http://localhost:4021/api/data", {
  privateKey: "PASTE_AGENT_PRIVATE_KEY_WITH_TEST_USDT",
});
console.log("status:", res.status);
console.log("body:", await res.json());
```

### Step 3 — run and verify

```bash
node x402-demo/server.mjs   # terminal 1
node x402-demo/agent.mjs    # terminal 2
```

**Expected output:**

1. First run: the server returns **HTTP 402** with `X-PAYMENT-REQUIREMENTS` (the agent logs/handles it) — no content.
2. The agent signs the EIP-3009 authorization and retries with `X-PAYMENT`.
3. Second call: `status: 200` with the paid JSON body.
4. The API facilitator settles on-chain: `POST /v1/x402/settle` returns `{ success: true, txHash, paymentId, explorerUrl }` — check the tx on `https://explorer.testnet.whitechain.io/tx/<hash>`.
5. **Merchant dashboard → Payments**: a new succeeded payment (payer = agent wallet); **Developers → x402 → "Recent x402 Payments"** lists it with the explorer link.

---

## Part 4 — Automated e2e scripts (strongest proof)

API must be on `http://localhost:3000` **and the worker must run**. Run from the repo root:

| Script | Command | Env needed | Success output |
|---|---|---|---|
| Gasless one-time payment | `pnpm --filter @ezpayz/api exec tsx scripts/e2e-gasless.ts` | `TEST_PAYER_PRIVATE_KEY`, `TEST_PAYER_ADDRESS`, `TEST_RECIPIENT_ADDRESS` (in root `.env`) | `FINAL: { status: "succeeded", … }` then **`Gasless e2e PASSED.`** |
| Subscription renewal | `pnpm --filter @ezpayz/api exec tsx scripts/e2e-subscription.ts` | same `TEST_PAYER_*` | **`Subscription e2e PASSED — a real recurring charge settled on-chain via the relayer.`** |
| Refund | `pnpm --filter @ezpayz/api exec tsx scripts/e2e-refund.ts` | process args: `PK`, `WALLET`, `RID`, `PAYER`, `AMOUNT`, `SECRET` | JSON `{"status":"succeeded"}` |
| Merchant isolation | `pnpm --filter @ezpayz/api exec tsx scripts/test-isolation.ts` | none | **`Isolation test PASSED — Merchant A's data is not visible to Merchant B.`** |
| EIP-3009 probe | `pnpm --filter @ezpayz/api exec tsx scripts/e2e-eip3009.ts` | none (probe) | Structural match of the on-chain authorization domain |

Notes:
- `e2e-subscription.ts` sends **real transactions** (approve + `createSubscription`) against contract `0x0b8Da2EE37f3599141aFD500b1e2699D5A6bCdbB`; the relayer needs `CHARGER_ROLE` (one-time via `scripts/grant-charger-role.ts`).
- Known discrepancy: `apps/api/src/config/contracts.ts` points at `0xb084286f…` ("v2") while the e2e script + README use `0x0b8Da2EE…`. The e2e script is self-consistent; don't mix the two addresses when demoing subscriptions.

---

## Known caveats (read before demoing)

- **WalletConnect is not functional** — the RainbowKit `projectId` is a placeholder. Use MetaMask / an injected wallet only.
- **Demo-mode payment links are not payable** at `/l/<slug>` — that route always hits the real API. Demo mode is for the dashboard tour; real flows need a real account.
- **Seeded merchants cannot log in** — register fresh via `/sign-up`.
- **Render API cold start** is ~60 s on the first request after idle; warm it up before judges arrive.
- The dashboard wallet button connects the **operational** wallet session; the **payout (settlement) address** is a separate concept managed in Settings → Payout wallet.
