# Reach — who this is for, and would they use it

> **Fill during build:** demo URL, live query output screenshot, and real entity counts go here once Phase A2/A4 ship. The numbers below are targets, marked as such.

The question this file answers: *who is it for, would they use it, can they try it today, and will we keep building it after Mumbai?*

## 1. The four audiences, concretely

**a) Humans who want to spend USDT — "who accepts it?"**
The oldest question in crypto payments, usually answered by a Twitter thread or a Notion page. Our directory answers it with a query: merchants who accept USDT on Whitechain, filterable by category and price, every listing signature-verified and registry-cross-checked. For them, Arkiv is invisible infrastructure — they see a storefront list.

**b) AI agents that need paid APIs — the machine audience.**
This is the audience a Postgres-only build structurally cannot serve. An agent (Claude Desktop via our existing MCP server at `packages/mcp`, a custom trading bot, an autonomous researcher) needs to *find* a paid endpoint, *see its price*, *verify the payee*, and *pay* — with no human, no login, no terms-of-service click-through. Our demo agent does exactly that against `kind = "x402"` offers: one Arkiv query replaces the entire "how does an agent discover a merchant" problem. Every agent developer building on x402-style protocols has this exact hole; a public, filterable, self-expiring offer registry is a plausible standard fixture for it.

**c) Third-party developers who want the data, not our API.**
Wallet apps (show "merchants near you"), block explorers (merchant labels), analytics dashboards, or the next hackathon team building a Whitechain UI. They query Arkiv directly — no API key from us, no ToS, no uptime dependency. They'd never get this from our Postgres, which is the point.

**d) The gateway's own merchants.**
For merchants, the listing is free distribution: onboard once, appear in a public directory anyone can index, including search engines and agents. The pitch to a merchant at demo time: "your storefront card is on a public database with your payout address verified on-chain."

## 2. Would they use it? Honest scale

The directory is new — it has no users yet, and we won't pretend otherwise. What exists today, before a single new user:

- The gateway it plugs into is a **working, e2e-verified payment platform** (gasless EIP-3009 payments, on-chain subscriptions, refunds — tx hashes in the root [README](../README.md)), so discovery converts into real payment, not a demo dead-end.
- Our MCP server already ships 11 tools for agent audiences — the `discover_offers` Arkiv tool drops into an existing agent surface rather than starting from zero.
- Target for demo day: 2 seed merchants, ~10 offers across all three kinds (`one_time`, `subscription`, `x402`) — enough to make every filter and the agent's price comparison meaningful. *Real counts go here after the backfill.*

The reach claim we stand behind is the shape, not the size: **anyone running the query in the root README gets the same answers our own UI does, starting today** — that's the bar the track asks for and the one we can prove.

## 3. Can they try it today?

Yes — three doors, cheapest first:

1. **One `curl`** — the raw `arkiv_query` in the root [README](../README.md), no SDK, no account. *Fill during build: paste the actual output below.*
2. **The `/discover` page** in the running app — public, no login. *Fill during build: demo URL + screenshot.*
3. **The demo agent** (`apps/api/scripts/x402-demo-agent.ts`) — finds, verifies, and pays an x402 offer end-to-end. This is the "try it" for the machine audience.

## 4. Will we keep building it after Mumbai?

Yes — this isn't a track-shaped stunt; discovery is the missing half of the gateway's product story. The roadmap, in order:

1. **Merchant-owned listings** — gas stipend + `changeOwnership` so merchants hold their own entities (removes our single-writer weakness, [README §9](README.md#9-known-weaknesses-said-out-loud)).
2. **More x402 routes** — the paid-API surface grows beyond the demo endpoint (fx rates today; quotes, webhooks-as-a-service, agent-to-agent settlements next).
3. **Third-party publisher path** — a documented, signed way for *other* gateways to publish their merchants into the same query namespace, with per-publisher owner wallets instead of gateway co-signing.
4. **A tiny client lib** — publish the query+verify+pay snippet (`apps/api/scripts/arkiv-query-demo.ts` grows up) so agent devs integrate in minutes.
5. **Mainnet when Rabdi's successor ships** — the schema is chain-agnostic; only the RPC and faucet change.
