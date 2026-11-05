import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, BarChart3, ExternalLink, Plus, Save } from "lucide-react";
import { api, hostedUrl } from "@/services";
import { useDemo } from "@/store/demoStore";
import { INTERVAL_LABEL, SUBSCRIPTION_STATUS_META } from "@/config/ui";
import { TOKEN } from "@/config/app";
import { cmpBase, fmtAmount, fmtDateTime, fmtNumber, toBase, validateAmount } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  Textarea,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay } from "@/components/ui/display";
import { SUBSCRIPTION_TONES } from "@/components/ui/statusTones";
import { TrendLineChart } from "@/components/ui/charts";
import type { Subscription, SubscriptionPlan } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

/* ------------------------------------------------------------------ */
/* Plans list                                                          */
/* ------------------------------------------------------------------ */

export function PlansListPage() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();

  const rows = useMemo(
    () => [...data.plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.plans],
  );

  const columns: Column<SubscriptionPlan>[] = [
    {
      key: "name",
      header: "Plan",
      render: (p) => (
        <div>
          <Link to={`/subscriptions/plans/${p.id}`} className="font-medium text-ink hover:text-accent hover:underline">
            {p.name}
          </Link>
          <p className="truncate text-[13px] text-ink-3">{p.description}</p>
        </div>
      ),
      csv: (p) => p.name,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) =>
        p.billingMode === "usage" ? (
          <div className="text-right">
            <AmountDisplay base={p.unitPrice ?? "0"} className="text-[14px]" />
            <p className="text-[13px] text-ink-4">per {p.unitLabel}</p>
          </div>
        ) : (
          <AmountDisplay base={p.amount} className="text-[14px]" />
        ),
      csv: (p) => p.amount,
    },
    { key: "interval", header: "Interval", render: (p) => INTERVAL_LABEL[p.interval], csv: (p) => p.interval },
    {
      key: "cap",
      header: "Per-cycle cap",
      align: "right",
      render: (p) => <AmountDisplay base={p.maxChargePerCycle} className="text-[14px]" />,
      csv: (p) => p.maxChargePerCycle,
    },
    {
      key: "limit",
      header: "Cumulative limit",
      align: "right",
      render: (p) => <AmountDisplay base={p.cumulativeLimit} className="text-[14px]" />,
      csv: (p) => p.cumulativeLimit,
    },
    {
      key: "retry",
      header: "Retry policy",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-[14px] text-ink-3">
          {p.retryPolicy.maxAttempts}× {p.retryPolicy.backoff} · {p.retryPolicy.intervalMinutes}m
        </span>
      ),
      csv: (p) => `${p.retryPolicy.maxAttempts}/${p.retryPolicy.backoff}`,
    },
    {
      key: "subs",
      header: "Subscriptions",
      align: "right",
      render: (p) => (
        <span className="tnum">{data.subscriptions.filter((s) => s.planId === p.id).length}</span>
      ),
      sortValue: (p) => data.subscriptions.filter((s) => s.planId === p.id).length,
      csv: (p) => data.subscriptions.filter((s) => s.planId === p.id).length,
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge label={p.active ? "Active" : "Inactive"} tone={p.active ? "positive" : "neutral"} />,
      csv: (p) => (p.active ? "Active" : "Inactive"),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Subscriptions", to: "/subscriptions" }, { label: "Plans" }]}
        title="Subscription plans"
        description="Define how much a customer can be charged, how often, and what happens when a renewal fails."
        actions={
          <Link to="/subscriptions/plans/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New plan
            </Button>
          </Link>
        }
      />

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          onRowClick={(p) => navigate(`/subscriptions/plans/${p.id}`)}
          searchPlaceholder="Search plans…"
          searchValue={(p) => `${p.name} ${p.description}`}
          filters={[
            {
              key: "interval",
              label: "Interval",
              options: [
                { value: "all", label: "All intervals" },
                ...Object.entries(INTERVAL_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (p, v) => p.interval === v,
            },
            {
              key: "mode",
              label: "Billing",
              options: [
                { value: "all", label: "All modes" },
                { value: "fixed", label: "Fixed amount" },
                { value: "usage", label: "Usage-based" },
              ],
              match: (p, v) => p.billingMode === v,
            },
          ]}
          emptyTitle="No plans yet"
          emptyDescription="Create a fixed or usage-based plan to start recurring billing."
          emptyAction={
            <Link to="/subscriptions/plans/new">
              <Button variant="primary">Create plan</Button>
            </Link>
          }
          exportName="subscription-plans"
        />
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Plan create                                                         */
/* ------------------------------------------------------------------ */

export function PlanForm() {
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    billingMode: "fixed" as "fixed" | "usage",
    unitLabel: "request",
    unitPrice: "0.01",
    interval: "monthly" as "hourly" | "daily" | "monthly",
    maxChargePerCycle: "",
    cumulativeLimit: "",
    planExpiryMonths: "12",
    maxAttempts: "3",
    backoff: "exponential" as "fixed" | "linear" | "exponential",
    intervalMinutes: "60",
    gracePeriodMinutes: "1440",
    notifyCustomer: true,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const next: Record<string, string | null> = {
      name: form.name.trim().length < 3 ? "Give the plan a name" : null,
      description: form.description.trim().length < 5 ? "Describe the plan" : null,
      amount: form.billingMode === "usage" ? null : validateAmount(form.amount),
      unitPrice: form.billingMode === "usage" ? validateAmount(form.unitPrice) : null,
      maxChargePerCycle: validateAmount(form.maxChargePerCycle || form.amount || form.unitPrice),
      // Required: an unbounded allowance is prohibited (PRD §11.2).
      cumulativeLimit: validateAmount(form.cumulativeLimit),
      maxAttempts: Number(form.maxAttempts) < 1 || Number(form.maxAttempts) > 8 ? "Between 1 and 8 attempts" : null,
      intervalMinutes: Number(form.intervalMinutes) < 1 ? "Minimum 1 minute" : null,
      gracePeriodMinutes: Number(form.gracePeriodMinutes) < 0 ? "Cannot be negative" : null,
    };
    if (
      form.billingMode === "fixed" &&
      form.amount &&
      form.maxChargePerCycle &&
      cmpBase(toBase(form.maxChargePerCycle), toBase(form.amount)) < 0
    ) {
      next.maxChargePerCycle = "The per-cycle cap cannot be lower than the amount";
    }
    if (
      form.cumulativeLimit &&
      form.maxChargePerCycle &&
      cmpBase(toBase(form.cumulativeLimit), toBase(form.maxChargePerCycle)) < 0
    ) {
      next.cumulativeLimit = "The cumulative limit must be at least the per-cycle cap";
    }
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const plan = await api.createPlan({
        name: form.name.trim(),
        description: form.description.trim(),
        amount: form.billingMode === "usage" ? "0" : toBase(form.amount),
        billingMode: form.billingMode,
        unitLabel: form.billingMode === "usage" ? form.unitLabel : undefined,
        unitPrice: form.billingMode === "usage" ? toBase(form.unitPrice) : undefined,
        interval: form.interval,
        maxChargePerCycle: toBase(form.maxChargePerCycle || form.amount || form.unitPrice),
        cumulativeLimit: toBase(form.cumulativeLimit),
        planExpiryMonths: Number(form.planExpiryMonths) || null,
        retryPolicy: {
          maxAttempts: Number(form.maxAttempts),
          backoff: form.backoff,
          intervalMinutes: Number(form.intervalMinutes),
          gracePeriodMinutes: Number(form.gracePeriodMinutes),
        },
        notifyCustomer: form.notifyCustomer,
      });
      pushToast({ title: "Plan created", body: plan.name, tone: "success" });
      navigate(`/subscriptions/plans/${plan.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Subscriptions", to: "/subscriptions" },
          { label: "Plans", to: "/subscriptions/plans" },
          { label: "New" },
        ]}
        title="Create a subscription plan"
        description="Customers explicitly authorise the per-cycle cap and the cumulative spending limit before a subscription is activated."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/subscriptions/plans")}>
              Cancel
            </Button>
            <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={saving} onClick={submit}>
              Create plan
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Plan configuration" />
          <div className="space-y-4 px-5 py-4">
            <Field label="Plan name" required error={errors.name}>
              <Input value={form.name} invalid={Boolean(errors.name)} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Northwind Pro" />
            </Field>
            <Field label="Description" required error={errors.description}>
              <Textarea value={form.description} invalid={Boolean(errors.description)} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Billing mode" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["fixed", "Fixed amount", "The same amount every cycle"],
                    ["usage", "Usage-based", "Metered units at a unit price"],
                  ] as const
                ).map(([value, title, desc]) => (
                  <button
                    key={value}
                    onClick={() => setForm({ ...form, billingMode: value })}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      form.billingMode === value ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-canvas"
                    }`}
                  >
                    <span className={`block text-[14px] font-semibold ${form.billingMode === value ? "text-accent" : "text-ink"}`}>
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-3">{desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            {form.billingMode === "usage" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={`Price per unit (${TOKEN.symbol})`} required error={errors.unitPrice}>
                  <Input inputMode="decimal" value={form.unitPrice} invalid={Boolean(errors.unitPrice)} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                </Field>
                <Field label="Unit label">
                  <Input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
                </Field>
              </div>
            ) : (
              <Field label={`Amount per cycle (${TOKEN.symbol})`} required error={errors.amount}>
                <Input inputMode="decimal" value={form.amount} invalid={Boolean(errors.amount)} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="129.00" />
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Billing interval" required>
                <Select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as typeof form.interval })}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
              <Field label={`Max per cycle (${TOKEN.symbol})`} required error={errors.maxChargePerCycle}>
                <Input inputMode="decimal" value={form.maxChargePerCycle} invalid={Boolean(errors.maxChargePerCycle)} onChange={(e) => setForm({ ...form, maxChargePerCycle: e.target.value })} placeholder={form.amount || "150.00"} />
              </Field>
              <Field
                label={`Cumulative limit (${TOKEN.symbol})`}
                required
                error={errors.cumulativeLimit}
                hint="Total the customer authorises across all renewals. Required — unbounded allowances are not supported."
              >
                <Input inputMode="decimal" value={form.cumulativeLimit} invalid={Boolean(errors.cumulativeLimit)} onChange={(e) => setForm({ ...form, cumulativeLimit: e.target.value })} placeholder="1,548.00" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan expiry" hint="Subscriptions end after this period.">
                <Select value={form.planExpiryMonths} onChange={(e) => setForm({ ...form, planExpiryMonths: e.target.value })}>
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="0">No expiry</option>
                </Select>
              </Field>
              <Field label="Customer notifications">
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={form.notifyCustomer} onChange={(v) => setForm({ ...form, notifyCustomer: v })} label="Notify customer" />
                  <span className="text-[14px] text-ink-3">Notify before each renewal</span>
                </div>
              </Field>
            </div>

            <Field label="Retry policy" hint="Applied when a renewal cannot be executed.">
              <div className="grid gap-3 rounded-md border border-line bg-canvas/60 p-3 sm:grid-cols-2">
                <Field label="Max attempts" error={errors.maxAttempts}>
                  <Input inputMode="numeric" value={form.maxAttempts} invalid={Boolean(errors.maxAttempts)} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} />
                </Field>
                <Field label="Backoff">
                  <Select value={form.backoff} onChange={(e) => setForm({ ...form, backoff: e.target.value as typeof form.backoff })}>
                    <option value="fixed">Fixed interval</option>
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                  </Select>
                </Field>
                <Field label="Interval (minutes)" error={errors.intervalMinutes}>
                  <Input inputMode="numeric" value={form.intervalMinutes} invalid={Boolean(errors.intervalMinutes)} onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })} />
                </Field>
                <Field label="Grace period (minutes)" error={errors.gracePeriodMinutes}>
                  <Input inputMode="numeric" value={form.gracePeriodMinutes} invalid={Boolean(errors.gracePeriodMinutes)} onChange={(e) => setForm({ ...form, gracePeriodMinutes: e.target.value })} />
                </Field>
              </div>
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Pricing preview" description="What the customer authorises" />
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-md border border-line bg-canvas p-4">
                <p className="text-[15px] font-semibold text-ink">{form.name || "Untitled plan"}</p>
                <p className="mt-1 text-[14px] text-ink-3">{form.description || "Plan description"}</p>
                <p className="mt-3 text-[20px] font-semibold text-ink tnum">
                  {form.billingMode === "usage"
                    ? `${form.unitPrice} ${TOKEN.symbol} / ${form.unitLabel}`
                    : `${form.amount || "0.00"} ${TOKEN.symbol}`}
                </p>
                <p className="mt-1 text-[13px] text-ink-4">Billed {form.interval}</p>
              </div>
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-ink-3">Max charge per cycle</span>
                  <span className="font-medium text-ink tnum">
                    {fmtAmount(toBase(form.maxChargePerCycle || form.amount || form.unitPrice || "0"))} {TOKEN.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Cumulative authorization</span>
                  <span className="font-medium text-ink tnum">
                    {form.cumulativeLimit ? `${fmtAmount(toBase(form.cumulativeLimit))} ${TOKEN.symbol}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Renewals within authorization</span>
                  <span className="font-medium text-ink tnum">
                    {form.cumulativeLimit && form.maxChargePerCycle
                      ? Math.floor(Number(form.cumulativeLimit) / Number(form.maxChargePerCycle || 1))
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Plan expiry</span>
                  <span className="font-medium text-ink">
                    {Number(form.planExpiryMonths) === 0 ? "No expiry" : `${form.planExpiryMonths} months`}
                  </span>
                </div>
              </div>
            </div>
          </Card>
          <Callout tone="warn" title="Customer-paid gas at setup">
            Initial token approval and subscription activation require customer-paid network gas in the
            current MVP. Renewals are executed by the gateway relayer within the approved allowance.
          </Callout>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Plan detail                                                         */
/* ------------------------------------------------------------------ */

export function PlanList() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const plan = data.plans.find((p) => p.id === id);

  if (!plan) {
    return (
      <Card>
        <EmptyState
          title="Plan not found"
          description={`No plan with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/subscriptions/plans")}>Back to plans</Button>}
        />
      </Card>
    );
  }

  const subscriptions = data.subscriptions.filter((s) => s.planId === plan.id);
  const usageRecords = data.usageRecords.filter((r) => subscriptions.some((s) => s.id === r.subscriptionId));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Subscriptions", to: "/subscriptions" }, { label: "Plans", to: "/subscriptions/plans" }, { label: plan.name }]}
        title={plan.name}
        description={plan.description}
        meta={
          <>
            <StatusBadge label={plan.active ? "Active" : "Inactive"} tone={plan.active ? "positive" : "neutral"} />
            <StatusBadge label={INTERVAL_LABEL[plan.interval]} tone="info" dot={false} />
            <StatusBadge label={plan.billingMode === "usage" ? "Usage-based" : "Fixed amount"} tone="neutral" dot={false} />
          </>
        }
        actions={
          <>
            <a href={hostedUrl(`subscribe/${plan.id}`)} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                Open customer checkout
              </Button>
            </a>
            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={async () => {
                const customer = data.customers[0];
                const sub = await api.createSubscription({ planId: plan.id, customerId: customer.id });
                navigate(`/subscriptions/${sub.id}`);
              }}
            >
              Create subscription
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Plan details" />
          <div className="grid gap-x-8 px-5 py-2 sm:grid-cols-2">
            <KeyValue label="Plan ID">
              <code className="font-mono text-[13px]">{plan.id}</code>
            </KeyValue>
            <KeyValue label="Currency">{plan.currency}</KeyValue>
            <KeyValue label="Amount per cycle">
              <AmountDisplay base={plan.amount} />
            </KeyValue>
            <KeyValue label="Billing interval">{INTERVAL_LABEL[plan.interval]}</KeyValue>
            {plan.billingMode === "usage" ? (
              <>
                <KeyValue label="Unit price">
                  <AmountDisplay base={plan.unitPrice ?? "0"} />
                </KeyValue>
                <KeyValue label="Unit">{plan.unitLabel}</KeyValue>
              </>
            ) : null}
            <KeyValue label="Max charge per cycle">
              <AmountDisplay base={plan.maxChargePerCycle} />
            </KeyValue>
            <KeyValue label="Cumulative limit">
              <AmountDisplay base={plan.cumulativeLimit} />
            </KeyValue>
            <KeyValue label="Plan expiry">
              {plan.planExpiryMonths ? `${plan.planExpiryMonths} months` : "No expiry"}
            </KeyValue>
            <KeyValue label="Created">{fmtDateTime(plan.createdAt)}</KeyValue>
            <KeyValue label="Max retry attempts">{plan.retryPolicy.maxAttempts}</KeyValue>
            <KeyValue label="Backoff">{plan.retryPolicy.backoff}</KeyValue>
            <KeyValue label="Retry interval">{plan.retryPolicy.intervalMinutes} minutes</KeyValue>
            <KeyValue label="Grace period">{plan.retryPolicy.gracePeriodMinutes} minutes</KeyValue>
            <KeyValue label="Customer notifications">{plan.notifyCustomer ? "Enabled" : "Disabled"}</KeyValue>
          </div>
        </Card>

        <Card>
          <CardHeader title="Subscriptions on this plan" />
          <div className="divide-y divide-line">
            {subscriptions.length === 0 ? (
              <EmptyState title="No subscriptions" description="No customer has subscribed to this plan yet." />
            ) : (
              subscriptions.map((s) => (
                <Link key={s.id} to={`/subscriptions/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">
                      {data.customers.find((c) => c.id === s.customerId)?.name}
                    </p>
                    <code className="font-mono text-[13px] text-ink-4">{s.id}</code>
                  </div>
                  <StatusBadge label={SUBSCRIPTION_STATUS_META[s.status].label} tone={SUBSCRIPTION_TONES[s.status]} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {plan.billingMode === "usage" ? (
        <Card>
          <CardHeader
            title="Usage records"
            description="Measurements are submitted by the merchant application and are not independently verified by the gateway"
          />
          <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
            <TrendLineChart
              data={usageRecords
                .slice()
                .reverse()
                .map((r) => ({ label: fmtDateTime(r.recordedAt).split(",")[0], units: r.units }))}
              dataKey="units"
              label="Units consumed"
            />
            <div className="space-y-2">
              {[
                ["Units recorded", fmtNumber(usageRecords.reduce((a, r) => a + r.units, 0))],
                ["Billed", fmtNumber(usageRecords.filter((r) => r.billed).length)],
                ["Pending", fmtNumber(usageRecords.filter((r) => !r.billed).length)],
                ["Calculated value", `${fmtAmount(usageRecords.reduce((a, r) => (a + Number(r.amount)).toString(), "0"))} ${TOKEN.symbol}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-line bg-canvas/60 px-3 py-2 text-[14px]">
                  <span className="text-ink-3">{label}</span>
                  <span className="font-medium text-ink tnum">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <Callout tone="neutral" title="Authorization limits" icon={<Activity className="h-4 w-4" />}>
        A subscription can never charge more than the per-cycle cap, and the cumulative total can never
        exceed the spending limit the customer approved. When the limit is reached the renewal fails and the
        exception centre raises an <strong>insufficient allowance</strong> case.
      </Callout>
      <p className="flex items-center justify-center gap-1.5 text-center text-[13px] text-ink-4">
        <BarChart3 className="h-3.5 w-3.5" />
        {subscriptions.length} subscriptions · {usageRecords.length} usage records
      </p>
      <SubscriptionRowsSpacer />
    </>
  );
}

function SubscriptionRowsSpacer() {
  const data = useDemo((s) => s.data);
  const rows = data.subscriptions.slice(0, 0);
  return rows.length ? null : null;
}

export type { Subscription };
