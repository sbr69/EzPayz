import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, ExternalLink, Link2, Play, Plus, QrCode, Share2, Square, Trash2 } from "lucide-react";
import { api, hostedUrl } from "@/services";
import { useDemo } from "@/store/demoStore";
import { TOKEN } from "@/config/app";
import { cmpBase, fmtAmount, fmtDateTime, toBase, validateAmount } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/Feedback";
import { QRCodeDialog, QRCodeImage } from "@/components/common/QRCodeDialog";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { Payment, PaymentLink } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

const typeLabels: Record<PaymentLink["linkType"], string> = {
  fixed: "Fixed amount",
  customer_amount: "Customer enters amount",
  reusable: "Reusable",
};

function amountLabel(link: PaymentLink): string {
  if (link.linkType === "fixed") return `${fmtAmount(link.amount!)} ${TOKEN.symbol}`;
  if (link.linkType === "customer_amount")
    return `${fmtAmount(link.minAmount!)} – ${fmtAmount(link.maxAmount!)} ${TOKEN.symbol}`;
  return `${fmtAmount(link.amount!)} ${TOKEN.symbol} per checkout`;
}

export function PaymentLinksList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);
  const [qrLink, setQrLink] = useState<PaymentLink | null>(null);
  const [toggleTarget, setToggleTarget] = useState<PaymentLink | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => [...data.paymentLinks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.paymentLinks],
  );

  async function copyUrl(link: PaymentLink) {
    await navigator.clipboard?.writeText(hostedUrl(`l/${link.slug}`)).catch(() => undefined);
    pushToast({ title: "Checkout URL copied", body: hostedUrl(`l/${link.slug}`), tone: "success" });
  }

  async function share(link: PaymentLink) {
    const url = hostedUrl(`l/${link.slug}`);
    if (navigator.share) {
      await navigator.share({ title: link.title, url }).catch(() => undefined);
      return;
    }
    await copyUrl(link);
    pushToast({ title: "Share unavailable", body: "The URL was copied instead.", tone: "info" });
  }

  const columns: Column<PaymentLink>[] = [
    {
      key: "title",
      header: "Link",
      render: (l) => (
        <div>
          <Link to={`/payment-links/${l.id}`} className="font-medium text-ink hover:text-accent hover:underline">
            {l.title}
          </Link>
          <p className="font-mono text-[16px] text-ink-4">/l/{l.slug}</p>
        </div>
      ),
      sortValue: (l) => l.title,
      csv: (l) => l.title,
    },
    {
      key: "type",
      header: "Amount type",
      render: (l) => <span className="text-ink-3">{typeLabels[l.linkType]}</span>,
      csv: (l) => typeLabels[l.linkType],
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (l) => <span className="text-[18px] text-ink tnum">{amountLabel(l)}</span>,
      csv: (l) => amountLabel(l),
    },
    {
      key: "usage",
      header: "Successful",
      align: "right",
      render: (l) => <span className="tnum text-ink">{l.usageCount}</span>,
      sortValue: (l) => l.usageCount,
      csv: (l) => l.usageCount,
    },
    {
      key: "collected",
      header: "Collected",
      align: "right",
      render: (l) => <AmountDisplay base={l.totalCollected} className="text-[18px]" />,
      sortValue: (l) => Number(l.totalCollected),
      csv: (l) => l.totalCollected,
    },
    {
      key: "status",
      header: "Status",
      render: (l) => <StatusBadge label={l.active ? "Active" : "Disabled"} tone={l.active ? "positive" : "neutral"} />,
      csv: (l) => (l.active ? "Active" : "Disabled"),
    },
    {
      key: "created",
      header: "Created",
      hideOnMobile: true,
      render: (l) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(l.createdAt)}</span>,
      sortValue: (l) => new Date(l.createdAt).getTime(),
      csv: (l) => l.createdAt,
    },
    {
      key: "expiry",
      header: "Expiry",
      hideOnMobile: true,
      render: (l) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(l.expiresAt)}</span>,
      csv: (l) => l.expiresAt ?? "",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => copyUrl(l)}>
            Copy
          </Button>
          <Button size="sm" variant="ghost" icon={<QrCode className="h-3.5 w-3.5" />} onClick={() => setQrLink(l)}>
            QR
          </Button>
          <Button size="sm" variant="ghost" icon={<Share2 className="h-3.5 w-3.5" />} onClick={() => share(l)}>
            Share
          </Button>
          <Button
            size="sm"
            variant={l.active ? "danger" : "secondary"}
            icon={l.active ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            onClick={() => setToggleTarget(l)}
          >
            {l.active ? "Disable" : "Reactivate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payment links"
        description="Share a URL or QR — fixed, customer-entered or reusable amounts."
        actions={
          <Link to="/payment-links/new">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              New payment link
            </Button>
          </Link>
        }
      />

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(l) => l.id}
          onRowClick={(l) => navigate(`/payment-links/${l.id}`)}
          searchPlaceholder="Search links…"
          searchValue={(l) => `${l.title} ${l.slug} ${l.description}`}
          filters={[
            {
              key: "type",
              label: "Type",
              options: [
                { value: "all", label: "All link types" },
                ...Object.entries(typeLabels).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (l, v) => l.linkType === v,
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "disabled", label: "Disabled" },
              ],
              match: (l, v) => (v === "active" ? l.active : !l.active),
            },
          ]}
          emptyTitle="No payment links yet"
          emptyDescription="Create a fixed, customer-amount or reusable link and share it with a customer."
          emptyAction={
            <Link to="/payment-links/new">
              <Button variant="primary">Create payment link</Button>
            </Link>
          }
          exportName="payment-links"
        />
      </Card>

      {qrLink ? (
        <QRCodeDialog
          open
          onClose={() => setQrLink(null)}
          url={hostedUrl(`l/${qrLink.slug}`)}
          title={qrLink.title}
          description={qrLink.description}
          merchantName={data.merchant.displayName}
          amountLabel={amountLabel(qrLink)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        destructive={toggleTarget?.active}
        title={toggleTarget?.active ? "Disable this payment link?" : "Reactivate this payment link?"}
        confirmLabel={toggleTarget?.active ? "Disable link" : "Reactivate link"}
        loading={busy}
        body={
          toggleTarget?.active
            ? "Customers opening the link will see a notice that the link is no longer accepting payments. Existing payment records are unaffected."
            : "The link will start accepting new checkouts again. Links that have passed their expiry cannot be reactivated."
        }
        onConfirm={async () => {
          if (!toggleTarget) return;
          setBusy(true);
          await api.setPaymentLinkActive(toggleTarget.id, !toggleTarget.active);
          setBusy(false);
          pushToast({
            title: toggleTarget.active ? "Link disabled" : "Link reactivated",
            body: `/l/${toggleTarget.slug}`,
            tone: "info",
          });
          setToggleTarget(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export function PaymentLinkForm() {
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);
  const products = useDemo((s) => s.data.products);
  const merchant = useDemo((s) => s.data.merchant);
  const [linkType, setLinkType] = useState<PaymentLink["linkType"]>("fixed");
  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    minAmount: "5",
    maxAmount: "500",
    reference: "",
    returnUrl: "",
    productId: "",
    expiresInHours: "720",
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const next: Record<string, string | null> = {
      title: form.title.trim().length < 3 ? "Give the link a title" : null,
      description: form.description.trim().length < 5 ? "Describe what the customer is paying for" : null,
      amount: null,
      minAmount: null,
      maxAmount: null,
      returnUrl: form.returnUrl && !/^https?:\/\//.test(form.returnUrl) ? "Enter a valid URL" : null,
    };
    if (linkType !== "customer_amount") {
      next.amount = validateAmount(form.amount);
    } else {
      next.minAmount = validateAmount(form.minAmount);
      next.maxAmount = validateAmount(form.maxAmount);
      if (!next.minAmount && !next.maxAmount && cmpBase(toBase(form.minAmount), toBase(form.maxAmount)) > 0) {
        next.maxAmount = "Minimum cannot be greater than maximum";
      }
    }
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const link = await api.createPaymentLink({
        title: form.title.trim(),
        description: form.description.trim(),
        linkType,
        amount: linkType === "customer_amount" ? null : toBase(form.amount),
        minAmount: linkType === "customer_amount" ? toBase(form.minAmount) : null,
        maxAmount: linkType === "customer_amount" ? toBase(form.maxAmount) : null,
        productId: form.productId || null,
        reference: form.reference || null,
        returnUrl: form.returnUrl || null,
        expiresInHours: Number(form.expiresInHours) || null,
      });
      pushToast({ title: "Payment link created", body: `/l/${link.slug}`, tone: "success" });
      navigate(`/payment-links/${link.id}`);
    } catch (err) {
      pushToast({ title: "Could not create link", body: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payment links", to: "/payment-links" }, { label: "New" }]}
        title="Create a payment link"
        description="Opens a hosted checkout — the QR encodes the URL, never a token transfer."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate("/payment-links")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              Create link
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Link details" />
          <div className="space-y-4 px-6 py-5">
            <Field label="Link type" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["fixed", "Fixed amount", "You set the exact amount"],
                    ["customer_amount", "Customer enters amount", "Within a range you set"],
                    ["reusable", "Reusable", "One link, many independent payments"],
                  ] as const
                ).map(([value, title, desc]) => (
                  <button
                    key={value}
                    onClick={() => setLinkType(value)}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      linkType === value ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-canvas"
                    }`}
                  >
                    <span className={`block text-[18px] font-semibold ${linkType === value ? "text-accent" : "text-ink"}`}>
                      {title}
                    </span>
                    <span className="mt-0.5 block text-[16px] leading-snug text-ink-3">{desc}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Title" required error={errors.title} htmlFor="pl-title">
              <Input
                id="pl-title"
                value={form.title}
                invalid={Boolean(errors.title)}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Smart-contract audit sprint"
              />
            </Field>
            <Field label="Description" required error={errors.description} htmlFor="pl-desc">
              <Textarea
                id="pl-desc"
                value={form.description}
                invalid={Boolean(errors.description)}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Fixed-scope audit with a written remediation report."
              />
            </Field>

            {linkType === "customer_amount" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={`Minimum (${TOKEN.symbol})`} required error={errors.minAmount}>
                  <Input
                    inputMode="decimal"
                    value={form.minAmount}
                    invalid={Boolean(errors.minAmount)}
                    onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                  />
                </Field>
                <Field label={`Maximum (${TOKEN.symbol})`} required error={errors.maxAmount}>
                  <Input
                    inputMode="decimal"
                    value={form.maxAmount}
                    invalid={Boolean(errors.maxAmount)}
                    onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                  />
                </Field>
              </div>
            ) : (
              <Field label={`Amount (${TOKEN.symbol})`} required error={errors.amount}>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  invalid={Boolean(errors.amount)}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="79.00"
                />
              </Field>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Product or service (optional)" htmlFor="pl-product">
                <Select id="pl-product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  <option value="">Not linked</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference (optional)" htmlFor="pl-ref">
                <Input
                  id="pl-ref"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="AUDIT-DEPOSIT"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Expiry" htmlFor="pl-exp" hint="The link stops accepting payments after this.">
                <Select id="pl-exp" value={form.expiresInHours} onChange={(e) => setForm({ ...form, expiresInHours: e.target.value })}>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="0">No expiry</option>
                </Select>
              </Field>
              <Field label="Return URL (optional)" error={errors.returnUrl} hint="Where the customer lands after paying.">
                <Input
                  value={form.returnUrl}
                  invalid={Boolean(errors.returnUrl)}
                  onChange={(e) => setForm({ ...form, returnUrl: e.target.value })}
                  placeholder="https://company.example/thanks"
                />
              </Field>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Checkout preview" description="What the customer sees when the link opens" />
            <div className="space-y-3 px-6 py-5">
              <div className="rounded-md border border-line bg-canvas p-4">
                <p className="text-[16px] text-ink-4">{merchant.displayName}</p>
                <p className="mt-1 text-[20px] font-semibold text-ink">{form.title || "Untitled link"}</p>
                <p className="mt-1 text-[18px] leading-relaxed text-ink-3">{form.description || "Add a description"}</p>
                <p className="mt-3 text-[26px] font-semibold text-ink tnum">
                  {linkType === "customer_amount"
                    ? `${form.minAmount} – ${form.maxAmount} ${TOKEN.symbol}`
                    : `${form.amount || "0.00"} ${TOKEN.symbol}`}
                </p>
                {linkType === "reusable" ? (
                  <p className="mt-1 text-[16px] text-ink-4">
                    Each checkout from this link creates its own payment record.
                  </p>
                ) : null}
              </div>
              <div className="flex justify-center rounded-md border border-dashed border-line-strong p-4">
                <QRCodeImage value={hostedUrl(`l/preview-link`)} size={132} />
              </div>
              <p className="text-[16px] leading-relaxed text-ink-4">
                The QR code is generated after the link exists. It always encodes the hosted checkout URL,
                so the customer reviews the amount and recipient in the gateway UI before authorising.
              </p>
            </div>
          </Card>
          <Callout tone="info" title="Reusable links">
            A reusable link can be shared with many customers. Every checkout creates an independent
            payment intent and record, so reconciliation stays per-customer.
          </Callout>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export function PaymentLinkDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [qrOpen, setQrOpen] = useState(false);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const link = data.paymentLinks.find((l) => l.id === id);
  if (!link) {
    return (
      <Card>
        <EmptyState
          title="Payment link not found"
          description={`No link with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/payment-links")}>Back to links</Button>}
        />
      </Card>
    );
  }

  const payments = data.payments.filter((p) => p.paymentLinkId === link.id);
  const url = hostedUrl(`l/${link.slug}`);

  const columns: Column<Payment>[] = [
    { key: "id", header: "Payment", render: (p) => <code className="font-mono text-[18px]">{p.id}</code> },
    {
      key: "customer",
      header: "Customer",
      render: (p) => data.customers.find((c) => c.id === p.customerId)?.name ?? p.customerEmail ?? "Guest",
    },
    { key: "amount", header: "Amount", align: "right", render: (p) => <AmountDisplay base={p.amount} className="text-[18px]" /> },
    { key: "status", header: "Status", render: (p) => <StatusBadge label={p.status.replace(/_/g, " ")} tone={p.status === "succeeded" ? "positive" : "warn"} /> },
    { key: "created", header: "Created", render: (p) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(p.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payment links", to: "/payment-links" }, { label: link.title }]}
        title={link.title}
        description={link.description}
        meta={
          <>
            <StatusBadge label={link.active ? "Active" : "Disabled"} tone={link.active ? "positive" : "neutral"} />
            <StatusBadge label={typeLabels[link.linkType]} tone="info" dot={false} />
            {link.expiresAt ? (
              <StatusBadge label={`Expires ${fmtDateTime(link.expiresAt)}`} tone="neutral" dot={false} />
            ) : (
              <StatusBadge label="No expiry" tone="neutral" dot={false} />
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Copy className="h-4 w-4" />}
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                pushToast({ title: "Checkout URL copied", body: url, tone: "success" });
              }}
            >
              Copy URL
            </Button>
            <Button variant="secondary" icon={<QrCode className="h-4 w-4" />} onClick={() => setQrOpen(true)}>
              Show QR
            </Button>
            <a href={`#/l/${link.slug}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
                Open checkout
              </Button>
            </a>
            <Button
              variant={link.active ? "danger" : "primary"}
              icon={link.active ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              onClick={() => setToggleOpen(true)}
              disabled={Boolean(link.expiresAt && new Date(link.expiresAt) < new Date() && !link.active)}
            >
              {link.active ? "Disable link" : "Reactivate link"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Link details" />
          <div className="grid grid-cols-1 gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            <KeyValue label="Link ID">
              <code className="font-mono text-[16px]">{link.id}</code>
            </KeyValue>
            <KeyValue label="Slug">/l/{link.slug}</KeyValue>
            <KeyValue label="Amount type">{typeLabels[link.linkType]}</KeyValue>
            <KeyValue label="Amount or range">{amountLabel(link)}</KeyValue>
            <KeyValue label="Successful payments">{link.usageCount}</KeyValue>
            <KeyValue label="Total collected">
              <AmountDisplay base={link.totalCollected} />
            </KeyValue>
            <KeyValue label="Reference">{link.reference ?? "—"}</KeyValue>
            <KeyValue label="Return URL">{link.returnUrl ?? "—"}</KeyValue>
            <KeyValue label="Created">{fmtDateTime(link.createdAt)}</KeyValue>
            <KeyValue label="Expiry">{fmtDateTime(link.expiresAt)}</KeyValue>
            {link.productId ? (
              <KeyValue label="Product">
                <Link to={`/products/${link.productId}`} className="text-accent hover:underline">
                  {data.products.find((p) => p.id === link.productId)?.name ?? link.productId}
                </Link>
              </KeyValue>
            ) : null}
          </div>
          <div className="border-t border-line px-6 py-5">
            <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">Checkout URL</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-line bg-canvas px-2.5 py-1.5 font-mono text-[16px] text-ink-2">
                {url}
              </code>
              <Button
                size="sm"
                variant="secondary"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await navigator.clipboard?.writeText(url).catch(() => undefined);
                  pushToast({ title: "Copied", tone: "success" });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="QR code" description="Encodes the hosted checkout URL" />
          <div className="flex flex-col items-center gap-3 px-5 py-5">
            <QRCodeImage value={url} size={180} />
            <p className="text-center text-[16px] leading-relaxed text-ink-4">
              Scanning opens the checkout page. The code never encodes a raw transfer instruction, so the
              customer always reviews the request in the gateway UI.
            </p>
            <Button variant="secondary" icon={<QrCode className="h-3.5 w-3.5" />} onClick={() => setQrOpen(true)}>
              Open QR dialog
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Payments from this link" description="Reusable links produce independent payment records" />
        <DataTable
          rows={payments}
          columns={columns}
          getRowId={(p) => p.id}
          onRowClick={(p) => navigate(`/payments/${p.id}`)}
          emptyTitle="No payments yet"
          emptyDescription="Share the link or open the hosted checkout to create the first payment."
          emptyAction={
            <a href={`#/l/${link.slug}`} target="_blank" rel="noreferrer">
              <Button variant="primary" icon={<Link2 className="h-4 w-4" />}>
                Open checkout
              </Button>
            </a>
          }
        />
      </Card>

      <QRCodeDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        title={link.title}
        description={link.description}
        merchantName={data.merchant.displayName}
        amountLabel={amountLabel(link)}
      />

      <ConfirmDialog
        open={toggleOpen}
        onClose={() => setToggleOpen(false)}
        destructive={link.active}
        title={link.active ? "Disable this payment link?" : "Reactivate this payment link?"}
        confirmLabel={link.active ? "Disable link" : "Reactivate link"}
        loading={busy}
        body={
          link.active
            ? "Customers opening the link will see that it is no longer accepting payments."
            : "The link will accept new checkouts again."
        }
        onConfirm={async () => {
          setBusy(true);
          await api.setPaymentLinkActive(link.id, !link.active);
          setBusy(false);
          setToggleOpen(false);
          pushToast({ title: link.active ? "Link disabled" : "Link reactivated", tone: "info" });
        }}
      />

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => navigate("/payment-links")}>
          Links cannot be deleted in the demo — disable them instead
        </Button>
      </div>
    </>
  );
}
