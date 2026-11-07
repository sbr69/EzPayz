import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, Code2, Copy, ListTree, Plus, Terminal, Webhook } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { DEFAULT_NETWORK, GATEWAY, TOKEN, WEBHOOK_EVENTS } from "@/config/app";
import { fmtDateTime, isHttpsUrl, timeAgo } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Divider,
  EmptyState,
  Field,
  Input,
  KeyValue,
  Modal,
  PageHeader,
  Pill,
  Select,
  StatusBadge,
  Switch,
} from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { CopyField, CodeBlock } from "@/components/ui/display";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { MetricCard } from "@/components/common/MetricCard";
import type { ApiKey, WebhookEndpoint, WebhookEvent } from "@/types";

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function DeveloperOverview() {
  const data = useDemo((s) => s.data);
  const activeKeys = data.apiKeys.filter((k) => k.status === "active");
  const recentEvents = data.webhookEvents.slice(0, 5);
  const failing = data.webhookEndpoints.some((e) => e.health === "failing" || e.health === "degraded");

  const checklist = [
    { label: "Create an API key", done: activeKeys.length > 0, to: "/developers/api-keys" },
    { label: "Configure a webhook endpoint", done: data.webhookEndpoints.length > 0, to: "/developers/webhooks" },
    { label: "Receive a payment.succeeded event", done: data.webhookEvents.some((e) => e.type === "payment.succeeded" && e.status === "delivered"), to: "/developers/events" },
    { label: "Create a payment intent", done: data.payments.length > 0, to: "/payments" },
    { label: "Create a payment link", done: data.paymentLinks.length > 0, to: "/payment-links" },
    { label: "Set up a subscription plan", done: data.plans.length > 0, to: "/subscriptions/plans" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((doneCount / checklist.length) * 100);

  const resources = [
    { label: "SDK quickstart", description: "Install, configure and take a payment", to: "/developers/quickstart", icon: Terminal },
    { label: "API reference", description: "Searchable endpoint documentation", to: "/developers/api-reference", icon: BookOpen },
    { label: "API keys", description: `${activeKeys.length} active key${activeKeys.length === 1 ? "" : "s"}`, to: "/developers/api-keys", icon: Code2 },
    { label: "Event logs", description: "Delivery attempts and response codes", to: "/developers/events", icon: ListTree },
  ];

  return (
    <>
      <PageHeader
        title="Developers"
        description="SDK, API keys and webhooks — testnet environment."
        meta={
          <>
            <StatusBadge label="API operational (demo)" tone="positive" />
            <Pill tone="neutral">{GATEWAY.docsVersion}</Pill>
          </>
        }
        actions={
          <>
            <Link to="/developers/quickstart">
              <Button variant="primary" icon={<Code2 className="h-4 w-4" />}>
                SDK quickstart
              </Button>
            </Link>
            <Link to="/developers/api-reference">
              <Button variant="secondary" icon={<BookOpen className="h-4 w-4" />}>
                API reference
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active API keys" value={activeKeys.length} />
        <MetricCard label="Webhook endpoints" value={data.webhookEndpoints.length} />
        <MetricCard label="Events delivered" value={data.webhookEvents.filter((e) => e.status === "delivered").length} tone="positive" />
        <MetricCard
          label="Failed deliveries"
          value={data.webhookEvents.filter((e) => e.status === "failed").length}
          tone={data.webhookEvents.some((e) => e.status === "failed") ? "warn" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader
          title="Integration checklist"
          description={`${doneCount} of ${checklist.length} steps complete`}
          actions={
            <span className="text-[14px] font-semibold text-accent tnum">{progress}%</span>
          }
        />
        <div className="px-6 py-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-canvas-alt">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#118a7e] to-accent transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {checklist.map((c, i) => (
              <li key={c.label}>
                <Link
                  to={c.to}
                  className="group flex h-full items-center gap-3 rounded-[10px] border border-line px-3 py-4 transition-all duration-200 hover:border-accent-line hover:bg-canvas"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold tnum transition-colors ${
                      c.done
                        ? "border-accent bg-accent text-white"
                        : "border-line-strong text-ink-4 group-hover:border-accent-line group-hover:text-accent"
                    }`}
                  >
                    {c.done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={`text-[14px] leading-snug ${c.done ? "text-ink" : "text-ink-2"}`}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Quickstart"
            description="Install, configure and take a payment"
            actions={
              <Link to="/developers/quickstart">
                <Button size="sm" variant="secondary" iconRight={<BookOpen className="h-3.5 w-3.5" />}>
                  Full guide
                </Button>
              </Link>
            }
          />
          <div className="space-y-4 px-6 py-5">
            <CodeBlock
              language="bash"
              filename="terminal"
              code={`npm install ${GATEWAY.sdkPackage}`}
            />
            <CodeBlock
              language="ts"
              filename="server/create-intent.ts"
              caption="Provisional surface — the backend contract is not finalised."
              code={`import { EzPayz } from "${GATEWAY.sdkPackage}";

const wp = new EzPayz({
  secretKey: process.env.WHITEPAY_SECRET_KEY!,
  network: "${DEFAULT_NETWORK.id}",
  token: "${TOKEN.symbol}",
});

const session = await wp.checkout.sessions.create({
  amount: "1600.00",
  description: "Audit sprint — balance",
  expiresInHours: 72,
  successUrl: "https://example.com/thanks",
});

// Hand session.url to your customer`}
            />
            <CodeBlock
              language="tsx"
              filename="app/checkout.tsx"
              code={`import { EzPayzProvider, Checkout } from "${GATEWAY.sdkPackage}";

export default function Pay({ sessionId }: { sessionId: string }) {
  return (
    <EzPayzProvider publishableKey={process.env.NEXT_PUBLIC_KEY!}>
      <Checkout
        sessionId={sessionId}
        onSuccess={(payment) => router.push("/receipt/" + payment.id)}
      />
    </EzPayzProvider>
  );
}`}
            />
          </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent API activity"
            description="Recent webhook events emitted for this workspace"
            actions={
              <Link to="/developers/events">
                <Button size="sm" variant="secondary" icon={<ListTree className="h-3.5 w-3.5" />}>
                  Event logs
                </Button>
              </Link>
            }
          />
          {recentEvents.length === 0 ? (
            <EmptyState title="No recent activity" description="Events appear here once your integration starts creating payments." />
          ) : (
            <ul className="divide-y divide-line">
              {recentEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <code className="font-mono text-[18px] text-ink">{e.type}</code>
                    <StatusBadge
                      label={`HTTP ${e.responseStatus ?? "—"} · ${e.attempts} attempt${e.attempts > 1 ? "s" : ""}`}
                      tone={e.status === "delivered" ? "positive" : "danger"}
                    />
                  </div>
                  <span className="text-[16px] text-ink-4">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Resources" />
            <ul className="divide-y divide-line">
              {resources.map((r) => (
                <li key={r.label}>
                  <Link to={r.to} className="group flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-canvas">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-200 group-hover:bg-accent group-hover:text-white">
                      <r.icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-medium text-ink">{r.label}</span>
                      <span className="block truncate text-[14px] text-ink-3">{r.description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Webhook health" actions={<Link to="/developers/webhooks" className="text-[16px] text-accent hover:underline">Configure</Link>} />
            <div className="space-y-3 px-6 py-5">
              {data.webhookEndpoints.map((e) => (
                <div key={e.id} className="rounded-[10px] border border-line px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="min-w-0 truncate font-mono text-[16px] text-ink-2">{e.url}</code>
                    <StatusBadge
                      label={e.health}
                      tone={e.health === "healthy" ? "positive" : e.health === "untested" ? "neutral" : "warn"}
                    />
                  </div>
                  <p className="mt-1 text-[16px] text-ink-4">
                    {e.events.length} events · last delivery {timeAgo(e.lastDeliveryAt)}
                  </p>
                </div>
              ))}
              {failing ? (
                <Callout tone="warn" title="Some deliveries are failing">
                  Inspect the event log to see response codes and retry schedules.
                </Callout>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

export function ApiKeysPage() {
  const data = useDemo((s) => s.data);
  const isDemo = useDemo((s) => s.isDemo);
  const pushToast = useDemo((s) => s.pushToast);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [created, setCreated] = useState<{ id: string; secret: string } | null>(null);
  const [form, setForm] = useState({ name: "", environment: "testnet" as "testnet" | "mainnet" });
  const [permissions, setPermissions] = useState<string[]>(["payment_intents:write", "invoices:write"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const permissionOptions = [
    "payment_intents:write",
    "payment_intents:read",
    "invoices:write",
    "refunds:write",
    "webhooks:read",
    "subscriptions:write",
  ];

  const columns: Column<ApiKey>[] = [
    {
      key: "name",
      header: "Key",
      render: (k) => (
        <div>
          <p className="font-medium text-ink">{k.name}</p>
          <p className="font-mono text-[16px] text-ink-4">{k.publishable}</p>
        </div>
      ),
      csv: (k) => k.name,
    },
    { key: "env", header: "Environment", render: (k) => <Pill tone={k.environment === "testnet" ? "warn" : "neutral"}>{k.environment}</Pill> },
    { key: "secret", header: "Secret", render: (k) => <code className="font-mono text-[16px] text-ink-4">••••••••••••{k.secretLast4}</code> },
    {
      key: "permissions",
      header: "Permissions",
      hideOnMobile: true,
      render: (k) => <span className="text-[18px] text-ink-3">{k.permissions?.join(", ") ?? "—"}</span>,
      csv: (k) => k.permissions?.join(" ") ?? "",
    },
    {
      key: "lastUsed",
      header: "Last used",
      hideOnMobile: true,
      render: (k) => <span className="text-[18px] text-ink-3">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</span>,
      csv: (k) => k.lastUsedAt ?? "",
    },
    {
      key: "status",
      header: "Status",
      render: (k) => <StatusBadge label={k.status === "active" ? "Active" : "Revoked"} tone={k.status === "active" ? "positive" : "neutral"} />,
      csv: (k) => k.status,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (k) =>
        k.status === "active" ? (
          <Button size="sm" variant="danger" onClick={() => setRevokeTarget(k)} onClickCapture={(e) => e.stopPropagation()}>
            Revoke
          </Button>
        ) : (
          <span className="text-[16px] text-ink-4">Revoked {timeAgo(k.revokedAt)}</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="API keys"
        description="Secret keys are shown once, at creation."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Create API key
          </Button>
        }
      />

      <Card>
        <DataTable
          rows={[...data.apiKeys].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          columns={columns}
          getRowId={(k) => k.id}
          searchPlaceholder="Search keys…"
          searchValue={(k) => `${k.name} ${k.publishable}`}
          emptyTitle="No API keys"
          emptyDescription="Create a key to authenticate API requests from your server."
          exportName="api-keys"
        />
      </Card>

      {isDemo ? (
        <Callout tone="neutral" title="Demo credentials">
          The values in this workspace are obviously fake and generated in your browser. A real deployment
          returns the secret exactly once over a server-to-server channel.
        </Callout>
      ) : null}

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreated(null);
          setForm({ name: "", environment: "testnet" });
        }}
        title={created ? "API key created" : "Create an API key"}
        description={created ? undefined : "Choose a name, environment and permissions."}
        size="md"
        footer={
          created ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreateOpen(false);
                setCreated(null);
                setForm({ name: "", environment: "testnet" });
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={busy}
                onClick={async () => {
                  if (form.name.trim().length < 3) {
                    setError("Give the key a name of at least 3 characters");
                    return;
                  }
                  setError(null);
                  setBusy(true);
                  const result = await api.createApiKey({
                    name: form.name.trim(),
                    environment: form.environment,
                    permissions,
                  });
                  setBusy(false);
                  setCreated(result);
                  pushToast({ title: "API key created", body: "Copy the secret now — it will not be shown again.", tone: "success" });
                }}
              >
                Create key
              </Button>
            </>
          )
        }
      >
        {created ? (
          <div className="space-y-4">
            <CopyField label="Publishable key" value={data.apiKeys.find((k) => k.id === created.id)?.publishable ?? ""} />
            <div className="space-y-1.5">
              <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">Secret key — shown once</p>
              <div className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft/60 px-2.5 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[18px] text-ink">{created.secret}</code>
                <Button size="sm" variant="secondary" icon={<Copy className="h-3 w-3" />} onClick={() => navigator.clipboard?.writeText(created.secret)}>
                  Copy
                </Button>
              </div>
              <p className="text-[16px] text-ink-3">
                Store it in your server-side secret manager. After closing this dialog only the last four
                characters are visible.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Key name" required error={error}>
              <Input value={form.name} invalid={Boolean(error)} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production checkout" />
            </Field>
            <Field label="Environment" required>
              <Select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value as "testnet" | "mainnet" })}>
                <option value="testnet">Testnet</option>
                <option value="mainnet" disabled>
                  Mainnet (not available in demo)
                </option>
              </Select>
            </Field>
            <Field label="Permissions" required>
              <div className="space-y-2">
                {permissionOptions.map((p) => (
                  <Checkbox
                    key={p}
                    label={<code className="font-mono text-[18px]">{p}</code>}
                    checked={permissions.includes(p)}
                    onChange={(v) => setPermissions(v ? [...permissions, p] : permissions.filter((x) => x !== p))}
                  />
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        destructive
        title={`Revoke ${revokeTarget?.name}?`}
        confirmLabel="Revoke key"
        body="Requests signed with this key will be rejected immediately. This cannot be undone — you will need to create a new key and update your server."
        onConfirm={async () => {
          if (!revokeTarget) return;
          await api.revokeApiKey(revokeTarget.id);
          pushToast({ title: "API key revoked", body: revokeTarget.name, tone: "info" });
          setRevokeTarget(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

export function WebhooksPage() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", description: "" });
  const [events, setEvents] = useState<string[]>(["payment.succeeded", "payment.failed"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [testTarget, setTestTarget] = useState<WebhookEndpoint | null>(null);
  const [testType, setTestType] = useState("payment.succeeded");
  const [testing, setTesting] = useState(false);

  const allEvents = WEBHOOK_EVENTS.flatMap((g) => g.events);

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Subscribe to gateway events with tracked delivery."
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add endpoint
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {data.webhookEndpoints.map((endpoint) => (
          <Card key={endpoint.id}>
            <CardHeader
              title={endpoint.description || endpoint.url}
              description={endpoint.url}
              actions={
                <div className="flex items-center gap-2">
                  <Switch
                    checked={endpoint.active}
                    label="Endpoint active"
                    onChange={async (v) => {
                      await api.updateWebhookEndpoint(endpoint.id, { active: v });
                      pushToast({ title: v ? "Endpoint activated" : "Endpoint deactivated", tone: "info" });
                    }}
                  />
                </div>
              }
            />
            <div className="space-y-3 px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={endpoint.health}
                  tone={endpoint.health === "healthy" ? "positive" : endpoint.health === "untested" ? "neutral" : "warn"}
                />
                <StatusBadge label={`${endpoint.events.length} events`} tone="neutral" dot={false} />
                <span className="text-[16px] text-ink-4">
                  Last delivery {endpoint.lastDeliveryAt ? timeAgo(endpoint.lastDeliveryAt) : "never"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {endpoint.events.map((e) => (
                  <code key={e} className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[16px] text-ink-2">
                    {e}
                  </code>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] uppercase tracking-wide text-ink-4">Signing secret</p>
                  <code className="font-mono text-[16px] text-ink-2">whsec_••••••••{endpoint.signingSecretLast4}</code>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditing(endpoint)}>
                  Manage
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setTestTarget(endpoint)}>
                  Send test event
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Event catalogue" description="Available events by resource" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {WEBHOOK_EVENTS.map((group) => (
            <div key={group.group}>
              <p className="mb-2 text-[16px] font-semibold uppercase tracking-wide text-ink-4">{group.group}</p>
              <ul className="space-y-1">
                {group.events.map((e) => (
                  <li key={e}>
                    <code className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[16px] text-ink-2">{e}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSecret(null);
          setForm({ url: "", description: "" });
        }}
        title={secret ? "Endpoint created" : "Add a webhook endpoint"}
        description={secret ? undefined : "The signing secret is shown once."}
        footer={
          secret ? (
            <Button
              variant="primary"
              onClick={() => {
                setCreateOpen(false);
                setSecret(null);
                setForm({ url: "", description: "" });
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={busy}
                onClick={async () => {
                  if (!isHttpsUrl(form.url)) {
                    setError("Enter a valid HTTPS endpoint URL");
                    return;
                  }
                  if (events.length === 0) {
                    setError("Select at least one event");
                    return;
                  }
                  setError(null);
                  setBusy(true);
                  const result = await api.createWebhookEndpoint({
                    url: form.url.trim(),
                    description: form.description.trim(),
                    events,
                  });
                  setBusy(false);
                  setSecret(result.secret);
                  pushToast({ title: "Endpoint created", body: "Copy the signing secret now.", tone: "success" });
                }}
              >
                Add endpoint
              </Button>
            </>
          )
        }
      >
        {secret ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft/60 px-2.5 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[18px] text-ink">{secret}</code>
              <Button size="sm" variant="secondary" icon={<Copy className="h-3 w-3" />} onClick={() => navigator.clipboard?.writeText(secret)}>
                Copy
              </Button>
            </div>
            <p className="text-[18px] leading-relaxed text-ink-3">
              Verify the <code className="font-mono">X-EzPayz-Signature</code> header on every request before
              trusting the payload.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Endpoint URL" required error={error && !isHttpsUrl(form.url) ? error : null}>
              <Input
                value={form.url}
                placeholder="https://api.company.example/hooks/whitepay"
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Order provisioning" />
            </Field>
            <Field label="Events" required>
              <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-line p-3 scroll-thin">
                {WEBHOOK_EVENTS.map((group) => (
                  <div key={group.group}>
                    <p className="mb-1.5 text-[16px] font-semibold uppercase tracking-wide text-ink-4">{group.group}</p>
                    <div className="space-y-1.5">
                      {group.events.map((e) => (
                        <Checkbox
                          key={e}
                          label={<code className="font-mono text-[16px]">{e}</code>}
                          checked={events.includes(e)}
                          onChange={(v) => setEvents(v ? [...events, e] : events.filter((x) => x !== e))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        )}
      </Modal>

      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Manage endpoint"
        description={editing?.url}
        footer={
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Close
          </Button>
        }
      >
        {editing ? (
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-1">
              <KeyValue label="Endpoint ID">
                <code className="font-mono text-[16px]">{editing.id}</code>
              </KeyValue>
              <KeyValue label="URL">{editing.url}</KeyValue>
              <KeyValue label="Description">{editing.description || "—"}</KeyValue>
              <KeyValue label="Health">
                <StatusBadge
                  label={editing.health}
                  tone={editing.health === "healthy" ? "positive" : editing.health === "untested" ? "neutral" : "warn"}
                />
              </KeyValue>
              <KeyValue label="Created">{fmtDateTime(editing.createdAt)}</KeyValue>
              <KeyValue label="Signing secret">
                <code className="font-mono text-[16px]">whsec_••••{editing.signingSecretLast4}</code>
              </KeyValue>
            </div>
            <div>
              <p className="mb-2 text-[18px] font-medium text-ink-2">Events subscribed</p>
              <div className="space-y-1.5">
                {allEvents.map((e) => (
                  <Checkbox
                    key={e}
                    label={<code className="font-mono text-[16px]">{e}</code>}
                    checked={editing.events.includes(e)}
                    onChange={async (v) => {
                      const next = v ? [...editing.events, e] : editing.events.filter((x) => x !== e);
                      await api.updateWebhookEndpoint(editing.id, { events: next });
                      setEditing({ ...editing, events: next });
                    }}
                  />
                ))}
              </div>
            </div>
            <Divider />
            <Button
              variant="secondary"
              className="w-full"
              icon={<Webhook className="h-4 w-4" />}
              onClick={() => {
                setTestTarget(editing);
                setEditing(null);
              }}
            >
              Send test event
            </Button>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={Boolean(testTarget)}
        onClose={() => setTestTarget(null)}
        title="Send a test event"
        description="Delivers a demo payload to the endpoint and records the response."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTestTarget(null)} disabled={testing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={testing}
              onClick={async () => {
                if (!testTarget) return;
                setTesting(true);
                await api.sendTestEvent(testTarget.id, testType);
                setTesting(false);
                setTestTarget(null);
                pushToast({ title: "Test event delivered", body: `${testType} → HTTP 200`, tone: "success" });
              }}
            >
              Send test event
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Event type" required>
            <Select value={testType} onChange={(e) => setTestType(e.target.value)}>
              {allEvents.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-[18px] text-ink-3">
            Endpoint: <code className="font-mono text-[16px]">{testTarget?.url}</code>
          </p>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Event logs                                                          */
/* ------------------------------------------------------------------ */

export function EventsPage() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [selected, setSelected] = useState<WebhookEvent | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => [...data.webhookEvents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [data.webhookEvents],
  );

  const columns: Column<WebhookEvent>[] = [
    { key: "id", header: "Event ID", render: (e) => <code className="font-mono text-[16px]">{e.id}</code> },
    { key: "type", header: "Type", render: (e) => <code className="font-mono text-[18px] text-ink">{e.type}</code> },
    {
      key: "endpoint",
      header: "Endpoint",
      hideOnMobile: true,
      render: (e) => <span className="truncate font-mono text-[16px] text-ink-3">{data.webhookEndpoints.find((x) => x.id === e.endpointId)?.url ?? "—"}</span>,
      csv: (e) => data.webhookEndpoints.find((x) => x.id === e.endpointId)?.url ?? "",
    },
    {
      key: "response",
      header: "Response",
      render: (e) => (
        <StatusBadge
          label={e.responseStatus ? `HTTP ${e.responseStatus}` : "No response"}
          tone={e.responseStatus && e.responseStatus < 400 ? "positive" : "danger"}
        />
      ),
      csv: (e) => e.responseStatus ?? "",
    },
    { key: "attempts", header: "Attempts", align: "right", render: (e) => <span className="tnum">{e.attempts}</span>, csv: (e) => e.attempts },
    { key: "created", header: "Timestamp", render: (e) => <span className="whitespace-nowrap text-[18px] text-ink-3 tnum">{fmtDateTime(e.createdAt)}</span>, sortValue: (e) => new Date(e.createdAt).getTime(), csv: (e) => e.createdAt },
    {
      key: "status",
      header: "Status",
      render: (e) => <StatusBadge label={e.status} tone={e.status === "delivered" ? "positive" : "danger"} />,
      csv: (e) => e.status,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setSelected(e)} onClickCapture={(ev) => ev.stopPropagation()}>
            Inspect
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={e.status === "delivered" && e.responseStatus === 200}
            onClick={async () => {
              setBusy(true);
              await api.retryWebhookEvent(e.id);
              setBusy(false);
              pushToast({ title: "Delivery retried", body: `${e.type} → HTTP 200`, tone: "success" });
            }}
          >
            Retry
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Event logs"
        description="Every webhook the gateway attempted to deliver, with response codes and retry schedule."
        meta={
          <>
            <StatusBadge label={`${rows.filter((e) => e.status === "delivered").length} delivered`} tone="positive" />
            <StatusBadge label={`${rows.filter((e) => e.status === "failed").length} failed`} tone="danger" />
          </>
        }
      />

      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(e) => e.id}
          onRowClick={(e) => setSelected(e)}
          searchPlaceholder="Search events…"
          searchValue={(e) => `${e.id} ${e.type} ${e.payloadSummary}`}
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "all", label: "All statuses" },
                { value: "delivered", label: "Delivered" },
                { value: "failed", label: "Failed" },
                { value: "pending", label: "Pending" },
              ],
              match: (e, v) => e.status === v,
            },
            {
              key: "group",
              label: "Resource",
              options: [
                { value: "all", label: "All resources" },
                ...WEBHOOK_EVENTS.map((g) => ({ value: g.group.toLowerCase(), label: g.group })),
              ],
              match: (e, v) => e.type.startsWith(v),
            },
          ]}
          emptyTitle="No events yet"
          emptyDescription="Send a test event from the webhooks page to see a delivery."
          exportName="webhook-events"
        />
      </Card>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.type ?? ""}
        description={selected?.id}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              onClick={async () => {
                if (!selected) return;
                setBusy(true);
                await api.retryWebhookEvent(selected.id);
                setBusy(false);
                setSelected(null);
                pushToast({ title: "Delivery retried", tone: "success" });
              }}
            >
              Retry delivery
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-1">
              <KeyValue label="Event ID">
                <code className="font-mono text-[16px]">{selected.id}</code>
              </KeyValue>
              <KeyValue label="Type">
                <code className="font-mono text-[16px]">{selected.type}</code>
              </KeyValue>
              <KeyValue label="Endpoint">
                <code className="break-all font-mono text-[16px]">
                  {data.webhookEndpoints.find((x) => x.id === selected.endpointId)?.url}
                </code>
              </KeyValue>
              <KeyValue label="Response">
                <StatusBadge
                  label={selected.responseStatus ? `HTTP ${selected.responseStatus}` : "No response"}
                  tone={selected.responseStatus && selected.responseStatus < 400 ? "positive" : "danger"}
                />
              </KeyValue>
              <KeyValue label="Attempts">{selected.attempts}</KeyValue>
              <KeyValue label="Created">{fmtDateTime(selected.createdAt)}</KeyValue>
              <KeyValue label="Last attempt">{fmtDateTime(selected.lastAttemptAt)}</KeyValue>
              <KeyValue label="Next retry">{fmtDateTime(selected.nextRetryAt)}</KeyValue>
              {selected.relatedPaymentId ? (
                <KeyValue label="Payment">
                  <Link to={`/payments/${selected.relatedPaymentId}`} className="font-mono text-[16px] text-accent hover:underline">
                    {selected.relatedPaymentId}
                  </Link>
                </KeyValue>
              ) : null}
            </div>
            <div>
              <p className="mb-2 text-[16px] font-semibold uppercase tracking-wide text-ink-4">Payload</p>
              <CodeBlock language="json" filename="payload.json" code={JSON.stringify(selected.payload, null, 2)} />
            </div>
            <Callout tone="neutral" title="Delivery is independent of settlement">
              A failed webhook delivery never changes the payment status, and a delivered webhook never
              confirms a payment on its own.
            </Callout>
          </div>
        ) : null}
      </Drawer>

      <p className="flex items-center justify-center gap-1.5 text-center text-[16px] text-ink-4">
        <Terminal className="h-3.5 w-3.5" />
        {rows.length} events recorded · oldest {timeAgo(rows[rows.length - 1]?.createdAt)}
      </p>
    </>
  );
}
