# Sill & Shelf live payment testing

Use a development Neon branch and a dedicated Whitechain Sepolia test wallet. A passing local suite, a working checkout URL, and an HTTP 200 from gateway discovery each verify different things. A live payment passes when the marketplace order is paid and its transaction hash identifies the matching USDT transfer.

## 1. Configure the marketplace

From `soap/marketplace` in PowerShell, install the locked dependencies and create a local env file if it does not already exist.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Open `.env.local` in your editor. Fill the blank values with real credentials for your development environment.

| Variable | Value to use |
|---|---|
| `DATABASE_URL` | Connection string copied from your Neon development branch. Keep SSL enabled. |
| `APP_ORIGIN` | Exact browser origin for the marketplace, such as `http://localhost:3000`. Use the same hostname and port in your browser. |
| `EZPAYZ_API_URL` | `https://ezpayz-api.onrender.com` |
| `EZPAYZ_CHECKOUT_ORIGIN` | `https://ezpayz.vercel.app` |
| `EZPAYZ_SECRET_KEY` | Real merchant secret key from [EzPayz API Keys](https://ezpayz.vercel.app/developers/api-keys). Configure and verify that merchant’s payout wallet first. |
| `EZPAYZ_WEBHOOK_SECRET` | Real endpoint signing secret for the HTTPS webhook in step 4. Leave blank for a localhost test using manual payment checks. |

The buyer wallet needs Whitechain Sepolia **test USDT**. Connect it in hosted checkout and keep wallet private keys out of the marketplace environment. Do not put merchant or webhook secrets in client variables, screenshots, or logs.

```powershell
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "Marketplace migration failed" }
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw "Marketplace seed failed" }
npm run dev
```

Open the configured `APP_ORIGIN`. Confirm the catalog preview banner is gone and the database-backed catalog shows the seeded listings. For an independent check, query `marketplace_products` in Neon and match an item’s slug and price. Prices in that table use six-decimal base units. If a configured database fails, investigate the database error rather than using preview listings as evidence.

## 2. Verify the real gateway and merchant key

Check public discovery, then make an authenticated read. The commands print status only and keep the merchant key in the process environment.

```powershell
Invoke-RestMethod https://ezpayz-api.onrender.com/v1/status
Invoke-RestMethod https://ezpayz-api.onrender.com/v1/x402/supported

@'
const api = new URL("/v1/payment-intents", process.env.EZPAYZ_API_URL);
const key = process.env.EZPAYZ_SECRET_KEY;
if (!key) throw new Error("Set EZPAYZ_SECRET_KEY in .env.local");
const response = await fetch(api, {
  headers: { Authorization: "Bearer " + key },
  redirect: "error",
  signal: AbortSignal.timeout(60000)
});
console.log("Merchant API HTTP", response.status);
if (!response.ok) process.exitCode = 1;
'@ | node --env-file=.env.local --input-type=module -
```

Expect Whitechain Sepolia, chain ID `1874`, and `USDT`. The merchant read should return HTTP 200. For HTTP 401 or 403, check that the key is active and belongs to the same merchant as the payout wallet. A timeout can indicate a cold gateway. Repeat the read before submitting a payment. [Gateway status](https://ezpayz-api.onrender.com/v1/status)

## 3. Run a real hosted checkout

1. Add one low-priced item to the bag. Use **Connect wallet** in the order summary and confirm the network is Whitechain Sepolia. The header **Wallet** menu shows the address, test USDT and test WBT. Verify insufficient USDT blocks checkout. Check the bag total and use a test contact address you control.
2. Submit checkout once. Confirm the browser lands on the configured EzPayz checkout origin and that the merchant name, amount, token, network, and payout wallet match the order. Record the marketplace order reference and gateway payment intent ID from the merchant dashboard.
3. First run the flow without signing. Return to the order and select **Check Status**. It must stay pending.
4. Reopen that order’s checkout. With the funded test wallet on chain `1874`, confirm the amount and sign the authorization. Return to the marketplace after the gateway confirms payment. Select **Check Status** when running locally.
5. Confirm the order displays **Paid**, the gateway has one succeeded intent for that order, and the transaction shows the expected USDT transfer to the merchant. Reload the order to check that paid status persists. Save the timestamp, order reference, gateway intent reference, total, and transaction hash.

If checkout enters review after a timeout, look for the original intent in the merchant dashboard before attempting a replacement. The marketplace claims each order before creating its intent and does not automatically retry an ambiguous create. [Whitechain testnet explorer](https://explorer.testnet.whitechain.io/)

## 4. Verify a real webhook on HTTPS

Use a separate Vercel preview or another reachable HTTPS deployment. Set its `APP_ORIGIN` and Neon connection for that environment. In EzPayz, register its full `/api/webhooks/ezpayz` URL for `payment.succeeded` and set the returned endpoint signing secret as `EZPAYZ_WEBHOOK_SECRET`. Restart or redeploy after setting the secret.

Complete another low-value test payment. Before clicking **Check Status**, verify the gateway delivery log shows a successful webhook and that the order becomes paid when reloaded. Replay that delivery if the gateway exposes replay. The order should retain the same paid state and transaction hash. A request with an invalid signature must return HTTP 400 without changing an order. A verified notification whose payment cannot yet be matched to a succeeded intent returns HTTP 503. Use manual reconciliation if delivery does not recover.

## 5. Test shopping chat with the buyer’s wallet

Open **Agent payments** from the shop footer. Fill `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `APP_ORIGIN`, `EZPAYZ_API_URL`, `EZPAYZ_SECRET_KEY`, and `EZPAYZ_PAYOUT_WALLET` on the server. Keep your browser at the exact `APP_ORIGIN`.

1. Enter your name and email. Ask for something specific, such as a gift for a coffee drinker. Groq receives the search message and public catalog fields. The app sends the contact details only when saving the chosen order.
2. Select **Review purchase** on a live listing. Confirm the item, current USDT amount, Whitechain Sepolia network, and merchant payout address. The server returns an HTTP 402 quote that expires in five minutes.
3. Use **Connect wallet** with an Ethereum browser extension. Approve Whitechain Sepolia (chain `1874`) in the wallet and check the displayed test USDT balance. Open **Show more details** on an item to inspect it in chat.
4. Cancel once and check that no payment was submitted. Request a new quote and click **Confirm with wallet** using the funded wallet. This pays for one unit of the chosen listing.
5. Verify the **Paid** state, order link, and explorer transaction. Confirm the transaction paid the quoted amount to the displayed payout wallet. If the outcome needs review, use the saved order reference and inspect EzPayz before attempting another purchase.

The buyer chat uses the browser wallet. The operator token and server-side test wallet below are used by the separate developer lab.

## 6. Check the developer x402 lab separately

Expand **Developer x402 lab** below the shopping chat. The deployed capability response advertises `exact` on `eip155:1874` with **USDT**. It does not advertise **USDC**.

Fill the additional agent values in `.env.local`.

| Variable | Value to use |
|---|---|
| `GROQ_API_KEY` | Sign in to [Groq Console API Keys](https://console.groq.com/keys) and create a key. Keep it in the server environment. |
| `GROQ_MODEL` | Start with `openai/gpt-oss-20b`. Check that the model is available to your Groq project. |
| `EZPAYZ_PAYOUT_WALLET` | Verified payout address for the merchant that owns `EZPAYZ_SECRET_KEY`. |
| `X402_AGENT_PRIVATE_KEY` | Private key for a separate, dedicated Whitechain Sepolia test wallet funded with test USDT. Use a `0x`-prefixed key. |
| `X402_OPERATOR_TOKEN` | Generated local operator token. Enter this in the page’s **Operator token** field. |

If an existing env file has no operator token, generate one locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and store the result in the env file. Run `npm run db:migrate` again for the agent tables, then restart the app.

1. Open the marketplace at the exact `APP_ORIGIN` and select **Agent payments**. Enter the operator token and ask **Buy the catalog report**.
2. Confirm Groq proposes a **0.01 test-USDT** payment to your configured recipient. First cancel a proposal and confirm no transaction appears.
3. Request a new proposal and click **Confirm 0.01 test USDT**. The server requests a real HTTP 402 challenge, checks its fixed terms, signs with the test wallet, then calls EzPayz verify and settle.
4. Confirm the report appears with an explorer transaction and that the transaction transfers exactly 0.01 test USDT to your payout wallet. Record the transaction hash and check EzPayz. A proposal expires after ten minutes and can be approved once. Approvals reserve against a 0.10 USDT daily UTC limit. If settlement is uncertain, review EzPayz before approving another payment.

Capability discovery alone does not meet the live pass condition. [Live x402 capabilities](https://ezpayz-api.onrender.com/v1/x402/supported) · [EzPayz x402 guide](https://github.com/sbr69/EzPayz/tree/main/packages/x402) · [Groq quickstart](https://console.groq.com/docs/quickstart)

## Regression checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Check catalog filters, the product page, add-to-bag feedback, quantity changes, persistence after reload, and mobile layout. Automated gateway and database contract tests use fixtures. Keep their results separate from live Neon, signed payment, webhook delivery, and x402 settlement evidence.
