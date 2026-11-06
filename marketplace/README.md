# Marketplace

Standalone local storefront for one merchant. Requires Node.js 24.2 or later.

Create the ignored `marketplace/.env` file and set `MARKETPLACE_PASSWORD` to a unique password of at least 16 characters. Run this command from the repo root.

```sh
node --env-file=marketplace/.env marketplace/server.mjs
```

Open http://127.0.0.1:5174. Edit `catalog.json` and restart to change the sample catalog. The storefront records order lines and server-calculated USDT totals in its own SQLite database. Order history is at `/admin/orders`. Sign in as `merchant` with the configured password.
