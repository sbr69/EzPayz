import { privateKeyToAccount } from "viem/accounts";

/**
 * x402 client — drop-in replacement for fetch() that handles HTTP 402 Payment Required.
 *
 * When the server responds with 402, the client:
 * 1. Reads the payment requirements from the X-PAYMENT-REQUIREMENTS header
 * 2. Signs an EIP-3009 TransferWithAuthorization (gasless — no transaction submitted)
 * 3. Retries the request with the X-PAYMENT header containing the signed authorization
 * 4. The EzPayz facilitator verifies + settles via the relayer
 *
 * Usage:
 *   import { x402Fetch } from "@ezpayz/sdk";
 *   const res = await x402Fetch("https://api.example.com/data", {
 *     privateKey: "0x...",
 *   });
 *   const data = await res.json();
 *
 * The AI agent's wallet signs the authorization (no WBT gas needed).
 * The EzPayz relayer submits the on-chain transaction.
 */

const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const CHAIN_ID = 1874;

interface X402Requirements {
  scheme: string;
  network: string;
  payTo: string;
  maxAmountRequired: string;
  asset: string;
  description?: string;
  mimeType?: string;
}

/**
 * Drop-in fetch replacement that automatically handles x402 Payment Required responses.
 *
 * @param url The URL to fetch
 * @param opts Options including the AI agent's private key
 * @returns The response from the server (after payment if required)
 */
export async function x402Fetch(
  url: string,
  opts: { privateKey: string; method?: string; headers?: Record<string, string>; body?: string },
): Promise<Response> {
  const pk = opts.privateKey.startsWith("0x") ? opts.privateKey : "0x" + opts.privateKey;
  const account = privateKeyToAccount(pk as `0x${string}`);

  // Initial request
  let res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.headers,
    body: opts.body,
  });

  // If not 402, return as-is
  if (res.status !== 402) return res;

  // Parse payment requirements
  const requirementsHeader = res.headers.get("x-payment-requirements");
  if (!requirementsHeader) return res;

  const requirements: X402Requirements = JSON.parse(requirementsHeader);

  // Only handle Whitechain USDT payments
  if (requirements.network !== `eip155:${CHAIN_ID}` || requirements.asset.toLowerCase() !== USDT.toLowerCase()) {
    return res;
  }

  // Sign EIP-3009 TransferWithAuthorization
  const now = Math.floor(Date.now() / 1000);
  const nonce = "0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");

  const signature = await account.signTypedData({
    domain: { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT as `0x${string}` },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: account.address as `0x${string}`,
      to: requirements.payTo as `0x${string}`,
      value: BigInt(requirements.maxAmountRequired),
      validAfter: BigInt(now - 60),
      validBefore: BigInt(now + 600),
      nonce: nonce as `0x${string}`,
    },
  });

  // Retry with payment proof
  const paymentPayload = {
    from: account.address,
    to: requirements.payTo,
    value: requirements.maxAmountRequired,
    validAfter: String(now - 60),
    validBefore: String(now + 600),
    nonce,
    signature,
  };

  res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.headers ?? {}),
      "X-PAYMENT": JSON.stringify(paymentPayload),
    },
    body: opts.body,
  });

  return res;
}
