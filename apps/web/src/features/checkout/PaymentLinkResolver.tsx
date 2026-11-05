import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/services/api/http";
import { fmtAmount } from "@/lib/money";

type LinkData = {
  id: string;
  title: string;
  description: string;
  linkType: "fixed" | "customer_amount" | "reusable";
  amount: string | null;
  displayAmount: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  merchant: { displayName: string; payoutWallet: string };
  token: { symbol: string; decimals: number };
  chainId: number;
};

/**
 * Payment link resolver — fetches the link details via the public API, then either:
 * - For "fixed" links: creates a checkout session + redirects to /real-checkout/:slug
 * - For "customer_amount" links: shows an amount input, then creates a checkout session on submit
 *
 * Replaces the mock Checkout component for /l/:slug. PRD §9, FLOW §6.3.
 */
export function PaymentLinkResolver() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "creating" | "failed">("loading");
  const [error, setError] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  // Fetch the payment link + auto-start checkout for fixed links (all in one useEffect to avoid Rules of Hooks violations).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<LinkData>(`/v1/payment-links/${slug}`);
        if (cancelled) return;
        setLink(data);

        // Fixed links: auto-create checkout session immediately.
        if (data.linkType === "fixed") {
          setStatus("creating");
          const result = await apiFetch<{ checkoutSlug: string }>(`/v1/payment-links/${slug}/checkout`, {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (cancelled) return;
          navigate(`/real-checkout/${result.checkoutSlug}`);
        } else {
          setStatus("ready");
        }
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setStatus("failed");
      }
    })();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  const startCheckout = async (amount?: string) => {
    setStatus("creating");
    try {
      const result = await apiFetch<{ checkoutSlug: string }>(`/v1/payment-links/${slug}/checkout`, {
        method: "POST",
        body: JSON.stringify(amount ? { amount } : {}),
      });
      navigate(`/real-checkout/${result.checkoutSlug}`);
    } catch (e) {
      setError((e as Error).message);
      setStatus("failed");
    }
  };

  if (status === "loading" || status === "creating") return <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>Preparing checkout…</div>;
  if (status === "failed") return <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif", color: "red" }}>{error}</div>;
  if (!link || link.linkType === "fixed") return null;

  // Customer-entered amount for customer_amount links.
  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "1.5rem", border: "1px solid #ddd", borderRadius: 12, fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 8px" }}>{link.merchant.displayName}</h2>
      <p style={{ color: "#666", fontSize: 14, margin: "0 0 16px" }}>{link.title}</p>
      {link.description && <p style={{ color: "#999", fontSize: 13, margin: "0 0 16px" }}>{link.description}</p>}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Amount (USDT)</label>
        <input
          type="text"
          inputMode="decimal"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder={link.minAmount ? `Min ${fmtAmount(link.minAmount)}` : "0.00"}
          style={{ width: "100%", padding: "10px", fontSize: 16, borderRadius: 8, border: "1px solid #ddd", boxSizing: "border-box" }}
        />
        {link.minAmount && link.maxAmount && (
          <p style={{ fontSize: 12, color: "#999", margin: "4px 0 0" }}>
            Between {fmtAmount(link.minAmount)} and {fmtAmount(link.maxAmount)} USDT
          </p>
        )}
      </div>
      <button
        onClick={() => startCheckout(customAmount)}
        disabled={!customAmount}
        style={{ width: "100%", padding: "12px", fontSize: 15, cursor: "pointer", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff", opacity: !customAmount ? 0.5 : 1 }}
      >
        Pay
      </button>
    </div>
  );
}
