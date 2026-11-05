# AGENTS.md: instructions for AI coding agents

You are helping build **StableGate**, a non-custodial USDT payment gateway on Whitechain Sepolia. Read this file fully before touching code. Then read the docs in the order listed in `README.md`.

## 1. Ground rules (non-negotiable)

1. **Never invent capabilities.** If a fact is marked *unverified* in `docs/10-RISKS-AND-GATES.md`, do not code as if it were true. Run the gate test first. If a gate fails, stop and report; do not silently substitute another mechanism.
2. **Money is integers.** Token amounts are `bigint` base units. Never `number`/float. Read `decimals()` from the token; never hardcode.
3. **The browser is never authoritative.** A payment is `succeeded` only after the backend observer verifies the on-chain log (right token, chain, sender, recipient, amount) and the confirmation threshold passes.
4. **No custody.** USDT moves payer → merchant payout wallet directly. Never add code that holds customer funds.
5. **Secrets stay server-side.** Relayer key, PayeeShield signing keys, API secrets, webhook secrets never reach client code, logs, or Git. `.env*` is git-ignored. Commit only `.env.example`.
6. **No generic relayer.** The relayer may only call allowlisted functions on allowlisted contracts (see `docs/08`). There must be no endpoint that forwards arbitrary calldata.
7. **PII off-chain, off-Arkiv.** Emails and names live in Postgres only. Arkiv entities and on-chain data are public.
8. **Tenant isolation.** Every query on merchant-owned data is scoped by `merchant_id` derived from the authenticated credential, never from a request parameter alone.
9. **Idempotency everywhere.** All POSTs accept `Idempotency-Key`. Webhook, observer, scheduler and relayer jobs must be safe to run twice.
10. **Arkiv and CRE are never on the critical settlement path.** If either is down, checkout still works.

## 2. Truth labels used in docs

- **Verified**: tested by us on Whitechain Sepolia; evidence linked in README status table.
- **Unverified**: believed from docs or reasoning, not tested. Gate required.
- **Proposed**: a design choice, not a fact.

When you verify something, update `docs/10-RISKS-AND-GATES.md` and the README status table in the same commit.

## 3. Workflow

1. Pick the next unchecked task in `docs/07-IMPLEMENTATION-PLAN.md` (IDs like `C1`, `A3`). Do tasks in order unless the plan says otherwise.
2. Write the test first or alongside (`docs/09-TESTING.md`).
3. Implement the smallest change that meets the task's **acceptance criteria**.
4. Run: `pnpm lint && pnpm typecheck && pnpm test` and `forge test` for contracts.
5. Commit with a conventional message (`feat(api): ...`, `test(contracts): ...`, `docs: ...`). **Small, frequent commits.** Judges check commit history; never squash a day's work into one commit.
6. Tick the task box in the plan and update the README status table if a capability changed.
7. Log AI use in `AI_USAGE.md` (what was generated, what was reviewed by a human). ETHGlobal requires disclosure.

## 4. Definition of done (any task)

- Acceptance criteria in the plan are met and demonstrated by a test or a recorded transaction hash.
- No new `TODO` without an issue/plan entry.
- Types are strict; no `any` in `packages/*` public APIs.
- Errors return the stable error shape in `docs/05-API-AND-SDK.md`.
- Docs touched by the change are updated.

## 5. Things that will get the project disqualified or judged badly

- Using a self-minted token instead of the required USDT for the main flow.
- A "pay button that sends a plain transfer" with no contract-enforced rules. Our `GatewayRouter` rules must be real.
- Arkiv used only as a write-only log. A user-visible feature must read from it.
- A CRE workflow that is decorative. Removing it must lose a feature.
- One giant commit at the end.
- Claiming features in README that do not work.

## 6. Key constants (re-verify before deploying)

| Item | Value |
|---|---|
| Network | Whitechain Sepolia, chain ID `1874` |
| RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | `https://explorer.testnet.whitechain.io/` |
| Faucet | `https://faucet.testnet.whitechain.io/` |
| Required test USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| Gas token | WBT |

## 7. If you are unsure

Do not guess on security-relevant behavior (signatures, nonces, allowlists, key handling). Write the question into `docs/10-RISKS-AND-GATES.md` under "Open questions" and continue with a task that does not depend on it.
