import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useSendTransaction } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { apiFetch } from "@/services/api/http";

const CHAIN_ID = 1874;
const EXPLORER = "https://explorer.testnet.whitechain.io";

type SubCheckoutData = {
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
};

const INTERVAL_LABEL: Record<string, string> = { hourly: "per hour", daily: "per day", monthly: "per month" };

/**
 * Real subscription checkout — uses the live gateway API + wagmi/RainbowKit.
 * Flow: fetch plan → approve allowance → createSubscription on-chain → mirror to gateway.
 * PRD §11.4.1, FLOW §10.2.1. The customer pays WBT gas for approve + createSubscription.
 */
export function RealSubscriptionCheckout() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { address, chainId } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [checkout, setCheckout] = useState<SubCheckoutData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "approving" | "subscribing" | "recording" | "succeeded" | "failed">("loading");
  const [error, setError] = useState("");
  const [approvalTx, setApprovalTx] = useState<string | null>(null);
  const [activationTx, setActivationTx] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<SubCheckoutData>(`/v1/checkout/subscription/${slug}`);
        setCheckout(data);
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("failed");
      }
    })();
  }, [slug]);

  const handleApprove = async () => {
    if (!checkout || !address) return;
    setStatus("approving");
    setError("");
    try {
      // Step 1: approve the SubscriptionContract as a spender (ERC-20 approve).
      // approve(address spender, uint256 amount) = selector 0x095ea7b3 + address + uint256
      const approveData =
        "0x095ea7b3" +
        checkout.subscriptionContract.slice(2).toLowerCase().padStart(64, "0") +
        BigInt(checkout.plan.cumulativeLimit).toString(16).padStart(64, "0");

      const approveTx = await sendTransactionAsync({
        to: checkout.token.address as `0x${string}`,
        data: approveData as `0x${string}`,
      });
      setApprovalTx(approveTx);

      // Step 2: createSubscription on the SubscriptionContract.
      setStatus("subscribing");
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = checkout.plan.interval === "hourly" ? 3600 : checkout.plan.interval === "daily" ? 86400 : 2592000;
      const nextDue = now + intervalSec;
      const expiry = now + (checkout.plan.planExpiryMonths ?? 12) * 2592000;
      const subId = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");

      // createSubscription(bytes32,address,uint256,uint256,uint256,uint256,uint256,uint256) selector = 0x9d1c02f1
      const createData =
        "0x9d1c02f1" +
        subId.slice(2).padStart(64, "0") +
        checkout.merchant.payoutWallet.slice(2).toLowerCase().padStart(64, "0") +
        BigInt(checkout.plan.amount).toString(16).padStart(64, "0") +
        BigInt(intervalSec).toString(16).padStart(64, "0") +
        BigInt(checkout.plan.maxChargePerCycle).toString(16).padStart(64, "0") +
        BigInt(checkout.plan.cumulativeLimit).toString(16).padStart(64, "0") +
        BigInt(nextDue).toString(16).padStart(64, "0") +
        BigInt(expiry).toString(16).padStart(64, "0");

      const createTx = await sendTransactionAsync({
        to: checkout.subscriptionContract as `0x${string}`,
        data: createData as `0x${string}`,
      });
      setActivationTx(createTx);

      // Step 3: mirror the subscription to the gateway.
      setStatus("recording");
      await apiFetch(`/v1/subscriptions`, {
        method: "POST",
        body: JSON.stringify({
          onChainSubscriptionId: subId,
          planId: checkout.plan.id,
          payerWallet: address,
        }),
      });
      setStatus("succeeded");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading subscription plan…</div>;
  if (status === "failed") return <div style={{ padding: "2rem", color: "red" }}>Error: {error}</div>;
  if (!checkout) return <div>No subscription checkout</div>;

  const wrongNetwork = chainId !== undefined && chainId !== CHAIN_ID;

  if (status === "succeeded") {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24 }}>✓</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Subscription activated</h2>
          <p style={{ color: "#666", fontSize: 14, margin: "4px 0 0" }}>{checkout.merchant.displayName} · {checkout.plan.name}</p>
        </div>
        <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Amount per cycle</p>
          <p style={{ fontSize: 24, fontWeight: 600, margin: "4px 0 0" }}>{checkout.plan.displayAmount} {checkout.token.symbol}</p>
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>{INTERVAL_LABEL[checkout.plan.interval]}</p>
        </div>
        {approvalTx && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Allowance approval tx</p>
            <a href={`${EXPLORER}/tx/${approvalTx}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#0ea5e9", wordBreak: "break-all" }}>{approvalTx.slice(0, 20)}…</a>
          </div>
        )}
        {activationTx && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Subscription activation tx</p>
            <a href={`${EXPLORER}/tx/${activationTx}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#0ea5e9", wordBreak: "break-all" }}>{activationTx.slice(0, 20)}…</a>
          </div>
        )}
        <p style={{ fontSize: 11, color: "#999", marginTop: 12, textAlign: "center" }}>
          Renewals are gasless — the gateway relayer pays WBT gas for each cycle.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{checkout.merchant.displayName}</h2>
        <p style={{ color: "#666", fontSize: 14 }}>{checkout.plan.name}</p>
        {checkout.plan.description && <p style={{ color: "#999", fontSize: 13, margin: "4px 0 0" }}>{checkout.plan.description}</p>}
      </div>
      <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Amount per cycle</p>
        <p style={{ fontSize: 28, fontWeight: 600, margin: "4px 0 0" }}>{checkout.plan.displayAmount} {checkout.token.symbol}</p>
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>{INTERVAL_LABEL[checkout.plan.interval]}</p>
      </div>
      <div style={{ marginBottom: 16, fontSize: 13, color: "#666" }}>
        <p style={{ margin: 0 }}>Max charge per cycle: <strong>{checkout.plan.displayMaxChargePerCycle} {checkout.token.symbol}</strong></p>
        <p style={{ margin: "4px 0 0" }}>Cumulative limit: <strong>{checkout.plan.displayCumulativeLimit} {checkout.token.symbol}</strong></p>
        {checkout.plan.planExpiryMonths && <p style={{ margin: "4px 0 0" }}>Plan expires in {checkout.plan.planExpiryMonths} months</p>}
      </div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666" }}>Merchant payout: {checkout.merchant.payoutWallet.slice(0, 10)}…{checkout.merchant.payoutWallet.slice(-4)}</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <ConnectButton />
      </div>
      {address && (
        <>
          {wrongNetwork && <p style={{ color: "orange", fontSize: 13, marginBottom: 12 }}>Wrong network — switch to Whitechain Sepolia (chain 1874).</p>}
          <button
            onClick={handleApprove}
            disabled={status === "approving" || status === "subscribing" || status === "recording" || wrongNetwork}
            style={{ width: "100%", padding: "12px", fontSize: 15, cursor: "pointer", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff", opacity: wrongNetwork ? 0.5 : 1 }}
          >
            {status === "approving" ? "Approving allowance… (confirm in wallet)" :
             status === "subscribing" ? "Creating subscription… (confirm in wallet)" :
             status === "recording" ? "Recording subscription…" :
             `Approve ${checkout.plan.displayCumulativeLimit} USDT & subscribe`}
          </button>
        </>
      )}
      <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 12 }}>
        You pay WBT gas for the initial approval + subscription creation. Renewals are gasless (relayer-sponsored).
      </p>
      <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
        To cancel: call cancel() on the subscription contract. To revoke unused allowance: call approve(contract, 0).
      </p>
    </div>
  );
}
