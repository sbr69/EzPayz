import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Gauge,
  Link2,
  Plus,
  Receipt,
  RefreshCcw,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { RANGE_OPTIONS, useMetrics, type RangeKey } from "@/hooks/useMetrics";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { fmtAmount, fmtNumber, fromBase, timeAgo, untilFuture } from "@/lib/money";
import { PAYMENT_STATUS_META } from "@/config/ui";
import { Button, Card, CardHeader, PageHeader, Select, StatusBadge } from "@/components/ui";
import { DonutChart, StackedBarChart, VolumeChart } from "@/components/ui/charts";
import { MetricCard, MiniStat } from "@/components/common/MetricCard";
import { CreatePaymentDialog } from "@/components/common/dialogs";
import { AmountDisplay, TxRefDisplay } from "@/components/ui/display";

export default function Dashboard() {
  const data = useDemo((s) => s.data);
  const [range, setRange] = useState<RangeKey>("30d");
  const [createOpen, setCreateOpen] = useState(false);
  const metrics = useMetrics(range);
  const navigate = useNavigate();

  const kindLabels: Record<string, string> = {
    one_time: "One-time",
    payment_link: "Payment link",
    invoice: "Invoice",
    subscription: "Subscription",
    usage: "Usage-based",
  };

  const upcoming = useMemo(
    () =>
      data.subscriptions
        .filter((s) => s.nextBillingAt && ["active", "renewal_due", "past_due", "pending_activation"].includes(s.status))
        .sort((a, b) => new Date(a.nextBillingAt!).getTime() - new Date(b.nextBillingAt!).getTime())
        .slice(0, 4),
    [data.subscriptions],
  );

  const recentRefunds = useMemo(() => data.refunds.slice(0, 4), [data.refunds]);
  const openExceptions = useMemo(
    () => data.exceptions.filter((e) => e.status !== "resolved" && e.status !== "dismissed").slice(0, 4),
    [data.exceptions],
  );
  const recent = useMemo(
    () => [...data.payments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [data.payments],
  );

  const sponsorship = useMemo(() => {
    const sponsored = data.relayer.length;
    const cost = data.relayer.reduce((acc, r) => acc + Number(r.wbtCost), 0);
    const rejected = data.relayer.filter((r) => r.status === "rejected" || r.status === "failed").length;
    return { sponsored, cost: cost.toFixed(6), rejected };
  }, [data.relayer]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${data.merchant.displayName}`}
        description={`Here is what happened across your USDT payment activity on ${DEFAULT_NETWORK.name}.`}
        meta={
          <>
            <StatusBadge label={`${DEFAULT_NETWORK.name} · testnet`} tone="warn" dot={false} />
            <StatusBadge
              label={
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {`${data.merchant.payoutWallet.slice(0, 8)}…${data.merchant.payoutWallet.slice(-4)}`}
                </span>
              }
              tone={data.merchant.walletVerified ? "positive" : "warn"}
            />
            {data.merchant.walletVerified ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-4">
                <ShieldCheck className="h-3.5 w-3.5 text-positive" />
                Verified (simulated)
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="h-9 w-[150px]"
              aria-label="Date range"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Create payment
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total received"
          value={<AmountDisplay base={metrics.grossVolume} symbol={TOKEN.symbol} />}
          sub={`net ${fmtAmount(metrics.netVolume)} ${TOKEN.symbol}`}
          icon={<TrendingUp className="h-4 w-4" />}
          to="/analytics"
        />
        <MetricCard
          label="Successful payments"
          value={fmtNumber(metrics.settled.length)}
          sub={`${metrics.attempts} attempts`}
          tone="positive"
          to="/payments?status=succeeded"
        />
        <MetricCard
          label="Pending payments"
          value={fmtNumber(metrics.pending.length)}
          sub="awaiting settlement"
          tone="warn"
          to="/payments?status=pending"
        />
        <MetricCard
          label="Total refunded"
          value={<AmountDisplay base={metrics.refundedTotal} symbol={TOKEN.symbol} />}
          sub={`${metrics.refunds.length} refunds`}
          to="/refunds"
        />
        <MetricCard
          label="Active subscriptions"
          value={fmtNumber(metrics.activeSubs)}
          sub={`${metrics.renewalSuccess}% renewal success`}
          icon={<Repeat className="h-4 w-4" />}
          to="/subscriptions"
        />
        <MetricCard
          label="Payment success rate"
          value={`${metrics.successRate}%`}
          sub={`${metrics.failed.length} failed or expired`}
          tone={metrics.successRate >= 85 ? "positive" : metrics.successRate >= 60 ? "warn" : "danger"}
          to="/analytics"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Payment volume"
            description={`Settled ${TOKEN.symbol} volume and payment count over time`}
            actions={<Link to="/analytics" className="text-[12px] font-medium text-accent hover:underline">View analytics</Link>}
          />
          <div className="p-4">
            <VolumeChart data={metrics.series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment method" description="How customers paid" />
          <div className="p-4">
            <DonutChart
              data={metrics.byKind.map((k) => ({ name: kindLabels[k.kind] ?? k.kind, value: k.count }))}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Successful vs failed payments" description="Outcome distribution per period" />
          <div className="p-4">
            <StackedBarChart
              data={metrics.series}
              keys={["succeeded", "failed"]}
              labels={{ succeeded: "Succeeded", failed: "Failed / expired" }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Subscription renewals" description="Attempted renewals and outcome" />
          <div className="space-y-3 p-4">
            {upcoming.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12.5px] text-ink-4">No upcoming renewals</p>
            ) : (
              upcoming.map((s) => (
                <Link
                  key={s.id}
                  to={`/subscriptions/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-canvas"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {data.customers.find((c) => c.id === s.customerId)?.name ?? s.customerId}
                    </p>
                    <p className="text-[11.5px] text-ink-3">
                      {data.plans.find((p) => p.id === s.planId)?.name} · {s.interval}
                    </p>
                  </div>
                  <div className="text-right">
                    <AmountDisplay base={s.amount} className="text-[12.5px]" />
                    <p className="text-[11px] text-ink-4">{untilFuture(s.nextBillingAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent transactions"
          description="Every record is shared with the payments, customers, invoices and analytics views"
          actions={
            <Link to="/payments">
              <Button size="sm" variant="secondary" iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}>
                All payments
              </Button>
            </Link>
          }
        />
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-[11.5px] uppercase tracking-wide text-ink-4">
                <th className="px-4 py-2.5 font-semibold">Payment</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Date</th>
                <th className="px-4 py-2.5 font-semibold">Transaction</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className="cursor-pointer transition-colors hover:bg-canvas/70"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{p.id}</td>
                  <td className="px-4 py-2.5">
                    {p.customerId ? (
                      data.customers.find((c) => c.id === p.customerId)?.name ?? "—"
                    ) : (
                      <span className="text-ink-4">{p.customerEmail ?? "Guest"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <AmountDisplay base={p.receivedAmount ?? p.amount} className="text-[12.5px]" />
                  </td>
                  <td className="px-4 py-2.5 text-ink-3">{kindLabels[p.kind]}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      label={PAYMENT_STATUS_META[p.status].label}
                      tone={PAYMENT_STATUS_META[p.status].tone}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-ink-3 tnum">{timeAgo(p.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <TxRefDisplay value={p.txRef} size="xs" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-ink-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent refunds" actions={<Link to="/refunds" className="text-[12px] font-medium text-accent hover:underline">All refunds</Link>} />
          <ul className="divide-y divide-line">
            {recentRefunds.map((r) => (
              <li key={r.id}>
                <Link to={`/refunds/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-ink">{r.id}</p>
                    <p className="truncate text-[11.5px] text-ink-3">{r.reason}</p>
                  </div>
                  <div className="text-right">
                    <AmountDisplay base={r.amount} className="text-[12.5px]" />
                    <p className="text-[11px] text-ink-4">{timeAgo(r.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Payment exceptions" actions={<Link to="/exceptions" className="text-[12px] font-medium text-accent hover:underline">Open centre</Link>} />
          <ul className="divide-y divide-line">
            {openExceptions.length === 0 ? (
              <li className="px-4 py-6 text-center text-[12.5px] text-ink-4">No open exceptions</li>
            ) : (
              openExceptions.map((e) => (
                <li key={e.id}>
                  <Link to={`/exceptions/${e.id}`} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-canvas">
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        e.severity === "critical" || e.severity === "high" ? "text-danger" : "text-warn"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-ink">{e.type.replace(/_/g, " ")}</p>
                      <p className="truncate text-[11.5px] text-ink-3">{e.whatHappened}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-[11px] text-ink-4">{timeAgo(e.detectedAt)}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Relayer sponsorship" description="GasGuard usage for your workspace" actions={<Link to="/gasguard" className="text-[12px] font-medium text-accent hover:underline">GasGuard</Link>} />
          <div className="grid grid-cols-2 gap-2.5 p-4">
            <MiniStat label="Sponsored tx" value={fmtNumber(sponsorship.sponsored)} />
            <MiniStat label="WBT consumed" value={sponsorship.cost} />
            <MiniStat label="Budget used" value={`${Math.round((data.gasGuard.merchantSpentWbt / data.gasGuard.merchantBudgetWbt) * 100)}%`} tone="warn" />
            <MiniStat label="Rejected" value={fmtNumber(sponsorship.rejected)} tone={sponsorship.rejected ? "danger" : undefined} />
          </div>
          <div className="border-t border-line px-4 py-3">
            <div className="flex items-center justify-between text-[11.5px] text-ink-3">
              <span>Daily limit</span>
              <span className="tnum">
                {data.gasGuard.dailySpentWbt} / {data.gasGuard.dailyLimitWbt} WBT
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas-alt">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, (data.gasGuard.dailySpentWbt / data.gasGuard.dailyLimitWbt) * 100)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Quick actions" description="Start a new payment flow or jump into a module" />
        <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Create payment", icon: CreditCard, action: () => setCreateOpen(true) },
            { label: "Create payment link", icon: Link2, action: () => navigate("/payment-links/new") },
            { label: "Create invoice", icon: Receipt, action: () => navigate("/invoices/new") },
            { label: "Create subscription plan", icon: Repeat, action: () => navigate("/subscriptions/plans/new") },
            { label: "Issue refund", icon: RefreshCcw, action: () => navigate("/refunds") },
          ].map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3 text-left text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-canvas"
            >
              <a.icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.9} />
              {a.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="bg-canvas/40">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[12px] text-ink-3">
          <Gauge className="h-3.5 w-3.5 text-accent" />
          <span>
            Gross volume for this period is {fmtAmount(metrics.grossVolume)} {TOKEN.symbol} across{" "}
            {fmtNumber(metrics.payments.length)} payment records; refunds total{" "}
            {fmtAmount(metrics.refundedTotal)} {TOKEN.symbol}. Analytics reconcile against the same records
            (average value {fmtAmount(metrics.avgValue)} {TOKEN.symbol}, derived as{" "}
            {fromBase(metrics.grossVolume)} base units ÷ {metrics.settled.length}).
          </span>
        </div>
      </Card>

      <CreatePaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
