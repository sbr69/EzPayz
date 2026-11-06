# @ezpayz/x402

x402 payment middleware for EzPayz — accept gasless USDT payments from AI agents on Whitechain Sepolia via HTTP 402.

## Install

```bash
npm install @ezpayz/x402
```

## Quick start (Express)

```ts
import express from "express";
import { ezPayzPaymentMiddleware } from "@ezpayz/x402";

const app = express();

app.use(ezPayzPaymentMiddleware({
  facilitatorUrl: "https://ezpayz-api.onrender.com/v1/x402",
  secretKey: "wcp_sec_...",  // your EzPayz secret API key
  routes: {
    "GET /api/data": {
      price: "0.01",          // $0.01 USD per request
      payTo: "0xYourWallet",   // your payout wallet
      description: "Premium API data",
      mimeType: "application/json",
    },
  },
}));

app.get("/api/data", (req, res) => {
  res.json({ data: "Your paid content" });
});

app.listen(4021);
```

## Quick start (Fastify)

```ts
import Fastify from "fastify";
import { ezPayzFastifyPlugin } from "@ezpayz/x402";

const app = Fastify();

await app.register(ezPayzFastifyPlugin, {
  facilitatorUrl: "https://ezpayz-api.onrender.com/v1/x402",
  secretKey: "wcp_sec_...",
  routes: {
    "GET /api/data": { price: "0.01", payTo: "0xYourWallet" },
  },
});

app.get("/api/data", async () => ({ data: "Your paid content" }));
await app.listen({ port: 4021 });
```

## How it works

```
1. AI agent → GET /api/data (no payment header)
2. Middleware → 402 Payment Required + X-PAYMENT-REQUIREMENTS header
3. AI agent signs EIP-3009 TransferWithAuthorization (gasless — no WBT needed)
4. AI agent → GET /api/data + X-PAYMENT header (signed authorization)
5. Middleware → POST /v1/x402/verify (EzPayz facilitator verifies signature)
6. If valid → serve content
7. Middleware → POST /v1/x402/settle (EzPayz relayer submits on-chain, pays WBT gas)
8. Merchant receives USDT to payout wallet
```

## AI agent side

AI agents use `x402Fetch` from `@ezpayz/sdk` to automatically handle 402 responses:

```ts
import { x402Fetch } from "@ezpayz/sdk";

const res = await x402Fetch("https://api.example.com/api/data", {
  privateKey: "0x...",  // AI agent's wallet private key
});
const data = await res.json();
// Payment was automatic — the agent signed + the EzPayz relayer settled
```

## Exports

| Export | Description |
|---|---|
| `ezPayzPaymentMiddleware` | Express/Connect middleware |
| `ezPayzFastifyPlugin` | Fastify plugin |
| `generatePaymentRequirements` | Generate x402 requirements for a route |
| `priceToBaseUnits` | Convert USD price to USDT base units |
| `USDT_ADDRESS` | Whitechain Sepolia USDT contract address |
| `WHITECHAIN_NETWORK` | CAIP-2 network identifier (`eip155:1874`) |
