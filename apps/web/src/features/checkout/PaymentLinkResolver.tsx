import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/services/api/http";
import { fmtAmount } from "@/lib/money";
import { Button, Card, Field, Input } from "@/components/ui";
import { CheckoutFrame } from "./CheckoutFrame";

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

  if (status === "loading" || status === "creating") {
    return (
      <CheckoutFrame>
        <Card className="flex items-center justify-center gap-3 p-10 text-[18px] text-ink-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          Preparing checkout…
        </Card>
      </CheckoutFrame>
    );
  }

  if (status === "failed") {
    return (
      <CheckoutFrame>
        <Card className="p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertCircle className="h-5 w-5" />
          </div>
          <p className="text-[18px] font-semibold text-ink">Payment link unavailable</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{error}</p>
        </Card>
      </CheckoutFrame>
    );
  }

  if (!link || link.linkType === "fixed") return null;

  // Customer-entered amount for customer_amount links.
  return (
    <CheckoutFrame>
      <Card className="overflow-hidden shadow-md">
        <div className="border-b border-line px-6 py-5">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">{link.merchant.displayName}</h1>
          <p className="mt-0.5 text-[16px] font-medium text-ink-2">{link.title}</p>
          {link.description ? <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{link.description}</p> : null}
        </div>
        <div className="space-y-4 px-6 py-5">
          <Field
            label={`Amount (${link.token.symbol})`}
            hint={
              link.minAmount && link.maxAmount
                ? `Between ${fmtAmount(link.minAmount)} and ${fmtAmount(link.maxAmount)} ${link.token.symbol}`
                : link.minAmount
                  ? `Minimum ${fmtAmount(link.minAmount)} ${link.token.symbol}`
                  : undefined
            }
          >
            <Input
              type="text"
              inputMode="decimal"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={link.minAmount ? `Min ${fmtAmount(link.minAmount)}` : "0.00"}
              className="h-12 text-[26px] font-semibold tnum"
              aria-label="Payment amount"
            />
          </Field>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => startCheckout(customAmount)}
            disabled={!customAmount}
          >
            Continue to payment
          </Button>
        </div>
      </Card>
    </CheckoutFrame>
  );
}
