import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAccount, useSignTypedData } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertCircle, ArrowUpRight, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { apiFetch, API_URL } from "@/services/api/http";
import { fmtAmount } from "@/lib/money";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { Button, Callout, Card } from "@/components/ui";
import { DrawnCheck, EASE_OUT_QUART } from "@/components/ui/motion";
import { CheckoutFrame } from "./CheckoutFrame";

const USDT = TOKEN.contract as `0x${string}`;
const CHAIN_ID = DEFAULT_NETWORK.chainId;
const EXPLORER = DEFAULT_NETWORK.explorerUrl ?? "https://explorer.testnet.whitechain.io";

type CheckoutData = {
  paymentIntentId: string;
  merchant: { displayName: string; payoutWallet: string };
  amount: string;
  displayAmount?: string;
  token: { symbol: string; address: string; decimals: number };
  chainId: number;
  description: string;
  payeeShield: unknown;
  status: string;
  successUrl?: string;
  cancelUrl?: string;
};

const STEPS = ["Details", "Connect wallet", "Sign authorization", "Confirming"] as const;

/**
 * Real checkout — uses the live gateway API + wagmi/RainbowKit for wallet signing.
 * Sign EIP-3009 TransferWithAuthorization → submit → poll for settlement.
 * On success: shows tx hash + explorer link + downloadable invoice + return URL redirect.
 */
