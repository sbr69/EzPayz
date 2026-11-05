import { useEffect, useState } from "react";

/**
 * Returns `true` for a short period after mount so that list views can show
 * their skeleton state. In the future the same hook is where a real
 * `useQuery`-style fetch status would plug in.
 */
export function useSimulatedLoading(ms = 480) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return loading;
}
