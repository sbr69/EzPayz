import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Eye, FileText, Plus, Printer, Send } from "lucide-react";
import { api, hostedUrl } from "@/services";
import { useDemo } from "@/store/demoStore";
import { TOKEN } from "@/config/app";
import { INVOICE_STATUS_META } from "@/config/ui";
import { addBase, fmtAmount, fmtDateTime, isEmail, mulBaseInt, toBase, validateAmount } from "@/lib/money";
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
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay, CopyButton } from "@/components/ui/display";
import { INVOICE_TONES } from "@/components/ui/statusTones";
import { PayeeShieldPanel, PayeeShieldTamperLab } from "@/features/payeesield/PayeeShield";
import type { Invoice, InvoiceLineItem } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

export function InvoicesList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);

  const rows = useMemo(
    () => [...data.invoices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.invoices],
  );

  const columns: Column<Invoice>[] = [
    {
      key: "id",
      header: "Invoice",
      render: (i) => (
        <div>
          <Link to={`/invoices/${i.id}`} className="font-mono text-[12px] text-ink hover:text-accent hover:underline">
            {i.id}
          </Link>
          <p className="text-[11.5px] text-ink-3">{i.title}</p>
        </div>
      ),
      sortValue: (i) => i.id,
      csv: (i) => i.id,
    },
    {
      key: "customer",
      header: "Customer",
      render: (i) => data.customers.find((c) => c.id === i.customerId)?.name ?? i.customerEmail,
      csv: (i) => data.customers.find((c) => c.id === i.customerId)?.name ?? i.customerEmail,
    },
    {
      key: "amount",
      header: "Total",
      align: "right",
      render: (i) => <AmountDisplay base={i.total} className="text-[12.5px]" />,
      sortValue: (i) => Number(i.total),
      csv: (i) => i.total,
    },
    {
      key: "status",
      header: "Status",
      render: (i) => <StatusBadge label={INVOICE_STATUS_META[i.status].label} tone={INVOICE_TONES[i.status]} />,
      csv: (i) => INVOICE_STATUS_META[i.status].label,
    },
    {
      key: "shield",
      header: "PayeeShield",
      hideOnMobile: true,
      render: (i) => (
        <StatusBadge
          label={i.payeeShield.status === "verified" ? "Verified" : i.payeeShield.status.replace(/_/g, " ")}
          tone={i.payeeShield.status === "verified" ? "positive" : "danger"}
          dot={false}
        />
      ),
      csv: (i) => i.payeeShield.status,
    },
    {
      key: "created",
      header: "Created",
      hideOnMobile: true,
      render: (i) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(i.createdAt)}</span>,
      sortValue: (i) => new Date(i.createdAt).getTime(),
      csv: (i) => i.createdAt,
    },
    {
      key: "expiry",
      header: "Expires",
      hideOnMobile: true,
      render: (i) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(i.expiresAt)}</span>,
      csv: (i) => i.expiresAt ?? "",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {i.status === "open" ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Send className="h-3.5 w-3.5" />}
              onClick={async () => {
                const payment = await api.createInvoicePayment(i.id);
                pushToast({
                  title: "Checkout session created",
                  body: "Share the invoice link with your customer.",
                  tone: "success",
                });
                navigate(`/payments/${payment.id}`);
              }}
            >
              Create session
            </Button>
          ) : null}
          <Link to={`/invoices/${i.id}`}>
            <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Signed payment requests with line items. PayeeShield covers the recipient, amount, token, network, expiry and reference."
        actions={
          <Link to="/invoices/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New invoice
            </Button>
          </Link>
        }
      />

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(i) => i.id}
          onRowClick={(i) => navigate(`/invoices/${i.id}`)}
          searchPlaceholder="Search invoices…"
          searchValue={(i) => `${i.id} ${i.title} ${i.customerEmail} ${i.orderReference ?? ""}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                ...Object.entries(INVOICE_STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
              ],
              match: (i, v) => i.status === v,
            },
            {
              key: "customer",
              label: "Customer",
              options: [
                { value: "all", label: "All customers" },
                ...data.customers.map((c) => ({ value: c.id, label: c.name })),
              ],
              match: (i, v) => i.customerId === v,
            },
          ]}
          emptyTitle="No invoices yet"
          emptyDescription="Create a signed invoice with line items and share it with a customer."
          emptyAction={
            <Link to="/invoices/new">
              <Button variant="primary">Create invoice</Button>
            </Link>
          }
          exportName="invoices"
        />
      </Card>

      <Callout tone="neutral" title="When receipts are emailed">
        Paid receipts are emailed after a payment settles. Unpaid invoices are never emailed automatically
        — the merchant chooses when to share the payment link.
      </Callout>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

interface DraftLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function InvoiceForm() {
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);
  const data = useDemo((s) => s.data);
  const [form, setForm] = useState({
    customerId: "",
    customerEmail: "",
    title: "",
    description: "",
    orderReference: "",
    expiresInHours: "336",
  });
  const [lines, setLines] = useState<DraftLine[]>([
    { id: "l1", description: "", quantity: "1", unitPrice: "" },
  ]);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const customer = data.customers.find((c) => c.id === form.customerId);
  const total = lines.reduce(
    (acc, l) => (l.description && l.unitPrice ? addBase(acc, mulBaseInt(toBase(l.unitPrice), Number(l.quantity) || 0)) : acc),
    "0",
  );

  function validate() {
    const next: Record<string, string | null> = {
      title: form.title.trim().length < 3 ? "Give the invoice a title" : null,
      customerEmail: !customer && !isEmail(form.customerEmail) ? "Enter a valid customer email" : null,
      customer: customer || isEmail(form.customerEmail) ? null : "Select a customer or enter an email",
      lines: null,
    };
    const valid = lines.filter((l) => l.description.trim() && l.unitPrice);
    if (valid.length === 0) next.lines = "Add at least one complete line item";
    lines.forEach((l) => {
      if (l.description.trim() && !l.unitPrice) next.lines = "Every line item needs a unit price";
      if (!l.description.trim() && l.unitPrice) next.lines = "Every line item needs a description";
      if (l.unitPrice && validateAmount(l.unitPrice)) next.lines = "Check the unit prices";
      if (Number(l.quantity) < 1 || !Number.isInteger(Number(l.quantity))) next.lines = "Quantity must be a whole number of 1 or more";
    });
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const items: InvoiceLineItem[] = lines
        .filter((l) => l.description.trim() && l.unitPrice)
        .map((l, i) => ({
          id: `li_${i}`,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: toBase(l.unitPrice),
        }));
      const invoice = await api.createInvoice({
        customerId: form.customerId || null,
        customerEmail: customer?.email ?? form.customerEmail.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        lineItems: items,
        orderReference: form.orderReference || null,
        expiresInHours: Number(form.expiresInHours),
      });
      pushToast({ title: "Invoice created and signed", body: `${invoice.id} is ready to share.`, tone: "success" });
      navigate(`/invoices/${invoice.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Invoices", to: "/invoices" }, { label: "New" }]}
        title="Create an invoice"
        description="The gateway signs the invoice with a delegated key before it is shared. The customer sees the verification result on checkout."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/invoices")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              Create and sign invoice
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader title="Invoice details" />
          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" error={errors.customer} htmlFor="iv-customer">
                <Select
                  id="iv-customer"
                  value={form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                >
                  <option value="">New / guest customer</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Customer email"
                required={!customer}
                error={errors.customerEmail}
                hint={customer ? `Using ${customer.email}` : "Used for the paid receipt."}
              >
                <Input
                  value={customer ? customer.email : form.customerEmail}
                  disabled={Boolean(customer)}
                  invalid={Boolean(errors.customerEmail)}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="billing@company.example"
                />
              </Field>
            </div>
            <Field label="Invoice title" required error={errors.title} htmlFor="iv-title">
              <Input
                id="iv-title"
                value={form.title}
                invalid={Boolean(errors.title)}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Audit sprint — 50% deposit"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Phase 1 deposit for the router contract audit."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order reference (optional)">
                <Input
                  value={form.orderReference}
                  onChange={(e) => setForm({ ...form, orderReference: e.target.value })}
                  placeholder="PO-55821"
                />
              </Field>
              <Field label="Payment window">
                <Select
                  value={form.expiresInHours}
                  onChange={(e) => setForm({ ...form, expiresInHours: e.target.value })}
                >
                  <option value="72">3 days</option>
                  <option value="336">14 days</option>
                  <option value="720">30 days</option>
                </Select>
              </Field>
            </div>

            <Divider />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-ink-2">Line items</p>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => setLines([...lines, { id: `l${lines.length + 1}`, description: "", quantity: "1", unitPrice: "" }])}
                >
                  Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, idx) => (
                  <div key={l.id} className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-6">
                      <Input
                        placeholder={idx === 0 ? "Audit sprint deposit" : "Description"}
                        value={l.description}
                        onChange={(e) =>
                          setLines(lines.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Input
                        inputMode="numeric"
                        aria-label="Quantity"
                        value={l.quantity}
                        onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, quantity: e.target.value } : x)))}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <Input
                        inputMode="decimal"
                        aria-label={`Unit price in ${TOKEN.symbol}`}
                        placeholder="1600.00"
                        value={l.unitPrice}
                        onChange={(e) => setLines(lines.map((x) => (x.id === l.id ? { ...x, unitPrice: e.target.value } : x)))}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end sm:col-span-1">
                      {lines.length > 1 ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setLines(lines.filter((x) => x.id !== l.id))}
                          aria-label="Remove line"
                        >
                          ✕
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {errors.lines ? <p className="mt-2 text-[12px] font-medium text-danger">{errors.lines}</p> : null}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Live preview" description="Updates as you type" />
            <InvoicePreview
              invoice={{
                id: "inv_preview",
                title: form.title || "Untitled invoice",
                description: form.description,
                lineItems: lines
                  .filter((l) => l.description && l.unitPrice)
                  .map((l, i) => ({ id: `p${i}`, description: l.description, quantity: Number(l.quantity) || 1, unitPrice: toBase(l.unitPrice) })),
                total,
                status: "draft",
                customerEmail: customer?.email ?? form.customerEmail,
                orderReference: form.orderReference || null,
                createdAt: new Date().toISOString(),
                expiresAt: null,
              }}
              merchantName={data.merchant.displayName}
              compact
            />
          </Card>
          <Callout tone="info" title="Signing happens on creation">
            The gateway signs the protected fields when the invoice is created. Changing any protected
            value afterwards causes verification to fail and blocks checkout.
          </Callout>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Preview component                                                   */
