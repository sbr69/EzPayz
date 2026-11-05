import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Activity, Gauge, ShieldAlert, ShieldCheck } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { DEFAULT_NETWORK } from "@/config/app";
import { fmtDateTime, fmtNumber } from "@/lib/money";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";
import { Button, Callout, Card, CardHeader, Field, Input, KeyValue, PageHeader, Switch } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge, TxRefDisplay } from "@/components/ui/display";
import { MetricCard } from "@/components/common/MetricCard";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { GasGuardPolicy, RelayerTransaction } from "@/types";

const operationLabels: Record<RelayerTransaction["operation"], string> = {
  "payment.relay": "Payment relay",
  "refund.relay": "Refund relay",
  "subscription.renewal": "Subscription renewal",
  "subscription.activation": "Subscription activation",
};

export default function GasGuard() {
  const loading = useSimulatedLoading();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const navigate = useNavigate();
  const [form, setForm] = useState<GasGuardPolicy>(data.gasGuard);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);

  const stats = useMemo(() => {
    const confirmed = data.relayer.filter((r) => r.status === "confirmed");
    const rejected = data.relayer.filter((r) => r.status === "rejected" || r.status === "failed");
    const gas = data.relayer.reduce((acc, r) => acc + Number(r.gasSponsored), 0);
    const wbt = data.relayer.reduce((acc, r) => acc + Number(r.wbtCost), 0);
    return {
      confirmed: confirmed.length,
      rejected: rejected.length,
      gas,
      wbt: wbt.toFixed(6),
      payments: data.relayer.filter((r) => r.operation === "payment.relay").length,
      refunds: data.relayer.filter((r) => r.operation === "refund.relay").length,
      renewals: data.relayer.filter((r) => r.operation === "subscription.renewal").length,
    };
  }, [data.relayer]);

  const columns: Column<RelayerTransaction>[] = [
    { key: "id", header: "Transaction", render: (r) => <code className="font-mono text-[11.5px]">{r.id}</code> },
    {
      key: "merchant",
      header: "Merchant",
      render: () => data.merchant.displayName,
      csv: () => data.merchant.displayName,
    },
    { key: "operation", header: "Operation", render: (r) => <span className="text-[12.5px]">{operationLabels[r.operation]}</span>, csv: (r) => r.operation },
    { key: "gas", header: "Gas sponsored", align: "right", render: (r) => <span className="tnum text-[12.5px]">{fmtNumber(Number(r.gasSponsored))}</span>, sortValue: (r) => Number(r.gasSponsored), csv: (r) => r.gasSponsored },
    { key: "wbt", header: "WBT cost", align: "right", render: (r) => <span className="tnum text-[12.5px]">{r.wbtCost}</span>, csv: (r) => r.wbtCost },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <StatusBadge
          label={r.status}
          tone={r.status === "confirmed" ? "positive" : r.status === "rejected" || r.status === "failed" ? "danger" : "info"}
        />
      ),
      csv: (r) => r.status,
    },
    { key: "created", header: "Date", render: (r) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(r.createdAt)}</span>, sortValue: (r) => new Date(r.createdAt).getTime(), csv: (r) => r.createdAt },
    { key: "tx", header: "Transaction ref", render: (r) => <TxRefDisplay value={r.txRef} size="xs" /> },
    {
      key: "related",
      header: "",
      align: "right",
      render: (r) =>
        r.paymentId ? (
          <Link to={`/payments/${r.paymentId}`} className="text-[12px] font-medium text-accent hover:underline">
            View payment
          </Link>
        ) : null,
    },
  ];

  function validate() {
    const next: Record<string, string | null> = {
      maxGas: form.maxGasPerTxGwei < 21000 ? "Minimum 21,000 gas" : null,
      budget: form.merchantBudgetWbt <= 0 ? "Budget must be greater than zero" : null,
      daily: form.dailyLimitWbt <= 0 ? "Daily limit must be greater than zero" : null,
      rate: form.rateLimitPerMinute < 1 ? "Minimum 1 per minute" : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  return (
    <>
      <PageHeader
        title="GasGuard relayer"
        description="Gas sponsorship for supported payment operations, with policy limits that decide whether the relayer submits a transaction."
        meta={
          <>
            <StatusBadge
              label={form.emergencyPaused ? "Emergency pause active" : "Relayer healthy"}
              tone={form.emergencyPaused ? "danger" : "positive"}
            />
            <StatusBadge label={`${DEFAULT_NETWORK.name}`} tone="neutral" dot={false} />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Relayer WBT balance" value="42.5000 WBT" sub="gateway operator (demo)" />
        <MetricCard label="Sponsored transactions" value={fmtNumber(data.relayer.length)} sub={`${stats.confirmed} confirmed`} />
        <MetricCard label="Total gas consumed" value={fmtNumber(Math.round(stats.gas))} sub={`${stats.wbt} WBT`} />
        <MetricCard label="Rejected / failed" value={fmtNumber(stats.rejected)} tone={stats.rejected ? "danger" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Sponsorship policy"
            description="Merchant-configurable limits. Global relayer security is restricted to the gateway operator."
          />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Field label="Max gas per transaction" required error={errors.maxGas}>
              <Input
                inputMode="numeric"
                value={form.maxGasPerTxGwei}
                invalid={Boolean(errors.maxGas)}
                onChange={(e) => setForm({ ...form, maxGasPerTxGwei: Number(e.target.value) })}
              />
            </Field>
            <Field label="Merchant budget (WBT)" required error={errors.budget}>
              <Input
                inputMode="decimal"
                value={form.merchantBudgetWbt}
                invalid={Boolean(errors.budget)}
                onChange={(e) => setForm({ ...form, merchantBudgetWbt: Number(e.target.value) })}
              />
            </Field>
            <Field label="Daily sponsorship limit (WBT)" required error={errors.daily}>
              <Input
                inputMode="decimal"
                value={form.dailyLimitWbt}
                invalid={Boolean(errors.daily)}
                onChange={(e) => setForm({ ...form, dailyLimitWbt: Number(e.target.value) })}
              />
            </Field>
            <Field label="Transaction rate limit (per minute)" required error={errors.rate}>
              <Input
                inputMode="numeric"
                value={form.rateLimitPerMinute}
                invalid={Boolean(errors.rate)}
                onChange={(e) => setForm({ ...form, rateLimitPerMinute: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid gap-x-8 border-t border-line px-5 py-3 sm:grid-cols-2">
            <KeyValue label="Allowed network">{form.allowedNetwork}</KeyValue>
            <KeyValue label="Allowed token">{form.allowedToken}</KeyValue>
            <KeyValue label="Allowed contract">
              <code className="break-all font-mono text-[11px]">{form.allowedContract}</code>
            </KeyValue>
            <KeyValue label="Allowed functions">
              <span className="font-mono text-[11px]">{form.allowedFunctions.join(", ")}</span>
            </KeyValue>
            <KeyValue label="Authorization expiry check">
              <StatusBadge label={form.authorisationExpiryCheck ? "Enforced" : "Disabled"} tone={form.authorisationExpiryCheck ? "positive" : "warn"} />
            </KeyValue>
            <KeyValue label="Replay protection">
              <StatusBadge label={form.replayProtection ? "Enabled" : "Disabled"} tone={form.replayProtection ? "positive" : "danger"} />
            </KeyValue>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.emergencyPaused}
                onChange={(v) => setForm({ ...form, emergencyPaused: v })}
                label="Emergency pause"
                disabled
              />
              <div>
                <p className="text-[12.5px] font-medium text-ink">Emergency pause</p>
                <p className="text-[11.5px] text-ink-3">Operator-only control, shown read-only for merchants.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setForm(data.gasGuard)} disabled={saving}>
                Reset
              </Button>
              <Button
                variant="primary"
                loading={saving}
                onClick={async () => {
                  if (!validate()) return;
                  setSaving(true);
                  await api.updateGasGuard({
                    maxGasPerTxGwei: form.maxGasPerTxGwei,
                    merchantBudgetWbt: form.merchantBudgetWbt,
                    dailyLimitWbt: form.dailyLimitWbt,
                    rateLimitPerMinute: form.rateLimitPerMinute,
                  });
                  setSaving(false);
                  pushToast({ title: "Sponsorship policy updated", tone: "success" });
                }}
              >
                Save policy
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Usage" description="Merchant budget consumption" />
            <div className="space-y-3 px-5 py-4">
              <div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-3">Merchant budget</span>
                  <span className="font-medium text-ink tnum">
                    {data.gasGuard.merchantSpentWbt.toFixed(4)} / {data.gasGuard.merchantBudgetWbt} WBT
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas-alt">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, (data.gasGuard.merchantSpentWbt / data.gasGuard.merchantBudgetWbt) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-3">Daily limit</span>
                  <span className="font-medium text-ink tnum">
                    {data.gasGuard.dailySpentWbt.toFixed(4)} / {data.gasGuard.dailyLimitWbt} WBT
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas-alt">
                  <div
                    className="h-full rounded-full bg-warn"
                    style={{ width: `${Math.min(100, (data.gasGuard.dailySpentWbt / data.gasGuard.dailyLimitWbt) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Payments sponsored", fmtNumber(stats.payments)],
                  ["Refunds sponsored", fmtNumber(stats.refunds)],
                  ["Renewals sponsored", fmtNumber(stats.renewals)],
                  ["Rejected", fmtNumber(stats.rejected)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-line bg-canvas/60 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-ink-4">{label}</p>
                    <p className="mt-0.5 text-[14px] font-semibold text-ink tnum">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Policy status" />
            <div className="space-y-2.5 px-5 py-4">
              {[
                ["Gas cap within limits", stats.rejected === 0, "Rejected transactions indicate the cap is too low."],
                ["Budget available", data.gasGuard.merchantSpentWbt < data.gasGuard.merchantBudgetWbt, "Sponsorship stops when the budget is exhausted."],
                ["Daily limit available", data.gasGuard.dailySpentWbt < data.gasGuard.dailyLimitWbt, "Resets at 00:00 UTC."],
                ["Emergency pause off", !form.emergencyPaused, "No sponsored transactions are submitted while paused."],
              ].map(([label, ok, detail]) => (
                <div key={String(label)} className="flex items-start gap-2.5">
                  {ok ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  )}
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">{String(label)}</p>
                    <p className="text-[11.5px] leading-relaxed text-ink-3">{String(detail)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Relayer activity"
          description="Every sponsored submission recorded for this workspace"
          actions={
            <Link to="/settings/gas-sponsorship" className="text-[12px] font-medium text-accent hover:underline">
              Merchant sponsorship settings
            </Link>
          }
        />
        <DataTable
          loading={loading}
          rows={data.relayer}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => r.paymentId && navigate(`/payments/${r.paymentId}`)}
          searchPlaceholder="Search relayer transactions…"
          searchValue={(r) => `${r.id} ${r.operation} ${r.txRef}`}
          filters={[
            {
              key: "operation",
              label: "Operation",
              options: [
                { value: "all", label: "All operations" },
                ...Object.entries(operationLabels).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (r, v) => r.operation === v,
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                { value: "confirmed", label: "Confirmed" },
                { value: "rejected", label: "Rejected" },
                { value: "failed", label: "Failed" },
              ],
              match: (r, v) => r.status === v,
            },
          ]}
          emptyTitle="No relayer activity"
          emptyDescription="Sponsored submissions appear here once a payment is authorized."
          exportName="relayer-activity"
        />
      </Card>

      <Callout tone="neutral" title="Operator-only controls" icon={<Gauge className="h-4 w-4" />}>
        Global relayer security — the signing key, the operator wallet, the allow-list of contracts and the
        emergency pause — belong to the gateway operator role. Merchants see their own budget, limits and
        activity only. Relayer private keys are never present in the frontend.
      </Callout>

      <ConfirmDialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        destructive
        title="Emergency pause is operator-controlled"
        confirmLabel="Understood"
        body="Only the gateway operator can pause the relayer. This demo shows the control read-only so merchants understand what it means when it is active."
        onConfirm={() => setPauseOpen(false)}
      />

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" icon={<Activity className="h-3.5 w-3.5" />} onClick={() => setPauseOpen(true)}>
          What does the emergency pause do?
        </Button>
      </div>
    </>
  );
}
