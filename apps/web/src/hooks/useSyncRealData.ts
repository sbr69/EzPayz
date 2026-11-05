import { useEffect, useRef } from "react";
import { useDemo } from "@/store/demoStore";
import { apiFetch, setMutationCallback } from "@/services/api/http";

/**
 * useSyncRealData — fetches real merchant data from the gateway API and populates
 * the Zustand demo store so all dashboard pages display real data instead of seed data.
 *
 * Called once on mount (in AppShell). Only syncs if the user is signed in (has a JWT).
 * After any successful write (POST/PATCH/DELETE), the mutation callback triggers a
 * re-fetch so the store stays in sync without a full page reload.
 */
export function useSyncRealData() {
  const signedIn = useDemo((s) => s.signedIn);
  const replaceData = useDemo((s) => s.replaceData);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;

    async function sync() {
      try {
        // Fetch merchant profile.
        const merchantRes = await apiFetch<{ merchant: Record<string, unknown> }>("/v1/merchants/me");
        if (cancelled) return;

        // Fetch all list data in parallel.
        const [paymentsRes, refundsRes, subscriptionsRes, exceptionsRes, invoicesRes, plansRes, linksRes, webhooksRes, fulfilmentRes, customersRes, apiKeysRes, webhookEventsRes, productsRes] = await Promise.allSettled([
          apiFetch<{ paymentIntents: unknown[] }>("/v1/payment-intents?limit=100"),
          apiFetch<{ refunds: unknown[] }>("/v1/refunds?limit=100"),
          apiFetch<{ subscriptions: unknown[] }>("/v1/subscriptions?limit=100"),
          apiFetch<{ exceptions: unknown[] }>("/v1/exceptions?limit=100"),
          apiFetch<{ invoices: unknown[] }>("/v1/invoices?limit=100"),
          apiFetch<{ plans: unknown[] }>("/v1/plans?limit=100"),
          apiFetch<{ paymentLinks: unknown[] }>("/v1/payment-links?limit=100"),
          apiFetch<{ endpoints: unknown[] }>("/v1/webhooks?limit=100"),
          apiFetch<{ orders: unknown[] }>("/v1/fulfilment?limit=100"),
          apiFetch<{ customers: unknown[] }>("/v1/customers?limit=100"),
          apiFetch<{ apiKeys: unknown[] }>("/v1/api-keys"),
          apiFetch<{ events: unknown[] }>("/v1/webhooks/events?limit=100"),
          apiFetch<{ products: unknown[] }>("/v1/products?limit=100"),
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
        if (customersRes.status === "fulfilled") data.customers = customersRes.value.customers ?? [];
        if (apiKeysRes.status === "fulfilled") data.apiKeys = apiKeysRes.value.apiKeys ?? [];
        if (webhookEventsRes.status === "fulfilled") data.webhookEvents = webhookEventsRes.value.events ?? [];
        if (productsRes.status === "fulfilled") data.products = productsRes.value.products ?? [];

        replaceData(data as never);
      } catch {
        // Silently fail — store retains current data.
      }
    }

    void sync();
    syncRef.current = sync;

    // Register the mutation callback — any successful POST/PATCH/DELETE
    // in apiFetch will trigger a re-sync of the store.
    setMutationCallback(() => { void sync(); });

    return () => {
      cancelled = true;
      setMutationCallback(null);
    };
  }, [signedIn, replaceData]);
}
