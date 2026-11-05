# 04 · Smart contracts

Two small contracts. Their job is to **enforce rules and emit verifiable receipts**, not to hold funds.

> **Hard gate G1:** all of this assumes the required test USDT (`0xcedf…5a7`) implements EIP-3009 `transferWithAuthorization`. Verify the exact function signature (split `v,r,s` vs `bytes signature`), EIP-712 domain (`name`, `version`, `chainId`, `verifyingContract`) and `authorizationState`. If it does not, stop; see `10-RISKS-AND-GATES.md`.

## 1. `MerchantRegistry`

Purpose: bind a merchant ID to a payout wallet and a PayeeShield signer, controlled by the merchant's **owner wallet**.

```solidity
// Interface (pseudo-Solidity; final ABI is a deliverable of task C1)
struct Merchant {
    address owner;        // controls this record
    address payout;       // receives USDT (EOA in MVP)
    address signer;       // PayeeShield delegated signing key (address)
    uint64  payoutVersion;
    bool    active;
}

function register(bytes32 merchantId, address payout, address signer) external; // msg.sender becomes owner
function setPayout(bytes32 merchantId, address newPayout) external;             // onlyOwner; bumps payoutVersion
function setSigner(bytes32 merchantId, address newSigner) external;             // onlyOwner (rotation)
function setActive(bytes32 merchantId, bool active) external;                   // onlyOwner
function get(bytes32 merchantId) external view returns (Merchant memory);

event MerchantRegistered(bytes32 indexed merchantId, address indexed owner, address payout, address signer);
event PayoutChanged(bytes32 indexed merchantId, address oldPayout, address newPayout, uint64 version);
event SignerChanged(bytes32 indexed merchantId, address oldSigner, address newSigner);
event ActiveChanged(bytes32 indexed merchantId, bool active);
```

Invariants:
- Only `owner` mutates a record. `merchantId` cannot be re-registered.
- `payout != address(0)`, `signer != address(0)`.
- Changing payout bumps `payoutVersion`; signed invoices include the version so old invoices cannot silently redirect.

## 2. `GatewayRouter`

Purpose: settle payments to the registered payout, bind each authorization to one invoice, prevent double settlement, enforce refund caps, emit receipts. **It never custodies tokens.** It is only the caller of the token's authorization function.

```solidity
interface IEIP3009 {
    function transferWithAuthorization(
        address from, address to, uint256 value,
        uint256 validAfter, uint256 validBefore, bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external;
}

struct PaymentRecord {
    bytes32 merchantId;
    address payer;
    address payoutAtPayment;
    uint256 paid;
    uint256 refunded;
}

IERC20/IEIP3009 public immutable token;      // allowlisted USDT only
MerchantRegistry public immutable registry;
address public relayer;                      // allowed caller for settle/refund (rotatable by admin)
bool public paused;

mapping(bytes32 intentId => PaymentRecord) public payments;

// 1) Checkout settlement. Recipient is NOT a parameter.
function settle(
    bytes32 intentId, bytes32 merchantId, address from, uint256 value,
    uint256 validAfter, uint256 validBefore, uint8 v, bytes32 r, bytes32 s
) external onlyRelayer whenNotPaused;
//  - m = registry.get(merchantId); require(m.active)
//  - require(payments[intentId].paid == 0)
//  - nonce = keccak256(abi.encode("SGv1", intentId, merchantId, m.payout, value))
//  - token.transferWithAuthorization(from, m.payout, value, validAfter, validBefore, nonce, v, r, s)
//  - payments[intentId] = {merchantId, from, m.payout, value, 0}
//  - emit PaymentSettled(intentId, merchantId, from, m.payout, value)

// 2) x402 / open settlement (nonce chosen by payer). Recipient still from registry.
function settleOpen(
    bytes32 merchantId, address from, uint256 value, uint256 validAfter, uint256 validBefore,
    bytes32 nonce, uint8 v, bytes32 r, bytes32 s
) external onlyRelayer whenNotPaused;
//  - same registry lookup; emit OpenPaymentSettled(merchantId, nonce, from, m.payout, value)

// 3) Refund. Merchant payout wallet signs; cap enforced here.
function refund(
    bytes32 intentId, uint32 refundSeq, uint256 value,
    uint256 validAfter, uint256 validBefore, uint8 v, bytes32 r, bytes32 s
) external onlyRelayer whenNotPaused;
//  - p = payments[intentId]; require(p.paid > 0)
//  - require(p.refunded + value <= p.paid)
//  - nonce = keccak256(abi.encode("SGR1", intentId, refundSeq, value))
//  - p.refunded += value   (effects before interaction)
//  - token.transferWithAuthorization(p.payoutAtPayment, p.payer, value, ..., nonce, v, r, s)
//  - emit RefundSettled(intentId, refundSeq, p.payer, value)

function pause() external onlyAdmin;
function unpause() external onlyAdmin;
function setRelayer(address) external onlyAdmin;

event PaymentSettled(bytes32 indexed intentId, bytes32 indexed merchantId, address indexed payer, address payout, uint256 value);
event OpenPaymentSettled(bytes32 indexed merchantId, bytes32 indexed nonce, address indexed payer, address payout, uint256 value);
event RefundSettled(bytes32 indexed intentId, uint32 refundSeq, address indexed payer, uint256 value);
```

