import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSignMessage } from "wagmi";
import {
  Image as ImageIcon,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/services";
import { realApi } from "@/services/api/adapter";
import { apiFetch } from "@/services/api/http";
import { useDemo } from "@/store/demoStore";
import { useWallet } from "@/contexts/WalletContext";
import { DEFAULT_NETWORK, TOKEN, WALLET_DISCLOSURE } from "@/config/app";
import { fmtDateTime, isEmail, isHttpsUrl, timeAgo } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  Checkbox,
  Divider,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Pill,
  StatusBadge,
  Switch,
  Textarea,
} from "@/components/ui";
import { ConfirmDialog, Drawer } from "@/components/ui/Dialog";
import { AddressDisplay, CopyButton } from "@/components/ui/display";
import { MiniStat } from "@/components/common/MetricCard";

function SettingsShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }]}
        title={title}
        description={description}
      />
      <div className="space-y-6">{children}</div>
    </>
  );
}

/* -------------------------------- Business -------------------------------- */

export function BusinessSettings() {
  const merchant = useDemo((s) => s.data.merchant);
  const pushToast = useDemo((s) => s.pushToast);
  const [form, setForm] = useState({
    businessName: merchant.businessName,
    displayName: merchant.displayName,
    website: merchant.website,
    businessEmail: merchant.businessEmail,
    supportEmail: merchant.supportEmail,
    description: merchant.description,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);

  return (
    <SettingsShell title="Business profile" description="How your business appears on hosted checkout, invoices and receipts.">
      <Card>
        <CardHeader title="Profile" />
        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
              {logo ? (
                <img src={logo} alt="Business logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[20px] font-bold text-ink-2">{merchant.logoText}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setLogo(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
              <Button variant="secondary" icon={<ImageIcon className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                Upload logo
              </Button>
              {logo ? (
                <Button variant="ghost" onClick={() => setLogo(null)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business name" required error={errors.businessName}>
              <Input
                value={form.businessName}
                invalid={Boolean(errors.businessName)}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </Field>
            <Field label="Display name" required error={errors.displayName}>
              <Input
                value={form.displayName}
                invalid={Boolean(errors.displayName)}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Website" required error={errors.website}>
            <Input
              value={form.website}
              invalid={Boolean(errors.website)}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business email" required error={errors.businessEmail}>
              <Input
                value={form.businessEmail}
                invalid={Boolean(errors.businessEmail)}
                onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
              />
            </Field>
            <Field label="Support contact" required error={errors.supportEmail}>
              <Input
                value={form.supportEmail}
                invalid={Boolean(errors.supportEmail)}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={async () => {
                const next: Record<string, string | null> = {
                  businessName: form.businessName.trim().length < 2 ? "Required" : null,
                  displayName: form.displayName.trim().length < 2 ? "Required" : null,
                  website: !isHttpsUrl(form.website) ? "Enter a valid URL" : null,
                  businessEmail: !isEmail(form.businessEmail) ? "Enter a valid email" : null,
                  supportEmail: !isEmail(form.supportEmail) ? "Enter a valid email" : null,
                };
                setErrors(next);
                if (Object.values(next).some(Boolean)) return;
                setSaving(true);
                await api.updateMerchant({
                  businessName: form.businessName.trim(),
                  displayName: form.displayName.trim(),
                  website: form.website.trim(),
                  businessEmail: form.businessEmail.trim(),
                  supportEmail: form.supportEmail.trim(),
                  description: form.description.trim(),
                });
                setSaving(false);
                pushToast({ title: "Business profile saved", tone: "success" });
              }}
            >
              Save changes
            </Button>
            <Button variant="ghost" onClick={() => setForm({ ...merchant })}>
              Reset
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Workspace" />
        <div className="px-5 py-2">
          <KeyValue label="Merchant ID">
            <code className="font-mono text-[16px]">{merchant.id}</code>
            <CopyButton value={merchant.id} label="Copy" size="xs" />
          </KeyValue>
          <KeyValue label="Environment">
            <Pill tone="warn">{merchant.environment}</Pill>
          </KeyValue>
          <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
          <KeyValue label="Country">{merchant.country}</KeyValue>
          <KeyValue label="Created">{fmtDateTime(merchant.createdAt)}</KeyValue>
          <KeyValue label="Onboarding">
            <StatusBadge label={merchant.onboardingComplete ? "Complete" : "Incomplete"} tone={merchant.onboardingComplete ? "positive" : "warn"} />
          </KeyValue>
        </div>
      </Card>
    </SettingsShell>
  );
}

/* --------------------------------- Wallet --------------------------------- */

export function WalletSettings() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const wallet = useWallet();
  const { signMessageAsync } = useSignMessage();
  const [changeOpen, setChangeOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <SettingsShell title="Payout wallet" description="Where settled USDT is sent. Changing it requires a new ownership verification.">
      <Card>
        <CardHeader
          title="Connected payout wallet"
          actions={
            <Button variant="secondary" onClick={() => setChangeOpen(true)}>
              Change wallet
            </Button>
          }
        />
        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-canvas/60 p-4">
            <div>
              <p className="text-[16px] uppercase tracking-wide text-ink-4">Payout address</p>
              <AddressDisplay address={data.merchant.payoutWallet} full className="mt-1" />
            </div>
            <StatusBadge
              label={data.merchant.walletVerified ? "Ownership verified (simulated)" : "Not verified"}
              tone={data.merchant.walletVerified ? "positive" : "warn"}
            />
          </div>
          <div className="grid gap-x-8 sm:grid-cols-2 2xl:grid-cols-3">
            <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
            <KeyValue label="Chain ID">{DEFAULT_NETWORK.chainId}</KeyValue>
            <KeyValue label="Settlement asset">{TOKEN.symbol}</KeyValue>
            <KeyValue label="Token contract">
              <code className="break-all font-mono text-[16px]">{TOKEN.contract}</code>
            </KeyValue>
            <KeyValue label="Verified at">{fmtDateTime(data.merchant.walletVerifiedAt)}</KeyValue>
            <KeyValue label="Gas currency">{DEFAULT_NETWORK.currency.symbol}</KeyValue>
          </div>
        </div>
        <div className="border-t border-line px-5 py-3">
          <p className="text-[16px] leading-relaxed text-ink-4">{WALLET_DISCLOSURE}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Wallet connection" description="Used for merchant-side signatures such as refunds." />
        <div className="space-y-3 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[18px] font-semibold text-ink">
                {wallet.address ? wallet.providerName : "No wallet connected"}
              </p>
              {wallet.address ? (
                <code className="font-mono text-[16px] text-ink-3">{wallet.address}</code>
              ) : (
                <p className="text-[18px] text-ink-3">Connect a wallet to authorize refunds.</p>
              )}
              {wallet.simulated && wallet.address ? (
                <p className="mt-1 text-[16px] text-warn">Simulation fallback — no browser wallet detected.</p>
              ) : null}
            </div>
            {wallet.address ? (
              <Button variant="secondary" onClick={wallet.disconnect}>
                Disconnect
              </Button>
            ) : (
              <Button variant="primary" onClick={wallet.connect} loading={wallet.busy}>
                Connect wallet
              </Button>
            )}
          </div>
          {wallet.error ? (
            <Callout tone="danger" title="Wallet error">
              {wallet.error}
            </Callout>
          ) : null}
        </div>
      </Card>

      <Drawer
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        title="Change payout wallet"
        description="The new address must be verified before it can receive settlements."
        footer={
          <>
            <Button variant="ghost" onClick={() => setChangeOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={async () => {
                if (!wallet.address) {
                  setManualError("Connect your wallet via RainbowKit first, then click verify.");
                  return;
                }
                setBusy(true);
                try {
                  const challenge = await realApi.getWalletChallenge();
                  const signature = await signMessageAsync({ message: challenge.message });
                  await realApi.verifyWalletOwnership({
                    wallet: wallet.address,
                    signature,
                    challenge: challenge.challenge,
                    verificationToken: challenge.verificationToken,
                  });
                  setBusy(false);
                  setChangeOpen(false);
                  pushToast({ title: "Wallet verified", body: `${wallet.address.slice(0, 10)}… is now your payout wallet.`, tone: "success" });
                } catch (e) {
                  setBusy(false);
                  pushToast({ title: "Verification failed", body: (e as Error).message, tone: "error" });
                }
              }}
            >
              Verify and update
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[18px] font-medium text-ink-2">Option 1 — connect a wallet</p>
            <Button variant="secondary" onClick={wallet.connect} loading={wallet.busy} disabled={Boolean(wallet.address)}>
              {wallet.address ? `Connected: ${wallet.address.slice(0, 10)}…` : "Connect wallet"}
            </Button>
          </div>
          <Divider />
          <Field label="Option 2 — paste an address" error={manualError} hint="You will still need to complete an ownership challenge before it is used.">
            <Input value={manual} invalid={Boolean(manualError)} onChange={(e) => setManual(e.target.value)} placeholder="0x…" />
          </Field>
          <Callout tone="warn" title="Confirm before you change it">
            Settlements already in flight continue to the previous address. Payments created after the change
            use the new address, and invoices signed before the change will fail PayeeShield verification
            until they are re-issued.
          </Callout>
        </div>
      </Drawer>
    </SettingsShell>
  );
}

/* -------------------------------- Checkout -------------------------------- */

export function CheckoutSettings() {
  const data = useDemo((s) => s.data);
  const patch = useDemo((s) => s.patchMerchant);
  const pushToast = useDemo((s) => s.pushToast);
  const [form, setForm] = useState({
    displayName: data.merchant.displayName,
    description: data.merchant.description,
    logoText: data.merchant.logoText ?? "",
    accentColor: data.merchant.accentColor ?? "#0ea5e9",
    returnUrl: "https://northwind-labs.example/thanks",
    checkoutTitle: "Complete your payment",
  });
  const [options, setOptions] = useState({ fixed: true, customerAmount: true, reusable: true });
  const [saving, setSaving] = useState(false);

  return (
    <SettingsShell title="Checkout configuration" description="Brand appearance and the payment link options available to your team.">
      <Card>
        <CardHeader title="Brand appearance" />
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Merchant display name" required>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </Field>
            <Field label="Checkout title" required>
              <Input value={form.checkoutTitle} onChange={(e) => setForm({ ...form, checkoutTitle: e.target.value })} />
            </Field>
          </div>
          <Field label="Description shown on checkout">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Default return URL" hint="Where customers land after paying if a link has no return URL.">
            <Input value={form.returnUrl} onChange={(e) => setForm({ ...form, returnUrl: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment link options" description="Which link types your team can create." />
        <div className="space-y-2.5 px-6 py-5">
          {(
            [
              ["fixed", "Fixed amount", "Merchant sets the exact amount."],
              ["customerAmount", "Customer enters amount", "Customer chooses within a range."],
              ["reusable", "Reusable link", "One link, many independent payments."],
            ] as const
          ).map(([key, title, desc]) => (
            <Checkbox
              key={key}
              label={title}
              description={desc}
              checked={options[key]}
              onChange={(v) => setOptions({ ...options, [key]: v })}
            />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Checkout preview" />
        <div className="px-6 py-5">
          <div className="rounded-md border border-line bg-canvas p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-[16px] font-bold text-white">
                {data.merchant.logoText}
              </span>
              <div>
                <p className="text-[18px] font-semibold text-ink">{form.displayName}</p>
                <p className="text-[16px] text-ink-4">{DEFAULT_NETWORK.name}</p>
              </div>
            </div>
            <p className="mt-4 text-[20px] font-semibold text-ink">{form.checkoutTitle}</p>
            <p className="mt-1 text-[18px] text-ink-3">{form.description}</p>
          </div>
        </div>
      </Card>

      <div>
        <Button
          variant="primary"
          icon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await apiFetch("/v1/merchants/me", {
                method: "PATCH",
                body: JSON.stringify({
                  displayName: form.displayName,
                  description: form.description,
                  logoText: form.logoText,
                  accentColor: form.accentColor,
                }),
              });
              patch({ displayName: form.displayName, description: form.description, logoText: form.logoText, accentColor: form.accentColor });
              pushToast({ title: "Checkout configuration saved", tone: "success" });
            } catch (e) {
              pushToast({ title: "Save failed", body: (e as Error).message, tone: "error" });
            } finally {
              setSaving(false);
            }
          }}
        >
          Save configuration
        </Button>
      </div>
    </SettingsShell>
  );
}

/* ------------------------------ Notifications ----------------------------- */

export function NotificationSettings() {
  const pushToast = useDemo((s) => s.pushToast);
  const [prefs, setPrefs] = useState({
    paidReceipt: true,
    paidReceiptCopy: true,
    refund: true,
    renewal: true,
    renewalReminder: true,
    failedRenewal: true,
    exceptions: true,
    weeklyDigest: false,
    email: "billing@northwind-labs.example",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rows: [keyof typeof prefs, string, string][] = [
    ["paidReceipt", "Paid receipts", "Email the customer a receipt after settlement."],
    ["refund", "Refund notifications", "Notify the customer when a refund is created and settles."],
    ["renewal", "Subscription renewal notifications", "Notify the customer before each scheduled renewal."],
    ["renewalReminder", "Renewal reminders", "Send a reminder 24 hours before the next charge."],
    ["failedRenewal", "Failed renewal alerts", "Notify the customer and your team when a renewal fails."],
    ["exceptions", "Exception alerts", "Email the team when a critical exception is detected."],
    ["weeklyDigest", "Weekly volume digest", "Summary of volume, refunds and renewals."],
  ];

  return (
    <SettingsShell title="Notification preferences" description="Paid receipts are sent after settlement. Unpaid invoices are never emailed automatically.">
      <Card>
        <CardHeader title="Email notifications" />
        <div className="space-y-2.5 px-6 py-5">
          {rows.map(([key, title, desc]) => (
            <div key={key} className="flex items-start justify-between gap-4 rounded-md border border-line p-3.5">
              <div>
                <p className="text-[18px] font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-[18px] leading-relaxed text-ink-3">{desc}</p>
              </div>
              <Switch
                checked={Boolean(prefs[key])}
                onChange={(v) => setPrefs({ ...prefs, [key]: v })}
                label={title}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Delivery address" />
        <div className="space-y-4 px-6 py-5">
          <Field label="Notification email" required error={error}>
            <Input
              value={prefs.email}
              invalid={Boolean(error)}
              onChange={(e) => setPrefs({ ...prefs, email: e.target.value })}
            />
          </Field>
          <Checkbox
            label="Also send me a copy of customer receipts"
            description="Useful while testing the integration."
            checked={prefs.paidReceiptCopy}
            onChange={(v) => setPrefs({ ...prefs, paidReceiptCopy: v })}
          />
          <div>
            <Button
              variant="primary"
              icon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={async () => {
                if (!isEmail(prefs.email)) {
                  setError("Enter a valid email address");
                  return;
                }
                setError(null);
                setSaving(true);
                try {
                  await apiFetch("/v1/merchants/me", {
                    method: "PATCH",
                    body: JSON.stringify({ notificationPrefs: prefs }),
                  });
                  pushToast({ title: "Notification preferences saved", tone: "success" });
                } catch (e) {
                  pushToast({ title: "Save failed", body: (e as Error).message, tone: "error" });
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save preferences
            </Button>
          </div>
        </div>
      </Card>

      <Callout tone="neutral" title="Delivery status is tracked separately">
        Email delivery has its own state (queued, sent, delivered, failed) and never changes a payment status.
        Failures appear in the exception centre.
      </Callout>
    </SettingsShell>
  );
}

/* -------------------------------- Security -------------------------------- */

export function SecuritySettings() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  return (
    <SettingsShell title="Security" description="API credentials, signing keys and security events for this workspace.">
      <Card>
        <CardHeader title="Active API keys" actions={<Link to="/developers/api-keys" className="text-[18px] font-medium text-accent hover:underline">Manage keys</Link>} />
        <div className="divide-y divide-line">
          {data.apiKeys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-ink">{k.name}</p>
                <code className="font-mono text-[16px] text-ink-4">{k.publishable}</code>
              </div>
              <div className="flex items-center gap-3">
                <code className="font-mono text-[16px] text-ink-4">••••{k.secretLast4}</code>
                <StatusBadge label={k.status === "active" ? "Active" : "Revoked"} tone={k.status === "active" ? "positive" : "neutral"} />
                <span className="text-[16px] text-ink-4">last used {timeAgo(k.lastUsedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="PayeeShield signing keys" description="Delegated gateway keys that sign payment requests. Private keys are never exposed to the frontend." />
        <div className="space-y-3 px-6 py-5">
          <div className="rounded-md border border-line bg-canvas/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[18px] font-semibold text-ink">gwk_2F91A</p>
                <p className="text-[16px] text-ink-3">Activated {fmtDateTime(new Date(Date.now() - 30 * 86400_000).toISOString())}</p>
              </div>
              <StatusBadge label="Active" tone="positive" />
            </div>
            <div className="mt-3 grid gap-x-8 sm:grid-cols-2 2xl:grid-cols-3">
              <KeyValue label="Algorithm">Delegated signature over protected fields</KeyValue>
              <KeyValue label="Rotated from">gwk_1C07D (retained for verification)</KeyValue>
              <KeyValue label="Key status">Active</KeyValue>
              <KeyValue label="Rotation policy">Operator-managed</KeyValue>
            </div>
          </div>
          <div className="rounded-md border border-line p-4 opacity-70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[18px] font-semibold text-ink">gwk_1C07D</p>
                <p className="text-[16px] text-ink-3">Previous key, retained so older requests still verify</p>
              </div>
              <StatusBadge label="Retired" tone="neutral" />
            </div>
          </div>
          <Button variant="secondary" onClick={() => setRotateOpen(true)} icon={<ShieldCheck className="h-4 w-4" />}>
            Request key rotation
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Webhook signing secrets" actions={<Link to="/developers/webhooks" className="text-[18px] font-medium text-accent hover:underline">Manage endpoints</Link>} />
        <div className="divide-y divide-line">
          {data.webhookEndpoints.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <code className="min-w-0 truncate font-mono text-[16px] text-ink-2">{e.url}</code>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[16px] text-ink-4">whsec_••••{e.signingSecretLast4}</code>
                <Button size="sm" variant="ghost" onClick={() => setRevokeOpen(true)}>
                  Rotate
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Session and workspace" />
        <div className="grid gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          <KeyValue label="Session">Demo session stored in this browser</KeyValue>
          <KeyValue label="Authentication">Simulated — no identity provider</KeyValue>
          <KeyValue label="Merchant ID">
            <code className="font-mono text-[16px]">{data.merchant.id}</code>
          </KeyValue>
          <KeyValue label="Environment">
            <Pill tone="warn">{data.merchant.environment}</Pill>
          </KeyValue>
          <KeyValue label="Customer scoping">Workspace-scoped records only</KeyValue>
          <KeyValue label="Seed phrase / private key input">Never requested</KeyValue>
        </div>
      </Card>

      <Card>
        <CardHeader title="Security event history" />
        <ul className="divide-y divide-line">
          {data.securityEvents.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-ink">{e.event}</p>
                <p className="truncate text-[16px] text-ink-3">{e.detail}</p>
              </div>
              <span className="text-[16px] text-ink-4 tnum">
                {fmtDateTime(e.at)} · {e.ip}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        destructive
        title="Rotate the webhook signing secret?"
        confirmLabel="Rotate secret"
        body="The current secret stops working immediately for new deliveries. Update your verification code before rotating. The new secret is shown once."
        onConfirm={async () => {
          try {
            const ep = data.webhookEndpoints[0];
            if (!ep) { pushToast({ title: "No webhook endpoint", body: "Create a webhook endpoint first.", tone: "warn" }); return; }
            const res = await apiFetch<{ signingSecret: string }>(`/v1/webhooks/${ep.id}/rotate-secret`, { method: "POST" });
            setRevokeOpen(false);
            pushToast({ title: "Signing secret rotated", body: `New secret: ${res.signingSecret.slice(0, 12)}… (full secret in webhooks page)`, tone: "success" });
          } catch (e) {
            pushToast({ title: "Rotation failed", body: (e as Error).message, tone: "error" });
          }
        }}
      />

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Rotate API key"
        confirmLabel="Rotate key"
        body="This revokes your current secret key and creates a new one. The new key is shown once — update your server configuration immediately."
        onConfirm={async () => {
          try {
            const oldKey = data.apiKeys.find(k => k.status === "active");
            if (oldKey) await apiFetch(`/v1/api-keys/${oldKey.id}/revoke`, { method: "POST" });
            const newKey = await apiFetch<{ secret: string; publishable: string }>("/v1/api-keys", {
              method: "POST",
              body: JSON.stringify({ name: `rotated-${Date.now()}`, environment: "testnet" }),
            });
            setRotateOpen(false);
            pushToast({ title: "API key rotated", body: `New secret: ${newKey.secret.slice(0, 12)}… (shown once — copy now!)`, tone: "success" });
          } catch (e) {
            pushToast({ title: "Rotation failed", body: (e as Error).message, tone: "error" });
          }
        }}
      />
    </SettingsShell>
  );
}

/* ----------------------------- Gas sponsorship ---------------------------- */

export function GasSponsorshipSettings() {
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [budget, setBudget] = useState(String(data.gasGuard.merchantBudgetWbt));
  const [daily, setDaily] = useState(String(data.gasGuard.dailyLimitWbt));
  const [ops, setOps] = useState({ payments: true, refunds: true, renewals: true, activations: false });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const spent = data.gasGuard.merchantSpentWbt;

  return (
    <SettingsShell title="Gas sponsorship" description="How much the gateway spends on network gas for your supported payment operations.">
      <Card>
        <CardHeader title="Sponsorship budget" description="Merchant-level visibility and configurable limits." />
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <MiniStat label="Spent" value={`${spent.toFixed(4)} WBT`} />
            <MiniStat label="Budget" value={`${data.gasGuard.merchantBudgetWbt} WBT`} />
            <MiniStat label="Remaining" value={`${Math.max(0, data.gasGuard.merchantBudgetWbt - spent).toFixed(4)} WBT`} tone="warn" />
          </div>
          <div>
            <div className="flex items-center justify-between text-[18px]">
              <span className="text-ink-3">Budget used</span>
              <span className="font-medium text-ink tnum">{Math.round((spent / data.gasGuard.merchantBudgetWbt) * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas-alt">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (spent / data.gasGuard.merchantBudgetWbt) * 100)}%` }} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Total budget (WBT)" required error={errors.budget}>
              <Input
                inputMode="decimal"
                value={budget}
                invalid={Boolean(errors.budget)}
                onChange={(e) => setBudget(e.target.value)}
              />
            </Field>
            <Field label="Daily limit (WBT)" required error={errors.daily}>
              <Input
                inputMode="decimal"
                value={daily}
                invalid={Boolean(errors.daily)}
                onChange={(e) => setDaily(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Supported operations" description="Which operations the gateway sponsors gas for on your behalf." />
        <div className="space-y-2.5 px-6 py-5">
          {(
            [
              ["payments", "One-time payments", "Hosted checkout payments signed by the customer."],
              ["refunds", "Refunds", "Refunds signed by the merchant and submitted by the relayer."],
              ["renewals", "Subscription renewals", "Recurring transfers inside the approved allowance."],
              ["activations", "Subscription activation", "Usually customer-paid; sponsorship is optional."],
            ] as const
          ).map(([key, title, desc]) => (
            <div key={key} className="flex items-start justify-between gap-4 rounded-md border border-line p-3.5">
              <div>
                <p className="text-[18px] font-medium text-ink">{title}</p>
                <p className="mt-0.5 text-[18px] leading-relaxed text-ink-3">{desc}</p>
              </div>
              <Switch checked={ops[key]} onChange={(v) => setOps({ ...ops, [key]: v })} label={title} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Current policy" description="Effective limits applied by GasGuard before submission." />
        <div className="grid gap-x-8 px-6 py-2.5 sm:grid-cols-2 2xl:grid-cols-3">
          <KeyValue label="Max gas per transaction">{data.gasGuard.maxGasPerTxGwei.toLocaleString()}</KeyValue>
          <KeyValue label="Rate limit">{data.gasGuard.rateLimitPerMinute} per minute</KeyValue>
          <KeyValue label="Allowed network">{data.gasGuard.allowedNetwork}</KeyValue>
          <KeyValue label="Allowed token">{data.gasGuard.allowedToken}</KeyValue>
          <KeyValue label="Allowed contract">
            <code className="break-all font-mono text-[16px]">{data.gasGuard.allowedContract}</code>
          </KeyValue>
          <KeyValue label="Authorization expiry check">
            <StatusBadge label={data.gasGuard.authorisationExpiryCheck ? "Enforced" : "Disabled"} tone="positive" />
          </KeyValue>
          <KeyValue label="Replay protection">
            <StatusBadge label={data.gasGuard.replayProtection ? "Enabled" : "Disabled"} tone="positive" />
          </KeyValue>
          <KeyValue label="Emergency pause">
            <StatusBadge label={data.gasGuard.emergencyPaused ? "Active" : "Off"} tone={data.gasGuard.emergencyPaused ? "danger" : "neutral"} />
          </KeyValue>
        </div>
        <div className="border-t border-line px-5 py-3">
          <p className="text-[16px] leading-relaxed text-ink-4">
            Global relayer controls are restricted to the gateway operator. Merchants configure their own
            budget and limits only.{" "}
            <Link to="/gasguard" className="font-medium text-accent hover:underline">
              Open GasGuard
            </Link>
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Usage reporting" description="Sponsored submissions recorded for this workspace" />
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-4">
          <MiniStat label="Transactions" value={data.relayer.length} />
          <MiniStat label="WBT consumed" value={data.relayer.reduce((a, r) => a + Number(r.wbtCost), 0).toFixed(6)} />
          <MiniStat label="Payments" value={data.relayer.filter((r) => r.operation === "payment.relay").length} />
          <MiniStat label="Rejected" value={data.relayer.filter((r) => r.status === "rejected").length} tone="danger" />
        </div>
      </Card>

      <div>
        <Button
          variant="primary"
          icon={<Save className="h-4 w-4" />}
          loading={saving}
          onClick={async () => {
            const next: Record<string, string | null> = {
              budget: Number(budget) <= 0 ? "Budget must be greater than zero" : null,
              daily: Number(daily) <= 0 ? "Daily limit must be greater than zero" : null,
            };
            setErrors(next);
            if (Object.values(next).some(Boolean)) return;
            setSaving(true);
            try {
              await apiFetch("/v1/gas-guard", {
                method: "PATCH",
                body: JSON.stringify({
                  merchantBudgetWbt: (BigInt(Math.floor(Number(budget) * 1e18))).toString(),
                  dailyLimitWbt: (BigInt(Math.floor(Number(daily) * 1e18))).toString(),
                }),
              });
              pushToast({ title: "Sponsorship settings saved", tone: "success" });
            } catch (e) {
              pushToast({ title: "Save failed", body: (e as Error).message, tone: "error" });
            } finally {
              setSaving(false);
            }
          }}
        >
          Save sponsorship settings
        </Button>
      </div>

      <Callout tone="neutral" title="No keys in the frontend" icon={<SettingsIcon className="h-4 w-4" />}>
        The relayer wallet and its private key live with the gateway operator. Nothing in this frontend can
        sign or submit a sponsored transaction.
      </Callout>
    </SettingsShell>
  );
}
