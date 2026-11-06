# Sill & Shelf

Customer-facing Next.js marketplace demonstrating non-custodial checkout powered by the [EzPayz](https://ezpayz.vercel.app) payment gateway on **Whitechain Sepolia** (Chain ID `1874`).

## Features

- **Modern Architecture**: Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS v4.
- **Neon Postgres**: Serverless PostgreSQL with Drizzle ORM.
- **Hosted EzPayz Checkout**: Seamless redirect to EzPayz hosted checkout for wallet connection and payment in test USDT.
- **Automatic & Manual Reconciliation**: Webhook verification using HMAC-SHA256 signature, plus user-triggered status reconciliation.
- **Customer Friendly**: Simple checkout flow asking Name and Email. Merchant administration is handled directly on the EzPayz gateway dashboard.
- **Curated Catalog**: 12 artisanal homeware products, with each unit price capped under 10 USDT.

## Quick Start

### 1. Install dependencies

```bash
cd marketplace
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Set your environment variables:
- `DATABASE_URL`: Connection string to your Neon Postgres database.
- `APP_ORIGIN`: Base URL of this marketplace (e.g. `http://localhost:3000`).
- `EZPAYZ_API_URL`: Gateway API URL (defaults to `https://ezpayz-api.onrender.com`).
- `EZPAYZ_CHECKOUT_ORIGIN`: Gateway hosted checkout URL (defaults to `https://ezpayz.vercel.app`).
- `EZPAYZ_SECRET_KEY`: Merchant secret API key (`wcp_sec_...`) created in EzPayz Dashboard.
- `EZPAYZ_WEBHOOK_SECRET`: Secret key for verifying EzPayz webhook signatures.

### 3. Run migrations and seed catalog

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the marketplace.

## Testing

Use the [manual testing guide](./MANUAL_TESTING.md) for live setup, hosted checkout, webhook verification, and x402 capability checks. Run the automated suite for regression coverage.

```bash
npm test
```

## Vercel Deployment

1. Set the Vercel project's **Root Directory** to `marketplace`.
2. Connect your Neon Postgres database integration or set `DATABASE_URL` in Environment Variables.
3. Add `APP_ORIGIN` (set to your Vercel deployment URL), `EZPAYZ_SECRET_KEY`, `EZPAYZ_WEBHOOK_SECRET`, `EZPAYZ_API_URL`, and `EZPAYZ_CHECKOUT_ORIGIN`.
4. Deploy!
