import { useEffect } from "react";
import { useDemo } from "@/store/demoStore";
import { apiFetch } from "@/services/api/http";

/**
 * useSyncRealData — fetches real merchant data from the gateway API and populates
 * the Zustand demo store so all dashboard pages display real data instead of seed data.
 *
 * Called once on mount (in AppShell). Only syncs if the user is signed in (has a JWT).
 * Failed fetches are silently ignored — the store retains its current data.
 */
export function useSyncRealData() {
  const signedIn = useDemo((s) => s.signedIn);
  const replaceData = useDemo((s) => s.replaceData);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    async function sync() {
      try {
        // Fetch merchant profile.
        const merchantRes = await apiFetch<{ merchant: Record<string, unknown> }>("/v1/merchants/me");
        if (cancelled) return;

        // Fetch all list data in parallel.
        const [paymentsRes, refundsRes, subscriptionsRes, exceptionsRes, invoicesRes, plansRes, linksRes, webhooksRes, fulfilmentRes] = await Promise.allSettled([
          apiFetch<{ paymentIntents: unknown[] }>("/v1/payment-intents?limit=100"),
          apiFetch<{ refunds: unknown[] }>("/v1/refunds?limit=100"),
          apiFetch<{ subscriptions: unknown[] }>("/v1/subscriptions?limit=100"),
          apiFetch<{ exceptions: unknown[] }>("/v1/exceptions?limit=100"),
          apiFetch<{ invoices: unknown[] }>("/v1/invoices?limit=100"),
          apiFetch<{ plans: unknown[] }>("/v1/plans?limit=100"),
          apiFetch<{ paymentLinks: unknown[] }>("/v1/payment-links?limit=100"),
          apiFetch<{ endpoints: unknown[] }>("/v1/webhooks?limit=100"),
          apiFetch<{ orders: unknown[] }>("/v1/fulfilment?limit=100"),
        ]);

        if (cancelled) return;

        const data: Record<string, unknown> = {
          merchant: merchantRes.merchant,
        };

        if (paymentsRes.status === "fulfilled") data.payments = paymentsRes.value.paymentIntents ?? [];
        if (refundsRes.status === "fulfilled") data.refunds = refundsRes.value.refunds ?? [];
        if (subscriptionsRes.status === "fulfilled") data.subscriptions = subscriptionsRes.value.subscriptions ?? [];
        if (exceptionsRes.status === "fulfilled") data.exceptions = exceptionsRes.value.exceptions ?? [];
        if (invoicesRes.status === "fulfilled") data.invoices = invoicesRes.value.invoices ?? [];
        if (plansRes.status === "fulfilled") data.plans = plansRes.value.plans ?? [];
        if (linksRes.status === "fulfilled") data.paymentLinks = linksRes.value.paymentLinks ?? [];
        if (webhooksRes.status === "fulfilled") data.webhookEndpoints = webhooksRes.value.endpoints ?? [];
        if (fulfilmentRes.status === "fulfilled") data.fulfilmentOrders = fulfilmentRes.value.orders ?? [];

        replaceData(data as never);
      } catch {
        // Silently fail — store retains current data.
      }
    }

    void sync();
    return () => { cancelled = true; };
  }, [signedIn, replaceData]);
}
