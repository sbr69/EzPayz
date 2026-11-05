// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionContract} from "../src/SubscriptionContract.sol";
import {MockUSDT} from "../src/MockUSDT.sol";

contract SubscriptionContractTest is Test {
    MockUSDT token;
    SubscriptionContract sub;
    address payer = address(0xA1);
    address merchant = address(0xB1);
    address relayer = address(0xC1);
    address other = address(0xD1);
    bytes32 subId = keccak256("sub-1");
    uint256 interval = 3600; // hourly
    uint256 maxPerCycle = 10e6; // 10 USDT
    uint256 cumulativeCap = 100e6; // 100 USDT

    function setUp() public {
        token = new MockUSDT();
        sub = new SubscriptionContract(address(token));
        sub.grantRole(sub.CHARGER_ROLE(), relayer);
        token.mint(payer, 1000e6);
    }

    function _create() internal {
        vm.prank(payer);
        sub.createSubscription(
            subId, merchant, 1e6, interval, maxPerCycle, cumulativeCap, block.timestamp + 3600, block.timestamp + 30 days
        );
    }

    function _approve(uint256 amount) internal {
        vm.prank(payer);
        token.approve(address(sub), amount);
    }

    /* ----------------- creation ----------------- */

    function testCreateSubscription() public {
        _create();
        SubscriptionContract.Subscription memory s = sub.getSubscription(subId);
        assertEq(s.payer, payer);
        assertEq(s.merchant, merchant);
        assertEq(s.amount, 1e6);
        assertEq(s.intervalSeconds, interval);
        assertEq(s.maxChargePerCycle, maxPerCycle);
        assertEq(s.cumulativeCap, cumulativeCap);
        assertTrue(s.active);
        assertFalse(s.cancelled);
    }

    function testCreateRevertsOnDuplicate() public {
        _create();
        vm.prank(payer);
        vm.expectRevert("Subscription exists");
        sub.createSubscription(
            subId, merchant, 1e6, interval, maxPerCycle, cumulativeCap, block.timestamp + 3600, block.timestamp + 30 days
        );
    }

    /* ----------------- charge: success ----------------- */

    function testChargeSuccess() public {
        _create();
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        sub.charge(subId, 1, 1e6);
        assertEq(token.balanceOf(merchant), 1e6);
        assertEq(token.balanceOf(payer), 999e6);
        assertTrue(sub.chargedPeriods(subId, 1));
        SubscriptionContract.Subscription memory s = sub.getSubscription(subId);
        assertEq(s.totalSpent, 1e6);
        assertEq(s.nextDueTime, block.timestamp + interval); // advanced
    }

    /* ----------------- charge: reverts ----------------- */

    function testChargeRevertsNotDue() public {
        _create();
        _approve(cumulativeCap);
        vm.prank(relayer);
        vm.expectRevert("Not due");
        sub.charge(subId, 1, 1e6);
    }

    function testChargeRevertsExpired() public {
        _create();
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 31 days);
        vm.prank(relayer);
        vm.expectRevert("Expired");
        sub.charge(subId, 1, 1e6);
    }

    function testChargeRevertsOverCycleCap() public {
        _create();
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        vm.expectRevert("Exceeds per-cycle cap");
        sub.charge(subId, 1, maxPerCycle + 1);
    }

    function testChargeRevertsOverCumulativeCap() public {
        bytes32 id = keccak256("sub-cap");
        vm.prank(payer);
        sub.createSubscription(
            id, merchant, 5e6, interval, 10e6, 10e6, block.timestamp + 3600, block.timestamp + 30 days
        );
        _approve(1000e6);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        sub.charge(id, 1, 5e6); // totalSpent = 5
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        vm.expectRevert("Exceeds cumulative cap");
        sub.charge(id, 2, 6e6); // 5 + 6 = 11 > 10
    }

    function testChargeRevertsPeriodAlreadyCharged() public {
        _create();
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        sub.charge(subId, 1, 1e6);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        vm.expectRevert("Period already charged");
        sub.charge(subId, 1, 1e6);
    }

    function testChargeRevertsUnauthorizedCaller() public {
        _create();
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 3600);
        vm.prank(other);
        vm.expectRevert();
        sub.charge(subId, 1, 1e6);
    }

    function testCancelBlocksFutureCharge() public {
        _create();
        vm.prank(payer);
        sub.cancel(subId);
        _approve(cumulativeCap);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        vm.expectRevert("Cancelled");
        sub.charge(subId, 1, 1e6);
    }

    function testCancelOnlyByPayer() public {
        _create();
        vm.prank(other);
        vm.expectRevert("Not payer");
        sub.cancel(subId);
    }

    function testPauseBlocksCharge() public {
        _create();
        _approve(cumulativeCap);
        sub.pause();
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        // OZ v5 Pausable reverts with the EnforcedPause() custom error (not a string); match any revert.
        vm.expectRevert();
        sub.charge(subId, 1, 1e6);
        // unpause resumes
        sub.unpause();
        vm.prank(relayer);
        sub.charge(subId, 1, 1e6);
        assertTrue(sub.chargedPeriods(subId, 1));
    }

    /* ----------------- failed transfer must not advance state ----------------- */

    function testChargeWithFailingTransferKeepsState() public {
        _create();
        _approve(cumulativeCap);
        uint256 nextDueBefore = sub.getSubscription(subId).nextDueTime;
        token.setRevertTransfers(true);
        vm.warp(block.timestamp + 3600);
        vm.prank(relayer);
        vm.expectRevert("mock: transfer reverted");
        sub.charge(subId, 1, 1e6);

        SubscriptionContract.Subscription memory s = sub.getSubscription(subId);
        assertEq(s.totalSpent, 0, "totalSpent must not increase on failed transfer");
        assertEq(s.nextDueTime, nextDueBefore, "nextDueTime must not advance on failed transfer");
        assertFalse(sub.chargedPeriods(subId, 1), "period must not be marked charged on failed transfer");
        assertEq(token.balanceOf(payer), 1000e6, "payer balance unchanged");
        assertEq(token.balanceOf(merchant), 0, "merchant received nothing");
    }
}
