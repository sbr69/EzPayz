# 06 · Tech stack

Principle: **boring, fast to build, easy for AI agents to generate correctly.** Pin exact versions in lockfiles when you scaffold (use the latest stable at project start; versions were not checked here).

| Layer | Choice | Why | Alternative |
|---|---|---|---|
| Language | TypeScript (strict) everywhere | One language across API, SDK, web, workflow | |
| Package manager | pnpm workspaces | Monorepo with shared types | npm/yarn |
| Contracts | Solidity `^0.8.24`, **Foundry** (forge/cast/anvil), OpenZeppelin | Fast tests, fuzz + invariants, scriptable deploy; Whitechain is plain EVM | Hardhat |
| Chain client | **viem** | Typed, EIP-712 helpers, works with any EVM RPC | ethers |
| API server | **Fastify** + zod (schema validation) | Fast, schema-first, small | Express, Hono |
| DB | **PostgreSQL** + **Drizzle ORM** + migrations | Transactions, unique constraints, outbox | SQLite for local dev only |
| Jobs / outbox | **pg-boss** (or simple polling worker on Postgres) | No Redis to run; durable | BullMQ + Redis |
| Web | **Next.js** (App Router) + Tailwind + shadcn/ui | Dashboard, hosted checkout, discover | Vite + React |
| Wallet connect | **wagmi + viem** (injected + WalletConnect) | Typed-data signing in browser | RainbowKit on top |
| Email | **Resend** (or Mailpit locally) | Simple API | Postmark, SES |
| Signing keys (PayeeShield) | Hackathon: encrypted at rest with an env master key; Production: KMS/HSM | Per-merchant isolation; honest limitation | Cloud KMS |
| Relayer key | Env secret (hackathon only); KMS later | Never in repo/client | |
| x402 | `@x402/*` packages for client/server where compatible; own facilitator routes | Ecosystem compatibility | Fully custom |
| Arkiv | `@arkiv-network/sdk` | Required by track | JSON-RPC |
| Chainlink | **CRE CLI** + CRE workflow SDK (TypeScript; check current language support) | Simulation qualifies | Go |
| Tests | forge test; vitest; Playwright (e2e) | | |
| CI | GitHub Actions: lint, typecheck, vitest, forge test | Visible green history | |
| Lint/format | ESLint + Prettier; `forge fmt` | | |
| Hosting | Web: Vercel. API + worker: Railway/Fly/Render. DB: Neon/Supabase/Railway Postgres | Quick deploys | |
| Observability | pino logs, `/healthz`, relayer metrics endpoint | Operator view | |

## Environment variables (`.env.example` skeleton)

```bash
# Chain
WHITECHAIN_CHAIN_ID=1874
WHITECHAIN_RPC_URL=https://rpc.testnet.whitechain.io
USDT_ADDRESS=0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7
MERCHANT_REGISTRY_ADDRESS=
GATEWAY_ROUTER_ADDRESS=
CONFIRMATIONS_SMALL=3
CONFIRMATIONS_LARGE=30

# Secrets (never commit real values)
RELAYER_PRIVATE_KEY=
ADMIN_PRIVATE_KEY=
SIGNING_KEY_MASTER_SECRET=
API_KEY_PEPPER=

# Database / jobs
DATABASE_URL=postgres://…

# Email
RESEND_API_KEY=
EMAIL_FROM=

# GasGuard defaults
GAS_MAX_PER_TX_WBT=
GAS_DAILY_BUDGET_WBT=
GAS_PER_MERCHANT_DAILY_WBT=
RATE_LIMIT_PER_PAYER_PER_HOUR=5

# Arkiv
ARKIV_RPC_URL=
ARKIV_PUBLISHER_PRIVATE_KEY=

# CRE
CRE_REPORT_HMAC_SECRET=
```

## Whitechain-specific notes

- Gas token is **WBT**; get test WBT and test USDT from the faucet.
- The docs publish an `llms.txt` and agent-friendly pages; point your AI coding tools at `https://docs.whitechain.io/llms.txt` for current details.
- Mainnet is separate (chain ID reported as `1875` in their FAQ). The hackathon requires **Sepolia (1874)**. Keep chain config in one file so switching is a config change, but do not claim mainnet support until tested.
- Native L2→L1 withdrawals are slow (docs mention 7+ days on mainnet). Merchants should cash out through exchange/bridge routes, not the canonical bridge. Mention in merchant docs.

## Dependency policy

- Prefer well-known libraries; avoid obscure packages that may be malicious or unmaintained.
- Pin versions; use a lockfile; enable `pnpm audit` in CI.
- No external scripts in checkout pages beyond what's needed.
