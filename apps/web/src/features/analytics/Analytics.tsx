import { useState } from "react";
import { Download } from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { RANGE_OPTIONS, useMetrics, type RangeKey } from "@/hooks/useMetrics";
import { PAYMENT_STATUS_META } from "@/config/ui";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { downloadCsv, fmtAmount, fmtNumber, sumBase } from "@/lib/money";
import { Button, Card, CardHeader, PageHeader, Select } from "@/components/ui";
import { DonutChart, HorizontalBars, StackedBarChart, TrendLineChart, VolumeChart } from "@/components/ui/charts";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/ui/display";

const kindLabels: Record<string, string> = {
  one_time: "One-time",
  payment_link: "Payment link",
  invoice: "Invoice",
  subscription: "Subscription",
  usage: "Usage-based",
};

export default function Analytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const data = useDemo((s) => s.data);
  const metrics = useMetrics(range);

  function exportReport() {
    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Range", RANGE_OPTIONS.find((r) => r.value === range)?.label ?? range],
      ["Payment records", metrics.payments.length],
      ["Settled payments", metrics.settled.length],
      ["Pending payments", metrics.pending.length],
      ["Failed or expired", metrics.failed.length],
      ["Gross volume (base units)", metrics.grossVolume],
      ["Refunded (base units)", metrics.refundedTotal],
      ["Net volume (base units)", metrics.netVolume],
      ["Success rate (%)", metrics.successRate],
      ["Average value (base units)", metrics.avgValue],
      ["Active subscriptions", metrics.activeSubs],
      ["Renewal success (%)", metrics.renewalSuccess],
      ["Relayer sponsorship cost (WBT)", metrics.sponsorshipCost],
      [],
      ["Payment ID", "Status", "Amount (base)", "Created", "Settled"],
      ...metrics.payments.map((p) => [p.id, PAYMENT_STATUS_META[p.status].label, p.amount, p.createdAt, p.settledAt ?? ""]),
    ];
    downloadCsv(`analytics-${range}.csv`, rows);
  }

  const refundTrend = metrics.refundSeries;

  return (
    <>
      <PageHeader
        title="Analytics and reporting"
        description={`Every figure below is derived from the same payment, refund and relayer records used across the workspace on ${DEFAULT_NETWORK.name}.`}
        actions={
          <>
            <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="h-9 w-[150px]" aria-label="Date range">
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportReport}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total volume"
          value={<span>{fmtAmount(metrics.grossVolume)} {TOKEN.symbol}</span>}
          sub={`net ${fmtAmount(metrics.netVolume)} ${TOKEN.symbol}`}
        />
        <MetricCard label="Successful payments" value={fmtNumber(metrics.settled.length)} tone="positive" />
        <MetricCard
          label="Failure rate"
          value={`${metrics.attempts ? Math.round(((metrics.attempts - metrics.settled.length) / metrics.attempts) * 1000) / 10 : 0}%`}
          tone={metrics.attempts && metrics.settled.length / metrics.attempts < 0.8 ? "warn" : "neutral"}
          sub={`${metrics.failed.length} failed or expired`}
        />
        <MetricCard label="Total refunded" value={<span>{fmtAmount(metrics.refundedTotal)} {TOKEN.symbol}</span>} sub={`${metrics.refunds.length} refunds`} />
        <MetricCard label="Active subscriptions" value={fmtNumber(metrics.activeSubs)} sub={`${metrics.renewalSuccess}% renewal success`} />
        <MetricCard label="Average payment value" value={<span>{fmtAmount(metrics.avgValue)} {TOKEN.symbol}</span>} />
        <MetricCard label="Relayer sponsorship cost" value={`${metrics.sponsorshipCost} WBT`} tone="accent" />
        <MetricCard label="Payment records" value={fmtNumber(metrics.payments.length)} sub={`${data.payments.length} in workspace`} />
      </div>

      <Card>
        <CardHeader title="Payment volume timeline" description="Settled volume per period bucket" />
        <div className="p-4">
          <VolumeChart data={metrics.series} height={280} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Payments by status" description="Outcome distribution per period" />
          <div className="p-4">
            <StackedBarChart
              data={metrics.series}
              keys={["succeeded", "failed"]}
              labels={{ succeeded: "Succeeded", failed: "Failed / expired" }}
              height={240}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Status breakdown" description="Share of payment records" />
          <div className="p-4">
            <DonutChart
              data={metrics.byStatus.slice(0, 6).map((s) => ({
                name: PAYMENT_STATUS_META[s.status as keyof typeof PAYMENT_STATUS_META]?.label ?? s.status,
                value: s.count,
              }))}
              height={240}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Refund trends" description="Refunded volume per period" />
          <div className="p-4">
            <TrendLineChart data={refundTrend} dataKey="refundVolume" label={`Refunded ${TOKEN.symbol}`} height={230} color="#9a6300" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Subscription renewals" description="Renewal attempts recorded per subscription" />
          <div className="p-4">
            <TrendLineChart
              data={data.subscriptions
                .flatMap((s) => s.attempts.map((a) => ({ label: s.id.slice(-4), value: a.status === "succeeded" ? 1 : 0 })))
                .reduce<{ label: string; succeeded: number }[]>((acc, cur) => {
                  const existing = acc.find((a) => a.label === cur.label);
                  if (existing) existing.succeeded += cur.value;
                  else acc.push({ label: cur.label, succeeded: cur.value });
                  return acc;
                }, [])
                .map((r) => ({ label: `…${r.label}`, renewals: r.succeeded }))}
              dataKey="renewals"
              label="Successful renewals"
              height={230}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Payment link performance" description="Collected volume per link" />
        <div className="p-4">
          <HorizontalBars
            data={metrics.linkPerformance.map((l) => ({
              name: l.title.length > 22 ? `${l.title.slice(0, 21)}…` : l.title,
              value: l.collected,
            }))}
            height={230}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment method distribution" description="How customers paid in this range" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <DonutChart data={metrics.byKind.map((k) => ({ name: kindLabels[k.kind] ?? k.kind, value: k.count }))} height={230} />
          <div className="space-y-2">
            {metrics.byKind.map((k) => (
              <div key={k.kind} className="flex items-center justify-between rounded-md border border-line bg-canvas/60 px-3 py-2">
                <span className="text-[14px] text-ink-2">{kindLabels[k.kind] ?? k.kind}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium text-ink tnum">{k.count}</span>
                  <StatusBadge
                    tone="neutral"
                    dot={false}
                    label={`${Math.round((k.count / Math.max(1, metrics.payments.length)) * 100)}%`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reconciliation" description="How these numbers are computed" />
        <div className="grid gap-x-8 gap-y-1 px-5 py-4 sm:grid-cols-2">
          {[
            ["Payment records in range", fmtNumber(metrics.payments.length)],
            ["Settled records", fmtNumber(metrics.settled.length)],
            ["Gross volume (base units)", metrics.grossVolume],
            ["Refunded (base units)", fmtNumber(Number(metrics.refundedTotal))],
            ["Net volume (base units)", fmtNumber(Number(metrics.netVolume))],
            ["Average value (base units)", fmtNumber(Number(metrics.avgValue))],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-line py-2 text-[14px] last:border-0">
              <span className="text-ink-3">{label}</span>
              <span className="font-medium text-ink tnum">{value}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-line px-5 py-3">
          <p className="text-[13px] leading-relaxed text-ink-4">
            Volume is the sum of base-unit amounts across settled payments, minus any amount that was
            received but differs from the requested amount. Net volume subtracts settled refunds. Totals
            reconcile with the payments table and the dashboard because they read the same records.
          </p>
        </div>
      </Card>

      <p className="text-center text-[13px] text-ink-4">
        Sum of all payment records in the workspace: {fmtAmount(sumBase(data.payments.map((p) => p.amount)))} {TOKEN.symbol} requested
      </p>
    </>
  );
}
