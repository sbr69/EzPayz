// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/utils/cryptography/ECDSA.sol";
import {Nonces} from "@openzeppelin/utils/Nonces.sol";

/// @title SubscriptionContract — non-custodial recurring USDT billing on Whitechain.
/// @notice Single ERC-20 spender with internal per-subscription accounting.
/// @dev Invariants enforced per PRD §11.5 / PLAN Phase 1.3:
///   - only active, non-cancelled, non-expired subscriptions can be charged
///   - charge time must be at/after nextDueTime
///   - a billing period cannot be charged more than once
///   - charge amount <= maxChargePerCycle
///   - cumulative charges <= cumulativeCap
///   - payout recipient is fixed at creation (no arbitrary recipient)
///   - cancelled subscriptions can never be charged
///   - reentrancy protection + checks-effects-interactions
///   - a failed transfer reverts the whole tx, so state is NOT advanced
///
/// Gasless lifecycle via BySig functions:
///   - createSubscriptionBySig: payer signs EIP-712 message, relayer submits
///   - cancelBySig: payer signs EIP-712 message, relayer submits
///   - The initial ERC-20 allowance is set via USDT.permit() (EIP-2612) — also gasless.
///   - Renewals use charge() with the allowance set by permit — unchanged.
contract SubscriptionContract is AccessControl, Pausable, ReentrancyGuard, EIP712, Nonces {
    using SafeERC20 for IERC20;

    bytes32 public constant CHARGER_ROLE = keccak256("CHARGER_ROLE");

    /// @notice The allowlisted payment token (USDT proxy). Immutable, single-token MVP.
    IERC20 public immutable token;

    struct Subscription {
        address payer; // customer who authorized the subscription
        address merchant; // fixed payout recipient (immutable per subscription)
        uint256 amount; // default charge amount (fixed plans; usage passes amount to charge())
        uint256 intervalSeconds; // hourly=3600, daily=86400, monthly=2592000 (30-day approx)
        uint256 maxChargePerCycle;
        uint256 cumulativeCap; // bounded total spending limit; no unlimited allowance UX
        uint256 totalSpent;
        uint256 nextDueTime; // earliest time the next charge may execute
        uint256 expiry; // subscription expiry timestamp
        bool active;
        bool cancelled;
    }

    mapping(bytes32 => Subscription) public subscriptions;
    /// @dev subId => periodId => charged. Enforces "a billing period cannot be charged more than once".
    mapping(bytes32 => mapping(uint256 => bool)) public chargedPeriods;

    // ----- EIP-712 type hashes for BySig functions -----
    bytes32 private constant CREATE_SUB_TYPEHASH =
        keccak256(
            "CreateSubscriptionBySig(bytes32 subscriptionId,address payer,address merchant,uint256 amount,uint256 intervalSeconds,uint256 maxChargePerCycle,uint256 cumulativeCap,uint256 nextDueTime,uint256 expiry,uint256 nonce,uint256 deadline)"
        );

    bytes32 private constant CANCEL_SUB_TYPEHASH =
        keccak256("CancelBySig(bytes32 subscriptionId,address payer,uint256 nonce,uint256 deadline)");

    event SubscriptionCreated(
        bytes32 indexed subscriptionId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 maxChargePerCycle,
        uint256 cumulativeCap,
        uint256 nextDueTime,
        uint256 expiry
    );
    event SubscriptionCharged(
        bytes32 indexed subscriptionId, uint256 indexed periodId, uint256 amount, uint256 totalSpent, uint256 nextDueTime
    );
    event SubscriptionCancelled(bytes32 indexed subscriptionId);

    constructor(address token_) EIP712("SubscriptionContract", "1") {
        require(token_ != address(0), "Invalid token");
        token = IERC20(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ---------------------------------------------------------------
    // Direct-call functions (customer pays gas — kept for backward compat)
    // ---------------------------------------------------------------

    /// @notice Customer creates/activates a subscription. Caller becomes the payer.
    function createSubscription(
        bytes32 subscriptionId,
        address merchant,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 maxChargePerCycle,
        uint256 cumulativeCap,
        uint256 nextDueTime,
        uint256 expiry
    ) external {
        _createSubscription(subscriptionId, msg.sender, merchant, amount, intervalSeconds, maxChargePerCycle, cumulativeCap, nextDueTime, expiry);
    }

    /// @notice Customer cancels their own subscription. Blocks all future charges immediately.
    function cancel(bytes32 subscriptionId) external {
        Subscription storage s = subscriptions[subscriptionId];
        require(s.payer == msg.sender, "Not payer");
        _cancel(subscriptionId);
    }

    // ---------------------------------------------------------------
    // BySig functions (relayer submits, pays gas — customer only signs)
    // ---------------------------------------------------------------

    /// @notice Creates a subscription via an EIP-712 signature from the payer.
    /// @dev The relayer calls this with the payer's off-chain signature. The contract
    ///      recovers the signer and verifies it matches `payer`. Gas is paid by the relayer.
    ///      The ERC-20 allowance must already be set (via USDT.permit or approve) before
    ///      the first charge() call.
    function createSubscriptionBySig(
        bytes32 subscriptionId,
        address payer,
        address merchant,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 maxChargePerCycle,
        uint256 cumulativeCap,
        uint256 nextDueTime,
        uint256 expiry,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREATE_SUB_TYPEHASH,
                    subscriptionId,
                    payer,
                    merchant,
                    amount,
                    intervalSeconds,
                    maxChargePerCycle,
                    cumulativeCap,
                    nextDueTime,
                    expiry,
                    _useNonce(payer),
                    deadline
                )
            )
        );
        address signer = ECDSA.recover(digest, signature);
        require(signer == payer, "Invalid signature");
        _createSubscription(subscriptionId, payer, merchant, amount, intervalSeconds, maxChargePerCycle, cumulativeCap, nextDueTime, expiry);
    }

    /// @notice Cancels a subscription via an EIP-712 signature from the payer.
    /// @dev The relayer calls this with the payer's off-chain signature. Gas is paid by the relayer.
    function cancelBySig(
        bytes32 subscriptionId,
        address payer,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        Subscription storage s = subscriptions[subscriptionId];
        require(s.payer == payer, "Payer mismatch");
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CANCEL_SUB_TYPEHASH, subscriptionId, payer, _useNonce(payer), deadline))
        );
        address signer = ECDSA.recover(digest, signature);
        require(signer == payer, "Invalid signature");
        _cancel(subscriptionId);
    }

    // ---------------------------------------------------------------
    // Internal functions
    // ---------------------------------------------------------------

    function _createSubscription(
        bytes32 subscriptionId,
        address payer,
        address merchant,
        uint256 amount,
        uint256 intervalSeconds,
        uint256 maxChargePerCycle,
        uint256 cumulativeCap,
        uint256 nextDueTime,
        uint256 expiry
    ) internal {
        require(subscriptions[subscriptionId].payer == address(0), "Subscription exists");
        require(merchant != address(0), "Invalid merchant");
        require(intervalSeconds > 0, "Invalid interval");
        require(maxChargePerCycle > 0, "Invalid maxChargePerCycle");
        require(cumulativeCap > 0, "Invalid cumulativeCap");
        require(expiry > block.timestamp, "Invalid expiry");
        require(nextDueTime > block.timestamp, "Invalid nextDueTime");
        subscriptions[subscriptionId] = Subscription({
            payer: payer,
            merchant: merchant,
            amount: amount,
            intervalSeconds: intervalSeconds,
            maxChargePerCycle: maxChargePerCycle,
            cumulativeCap: cumulativeCap,
            totalSpent: 0,
            nextDueTime: nextDueTime,
            expiry: expiry,
            active: true,
            cancelled: false
        });
        emit SubscriptionCreated(
            subscriptionId,
            payer,
            merchant,
            amount,
            intervalSeconds,
            maxChargePerCycle,
            cumulativeCap,
            nextDueTime,
            expiry
        );
    }

    function _cancel(bytes32 subscriptionId) internal {
        Subscription storage s = subscriptions[subscriptionId];
        require(!s.cancelled, "Already cancelled");
        s.cancelled = true;
        s.active = false;
        emit SubscriptionCancelled(subscriptionId);
    }

    // ---------------------------------------------------------------
    // Charge + admin (unchanged)
    // ---------------------------------------------------------------

    /// @notice Relayer charges a subscription for a specific billing period.
    /// @param amount Relayer-computed charge (fixed plan amount or usage-based);
    ///   capped by maxChargePerCycle and the remaining cumulativeCap.
    function charge(bytes32 subscriptionId, uint256 periodId, uint256 amount)
        external
        onlyRole(CHARGER_ROLE)
        whenNotPaused
        nonReentrant
    {
        Subscription storage s = subscriptions[subscriptionId];
        require(s.payer != address(0), "No such subscription");
        require(!s.cancelled, "Cancelled");
        require(s.active, "Not active");
        require(block.timestamp >= s.nextDueTime, "Not due");
        require(block.timestamp <= s.expiry, "Expired");
        require(!chargedPeriods[subscriptionId][periodId], "Period already charged");
        require(amount > 0, "Zero amount");
        require(amount <= s.maxChargePerCycle, "Exceeds per-cycle cap");
        require(s.totalSpent + amount <= s.cumulativeCap, "Exceeds cumulative cap");

        chargedPeriods[subscriptionId][periodId] = true;
        s.totalSpent += amount;
        s.nextDueTime += s.intervalSeconds;

        token.safeTransferFrom(s.payer, s.merchant, amount);

        emit SubscriptionCharged(subscriptionId, periodId, amount, s.totalSpent, s.nextDueTime);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Convenience view returning the full subscription record.
    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) {
        return subscriptions[subscriptionId];
    }

    /// @notice Remaining authorized cumulative spend for a subscription.
    function remainingCumulative(bytes32 subscriptionId) external view returns (uint256) {
        Subscription storage s = subscriptions[subscriptionId];
        return s.cumulativeCap > s.totalSpent ? s.cumulativeCap - s.totalSpent : 0;
    }

    /// @dev EIP-712 domain separator — returned for off-chain signing verification.
    function domainSeparatorV4() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
