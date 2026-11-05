# EIP-3009 Verification — Required Test USDT on Whitechain Sepolia

**Date:** 31 October 2026
**Phase:** 0 (P0 release gate)
**Related:** `PLAN.md` Phase 0.3, PRD §10.3 / §27, FLOW §18 (P0 register)

---

## 1. Network confirmation

| Item | Value | Source |
|---|---|---|
| Chain ID | `1874` (`0x752`) | live `eth_chainId` |
| RPC | `https://rpc.testnet.whitechain.io` | live, responding |
| WebSocket | `wss://rpc.testnet.whitechain.io/ws` | whitechain-dev skill `network.md` |
| Explorer | `https://explorer.testnet.whitechain.io` | live |
| Explorer API | `https://explorer.testnet.whitechain.io/api/v2` | live |
| Block height at probe | #11,799,739 | live `eth_blockNumber` |
| Block time | ~1 second/block (100 blocks in 100s) | sampled blocks |
| RPC rate limit | 50 rps sustained / burst 500 per IP (`429` + `Retry-After: 1`) | skill `network.md` |

viem chain definition (from skill `network.md`, to be used verbatim in `apps/api/src/config/chain.ts`):

```ts
defineChain({ id: 1874, name: 'Whitechain Sepolia',
  nativeCurrency: { name: 'WBT', symbol: 'WBT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.whitechain.io'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://explorer.testnet.whitechain.io' } } })
```

## 2. Token identification

| Item | Value |
|---|---|
| Required USDT (proxy) | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| Proxy type | EIP-1967 transparent proxy |
| Implementation | `0x26425662D126412128967ECf0a02EC48573026F7` ("TetherTokenV2") |
| Implementation source verified | **Yes** (`is_verified: true`, `is_fully_verified: true`) on the explorer |
| `name()` | "Tether USD" |
| `symbol()` | "USDT" |
| `decimals()` | `6` |
| `DOMAIN_SEPARATOR()` | `0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25` |

All token calls go through the proxy and delegate to the implementation; the proxy has no separate ABI of its own.

## 3. ABI-level EIP-3009 / ERC-20 verification — PASS

Read from the verified implementation ABI via the Blockscout v2 API. All canonical EIP-3009 entry points are present, in both the packed-signature (`bytes`) and unpacked-signature (`uint8 v, bytes32 r, bytes32 s`) forms:

### EIP-3009 (Transfer With Authorization)
- `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)` — packed
- `transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)` — unpacked
- `receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)` — packed
- `receiveWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)` — unpacked
- `cancelAuthorization(address,bytes32,bytes)` — packed
- `cancelAuthorization(address,bytes32,uint8,bytes32,bytes32)` — unpacked
- `authorizationState(address,bytes32)` — **canonical replay/consumption check**
- `TRANSFER_WITH_AUTHORIZATION_TYPEHASH()`, `RECEIVE_WITH_AUTHORIZATION_TYPEHASH()`, `CANCEL_AUTHORIZATION_TYPEHASH()` — typehashes readable on-chain (no guessing the EIP-712 structure)

### EIP-2612 (permit) — also present (fallback option only; not required)
- `permit(address,address,uint256,uint256,bytes)` and `permit(address,address,uint256,uint256,uint8,bytes32,bytes32)`
- `nonces(address)` (plural — note: an earlier probe of selector `nonce(address)` reverted because the real function is `nonces(address)`)

### ERC-20 (verified)
- `transfer`, `transferFrom`, `approve`, `allowance`, `decimals`, `symbol`, `name`, `balanceOf`, `totalSupply`, `increaseAllowance`, `decreaseAllowance`

### Tether admin/governance (not used by the gateway flow; avoid blocked wallets)
- `addToBlockedList`, `removeFromBlockedList`, `isBlocked`, `destroyBlockedFunds`, `isTrusted`, `mint` (owner-only), `multiTransfer`, `redeem`, `owner`, `transferOwnership`, `renounceOwnership`, `initialize`

