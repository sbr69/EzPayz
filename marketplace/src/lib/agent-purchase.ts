import { USDT_ADDRESS, WHITECHAIN_NETWORK } from "@ezpayz/x402";

export const buyerPaymentPath = "/api/x402/shop";
export const paymentDomain = { name: "Tether USD", version: "1", chainId: 1874, verifyingContract: USDT_ADDRESS } as const;
export const paymentTypes = { TransferWithAuthorization: [
  { name: "from", type: "address" }, { name: "to", type: "address" },
  { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
] } as const;

export type BuyerQuote = {
  id: string;
  item: string;
  amount: number;
  scheme: "exact";
  network: typeof WHITECHAIN_NETWORK;
  asset: typeof USDT_ADDRESS;
  payTo: `0x${string}`;
  nonce: `0x${string}`;
  validAfter: number;
  validBefore: number;
};

export function matchesBuyerOffer(quote: BuyerQuote, offer: Record<string, unknown>) {
  return quote.scheme === "exact" && quote.network === WHITECHAIN_NETWORK &&
    quote.asset === USDT_ADDRESS && Number.isSafeInteger(quote.amount) && quote.amount > 0 &&
    offer.scheme === quote.scheme && offer.network === quote.network && offer.asset === quote.asset &&
    offer.payTo === quote.payTo && offer.maxAmountRequired === String(quote.amount) &&
    offer.resource === buyerPaymentPath;
}

export function paymentMessage(quote: BuyerQuote, from: `0x${string}`) {
  return { from, to: quote.payTo, value: BigInt(quote.amount), validAfter: BigInt(quote.validAfter),
    validBefore: BigInt(quote.validBefore), nonce: quote.nonce };
}

export function shopOriginAllowed(request: Request, configured: string | null, browsing: boolean) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (configured && origin === configured) return true;
  if (request.headers.get("sec-fetch-site") !== "same-origin") return false;
  if (browsing) return true;
  const loopback = (value: string | null) => {
    const url = value && URL.parse(value);
    return Boolean(url && ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  };
  return loopback(configured) && loopback(origin) && loopback(new URL(request.url).origin);
}

export function walletErrorCode(error: unknown) {
  let current = error;
  let code: number | undefined;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
    if ("code" in current && typeof current.code === "number") {
      if ([4001, -32002, 4902].includes(current.code)) return current.code;
      code ??= current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return code;
}

export function walletErrorMessage(error: unknown, stage: "connect" | "network" | "balance" | "sign") {
  const code = walletErrorCode(error);
  if (code === 4001) return stage === "sign" ? "Signature cancelled. No payment was submitted." : "Wallet request cancelled. Try again when you’re ready.";
  if (code === -32002) return "Open your wallet and finish the pending request.";
  if (stage === "network") return "Switch your wallet to Whitechain Sepolia (chain 1874), then try again.";
  if (stage === "balance") return "Couldn’t read the test USDT balance. Try again shortly.";
  if (stage === "sign") return "Your wallet couldn’t sign the authorization. Check your account and try again.";
  return "Couldn’t connect your wallet. Unlock the extension and try again.";
}
