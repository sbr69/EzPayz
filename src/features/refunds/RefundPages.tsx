import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { REFUND_STATUS_META } from "@/config/ui";
import { fmtDateTime, timeAgo } from "@/lib/money";
import { TOKEN } from "@/config/app";
import { Button, Callout, Card, CardHeader, EmptyState, KeyValue, PageHeader, StatusBadge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressDisplay, AmountDisplay, ExplorerLinkPlaceholder, Timeline, TxRefDisplay } from "@/components/ui/display";
import { REFUND_TONES } from "@/components/ui/statusTones";
import { MetricCard, MiniStat } from "@/components/common/MetricCard";
import { RefundDialog } from "@/components/common/dialogs";
import { useState } from "react";
import type { Payment, Refund } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

export function RefundsList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);

  const rows = useMemo(
    () => [...data.refunds].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.refunds],
  );

  const succeeded = data.refunds.filter((r) => r.status === "succeeded");
  const pending = data.refunds.filter((r) => ["created", "awaiting_authorization", "authorized", "submitted", "pending_confirmation"].includes(r.status));
  const failed = data.refunds.filter((r) => r.status === "failed" || r.status === "exception");
  const refundedTotal = succeeded.reduce((acc, r) => acc + BigInt(r.amount), 0n).toString();

  const columns: Column<Refund>[] = [
    {
      key: "id",
      header: "Refund",
      render: (r) => (
        <div>
          <Link to={`/refunds/${r.id}`} className="font-mono text-[12px] text-ink hover:text-accent hover:underline">
            {r.id}
          </Link>
          <p className="text-[11.5px] text-ink-3">for {r.paymentId}</p>
        </div>
      ),
      csv: (r) => r.id,
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => data.customers.find((c) => c.id === r.customerId)?.name ?? "Guest",
      csv: (r) => data.customers.find((c) => c.id === r.customerId)?.name ?? "Guest",
    },
    { key: "amount", header: "Amount", align: "right", render: (r) => <AmountDisplay base={r.amount} className="text-[12.5px]" />, sortValue: (r) => Number(r.amount), csv: (r) => r.amount },
    { key: "reason", header: "Reason", render: (r) => <span className="text-[12px] text-ink-3">{r.reason}</span> },
    {
      key: "gas",
      header: "Gas",
      hideOnMobile: true,
      render: (r) => <StatusBadge label={r.gasSponsored ? "Sponsored" : "Merchant paid"} tone={r.gasSponsored ? "accent" : "neutral"} dot={false} />,
      csv: (r) => (r.gasSponsored ? "Sponsored" : "Merchant paid"),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge label={REFUND_STATUS_META[r.status].label} tone={REFUND_TONES[r.status]} />, csv: (r) => REFUND_STATUS_META[r.status].label },
    { key: "created", header: "Created", hideOnMobile: true, render: (r) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(r.createdAt)}</span>, sortValue: (r) => new Date(r.createdAt).getTime(), csv: (r) => r.createdAt },
    { key: "settled", header: "Settled", hideOnMobile: true, render: (r) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(r.settledAt)}</span>, csv: (r) => r.settledAt ?? "" },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <Link to={`/refunds/${r.id}`} className="text-[12px] font-medium text-accent hover:underline">
          View
        </Link>
      ),
    },
  ];

  const refundable = data.payments.filter((p) => ["succeeded", "partially_refunded", "overpaid"].includes(p.status));

  return (
    <>
      <PageHeader
        title="Refunds"
        description="A refund is a new USDT transfer from your payout wallet to the customer. It never reverses the original blockchain transaction."
        actions={
          <SelectRefundablePayment payments={refundable} onSelected={(p) => setRefundTarget(p)} />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Total refunds" value={data.refunds.length} sub={`${succeeded.length} settled`} />
        <MetricCard label="Total refunded" value={<AmountDisplay base={refundedTotal} symbol={TOKEN.symbol} />} tone="accent" />
        <MetricCard label="Pending refunds" value={pending.length} tone="warn" />
        <MetricCard label="Failed refunds" value={failed.length} tone={failed.length ? "danger" : "neutral"} />
        <MetricCard
          label="Refund success rate"
          value={`${data.refunds.length ? Math.round((succeeded.length / data.refunds.length) * 100) : 0}%`}
        />
      </div>

      {pending.length ? (
        <Callout tone="warn" title="Refunds awaiting your authorization" icon={<AlertTriangle className="h-4 w-4" />}>
          {pending.length} refund{pending.length > 1 ? "s" : ""} need a merchant wallet signature or a
          merchant-paid submission before the customer receives funds.
        </Callout>
      ) : null}

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => navigate(`/refunds/${r.id}`)}
          searchPlaceholder="Search refunds…"
          searchValue={(r) => `${r.id} ${r.paymentId} ${r.reason}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...Object.entries(REFUND_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ],
              match: (r, v) => r.status === v,
            },
            {
              key: "gas",
              label: "Gas",
              options: [
                { value: "all", label: "All gas paths" },
                { value: "sponsored", label: "Sponsored" },
                { value: "merchant", label: "Merchant paid" },
              ],
              match: (r, v) => (v === "sponsored" ? r.gasSponsored : !r.gasSponsored),
            },
          ]}
          emptyTitle="No refunds issued"
          emptyDescription="Refunds are created from a settled payment record."
          emptyAction={
            <Button variant="secondary" onClick={() => navigate("/payments")}>
              Go to payments
            </Button>
          }
          exportName="refunds"
        />
      </Card>

      {refundTarget ? <RefundDialog payment={refundTarget} open onClose={() => setRefundTarget(null)} /> : null}
    </>
  );
}

function SelectRefundablePayment({ payments, onSelected }: { payments: Payment[]; onSelected: (p: Payment) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Select a payment to refund"
        className="h-9 max-w-[280px] rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink"
      >
        <option value="">Select a settled payment…</option>
        {payments.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id} — {p.description.slice(0, 28)}
          </option>
        ))}
      </select>
      <Button
        variant="primary"
        icon={<RefreshCcw className="h-4 w-4" />}
        disabled={!value}
        onClick={() => {
          const payment = payments.find((p) => p.id === value);
          if (payment) onSelected(payment);
        }}
      >
        Issue refund
      </Button>
    </div>
  );
}

export function RefundDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const refund = data.refunds.find((r) => r.id === id);

  if (!refund) {
    return (
      <Card>
        <EmptyState
          title="Refund not found"
          description={`No refund with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/refunds")}>Back to refunds</Button>}
        />
      </Card>
    );
  }

  const payment = data.payments.find((p) => p.id === refund.paymentId);
  const customer = data.customers.find((c) => c.id === refund.customerId);

  const timeline: import("@/types").TimelineEntry[] = refund.timeline.map((t, i) => ({
    label: t.label,
    detail: t.detail,
    at: t.at,
    state: i === refund.timeline.length - 1 ? "current" : "done",
    simulated: t.simulated,
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Refunds", to: "/refunds" }, { label: refund.id }]}
        title="Refund"
        description={`Created ${fmtDateTime(refund.createdAt)} · ${timeAgo(refund.createdAt)}`}
        meta={
          <>
            <StatusBadge label={REFUND_STATUS_META[refund.status].label} tone={REFUND_TONES[refund.status]} />
            <StatusBadge label={refund.gasSponsored ? "Gas sponsored by relayer" : "Merchant-paid gas"} tone={refund.gasSponsored ? "accent" : "neutral"} />
            <span className="font-mono text-[11.5px] text-ink-4">{refund.id}</span>
          </>
        }
        actions={
          payment ? (
            <Link to={`/payments/${payment.id}`}>
              <Button variant="secondary">View original payment</Button>
            </Link>
          ) : null
        }
      />

      <Callout tone="neutral" title="This is a new transfer, not a reversal">
        The refund creates a separate USDT transaction from your payout wallet to the customer. The original
        payment transaction remains on the ledger exactly as it settled.
      </Callout>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Refund details" />
          <div className="grid gap-x-8 px-5 py-2 sm:grid-cols-2">
            <KeyValue label="Refund ID">
              <code className="font-mono text-[11.5px]">{refund.id}</code>
            </KeyValue>
            <KeyValue label="Original payment">
              {payment ? (
                <Link to={`/payments/${payment.id}`} className="font-mono text-[11.5px] text-accent hover:underline">
                  {payment.id}
                </Link>
              ) : (
                refund.paymentId
              )}
            </KeyValue>
            <KeyValue label="Refund amount">
              <AmountDisplay base={refund.amount} />
            </KeyValue>
            <KeyValue label="Original amount">
              {payment ? <AmountDisplay base={payment.amount} /> : "—"}
            </KeyValue>
            <KeyValue label="Reason">{refund.reason}</KeyValue>
            <KeyValue label="Created">{fmtDateTime(refund.createdAt)}</KeyValue>
            <KeyValue label="Settled">{fmtDateTime(refund.settledAt)}</KeyValue>
            <KeyValue label="Authorization reference">
              {refund.authorizationRef ? <code className="font-mono text-[11px]">{refund.authorizationRef}</code> : "—"}
            </KeyValue>
            <KeyValue label="Transaction reference">
              <TxRefDisplay value={refund.txRef} />
            </KeyValue>
            <KeyValue label="Explorer">
              <ExplorerLinkPlaceholder txRef={refund.txRef} />
            </KeyValue>
            <KeyValue label="Gas payer">
              {refund.gasSponsored ? "GasGuard relayer (merchant budget)" : "Merchant wallet"}
            </KeyValue>
            <KeyValue label="Customer notified">
              <StatusBadge
                tone={refund.customerNotified === "delivered" ? "positive" : refund.customerNotified === "failed" ? "danger" : "neutral"}
                label={refund.customerNotified.replace(/_/g, " ")}
              />
            </KeyValue>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Parties" />
            <div className="space-y-3 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-4">Customer (refund recipient)</p>
                <p className="mt-1 text-[12.5px] font-medium text-ink">{customer?.name ?? "Guest"}</p>
                <AddressDisplay address={payment?.payerWallet} className="mt-0.5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-4">Merchant (refund sender)</p>
                <p className="mt-1 text-[12.5px] font-medium text-ink">{data.merchant.displayName}</p>
                <AddressDisplay address={data.merchant.payoutWallet} className="mt-0.5" />
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Refund limits" />
            <div className="grid grid-cols-2 gap-2.5 p-4">
              <MiniStat label="Original" value={payment ? `${(Number(payment.amount) / 1e6).toFixed(2)} ${TOKEN.symbol}` : "—"} />
              <MiniStat label="Already refunded" value={payment ? `${(Number(payment.refundedAmount) / 1e6).toFixed(2)} ${TOKEN.symbol}` : "—"} />
              <MiniStat label="This refund" value={`${(Number(refund.amount) / 1e6).toFixed(2)} ${TOKEN.symbol}`} />
              <MiniStat
                label="Remaining after"
                value={
                  payment
                    ? `${(
                        (Number(payment.amount) - Number(payment.refundedAmount) - Number(refund.amount)) /
                        1e6
                      ).toFixed(2)} ${TOKEN.symbol}`
                    : "—"
                }
              />
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="text-[11.5px] leading-relaxed text-ink-4">
                Cumulative refunds can never exceed the original settled amount. Validation runs in the
                service layer using base-unit arithmetic.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Refund timeline" description="Simulated steps in demo mode" />
        <div className="px-5 py-4">
          <Timeline entries={timeline} />
        </div>
      </Card>
    </>
  );
}