export function RealCheckout() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signing" | "submitted" | "succeeded" | "failed">("loading");
  const [error, setError] = useState("");
  const [txRef, setTxRef] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<CheckoutData>(`/v1/checkout/${slug}`);
        setCheckout(data);
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("failed");
      }
    })();
  }, [slug]);

  const handlePay = async () => {
    if (!checkout || !address) return;
    setStatus("signing");
    try {
      const now = Math.floor(Date.now() / 1000);
      const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("") as `0x${string}`;
      const signature = await signTypedDataAsync({
        domain: { name: "Tether USD", version: "1", chainId: CHAIN_ID, verifyingContract: USDT },
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
          from: address as `0x${string}`,
          to: checkout.merchant.payoutWallet as `0x${string}`,
          value: BigInt(checkout.amount),
          validAfter: BigInt(now - 60),
          validBefore: BigInt(now + 600),
          nonce,
        },
      });

      await apiFetch(`/v1/checkout/${slug}/authorize`, {
        method: "POST",
        body: JSON.stringify({ from: address, to: checkout.merchant.payoutWallet, value: checkout.amount, validAfter: String(now - 60), validBefore: String(now + 600), nonce, signature }),
      });
      setStatus("submitted");

      // Poll for settlement — use the PUBLIC checkout endpoint (no auth required).
      // GET /v1/payment-intents/:id requires authentication; the payer doesn't have the merchant's key.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await apiFetch<{ status: string; txRef?: string }>(`/v1/checkout/${slug}`);
        if (s.status === "succeeded") {
          setTxRef(s.txRef ?? null);
          setStatus("succeeded");
          return;
        }
        if (s.status === "failed") throw new Error("Payment failed on-chain");
      }
      throw new Error("Payment timed out");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  const displayAmt = checkout?.displayAmount ?? (checkout ? fmtAmount(checkout.amount) : "");

  if (status === "loading") {
    return (
      <CheckoutFrame>
        <Card className="flex items-center justify-center gap-3 p-10 text-[18px] text-ink-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Loading checkout…
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
          <p className="text-[18px] font-semibold text-ink">Checkout unavailable</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{error}</p>
        </Card>
      </CheckoutFrame>
    );
  }

  if (!checkout) {
    return (
      <CheckoutFrame>
        <Card className="p-6 text-center text-[18px] text-ink-3 shadow-sm">No checkout</Card>
      </CheckoutFrame>
    );
  }

  const wrongNetwork = chainId !== CHAIN_ID;
  const busy = status === "signing" || status === "submitted";
  const stepIndex = !address ? 1 : busy ? 3 : 2;

  // Success page
  if (status === "succeeded") {
    return (
      <CheckoutFrame badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-line bg-positive-soft px-2.5 py-1 text-[13px] font-semibold text-positive">
          <ShieldCheck className="h-3 w-3" />
          Paid
        </span>
      }>
        <Card className="overflow-hidden shadow-md">
          <div className="flex flex-col items-center border-b border-line bg-gradient-to-b from-positive-soft/60 to-transparent px-6 pb-6 pt-8 text-center">
            <DrawnCheck size={64} className="text-positive" />
            <h1 className="mt-3 text-[26px] font-bold tracking-[-0.02em] text-ink">Payment succeeded</h1>
            <p className="mt-0.5 text-[16px] text-ink-3">{checkout.merchant.displayName}</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-[14px] font-medium uppercase tracking-wider text-ink-4">Amount paid</p>
            <p className="mt-1 text-[41px] font-bold tracking-[-0.02em] text-ink tnum">
              {displayAmt} <span className="text-[22px] font-semibold text-ink-3">{checkout.token.symbol}</span>
            </p>
            <p className="mt-1 text-[16px] text-ink-3">{checkout.description}</p>

            {txRef ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.35, ease: EASE_OUT_QUART }}
                className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-line bg-canvas px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium uppercase tracking-wider text-ink-4">Transaction</p>
                  <code className="block truncate font-mono text-[14px] text-ink-2">
                    {txRef.slice(0, 20)}…{txRef.slice(-8)}
                  </code>
                </div>
                <a
                  href={`${EXPLORER}/tx/${txRef}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[16px] font-medium text-accent hover:underline"
                >
                  Explorer <ArrowUpRight className="h-3 w-3" />
                </a>
              </motion.div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {checkout.successUrl ? (
                <a
                  className="min-w-0 flex-1"
                  href={`${checkout.successUrl}${checkout.successUrl.includes("?") ? "&" : "?"}paymentIntentId=${checkout.paymentIntentId}&status=succeeded`}
                >
                  <Button variant="primary" size="lg" className="w-full" iconRight={<ArrowUpRight className="h-4 w-4" />}>
                    Return to merchant
                  </Button>
                </a>
              ) : null}
              <a href={`${API_URL}/v1/checkout/${slug}/receipt.pdf`} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="lg" icon={<Receipt className="h-4 w-4" />}>
                  Receipt
                </Button>
              </a>
            </div>
          </div>
          <div className="border-t border-line bg-canvas px-6 py-3 text-center">
            <p className="text-[13px] text-ink-4">
              Gasless payment — the gateway relayer paid WBT gas. You only signed the authorization.
            </p>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame>
      <Card className="overflow-hidden shadow-md">
        <div className="border-b border-line px-6 py-5">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{checkout.merchant.displayName}</h1>
          <p className="mt-0.5 text-[16px] text-ink-3">{checkout.description}</p>
        </div>

        <div className="bg-gradient-to-b from-accent-soft/50 to-transparent px-6 py-5">
          <p className="text-[14px] font-medium uppercase tracking-wider text-ink-4">Amount due</p>
          <p className="mt-1 text-[41px] font-bold leading-none tracking-[-0.02em] text-ink tnum">
            {displayAmt} <span className="text-[22px] font-semibold text-ink-3">{checkout.token.symbol}</span>
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-1 border-b border-line px-6 py-3">
          {STEPS.map((s, i) => (
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
          <div className="flex items-center justify-between gap-3 text-[16px]">
            <span className="text-ink-3">Recipient</span>
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
              Switch to Whitechain Sepolia (chain {CHAIN_ID}) to continue.
            </Callout>
          ) : null}

          {status === "failed" && error ? (
            <Callout tone="danger" title="Payment failed">
              {error}
            </Callout>
          ) : null}

          {address ? (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handlePay}
              disabled={busy || wrongNetwork}
              loading={status === "signing"}
              icon={status === "submitted" ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
            >
              {status === "signing"
                ? "Sign in wallet…"
                : status === "submitted"
                  ? "Confirming on-chain…"
                  : `Pay ${displayAmt} ${checkout.token.symbol} (gasless)`}
            </Button>
          ) : null}

          {status === "submitted" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="anim-pulse-soft text-center text-[14px] font-medium text-info"
            >
              Confirming on Whitechain Sepolia… this usually takes a few seconds.
            </motion.p>
          ) : null}

          <p className="flex items-start justify-center gap-1.5 text-center text-[13px] leading-relaxed text-ink-4">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-positive" />
            Gasless: the gateway relayer pays WBT gas. You only sign the authorization.
          </p>

          {checkout.cancelUrl ? (
            <div className="text-center">
              <a href={checkout.cancelUrl} className="text-[14px] text-ink-4 underline-offset-2 hover:text-ink-2 hover:underline">
                Cancel and return to merchant
              </a>
            </div>
          ) : null}
        </div>
      </Card>
    </CheckoutFrame>
  );
}
