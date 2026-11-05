import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, Wrench } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import {
  EXCEPTION_SEVERITY_META,
  EXCEPTION_STATUS_META,
  EXCEPTION_TYPE_LABEL,
} from "@/config/ui";
import { fmtDateTime, timeAgo } from "@/lib/money";
import { Button, Callout, Card, CardHeader, EmptyState, KeyValue, PageHeader, Select, StatusBadge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay, Timeline, TxRefDisplay } from "@/components/ui/display";
import { EXCEPTION_SEVERITY_TONES, EXCEPTION_STATUS_TONES } from "@/components/ui/statusTones";
import { MetricCard } from "@/components/common/MetricCard";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { ExceptionActionId, PaymentException } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

const ACTION_LABEL: Record<ExceptionActionId, string> = {
  retry_webhook: "Retry webhook delivery",
  replay_event: "Replay event",
  recheck_transaction: "Re-check transaction",
  mark_for_review: "Mark for merchant review",
  create_balance_due_request: "Create balance-due request",
  initiate_refund: "Initiate refund",
  resolve: "Resolve exception",
  dismiss: "Dismiss exception",
};

export function ExceptionsList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const [severity, setSeverity] = useState("all");

  const rows = useMemo(
    () =>
      [...data.exceptions]
        .filter((e) => (severity === "all" ? true : e.severity === severity))
        .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()),
    [data.exceptions, severity],
  );

  const open = data.exceptions.filter((e) => e.status === "open").length;
  const action = data.exceptions.filter((e) => e.status === "action_required").length;
  const critical = data.exceptions.filter((e) => e.severity === "critical" && e.status !== "resolved").length;
  const resolved = data.exceptions.filter((e) => e.status === "resolved").length;

  const columns: Column<PaymentException>[] = [
    {
      key: "id",
      header: "Exception",
      render: (e) => (
        <div>
          <Link to={`/exceptions/${e.id}`} className="font-mono text-[12px] text-ink hover:text-accent hover:underline">
            {e.id}
          </Link>
          <p className="text-[11.5px] text-ink-3">{EXCEPTION_TYPE_LABEL[e.type]}</p>
        </div>
      ),
      csv: (e) => e.id,
    },
    {
      key: "type",
      header: "Type",
      render: (e) => <span className="text-[12.5px] text-ink">{EXCEPTION_TYPE_LABEL[e.type]}</span>,
      csv: (e) => EXCEPTION_TYPE_LABEL[e.type],
    },
    {
      key: "severity",
      header: "Severity",
      render: (e) => (
        <StatusBadge label={EXCEPTION_SEVERITY_META[e.severity].label} tone={EXCEPTION_SEVERITY_TONES[e.severity]} />
      ),
      csv: (e) => EXCEPTION_SEVERITY_META[e.severity].label,
    },
    {
      key: "related",
      header: "Related record",
      hideOnMobile: true,
      render: (e) => {
        if (e.paymentId)
          return (
            <Link to={`/payments/${e.paymentId}`} className="font-mono text-[11.5px] text-accent hover:underline">
              {e.paymentId}
            </Link>
          );
        if (e.subscriptionId)
          return (
            <Link to={`/subscriptions/${e.subscriptionId}`} className="font-mono text-[11.5px] text-accent hover:underline">
              {e.subscriptionId}
            </Link>
          );
        if (e.webhookEventId) return <code className="font-mono text-[11.5px]">{e.webhookEventId}</code>;
        return <span className="text-ink-4">Workspace</span>;
      },
      csv: (e) => e.paymentId ?? e.subscriptionId ?? e.webhookEventId ?? "",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (e) => (e.amount ? <AmountDisplay base={e.amount} className="text-[12.5px]" /> : <span className="text-ink-4">—</span>),
      csv: (e) => e.amount ?? "",
    },
    {
      key: "detected",
      header: "Detected",
      render: (e) => <span className="text-[12px] text-ink-3">{timeAgo(e.detectedAt)}</span>,
      sortValue: (e) => new Date(e.detectedAt).getTime(),
      csv: (e) => e.detectedAt,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusBadge label={EXCEPTION_STATUS_META[e.status].label} tone={EXCEPTION_STATUS_TONES[e.status]} />,
      csv: (e) => EXCEPTION_STATUS_META[e.status].label,
    },
    {
      key: "recommended",
      header: "Recommended action",
      hideOnMobile: true,
      render: (e) => <span className="text-[12px] text-ink-3">{ACTION_LABEL[e.recommendedAction]}</span>,
      csv: (e) => ACTION_LABEL[e.recommendedAction],
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <Link to={`/exceptions/${e.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
          Open
          <ChevronRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payment exceptions"
        description="Operational issues detected by the gateway: underpayments, relayer failures, webhook outages and reconciliation mismatches."
        actions={
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-9 w-[160px]" aria-label="Severity">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Open" value={open} tone={open ? "danger" : "neutral"} />
        <MetricCard label="Action required" value={action} tone="warn" />
        <MetricCard label="Critical unresolved" value={critical} tone={critical ? "danger" : "neutral"} />
        <MetricCard label="Resolved" value={resolved} tone="positive" />
      </div>

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(e) => e.id}
          onRowClick={(e) => navigate(`/exceptions/${e.id}`)}
          searchPlaceholder="Search exceptions…"
          searchValue={(e) => `${e.id} ${EXCEPTION_TYPE_LABEL[e.type]} ${e.whatHappened} ${e.paymentId ?? ""}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...Object.entries(EXCEPTION_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ],
              match: (e, v) => e.status === v,
            },
            {
              key: "type",
              label: "Type",
              options: [
                { value: "all", label: "All types" },
                ...Object.entries(EXCEPTION_TYPE_LABEL).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (e, v) => e.type === v,
            },
          ]}
          emptyTitle="No exceptions"
          emptyDescription="Nothing needs attention right now. Exceptions are created automatically when the gateway detects a payment, delivery or reconciliation problem."
          exportName="exceptions"
        />
      </Card>
    </>
  );
}

