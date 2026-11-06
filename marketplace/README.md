# Marketplace

Standalone local storefront for one merchant. Requires Node.js 24.2 or later.

Copy `.env.example` to the ignored `marketplace/.env` file and set `MARKETPLACE_PASSWORD` to a unique password of at least 16 characters. Run this command from the repo root.

```sh
node --env-file=marketplace/.env marketplace/server.mjs
```

Open http://127.0.0.1:5174. Edit `catalog.json` and restart to change the sample catalog. The storefront records order lines and server-calculated USDT totals in its own SQLite database. Order history is at `/admin/orders`. Sign in as `merchant` with the configured password.

## Hosted EzPayz checkout

The example connects to the deployed EzPayz API and checkout on Whitechain Sepolia (chain ID `1874`). Sign in to EzPayz, configure a verified payout wallet, and create a testnet secret API key (`wcp_sec_…`) under **Developers → API Keys**. Set `EZPAYZ_SECRET_KEY` in `marketplace/.env` and restart the marketplace. Keep the key server-side. Leave it blank to run the catalog and order history without checkout. [EzPayz dashboard](https://ezpayz.vercel.app/developers/api-keys) · [Gateway status](https://ezpayz-api.onrender.com/v1/status)

1. Create an order and click **Pay with EzPayz**. The marketplace reuses the stored checkout on subsequent clicks.
2. In checkout, connect a wallet with test USDT on Whitechain Sepolia. After the payment succeeds, click **Return to merchant** in the same browser and select **Check payment status**. The deployed gateway cannot reach the marketplace's loopback webhook.
3. Once the marketplace verifies the intent and marks the order paid, use **Mark fulfilled** at `/admin/orders` to record fulfilment.

Each order keeps its original payment intent. If a checkout fails or expires, review that intent in EzPayz before accepting a replacement payment.

## Local EzPayz development

To run the checkout frontend locally against the deployed API, set `EZPAYZ_CHECKOUT_ORIGIN=http://127.0.0.1:5173` in `marketplace/.env`, restart the marketplace, and run this from the repo root in a separate PowerShell terminal with workspace dependencies installed.

```powershell
$env:VITE_API_URL = 'https://ezpayz-api.onrender.com'
pnpm --filter './apps/web' dev --host 127.0.0.1 --port 5173 --strictPort
```

To use a local API instead, configure the gateway's root `.env`, start its API and workers with `pnpm --filter @ezpayz/api dev`, and use `http://127.0.0.1:3000` for both `EZPAYZ_API_URL` and `VITE_API_URL`. Use a key and payout wallet configured on that API. [Gateway guide](../HOW_TO_USE.md)

For automatic reconciliation on a local gateway, call `POST /v1/webhooks` with the merchant bearer secret and a unique `Idempotency-Key`. Send `{"url":"http://127.0.0.1:5174/webhooks/ezpayz","eventTypes":["payment.succeeded"]}`. Copy the returned `signingSecret` into `EZPAYZ_WEBHOOK_SECRET` and restart the marketplace.

## MCP access

The hosted MCP endpoint supports public tool discovery. Its REST tools use a server process key. For MCP tools scoped to your merchant, run the repository's stdio MCP server locally with `GATEWAY_API_URL=https://ezpayz-api.onrender.com` and `GATEWAY_SECRET_KEY` set to your merchant testnet secret in the MCP client's private environment. [Hosted MCP endpoint](https://ezpayz-api.onrender.com/mcp) · [Local MCP setup](../packages/mcp/README.md#1-local-stdio-claude-desktop-cursor)

## Tests

Run the marketplace suite from the repository root. It uses local HTTP fixtures and does not submit chain transactions.

```sh
node --test "marketplace/*.test.mjs"
```
