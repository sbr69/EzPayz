import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { realApi } from "@/services/api/adapter";
import { apiFetch } from "@/services/api/http";
import { useDemo } from "@/store/demoStore";
import { useWallet } from "@/contexts/WalletContext";
import { DEFAULT_NETWORK, TOKEN, WALLET_DISCLOSURE } from "@/config/app";
import { isEmail, isEvmAddress, isHttpsUrl } from "@/lib/money";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  Field,
  Input,
  KeyValue,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { CopyField } from "@/components/ui/display";

const STEPS = [
  "Business profile",
  "Payout wallet",
  "Payment configuration",
  "Developer setup",
  "Notifications",
  "Complete",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const merchant = useDemo((s) => s.data.merchant);
  const isDemo = useDemo((s) => s.isDemo);
  const patchMerchant = useDemo((s) => s.patchMerchant);

  /** Updates both the real API (PATCH /v1/merchants/me) and the local demo store. */
  async function updateMerchant(patch: Record<string, unknown>) {
    patchMerchant(patch); // update local store for immediate UI feedback
    if (isDemo) return; // demo mode: no backend exists — the local store is the source of truth
    try {
      await apiFetch("/v1/merchants/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      pushToast({ title: "Failed to save", body: (e as Error).message, tone: "error" });
    }
  }
  const setStep = useDemo((s) => s.setOnboardingStep);
  const stepIndex = useDemo((s) => s.onboardingStep);
  const pushToast = useDemo((s) => s.pushToast);
  // Merchant preference for how long hosted checkout sessions stay payable.
  const [expiryHours, setExpiryHours] = useState(() => String(merchant.checkoutExpiryHours ?? 72));

  const [form, setForm] = useState({
    businessName: merchant.businessName,
    displayName: merchant.displayName,
    website: merchant.website,
    businessEmail: merchant.businessEmail,
    supportEmail: merchant.supportEmail,
    description: merchant.description,
  });
  const [logo, setLogo] = useState<string | null>(null);
  const [notifications, setNotifications] = useState({
    paidReceipt: true,
    refund: true,
    renewal: true,
    failedRenewal: true,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ publishable: string; secret: string; webhookSecret: string } | null>(null);
  const [secretConfirmed, setSecretConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const wallet = useWallet();
  const { address: wagmiAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [verifying, setVerifying] = useState(false);

  const initials = useMemo(
    () =>
      (form.displayName || form.businessName)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "EZ",
    [form.displayName, form.businessName],
  );

  function validateProfile() {
    const next: Record<string, string | null> = {
      businessName: form.businessName.trim().length < 2 ? "Enter your registered business name" : null,
      displayName: form.displayName.trim().length < 2 ? "Enter the name customers will see" : null,
      website: !isHttpsUrl(form.website) ? "Enter a valid URL (https://…)" : null,
      businessEmail: !isEmail(form.businessEmail) ? "Enter a valid email address" : null,
      supportEmail: !isEmail(form.supportEmail) ? "Enter a valid email address" : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function next() {
    if (stepIndex === 0) {
      if (!validateProfile()) return;
      await updateMerchant({
        businessName: form.businessName.trim(),
        displayName: form.displayName.trim(),
        website: form.website.trim(),
        businessEmail: form.businessEmail.trim(),
        supportEmail: form.supportEmail.trim(),
        description: form.description.trim(),
        logoText: initials,
      });
    }
    if (stepIndex === 1 && !merchant.walletVerified) {
      pushToast({ title: "Connect and verify a payout wallet", body: "Step 2 must be completed first.", tone: "warn" });
      return;
    }
    if (stepIndex === 2) {
      const hours = Math.max(1, Math.min(8760, Number(expiryHours) || 72));
      await updateMerchant({ checkoutExpiryHours: hours });
      pushToast({
        title: "Checkout expiry saved",
        body: `New checkout sessions stay payable for ${hours} hour${hours === 1 ? "" : "s"}.`,
        tone: "success",
      });
    }
    if (stepIndex === 3 && !secretConfirmed) {
      pushToast({ title: "Confirm you stored the secret key", body: "Tick the confirmation to continue.", tone: "warn" });
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 350));
    setBusy(false);
    if (stepIndex === STEPS.length - 1) {
      await updateMerchant({ onboardingComplete: true });
      navigate("/dashboard");
      return;
    }
    setStep(Math.min(stepIndex + 1, STEPS.length - 1));
    window.scrollTo({ top: 0 });
  }

  async function generateCredentials() {
    if (isDemo) {
      // Demo mode — fabricate obviously-fake credentials locally (no backend to call).
      const rand = () => Math.random().toString(36).slice(2, 12);
      setCreds({
        publishable: `pk_test_demo_${rand()}`,
        secret: `sk_test_demo_${rand()}${rand()}`,
        webhookSecret: `whsec_demo_${rand()}`,
      });
      return;
    }
    setBusy(true);
    try {
      const key = await apiFetch<{ id: string; publishable: string; secret: string }>("/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Onboarding key", environment: "testnet" }),
      });
      const endpoint = await apiFetch<{ id: string; signingSecret: string }>("/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": `onboarding-webhook-${Date.now()}` },
        body: JSON.stringify({
          url: "https://api.example-integration.dev/hooks/whitepay",
          description: "Created during onboarding",
          eventTypes: ["payment.succeeded", "payment.failed", "refund.succeeded"],
        }),
      });
      setCreds({
        publishable: key.publishable,
        secret: key.secret,
        webhookSecret: endpoint.signingSecret,
      });
    } catch (e) {
      pushToast({ title: "Failed to generate credentials", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-6">
          <img src="/logo.png" alt="EzPayz" className="h-8 w-8 rounded-[10px] object-cover shadow-xs" />
          <div>
            <p className="font-display text-[24px] leading-tight text-ink">Merchant onboarding</p>
            <p className="text-[15px] text-ink-4">
              Step {stepIndex + 1} of {STEPS.length} · {STEPS[stepIndex]}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <ol className="mb-7 flex flex-wrap gap-x-1 gap-y-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[16px] font-semibold tnum ${
                  i < stepIndex
                    ? "border-accent bg-accent text-white"
                    : i === stepIndex
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line-strong bg-surface text-ink-4"
                }`}
              >
                {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={`text-[15px] ${i === stepIndex ? "font-semibold text-ink" : "text-ink-4"}`}>{s}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-4 bg-line-strong sm:w-8" /> : null}
            </li>
          ))}
        </ol>

        {stepIndex === 0 ? (
          <Card className="p-5">
            <h2 className="font-display text-[26px] leading-tight text-ink">Business profile</h2>
            <p className="mt-1 text-[17px] text-ink-3">
              This information appears on hosted checkout, invoices and paid receipts.
            </p>
            <div className="mt-5 space-y-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business name" required error={errors.businessName} htmlFor="ob-bn">
                  <Input
                    id="ob-bn"
                    value={form.businessName}
                    invalid={Boolean(errors.businessName)}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  />
                </Field>
                <Field label="Display name" required error={errors.displayName} htmlFor="ob-dn">
                  <Input
                    id="ob-dn"
                    value={form.displayName}
                    invalid={Boolean(errors.displayName)}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Website" required error={errors.website} htmlFor="ob-web">
                <Input
                  id="ob-web"
                  value={form.website}
                  invalid={Boolean(errors.website)}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://company.example"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business email" required error={errors.businessEmail} htmlFor="ob-be">
                  <Input
                    id="ob-be"
                    value={form.businessEmail}
                    invalid={Boolean(errors.businessEmail)}
                    onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
                  />
                </Field>
                <Field label="Support email" required error={errors.supportEmail} htmlFor="ob-se">
                  <Input
                    id="ob-se"
                    value={form.supportEmail}
                    invalid={Boolean(errors.supportEmail)}
                    onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Business description" hint="Shown to customers on the checkout page.">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <Field label="Logo" hint="PNG or SVG up to 1 MB. Stored locally in your browser.">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-line bg-canvas">
                    {logo ? (
                      <img src={logo} alt="Business logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[20px] font-bold text-ink-2">{initials}</span>
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
                        if (file.size > 1024 * 1024) {
                          setErrors({ ...errors, logo: "File is larger than 1 MB" });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setLogo(String(reader.result));
                        reader.readAsDataURL(file);
                        setErrors({ ...errors, logo: null });
                      }}
                    />
                    <Button variant="secondary" icon={<ImageIcon className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
                      Upload logo
                    </Button>
                    {logo ? (
                      <Button variant="ghost" onClick={() => setLogo(null)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Field>
              {errors.logo ? <p className="text-[18px] font-medium text-danger">{errors.logo}</p> : null}
            </div>
          </Card>
        ) : null}

        {stepIndex === 1 ? (
          <Card className="p-5">
            <h2 className="font-display text-[26px] leading-tight text-ink">Payout wallet</h2>
            <p className="mt-1 text-[17px] text-ink-3">
              USDT settled through the gateway is paid out to this address on {DEFAULT_NETWORK.name}.
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-line bg-canvas/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <Wallet className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-[18px] font-semibold text-ink">
                        {wallet.address ? wallet.providerName : "No wallet connected"}
                      </p>
                      <p className="text-[18px] text-ink-3">
                        {wallet.address ? (
                          <code className="font-mono">{wallet.address}</code>
                        ) : (
                          "Connect MetaMask or another compatible EVM wallet."
                        )}
                      </p>
                      {wallet.simulated && wallet.address ? (
                        <p className="mt-1 text-[16px] text-warn">
                          Simulation fallback active — no browser wallet was detected.
                        </p>
                      ) : null}
                      {wallet.error ? <p className="mt-1 text-[16px] text-danger">{wallet.error}</p> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div className="rounded-md border border-line p-3">
                  <p className="text-[16px] uppercase tracking-wide text-ink-4">Network</p>
                  <p className="mt-1 text-[18px] font-medium text-ink">{DEFAULT_NETWORK.name}</p>
                </div>
                <div className="rounded-md border border-line p-3">
                  <p className="text-[16px] uppercase tracking-wide text-ink-4">Chain ID</p>
                  <p className="mt-1 text-[18px] font-medium text-ink tnum">{DEFAULT_NETWORK.chainId}</p>
                </div>
                <div className="rounded-md border border-line p-3">
                  <p className="text-[16px] uppercase tracking-wide text-ink-4">Wallet status</p>
                  <p className="mt-1 text-[18px] font-medium text-ink">
                    {merchant.walletVerified
                      ? wallet.simulated
                        ? "Verified (simulated)"
                        : "Verified"
                      : wallet.address
                        ? "Connected"
                        : "Not connected"}
                  </p>
                </div>
              </div>

              {wallet.address && !isEvmAddress(wallet.address) ? (
                <Callout tone="danger" title="Invalid address format">
                  The connected account is not a valid 20-byte EVM address.
                </Callout>
              ) : null}

              {wallet.address ? (
                merchant.walletVerified ? (
                  <Callout tone="positive" title="Wallet ownership verified">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {wallet.simulated
                          ? "A simulated challenge was completed for "
                          : "You signed the ownership challenge for "}
                        <code className="font-mono">{merchant.payoutWallet.slice(0, 12)}…</code>. You can
                        replace the wallet at any time from Settings → Payout wallet.
                      </span>
                    </div>
                  </Callout>
                ) : (
                  <div className="space-y-3 rounded-md border border-line p-4">
                    <p className="text-[18px] font-semibold text-ink">Verify wallet ownership</p>
                    <p className="text-[18px] leading-relaxed text-ink-3">
                      The gateway asks the connected wallet to sign a one-time challenge. This proves you control
                      the payout wallet — required before accepting payments.
                    </p>
                    {wagmiAddress ? (
                      <Button
                        variant="primary"
                        loading={verifying}
                        onClick={async () => {
                          setVerifying(true);
                          try {
                            const challenge = await realApi.getWalletChallenge();
                            const signature = await signMessageAsync({ message: challenge.message });
                            await realApi.verifyWalletOwnership({
                              wallet: wagmiAddress,
                              signature,
                              challenge: challenge.challenge,
                              verificationToken: challenge.verificationToken,
                            });
                            // Only update walletVerified in the local store — the verify endpoint
                            // already set payoutWallet + walletVerified in the DB. Do NOT patch
                            // payoutWallet here (the backend PATCH resets walletVerified when it changes).
                            patchMerchant({ walletVerified: true, payoutWallet: wagmiAddress });
                            pushToast({ title: "Wallet verified", body: `${wagmiAddress.slice(0, 10)}… is now your payout wallet.`, tone: "success" });
                          } catch (e) {
                            pushToast({ title: "Verification failed", body: (e as Error).message, tone: "error" });
                          } finally {
                            setVerifying(false);
                          }
                        }}
                      >
                        Sign verification challenge
                      </Button>
                    ) : (
                      <Callout tone="warn" title="Connect a wallet first">
                        Connect your payout wallet via the RainbowKit "Connect Wallet" button to verify ownership.
                      </Callout>
                    )}
                  </div>
                )
              ) : null}

              <Callout tone="neutral" title="What wallet connection does not mean">
                {WALLET_DISCLOSURE} Connecting a wallet does not constitute business verification, and no
                legal entity checks are performed by the gateway in this MVP.
              </Callout>
            </div>
          </Card>
        ) : null}

        {stepIndex === 2 ? (
          <Card className="p-5">
            <h2 className="font-display text-[26px] leading-tight text-ink">Payment configuration</h2>
            <p className="mt-1 text-[17px] text-ink-3">
              These values are configurable gateway metadata. They do not change the network or the token
              contract you settle on.
            </p>
            <div className="mt-5 space-y-4">
              <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-1">
                <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
                <KeyValue label="Chain ID">{DEFAULT_NETWORK.chainId}</KeyValue>
                <KeyValue label="Gas currency">
                  {DEFAULT_NETWORK.currency.symbol} — {DEFAULT_NETWORK.currency.name}
                </KeyValue>
                <KeyValue label="Settlement asset">
                  {TOKEN.symbol} — {TOKEN.name}
                </KeyValue>
                <KeyValue label="Token contract (testnet)">
                  <code className="break-all font-mono text-[16px]">{TOKEN.contract}</code>
                </KeyValue>
                <KeyValue label="Token decimals">
                  {TOKEN.decimals === null
                    ? "Unknown"
                    : `${TOKEN.decimals}${TOKEN.decimalsVerified ? " (verified)" : " (unverified)"}`}
                </KeyValue>
                <KeyValue label="Delegated transfer support">
                  {TOKEN.eip3009Verified ? (
                    <span className="text-positive">Verified (EIP-3009)</span>
                  ) : (
                    <span className="text-warn">Not verified</span>
                  )}
                </KeyValue>
              </div>
              <Field label="Default checkout expiry" htmlFor="ob-exp">
                <Select
                  key={String(merchant.checkoutExpiryHours)}
                  id="ob-exp"
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(e.target.value)}
                >
                  {["24", "72", "168"].includes(expiryHours) ? null : (
                    <option value={expiryHours}>{expiryHours} hours</option>
                  )}
                  <option value="24">24 hours</option>
                  <option value="72">72 hours</option>
                  <option value="168">7 days</option>
                </Select>
              </Field>
              {TOKEN.eip3009Verified ? (
                <Callout tone="info" title="Gasless checkout: enabled">
                  The configured test {TOKEN.symbol} contract supports delegated transfers (EIP-3009),
                  verified on-chain. At checkout, customers sign a free payment authorization and the
                  EzPayz relayer submits it on-chain — paying the WBT gas for them.
                </Callout>
              ) : (
                <Callout tone="warn" title="EIP-3009 support is a technical dependency">
                  Gasless checkout depends on the settlement token implementing delegated transfers
                  (EIP-3009). This has not been verified for the configured test {TOKEN.symbol} contract, so
                  all authorization flows in this frontend are simulated and clearly labelled.
                </Callout>
              )}
            </div>
          </Card>
        ) : null}

        {stepIndex === 3 ? (
          <Card className="p-5">
            <h2 className="font-display text-[26px] leading-tight text-ink">Developer setup</h2>
            <p className="mt-1 text-[17px] text-ink-3">
              Generate demo API credentials for the test environment. Secret values are shown once.
            </p>
            <div className="mt-5 space-y-4">
              {!creds ? (
                <div className="space-y-4">
                  {isDemo ? (
                    <Callout tone="info" title="Demo credentials">
                      These are obviously fake values generated in your browser. Real secrets are never
                      exposed to client-side code — they are created server-side and shown once.
                    </Callout>
                  ) : (
                    <Callout tone="info" title="Live testnet credentials">
                      These are real testnet API credentials for your workspace. The secret key is shown
                      once — store it securely before continuing.
                    </Callout>
                  )}
                  <Button variant="primary" onClick={generateCredentials} loading={busy}>
                    {isDemo ? "Generate demo API credentials" : "Generate API credentials"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <CopyField label="Publishable API key" value={creds.publishable} />
                  <div className="space-y-1.5">
                    <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">
                      Secret API key — shown once
                    </p>
                    <div className="flex items-center gap-2 rounded-md border border-warn-line bg-warn-soft/60 px-2.5 py-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-[18px] text-ink">{creds.secret}</code>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Copy className="h-3 w-3" />}
                        onClick={() => navigator.clipboard?.writeText(creds.secret)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <CopyField label="Webhook signing secret" value={creds.webhookSecret} />
                  <Checkbox
                    checked={secretConfirmed}
                    onChange={setSecretConfirmed}
                    label="I have stored the secret key securely"
                    description="The secret will not be shown again. If you lose it, revoke the key and create a new one."
                  />
                </div>
              )}
            </div>
          </Card>
        ) : null}

        {stepIndex === 4 ? (
          <Card className="p-5">
            <h2 className="font-display text-[26px] leading-tight text-ink">Notification preferences</h2>
            <p className="mt-1 text-[17px] text-ink-3">
              Choose which payment events trigger emails. Paid receipts are sent after settlement — unpaid
              invoices are never emailed automatically.
            </p>
            <div className="mt-5 space-y-3">
              {[
                ["paidReceipt", "Paid receipts", "Email a receipt to the customer after a payment settles."],
                ["refund", "Refund notifications", "Notify the customer when a refund is created and settles."],
                ["renewal", "Subscription renewal notifications", "Notify the customer before each scheduled renewal."],
                ["failedRenewal", "Failed renewal alerts", "Notify both the customer and your team when a renewal fails."],
              ].map(([key, title, desc]) => (
                <div key={key} className="flex items-start justify-between gap-4 rounded-md border border-line p-3.5">
                  <div>
                    <p className="text-[18px] font-medium text-ink">{title}</p>
                    <p className="mt-0.5 text-[18px] leading-relaxed text-ink-3">{desc}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof typeof notifications]}
                    onChange={(v) => setNotifications({ ...notifications, [key]: v })}
                    label={title}
                  />
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {stepIndex === 5 ? (
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive">
              <Check className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-[32px] leading-tight text-ink">
              {isDemo ? "Onboarding complete." : <>You&apos;re ready to <span className="italic text-accent">get paid.</span></>}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[17px] leading-relaxed text-ink-3">
              {isDemo
                ? `${merchant.displayName} is ready to accept USDT on ${DEFAULT_NETWORK.name}. Your workspace is preloaded with demo payments, invoices, subscriptions and exceptions so you can explore every part of the product.`
                : `${merchant.displayName} is ready to accept USDT on ${DEFAULT_NETWORK.name}. Create your first payment link or invoice from the dashboard and take a real test payment.`}
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-md border border-line bg-canvas/60 px-3.5 py-1 text-left">
              <KeyValue label="Payout wallet">
                <code className="font-mono text-[16px]">{merchant.payoutWallet.slice(0, 14)}…</code>
              </KeyValue>
              <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
              <KeyValue label="Settlement asset">{TOKEN.symbol}</KeyValue>
            </div>
          </Card>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            disabled={stepIndex === 0}
            onClick={() => setStep(Math.max(0, stepIndex - 1))}
          >
            Back
          </Button>
          <Button
            variant="primary"
            onClick={next}
            loading={busy}
            iconRight={<ArrowRight className="h-4 w-4" />}
            disabled={stepIndex === 3 && !creds}
          >
            {stepIndex === STEPS.length - 1 ? "Go to dashboard" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
