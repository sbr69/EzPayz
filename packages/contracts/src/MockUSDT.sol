// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/token/ERC20/ERC20.sol";

/// @dev Mintable ERC-20 (6 decimals) for anvil tests of SubscriptionContract.
/// NOT the real USDT. Includes a toggle to force transferFrom reverts so tests
/// can verify that a failed charge does not advance subscription state (PRD §11.5).
contract MockUSDT is ERC20 {
    bool public revertTransfers;

    constructor() ERC20("Mock USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setRevertTransfers(bool v) external {
        revertTransfers = v;
    }

    // OZ v5 ERC20._transfer is non-virtual; override the virtual _update instead.
    // Revert only on real transfers (from!=0 && to!=0) so mint/burn still work.
    function _update(address from, address to, uint256 value) internal override {
        if (revertTransfers && from != address(0) && to != address(0)) {
            revert("mock: transfer reverted");
        }
        super._update(from, to, value);
    }
}
