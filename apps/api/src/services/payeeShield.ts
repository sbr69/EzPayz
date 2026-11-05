import { privateKeyToAccount } from "viem/accounts";
import { env } from "../config";

/**
 * PayeeShield: the gateway signs a canonical payment request so the checkout widget
 * can verify the displayed merchant/amount/token/chain/recipient/expiry haven't been
 * tampered with (PRD §13.2, FLOW §9). Single gateway signing key (hackathon); keyId
 * is included in the payload so checkouts can resolve the verifying public key.
 */

let account: ReturnType<typeof privateKeyToAccount> | null = null;

function getAccount(): ReturnType<typeof privateKeyToAccount> {
  const key = process.env.PAYEESHIELD_SIGNING_KEY;
  if (!key) {
    throw { statusCode: 500, code: "payeeshield_not_configured", message: "PAYEESHIELD_SIGNING_KEY not set" };
  }
  if (!account) {
    const pk = /^0[xX]/.test(key) ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`);
    account = privateKeyToAccount(pk);
  }
  return account;
}

const PAYEESHIELD_KEY_ID = process.env.PAYEESHIELD_KEY_ID || "gwk_default";

export interface PayeeShieldPayload {
  schema: "whitechain.payeeshield.v1";
  merchantId: string;
  paymentRequestId: string;
  merchant: { displayName: string; payoutWallet: string };
  chainId: number;
  token: { symbol: string; address: string; decimals: number };
  amount: string; // base units
  description: string;
  created: string; // ISO
  expiry: string; // ISO
  nonce: string;
  keyId: string;
}

export interface SignedPaymentRequest {
  payload: PayeeShieldPayload;
  signature: string;
  signingAddress: string;
  keyId: string;
}

export async function signPaymentRequest(req: {
  paymentIntentId: string;
  merchantId: string;
  merchantDisplayName: string;
  payoutWallet: string;
  amount: string;
  description: string;
  expiry: string;
  nonce: string;
}): Promise<SignedPaymentRequest> {
  const acc = getAccount();
  const payload: PayeeShieldPayload = {
    schema: "whitechain.payeeshield.v1",
    merchantId: req.merchantId,
    paymentRequestId: req.paymentIntentId,
    merchant: { displayName: req.merchantDisplayName, payoutWallet: req.payoutWallet },
    chainId: env.WHITECHAIN_CHAIN_ID,
    token: { symbol: "USDT", address: env.USDT_ADDRESS, decimals: 6 },
    amount: req.amount,
    description: req.description,
    created: new Date().toISOString(),
    expiry: req.expiry,
    nonce: req.nonce,
    keyId: PAYEESHIELD_KEY_ID,
  };

  // EIP-712 typed signature over the protected fields (the digest the checkout verifies).
  const domain = { name: "WhitechainPayeeShield", version: "1", chainId: env.WHITECHAIN_CHAIN_ID } as const;
  const types = {
    PaymentRequest: [
      { name: "paymentRequestId", type: "string" },
      { name: "merchantId", type: "string" },
      { name: "payoutWallet", type: "address" },
      { name: "amount", type: "string" },
      { name: "token", type: "address" },
      { name: "chainId", type: "uint256" },
      { name: "expiry", type: "string" },
      { name: "nonce", type: "string" },
    ],
  } as const;
  const message = {
    paymentRequestId: req.paymentIntentId,
    merchantId: req.merchantId,
    payoutWallet: req.payoutWallet as `0x${string}`,
    amount: req.amount,
    token: env.USDT_ADDRESS as `0x${string}`,
    chainId: BigInt(env.WHITECHAIN_CHAIN_ID),
    expiry: req.expiry,
    nonce: req.nonce,
  };
  const signature = await acc.signTypedData({ domain, types, primaryType: "PaymentRequest", message });

  return { payload, signature, signingAddress: acc.address, keyId: PAYEESHIELD_KEY_ID };
}