## 4. End-to-end behavior test

### 4.1 Structural validation — PASS

A read-only probe (`apps/api/scripts/e2e-eip3009.ts`, probe mode) confirmed the
EIP-712 structure this gateway will sign matches the on-chain USDT contract
exactly:

- Computed `TRANSFER_WITH_AUTHORIZATION_TYPEHASH` (from
  `TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)`)
  = `0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267` —
  matches on-chain `TRANSFER_WITH_AUTHORIZATION_TYPEHASH()`.
- EIP-712 domain = `{ name: "Tether USD", version: "1", chainId: 1874,
  verifyingContract: 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 }` — computed
  `DOMAIN_SEPARATOR` matches on-chain `DOMAIN_SEPARATOR()` =
  `0xcdcfacb6b15c8238b4e5fbb47bdb83b7f83f50a531d264bf9763d2bd1d3d2a25`.

This means a correctly signed `TransferWithAuthorization` will verify on-chain.
It does not yet prove runtime settlement — see 4.2.

### 4.2 Live settlement test — PASS

Executed via `apps/api/scripts/e2e-eip3009.ts` (full mode) on Whitechain Sepolia.

- Payer: `0xa201EEE38742FE108556089F1F330dcC3944071A` (24.29 USDT, 0.698 WBT)
- Recipient: `0x116B846282713aa64d33DD4cA56157704Cba6279` (0 USDT)
- Built an EIP-712 `TransferWithAuthorization` typed message using the real `DOMAIN_SEPARATOR`, chain ID `1874`, verifying contract = USDT proxy, and the on-chain `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`.
- Signed with the payer key; submitted `transferWithAuthorization(...)` (payer self-submitted and paid WBT gas for this test; the relayer-sponsors-gas path is validated in Phase 4).
- Transaction: `0xf5de69f24e2fbebe11ad6d23043344015ab23005bbb30612d067cba09c506cab`
  — https://explorer.testnet.whitechain.io/tx/0xf5de69f24e2fbebe11ad6d23043344015ab23005bbb30612d067cba09c506cab
- Receipt status: `success`; gasUsed: 97,414; USDT `Transfer` event present.
- Recipient USDT balance: 0 → 0.01 (settled).
- `authorizationState(from, nonce)`: 0 (Unused) → 1 (Used) — nonce consumed.
- Replay of the same authorization reverted with `TetherToken: auth invalid` — replay protection confirmed.

This proves the EIP-3009 mechanism end-to-end (sign → submit → settle → nonce-consumption → replay-rejection) on the required test USDT. The Phase 4 relayer path (relayer submits the payer's signed authorization and pays WBT gas instead of the payer) uses the identical signature and contract call; only the gas-payer identity changes.

**Test-USDT source (resolved):** the owner supplied a funded test wallet holding test USDT + WBT. The Whitechain faucet itself dispenses WBT only.

## 5. Confirmation / finality policy (Phase 0.5) — proposed

Block time ~1s. Proposed tunable thresholds (to be encoded in `apps/api/src/config/settlement.ts`):

- `processing` — transaction hash returned by relayer/submission.
- `confirmed` — included in 1 block (~1–2s).
- `finalized` — default **5 blocks** (~5s), configurable. Settlement to `succeeded` requires `finalized` (or merchant-configurable lower threshold for low-value orders).

Reorg handling: Whitechain Sepolia is treated as a shallow-reorg EVM testnet; the observer will re-validate on reorg and never mark `succeeded` prematurely. This is a proposed default pending owner confirmation.

## 6. Go / no-go

- **ABI-level: GO.** EIP-3009, ERC-20 allowance flow, and EIP-2612 are all present and source-verified.
- **Behavioral: GO.** The end-to-end test in §4.2 passed — a signed `TransferWithAuthorization` settled on Whitechain Sepolia, the nonce was consumed, and replay was rejected.
- The one-time gasless architecture (PLAN Phase 4) and sponsored refunds (Phase 6) are cleared to implement against the required test USDT.
- **No fallback needed.**
