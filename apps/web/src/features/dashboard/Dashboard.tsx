import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Link2,
  Plus,
  Receipt,
  RefreshCcw,
  Repeat,
  TrendingUp,
} from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { RANGE_OPTIONS, useMetrics, type RangeKey } from "@/hooks/useMetrics";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { fmtAmount, fmtNumber, timeAgo, untilFuture } from "@/lib/money";
import { PAYMENT_STATUS_META } from "@/config/ui";
import { Button, Card, CardHeader, PageHeader, Select, StatusBadge } from "@/components/ui";
import { VolumeChart } from "@/components/ui/charts";
import { MetricCard, MiniStat } from "@/components/common/MetricCard";
import { CreatePaymentDialog } from "@/components/common/dialogs";
import { AmountDisplay, TxRefDisplay } from "@/components/ui/display";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";

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
        actions={
          <>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              className="h-10 w-[176px]"
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

      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" gap={0.05}>
        <StaggerItem>
          <MetricCard
            label="Total received"
            value={<AmountDisplay base={metrics.grossVolume} symbol={TOKEN.symbol} />}
            sub={`net ${fmtAmount(metrics.netVolume)} ${TOKEN.symbol}`}
            icon={<TrendingUp className="h-4 w-4" />}
            to="/analytics"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Successful payments"
            value={fmtNumber(metrics.settled.length)}
            sub={`${metrics.attempts} attempts`}
            tone="positive"
            to="/payments?status=succeeded"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Pending payments"
            value={fmtNumber(metrics.pending.length)}
            sub="awaiting settlement"
            tone="warn"
            to="/payments?status=pending"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Total refunded"
            value={<AmountDisplay base={metrics.refundedTotal} symbol={TOKEN.symbol} />}
            sub={`${metrics.refunds.length} refunds`}
            to="/refunds"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Active subscriptions"
            value={fmtNumber(metrics.activeSubs)}
            sub={`${metrics.renewalSuccess}% renewal success`}
            icon={<Repeat className="h-4 w-4" />}
            to="/subscriptions"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricCard
            label="Payment success rate"
            value={`${metrics.successRate}%`}
            sub={`${metrics.failed.length} failed or expired`}
            tone={metrics.successRate >= 85 ? "positive" : metrics.successRate >= 60 ? "warn" : "danger"}
            to="/analytics"
          />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.15}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Payment volume"
            description={`Settled ${TOKEN.symbol} volume and payment count over time`}
            actions={<Link to="/analytics" className="text-[18px] font-medium text-accent hover:underline">View analytics</Link>}
          />
          <div className="p-5">
            <VolumeChart data={metrics.series} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Subscription renewals" description="Upcoming renewal attempts" />
          <div className="space-y-3 p-5">
            {upcoming.length === 0 ? (
              <p className="px-1 py-6 text-center text-[18px] text-ink-4">No upcoming renewals</p>
            ) : (
              upcoming.map((s) => (
                <Link
                  key={s.id}
                  to={`/subscriptions/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-canvas"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-medium text-ink">
                      {data.customers.find((c) => c.id === s.customerId)?.name ?? s.customerId}
                    </p>
                    <p className="text-[16px] text-ink-3">
                      {data.plans.find((p) => p.id === s.planId)?.name} · {s.interval}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <AmountDisplay base={s.amount} className="text-[18px]" />
                    <p className="text-[16px] text-ink-4">{untilFuture(s.nextBillingAt)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
      </FadeIn>

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
          <table className="w-full min-w-[640px] text-left text-[16px] sm:text-[18px]">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-[14px] uppercase tracking-wider text-ink-4">
                <th className="px-3 py-3 font-semibold sm:px-6">Payment</th>
                <th className="px-3 py-3 font-semibold sm:px-6">Customer</th>
                <th className="px-3 py-3 text-right font-semibold sm:px-6">Amount</th>
                <th className="hidden px-3 py-3 font-semibold lg:table-cell sm:px-6">Type</th>
                <th className="px-3 py-3 font-semibold sm:px-6">Status</th>
                <th className="px-3 py-3 font-semibold sm:px-6">Date</th>
                <th className="hidden px-3 py-3 font-semibold xl:table-cell sm:px-6">Transaction</th>
                <th className="px-3 py-3 sm:px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className="cursor-pointer transition-colors hover:bg-canvas/70"
                >
                  <td className="px-3 py-3 font-mono text-ink sm:px-6">
                    <span className="block max-w-[120px] truncate sm:max-w-[160px]">{p.id}</span>
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-3 sm:px-6">
                    {p.customerId ? (
                      data.customers.find((c) => c.id === p.customerId)?.name ?? "—"
                    ) : (
                      <span className="text-ink-4">{p.customerEmail ?? "Guest"}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right sm:px-6">
                    <AmountDisplay base={p.receivedAmount ?? p.amount} className="text-[18px]" />
                  </td>
                  <td className="hidden px-3 py-3 text-ink-3 lg:table-cell sm:px-6">{kindLabels[p.kind]}</td>
                  <td className="px-3 py-3 sm:px-6">
                    <StatusBadge
                      label={PAYMENT_STATUS_META[p.status].label}
                      tone={PAYMENT_STATUS_META[p.status].tone}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-ink-3 tnum sm:px-6">{timeAgo(p.createdAt)}</td>
                  <td className="hidden px-3 py-3 xl:table-cell sm:px-6">
                    <TxRefDisplay value={p.txRef} size="xs" />
                  </td>
                  <td className="px-3 py-3 text-right sm:px-6">
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-ink-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent refunds" actions={<Link to="/refunds" className="text-[18px] font-medium text-accent hover:underline">All refunds</Link>} />
          <ul className="divide-y divide-line">
            {recentRefunds.map((r) => (
              <li key={r.id}>
                <Link to={`/refunds/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-[18px] font-medium text-ink">{r.id}</p>
                    <p className="truncate text-[16px] text-ink-3">{r.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <AmountDisplay base={r.amount} className="text-[18px]" />
                    <p className="text-[16px] text-ink-4">{timeAgo(r.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Payment exceptions" actions={<Link to="/exceptions" className="text-[18px] font-medium text-accent hover:underline">Open centre</Link>} />
          <ul className="divide-y divide-line">
            {openExceptions.length === 0 ? (
              <li className="px-6 py-8 text-center text-[18px] text-ink-4">No open exceptions</li>
            ) : (
              openExceptions.map((e) => (
                <li key={e.id}>
                  <Link to={`/exceptions/${e.id}`} className="flex items-start gap-2.5 px-4 py-3 hover:bg-canvas sm:px-6">
                    <AlertTriangle
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        e.severity === "critical" || e.severity === "high" ? "text-danger" : "text-warn"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[18px] font-medium text-ink">{e.type.replace(/_/g, " ")}</p>
                      <p className="truncate text-[16px] text-ink-3">{e.whatHappened}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-[16px] text-ink-4">{timeAgo(e.detectedAt)}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Relayer sponsorship" description="GasGuard usage for your workspace" actions={<Link to="/gasguard" className="text-[18px] font-medium text-accent hover:underline">GasGuard</Link>} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
            <MiniStat label="Sponsored" value={fmtNumber(sponsorship.sponsored)} />
            <MiniStat label="WBT used" value={sponsorship.cost} />
            <MiniStat label="Budget" value={`${Math.round((data.gasGuard.merchantSpentWbt / data.gasGuard.merchantBudgetWbt) * 100)}%`} tone="warn" />
            <MiniStat label="Rejected" value={fmtNumber(sponsorship.rejected)} tone={sponsorship.rejected ? "danger" : undefined} />
          </div>
          <div className="border-t border-line px-6 py-4">
            <div className="flex items-center justify-between text-[16px] text-ink-3">
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
        <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5 lg:grid-cols-5">
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
              className="group flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-3 text-left text-[16px] font-medium text-ink shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm sm:px-3.5 sm:text-[18px]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
                <a.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </Card>

      <CreatePaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
