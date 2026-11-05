// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionContract} from "../src/SubscriptionContract.sol";
import {MockUSDT} from "../src/MockUSDT.sol";

/// @dev Fuzz/invariant-style tests for the spending + idempotency invariants (PRD §11.5).
contract InvariantsTest is Test {
    MockUSDT token;
    SubscriptionContract sub;
    address payer = address(0xA1);
    address merchant = address(0xB1);
    address relayer = address(0xC1);
    bytes32 subId = keccak256("inv");
    uint256 cumulativeCap = 100e6; // 100 USDT
    uint256 maxPerCycle = 10e6; // 10 USDT

    function setUp() public {
        token = new MockUSDT();
        sub = new SubscriptionContract(address(token));
        sub.grantRole(sub.CHARGER_ROLE(), relayer);
        token.mint(payer, 1e18);
        vm.prank(payer);
        token.approve(address(sub), type(uint256).max);
        vm.prank(payer);
        sub.createSubscription(
            subId, merchant, 1e6, 3600, maxPerCycle, cumulativeCap, block.timestamp + 3600, block.timestamp + 365 days
        );
    }

    /// Fuzz: arbitrary relayer charges never breach the cumulative cap.
    function testFuzzChargeRespectsCumulativeCap(uint256 periodId, uint256 amount) public {
        vm.assume(amount > 0 && amount <= maxPerCycle);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        try sub.charge(subId, periodId, amount) {
            // successful charge; invariant checked below after the attempt
        } catch {
            // rejected charges (over cap / duplicate period / etc.) are fine
        }
        SubscriptionContract.Subscription memory s = sub.getSubscription(subId);
        assertLe(s.totalSpent, cumulativeCap, "cumulative cap breached after attempt");
    }

    /// Fuzz: a billing period can never be charged more than once.
    function testFuzzPeriodChargedAtMostOnce(uint256 periodId) public {
        vm.warp(block.timestamp + 3600); // reach first due time
        vm.prank(relayer);
        try sub.charge(subId, periodId, 1e6) {} catch {}
        if (sub.chargedPeriods(subId, periodId)) {
            // Advance to the new nextDueTime so the "Not due" check does not fire
            // before the "Period already charged" check on the second attempt.
            vm.warp(block.timestamp + 3600);
            vm.prank(relayer);
            vm.expectRevert("Period already charged");
            sub.charge(subId, periodId, 1e6);
        }
    }
}
