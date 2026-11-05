import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Printer } from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { PAYMENT_STATUS_META } from "@/config/ui";
import { fmtAmount, fmtDateTime } from "@/lib/money";
import { Button, Callout, Card, CardHeader, Divider, KeyValue, PageHeader, StatusBadge } from "@/components/ui";
import { AmountDisplay, CopyButton, ExplorerLinkPlaceholder, Timeline, TxRefDisplay } from "@/components/ui/display";
import { InvoicePreview } from "@/features/invoices/InvoicePages";
import { EmptyState } from "@/components/ui/Feedback";

export function ReceiptPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const payment = data.payments.find((p) => p.id === id);
  const invoice = data.invoices.find((i) => i.paymentId === id);
  const customer = data.customers.find((c) => c.id === payment?.customerId);

  if (!payment) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Card>
          <EmptyState
            title="Receipt not found"
            description={`No payment with ID ${id}.`}
            action={<Button variant="secondary" onClick={() => navigate("/payments")}>Back to payments</Button>}
          />
        </Card>
      </div>
    );
  }

  const settled = ["succeeded", "partially_refunded", "refunded"].includes(payment.status);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payments", to: "/payments" }, { label: "Receipt" }]}
        title={settled ? "Paid receipt" : "Payment record"}
        description={`${payment.description} · ${fmtDateTime(payment.settledAt ?? payment.createdAt)}`}
        meta={
          <>
            <StatusBadge label={PAYMENT_STATUS_META[payment.status].label} tone={payment.status === "succeeded" ? "positive" : "warn"} />
            <StatusBadge label={`Receipt ${payment.receiptEmail.replace(/_/g, " ")}`} tone={payment.receiptEmail === "delivered" ? "positive" : "neutral"} dot={false} />
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="primary"
              icon={<Download className="h-4 w-4" />}
              onClick={() => {
                const blob = new Blob([document.querySelector("[data-receipt]")?.innerHTML ?? ""], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `receipt-${payment.id}.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download receipt
            </Button>
          </>
        }
      />

      {!settled ? (
        <Callout tone="warn" title="This payment has not settled">
          A paid receipt is only issued after settlement. The current status is{" "}
          <strong>{PAYMENT_STATUS_META[payment.status].label}</strong>, so treat this page as a payment record
          rather than proof of payment.
        </Callout>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Receipt" description={`${data.merchant.businessName} · ${DEFAULT_NETWORK.name}`} />
            <div data-receipt>
              <div className="px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-[18px] font-bold text-white">
                        {data.merchant.logoText}
                      </span>
                      <div>
                        <p className="text-[20px] font-semibold text-ink">{data.merchant.displayName}</p>
                        <p className="text-[16px] text-ink-4">{data.merchant.businessEmail}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1.5 text-[18px] font-semibold text-positive">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {settled ? "PAID" : PAYMENT_STATUS_META[payment.status].label.toUpperCase()}
                    </p>
                    <p className="font-mono text-[16px] text-ink-4">{payment.id}</p>
                    <p className="whitespace-nowrap text-[16px] text-ink-3 tnum">{fmtDateTime(payment.settledAt ?? payment.createdAt)}</p>
                  </div>
                </div>

                <Divider className="my-5" />

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">Paid by</p>
                    <p className="mt-1 text-[18px] font-medium text-ink">{customer?.name ?? payment.customerEmail ?? "Guest checkout"}</p>
                    {payment.payerWallet ? (
                      <p className="mt-0.5 break-all font-mono text-[16px] text-ink-3">{payment.payerWallet}</p>
                    ) : null}
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">Amount paid</p>
                    <AmountDisplay base={payment.receivedAmount ?? payment.amount} className="text-[26px]" />
                    {payment.refundedAmount !== "0" ? (
                      <p className="mt-0.5 text-[16px] text-accent">
                        {fmtAmount(payment.refundedAmount)} {TOKEN.symbol} refunded
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-md border border-line bg-canvas/60 p-4">
                  <div className="flex items-center justify-between gap-4 text-[18px]">
                    <span className="text-ink-2">{payment.description}</span>
                    <span className="font-semibold text-ink tnum">
                      {fmtAmount(payment.receivedAmount ?? payment.amount)} {TOKEN.symbol}
                    </span>
                  </div>
                  <Divider className="my-3" />
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[18px] font-semibold text-ink">Total paid</span>
                    <AmountDisplay base={payment.receivedAmount ?? payment.amount} className="text-[22px]" />
                  </div>
                </div>

                <p className="mt-4 text-[16px] leading-relaxed text-ink-4">
                  Settlement asset: {TOKEN.name} on {DEFAULT_NETWORK.name} (chain {DEFAULT_NETWORK.chainId}).
                  Receipts are emailed after settlement. This is a demo receipt generated in your browser —
                  no PDF is produced and no on-chain settlement took place.
                </p>
              </div>
            </div>
          </Card>

          {invoice ? (
            <Card>
              <CardHeader title={`Invoice ${invoice.id}`} description={invoice.title} />
              <InvoicePreview invoice={invoice} merchantName={data.merchant.displayName} />
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Settlement details" />
            <div className="px-5 py-2">
              <KeyValue label="Payment ID">
                <code className="font-mono text-[16px]">{payment.id}</code>
                <CopyButton value={payment.id} label="Copy" size="xs" />
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge label={PAYMENT_STATUS_META[payment.status].label} tone={payment.status === "succeeded" ? "positive" : "warn"} />
              </KeyValue>
              <KeyValue label="Paid at">{fmtDateTime(payment.settledAt)}</KeyValue>
              <KeyValue label="Transaction reference">
                <TxRefDisplay value={payment.txRef} />
              </KeyValue>
              <KeyValue label="Explorer">
                <ExplorerLinkPlaceholder txRef={payment.txRef} />
              </KeyValue>
              <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
              <KeyValue label="Token">{TOKEN.symbol}</KeyValue>
              <KeyValue label="Payer wallet">
                <code className="break-all font-mono text-[16px]">{payment.payerWallet}</code>
              </KeyValue>
              <KeyValue label="Merchant payout">
                <code className="break-all font-mono text-[16px]">{payment.payoutWallet}</code>
              </KeyValue>
              <KeyValue label="Gas">
                {payment.gasSponsored ? "Sponsored by merchant" : "Paid by payer"}
              </KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Receipt delivery" description="Independent of settlement status" />
            <div className="px-5 py-2">
              <KeyValue label="Email state">
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
              <KeyValue label="Recipient">{payment.customerEmail ?? customer?.email ?? "Not provided"}</KeyValue>
              <KeyValue label="Sent at">{fmtDateTime(payment.settledAt)}</KeyValue>
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="text-[16px] leading-relaxed text-ink-4">
                Unpaid invoices are never emailed automatically. Only settled payments trigger a receipt.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="px-6 py-5">
              <Timeline
                entries={payment.timeline.map((t, i) => ({
                  label: t.label,
                  detail: t.detail,
                  at: t.at,
                  state: i === payment.timeline.length - 1 ? "current" : "done",
                  simulated: t.simulated,
                }))}
              />
            </div>
          </Card>

          <Button variant="ghost" className="w-full" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(`/payments/${payment.id}`)}>
            Back to payment detail
          </Button>
        </div>
      </div>
    </>
  );
}
