import { Link, useParams } from "react-router-dom";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { useDemo } from "@/store/demoStore";
import { FULFILMENT_STATUS_META } from "@/config/ui";
import { TOKEN } from "@/config/app";
import { fmtDateTime } from "@/lib/money";
import { Button, Callout, Card, CardHeader, EmptyState, KeyValue, StatusBadge } from "@/components/ui";
import { AmountDisplay, Timeline } from "@/components/ui/display";
import { FULFILMENT_TONES } from "@/components/ui/statusTones";

export function CustomerOrderView() {
  const { id = "" } = useParams();
  const data = useDemo((s) => s.data);
  const order = data.fulfilment.find((o) => o.id === id);
  const payment = data.payments.find((p) => p.id === order?.paymentId);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-[12px] font-bold text-white">
            {data.merchant.logoText}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight text-ink">{data.merchant.displayName}</p>
            <p className="text-[11.5px] text-ink-4">Order status</p>
          </div>
          <a href="#/dashboard" className="ml-auto text-[12.5px] font-medium text-ink-3 hover:text-ink">
            Merchant view
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5 py-8">
        <div className="flex items-center gap-2 text-[12.5px] text-ink-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          <a href="#/dashboard" className="hover:text-ink">
            Back to gateway
          </a>
        </div>

        {!order ? (
          <Card>
            <EmptyState
              icon={<PackageCheck className="h-5 w-5" />}
              title="Order not found"
              description={`No order with reference ${id}. In production this page is protected by a customer-specific link.`}
            />
          </Card>
        ) : (
          <>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <p className="text-[11.5px] text-ink-4">Order reference</p>
                  <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{order.orderReference}</h1>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">Placed {fmtDateTime(order.updatedAt)}</p>
                </div>
                <StatusBadge
                  label={FULFILMENT_STATUS_META[order.status].label}
                  tone={FULFILMENT_TONES[order.status]}
                />
              </div>
              <div className="grid gap-x-8 px-5 py-3 sm:grid-cols-2">
                <KeyValue label="Order amount">
                  <AmountDisplay base={order.amount} symbol={TOKEN.symbol} />
                </KeyValue>
                <KeyValue label="Payment">
                  {payment ? (
                    <Link to={`/payments/${payment.id}`} className="text-accent hover:underline">
                      {payment.id}
                    </Link>
                  ) : (
                    order.paymentId
                  )}
                </KeyValue>
                <KeyValue label="Payment status">
                  <StatusBadge label={(payment?.status ?? "unknown").replace(/_/g, " ")} tone={payment?.status === "succeeded" ? "positive" : "warn"} />
                </KeyValue>
                <KeyValue label="Tracking number">{order.trackingNumber ?? "—"}</KeyValue>
                <KeyValue label="Completion link">
                  {order.completionUrl ? (
                    <a href={order.completionUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Open link
                    </a>
                  ) : (
                    "Not available yet"
                  )}
                </KeyValue>
                <KeyValue label="Last update">{fmtDateTime(order.updatedAt)}</KeyValue>
              </div>
              <div className="border-t border-line px-5 py-4">
                <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-4">Merchant update</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{order.customerNotes}</p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Fulfilment updates" description="Reported by the merchant" />
              <div className="px-5 py-4">
                <Timeline
                  entries={[...order.timeline]
                    .reverse()
                    .filter((e) => e.customerVisible)
                    .map((e, i) => ({
                      label: FULFILMENT_STATUS_META[e.status].label,
                      detail: e.note,
                      at: e.at,
                      state: i === 0 ? "current" : "done",
                    }))}
                />
              </div>
            </Card>

            <Callout tone="neutral" title="How fulfilment status works">
              Fulfilment status on this page is reported by the merchant. The gateway does not independently
              verify delivery, does not act as escrow, and does not hold funds. If something looks wrong,
              contact {data.merchant.supportEmail}.
            </Callout>

            {payment?.status === "succeeded" ? (
              <div className="flex flex-wrap gap-2">
                <a href={`#/receipt/${payment.id}`}>
                  <Button variant="secondary">View payment receipt</Button>
                </a>
                {order.completionUrl ? (
                  <a href={order.completionUrl} target="_blank" rel="noreferrer">
                    <Button variant="primary">Open completion link</Button>
                  </a>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
