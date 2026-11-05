import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { TOKEN } from "@/config/app";
import { fmtDateTime, isEmail, sumBase, timeAgo } from "@/lib/money";
import { PAYMENT_STATUS_META, SUBSCRIPTION_STATUS_META } from "@/config/ui";
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
  Modal,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressDisplay, AmountDisplay } from "@/components/ui/display";
import { PAYMENT_TONES, SUBSCRIPTION_TONES } from "@/components/ui/statusTones";
import type { Customer } from "@/types";
import { useSimulatedLoading } from "@/hooks/useSimulatedLoading";

export function CustomersList() {
  const data = useDemo((s) => s.data);
  const loading = useSimulatedLoading();
  const navigate = useNavigate();
  const pushToast = useDemo((s) => s.pushToast);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", wallet: "" });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    return data.customers
      .map((c) => {
        const payments = data.payments.filter((p) => p.customerId === c.id);
        const successful = payments.filter((p) => ["succeeded", "partially_refunded", "refunded"].includes(p.status));
        const refunded = data.refunds
          .filter((r) => r.customerId === c.id && r.status === "succeeded")
          .reduce((acc, r) => sumBase([acc, r.amount]), "0");
        const subs = data.subscriptions.filter(
          (s) => s.customerId === c.id && ["active", "renewal_due", "pending_activation", "processing"].includes(s.status),
        ).length;
        return { ...c, successfulCount: successful.length, volume: sumBase(successful.map((p) => p.amount)), refunded, subs };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

  const columns: Column<Customer & { successfulCount: number; volume: string; refunded: string; subs: number }>[] = [
    {
      key: "id",
      header: "Customer",
      render: (c) => (
        <div>
          <Link to={`/customers/${c.id}`} className="font-medium text-ink hover:text-accent hover:underline">
            {c.name}
          </Link>
          <p className="font-mono text-[11px] text-ink-4">{c.id}</p>
        </div>
      ),
      sortValue: (c) => c.name,
      csv: (c) => c.name,
    },
    { key: "email", header: "Email", render: (c) => <span className="text-ink-3">{c.email}</span>, csv: (c) => c.email },
    {
      key: "wallet",
      header: "Wallet",
      hideOnMobile: true,
      render: (c) => <AddressDisplay address={c.wallet} />,
      csv: (c) => c.wallet ?? "",
    },
    {
      key: "payments",
      header: "Successful",
      align: "right",
      render: (c) => (
        <div className="text-right">
          <span className="tnum text-ink">{c.successfulCount}</span>
          <p className="text-[11px] text-ink-4">
            {c.volume !== "0" ? `${(Number(c.volume) / 1_000_000).toFixed(2)} ${TOKEN.symbol}` : "—"}
          </p>
        </div>
      ),
      sortValue: (c) => c.successfulCount,
      csv: (c) => c.successfulCount,
    },
    {
      key: "refunded",
      header: "Refunded",
      align: "right",
      render: (c) => <AmountDisplay base={c.refunded} className="text-[12.5px]" />,
      csv: (c) => c.refunded,
    },
    {
      key: "subs",
      header: "Active subs",
      align: "right",
      render: (c) => <span className="tnum text-ink">{c.subs}</span>,
      sortValue: (c) => c.subs,
      csv: (c) => c.subs,
    },
    {
      key: "last",
      header: "Last payment",
      hideOnMobile: true,
      render: (c) => <span className="text-[12px] text-ink-3">{timeAgo(c.lastPaymentAt)}</span>,
      csv: (c) => c.lastPaymentAt ?? "",
    },
    {
      key: "created",
      header: "Created",
      hideOnMobile: true,
      render: (c) => <span className="text-[12px] text-ink-3 tnum">{fmtDateTime(c.createdAt)}</span>,
      sortValue: (c) => new Date(c.createdAt).getTime(),
      csv: (c) => c.createdAt,
    },
  ];

  async function create() {
    const next: Record<string, string | null> = {
      name: form.name.trim().length < 2 ? "Enter a customer name" : null,
      email: !isEmail(form.email) ? "Enter a valid email address" : null,
      wallet: form.wallet && !/^0x[a-fA-F0-9]{40}$/.test(form.wallet.trim()) ? "Enter a valid EVM address" : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setSaving(true);
    await api.createCustomer({ name: form.name.trim(), email: form.email.trim(), wallet: form.wallet || null });
    setSaving(false);
    setCreateOpen(false);
    setForm({ name: "", email: "", wallet: "" });
    pushToast({ title: "Customer created", body: "The record is scoped to this workspace.", tone: "success" });
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer records belong to this merchant workspace only. Another merchant can never see or query them."
        actions={
          <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add customer
          </Button>
        }
      />

      <Card>
        <DataTable
          loading={loading}
          rows={rows}
          columns={columns}
          getRowId={(c) => c.id}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          searchPlaceholder="Search customers…"
          searchValue={(c) => `${c.name} ${c.email} ${c.wallet ?? ""} ${c.id}`}
          filters={[
            {
              key: "subs",
              label: "Subscriptions",
              options: [
                { value: "all", label: "All customers" },
                { value: "with", label: "With active subscription" },
                { value: "without", label: "No subscription" },
              ],
              match: (c, v) => (v === "with" ? c.subs > 0 : c.subs === 0),
            },
          ]}
          emptyTitle="No customers yet"
          emptyDescription="Customers are created automatically on checkout, or add one manually."
          emptyAction={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              Add customer
            </Button>
          }
          exportName="customers"
        />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a customer"
        description="Manual customer records are scoped to this workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} loading={saving}>
              Create customer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required error={errors.name}>
            <Input value={form.name} invalid={Boolean(errors.name)} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input value={form.email} invalid={Boolean(errors.email)} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Wallet address (optional)" error={errors.wallet} hint="Used to prefill the payer on checkout.">
            <Input
              value={form.wallet}
              invalid={Boolean(errors.wallet)}
              onChange={(e) => setForm({ ...form, wallet: e.target.value })}
              placeholder="0x…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                             */
/* ------------------------------------------------------------------ */

export function CustomerDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [tab, setTab] = useState("payments");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const customer = data.customers.find((c) => c.id === id);
  if (!customer) {
    return (
      <Card>
        <EmptyState
          title="Customer not found"
          description={`No customer with ID ${id} in this workspace.`}
          action={<Button variant="secondary" onClick={() => navigate("/customers")}>Back to customers</Button>}
        />
      </Card>
    );
  }

  const payments = data.payments.filter((p) => p.customerId === customer.id);
  const invoices = data.invoices.filter((i) => i.customerId === customer.id);
  const subscriptions = data.subscriptions.filter((s) => s.customerId === customer.id);
  const refunds = data.refunds.filter((r) => r.customerId === customer.id);
  const orders = data.fulfilment.filter((f) => f.customerId === customer.id);
  const successful = payments.filter((p) => ["succeeded", "partially_refunded", "refunded"].includes(p.status));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", to: "/customers" }, { label: customer.name }]}
        title={customer.name}
        description={customer.email}
        meta={
          <>
            <span className="font-mono text-[11.5px] text-ink-4">{customer.id}</span>
            <StatusBadge label={`Customer since ${fmtDateTime(customer.createdAt)}`} tone="neutral" dot={false} />
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/payments")}>
              View payments
            </Button>
            <Button variant="secondary" onClick={() => navigate("/invoices")}>
              View invoices
            </Button>
            <Button variant="secondary" onClick={() => setNoteOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add internal note
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Profile" />
          <div className="px-5 py-2">
            <KeyValue label="Customer ID">
              <code className="font-mono text-[11.5px]">{customer.id}</code>
            </KeyValue>
            <KeyValue label="Name">{customer.name}</KeyValue>
            <KeyValue label="Email">{customer.email}</KeyValue>
            <KeyValue label="Created">{fmtDateTime(customer.createdAt)}</KeyValue>
            <KeyValue label="Last payment">{fmtDateTime(customer.lastPaymentAt)}</KeyValue>
          </div>
        </Card>
        <Card>
          <CardHeader title="Wallet" />
          <div className="px-5 py-2">
            <KeyValue label="Address">{customer.wallet ? <AddressDisplay address={customer.wallet} full /> : "—"}</KeyValue>
            <KeyValue label="Network">{data.merchant.environment === "testnet" ? "Whitechain Sepolia" : "Whitechain"}</KeyValue>
            <KeyValue label="Payments from this wallet">{payments.length}</KeyValue>
          </div>
          <div className="border-t border-line px-5 py-3">
            <p className="text-[11.5px] leading-relaxed text-ink-4">
              The gateway records the wallet used at checkout. It does not prove the wallet belongs to the
              named customer.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Summary" />
          <div className="grid grid-cols-2 gap-3 px-5 py-4">
            <div className="rounded-md border border-line bg-canvas/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-4">Successful</p>
              <p className="mt-1 text-[16px] font-semibold text-ink tnum">{successful.length}</p>
            </div>
            <div className="rounded-md border border-line bg-canvas/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-4">Volume</p>
              <AmountDisplay base={sumBase(successful.map((p) => p.amount))} className="text-[15px]" />
            </div>
            <div className="rounded-md border border-line bg-canvas/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-4">Refunded</p>
              <AmountDisplay base={sumBase(refunds.filter((r) => r.status === "succeeded").map((r) => r.amount))} className="text-[15px]" />
            </div>
            <div className="rounded-md border border-line bg-canvas/60 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-4">Subscriptions</p>
              <p className="mt-1 text-[16px] font-semibold text-ink tnum">{subscriptions.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-4 pt-1">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "payments", label: "Payments", count: payments.length },
              { id: "invoices", label: "Invoices", count: invoices.length },
              { id: "subscriptions", label: "Subscriptions", count: subscriptions.length },
              { id: "refunds", label: "Refunds", count: refunds.length },
              { id: "orders", label: "Orders", count: orders.length },
              { id: "notes", label: "Internal notes", count: customer.notes.length },
            ]}
          />
        </div>

        {tab === "payments" ? (
          <div className="divide-y divide-line">
            {payments.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No payments yet" description="This customer has not completed a checkout." />
            ) : (
              payments.map((p) => (
                <Link
                  key={p.id}
                  to={`/payments/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-canvas"
                >
                  <div className="min-w-0">
                    <code className="font-mono text-[12px] text-ink">{p.id}</code>
                    <p className="truncate text-[12px] text-ink-3">{p.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={p.amount} className="text-[12.5px]" />
                    <StatusBadge label={PAYMENT_STATUS_META[p.status].label} tone={PAYMENT_TONES[p.status]} />
                    <span className="hidden text-[11.5px] text-ink-4 tnum sm:inline">{timeAgo(p.createdAt)}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "invoices" ? (
          <div className="divide-y divide-line">
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" description="No invoice has been raised for this customer." />
            ) : (
              invoices.map((i) => (
                <Link key={i.id} to={`/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <code className="font-mono text-[12px] text-ink">{i.id}</code>
                    <p className="truncate text-[12px] text-ink-3">{i.title}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={i.total} className="text-[12.5px]" />
                    <StatusBadge label={i.status.replace(/_/g, " ")} tone={i.status === "paid" ? "positive" : "info"} />
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "subscriptions" ? (
          <div className="divide-y divide-line">
            {subscriptions.length === 0 ? (
              <EmptyState title="No subscriptions" description="This customer has no subscription records." />
            ) : (
              subscriptions.map((s) => (
                <Link key={s.id} to={`/subscriptions/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <code className="font-mono text-[12px] text-ink">{s.id}</code>
                    <p className="truncate text-[12px] text-ink-3">{data.plans.find((p) => p.id === s.planId)?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={s.amount} className="text-[12.5px]" />
                    <StatusBadge label={SUBSCRIPTION_STATUS_META[s.status].label} tone={SUBSCRIPTION_TONES[s.status]} />
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "refunds" ? (
          <div className="divide-y divide-line">
            {refunds.length === 0 ? (
              <EmptyState title="No refunds" description="No refund has been issued for this customer." />
            ) : (
              refunds.map((r) => (
                <Link key={r.id} to={`/refunds/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <code className="font-mono text-[12px] text-ink">{r.id}</code>
                    <p className="max-w-md truncate text-[12px] text-ink-3">{r.reason}</p>
                  </div>
                  <AmountDisplay base={r.amount} className="text-[12.5px]" />
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "orders" ? (
          <div className="divide-y divide-line">
            {orders.length === 0 ? (
              <EmptyState title="No orders" description="No fulfilment record references this customer." />
            ) : (
              orders.map((o) => (
                <Link key={o.id} to={`/fulfilment/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <span className="text-[12.5px] font-medium text-ink">{o.orderReference}</span>
                    <p className="text-[12px] text-ink-3">{o.status.replace(/_/g, " ")}</p>
                  </div>
                  <AmountDisplay base={o.amount} className="text-[12.5px]" />
                </Link>
              ))
            )}
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="px-5 py-4">
            {customer.notes.length === 0 ? (
              <EmptyState title="No internal notes" description="Notes are visible to your workspace only." />
            ) : (
              <ul className="space-y-2.5">
                {customer.notes.map((n, i) => (
                  <li key={i} className="rounded-md border border-line bg-canvas/60 px-3.5 py-2.5 text-[12.5px] text-ink-2">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Card>

      <Callout tone="neutral" title="Workspace privacy" icon={<ShieldCheck className="h-4 w-4" />}>
        Customer records, notes and history are scoped to <strong>{data.merchant.businessName}</strong>. The
        demo data layer filters every query by the active merchant ID, so one merchant cannot read another
        merchant&apos;s customers.
      </Callout>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add an internal note"
        description="Notes are only visible inside this workspace."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={async () => {
                if (note.trim().length < 3) return;
                setSaving(true);
                await api.addCustomerNote(customer.id, note.trim());
                setSaving(false);
                setNote("");
                setNoteOpen(false);
                pushToast({ title: "Note added", tone: "success" });
              }}
            >
              Save note
            </Button>
          </>
        }
      >
        <Field label="Note" required hint="Minimum 3 characters.">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[100px] w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[13.5px] text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            placeholder="Net-15 agreed for retainer work."
          />
        </Field>
      </Modal>

      <Divider className="my-2" />
      <p className="text-center text-[11.5px] text-ink-4">
        {payments.length} payments · {invoices.length} invoices · {subscriptions.length} subscriptions ·{" "}
        {refunds.length} refunds · {orders.length} orders
      </p>
    </>
  );
}