/* ------------------------------------------------------------------ */

export function InvoicePreview({
  invoice,
  merchantName,
  compact,
}: {
  invoice: Pick<
    Invoice,
    "id" | "title" | "description" | "lineItems" | "total" | "status" | "customerEmail" | "orderReference" | "createdAt" | "expiresAt"
  >;
  merchantName: string;
  compact?: boolean;
}) {
  return (
    <div className={`px-5 py-4 ${compact ? "" : "sm:px-8 sm:py-6"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-ink">{merchantName}</p>
          <p className="text-[11.5px] text-ink-4">USDT invoice</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11.5px] text-ink-4">{invoice.id}</p>
          <p className="text-[11.5px] text-ink-3 tnum">{fmtDateTime(invoice.createdAt)}</p>
        </div>
      </div>
      <Divider className="my-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-4">Billed to</p>
          <p className="mt-1 text-[12.5px] text-ink">{invoice.customerEmail || "—"}</p>
          {invoice.orderReference ? (
            <p className="text-[11.5px] text-ink-4">Ref {invoice.orderReference}</p>
          ) : null}
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-4">Amount due</p>
          <AmountDisplay base={invoice.total} className="text-[18px]" />
          {invoice.expiresAt ? (
            <p className="text-[11.5px] text-ink-4">Due by {fmtDateTime(invoice.expiresAt)}</p>
          ) : null}
        </div>
      </div>
      <p className="mt-5 text-[13px] font-semibold text-ink">{invoice.title}</p>
      {invoice.description ? <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{invoice.description}</p> : null}

      <table className="mt-4 w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-4">
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Unit</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {invoice.lineItems.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 text-center text-ink-4">
                No line items yet
              </td>
            </tr>
          ) : (
            invoice.lineItems.map((li) => (
              <tr key={li.id}>
                <td className="py-2 pr-2 text-ink">{li.description}</td>
                <td className="py-2 text-right text-ink-3 tnum">{li.quantity}</td>
                <td className="py-2 text-right text-ink-3 tnum">{fmtAmount(li.unitPrice)}</td>
                <td className="py-2 text-right font-medium text-ink tnum">
                  {fmtAmount(mulBaseInt(li.unitPrice, li.quantity))}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-line-strong">
            <td colSpan={3} className="py-2.5 text-right text-[12.5px] font-semibold text-ink">
              Total
            </td>
            <td className="py-2.5 text-right">
              <AmountDisplay base={invoice.total} className="text-[14px]" />
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-3 text-[11px] text-ink-4">
        Settlement in {TOKEN.symbol}. Token decimals are read from configured token metadata and are not
        verified for this contract.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export function InvoiceDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [creating, setCreating] = useState(false);
  const [tamperOpen, setTamperOpen] = useState(false);

  const invoice = data.invoices.find((i) => i.id === id);
  if (!invoice) {
    return (
      <Card>
        <EmptyState
          title="Invoice not found"
          description={`No invoice with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/invoices")}>Back to invoices</Button>}
        />
      </Card>
    );
  }

  const payment = data.payments.find((p) => p.id === invoice.paymentId);
  const customer = data.customers.find((c) => c.id === invoice.customerId);
  const sessionUrl = payment?.checkoutUrl ?? hostedUrl(`checkout/ses_${invoice.id.replace("inv_", "")}`);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Invoices", to: "/invoices" }, { label: invoice.id }]}
        title={invoice.title}
        description={`${invoice.lineItems.length} line item${invoice.lineItems.length > 1 ? "s" : ""} · created ${fmtDateTime(invoice.createdAt)}`}
        meta={
          <>
            <StatusBadge label={INVOICE_STATUS_META[invoice.status].label} tone={INVOICE_TONES[invoice.status]} />
            <StatusBadge
              label={`PayeeShield ${invoice.payeeShield.status === "verified" ? "verified" : invoice.payeeShield.status.replace(/_/g, " ")}`}
              tone={invoice.payeeShield.status === "verified" ? "positive" : "danger"}
            />
            <span className="font-mono text-[11.5px] text-ink-4">{invoice.id}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              Print
            </Button>
            {invoice.status === "paid" ? (
              <Button
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={() => {
                  pushToast({ title: "Receipt PDF", body: "Demo mode renders an HTML receipt instead of a PDF.", tone: "info" });
                  navigate(`/receipt/${invoice.paymentId}`);
                }}
              >
                View paid receipt
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setTamperOpen((v) => !v)}>
                  {tamperOpen ? "Hide tamper lab" : "Tamper simulation"}
                </Button>
                <Button
                  variant="primary"
                  icon={<Send className="h-4 w-4" />}
                  loading={creating}
                  onClick={async () => {
                    setCreating(true);
                    const p = await api.createInvoicePayment(invoice.id);
                    setCreating(false);
                    pushToast({ title: "Checkout session created", body: p.id, tone: "success" });
                    navigate(`/payments/${p.id}`);
                  }}
                >
                  Create checkout session
                </Button>
              </>
            )}
          </>
        }
      />

      {invoice.tampered ? (
        <Callout tone="danger" title="This request was modified after signing">
          Verification is failing on a protected field. The hosted checkout blocks payment until a
          correctly signed request is issued.
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Invoice" />
          <InvoicePreview invoice={invoice} merchantName={data.merchant.displayName} />
          <div className="border-t border-line px-5 py-3">
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-ink-4">Payment link</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-line bg-canvas px-2.5 py-1.5 font-mono text-[11.5px] text-ink-2">
                {sessionUrl}
              </code>
              <CopyButton value={sessionUrl} label="Copy" />
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <PayeeShieldPanel record={invoice.payeeShield} target={{ invoiceId: invoice.id }} />

          <Card>
            <CardHeader title="Invoice record" />
            <div className="px-5 py-2">
              <KeyValue label="Invoice ID">
                <code className="font-mono text-[11.5px]">{invoice.id}</code>
              </KeyValue>
              <KeyValue label="Customer">
                {customer ? (
                  <Link to={`/customers/${customer.id}`} className="text-accent hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  invoice.customerEmail
                )}
              </KeyValue>
              <KeyValue label="Order reference">{invoice.orderReference ?? "—"}</KeyValue>
              <KeyValue label="Created">{fmtDateTime(invoice.createdAt)}</KeyValue>
              <KeyValue label="Expires">{fmtDateTime(invoice.expiresAt)}</KeyValue>
              <KeyValue label="Paid at">{fmtDateTime(invoice.paidAt)}</KeyValue>
              <KeyValue label="Payment">
                {payment ? (
                  <Link to={`/payments/${payment.id}`} className="text-accent hover:underline">
                    {payment.id}
                  </Link>
                ) : (
                  "Not created"
                )}
              </KeyValue>
              <KeyValue label="Receipt emailed">{invoice.receiptEmailedAt ? fmtDateTime(invoice.receiptEmailedAt) : "Not yet"}</KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Receipt delivery" description="Independent of settlement status" />
            <div className="px-5 py-2">
              <KeyValue label="Settlement">
                <StatusBadge label={INVOICE_STATUS_META[invoice.status].label} tone={INVOICE_TONES[invoice.status]} />
              </KeyValue>
              <KeyValue label="Paid receipt email">
                <StatusBadge
                  tone={invoice.receiptEmailedAt ? "positive" : "neutral"}
                  label={invoice.receiptEmailedAt ? "Sent" : "Not applicable"}
                />
              </KeyValue>
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="text-[11.5px] leading-relaxed text-ink-4">
                Receipts are only emailed after settlement. Unpaid invoices are not emailed
                automatically.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {tamperOpen ? (
        <Card>
          <CardHeader title="PayeeShield tamper simulation" description="Modify a protected field and re-run verification" />
          <div className="px-5 py-4">
            <PayeeShieldTamperLab invoiceId={invoice.id} />
          </div>
        </Card>
      ) : null}

      <Card className="bg-canvas/40">
        <div className="flex items-start gap-3 px-5 py-4">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            Total <strong className="text-ink">{fmtAmount(invoice.total)} {TOKEN.symbol}</strong> across{" "}
            {invoice.lineItems.length} line item{invoice.lineItems.length > 1 ? "s" : ""}. The signed amount
            is <code className="font-mono text-[11.5px]">{invoice.payeeShield.protectedFields.amount}</code> base
            units — verification compares the base-unit value, not the display string.
          </p>
        </div>
      </Card>
    </>
  );
}