export function ExceptionDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [pending, setPending] = useState<{ action: ExceptionActionId; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exception = data.exceptions.find((e) => e.id === id);
  if (!exception) {
    return (
      <Card>
        <EmptyState
          title="Exception not found"
          description={`No exception with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/exceptions")}>Back to exceptions</Button>}
        />
      </Card>
    );
  }

  const payment = data.payments.find((p) => p.id === exception.paymentId);
  const subscription = data.subscriptions.find((s) => s.id === exception.subscriptionId);
  const webhookEvent = data.webhookEvents.find((e) => e.id === exception.webhookEventId);

  const timeline: import("@/types").TimelineEntry[] = exception.attempts.length
    ? exception.attempts.map((a, i) => ({
        label: a.action,
        detail: a.result,
        at: a.at,
        state: i === exception.attempts.length - 1 ? "current" : "done",
      }))
    : [];

  const actions: ExceptionActionId[] = [
    exception.recommendedAction,
    "recheck_transaction",
    "mark_for_review",
    "resolve",
    "dismiss",
  ].filter((a, i, arr) => arr.indexOf(a) === i) as ExceptionActionId[];

  const dangerous: ExceptionActionId[] = ["initiate_refund", "create_balance_due_request", "dismiss"];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Exceptions", to: "/exceptions" }, { label: exception.id }]}
        title={EXCEPTION_TYPE_LABEL[exception.type]}
        description={exception.whatHappened}
        meta={
          <>
            <StatusBadge label={EXCEPTION_SEVERITY_META[exception.severity].label} tone={EXCEPTION_SEVERITY_TONES[exception.severity]} />
            <StatusBadge label={EXCEPTION_STATUS_META[exception.status].label} tone={EXCEPTION_STATUS_TONES[exception.status]} />
            <span className="font-mono text-[11.5px] text-ink-4">{exception.id}</span>
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => navigate("/exceptions")}>
            Back to exceptions
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Diagnosis" description="What happened and why the gateway detected it" />
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">What happened</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{exception.whatHappened}</p>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Why it happened</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{exception.whyItHappened}</p>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Suggested resolution</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{exception.suggestedAction}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Related records" />
            <div className="divide-y divide-line">
              {payment ? (
                <Link to={`/payments/${payment.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div>
                    <p className="text-[12px] text-ink-3">Payment</p>
                    <code className="font-mono text-[12px] text-ink">{payment.id}</code>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={payment.receivedAmount ?? payment.amount} className="text-[12.5px]" />
                    <TxRefDisplay value={payment.txRef} size="xs" />
                  </div>
                </Link>
              ) : null}
              {subscription ? (
                <Link to={`/subscriptions/${subscription.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div>
                    <p className="text-[12px] text-ink-3">Subscription</p>
                    <code className="font-mono text-[12px] text-ink">{subscription.id}</code>
                  </div>
                  <StatusBadge label={subscription.status.replace(/_/g, " ")} tone="warn" />
                </Link>
              ) : null}
              {webhookEvent ? (
                <Link to="/developers/events" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div>
                    <p className="text-[12px] text-ink-3">Webhook event</p>
                    <code className="font-mono text-[12px] text-ink">{webhookEvent.type}</code>
                  </div>
                  <StatusBadge label={`HTTP ${webhookEvent.responseStatus}`} tone={webhookEvent.responseStatus === 200 ? "positive" : "danger"} />
                </Link>
              ) : null}
              {!payment && !subscription && !webhookEvent ? (
                <p className="px-5 py-4 text-[12.5px] text-ink-4">No payment, subscription or webhook record is linked.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Resolution history" description="Previous attempts recorded against this exception" />
            {timeline.length ? (
              <div className="px-5 py-4">
                <Timeline entries={timeline} />
              </div>
            ) : (
              <EmptyState title="No attempts yet" description="Run one of the recommended actions to record a resolution attempt." />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Exception record" />
            <div className="px-5 py-2">
              <KeyValue label="Exception ID">
                <code className="font-mono text-[11.5px]">{exception.id}</code>
              </KeyValue>
              <KeyValue label="Type">{EXCEPTION_TYPE_LABEL[exception.type]}</KeyValue>
              <KeyValue label="Severity">
                <StatusBadge label={EXCEPTION_SEVERITY_META[exception.severity].label} tone={EXCEPTION_SEVERITY_TONES[exception.severity]} />
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge label={EXCEPTION_STATUS_META[exception.status].label} tone={EXCEPTION_STATUS_TONES[exception.status]} />
              </KeyValue>
              <KeyValue label="Detected">{fmtDateTime(exception.detectedAt)}</KeyValue>
              <KeyValue label="Amount">{exception.amount ? <AmountDisplay base={exception.amount} /> : "—"}</KeyValue>
              <KeyValue label="Customer">
                {exception.customerId ? (
                  <Link to={`/customers/${exception.customerId}`} className="text-accent hover:underline">
                    {data.customers.find((c) => c.id === exception.customerId)?.name}
                  </Link>
                ) : (
                  "—"
                )}
              </KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions" description="Every action asks for confirmation" />
            <div className="space-y-2 p-4">
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === exception.recommendedAction ? "primary" : "secondary"}
                  className="w-full justify-start"
                  icon={action === "resolve" ? <CheckCircle2 className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                  onClick={() => setPending({ action, label: ACTION_LABEL[action] })}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
              <Callout tone="warn" title="Refunds are never automatic">
                Initiating a refund from an exception creates a draft that still requires your wallet
                authorization. The gateway never issues refunds on its own.
              </Callout>
            </div>
          </Card>

          {exception.status === "resolved" ? (
            <Callout tone="positive" title="Resolved">
              This exception has been resolved. The record is retained for audit.
            </Callout>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        destructive={Boolean(pending && dangerous.includes(pending.action))}
        title={pending?.label ?? ""}
        confirmLabel={pending?.label ?? "Confirm"}
        loading={busy}
        body={
          pending?.action === "initiate_refund"
            ? "A refund draft will be created for the amount involved. You still need to authorize it with your wallet before the customer receives funds."
            : pending?.action === "create_balance_due_request"
              ? "A new payment request will be created for the outstanding amount and linked to this exception."
              : pending?.action === "dismiss"
                ? "The exception will be marked as dismissed. It remains in the list for audit purposes."
                : "The gateway will run the selected operation and record the result on this exception."
        }
        onConfirm={async () => {
          if (!pending) return;
          setBusy(true);
          try {
            await api.runExceptionAction(exception.id, pending.action);
            pushToast({ title: `${pending.label} completed`, tone: "success" });
          } catch (err) {
            pushToast({ title: "Action failed", body: (err as Error).message, tone: "error" });
          } finally {
            setBusy(false);
            setPending(null);
          }
        }}
      />

      <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-ink-4">
        <AlertTriangle className="h-3.5 w-3.5" />
        {data.exceptions.filter((e) => e.status !== "resolved").length} unresolved exceptions in this workspace
      </p>
    </>
  );
}
