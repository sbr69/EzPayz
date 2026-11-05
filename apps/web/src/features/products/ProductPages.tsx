import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Copy, Link2, Package, Plus, Save, Tag } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { TOKEN } from "@/config/app";
import { fmtDateTime, toBase, validateAmount } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AmountDisplay } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { Product } from "@/types";

const modeLabels: Record<string, string> = {
  fixed: "One-time",
  usage: "Usage-priced",
};

export function ProductsList() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState<Product | "new" | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => [...data.products].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.products],
  );

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Product",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas-alt text-[14px] font-bold text-ink-2">
            {p.imageGlyph}
          </span>
          <div className="min-w-0">
            <Link to={`/products/${p.id}`} className="font-medium text-ink hover:text-accent hover:underline">
              {p.name}
            </Link>
            <p className="truncate text-[16px] text-ink-3">{p.description}</p>
          </div>
        </div>
      ),
      sortValue: (p) => p.name,
      csv: (p) => p.name,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      render: (p) =>
        p.billingMode === "usage" ? (
          <div className="text-right">
            <AmountDisplay base={p.unitPrice ?? "0"} className="text-[18px]" />
            <p className="text-[16px] text-ink-4">per {p.unitLabel}</p>
          </div>
        ) : (
          <AmountDisplay base={p.price} className="text-[18px]" />
        ),
      sortValue: (p) => Number(p.price),
      csv: (p) => p.price,
    },
    {
      key: "mode",
      header: "Billing",
      render: (p) => <span className="text-ink-3">{modeLabels[p.billingMode]}</span>,
      csv: (p) => modeLabels[p.billingMode],
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge label={p.active ? "Active" : "Archived"} tone={p.active ? "positive" : "neutral"} />,
      csv: (p) => (p.active ? "Active" : "Archived"),
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
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" icon={<Tag className="h-3.5 w-3.5" />} onClick={() => setEditOpen(p)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={async () => {
              const dup = await api.createProduct({
                name: `${p.name} (copy)`,
                description: p.description,
                imageGlyph: p.imageGlyph,
                price: p.price,
                currency: p.currency,
                billingMode: p.billingMode,
                unitLabel: p.unitLabel,
                unitPrice: p.unitPrice,
              });
              pushToast({ title: "Product duplicated", body: dup.name, tone: "success" });
            }}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant={p.active ? "danger" : "secondary"}
            icon={<Archive className="h-3.5 w-3.5" />}
            onClick={() => setArchiveTarget(p)}
          >
            {p.active ? "Archive" : "Restore"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products and services"
        description="Reusable catalogue items you can attach to payment links, invoices and subscription plans."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditOpen("new")}>
            New product
          </Button>
        }
      />

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          searchPlaceholder="Search products…"
          searchValue={(p) => `${p.name} ${p.description}`}
          filters={[
            {
              key: "mode",
              label: "Billing",
              options: [
                { value: "all", label: "All billing modes" },
                ...Object.entries(modeLabels).map(([k, v]) => ({ value: k, label: v })),
              ],
              match: (p, v) => p.billingMode === v,
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "archived", label: "Archived" },
              ],
              match: (p, v) => (v === "active" ? p.active : !p.active),
            },
          ]}
          emptyTitle="No products yet"
          emptyDescription="Create a one-time product, a subscription plan or a usage-priced service."
          emptyAction={
            <Button variant="primary" onClick={() => setEditOpen("new")}>
              Create product
            </Button>
          }
          exportName="products"
        />
      </Card>

      {editOpen ? (
        <ProductDialog
          product={editOpen === "new" ? null : editOpen}
          onClose={() => setEditOpen(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        destructive={archiveTarget?.active}
        title={archiveTarget?.active ? "Archive this product?" : "Restore this product?"}
        confirmLabel={archiveTarget?.active ? "Archive product" : "Restore product"}
        loading={busy}
        body={
          archiveTarget?.active
            ? "Archiving removes the product from new payment link and plan creation. Existing payment records and subscriptions are unaffected."
            : "The product becomes selectable again for new links and plans."
        }
        onConfirm={async () => {
          if (!archiveTarget) return;
          setBusy(true);
          await api.updateProduct(archiveTarget.id, { active: !archiveTarget.active });
          setBusy(false);
          pushToast({ title: archiveTarget.active ? "Product archived" : "Product restored", tone: "info" });
          setArchiveTarget(null);
        }}
      />
    </>
  );
}

function ProductDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const pushToast = useDemo((s) => s.pushToast);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    imageGlyph: product?.imageGlyph ?? "NEW",
    price: product ? (Number(product.price) / 1_000_000).toFixed(2) : "",
    billingMode: product?.billingMode ?? ("fixed" as Product["billingMode"]),
    unitLabel: product?.unitLabel ?? "request",
    unitPrice: product?.unitPrice ? (Number(product.unitPrice) / 1_000_000).toFixed(2) : "0.01",
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const next: Record<string, string | null> = {
      name: form.name.trim().length < 2 ? "Enter a product name" : null,
      description: form.description.trim().length < 5 ? "Describe the product" : null,
      imageGlyph: form.imageGlyph.trim().length > 4 ? "Use up to 4 characters" : null,
      price: form.billingMode === "usage" ? null : validateAmount(form.price),
      unitPrice: form.billingMode === "usage" ? validateAmount(form.unitPrice) : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      imageGlyph: form.imageGlyph.trim().toUpperCase() || "NEW",
      price: form.billingMode === "usage" ? "0" : toBase(form.price),
      currency: TOKEN.symbol,
      billingMode: form.billingMode,
      unitLabel: form.billingMode === "usage" ? form.unitLabel : undefined,
      unitPrice: form.billingMode === "usage" ? toBase(form.unitPrice) : undefined,
    };
    if (product) {
      await api.updateProduct(product.id, payload);
      pushToast({ title: "Product updated", body: form.name, tone: "success" });
    } else {
      await api.createProduct(payload);
      pushToast({ title: "Product created", body: form.name, tone: "success" });
    }
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? "Edit product" : "New product"}
      description="Products are reusable and can back payment links, invoices and plans."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={saving} onClick={submit}>
            {product ? "Save changes" : "Create product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-4">
          <Field label="Mark" hint="Up to 4 characters.">
            <Input
              value={form.imageGlyph}
              invalid={Boolean(errors.imageGlyph)}
              onChange={(e) => setForm({ ...form, imageGlyph: e.target.value })}
              className="w-20 text-center"
            />
          </Field>
          <Field label="Name" required error={errors.name} className="flex-1">
            <Input value={form.name} invalid={Boolean(errors.name)} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
        </div>
        <Field label="Description" required error={errors.description}>
          <Textarea
            value={form.description}
            invalid={Boolean(errors.description)}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Billing mode" required>
          <Select value={form.billingMode} onChange={(e) => setForm({ ...form, billingMode: e.target.value as Product["billingMode"] })}>
            <option value="fixed">One-time product</option>
            <option value="usage">Usage-priced service</option>
          </Select>
        </Field>
        {form.billingMode === "usage" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={`Price per unit (${TOKEN.symbol})`} required error={errors.unitPrice}>
              <Input
                inputMode="decimal"
                value={form.unitPrice}
                invalid={Boolean(errors.unitPrice)}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              />
            </Field>
            <Field label="Unit label" hint="e.g. request, GB, seat">
              <Input value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
            </Field>
          </div>
        ) : (
          <Field label={`Price (${TOKEN.symbol})`} required error={errors.price}>
            <Input
              inputMode="decimal"
              value={form.price}
              invalid={Boolean(errors.price)}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="79.00"
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function ProductDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const product = data.products.find((p) => p.id === id);

  if (!product) {
    return (
      <Card>
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Product not found"
          description={`No product with ID ${id}.`}
          action={<Button variant="secondary" onClick={() => navigate("/products")}>Back to products</Button>}
        />
      </Card>
    );
  }

  const links = data.paymentLinks.filter((l) => l.productId === product.id);
  const plans = data.plans.filter((p) => p.name === product.name);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Products", to: "/products" }, { label: product.name }]}
        title={product.name}
        description={product.description}
        meta={
          <>
            <StatusBadge label={product.active ? "Active" : "Archived"} tone={product.active ? "positive" : "neutral"} />
            <StatusBadge label={modeLabels[product.billingMode]} tone="info" dot={false} />
            <span className="font-mono text-[16px] text-ink-4">{product.id}</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            icon={<Link2 className="h-4 w-4" />}
            onClick={async () => {
              const link = await api.createPaymentLink({
                title: product.name,
                description: product.description,
                linkType: "fixed",
                amount: product.price,
                minAmount: null,
                maxAmount: null,
                productId: product.id,
                reference: null,
                returnUrl: null,
                expiresInHours: null,
              });
              pushToast({ title: "Payment link created", body: `/l/${link.slug}`, tone: "success" });
              navigate(`/payment-links/${link.id}`);
            }}
          >
            Create payment link
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Product details" />
          <div className="grid gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
            <KeyValue label="Product ID">
              <code className="font-mono text-[16px]">{product.id}</code>
            </KeyValue>
            <KeyValue label="Currency">{product.currency}</KeyValue>
            <KeyValue label="Billing mode">{modeLabels[product.billingMode]}</KeyValue>
            <KeyValue label="Price">
              <AmountDisplay base={product.price} />
            </KeyValue>
            {product.billingMode === "usage" ? (
              <>
                <KeyValue label="Unit price">
                  <AmountDisplay base={product.unitPrice ?? "0"} />
                </KeyValue>
                <KeyValue label="Unit">{product.unitLabel}</KeyValue>
              </>
            ) : null}
            <KeyValue label="Created">{fmtDateTime(product.createdAt)}</KeyValue>
            <KeyValue label="Status">{product.active ? "Active" : "Archived"}</KeyValue>
          </div>
        </Card>
        <Card>
          <CardHeader title="Usage" />
          <div className="divide-y divide-line">
            <div className="px-5 py-3">
              <p className="text-[16px] uppercase tracking-wide text-ink-4">Payment links</p>
              <p className="mt-1 text-[20px] font-semibold text-ink tnum">{links.length}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-[16px] uppercase tracking-wide text-ink-4">Matching plans</p>
              <p className="mt-1 text-[20px] font-semibold text-ink tnum">{plans.length}</p>
            </div>
            <div className="px-5 py-3">
              <p className="text-[16px] uppercase tracking-wide text-ink-4">Mark</p>
              <p className="mt-1 text-[20px] font-semibold text-ink">{product.imageGlyph}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Payment links using this product" />
        {links.length === 0 ? (
          <EmptyState title="No payment links" description="Create a link from this product to start collecting." />
        ) : (
          <ul className="divide-y divide-line">
            {links.map((l) => (
              <li key={l.id}>
                <Link to={`/payment-links/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div>
                    <p className="text-[18px] font-medium text-ink">{l.title}</p>
                    <p className="font-mono text-[16px] text-ink-4">/l/{l.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={l.totalCollected} className="text-[18px]" />
                    <StatusBadge label={`${l.usageCount} payments`} tone="neutral" dot={false} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Callout tone="neutral" title="Usage-priced services">
        Usage measurements are submitted by your application. The gateway calculates the charge and
        enforces the customer&apos;s authorization limits, but it does not independently verify your metering.
      </Callout>
    </>
  );
}
