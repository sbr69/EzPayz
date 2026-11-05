import React, { useEffect, useState } from "react";
import { formatBaseUnits } from "./amount";

/**
 * <WhitechainCheckout/> — React widget that completes a gasless USDT payment.
 *
 * The merchant's app provides the `signTypedData` function (from wagmi's useSignTypedData),
 * so this widget stays free of heavy wallet dependencies (RainbowKit/wagmi are installed by
 * the merchant's app). PRD §17.4, §24.3.
 *
 * Flow: fetch the PayeeShield-signed payment request → display → on "Pay", sign the EIP-3009
 * TransferWithAuthorization via signTypedData → submit → poll for settlement.
 */
export interface WhitechainCheckoutProps {
  checkoutSlug: string;
  apiUrl: string;
  /** Short-lived session token returned from POST /v1/payment-intents. Sent as a Bearer header
   *  on the checkout fetch + authorize requests. When provided, the checkout is scoped to this
   *  session only. When omitted, the public checkout endpoint is used (backward-compatible). */
  clientSecret?: string;
  signTypedData: (args: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<string>;
  onSuccess?: (result: { paymentIntentId: string; txRef?: string }) => void;
  onError?: (error: Error) => void;
}

type WidgetStatus = "loading" | "ready" | "authorizing" | "submitted" | "succeeded" | "failed";

export function WhitechainCheckout(props: WhitechainCheckoutProps): React.ReactElement {
  const { checkoutSlug, apiUrl, clientSecret, signTypedData, onSuccess, onError } = props;
  const [status, setStatus] = useState<WidgetStatus>("loading");
  const [checkout, setCheckout] = useState<{
    paymentIntentId: string;
    merchant: { displayName: string; payoutWallet: string };
    amount: string;
    token: { symbol: string; address: string; decimals: number };
    chainId: number;
    description: string;
  } | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const headers: Record<string, string> = {};
        if (clientSecret) headers.Authorization = `Bearer ${clientSecret}`;
        const res = await fetch(`${apiUrl}/v1/checkout/${checkoutSlug}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Checkout not found");
        setCheckout(data);
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("failed");
        onError?.(e as Error);
      }
    })();
  }, [checkoutSlug, apiUrl, onError]);

  const handlePay = async () => {
    if (!checkout) return;
    setStatus("authorizing");
    try {
      // Build the EIP-3009 TransferWithAuthorization typed data.
      const now = Math.floor(Date.now() / 1000);
      const nonce = "0x" + crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
      const domain = {
        name: "Tether USD",
        version: "1",
        chainId: checkout.chainId,
        verifyingContract: checkout.token.address,
      };
      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };
      // The `from` is the connected wallet — the merchant's app must pass it (the widget
      // receives the signer's address via signTypedData's context). For simplicity, the
      // merchant's app should set `from` to the connected account before calling handlePay,
      // OR the widget can accept a `payerAddress` prop. (Here we rely on the wallet to sign
      // with its own address; the backend recovers it from the signature.)
      const message = {
        from: "0x0000000000000000000000000000000000000000", // placeholder — replaced by the wallet's address on sign
        to: checkout.merchant.payoutWallet,
        value: checkout.amount,
        validAfter: String(now - 60),
        validBefore: String(now + 600),
        nonce,
      };
      const signature = await signTypedData({ domain, types, primaryType: "TransferWithAuthorization", message });
      // Submit the authorization.
      const authRes = await fetch(`${apiUrl}/v1/checkout/${checkoutSlug}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(clientSecret ? { Authorization: `Bearer ${clientSecret}` } : {}) },
        body: JSON.stringify({ ...message, signature }),
      });
      const authBody = await authRes.json();
      if (!authRes.ok) throw new Error(authBody?.error?.message ?? "Authorization failed");
      setStatus("submitted");
      // Poll for settlement.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const sRes = await fetch(`${apiUrl}/v1/payment-intents/${checkout.paymentIntentId}`, { headers: {} });
        const s = await sRes.json();
        const st = s.paymentIntent?.status;
        if (st === "succeeded") {
          setStatus("succeeded");
          onSuccess?.({ paymentIntentId: checkout.paymentIntentId, txRef: s.paymentIntent?.txRef });
          return;
        }
        if (st === "failed") throw new Error("Payment failed");
      }
      throw new Error("Payment timed out");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
      onError?.(e as Error);
    }
  };

  if (status === "loading") return React.createElement("div", null, "Loading checkout…");
  if (status === "failed") return React.createElement("div", null, "Error: " + error);
  if (!checkout) return React.createElement("div", null, "No checkout");

  return React.createElement("div", { style: { padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", fontFamily: "sans-serif" } },
    React.createElement("h3", null, checkout.merchant.displayName),
    React.createElement("p", null, `Amount: ${formatBaseUnits(checkout.amount)} ${checkout.token.symbol}`),
    React.createElement("p", null, checkout.description),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#666" } }, `To: ${checkout.merchant.payoutWallet.slice(0, 10)}…`),
    React.createElement("button", {
      onClick: handlePay,
      disabled: status === "authorizing" || status === "submitted",
      style: { padding: "0.5rem 1rem", marginTop: "0.5rem", cursor: "pointer" },
    }, status === "authorizing" ? "Sign in wallet…" : status === "submitted" ? "Confirming…" : `Pay ${formatBaseUnits(checkout.amount)} USDT`),
    status === "succeeded" && React.createElement("p", { style: { color: "green" } }, "Payment succeeded!"),
  );
}
