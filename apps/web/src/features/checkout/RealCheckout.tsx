import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useSignTypedData } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { apiFetch, API_URL } from "@/services/api/http";
import { fmtAmount } from "@/lib/money";

const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const CHAIN_ID = 1874;
const EXPLORER = "https://explorer.testnet.whitechain.io";

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
      for (let i = 0; i < 30; i++) {
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

  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading checkout…</div>;
  if (status === "failed") return (
    <div style={{ padding: "2rem", maxWidth: 480, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <div style={{ color: "red", marginBottom: 12 }}>Error: {error}</div>
      {checkout?.cancelUrl && (
        <a href={checkout.cancelUrl}>
          <button style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "#fff" }}>
            Back to merchant
          </button>
        </a>
      )}
    </div>
  );
  if (!checkout) return <div>No checkout</div>;

  const wrongNetwork = chainId !== CHAIN_ID;

  // Success page
  if (status === "succeeded") {
    return (
      <div style={{ maxWidth: 480, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24 }}>✓</div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Payment succeeded</h2>
          <p style={{ color: "#666", fontSize: 14, margin: "4px 0 0" }}>{checkout.merchant.displayName}</p>
        </div>
        <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Amount paid</p>
          <p style={{ fontSize: 24, fontWeight: 600, margin: "4px 0 0" }}>{displayAmt} {checkout.token.symbol}</p>
          <p style={{ fontSize: 12, color: "#666", margin: "8px 0 0" }}>{checkout.description}</p>
        </div>
        {txRef && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Transaction</p>
            <a href={`${EXPLORER}/tx/${txRef}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#0ea5e9", wordBreak: "break-all" }}>
              {txRef.slice(0, 20)}…{txRef.slice(-8)} →
            </a>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {checkout.successUrl && (
            <a href={`${checkout.successUrl}${checkout.successUrl.includes("?") ? "&" : "?"}paymentIntentId=${checkout.paymentIntentId}&status=succeeded`} style={{ flex: 1 }}>
              <button style={{ width: "100%", padding: "10px", fontSize: 14, cursor: "pointer", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff" }}>
                Return to merchant
              </button>
            </a>
          )}
          <a href={`${API_URL}/v1/payment-intents/${checkout.paymentIntentId}/receipt.pdf`} target="_blank" rel="noreferrer">
            <button style={{ padding: "10px 16px", fontSize: 14, cursor: "pointer", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
              Download receipt
            </button>
          </a>
        </div>
        <p style={{ fontSize: 11, color: "#999", marginTop: 12, textAlign: "center" }}>
          Gasless payment — the gateway relayer paid WBT gas. You only signed the authorization.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{checkout.merchant.displayName}</h2>
        <p style={{ color: "#666", fontSize: 14 }}>{checkout.description}</p>
      </div>
      <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Amount due</p>
        <p style={{ fontSize: 28, fontWeight: 600, margin: "4px 0 0" }}>
          {displayAmt} {checkout.token.symbol}
        </p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666" }}>Recipient: {checkout.merchant.payoutWallet.slice(0, 10)}…{checkout.merchant.payoutWallet.slice(-4)}</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <ConnectButton />
      </div>
      {address && (
        <>
          {wrongNetwork && <p style={{ color: "orange", fontSize: 13 }}>Wrong network — switch to Whitechain Sepolia (chain 1874).</p>}
          <button
            onClick={handlePay}
            disabled={status === "signing" || status === "submitted" || wrongNetwork}
            style={{ width: "100%", padding: "12px", fontSize: 15, cursor: "pointer", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff" }}
          >
            {status === "signing" ? "Sign in wallet…" : status === "submitted" ? "Confirming on-chain…" : `Pay ${displayAmt} USDT (gasless)`}
          </button>
        </>
      )}
      {status === "submitted" && <p style={{ color: "#0ea5e9", marginTop: 12, fontSize: 13 }}>Confirming on Whitechain Sepolia… this usually takes a few seconds.</p>}
      <p style={{ fontSize: 11, color: "#999", marginTop: 12 }}>Gasless: the gateway relayer pays WBT gas. You only sign the authorization.</p>
    </div>
  );
}
