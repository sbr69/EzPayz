import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PackageCheck, Save } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { FULFILMENT_STATUS_META } from "@/config/ui";
import { TOKEN } from "@/config/app";
import { fmtDateTime, isHttpsUrl, timeAgo } from "@/lib/money";
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
  Textarea,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay, Timeline } from "@/components/ui/display";
import { FULFILMENT_TONES } from "@/components/ui/statusTones";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { FulfilmentOrder, FulfilmentStatus } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

const statusOptions: FulfilmentStatus[] = [
  "not_started",
  "processing",
  "fulfilled",
  "cancelled",
  "return_requested",
  "refund_initiated",
  "refunded",
];

export function FulfilmentList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();

  const rows = useMemo(
    () => [...data.fulfilment].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [data.fulfilment],
  );

  const columns: Column<FulfilmentOrder>[] = [
    {
      key: "order",
      header: "Order",
      render: (o) => (
        <div>
          <Link to={`/fulfilment/${o.id}`} className="font-medium text-ink hover:text-accent hover:underline">
            {o.orderReference}
          </Link>
          <p className="font-mono text-[16px] text-ink-4">{o.paymentId}</p>
        </div>
      ),
      csv: (o) => o.orderReference,
    },
    {
      key: "customer",
      header: "Customer",
      render: (o) => data.customers.find((c) => c.id === o.customerId)?.name ?? "Guest",
      csv: (o) => data.customers.find((c) => c.id === o.customerId)?.name ?? "Guest",
    },
    {
      key: "product",
      header: "Product / service",
      hideOnMobile: true,
      render: (o) => data.products.find((p) => p.id === o.productId)?.name ?? "Custom engagement",
      csv: (o) => data.products.find((p) => p.id === o.productId)?.name ?? "Custom engagement",
    },
    { key: "amount", header: "Amount", align: "right", render: (o) => <AmountDisplay base={o.amount} className="text-[18px]" />, csv: (o) => o.amount },
    {
      key: "status",
      header: "Fulfilment",
      render: (o) => <StatusBadge label={FULFILMENT_STATUS_META[o.status].label} tone={FULFILMENT_TONES[o.status]} />,
      csv: (o) => FULFILMENT_STATUS_META[o.status].label,
    },
    {
      key: "updated",
      header: "Last updated",
      render: (o) => <span className="text-[18px] text-ink-3">{timeAgo(o.updatedAt)}</span>,
      sortValue: (o) => new Date(o.updatedAt).getTime(),
      csv: (o) => o.updatedAt,
    },
  ];

  return (
    <>
      <PageHeader
        title="Fulfilment"
        description="DeliveryGuard tracks merchant-reported fulfilment status. It is not escrow and does not hold funds."
        meta={
          <>
            <StatusBadge label="Merchant-reported status" tone="neutral" dot={false} />
            <StatusBadge label="Not escrow" tone="warn" dot={false} />
          </>
        }
      />

      <Callout tone="neutral" title="What DeliveryGuard does">
        It records what the merchant reports about delivery, gives the customer a status page, and links
        fulfilment to the payment record. It does not independently prove delivery and it never holds or
        releases funds.
      </Callout>

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(o) => o.id}
          onRowClick={(o) => navigate(`/fulfilment/${o.id}`)}
          searchPlaceholder="Search orders…"
          searchValue={(o) => `${o.orderReference} ${o.paymentId} ${o.customerNotes}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...statusOptions.map((s) => ({ value: s, label: FULFILMENT_STATUS_META[s].label })),
              ],
              match: (o, v) => o.status === v,
            },
          ]}
          emptyTitle="No fulfilment records"
          emptyDescription="Fulfilment records are created automatically when a payment with a product settles."
          emptyAction={
            <Link to="/payments">
              <Button variant="secondary">Go to payments</Button>
            </Link>
          }
          exportName="fulfilment"
        />
      </Card>
    </>
  );
}

export function FulfilmentDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [form, setForm] = useState<{ status: FulfilmentStatus; trackingNumber: string; completionUrl: string; merchantNotes: string; customerNotes: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const order = data.fulfilment.find((o) => o.id === id);
  if (!order) {
    return (
      <Card>
        <EmptyState
          icon={<PackageCheck className="h-5 w-5" />}
          title="Order not found"
          description={`No fulfilment record with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/fulfilment")}>Back to fulfilment</Button>}
        />
      </Card>
    );
  }

  const payment = data.payments.find((p) => p.id === order.paymentId);
  const customer = data.customers.find((c) => c.id === order.customerId);
  const draft = form ?? {
    status: order.status,
    trackingNumber: order.trackingNumber ?? "",
    completionUrl: order.completionUrl ?? "",
    merchantNotes: order.merchantNotes,
    customerNotes: order.customerNotes,
  };

  const timeline: import("@/types").TimelineEntry[] = [...order.timeline]
    .reverse()
    .map((e, i) => ({ label: FULFILMENT_STATUS_META[e.status].label, detail: e.note, at: e.at, state: i === 0 ? "current" : "done" }));

  function validate() {
    const next: Record<string, string | null> = {
      completionUrl: draft.completionUrl && !isHttpsUrl(draft.completionUrl) ? "Enter a valid URL" : null,
      trackingNumber: draft.trackingNumber && draft.trackingNumber.length > 40 ? "Max 40 characters" : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  const important: FulfilmentStatus[] = ["fulfilled", "cancelled", "refund_initiated", "refunded"];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Fulfilment", to: "/fulfilment" }, { label: order.orderReference }]}
        title={`Order ${order.orderReference}`}
        description={`${customer?.name ?? "Guest"} · updated ${timeAgo(order.updatedAt)}`}
        meta={
          <>
            <StatusBadge label={FULFILMENT_STATUS_META[order.status].label} tone={FULFILMENT_TONES[order.status]} />
            <span className="font-mono text-[16px] text-ink-4">{order.id}</span>
          </>
        }
        actions={
          <>
            <a href={`#/order/${order.id}`} target="_blank" rel="noreferrer">
              <Button variant="secondary">Customer order view</Button>
            </a>
            {payment ? (
              <Link to={`/payments/${payment.id}`}>
                <Button variant="secondary">View payment</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Update fulfilment" description="Changes are visible to the customer on their order page when marked visible." />
          <div className="space-y-4 px-6 py-5">
            <Field label="Fulfilment status" required>
              <Select
                value={draft.status}
                onChange={(e) => setForm({ ...draft, status: e.target.value as FulfilmentStatus })}
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {FULFILMENT_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tracking number" error={errors.trackingNumber}>
                <Input
                  value={draft.trackingNumber}
                  invalid={Boolean(errors.trackingNumber)}
                  onChange={(e) => setForm({ ...draft, trackingNumber: e.target.value })}
                  placeholder="DHL-4820119"
                />
              </Field>
              <Field label="Completion URL" error={errors.completionUrl}>
                <Input
                  value={draft.completionUrl}
                  invalid={Boolean(errors.completionUrl)}
                  onChange={(e) => setForm({ ...draft, completionUrl: e.target.value })}
                  placeholder="https://company.example/download"
                />
              </Field>
            </div>
            <Field label="Customer-visible note" hint="Shown on the customer order page.">
              <Textarea value={draft.customerNotes} onChange={(e) => setForm({ ...draft, customerNotes: e.target.value })} />
            </Field>
            <Field label="Merchant-only note" hint="Internal context, never shown to the customer.">
              <Textarea value={draft.merchantNotes} onChange={(e) => setForm({ ...draft, merchantNotes: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setForm(null)} disabled={!form}>
                Reset
              </Button>
              <Button
                variant="primary"
                icon={<Save className="h-4 w-4" />}
                onClick={() => {
                  if (!validate()) return;
                  setConfirmOpen(true);
                }}
              >
                Save fulfilment update
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Order record" />
            <div className="px-5 py-2">
              <KeyValue label="Order ID">
                <code className="font-mono text-[16px]">{order.id}</code>
              </KeyValue>
              <KeyValue label="Reference">{order.orderReference}</KeyValue>
              <KeyValue label="Payment">
                {payment ? (
                  <Link to={`/payments/${payment.id}`} className="font-mono text-[16px] text-accent hover:underline">
                    {payment.id}
                  </Link>
                ) : (
                  order.paymentId
                )}
              </KeyValue>
              <KeyValue label="Amount">
                <AmountDisplay base={order.amount} symbol={TOKEN.symbol} />
              </KeyValue>
              <KeyValue label="Customer">{customer?.name ?? "Guest"}</KeyValue>
              <KeyValue label="Status">
                <StatusBadge label={FULFILMENT_STATUS_META[order.status].label} tone={FULFILMENT_TONES[order.status]} />
              </KeyValue>
              <KeyValue label="Updated">{fmtDateTime(order.updatedAt)}</KeyValue>
              <KeyValue label="Tracking">{order.trackingNumber ?? "—"}</KeyValue>
              <KeyValue label="Completion URL">
                {order.completionUrl ? (
                  <a href={order.completionUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Open
                  </a>
                ) : (
                  "—"
                )}
              </KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <div className="px-6 py-5">
              <Timeline entries={timeline} />
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        destructive={important.includes(draft.status)}
        title={
          important.includes(draft.status)
            ? `Change status to "${FULFILMENT_STATUS_META[draft.status].label}"?`
            : "Save fulfilment update?"
        }
        confirmLabel="Save update"
        loading={busy}
        body={
          important.includes(draft.status)
            ? "This status is shown to the customer on their order page and triggers a fulfilment.updated webhook. Fulfilment status is merchant-reported and is not independently verified by the gateway."
            : "The customer-visible note and status on the order page will be updated."
        }
        onConfirm={async () => {
          setBusy(true);
          await api.updateFulfilment(order.id, draft.status, {
            trackingNumber: draft.trackingNumber || null,
            completionUrl: draft.completionUrl || null,
            merchantNotes: draft.merchantNotes,
            customerNotes: draft.customerNotes,
          });
          setBusy(false);
          setConfirmOpen(false);
          setForm(null);
          pushToast({ title: "Fulfilment updated", body: `${order.orderReference} → ${draft.status.replace(/_/g, " ")}`, tone: "success" });
        }}
      />
    </>
  );
}
