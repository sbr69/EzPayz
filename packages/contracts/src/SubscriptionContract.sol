// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/token/ERC20/utils/SafeERC20.sol";

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
contract SubscriptionContract is AccessControl, Pausable, ReentrancyGuard {
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

    constructor(address token_) {
        require(token_ != address(0), "Invalid token");
        token = IERC20(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

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
        require(subscriptions[subscriptionId].payer == address(0), "Subscription exists");
        require(merchant != address(0), "Invalid merchant");
        require(intervalSeconds > 0, "Invalid interval");
        require(maxChargePerCycle > 0, "Invalid maxChargePerCycle");
        require(cumulativeCap > 0, "Invalid cumulativeCap");
        require(expiry > block.timestamp, "Invalid expiry");
        require(nextDueTime > block.timestamp, "Invalid nextDueTime");
        subscriptions[subscriptionId] = Subscription({
            payer: msg.sender,
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
            msg.sender,
            merchant,
            amount,
            intervalSeconds,
            maxChargePerCycle,
            cumulativeCap,
            nextDueTime,
            expiry
        );
    }

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

        // checks-effects-interactions: commit accounting BEFORE the external token call.
        // A failed safeTransferFrom reverts the whole tx, rolling back these effects,
        // so a failed renewal does NOT advance the cycle or increase totalSpent.
        chargedPeriods[subscriptionId][periodId] = true;
        s.totalSpent += amount;
        s.nextDueTime += s.intervalSeconds;

        // Non-custodial: USDT moves directly payer -> merchant.
        token.safeTransferFrom(s.payer, s.merchant, amount);

        emit SubscriptionCharged(subscriptionId, periodId, amount, s.totalSpent, s.nextDueTime);
    }

    /// @notice Customer cancels their own subscription. Blocks all future charges immediately.
    function cancel(bytes32 subscriptionId) external {
        Subscription storage s = subscriptions[subscriptionId];
        require(s.payer == msg.sender, "Not payer");
        require(!s.cancelled, "Already cancelled");
        s.cancelled = true;
        s.active = false;
        emit SubscriptionCancelled(subscriptionId);
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
}
