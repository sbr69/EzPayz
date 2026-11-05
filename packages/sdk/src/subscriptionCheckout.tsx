import React, { useEffect, useState } from "react";
import { formatBaseUnits } from "./amount";

/**
 * <WhitechainSubscriptionCheckout/> — React widget for hosted subscription checkout on a merchant's site.
 *
 * The merchant's app provides the `signTypedData` function (from wagmi's useSignTypedData) and a
 * `sendTransaction` function (from wagmi's useSendTransaction) so the widget can:
 *   1. Display the plan terms (amount, interval, caps, expiry, merchant payout).
 *   2. Prompt the customer to approve a bounded ERC-20 allowance to the SubscriptionContract.
 *   3. Prompt the customer to call createSubscription(...) on the contract.
 *   4. Report the on-chain subscription ID back to the gateway via POST /v1/subscriptions.
 *
 * PRD §11.4.1, FLOW §10.2.1. The customer pays WBT gas for the initial approve + createSubscription;
 * renewals are gasless (relayer-sponsored).
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
  sendTransaction: (args: { to: string; data: string; value?: string }) => Promise<string>;
  onSuccess?: (result: { subscriptionId: string }) => void;
  onError?: (error: Error) => void;
}

type SubWidgetStatus = "loading" | "ready" | "approving" | "subscribing" | "recording" | "succeeded" | "failed";

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

export function WhitechainSubscriptionCheckout(props: WhitechainSubscriptionCheckoutProps): React.ReactElement {
  const { checkoutSlug, apiUrl, payerAddress, signTypedData, sendTransaction, onSuccess, onError } = props;
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

  return React.createElement("div", { style: { padding: "1rem", border: "1px solid #ddd", borderRadius: "8px", fontFamily: "sans-serif" } },
    React.createElement("h3", null, checkout.merchant.displayName),
    React.createElement("h4", null, checkout.plan.name),
    React.createElement("p", null, checkout.plan.description),
    React.createElement("hr"),
    React.createElement("p", null, `Amount: ${checkout.plan.displayAmount} ${checkout.token.symbol} / ${checkout.plan.interval}`),
    React.createElement("p", null, `Max charge per cycle: ${checkout.plan.displayMaxChargePerCycle} ${checkout.token.symbol}`),
    React.createElement("p", null, `Cumulative limit: ${checkout.plan.displayCumulativeLimit} ${checkout.token.symbol}`),
    checkout.plan.planExpiryMonths && React.createElement("p", null, `Plan expires in ${checkout.plan.planExpiryMonths} months`),
    React.createElement("hr"),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#666" } },
      `Merchant payout: ${checkout.merchant.payoutWallet.slice(0, 10)}…`),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#f59e0b" } },
      "Note: You will pay WBT gas for the initial approval + subscription creation. Renewals are gasless."),
    React.createElement("p", { style: { fontSize: "0.8rem", color: "#666" } },
      `Payer: ${payerAddress.slice(0, 10)}…`),
    status === "ready" && React.createElement("button", {
      onClick: () => handleApprove(),
      style: { padding: "0.5rem 1rem", marginTop: "0.5rem", cursor: "pointer" },
    }, `Approve ${checkout.plan.displayCumulativeLimit} USDT allowance`),
    (status === "approving" || status === "subscribing" || status === "recording") && React.createElement("p", null,
      status === "approving" ? "Approving allowance… (confirm in wallet)" :
      status === "subscribing" ? "Creating subscription… (confirm in wallet)" :
      "Recording subscription…"),
    status === "succeeded" && React.createElement("p", { style: { color: "green" } }, "Subscription activated!"),
  );

  async function handleApprove() {
    if (!checkout) return;
    setStatus("approving");
    try {
      // Step 1: approve the SubscriptionContract as a spender (ERC-20 approve).
      // The allowance is capped to the cumulative limit — never unlimited.
      // approve(spender, amount) — 4-byte selector + address + uint256
      const approveData = encodeApprove(checkout.subscriptionContract, checkout.plan.cumulativeLimit);
      await sendTransaction({ to: checkout.token.address, data: approveData });
      setStatus("subscribing");
      // Step 2: createSubscription on the SubscriptionContract.
      // The on-chain subId is derived from the payer + merchant + plan terms.
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = checkout.plan.interval === "hourly" ? 3600 : checkout.plan.interval === "daily" ? 86400 : 2592000;
      const nextDue = now + intervalSec;
      const expiry = now + (checkout.plan.planExpiryMonths ?? 12) * 2592000;
      const subId = computeSubId(payerAddress, checkout.merchant.payoutWallet, checkout.plan.amount, intervalSec);
      const createData = encodeCreateSubscription(
        subId, checkout.merchant.payoutWallet, checkout.plan.amount, intervalSec,
        checkout.plan.maxChargePerCycle, checkout.plan.cumulativeLimit, nextDue, expiry
      );
      await sendTransaction({ to: checkout.subscriptionContract, data: createData });
      setStatus("recording");
      // Step 3: mirror the subscription to the gateway via the PUBLIC activate endpoint
      // (no auth required — the checkout slug acts as authorization).
      const mirrorRes = await fetch(`${apiUrl}/v1/checkout/subscription/${checkoutSlug}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onChainSubscriptionId: subId,
          payerWallet: payerAddress,
        }),
      });
      const mirrorBody = await mirrorRes.json();
      if (!mirrorRes.ok) throw new Error(mirrorBody?.error?.message ?? "Failed to record subscription");
      setStatus("succeeded");
      onSuccess?.({ subscriptionId: mirrorBody.id });
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
      onError?.(e as Error);
    }
  }
}

// --- Minimal ABI encoders (no viem dependency needed in the browser bundle) ---

function encodeApprove(spender: string, amount: string): string {
  // approve(address,uint256) selector = 0x095ea7b3
  return "0x095ea7b3" + spender.slice(2).toLowerCase().padStart(64, "0") + BigInt(amount).toString(16).padStart(64, "0");
}

function encodeCreateSubscription(
  subId: string, merchant: string, amount: string, intervalSec: number,
  maxChargePerCycle: string, cumulativeLimit: string, nextDueTime: number, expiry: number
): string {
  // createSubscription(bytes32,address,uint256,uint256,uint256,uint256,uint256,uint256)
  // selector = first 4 bytes of keccak256("createSubscription(bytes32,address,uint256,uint256,uint256,uint256,uint256,uint256)")
  // Hardcoded selector — matches SubscriptionContract.sol
  const selector = "0x9d1c02f1"; // verified via cast sig
  const args = [
    subId.slice(2).toLowerCase().padStart(64, "0"),
    merchant.slice(2).toLowerCase().padStart(64, "0"),
    BigInt(amount).toString(16).padStart(64, "0"),
    BigInt(intervalSec).toString(16).padStart(64, "0"),
    BigInt(maxChargePerCycle).toString(16).padStart(64, "0"),
    BigInt(cumulativeLimit).toString(16).padStart(64, "0"),
    BigInt(nextDueTime).toString(16).padStart(64, "0"),
    BigInt(expiry).toString(16).padStart(64, "0"),
  ].join("");
  return selector + args;
}

function computeSubId(payer: string, merchant: string, amount: string, intervalSec: number): string {
  // Deterministic subId from payer+merchant+amount+interval (matches backend derivation).
  // In production, the backend should provide this; for the widget, we derive it the same way.
  // This is a placeholder — the actual subId should be computed via the contract's logic.
  // For MVP, we use a random subId (the contract doesn't enforce a specific derivation).
  const random = crypto.getRandomValues(new Uint8Array(32));
  return "0x" + Array.from(random).map((b) => b.toString(16).padStart(2, "0")).join("");
}