### Invariants (must be covered by tests)

1. Funds can only move to `registry.payout(merchantId)` on `settle`/`settleOpen`, and only to the original `payer` on `refund`.
2. `settle` succeeds at most once per `intentId`.
3. `refunded <= paid` always.
4. The router never holds a token balance (`token.balanceOf(router) == 0` after every call).
5. A signature for intent A cannot settle intent B (nonce binding), and cannot settle with a different payout or amount.
6. When paused, no settle/refund succeeds.
7. If the token call reverts, no router state changes persist.
8. `payments[intentId]` is written only on a successful token call.

### Notes and open choices (Proposed)

- **Why `onlyRelayer`?** It limits front-running of receipts and keeps GasGuard meaningful. It is **not** needed for fund safety; correctness comes from the recipient rule and nonce binding. A single relayer key is a liveness risk; the admin can rotate it.
- **Admin** is a deployer EOA in the hackathon. Document as a limitation; production would use a multisig.
- **Reentrancy:** the token is allowlisted and trusted, but use `ReentrancyGuard` and checks-effects-interactions anyway.
- **Payout wallets are EOAs** (EIP-3009 `v,r,s` with contract wallets is not assumed to work).
- **Upgradability:** none. Redeploy if needed; this is a hackathon build.
- **Subscriptions** (future): a separate `SubscriptionVault` with allowance-based pulls; not part of this build.

## 3. PayeeShield binding

The invoice payload signed by the merchant's delegated key (EIP-712) includes `payoutVersion`, `payout`, `chainId`, `token`, `amount`, `intentId`, `expiry`, `nonce`, `keyId`. Checkout verifies:

1. Signature recovers to `registry.get(merchantId).signer`.
2. `payout == registry.get(merchantId).payout` and `payoutVersion` matches.
3. Amount/token/chain equal what the payer is about to sign.

Even if the server is compromised and shows a wrong address, the **router still pays only the registered payout**.

## 4. Deployment and verification

```text
contracts/
  src/MerchantRegistry.sol
  src/GatewayRouter.sol
  test/*.t.sol
  script/Deploy.s.sol
```
- Deploy to chain `1874`; record addresses in `contracts/deployments/whitechain-sepolia.json` and README.
- Verify on the Whitechain explorer (method depends on the explorer type; check its docs: Blockscout-style API verification is common but **unverified** here).
- Keep compiler settings and constructor args in the deploy script so verification is reproducible.

## 5. Tests (see `09-TESTING.md`)

Unit, fuzz and invariant tests in Foundry, plus a fork-less integration test that uses a mock EIP-3009 token and a **live** test against the real USDT on Sepolia (gate G1).
