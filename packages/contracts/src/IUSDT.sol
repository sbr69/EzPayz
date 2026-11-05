// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice ERC-20 + EIP-3009 interface for the required test USDT (TetherTokenV2,
/// implementation 0x2642...026F7, source-verified on Whitechain Sepolia).
///
/// This is a REFERENCE interface for the backend/relayer (see docs/EIP3009_VERIFICATION.md).
/// The SubscriptionContract itself only uses IERC20 (transferFrom) via OpenZeppelin;
/// EIP-3009 (transferWithAuthorization) is exercised by the one-time gasless flow
/// (PLAN Phase 4), not by the subscription contract.
interface IUSDT {
    // ----- ERC-20 -----
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);

    // ----- EIP-712 / EIP-2612 -----
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function nonces(address owner) external view returns (uint256);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external;

    // ----- EIP-3009 (Transfer With Authorization) -----
    function authorizationState(address authorizer, bytes32 nonce) external view returns (uint8);
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    function cancelAuthorization(address authorizer, bytes32 nonce, bytes calldata signature) external;
}
