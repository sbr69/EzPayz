import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, AlertTriangle, Ban, Coins, CreditCard, ExternalLink, Plus, Repeat, ShieldOff } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { INTERVAL_LABEL, SUBSCRIPTION_STATUS_META } from "@/config/ui";
import { SUBSCRIPTION_GAS_DISCLOSURE, TOKEN } from "@/config/app";
import { addBase, cmpBase, fmtAmount, fmtDateTime, fmtNumber, sumBase, untilFuture, validateAmount } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay, CopyButton, Timeline, TxRefDisplay } from "@/components/ui/display";
import { SUBSCRIPTION_TONES } from "@/components/ui/statusTones";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { TrendLineChart } from "@/components/ui/charts";
import type { Subscription, UsageRecord } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

export function SubscriptionsList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();

  const rows = useMemo(
    () => [...data.subscriptions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.subscriptions],
  );

  const columns: Column<Subscription>[] = [
    {
      key: "id",
      header: "Subscription",
      render: (s) => (
        <div>
          <Link to={`/subscriptions/${s.id}`} className="font-mono text-[14px] text-ink hover:text-accent hover:underline">
            {s.id}
          </Link>
          <p className="text-[13px] text-ink-3">{data.plans.find((p) => p.id === s.planId)?.name}</p>
        </div>
      ),
      csv: (s) => s.id,
    },
    {
      key: "customer",
      header: "Customer",
      render: (s) => data.customers.find((c) => c.id === s.customerId)?.name ?? s.customerId,
      csv: (s) => data.customers.find((c) => c.id === s.customerId)?.name ?? s.customerId,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (s) =>
        s.amount === "0" ? (
          <span className="text-[14px] text-ink-3">Usage-based</span>
        ) : (
          <AmountDisplay base={s.amount} className="text-[14px]" />
        ),
      csv: (s) => s.amount,
    },
    { key: "interval", header: "Interval", render: (s) => INTERVAL_LABEL[s.interval], csv: (s) => s.interval },
    {
      key: "next",
      header: "Next billing",
      render: (s) => <span className="text-[14px] text-ink-3">{s.nextBillingAt ? `${fmtDateTime(s.nextBillingAt)} (${untilFuture(s.nextBillingAt)})` : "—"}</span>,
      sortValue: (s) => (s.nextBillingAt ? new Date(s.nextBillingAt).getTime() : 0),
      csv: (s) => s.nextBillingAt ?? "",
    },
    {
      key: "cap",
      header: "Per-cycle cap",
      align: "right",
      hideOnMobile: true,
      render: (s) => <AmountDisplay base={s.maxChargePerCycle} className="text-[14px]" />,
      csv: (s) => s.maxChargePerCycle,
    },
    {
      key: "limit",
      header: "Cumulative cap",
      align: "right",
      hideOnMobile: true,
      render: (s) => <AmountDisplay base={s.cumulativeLimit} className="text-[14px]" />,
      csv: (s) => s.cumulativeLimit,
    },
    {
      key: "spent",
      header: "Spent",
      align: "right",
      render: (s) => <AmountDisplay base={s.spent} className="text-[14px]" />,
      sortValue: (s) => Number(s.spent),
      csv: (s) => s.spent,
    },
    {
      key: "remaining",
      header: "Authorization left",
      align: "right",
      hideOnMobile: true,
      render: (s) => <AmountDisplay base={s.allowanceRemaining} className="text-[14px] text-accent" />,
      csv: (s) => s.allowanceRemaining,
    },
    {
      key: "status",
      header: "Status",
      render: (s) => <StatusBadge label={SUBSCRIPTION_STATUS_META[s.status].label} tone={SUBSCRIPTION_TONES[s.status]} />,
      csv: (s) => SUBSCRIPTION_STATUS_META[s.status].label,
    },
    {
      key: "created",
      header: "Created",
      hideOnMobile: true,
      render: (s) => <span className="text-[14px] text-ink-3 tnum">{fmtDateTime(s.createdAt)}</span>,
      sortValue: (s) => new Date(s.createdAt).getTime(),
      csv: (s) => s.createdAt,
    },
    {
      key: "expiry",
      header: "Expiry",
      hideOnMobile: true,
      render: (s) => <span className="text-[14px] text-ink-3 tnum">{fmtDateTime(s.expiresAt)}</span>,
      csv: (s) => s.expiresAt ?? "",
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring billing with an explicit customer authorization. Renewals are executed by the gateway inside the approved allowance."
        actions={
          <Link to="/subscriptions/plans/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New plan
            </Button>
          </Link>
        }
      />

      <Callout tone="warn" title="Gas attribution">
        {SUBSCRIPTION_GAS_DISCLOSURE}
      </Callout>

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(s) => s.id}
          onRowClick={(s) => navigate(`/subscriptions/${s.id}`)}
          searchPlaceholder="Search subscriptions…"
          searchValue={(s) => `${s.id} ${data.customers.find((c) => c.id === s.customerId)?.name ?? ""} ${data.plans.find((p) => p.id === s.planId)?.name ?? ""}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...Object.entries(SUBSCRIPTION_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ],
              match: (s, v) => s.status === v,
            },
            {
              key: "interval",
              label: "Interval",
              options: [
                { value: "all", label: "All intervals" },
                ...Object.entries(INTERVAL_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (s, v) => s.interval === v,
            },
          ]}
          emptyTitle="No subscriptions yet"
          emptyDescription="Share a subscription plan checkout with a customer to create one."
          emptyAction={
            <Link to="/subscriptions/plans">
              <Button variant="primary">View plans</Button>
            </Link>
          }
          exportName="subscriptions"
        />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export function SubscriptionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [tab, setTab] = useState("overview");
  const [renewOpen, setRenewOpen] = useState<null | { fail: boolean }>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usageForm, setUsageForm] = useState({ units: "100", reference: "" });
  const [usageError, setUsageError] = useState<string | null>(null);

  const subscription = data.subscriptions.find((s) => s.id === id);
  if (!subscription) {
    return (
      <Card>
        <EmptyState
          title="Subscription not found"
          description={`No subscription with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/subscriptions")}>Back to subscriptions</Button>}
        />
      </Card>
    );
  }

  const plan = data.plans.find((p) => p.id === subscription.planId)!;
  const customer = data.customers.find((c) => c.id === subscription.customerId);
  const usageRecords = data.usageRecords.filter((r) => r.subscriptionId === subscription.id);
  const pendingUsage = usageRecords.filter((r) => !r.billed);
  const pendingAmount = sumBase(pendingUsage.map((r) => r.amount));
  const renewals = [...subscription.attempts].sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

  const renewalTimeline = [
    {
      label: "Renewal scheduled",
      detail: `Next billing ${subscription.nextBillingAt ? fmtDateTime(subscription.nextBillingAt) : "paused"}`,
      at: subscription.nextBillingAt ?? subscription.createdAt,
      state: "done" as const,
    },
    { label: "Backend scheduler triggered", detail: "The gateway scheduler picks up the due renewal.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "done" as const },
    { label: "GasGuard validation", detail: "Gas cap, budget and rate limits checked before submission.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "current" as const, simulated: true },
    { label: "Relayer submitted renewal call", detail: "GasGuard relayer submits the transferFrom call.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "todo" as const, simulated: true },
    { label: "Subscription contract checked limits", detail: "Per-cycle cap and cumulative limit enforced on-chain.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "todo" as const },
    { label: "transferFrom() executed", detail: "Tokens move from the customer allowance to the merchant.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "todo" as const },
    { label: "Settlement verified", detail: "The gateway waits for the settlement record before advancing state.", at: subscription.nextBillingAt ?? subscription.createdAt, state: "todo" as const, simulated: true },
    { label: "Subscription advanced to next billing period", at: subscription.nextBillingAt ?? subscription.createdAt, state: "todo" as const },
  ];

  const usageColumns: Column<UsageRecord>[] = [
    { key: "id", header: "Record", render: (r) => <code className="font-mono text-[13px]">{r.id}</code> },
    { key: "ref", header: "Merchant reference", render: (r) => <span className="text-[14px] text-ink-3">{r.merchantReference}</span> },
    { key: "units", header: "Units", align: "right", render: (r) => <span className="tnum">{fmtNumber(r.units)}</span>, sortValue: (r) => r.units, csv: (r) => r.units },
    { key: "price", header: "Unit price", align: "right", render: (r) => <AmountDisplay base={r.unitPrice} className="text-[14px]" /> },
    { key: "amount", header: "Amount", align: "right", render: (r) => <AmountDisplay base={r.amount} className="text-[14px]" />, csv: (r) => r.amount },
    { key: "recorded", header: "Recorded", render: (r) => <span className="text-[14px] text-ink-3 tnum">{fmtDateTime(r.recordedAt)}</span> },
    {
      key: "billed",
      header: "Status",
      render: (r) => (
        <StatusBadge
          label={r.billed ? "Billed" : "Pending"}
          tone={r.billed ? "positive" : "warn"}
        />
      ),
      csv: (r) => (r.billed ? "Billed" : "Pending"),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Subscriptions", to: "/subscriptions" }, { label: subscription.id }]}
        title={plan?.name ?? subscription.id}
        description={`${customer?.name ?? subscription.customerId} · ${INTERVAL_LABEL[subscription.interval]} billing`}
        meta={
          <>
            <StatusBadge label={SUBSCRIPTION_STATUS_META[subscription.status].label} tone={SUBSCRIPTION_TONES[subscription.status]} />
            <span className="font-mono text-[13px] text-ink-4">{subscription.id}</span>
            {subscription.nextBillingAt ? (
              <StatusBadge label={`Next renewal ${untilFuture(subscription.nextBillingAt)}`} tone="neutral" dot={false} />
            ) : null}
          </>
        }
        actions={
          <>
            <a href={`#/customer/subscriptions/${subscription.id}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                Customer view
              </Button>
            </a>
            {plan?.billingMode === "usage" ? (
              <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setUsageOpen(true)}>
                Record usage
              </Button>
            ) : null}
            <Button
              variant="secondary"
              icon={<Repeat className="h-4 w-4" />}
              onClick={() => setRenewOpen({ fail: false })}
              disabled={["cancelled", "expired"].includes(subscription.status)}
            >
              Run renewal
            </Button>
            <Button
              variant="danger"
              icon={<Ban className="h-4 w-4" />}
              onClick={() => setRenewOpen({ fail: true })}
              disabled={["cancelled", "expired"].includes(subscription.status)}
            >
              Simulate failed renewal
            </Button>
          </>
        }
      />

      {subscription.status === "past_due" ? (
        <Callout tone="warn" title="Renewal failed" icon={<AlertTriangle className="h-4 w-4" />}>
          The last renewal attempt could not be executed. Retry policy: {subscription.retryPolicy.maxAttempts} attempts
          with {subscription.retryPolicy.backoff} backoff every {subscription.retryPolicy.intervalMinutes} minutes, and a
          grace period of {subscription.retryPolicy.gracePeriodMinutes} minutes.
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="px-4 pt-1">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "overview", label: "Overview" },
                { id: "authorization", label: "Authorization & allowance" },
                { id: "billing", label: "Billing history", count: subscription.billingHistory.length },
                { id: "renewals", label: "Renewal attempts", count: subscription.attempts.length },
                { id: "usage", label: "Usage records", count: usageRecords.length },
              ]}
            />
          </div>

          {tab === "overview" ? (
            <div className="grid gap-x-8 px-5 py-3 sm:grid-cols-2">
              <KeyValue label="Subscription ID">
                <code className="font-mono text-[13px]">{subscription.id}</code>
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge label={SUBSCRIPTION_STATUS_META[subscription.status].label} tone={SUBSCRIPTION_TONES[subscription.status]} />
              </KeyValue>
              <KeyValue label="Customer">
                {customer ? (
                  <Link to={`/customers/${customer.id}`} className="text-accent hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  subscription.customerId
                )}
              </KeyValue>
              <KeyValue label="Plan">
                <Link to={`/subscriptions/plans/${plan?.id}`} className="text-accent hover:underline">
                  {plan?.name}
                </Link>
              </KeyValue>
              <KeyValue label="Amount per cycle">
                {subscription.amount === "0" ? "Usage-based" : <AmountDisplay base={subscription.amount} />}
              </KeyValue>
              <KeyValue label="Billing interval">{INTERVAL_LABEL[subscription.interval]}</KeyValue>
              <KeyValue label="Next billing">{fmtDateTime(subscription.nextBillingAt)}</KeyValue>
              <KeyValue label="Created">{fmtDateTime(subscription.createdAt)}</KeyValue>
              <KeyValue label="Subscription expiry">{fmtDateTime(subscription.expiresAt)}</KeyValue>
              <KeyValue label="Cancelled at">{fmtDateTime(subscription.cancelledAt)}</KeyValue>
              <Divider className="sm:col-span-2" />
              <KeyValue label="Total spent">
                <AmountDisplay base={subscription.spent} />
              </KeyValue>
              <KeyValue label="Authorization remaining">
                <AmountDisplay base={subscription.allowanceRemaining} />
              </KeyValue>
              <KeyValue label="Approval transaction">
                <TxRefDisplay value={subscription.approvalTxRef} />
              </KeyValue>
              <KeyValue label="Activation transaction">
                <TxRefDisplay value={subscription.activationTxRef} />
              </KeyValue>
              <Divider className="sm:col-span-2" />
              <KeyValue label="Retry policy">
                {subscription.retryPolicy.maxAttempts} attempts · {subscription.retryPolicy.backoff}
              </KeyValue>
              <KeyValue label="Retry interval">{subscription.retryPolicy.intervalMinutes} minutes</KeyValue>
              <KeyValue label="Grace period">{subscription.retryPolicy.gracePeriodMinutes} minutes</KeyValue>
              <KeyValue label="Customer notifications">
                {plan?.notifyCustomer ? "Enabled" : "Disabled"}
              </KeyValue>
            </div>
          ) : null}

          {tab === "authorization" ? (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-md border border-line bg-canvas/60 p-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-ink-3">Cumulative authorization used</span>
                  <span className="font-medium text-ink tnum">
                    {fmtAmount(subscription.spent)} / {fmtAmount(subscription.cumulativeLimit)} {TOKEN.symbol}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas-alt">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.min(100, (Number(subscription.spent) / Math.max(1, Number(subscription.cumulativeLimit))) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[13px] uppercase tracking-wide text-ink-4">Per-cycle cap</p>
                    <AmountDisplay base={subscription.maxChargePerCycle} className="text-[15px]" />
                  </div>
                  <div>
                    <p className="text-[13px] uppercase tracking-wide text-ink-4">Spent</p>
                    <AmountDisplay base={subscription.spent} className="text-[15px]" />
                  </div>
                  <div>
                    <p className="text-[13px] uppercase tracking-wide text-ink-4">Remaining</p>
                    <AmountDisplay base={subscription.allowanceRemaining} className="text-[15px] text-accent" />
                  </div>
                </div>
              </div>
              <div className="grid gap-x-8 sm:grid-cols-2">
                <KeyValue label="Allowance status">
                  {subscription.allowanceRevokedAt ? (
                    <StatusBadge label="Revoked" tone="danger" />
                  ) : (
                    <StatusBadge label="Active" tone="positive" />
                  )}
                </KeyValue>
                <KeyValue label="Allowance revoked at">{fmtDateTime(subscription.allowanceRevokedAt)}</KeyValue>
                <KeyValue label="Approved contract">Subscription contract (demo)</KeyValue>
                <KeyValue label="Approval transaction">
                  <TxRefDisplay value={subscription.approvalTxRef} />
                </KeyValue>
                <KeyValue label="Customer wallet">
                  <code className="font-mono text-[13px]">{customer?.wallet ?? "—"}</code>
                  {customer?.wallet ? <CopyButton value={customer.wallet} label="Copy" size="xs" /> : null}
                </KeyValue>
                <KeyValue label="Merchant payout">
                  <code className="font-mono text-[13px]">{data.merchant.payoutWallet.slice(0, 12)}…</code>
                </KeyValue>
              </div>
              <Callout tone="warn" title="Gas for setup and cancellation">
                {SUBSCRIPTION_GAS_DISCLOSURE} Cancelling and revoking the remaining allowance are also
                customer-paid transactions. They are separate actions with separate confirmations.
              </Callout>
            </div>
          ) : null}

          {tab === "billing" ? (
            <div className="divide-y divide-line">
              {subscription.billingHistory.length === 0 ? (
                <EmptyState title="No billing history" description="No renewal has been executed for this subscription yet." />
              ) : (
                subscription.billingHistory.map((b) => (
                  <Link key={b.paymentId} to={`/payments/${b.paymentId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                    <div>
                      <code className="font-mono text-[14px] text-ink">{b.paymentId}</code>
                      <p className="text-[13px] text-ink-3 tnum">{fmtDateTime(b.at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AmountDisplay base={b.amount} className="text-[14px]" />
                      <StatusBadge label={b.status} tone="positive" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          ) : null}

          {tab === "renewals" ? (
            <DataTable
              rows={renewals}
              columns={[
                { key: "attempt", header: "#", render: (r) => <span className="tnum">{r.attempt}</span> },
                { key: "scheduled", header: "Scheduled", render: (r) => <span className="text-[14px] text-ink-3 tnum">{fmtDateTime(r.scheduledFor)}</span> },
                { key: "executed", header: "Executed", render: (r) => <span className="text-[14px] text-ink-3 tnum">{fmtDateTime(r.executedAt)}</span> },
                { key: "amount", header: "Amount", align: "right", render: (r) => <AmountDisplay base={r.amount} className="text-[14px]" /> },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <StatusBadge
                      label={r.status}
                      tone={r.status === "succeeded" ? "positive" : r.status === "failed" ? "danger" : r.status === "scheduled" ? "info" : "neutral"}
                    />
                  ),
                  csv: (r) => r.status,
                },
                { key: "reason", header: "Detail", render: (r) => <span className="text-[14px] text-ink-3">{r.reason ?? (r.txRef ? "Settled" : "—")}</span> },
              ]}
              getRowId={(r) => r.id}
              emptyTitle="No renewal attempts"
              pageSize={6}
            />
          ) : null}

          {tab === "usage" ? (
            plan?.billingMode === "usage" ? (
              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    ["Units recorded", fmtNumber(usageRecords.reduce((a, r) => a + r.units, 0))],
                    ["Pending value", `${fmtAmount(pendingAmount)} ${TOKEN.symbol}`],
                    ["Cycle cap", `${fmtAmount(subscription.maxChargePerCycle)} ${TOKEN.symbol}`],
                    ["Authorization left", `${fmtAmount(subscription.allowanceRemaining)} ${TOKEN.symbol}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-line bg-canvas/60 px-3 py-2">
                      <p className="text-[13px] uppercase tracking-wide text-ink-4">{label}</p>
                      <p className="mt-0.5 text-[16px] font-semibold text-ink tnum">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-line p-3">
                  <TrendLineChart
                    height={180}
                    data={usageRecords
                      .slice()
                      .reverse()
                      .map((r) => ({ label: fmtDateTime(r.recordedAt).split(",")[0], units: r.units }))}
                    dataKey="units"
                    label="Units per record"
                  />
                </div>
                <DataTable
                  rows={usageRecords}
                  columns={usageColumns}
                  getRowId={(r) => r.id}
                  emptyTitle="No usage records"
                  pageSize={6}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas/60 px-4 py-3">
                  <div>
                    <p className="text-[14px] font-medium text-ink">Charge pending usage</p>
                    <p className="text-[13px] text-ink-3">
                      {pendingUsage.length} unbilled records · {fmtAmount(pendingAmount)} {TOKEN.symbol} ·
                      cap {fmtAmount(subscription.maxChargePerCycle)} {TOKEN.symbol}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    icon={<Coins className="h-4 w-4" />}
                    disabled={pendingUsage.length === 0}
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.billUsage(subscription.id);
                        pushToast({ title: "Usage charged", body: `${pendingUsage.length} records billed.`, tone: "success" });
                      } catch (err) {
                        pushToast({ title: "Charge rejected", body: (err as Error).message, tone: "error" });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Charge {fmtAmount(pendingAmount)} {TOKEN.symbol}
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState title="Not a usage-based plan" description="This subscription is billed at a fixed amount per cycle." />
            )
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Automatic renewal timeline" description="Simulated steps in demo mode" />
            <div className="px-5 py-4">
              <Timeline entries={renewalTimeline} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Failure handling" />
            <div className="space-y-2.5 px-5 py-4">
              {[
                ["Insufficient USDT", "Retries inside the retry window, then the subscription becomes past due."],
                ["Insufficient allowance", "Fails immediately; the customer must approve more allowance."],
                ["Subscription expired", "No further renewals are attempted."],
                ["Subscription cancelled", "No further renewals are attempted."],
                ["Spending limit reached", "Fails immediately; the customer must raise the limit."],
                ["Contract call failed", "Retried, then raised as a relayer exception."],
                ["RPC or relayer failure", "Retried by the gateway; raised as a relayer exception."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-md border border-line px-3 py-2">
                  <p className="text-[14px] font-medium text-ink">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{desc}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer management" />
            <div className="space-y-2.5 px-5 py-4">
              <p className="text-[14px] leading-relaxed text-ink-3">
                The customer can cancel and revoke separately from their own subscription page.
              </p>
              <a href={`#/customer/subscriptions/${subscription.id}`} target="_blank" rel="noreferrer">
                <Button variant="secondary" className="w-full" icon={<ExternalLink className="h-4 w-4" />}>
                  Open customer view
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(renewOpen)}
        onClose={() => setRenewOpen(null)}
        title={renewOpen?.fail ? "Simulate a failed renewal?" : "Run a renewal now?"}
        confirmLabel={renewOpen?.fail ? "Simulate failure" : "Run renewal"}
        destructive={Boolean(renewOpen?.fail)}
        loading={busy}
        body={
          renewOpen?.fail
            ? "The gateway will record a failed renewal attempt, apply the retry policy, and open an exception for the merchant to review. No payment will be marked successful."
            : "The gateway will execute the renewal inside the customer's approved allowance and record the settlement."
        }
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.runRenewal(subscription.id, {
              fail: Boolean(renewOpen?.fail),
              reason: renewOpen?.fail ? "Insufficient USDT balance at renewal time." : undefined,
            });
            pushToast({
              title: renewOpen?.fail ? "Renewal failed (simulated)" : "Renewal executed",
              body: renewOpen?.fail ? "An exception was opened for review." : "A new payment record was created.",
              tone: renewOpen?.fail ? "warn" : "success",
            });
          } catch (err) {
            pushToast({ title: "Renewal failed", body: (err as Error).message, tone: "error" });
          } finally {
            setBusy(false);
            setRenewOpen(null);
          }
        }}
      />

      <Modal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        title="Record usage"
        description="Usage measurements are submitted by your application and are not independently verified by the gateway."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUsageOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                const err = validateAmount(String(Number(usageForm.units) * Number(plan?.unitPrice ? fmtAmount(plan.unitPrice) : "0.01")));
                if (!usageForm.units || Number(usageForm.units) < 1) {
                  setUsageError("Enter at least 1 unit");
                  return;
                }
                if (err) {
                  setUsageError(err);
                  return;
                }
                setBusy(true);
                await api.recordUsage({
                  subscriptionId: subscription.id,
                  units: Number(usageForm.units),
                  reference: usageForm.reference || `manual/${Date.now()}`,
                });
                setBusy(false);
                setUsageOpen(false);
                setUsageForm({ units: "100", reference: "" });
                setUsageError(null);
                pushToast({ title: "Usage recorded", body: `${usageForm.units} units added.`, tone: "success" });
              }}
            >
              Record usage
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Units" required error={usageError}>
            <Input
              inputMode="numeric"
              value={usageForm.units}
              onChange={(e) => setUsageForm({ ...usageForm, units: e.target.value })}
            />
          </Field>
          <Field label="Merchant reference" hint="Your own identifier for the measurement.">
            <Input
              value={usageForm.reference}
              onChange={(e) => setUsageForm({ ...usageForm, reference: e.target.value })}
              placeholder="api/requests-week-12"
            />
          </Field>
          <Callout tone="info" title="Charge limit">
            A usage charge can never exceed the customer&apos;s per-cycle cap or remaining authorization. The
            pending total is {fmtAmount(pendingAmount)} {TOKEN.symbol} against a cap of{" "}
            {fmtAmount(subscription.maxChargePerCycle)} {TOKEN.symbol}.
          </Callout>
        </div>
      </Modal>

      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-ink-4">
        <CreditCard className="h-3.5 w-3.5" />
        {subscription.billingHistory.length} renewals settled ·{" "}
        {addBase(subscription.spent, "0") !== "0"
          ? `${fmtAmount(subscription.spent)} ${TOKEN.symbol} collected`
          : "no collections yet"}
        {cmpBase(subscription.allowanceRemaining, "0") <= 0 ? " · authorization exhausted" : ""}
      </p>
      <span className="hidden">
        <Activity />
        <ShieldOff />
      </span>
    </>
  );
}
