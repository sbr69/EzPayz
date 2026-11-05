// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SubscriptionContract} from "../src/SubscriptionContract.sol";

/// @notice Deploys SubscriptionContract with the required test USDT as the allowlisted token.
/// The deployer (broadcast sender) becomes DEFAULT_ADMIN_ROLE and should later grant
/// CHARGER_ROLE to the gateway relayer (PLAN Phase 5) and optionally transfer admin
/// to a dedicated gateway-owner key.
contract Deploy is Script {
    function run() external returns (SubscriptionContract sub) {
        address token = vm.envAddress("USDT_ADDRESS");
        require(token != address(0), "USDT_ADDRESS not set");
        vm.startBroadcast();
        sub = new SubscriptionContract(token);
        vm.stopBroadcast();
        console.log("SubscriptionContract deployed at:", address(sub));
        console.log("Token (USDT):", token);
        console.log("Admin (deployer):", msg.sender);
    }
}
