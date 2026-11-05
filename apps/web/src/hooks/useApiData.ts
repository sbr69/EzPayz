import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/services/api/http";

/**
 * useApiData — fetches data from the real gateway API on mount.
 * Returns { data, loading, error, refresh }.
 *
 * Usage:
 *   const { data: payments, loading, refresh } = useApiData<{ paymentIntents: Payment[]; hasMore: boolean }>("/v1/payment-intents?limit=20");
 */
export function useApiData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<T>(path);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
