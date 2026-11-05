import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Check, CheckCircle2, Clock, Info, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { useWallet } from "@/contexts/WalletContext";
import { DEFAULT_NETWORK, SUBSCRIPTION_GAS_DISCLOSURE, TOKEN } from "@/config/app";
import { INTERVAL_LABEL } from "@/config/ui";
import { fmtAmount, fmtDateTime, sleep } from "@/lib/money";
import { Button, Callout, Card, Checkbox, Divider, Field, Input, KeyValue, StatusBadge } from "@/components/ui";
import { AddressDisplay, AmountDisplay, CopyButton, Timeline } from "@/components/ui/display";
import { CheckoutFrame } from "./Checkout";

const STEPS = [
  { key: "review", label: "Review plan and authorization" },
  { key: "connect", label: "Connect wallet" },
  { key: "network", label: "Confirm Whitechain network" },
  { key: "allowance", label: "Check token allowance" },
  { key: "approve", label: "Request approve() for the capped allowance" },
  { key: "signing", label: "Sign and submit the approval transaction" },
  { key: "confirming", label: "Wait for approval confirmation" },
  { key: "activate", label: "Activate subscription through the contract" },
  { key: "done", label: "Subscription active" },
];

export default function SubscriptionCheckout() {
  const { planId = "" } = useParams();
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const wallet = useWallet();
  const plan = data.plans.find((p) => p.id === planId);

  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  /** Keeps the latest wallet state available inside the async authorization flow. */
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  useEffect(() => {
    if (plan) document.title = `${plan.name} — EzPayz`;
  }, [plan]);

  if (!plan) {
    return (
      <CheckoutFrame>
        <Card>
          <div className="space-y-4 px-6 py-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="text-[17px] font-semibold text-ink">Plan not found</h1>
            <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-ink-3">
              This subscription plan is not available. Ask the merchant for a new link.
            </p>
            <a href="#/dashboard">
              <Button variant="secondary">Back to merchant</Button>
            </a>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  const subscription = data.subscriptions.find((s) => s.id === subscriptionId);
  const stepH = plan.interval === "hourly" ? 1 : plan.interval === "daily" ? 24 : 24 * 30;
  const nextRenewal = new Date(Date.now() + stepH * 3600_000).toISOString();

  async function run() {
    setError(null);
    setRunning(true);

    setStep(1);
    if (!walletRef.current.address) await wallet.connect();
    if (!walletRef.current.address) {
      setRunning(false);
      setError("The wallet request was declined. Nothing has been authorized.");
      return;
    }

    setStep(2);
    await sleep(800);
    if (walletRef.current.status === "wrong_network") {
      setRunning(false);
      setError(`Your wallet is on a different network. Switch to ${DEFAULT_NETWORK.name} to continue.`);
      return;
    }

    // create subscription record
    const sub = await api.createSubscription({ planId: plan!.id, customerId: data.customers[0].id });
    setSubscriptionId(sub.id);

    setStep(3);
    await sleep(900); // allowance check — simulated as 0

    setStep(4);
    await sleep(1000);

    setStep(5);
    await sleep(1300); // customer signs approval — simulated

    setStep(6);
    await sleep(1100);
    await api.approveAllowance(sub.id);

    setStep(7);
    await sleep(1200);
    await api.activateSubscription(sub.id);

    setStep(8);
    setRunning(false);
    pushToast({ title: "Subscription activated (demo)", body: `${plan!.name} is now active.`, tone: "success" });
  }

  if (step === 8 && subscription) {
    return (
      <CheckoutFrame>
        <Card>
          <div className="border-b border-line px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-ink">Subscription active</h1>
            <p className="mt-1 text-[15px] text-ink-3">
              {data.merchant.displayName} can now charge {fmtAmount(plan.amount)} {TOKEN.symbol} every{" "}
              {plan.interval === "monthly" ? "month" : plan.interval === "daily" ? "day" : "hour"} within your
              authorization.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Amount per cycle", `${fmtAmount(plan.amount)} ${TOKEN.symbol}`],
                ["Billing interval", INTERVAL_LABEL[plan.interval]],
                ["Next renewal", fmtDateTime(subscription.nextBillingAt)],
                ["Per-cycle cap", `${fmtAmount(plan.maxChargePerCycle)} ${TOKEN.symbol}`],
                ["Cumulative limit", `${fmtAmount(plan.cumulativeLimit)} ${TOKEN.symbol}`],
                ["Authorization expiry", fmtDateTime(subscription.expiresAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-line bg-canvas/60 px-3.5 py-2.5">
                  <p className="text-[13px] uppercase tracking-wide text-ink-4">{label}</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-ink tnum">{value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <KeyValue label="Subscription ID">
                <code className="font-mono text-[13px]">{subscription.id}</code>
                <CopyButton value={subscription.id} label="Copy" size="xs" />
              </KeyValue>
              <KeyValue label="Approval transaction">
                <code className="font-mono text-[13px]">{subscription.approvalTxRef}</code>
              </KeyValue>
              <KeyValue label="Activation transaction">
                <code className="font-mono text-[13px]">{subscription.activationTxRef}</code>
              </KeyValue>
              <KeyValue label="Your wallet">
                <code className="break-all font-mono text-[13px]">{wallet.address}</code>
              </KeyValue>
            </div>
            <Callout tone="warn" title="Demo transactions">
              The approval and activation references were generated by the mock service layer. No approval was
              submitted on-chain and no allowance was granted.
            </Callout>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => navigate(`/customer/subscriptions/${subscription.id}`)}
              >
                Manage subscription
              </Button>
              <a href="#/dashboard">
                <Button variant="secondary">Back to merchant</Button>
              </a>
            </div>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  return (
    <CheckoutFrame>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-[15px] font-bold text-white">
                {data.merchant.logoText}
              </span>
              <div>
                <p className="text-[16px] font-semibold leading-tight text-ink">{data.merchant.displayName}</p>
                <p className="text-[13px] text-ink-4">Subscription checkout</p>
              </div>
            </div>
            <StatusBadge label={DEFAULT_NETWORK.name} tone="warn" dot={false} />
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-wide text-ink-4">Plan</p>
              <h1 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-ink">{plan.name}</h1>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-3">{plan.description}</p>
            </div>

            <div className="rounded-md border border-line bg-canvas/70 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink tnum">
                  {plan.billingMode === "usage" ? fmtAmount(plan.unitPrice ?? "0") : fmtAmount(plan.amount)}
                </span>
                <span className="text-[16px] font-medium text-ink-3">{TOKEN.symbol}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-4">
                {plan.billingMode === "usage"
                  ? `per ${plan.unitLabel} · billed ${plan.interval}`
                  : `billed ${plan.interval}`}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-4">Progress</p>
              <ol className="space-y-2">
                {STEPS.map((s, i) => (
                  <li key={s.key} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-bold ${
                        i < step
                          ? "border-accent bg-accent text-white"
                          : i === step
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line-strong bg-surface text-transparent"
                      }`}
                    >
                      {i < step ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </span>
                    <span
                      className={`text-[14px] leading-5 ${
                        i === step ? "font-semibold text-ink" : i < step ? "text-ink-2" : "text-ink-4"
                      }`}
                    >
                      {s.label}
                      {i === step && running ? <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-accent" /> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {error ? (
              <Callout tone="danger" title="Could not continue" icon={<AlertTriangle className="h-4 w-4" />}>
                <div className="space-y-2">
                  <p>{error}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setError(null);
                      setStep(0);
                      if (wallet.status === "wrong_network") void wallet.switchNetwork();
                    }}
                  >
                    Try again
                  </Button>
                </div>
              </Callout>
            ) : null}

            <Divider />

            <div className="space-y-3">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-4">Your wallet</p>
              <div className="rounded-md border border-line p-3.5">
                {wallet.address ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">{wallet.providerName}</p>
                      <code className="font-mono text-[13px] text-ink-3">{wallet.address}</code>
                      {wallet.simulated ? (
                        <p className="mt-0.5 text-[13px] text-warn">Simulated wallet — no browser wallet detected.</p>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="sm" onClick={wallet.disconnect}>
                      Disconnect
                    </Button>
                  </div>
                ) : wallet.status === "wrong_network" ? (
                  <div className="space-y-2">
                    <p className="text-[15px] font-medium text-warn">Wrong network</p>
                    <Button variant="secondary" size="sm" onClick={wallet.switchNetwork} loading={wallet.busy}>
                      Switch network
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                      <div>
                        <p className="text-[15px] font-medium text-ink">Connect your wallet</p>
                        <p className="text-[13px] leading-relaxed text-ink-3">
                          {wallet.hasProvider
                            ? "MetaMask or another compatible EVM wallet."
                            : "No browser wallet detected — a simulated demo wallet will be used."}
                        </p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={wallet.connect} loading={wallet.busy}>
                      Connect wallet
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Field label="Email for renewal notifications (optional)" error={emailError}>
              <Input
                type="email"
                value={email}
                invalid={Boolean(emailError)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.example"
              />
            </Field>

            <Checkbox
              checked={accepted}
              onChange={setAccepted}
              label="I authorize recurring payments from my wallet"
              description={`I allow ${data.merchant.displayName} to charge up to ${fmtAmount(plan.maxChargePerCycle)} ${TOKEN.symbol} per ${plan.interval === "monthly" ? "month" : plan.interval === "daily" ? "day" : "hour"}, up to a total of ${fmtAmount(plan.cumulativeLimit)} ${TOKEN.symbol}, until ${plan.planExpiryMonths ? `${plan.planExpiryMonths} months from now` : "the plan expiry"} or until I cancel or revoke my allowance.`}
            />

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={running}
              disabled={!accepted || wallet.status === "wrong_network"}
              onClick={() => {
                if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
                  setEmailError("Enter a valid email address");
                  return;
                }
                setEmailError(null);
                void run();
              }}
            >
              {running ? "Authorizing subscription…" : `Approve ${fmtAmount(plan.cumulativeLimit)} ${TOKEN.symbol} allowance`}
            </Button>

            <Callout tone="warn" title="You pay gas for this step">
              {SUBSCRIPTION_GAS_DISCLOSURE}
            </Callout>
            <p className="text-center text-[13px] text-ink-4">
              Simulated demo checkout — no approval transaction is submitted and no allowance is granted.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-4">What you are authorizing</p>
              <div className="mt-2 space-y-1">
                <KeyValue label="Merchant">{data.merchant.displayName}</KeyValue>
                <KeyValue label="Plan">{plan.name}</KeyValue>
                <KeyValue label="Amount per cycle">
                  <AmountDisplay base={plan.amount} />
                </KeyValue>
                <KeyValue label="Billing interval">{INTERVAL_LABEL[plan.interval]}</KeyValue>
                <KeyValue label="Maximum per cycle">
                  <AmountDisplay base={plan.maxChargePerCycle} />
                </KeyValue>
                <KeyValue label="Total spending authorization">
                  <AmountDisplay base={plan.cumulativeLimit} />
                </KeyValue>
                <KeyValue label="Subscription expiry">
                  {plan.planExpiryMonths ? `${plan.planExpiryMonths} months` : "No expiry"}
                </KeyValue>
                <KeyValue label="Next renewal date">{fmtDateTime(nextRenewal)}</KeyValue>
                <KeyValue label="Retry policy">
                  {plan.retryPolicy.maxAttempts} attempts · {plan.retryPolicy.backoff} every{" "}
                  {plan.retryPolicy.intervalMinutes}m
                </KeyValue>
                <KeyValue label="Grace period">{plan.retryPolicy.gracePeriodMinutes} minutes</KeyValue>
                <KeyValue label="Customer notifications">{plan.notifyCustomer ? "Enabled" : "Disabled"}</KeyValue>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-3 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Cancelling and revoking
              </p>
              <div className="space-y-2 text-[13px] leading-relaxed text-ink-3">
                <p>
                  <strong className="text-ink-2">Cancel</strong> stops future charges. Cancellation is a
                  transaction you submit to the subscription contract, and you normally pay WBT gas for it.
                </p>
                <p>
                  <strong className="text-ink-2">Revoke allowance</strong> is separate. Cancelling does not
                  reduce your remaining ERC-20 allowance. To remove it you submit{" "}
                  <code className="font-mono">approve(subscriptionContract, 0)</code> yourself, also paying gas.
                </p>
                <p>You can do either action at any time from your subscription management page.</p>
              </div>
            </div>
          </Card>

          <Card className="bg-canvas/60">
            <div className="space-y-2 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                <Info className="h-3.5 w-3.5 text-accent" />
                How renewals work
              </p>
              <ol className="space-y-1.5 text-[13px] leading-relaxed text-ink-3">
                <li>1. The gateway scheduler triggers on your next renewal date.</li>
                <li>2. GasGuard validates the submission against the merchant policy.</li>
                <li>3. The relayer submits the renewal call — gas is sponsored, not paid by you.</li>
                <li>4. The subscription contract checks the per-cycle cap and your cumulative limit.</li>
                <li>5. <code className="font-mono">transferFrom()</code> moves the tokens.</li>
                <li>6. The gateway verifies settlement and advances the billing period.</li>
              </ol>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-4">Merchant payout wallet</p>
              <AddressDisplay address={data.merchant.payoutWallet} full className="mt-1" />
              <p className="mt-2 flex items-center gap-1 text-[13px] text-ink-4">
                <Clock className="h-3 w-3" />
                Charges are executed by the subscription contract, not by this address directly.
              </p>
            </div>
          </Card>

          {subscription ? (
            <Card>
              <div className="px-5 py-4">
                <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-4">Setup progress</p>
                <Timeline
                  entries={[
                    { label: "Subscription created", at: subscription.createdAt, state: "done", simulated: true },
                    {
                      label: "Allowance approval submitted",
                      detail: subscription.approvalTxRef ?? undefined,
                      at: subscription.createdAt,
                      state: subscription.approvalTxRef ? "done" : "current",
                      simulated: true,
                    },
                    {
                      label: "Subscription activated",
                      detail: subscription.activationTxRef ?? undefined,
                      at: subscription.createdAt,
                      state: subscription.activationTxRef ? "done" : "todo",
                      simulated: true,
                    },
                  ]}
                />
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => navigate(`/subscriptions/${subscription.id}`)}>
                  Open merchant view
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </CheckoutFrame>
  );
}
