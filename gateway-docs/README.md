# StableGate

> **Working name (placeholder).** A non-custodial USDT payment gateway on Whitechain where **one merchant account takes payments from both humans (gasless checkout) and AI agents (x402)**.

Status: **pre-build.** Everything below is a plan until the status table in this file says otherwise. Nothing here claims a capability that has not been tested on Whitechain Sepolia.

---

## What it is in one paragraph

A merchant registers a payout wallet and adds checkout to their app in about 20 lines. Customers pay in USDT without holding WBT for gas: they sign one typed-data authorization (EIP-3009) and a gateway relayer submits it. USDT goes **directly** from payer to merchant. The same merchant account can also put a price on an API route; AI agents pay per request over x402 and settle through the same relayer, same limits, same dashboard. Merchants can refund in one click, and a Chainlink CRE workflow checks whether the order was actually fulfilled. Public merchant profiles and offers live in Arkiv so humans and agents can discover them without asking us for access.

## Why not just use WhitePay

WhitePay is an exchange-run, account-based processor with fiat conversion, AML screening and POS terminals. We do not compete there. We are the **self-serve, non-custodial, developer-first** option on Whitechain: no partnership request, no merchant balance held by us, no gas for the payer, and one integration for humans and agents. See [`docs/01-PRODUCT.md`](docs/01-PRODUCT.md).

## Read in this order

| # | File | Read it to learn |
|---|---|---|
| 0 | [`AGENTS.md`](AGENTS.md) | **AI agents start here.** Rules, invariants, workflow. |
| 1 | [`docs/01-PRODUCT.md`](docs/01-PRODUCT.md) | Idea, users, scope, cut list, demo |
| 2 | [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | Components, flows, state machines |
| 3 | [`docs/03-DATA-MODEL.md`](docs/03-DATA-MODEL.md) | Postgres schema, Arkiv entities |
| 4 | [`docs/04-SMART-CONTRACTS.md`](docs/04-SMART-CONTRACTS.md) | `MerchantRegistry`, `GatewayRouter` |
| 5 | [`docs/05-API-AND-SDK.md`](docs/05-API-AND-SDK.md) | REST, SDK, webhooks, x402 endpoints |
| 6 | [`docs/06-TECH-STACK.md`](docs/06-TECH-STACK.md) | Tools and why |
| 7 | [`docs/07-IMPLEMENTATION-PLAN.md`](docs/07-IMPLEMENTATION-PLAN.md) | Ordered tasks with acceptance criteria |
| 8 | [`docs/08-SECURITY-GASGUARD.md`](docs/08-SECURITY-GASGUARD.md) | Threat model, relayer protection |
| 9 | [`docs/09-TESTING.md`](docs/09-TESTING.md) | Test plan |
| 10 | [`docs/10-RISKS-AND-GATES.md`](docs/10-RISKS-AND-GATES.md) | What is unverified and how to verify it |
| 11 | [`docs/11-SUBMISSION-CHECKLIST.md`](docs/11-SUBMISSION-CHECKLIST.md) | Per-sponsor requirements, templates, demo script |
| — | [`INTEGRATION.md`](INTEGRATION.md) | **Why Whitechain, Arkiv and Chainlink**, tracks, judge Q&A |

## Planned repository layout

```text
stablegate/
├─ AGENTS.md  README.md  INTEGRATION.md  WHITECHAIN_FEEDBACK.md  AI_USAGE.md  LICENSE
├─ docs/                      # this documentation
├─ contracts/                 # Foundry project (MerchantRegistry, GatewayRouter)
├─ apps/
│  ├─ api/                    # Fastify REST API, relayer, observer, workers
│  ├─ web/                    # Next.js: dashboard, hosted checkout, /discover
│  ├─ demo-store/             # SEPARATE demo merchant app (proves "20 lines")
│  └─ demo-agent/             # x402 client agent script
├─ packages/
│  ├─ sdk/                    # @stablegate/sdk (server client)
│  ├─ react/                  # @stablegate/react (checkout widget)
│  ├─ middleware/             # Express middleware: webhooks + x402 paywall
│  └─ shared/                 # types, zod schemas, ABIs, constants
├─ workflows/cre/             # Chainlink CRE workflow
└─ arkiv/                     # schema.md, friction.md, reach.md, why-arkiv.md, how-you-use-arkiv.md, scripts
```

## Status (update as you build)

| Capability | Status | Evidence (link) |
|---|---|---|
| EIP-3009 verified on the required test USDT | ☐ not started | |
| `MerchantRegistry` + `GatewayRouter` deployed and verified | ☐ | |
| Gasless one-time checkout, real USDT | ☐ | explorer tx |
| 20-line SDK integration in `demo-store` | ☐ | |
| Webhooks + dashboard | ☐ | |
| Refund (full + partial) | ☐ | |
| x402 paywall + agent payment | ☐ | |
| CRE workflow simulated | ☐ | |
| Arkiv discovery reads live data | ☐ | |

## Honest limitations (keep this section true)

- Testnet only. Test USDT and WBT have no monetary value. Not audited. Not production-ready.
- The payer still needs a compatible wallet and signs one typed-data message. Only gas is removed, not the wallet.
- Not a custodian, not escrow, not KYC. A signature does not prove a business is legitimate.
- Fiat off-ramp is out of scope.
