import React, { useEffect, useState } from "react";
import { formatBaseUnits } from "./amount";

/**
 * <WhitechainSubscriptionCheckout/> — React widget for hosted subscription checkout on a merchant's site.
 *
 * FULLY GASLESS: The customer signs 2 EIP-712 messages (Permit + createSubscriptionBySig)
 * and submits 0 transactions. The relayer pays all WBT gas.
 *
 * The merchant's app provides:
 *   - signTypedData (from wagmi's useSignTypedData)
 *   - getNonce (reads `nonces(address)` from a contract — wraps viem's readContract)
 *
 * PRD §11.4.1, FLOW §10.2.1. Gasless subscription lifecycle via BySig + Permit.
 */
export interface WhitechainSubscriptionCheckoutProps {
  checkoutSlug: string;
  apiUrl: string;
  payerAddress: string;
  signTypedData: (args: {
    domain: Record<string, unknown>;
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<string>;
  /** Reads `nonces(address)` from a contract. The merchant implements this via viem's readContract. */
  getNonce: (contractAddress: string, ownerAddress: string) => Promise<string>;
  onSuccess?: (result: { subscriptionId: string }) => void;
  onError?: (error: Error) => void;
}

type SubWidgetStatus = "loading" | "ready" | "signing-permit" | "signing-sub" | "submitting" | "succeeded" | "failed";

interface SubCheckoutData {
  sessionId: string;
  plan: {
    id: string;
    name: string;
    description: string;
    displayAmount: string;
    amount: string;
    interval: string;
    displayMaxChargePerCycle: string;
    maxChargePerCycle: string;
    displayCumulativeLimit: string;
    cumulativeLimit: string;
    planExpiryMonths: number | null;
  };
  merchant: { displayName: string; payoutWallet: string };
  chainId: number;
  subscriptionContract: string;
  token: { symbol: string; address: string; decimals: number };
  status: string;
  expiresAt: string | null;
}

const INTERVAL_LABEL: Record<string, string> = { hourly: "per hour", daily: "per day", monthly: "per month" };

export function WhitechainSubscriptionCheckout(props: WhitechainSubscriptionCheckoutProps): React.ReactElement {
  const { checkoutSlug, apiUrl, payerAddress, signTypedData, getNonce, onSuccess, onError } = props;
  const [status, setStatus] = useState<SubWidgetStatus>("loading");
  const [checkout, setCheckout] = useState<SubCheckoutData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${apiUrl}/v1/checkout/subscription/${checkoutSlug}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Subscription checkout not found");
        setCheckout(data);
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("failed");
        onError?.(e as Error);
      }
    })();
  }, [checkoutSlug, apiUrl, onError]);

  if (status === "loading") return React.createElement("div", null, "Loading subscription plan…");
  if (status === "failed") return React.createElement("div", null, "Error: " + error);
  if (!checkout) return React.createElement("div", null, "No subscription checkout");

  const statusLabel: Record<SubWidgetStatus, string> = {
    loading: "Loading…",
    ready: `Subscribe (${checkout.plan.displayAmount} ${checkout.token.symbol})`,
    "signing-permit": "Sign permit in wallet…",
    "signing-sub": "Sign subscription in wallet…",
    submitting: "Submitting to relayer…",
    succeeded: "Subscription activated!",
    failed: "Failed",
  };

  return React.createElement("div", { style: { padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", fontFamily: "sans-serif" } },
    React.createElement("h3", null, checkout.merchant.displayName),
    React.createElement("h4", null, checkout.plan.name),
    checkout.plan.description && React.createElement("p", null, checkout.plan.description),
    React.createElement("hr"),
    React.createElement("p", null, `Amount: ${checkout.plan.displayAmount} ${checkout.token.symbol} / ${INTERVAL_LABEL[checkout.plan.interval] ?? checkout.plan.interval}`),
    React.createElement("p", null, `Max charge per cycle: ${checkout.plan.displayMaxChargePerCycle} ${checkout.token.symbol}`),
    React.createElement("p", null, `Cumulative limit: ${checkout.plan.displayCumulativeLimit} ${checkout.token.symbol}`),
    React.createElement("hr"),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#666" } },
      `Merchant payout: ${checkout.merchant.payoutWallet.slice(0, 10)}…`),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#22c55e" } },
      "Fully gasless: you sign 2 messages, submit 0 transactions. The relayer pays all gas."),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#666" } },
      `Payer: ${payerAddress.slice(0, 10)}…`),
    status === "ready" && React.createElement("button", {
      onClick: () => handleApprove(),
      style: { padding: "0.5rem 1rem", marginTop: "0.5rem", cursor: "pointer", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: "8px" },
    }, statusLabel[status]),
    status !== "ready" && React.createElement("p", null, statusLabel[status]),
    status === "succeeded" && React.createElement("p", { style: { fontSize: "0.8rem", color: "#999" } },
      "Renewals are automatic and gasless. You can cancel anytime by signing a cancelBySig message."),
  );

  async function handleApprove() {
    if (!checkout) return;
    setError("");
    try {
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = checkout.plan.interval === "hourly" ? 3600 : checkout.plan.interval === "daily" ? 86400 : 2592000;
      const nextDue = now + intervalSec;
      const expiry = now + (checkout.plan.planExpiryMonths ?? 12) * 2592000;
      const subId = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const deadline = String(now + 600); // 10 min

      // Step 1: Read USDT nonce + sign Permit (EIP-2612).
      setStatus("signing-permit");
      const usdtNonce = await getNonce(checkout.token.address, payerAddress);
      const permitSignature = await signTypedData({
        domain: { name: "Tether USD", version: "1", chainId: checkout.chainId, verifyingContract: checkout.token.address },
        types: { Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ]},
        primaryType: "Permit",
        message: {
          owner: payerAddress,
          spender: checkout.subscriptionContract,
          value: BigInt(checkout.plan.cumulativeLimit).toString(),
          nonce: usdtNonce,
          deadline,
        },
      });

      // Step 2: Read SubscriptionContract nonce + sign createSubscriptionBySig.
      setStatus("signing-sub");
      const subNonce = await getNonce(checkout.subscriptionContract, payerAddress);
      const createSubSignature = await signTypedData({
        domain: { name: "SubscriptionContract", version: "1", chainId: checkout.chainId, verifyingContract: checkout.subscriptionContract },
        types: { CreateSubscriptionBySig: [
          { name: "subscriptionId", type: "bytes32" },
          { name: "payer", type: "address" },
          { name: "merchant", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "intervalSeconds", type: "uint256" },
          { name: "maxChargePerCycle", type: "uint256" },
          { name: "cumulativeCap", type: "uint256" },
          { name: "nextDueTime", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ]},
        primaryType: "CreateSubscriptionBySig",
        message: {
          subscriptionId: subId,
          payer: payerAddress,
          merchant: checkout.merchant.payoutWallet,
          amount: checkout.plan.amount,
          intervalSeconds: String(intervalSec),
          maxChargePerCycle: checkout.plan.maxChargePerCycle,
          cumulativeCap: checkout.plan.cumulativeLimit,
          nextDueTime: String(nextDue),
          expiry: String(expiry),
          nonce: subNonce,
          deadline,
        },
      });

      // Step 3: Submit both signatures to the gateway — relayer submits the transactions.
      setStatus("submitting");
      const res = await fetch(`${apiUrl}/v1/checkout/subscription/${checkoutSlug}/activate-by-sig`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerWallet: payerAddress,
          subscriptionId: subId,
          permitSignature,
          permitDeadline: deadline,
          permitNonce: usdtNonce,
          createSubSignature,
          createSubDeadline: deadline,
          createSubNonce: subNonce,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed to activate subscription");
      setStatus("succeeded");
      onSuccess?.({ subscriptionId: subId });
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
      onError?.(e as Error);
    }
  }
}
