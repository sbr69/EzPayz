import { useMemo } from "react";
import { useDemo } from "@/store/demoStore";
import { addBase, cmpBase, fromBase, sumBase } from "@/lib/money";
import type { Payment, PaymentStatus } from "@/types";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "all";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function rangeStart(key: RangeKey): Date {
  const d = new Date();
  switch (key) {
    case "today":
      d.setHours(0, 0, 0, 0);
      return d;
    case "7d":
      return new Date(d.getTime() - 7 * 86400_000);
    case "30d":
      return new Date(d.getTime() - 30 * 86400_000);
    case "90d":
      return new Date(d.getTime() - 90 * 86400_000);
    default:
      return new Date(0);
  }
}

export const SETTLED: PaymentStatus[] = ["succeeded", "partially_refunded", "refunded", "underpaid", "overpaid"];
export const PENDING: PaymentStatus[] = [
  "created",
  "requires_authorization",
  "authorized",
  "submitted",
  "pending_confirmation",
  "exception",
];

export function useMetrics(range: RangeKey) {
  const data = useDemo((s) => s.data);

  return useMemo(() => {
    const start = rangeStart(range).getTime();
    const payments = data.payments.filter((p) => new Date(p.createdAt).getTime() >= start);
    const refunds = data.refunds.filter((r) => new Date(r.createdAt).getTime() >= start);

    const settled = payments.filter((p) => SETTLED.includes(p.status));
    const pending = payments.filter((p) => PENDING.includes(p.status));
    const failed = payments.filter((p) => p.status === "failed" || p.status === "expired" || p.status === "cancelled");

    const grossVolume = sumBase(settled.map((p) => (p.receivedAmount && p.status !== "succeeded" ? p.receivedAmount : p.amount)));
    const refundedTotal = sumBase(refunds.filter((r) => r.status === "succeeded").map((r) => r.amount));
    const netVolume = cmpBase(grossVolume, refundedTotal) < 0 ? "0" : addBase(grossVolume, `-${refundedTotal}`);

    const attempts = settled.length + failed.length;
    const successRate = attempts === 0 ? 0 : Math.round((settled.length / attempts) * 1000) / 10;

    const activeSubs = data.subscriptions.filter((s) => s.status === "active" || s.status === "renewal_due").length;
    const renewalSuccess = (() => {
      const all = data.subscriptions.flatMap((s) => s.attempts);
      const done = all.filter((a) => a.status === "succeeded" || a.status === "failed");
      if (!done.length) return 0;
      return Math.round((done.filter((a) => a.status === "succeeded").length / done.length) * 1000) / 10;
    })();

    const avgValue = settled.length === 0 ? "0" : (BigInt(grossVolume) / BigInt(settled.length)).toString();

    // Daily series (max 14 buckets to keep the chart readable).
    const buckets = range === "today" ? 12 : range === "7d" ? 7 : range === "30d" ? 15 : range === "90d" ? 15 : 12;
    const series = buildSeries(payments, range, buckets);

    const byStatus = Object.entries(
      payments.reduce<Record<string, number>>((acc, p) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const byKind = Object.entries(
      payments.reduce<Record<string, number>>((acc, p) => {
        acc[p.kind] = (acc[p.kind] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([kind, count]) => ({ kind, count }));

    const linkPerformance = data.paymentLinks
      .map((l) => ({
        id: l.id,
        title: l.title,
        collected: l.totalCollected,
        count: l.usageCount,
        type: l.linkType,
      }))
      .sort((a, b) => (cmpBase(b.collected, a.collected) > 0 ? 1 : -1));

    const sponsorshipCost = Number(
      data.relayer
        .filter((r) => new Date(r.createdAt).getTime() >= start)
        .reduce((acc, r) => acc + Number(r.wbtCost), 0)
        .toFixed(6),
    );

    const refundSeries = buildRefundSeries(refunds, range);

    return {
      payments,
      refunds,
      settled,
      pending,
      failed,
      grossVolume,
      netVolume,
      refundedTotal,
      successRate,
      activeSubs,
      renewalSuccess,
      avgValue,
      series,
      byStatus,
      byKind,
      linkPerformance,
      sponsorshipCost,
      refundSeries,
      attempts,
    };
  }, [data, range]);
}

function bucketLabel(d: Date, range: RangeKey): string {
  if (range === "today") return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function buildSeries(payments: Payment[], range: RangeKey, buckets: number) {
  const stepMs =
    range === "today"
      ? 2 * 3600_000
      : range === "7d"
        ? 86400_000
        : range === "30d"
          ? (30 / buckets) * 86400_000
          : range === "90d"
            ? (90 / buckets) * 86400_000
            : Math.max(86400_000, ((Math.max(...payments.map((p) => new Date(p.createdAt).getTime()), Date.now()) - Math.min(...payments.map((p) => new Date(p.createdAt).getTime()), Date.now())) || 86400_000) / buckets);

  const end = Date.now();
  const start = end - stepMs * buckets;
  const out: { label: string; volume: string; count: number; succeeded: number; failed: number; iso: string }[] = [];

  for (let i = 0; i < buckets; i += 1) {
    const from = start + i * stepMs;
    const to = from + stepMs;
    const inRange = payments.filter((p) => {
      const t = new Date(p.createdAt).getTime();
      return t >= from && t < to;
    });
    const ok = inRange.filter((p) => SETTLED.includes(p.status));
    const bad = inRange.filter((p) => p.status === "failed" || p.status === "expired" || p.status === "cancelled");
    out.push({
      iso: new Date(from).toISOString(),
      label: bucketLabel(new Date(from), range),
      volume: sumBase(ok.map((p) => (p.receivedAmount && p.status !== "succeeded" ? p.receivedAmount : p.amount))),
      count: inRange.length,
      succeeded: ok.length,
      failed: bad.length,
    });
  }
  return out;
}

function buildRefundSeries(refunds: { amount: string; createdAt: string; status: string }[], range: RangeKey) {
  const buckets = 8;
  const span = range === "today" ? 86400_000 : range === "7d" ? 7 * 86400_000 : range === "30d" ? 30 * 86400_000 : 90 * 86400_000;
  const stepMs = span / buckets;
  const end = Date.now();
  const out: { label: string; refundVolume: number; count: number }[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = end - span + i * stepMs;
    const to = from + stepMs;
    const inRange = refunds.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      return t >= from && t < to && r.status === "succeeded";
    });
    out.push({
      label: bucketLabel(new Date(from), range === "today" ? "today" : range),
      refundVolume: Number(fromBase(sumBase(inRange.map((r) => r.amount)))),
      count: inRange.length,
    });
  }
  return out;
}
