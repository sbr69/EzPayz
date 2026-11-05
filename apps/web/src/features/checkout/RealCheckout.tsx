import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAccount, useSignTypedData } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { apiFetch } from "@/services/api/http";

const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";
const CHAIN_ID = 1874;

type CheckoutData = {
  paymentIntentId: string;
  merchant: { displayName: string; payoutWallet: string };
  amount: string;
  token: { symbol: string; address: string; decimals: number };
  chainId: number;
  description: string;
  payeeShield: unknown;
  status: string;
};

/**
 * Real checkout — uses the live gateway API + wagmi/RainbowKit for wallet signing.
 * Sign EIP-3009 TransferWithAuthorization → submit → poll for settlement.
 */
export function RealCheckout() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signing" | "submitted" | "succeeded" | "failed">("loading");
  const [error, setError] = useState("");

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
      const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
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

      // Poll for settlement.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await apiFetch<{ paymentIntent: { status: string; txRef?: string } }>(`/v1/payment-intents/${checkout.paymentIntentId}`);
        if (s.paymentIntent?.status === "succeeded") {
          setStatus("succeeded");
          return;
        }
        if (s.paymentIntent?.status === "failed") throw new Error("Payment failed on-chain");
      }
      throw new Error("Payment timed out");
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading checkout…</div>;
  if (status === "failed") return <div style={{ padding: "2rem", color: "red" }}>Error: {error}</div>;
  if (!checkout) return <div>No checkout</div>;

  const wrongNetwork = chainId !== CHAIN_ID;

  return (
    <div style={{ maxWidth: 480, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{checkout.merchant.displayName}</h2>
        <p style={{ color: "#666", fontSize: 14 }}>{checkout.description}</p>
      </div>
      <div style={{ padding: 16, background: "#f5f5f5", borderRadius: 8, marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>Amount due</p>
        <p style={{ fontSize: 28, fontWeight: 600, margin: "4px 0 0" }}>
          {(Number(checkout.amount) / 1e6).toFixed(2)} {checkout.token.symbol}
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
            {status === "signing" ? "Sign in wallet…" : status === "submitted" ? "Confirming on-chain…" : `Pay ${(Number(checkout.amount) / 1e6).toFixed(2)} USDT (gasless)`}
          </button>
        </>
      )}
      {status === "succeeded" && <p style={{ color: "green", marginTop: 12 }}>Payment succeeded! Check the explorer for the on-chain tx.</p>}
      <p style={{ fontSize: 11, color: "#999", marginTop: 12 }}>Gasless: the gateway relayer pays WBT gas. You only sign the authorization.</p>
    </div>
  );
}
