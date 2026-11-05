import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  Eye,
  ExternalLink,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { PAYMENT_STATUS_META, REFUND_STATUS_META } from "@/config/ui";
import { cmpBase, downloadText, fmtAmount, fmtDateTime, fmtNumber, fromBase, subBase, toBase } from "@/lib/money";
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
  PageHeader,
  Tabs,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay, ExplorerLinkPlaceholder, StatusBadge, Timeline, TxRefDisplay } from "@/components/ui/display";
import { PAYMENT_TONES, REFUND_TONES } from "@/components/ui/statusTones";
import { CreatePaymentDialog, RefundDialog } from "@/components/common/dialogs";
import { PayeeShieldPanel } from "@/features/payeesield/PayeeShield";
import type { Payment, TimelineEntry } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

const kindLabels: Record<string, string> = {
  one_time: "One-time",
  payment_link: "Payment link",
  invoice: "Invoice",
  subscription: "Subscription",
  usage: "Usage-based",
};

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

export function PaymentsList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (() => {
    const status = searchParams.get("status");
    if (status === "succeeded") return "settled";
    if (status === "pending") return "pending";
    if (status === "problems") return "problems";
    return "all";
  })();
  const [createOpen, setCreateOpen] = useState(false);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [amountError, setAmountError] = useState<string | null>(null);

  const rows = useMemo(() => {
    return [...data.payments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((p) => {
        if (tab === "settled" && !["succeeded", "partially_refunded", "refunded"].includes(p.status)) return false;
        if (tab === "pending" && !["created", "requires_authorization", "authorized", "submitted", "pending_confirmation"].includes(p.status)) return false;
        if (tab === "problems" && !["failed", "expired", "cancelled", "exception", "underpaid", "overpaid"].includes(p.status)) return false;
        if (minAmount && cmpBase(p.amount, toBase(minAmount)) < 0) return false;
        if (maxAmount && cmpBase(p.amount, toBase(maxAmount)) > 0) return false;
        if (fromDate && new Date(p.createdAt) < new Date(`${fromDate}T00:00:00`)) return false;
        if (toDate && new Date(p.createdAt) > new Date(`${toDate}T23:59:59`)) return false;
        return true;
      });
  }, [data.payments, tab, minAmount, maxAmount, fromDate, toDate]);

  const columns: Column<Payment>[] = [
    {
      key: "id",
      header: "Payment ID",
      render: (p) => <span className="font-mono text-[18px] text-ink">{p.id}</span>,
      sortValue: (p) => p.id,
      csv: (p) => p.id,
    },
    {
      key: "customer",
      header: "Customer",
      render: (p) =>
        p.customerId ? (
          <span className="text-ink">{data.customers.find((c) => c.id === p.customerId)?.name ?? p.customerId}</span>
        ) : (
          <span className="text-ink-4">{p.customerEmail ?? "Guest"}</span>
        ),
      csv: (p) => data.customers.find((c) => c.id === p.customerId)?.name ?? p.customerEmail ?? "Guest",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <div className="text-right">
          <AmountDisplay base={p.receivedAmount ?? p.amount} className="text-[18px]" />
          {p.refundedAmount !== "0" ? (
            <p className="text-[16px] text-accent">−{fmtAmount(p.refundedAmount)} refunded</p>
          ) : null}
        </div>
      ),
      sortValue: (p) => Number(fromBase(p.amount)),
      csv: (p) => fromBase(p.amount),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge label={PAYMENT_STATUS_META[p.status].label} tone={PAYMENT_TONES[p.status]} />,
      csv: (p) => PAYMENT_STATUS_META[p.status].label,
    },
    {
      key: "kind",
      header: "Method",
      hideOnMobile: true,
      render: (p) => <span className="whitespace-nowrap text-ink-3">{kindLabels[p.kind]}</span>,
      csv: (p) => p.kind,
    },
    {
      key: "created",
      header: "Created",
      hideOnMobile: true,
      render: (p) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(p.createdAt)}</span>,
      sortValue: (p) => new Date(p.createdAt).getTime(),
      csv: (p) => p.createdAt,
    },
    {
      key: "settled",
      header: "Settled",
      hideOnMobile: true,
      render: (p) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(p.settledAt)}</span>,
      csv: (p) => p.settledAt ?? "",
    },
    {
      key: "tx",
      header: "Transaction",
      hideOnMobile: true,
      render: (p) => <TxRefDisplay value={p.txRef} size="xs" />,
      csv: (p) => p.txRef ?? "",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <Link to={`/payments/${p.id}`} className="inline-flex items-center gap-1 text-[18px] font-medium text-accent hover:underline">
          View
          <ChevronRight className="h-3 w-3" />
        </Link>
      ),
    },
  ];

  function applyAmounts() {
    if (minAmount && !/^\d*\.?\d*$/.test(minAmount)) {
      setAmountError("Minimum amount must be a number");
      return;
    }
    if (maxAmount && !/^\d*\.?\d*$/.test(maxAmount)) {
      setAmountError("Maximum amount must be a number");
      return;
    }
    if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) {
      setAmountError("Minimum cannot exceed maximum");
      return;
    }
    setAmountError(null);
  }

  function changeTab(next: string) {
    setTab(next);
    setSearchParams(next === "all" ? {} : { status: next });
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every USDT payment attempt created through the gateway, with settlement status kept separate from delivery status."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<FileText className="h-4 w-4" />}>
            Create payment
          </Button>
        }
      />

      <Card>
        <div className="px-6 pt-2">
          <Tabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { id: "all", label: "All", count: data.payments.length },
              { id: "settled", label: "Settled", count: data.payments.filter((p) => ["succeeded", "partially_refunded", "refunded"].includes(p.status)).length },
              { id: "pending", label: "Pending", count: data.payments.filter((p) => ["created", "requires_authorization", "authorized", "submitted", "pending_confirmation"].includes(p.status)).length },
              { id: "problems", label: "Needs attention", count: data.payments.filter((p) => ["failed", "expired", "cancelled", "exception", "underpaid", "overpaid"].includes(p.status)).length },
            ]}
          />
        </div>
        <div className="grid gap-5 border-b border-line bg-canvas/50 px-6 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="From date">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="To date">
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
          <Field label={`Min amount (${TOKEN.symbol})`}>
            <Input inputMode="decimal" placeholder="0.00" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </Field>
          <Field label={`Max amount (${TOKEN.symbol})`} error={amountError}>
            <div className="flex gap-2">
              <Input inputMode="decimal" placeholder="1,000.00" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              <Button size="md" variant="secondary" onClick={applyAmounts}>
                Apply
              </Button>
            </div>
          </Field>
        </div>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          onRowClick={(p) => navigate(`/payments/${p.id}`)}
          searchPlaceholder="Search by payment ID, customer or description…"
          searchValue={(p) =>
            `${p.id} ${p.description} ${p.customerEmail ?? ""} ${data.customers.find((c) => c.id === p.customerId)?.name ?? ""} ${p.txRef ?? ""}`
          }
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...Object.entries(PAYMENT_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ],
              match: (p, v) => p.status === v,
            },
            {
              key: "kind",
              label: "Type",
              options: [
                { value: "all", label: "All types" },
                ...Object.entries(kindLabels).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (p, v) => p.kind === v,
            },
            {
              key: "customer",
              label: "Customer",
              options: [
                { value: "all", label: "All customers" },
                { value: "guest", label: "Guest checkout" },
                ...data.customers.map((c) => ({ value: c.id, label: c.name })),
              ],
              match: (p, v) => (v === "guest" ? !p.customerId : p.customerId === v),
            },
            {
              key: "token",
              label: "Token",
              options: [{ value: "all", label: `${TOKEN.symbol}` }],
              match: () => true,
            },
            {
              key: "network",
              label: "Network",
              options: [{ value: "all", label: DEFAULT_NETWORK.name }],
              match: () => true,
            },
          ]}
          emptyTitle="No payments match these filters"
          emptyDescription="Try clearing the date range or amount filters, or create a new payment."
          emptyAction={
            <Button variant="secondary" onClick={() => { setFromDate(""); setToDate(""); setMinAmount(""); setMaxAmount(""); setTab("all"); }}>
              Clear filters
            </Button>
          }
          exportName="payments"
          pageSize={10}
        />
      </Card>

      <CreatePaymentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export function PaymentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [refundOpen, setRefundOpen] = useState(false);

  const payment = data.payments.find((p) => p.id === id);
  if (!payment) {
    return (
      <Card>
        <EmptyState
          title="Payment not found"
          description={`No payment with ID ${id} exists in this workspace.`}
          action={<Button variant="secondary" onClick={() => navigate("/payments")}>Back to payments</Button>}
        />
      </Card>
    );
  }

  const customer = data.customers.find((c) => c.id === payment.customerId);
  const invoice = data.invoices.find((i) => i.id === payment.invoiceId);
  const refunds = data.refunds.filter((r) => r.paymentId === payment.id);
  const fulfilment = data.fulfilment.find((f) => f.paymentId === payment.id);
  const events = data.webhookEvents.filter((e) => e.relatedPaymentId === payment.id);
  const subscription = data.subscriptions.find((s) => s.id === payment.subscriptionId);
  const link = data.paymentLinks.find((l) => l.id === payment.paymentLinkId);
  const remaining = subBase(payment.amount, payment.refundedAmount);

  const exportDetails = () => {
    const details = {
      id: payment.id,
      merchant: data.merchant.businessName,
      customer: customer?.name ?? payment.customerEmail ?? "Guest",
      amount: fromBase(payment.amount),
      token: payment.token,
      network: payment.network,
      status: payment.status,
      createdAt: payment.createdAt,
      settledAt: payment.settledAt,
      payer: payment.payerWallet,
      payoutWallet: payment.payoutWallet,
      refunded: fromBase(payment.refundedAmount),
      remainingRefundable: fromBase(remaining),
      demoTransactionReference: payment.txRef,
      authorizationReference: payment.authorizationRef,
      note: "Exported from the EzPayz frontend demo. Transaction references are simulated.",
    };
    downloadText(`${payment.id}.json`, JSON.stringify(details, null, 2), "application/json");
    pushToast({ title: "Payment details exported", body: `${payment.id}.json downloaded.`, tone: "success" });
  };

  const timeline: TimelineEntry[] = payment.timeline.map((t, i) => ({
    label: t.label,
    detail: t.detail,
    at: t.at,
    state: i === payment.timeline.length - 1 ? "current" : "done",
    simulated: t.simulated,
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payments", to: "/payments" }, { label: payment.id }]}
        title={payment.description}
        description={`Created ${fmtDateTime(payment.createdAt)} · ${kindLabels[payment.kind]}`}
        meta={
          <>
            <StatusBadge label={PAYMENT_STATUS_META[payment.status].label} tone={PAYMENT_TONES[payment.status]} />
            <span className="font-mono text-[16px] text-ink-4">{payment.id}</span>
            {payment.gasSponsored ? <StatusBadge label="Gas sponsored" tone="accent" dot={false} /> : null}
          </>
        }
        actions={
          <>
            {customer ? (
              <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => navigate(`/customers/${customer.id}`)}>
                View customer
              </Button>
            ) : null}
            {invoice ? (
              <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => navigate(`/invoices/${invoice.id}`)}>
                View invoice
              </Button>
            ) : null}
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportDetails}>
              Export details
            </Button>
            {["succeeded", "partially_refunded", "overpaid"].includes(payment.status) ? (
              <Button variant="primary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setRefundOpen(true)}>
                Issue refund
              </Button>
            ) : null}
          </>
        }
      />

      {payment.failureReason ? (
        <Callout tone={["failed", "exception"].includes(payment.status) ? "danger" : "warn"} title="Status note">
          {payment.failureReason}
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Payment summary" />
            <div className="grid gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
              <KeyValue label="Payment ID">
                <code className="font-mono text-[16px]">{payment.id}</code>
              </KeyValue>
              <KeyValue label="Merchant">{data.merchant.displayName}</KeyValue>
              <KeyValue label="Customer">
                {customer ? (
                  <Link to={`/customers/${customer.id}`} className="text-accent hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  payment.customerEmail ?? "Guest checkout"
                )}
              </KeyValue>
              <KeyValue label="Amount requested">
                <AmountDisplay base={payment.amount} />
              </KeyValue>
              {payment.receivedAmount ? (
                <KeyValue label="Amount received">
                  <AmountDisplay base={payment.receivedAmount} />
                </KeyValue>
              ) : null}
              <KeyValue label="Refunded">
                <AmountDisplay base={payment.refundedAmount} />
              </KeyValue>
              <KeyValue label="Remaining refundable">
                <AmountDisplay base={remaining} />
              </KeyValue>
              <KeyValue label="Token">
                {payment.token} · <span className="font-normal text-ink-3">{TOKEN.name}</span>
              </KeyValue>
              <KeyValue label="Network">
                {payment.network} · chain {DEFAULT_NETWORK.chainId}
              </KeyValue>
              <KeyValue label="Payment type">{kindLabels[payment.kind]}</KeyValue>
              <KeyValue label="Created">{fmtDateTime(payment.createdAt)}</KeyValue>
              <KeyValue label="Settled">{fmtDateTime(payment.settledAt)}</KeyValue>
              <KeyValue label="Expires">{fmtDateTime(payment.expiresAt)}</KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment timeline" description="Each step is simulated in demo mode" />
            <div className="px-6 py-5">
              <Timeline entries={timeline} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Settlement and delivery" />
            <div className="grid gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
              <KeyValue label="Authorization status">
                {payment.authorizationRef ? (
                  <span className="text-positive">Received</span>
                ) : payment.status === "requires_authorization" || payment.status === "created" ? (
                  <span className="text-warn">Awaiting payer</span>
                ) : (
                  <span className="text-ink-4">Not applicable</span>
                )}
              </KeyValue>
              <KeyValue label="Authorization reference">
                {payment.authorizationRef ? (
                  <code className="font-mono text-[16px]">{payment.authorizationRef}</code>
                ) : (
                  "—"
                )}
              </KeyValue>
              <KeyValue label="Relayer submission">
                {payment.txRef ? <span className="text-positive">Submitted (simulated)</span> : <span className="text-ink-4">Not submitted</span>}
              </KeyValue>
              <KeyValue label="Gas sponsorship">
                {payment.gasSponsored ? "Merchant-sponsored" : "Payer or merchant paid gas"}
              </KeyValue>
              <KeyValue label="Transaction reference">
                <TxRefDisplay value={payment.txRef} />
              </KeyValue>
              <KeyValue label="Explorer">
                <ExplorerLinkPlaceholder txRef={payment.txRef} />
              </KeyValue>
              <Divider className="sm:col-span-2" />
              <KeyValue label="Paid receipt email">
                <StatusBadge
                  tone={
                    payment.receiptEmail === "delivered" || payment.receiptEmail === "sent"
                      ? "positive"
                      : payment.receiptEmail === "failed"
                        ? "danger"
                        : "neutral"
                  }
                  label={payment.receiptEmail.replace(/_/g, " ")}
                />
              </KeyValue>
              <KeyValue label="Webhook events">
                {events.length ? (
                  <Link to="/developers/events" className="text-accent hover:underline">
                    {events.length} event{events.length > 1 ? "s" : ""}
                  </Link>
                ) : (
                  "None"
                )}
              </KeyValue>
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="text-[16px] leading-relaxed text-ink-4">
                Settlement status is independent of email and webhook delivery. A payment is only marked
                successful after the settlement record is verified — never because a frontend callback
                returned.
              </p>
            </div>
          </Card>

          {refunds.length ? (
            <Card>
              <CardHeader
                title="Refund history"
                actions={
                  <Link to="/refunds" className="text-[18px] font-medium text-accent hover:underline">
                    All refunds
                  </Link>
                }
              />
              <ul className="divide-y divide-line">
                {refunds.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <Link to={`/refunds/${r.id}`} className="font-mono text-[18px] text-accent hover:underline">
                        {r.id}
                      </Link>
                      <p className="mt-0.5 max-w-md text-[18px] text-ink-3">{r.reason}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <AmountDisplay base={r.amount} className="text-[18px]" />
                      <StatusBadge label={REFUND_STATUS_META[r.status].label} tone={REFUND_TONES[r.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Wallets" />
            <div className="space-y-3 px-6 py-5">
              <div>
                <p className="flex items-center gap-1.5 text-[16px] font-medium uppercase tracking-wide text-ink-4">
                  <Wallet className="h-3 w-3" /> Payer wallet
                </p>
                <p className="mt-1 break-all font-mono text-[16px] text-ink-2">{payment.payerWallet ?? "Not connected yet"}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[16px] font-medium uppercase tracking-wide text-ink-4">
                  <ShieldCheck className="h-3 w-3" /> Merchant payout wallet
                </p>
                <p className="mt-1 break-all font-mono text-[16px] text-ink-2">{payment.payoutWallet}</p>
              </div>
              <Callout tone="neutral">
                Verify the payout address before authorising large payments. The gateway signature covers
                this address but does not verify the merchant legally.
              </Callout>
            </div>
          </Card>

          <PayeeShieldPanel record={payment.payeeShield} target={{ paymentId: payment.id }} compact />

          <Card>
            <CardHeader title="Related records" />
            <div className="divide-y divide-line">
              {[
                invoice ? { label: "Invoice", value: invoice.title, to: `/invoices/${invoice.id}` } : null,
                link ? { label: "Payment link", value: link.title, to: `/payment-links/${link.id}` } : null,
                subscription ? { label: "Subscription", value: subscription.id, to: `/subscriptions/${subscription.id}` } : null,
                fulfilment ? { label: "Fulfilment order", value: fulfilment.orderReference, to: `/fulfilment/${fulfilment.id}` } : null,
              ]
                .filter(Boolean)
                .map((r) => (
                  <Link
                    key={r!.to}
                    to={r!.to}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-[18px] transition-colors hover:bg-canvas"
                  >
                    <span className="text-ink-3">{r!.label}</span>
                    <span className="flex items-center gap-1 font-medium text-accent">
                      {r!.value}
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              {!invoice && !link && !subscription && !fulfilment ? (
                <p className="px-6 py-5 text-[18px] text-ink-4">
                  No invoice, link, subscription or fulfilment record is attached to this payment.
                </p>
              ) : null}
            </div>
          </Card>

          {fulfilment ? (
            <Card>
              <CardHeader title="Fulfilment" />
              <div className="space-y-2 px-6 py-5">
                <StatusBadge
                  label={fulfilment.status.replace(/_/g, " ")}
                  tone={fulfilment.status === "fulfilled" ? "positive" : fulfilment.status === "not_started" ? "neutral" : "info"}
                />
                <p className="text-[18px] leading-relaxed text-ink-3">{fulfilment.customerNotes}</p>
                <Button size="sm" variant="secondary" onClick={() => navigate(`/fulfilment/${fulfilment.id}`)}>
                  Manage fulfilment
                </Button>
              </div>
            </Card>
          ) : null}

          {events.length ? (
            <Card>
              <CardHeader title="Webhook deliveries" />
              <ul className="divide-y divide-line">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <code className="font-mono text-[16px] text-ink-2">{e.type}</code>
                    <StatusBadge
                      tone={e.status === "delivered" ? "positive" : "danger"}
                      label={`HTTP ${e.responseStatus ?? "—"} · ${e.attempts} attempt${e.attempts > 1 ? "s" : ""}`}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      {payment.status === "exception" ? (
        <Callout tone="danger" title="Exception on this payment" icon={<AlertTriangle className="h-4 w-4" />}>
          The relayer could not complete submission. Open the exception centre to re-check the transaction
          or resolve it.{" "}
          <Link to="/exceptions" className="font-semibold underline">
            Go to exceptions
          </Link>
        </Callout>
      ) : null}

      <RefundDialog payment={payment} open={refundOpen} onClose={() => setRefundOpen(false)} />

      <p className="text-center text-[16px] text-ink-4">
        {fmtNumber(data.payments.length)} payment records in this workspace · demo data persisted locally
      </p>
    </>
  );
}
