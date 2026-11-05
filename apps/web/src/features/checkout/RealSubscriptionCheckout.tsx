import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAccount, useSignTypedData, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertCircle, ArrowUpRight, Loader2, Repeat, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/services/api/http";
import { DEFAULT_NETWORK } from "@/config/app";
import { Button, Callout, Card, Divider } from "@/components/ui";
import { DrawnCheck, EASE_OUT_QUART } from "@/components/ui/motion";
import { CheckoutFrame } from "./CheckoutFrame";


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
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const [checkout, setCheckout] = useState<SubCheckoutData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signing-permit" | "signing-sub" | "submitting" | "succeeded" | "failed">("loading");
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
    if (!checkout || !address || !publicClient) return;
    setError("");
    try {
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = checkout.plan.interval === "hourly" ? 3600 : checkout.plan.interval === "daily" ? 86400 : 2592000;
      const nextDue = now + intervalSec;
      const expiry = now + (checkout.plan.planExpiryMonths ?? 12) * 2592000;
      const subId = ("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
      const deadline = String(now + 600); // 10 min deadline for signatures

      // Step 1: Read the USDT nonce for the Permit (EIP-2612).
      setStatus("signing-permit");
      const usdtNonce = await publicClient.readContract({
        address: checkout.token.address as `0x${string}`,
        abi: [{ inputs: [{ type: "address" }], name: "nonces", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: "nonces",
        args: [address as `0x${string}`],
      }) as bigint;

      // Step 2: Customer signs the Permit (EIP-2612) — gasless allowance setup.
      const permitSignature = await signTypedDataAsync({
        domain: { name: "Tether USD", version: "1", chainId: DEFAULT_NETWORK.chainId, verifyingContract: checkout.token.address as `0x${string}` },
        types: { Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ]},
        primaryType: "Permit",
        message: {
          owner: address as `0x${string}`,
          spender: checkout.subscriptionContract as `0x${string}`,
          value: BigInt(checkout.plan.cumulativeLimit),
          nonce: usdtNonce,
          deadline: BigInt(deadline),
        },
      });

      // Step 3: Read the SubscriptionContract nonce for createSubscriptionBySig.
      setStatus("signing-sub");
      const subNonce = await publicClient.readContract({
        address: checkout.subscriptionContract as `0x${string}`,
        abi: [{ inputs: [{ type: "address" }], name: "nonces", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: "nonces",
        args: [address as `0x${string}`],
      }) as bigint;

      // Step 4: Customer signs createSubscriptionBySig — gasless subscription creation.
      const createSubSignature = await signTypedDataAsync({
        domain: { name: "SubscriptionContract", version: "1", chainId: DEFAULT_NETWORK.chainId, verifyingContract: checkout.subscriptionContract as `0x${string}` },
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
          subscriptionId: subId as `0x${string}`,
          payer: address as `0x${string}`,
          merchant: checkout.merchant.payoutWallet as `0x${string}`,
          amount: BigInt(checkout.plan.amount),
          intervalSeconds: BigInt(intervalSec),
          maxChargePerCycle: BigInt(checkout.plan.maxChargePerCycle),
          cumulativeCap: BigInt(checkout.plan.cumulativeLimit),
          nextDueTime: BigInt(nextDue),
          expiry: BigInt(expiry),
          nonce: subNonce,
          deadline: BigInt(deadline),
        },
      });

      // Step 5: Submit both signatures to the gateway — relayer submits the transactions.
      setStatus("submitting");
      await apiFetch<{ status: string }>(`/v1/checkout/subscription/${slug}/activate-by-sig`, {
        method: "POST",
        body: JSON.stringify({
          payerWallet: address,
          subscriptionId: subId,
          permitSignature,
          permitDeadline: deadline,
          permitNonce: String(usdtNonce),
          createSubSignature,
          createSubDeadline: deadline,
          createSubNonce: String(subNonce),
        }),
      });

      setApprovalTx(null); // relayer submits — tx hashes come via webhook later
      setActivationTx(null);
      setStatus("succeeded");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  if (status === "loading") {
    return (
      <CheckoutFrame>
        <Card className="flex items-center justify-center gap-3 p-10 text-[18px] text-ink-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Loading subscription plan…
        </Card>
      </CheckoutFrame>
    );
  }

  if (status === "failed" && !checkout) {
    return (
      <CheckoutFrame>
        <Card className="p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-[18px] font-semibold text-ink">Subscription unavailable</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{error}</p>
        </Card>
      </CheckoutFrame>
    );
  }

  if (!checkout) {
    return (
      <CheckoutFrame>
        <Card className="p-6 text-center text-[18px] text-ink-3 shadow-sm">No subscription checkout</Card>
      </CheckoutFrame>
    );
  }

  const wrongNetwork = chainId !== undefined && chainId !== DEFAULT_NETWORK.chainId;
  const busy = status === "signing-permit" || status === "signing-sub" || status === "submitting";
  const stepIndex =
    status === "submitting" ? 3 : status === "signing-sub" ? 2 : busy ? 1 : 0;

  if (status === "succeeded") {
    return (
      <CheckoutFrame badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-line bg-positive-soft px-2.5 py-1 text-[13px] font-semibold text-positive">
          <ShieldCheck className="h-3 w-3" />
          Active
        </span>
      }>
        <Card className="overflow-hidden shadow-md">
          <div className="flex flex-col items-center border-b border-line bg-gradient-to-b from-positive-soft/60 to-transparent px-6 pb-6 pt-8 text-center">
            <DrawnCheck size={64} className="text-positive" />
            <h1 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-ink">Subscription activated</h1>
            <p className="mt-0.5 text-[16px] text-ink-3">
              {checkout.merchant.displayName} · {checkout.plan.name}
            </p>
          </div>
          <div className="px-6 py-5">
            <p className="text-[14px] font-medium uppercase tracking-wider text-ink-4">Amount per cycle</p>
            <p className="mt-1 text-[41px] font-bold tracking-[-0.02em] text-ink tnum">
              {checkout.plan.displayAmount}{" "}
              <span className="text-[22px] font-semibold text-ink-3">{checkout.token.symbol}</span>
            </p>
            <p className="mt-1 text-[16px] text-ink-3">{INTERVAL_LABEL[checkout.plan.interval]}</p>

            <div className="mt-4 space-y-2">
              {[
                { label: "Allowance approval", tx: approvalTx },
                { label: "Subscription activation", tx: activationTx },
              ].map(
                (row, i) =>
                  row.tx ? (
                    <motion.div
                      key={row.label}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + i * 0.15, duration: 0.35, ease: EASE_OUT_QUART }}
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-canvas px-3.5 py-2.5"
                    >
                      <span className="text-[14px] text-ink-3">{row.label}</span>
                      <a
                        href={`${DEFAULT_NETWORK.explorerUrl ?? "https://explorer.testnet.whitechain.io"}/tx/${row.tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 font-mono text-[14px] font-medium text-accent hover:underline"
                      >
                        {row.tx.slice(0, 10)}… <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </motion.div>
                  ) : null,
              )}
            </div>
          </div>
          <div className="border-t border-line bg-canvas px-6 py-3 text-center">
            <p className="text-[13px] text-ink-4">
              Renewals are gasless — the gateway relayer pays WBT gas for each cycle.
            </p>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame badge={
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">
        <Repeat className="h-3 w-3" />
        Subscription
      </span>
    }>
      <Card className="overflow-hidden shadow-md">
        <div className="border-b border-line px-6 py-5">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{checkout.merchant.displayName}</h1>
          <p className="mt-0.5 text-[16px] font-medium text-ink-2">{checkout.plan.name}</p>
          {checkout.plan.description ? (
            <p className="mt-0.5 text-[16px] leading-relaxed text-ink-3">{checkout.plan.description}</p>
          ) : null}
        </div>

        <div className="bg-gradient-to-b from-accent-soft/50 to-transparent px-6 py-5">
          <p className="text-[14px] font-medium uppercase tracking-wider text-ink-4">Amount per cycle</p>
          <p className="mt-1 text-[41px] font-bold leading-none tracking-[-0.02em] text-ink tnum">
            {checkout.plan.displayAmount}{" "}
            <span className="text-[22px] font-semibold text-ink-3">{checkout.token.symbol}</span>
          </p>
          <p className="mt-1 text-[16px] text-ink-3">{INTERVAL_LABEL[checkout.plan.interval]}</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1 border-b border-line px-6 py-3">
          {["Approve", "Activate", "Record", "Done"].map((s, i) => (
            <div key={s} className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="h-1 overflow-hidden rounded-full bg-canvas-alt">
                <motion.div
                  initial={false}
                  animate={{ width: i < stepIndex ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: EASE_OUT_QUART }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
              <span className={`truncate text-[12px] font-medium ${i < stepIndex ? "text-accent" : "text-ink-4"}`}>
                {s}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <div className="flex items-center justify-between gap-3 py-1 text-[16px]">
              <span className="text-ink-3">Max charge per cycle</span>
              <span className="font-medium text-ink tnum">
                {checkout.plan.displayMaxChargePerCycle} {checkout.token.symbol}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1 text-[16px]">
              <span className="text-ink-3">Cumulative limit</span>
              <span className="font-medium text-ink tnum">
                {checkout.plan.displayCumulativeLimit} {checkout.token.symbol}
              </span>
            </div>
            {checkout.plan.planExpiryMonths ? (
              <div className="flex items-center justify-between gap-3 py-1 text-[16px]">
                <span className="text-ink-3">Plan expiry</span>
                <span className="font-medium text-ink tnum">{checkout.plan.planExpiryMonths} months</span>
              </div>
            ) : null}
          </div>

          <Divider />

          <div className="flex items-center justify-between gap-3 text-[16px]">
            <span className="text-ink-3">Merchant payout</span>
            <code className="font-mono text-ink-2">
              {checkout.merchant.payoutWallet.slice(0, 10)}…{checkout.merchant.payoutWallet.slice(-4)}
            </code>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-[16px] text-ink-3">Wallet</span>
            <ConnectButton />
          </div>

          {address && wrongNetwork ? (
            <Callout tone="warn" title="Wrong network">
              Switch to Whitechain Sepolia (chain {DEFAULT_NETWORK.chainId}) to continue.
            </Callout>
          ) : null}

          {status === "failed" && error ? (
            <Callout tone="danger" title="Subscription failed">
              {error}
            </Callout>
          ) : null}

          {address ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleApprove}
              disabled={busy || wrongNetwork}
              loading={status === "signing-permit"}
              icon={status === "signing-sub" || status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {status === "signing-permit"
                ? "Approving allowance… (confirm in wallet)"
                : status === "signing-sub"
                  ? "Creating subscription… (confirm in wallet)"
                  : status === "submitting"
                    ? "Recording subscription…"
                    : `Approve ${checkout.plan.displayCumulativeLimit} ${checkout.token.symbol} & subscribe`}
            </Button>
          ) : null}

          <Callout tone="warn" title="Gas notice">
            You pay WBT gas for the initial approval + subscription creation. Renewals are gasless
            (relayer-sponsored).
          </Callout>

          <p className="text-center text-[13px] leading-relaxed text-ink-4">
            To cancel: call <code className="font-mono">cancel()</code> on the subscription contract. To
            revoke unused allowance: call <code className="font-mono">approve(contract, 0)</code>.
          </p>
        </div>
      </Card>
    </CheckoutFrame>
  );
}
