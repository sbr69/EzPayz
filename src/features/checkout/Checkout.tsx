import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { useWallet } from "@/contexts/WalletContext";
import { DEFAULT_NETWORK, GASLESS_DISCLOSURE, TOKEN } from "@/config/app";
import { PAYMENT_STATUS_META } from "@/config/ui";
import { fmtAmount, fmtDateTime, isEmail, sleep, toBase, untilFuture, validateAmount } from "@/lib/money";
import { Button, Callout, Card, Divider, Field, Input, KeyValue, StatusBadge } from "@/components/ui";
import { AddressDisplay, AmountDisplay, CopyButton, Timeline, TxRefDisplay } from "@/components/ui/display";
import { PayeeShieldPanel } from "@/features/payeesield/PayeeShield";
import type { Payment } from "@/types";

const STEPS = [
  { key: "review", label: "Review payment details" },
  { key: "connect", label: "Connect wallet" },
  { key: "network", label: "Confirm Whitechain network" },
  { key: "confirm", label: "Review amount and recipient" },
  { key: "sign", label: "Sign payment authorization" },
  { key: "authorized", label: "Authorization received" },
  { key: "gasguard", label: "GasGuard validation" },
  { key: "relayer", label: "Relayer submitting transaction" },
  { key: "verify", label: "Payment being verified" },
  { key: "success", label: "Payment successful" },
];

type ErrorState =
  | "signature_rejected"
  | "insufficient_usdt"
  | "wrong_network"
  | "relayer_failed"
  | "failed"
  | "underpaid"
  | "overpaid"
  | "expired"
  | "invalid_request"
  | "payeesield_failed";

const ERROR_CONTENT: Record<ErrorState, { title: string; tone: "danger" | "warn"; body: string; retry?: boolean }> = {
  signature_rejected: {
    title: "Authorization rejected",
    tone: "danger",
    body: "The payment was not authorized. Nothing has been charged. You can try again — a rejected signature never completes a payment.",
    retry: true,
  },
  insufficient_usdt: {
    title: "Not enough USDT",
    tone: "warn",
    body: `The connected wallet does not hold enough ${TOKEN.symbol} for this payment. Top up the wallet and try again.`,
    retry: true,
  },
  wrong_network: {
    title: "Wrong network",
    tone: "warn",
    body: `Your wallet is connected to a different network. Switch to ${DEFAULT_NETWORK.name} (chain ${DEFAULT_NETWORK.chainId}) to continue.`,
    retry: true,
  },
  relayer_failed: {
    title: "Relayer could not submit",
    tone: "danger",
    body: "GasGuard rejected or failed the submission. Your authorization was not spent. The merchant has been notified.",
    retry: true,
  },
  failed: {
    title: "Payment failed",
    tone: "danger",
    body: "The transaction did not confirm. No funds moved from your wallet.",
    retry: true,
  },
  underpaid: {
    title: "Payment underpaid",
    tone: "warn",
    body: "The amount received was less than the amount requested. The merchant has been notified and will contact you about the balance or a refund.",
  },
  overpaid: {
    title: "Payment overpaid",
    tone: "warn",
    body: "The amount received was more than the amount requested. The merchant can refund the difference.",
  },
  expired: {
    title: "Payment request expired",
    tone: "warn",
    body: "This request is no longer valid. Ask the merchant for a new payment link.",
  },
  invalid_request: {
    title: "Invalid payment request",
    tone: "danger",
    body: "This checkout session could not be found or is no longer usable.",
  },
  payeesield_failed: {
    title: "Verification failed",
    tone: "danger",
    body: "This payment request failed PayeeShield verification. Do not send funds. Contact the merchant and ask for a newly signed request.",
  },
};

export default function Checkout() {
  const { sessionId = "", slug = "" } = useParams<{ sessionId?: string; slug?: string }>();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const wallet = useWallet();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState<"normal" | "underpaid" | "overpaid" | "rejected" | "insufficient" | "relayer">("normal");
  /** Keeps the latest wallet state available inside the async payment flow. */
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const link = useMemo(() => data.paymentLinks.find((l) => l.slug === slug), [data.paymentLinks, slug]);

  useEffect(() => {
    let active = true;
    (async () => {
      await sleep(450);
      if (!active) return;
      if (sessionId) {
        const found = data.payments.find((p) => p.checkoutUrl.endsWith(`/checkout/${sessionId}`) || p.id === sessionId.replace("ses_", "pay_"));
        setPayment(found ?? null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, slug]);

  const amountToPay = useMemo(() => {
    if (!payment) return "0";
    if (customAmount) return toBase(customAmount);
    return payment.amount;
  }, [payment, customAmount]);

  /* ---------------------------------------------------------------- */
  /* Link checkout (no session yet)                                    */
  /* ---------------------------------------------------------------- */

  if (!loading && slug && link && !payment) {
    return (
      <CheckoutFrame>
        <Card>
          <div className="border-b border-line px-6 py-5 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-ink text-[15px] font-bold text-white">
              {data.merchant.logoText}
            </span>
            <p className="mt-3 text-[15px] font-semibold text-ink">{data.merchant.displayName}</p>
            <p className="text-[11.5px] text-ink-4">{DEFAULT_NETWORK.name}</p>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div>
              <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">{link.title}</h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{link.description}</p>
            </div>
            {link.linkType === "customer_amount" ? (
              <Field
                label={`Amount (${TOKEN.symbol})`}
                required
                error={amountError}
                hint={`Between ${fmtAmount(link.minAmount!)} and ${fmtAmount(link.maxAmount!)} ${TOKEN.symbol}`}
              >
                <Input
                  inputMode="decimal"
                  value={customAmount}
                  invalid={Boolean(amountError)}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={fmtAmount(link.minAmount!)}
                />
              </Field>
            ) : (
              <div className="rounded-md border border-line bg-canvas p-4">
                <p className="text-[11px] uppercase tracking-wide text-ink-4">Amount due</p>
                <AmountDisplay base={link.amount!} className="text-[24px]" />
              </div>
            )}
            {link.linkType === "reusable" ? (
              <Callout tone="info" title="Reusable link">
                Each payment from this link is processed independently with its own payment record.
              </Callout>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={async () => {
                if (link.linkType === "customer_amount") {
                  const err = validateAmount(customAmount, { min: link.minAmount ?? undefined, max: link.maxAmount ?? undefined });
                  if (err) {
                    setAmountError(err);
                    return;
                  }
                  setAmountError(null);
                }
                const created = await api.createPaymentIntent({
                  amount: link.linkType === "customer_amount" ? toBase(customAmount) : link.amount!,
                  description: link.title,
                  customerId: null,
                  customerEmail: email.trim() || null,
                  kind: "payment_link",
                  paymentLinkId: link.id,
                });
                setPayment(created);
                pushToast({ title: "Payment request created", body: "Continue to authorize the payment.", tone: "info" });
              }}
            >
              Continue to payment
            </Button>
            <p className="text-center text-[11.5px] text-ink-4">
              Powered by EzPayz · simulated demo checkout
            </p>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Loading / not found                                               */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <CheckoutFrame>
        <Card>
          <div className="flex flex-col items-center gap-3 px-6 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <p className="text-[13px] text-ink-3">Loading payment request…</p>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  if (!payment) {
    return (
      <CheckoutFrame>
        <Card>
          <div className="space-y-4 px-6 py-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
              <XCircle className="h-5 w-5" />
            </div>
            <h1 className="text-[17px] font-semibold text-ink">Payment request not found</h1>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-ink-3">
              {ERROR_CONTENT.invalid_request.body}
            </p>
            <a href="#/dashboard">
              <Button variant="secondary">Back to merchant</Button>
            </a>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Deterministic blocked states                                      */
  /* ---------------------------------------------------------------- */

  const expired = payment.expiresAt ? new Date(payment.expiresAt).getTime() < Date.now() : false;
  const shieldFailed = payment.payeeShield && payment.payeeShield.status !== "verified";

  if (expired || shieldFailed || ["expired", "cancelled"].includes(payment.status)) {
    const state: ErrorState = shieldFailed ? "payeesield_failed" : "expired";
    return (
      <CheckoutFrame>
        <Card>
          <div className="space-y-4 px-6 py-10 text-center">
            <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${shieldFailed ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
              {shieldFailed ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
            </div>
            <h1 className="text-[17px] font-semibold text-ink">{ERROR_CONTENT[state].title}</h1>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-ink-3">{ERROR_CONTENT[state].body}</p>
            {shieldFailed && payment.payeeShield ? (
              <div className="mx-auto max-w-sm rounded-md border border-danger-line bg-danger-soft px-3.5 py-3 text-left">
                <p className="text-[12px] font-semibold text-danger">
                  Failing field: {payment.payeeShield.failedField ?? "signature"}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-danger/90">
                  Gateway signing key {payment.payeeShield.signingKeyId} · status{" "}
                  {payment.payeeShield.signingKeyStatus}
                </p>
              </div>
            ) : null}
            <a href="#/dashboard">
              <Button variant="secondary">Contact merchant</Button>
            </a>
          </div>
        </Card>
      </CheckoutFrame>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Success                                                           */
  /* ---------------------------------------------------------------- */

  if (payment.status === "succeeded" || payment.status === "partially_refunded") {
    return <CheckoutSuccess payment={payment} merchantName={data.merchant.displayName} />;
  }

  /* ---------------------------------------------------------------- */
  /* Active checkout                                                   */
  /* ---------------------------------------------------------------- */

  async function run() {
    setError(null);
    setRunning(true);

    // 2 — connect wallet
    setStep(1);
    if (!walletRef.current.address) {
      await wallet.connect();
      if (!walletRef.current.address) {
        setRunning(false);
        setError("signature_rejected");
        return;
      }
    }

    // 3 — network
    setStep(2);
    await sleep(900);
    if (walletRef.current.status === "wrong_network") {
      setRunning(false);
      setError("wrong_network");
      return;
    }

    // 4 — review
    setStep(3);
    await sleep(700);

    if (demoMode === "insufficient") {
      setRunning(false);
      setError("insufficient_usdt");
      return;
    }

    // 5 — sign authorization (simulated, no wallet signature requested)
    setStep(4);
    await sleep(1200);
    if (demoMode === "rejected") {
      setRunning(false);
      setError("signature_rejected");
      return;
    }
    const authorized = await api.authorizePayment(
      payment!.id,
      walletRef.current.address ?? "0xd3000000000000000000000000000000000000c1a",
    );

    // 6 — authorization received
    setStep(5);
    await sleep(700);

    // 7 — GasGuard validation
    setStep(6);
    await sleep(900);
    if (demoMode === "relayer") {
      setRunning(false);
      setError("relayer_failed");
      return;
    }

    // 8 — relayer submission
    setStep(7);
    await sleep(1200);
    await api.relayPayment(authorized.id);

    // 9 — verification
    setStep(8);
    await sleep(1100);
    const outcome =
      demoMode === "underpaid" ? "underpaid" : demoMode === "overpaid" ? "overpaid" : demoMode === "normal" ? "succeeded" : "failed";
    const updated = await api.verifyPayment(authorized.id, {
      outcome,
      receivedDelta: "100000",
    });

    setRunning(false);
    if (updated.status === "succeeded") {
      setStep(9);
      setPayment(updated);
      pushToast({ title: "Payment successful", body: "A simulated settlement was recorded.", tone: "success" });
      return;
    }
    if (updated.status === "underpaid") {
      setError("underpaid");
      setPayment(updated);
      return;
    }
    if (updated.status === "overpaid") {
      setError("overpaid");
      setPayment(updated);
      return;
    }
    setError("failed");
    setPayment(updated);
  }

  const errorContent = error ? ERROR_CONTENT[error] : null;

  return (
    <CheckoutFrame>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-[13px] font-bold text-white">
                {data.merchant.logoText}
              </span>
              <div>
                <p className="text-[14px] font-semibold leading-tight text-ink">{data.merchant.displayName}</p>
                <p className="text-[11.5px] text-ink-4">{data.merchant.website.replace("https://", "")}</p>
              </div>
            </div>
            <StatusBadge label={`${DEFAULT_NETWORK.name}`} tone="warn" dot={false} />
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-4">Amount due</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink tnum">
                  {fmtAmount(amountToPay)}
                </span>
                <span className="text-[15px] font-medium text-ink-3">{TOKEN.symbol}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-4">
                {TOKEN.name} · <code className="font-mono">{TOKEN.contract.slice(0, 12)}…</code>
              </p>
            </div>

            <div className="rounded-md border border-line bg-canvas/70 p-4">
              <p className="text-[13px] font-semibold text-ink">{payment.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {payment.expiresAt ? `Expires ${untilFuture(payment.expiresAt)}` : "No expiry"}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-positive" />
                  PayeeShield {payment.payeeShield?.status === "verified" ? "verified" : "unverified"}
                </span>
                <span className="font-mono">{payment.id}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Progress</p>
              <ol className="space-y-2">
                {STEPS.map((s, i) => {
                  const done = i < step;
                  const current = i === step;
                  const failed =
                    error &&
                    ((error === "signature_rejected" && i === 4) ||
                      (error === "wrong_network" && i === 2) ||
                      (error === "insufficient_usdt" && i === 3) ||
                      (error === "relayer_failed" && i >= 6) ||
                      ((error === "failed" || error === "underpaid" || error === "overpaid") && i >= 8));
                  return (
                    <li key={s.key} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[9.5px] font-bold ${
                          failed
                            ? "border-danger bg-danger-soft text-danger"
                            : done
                              ? "border-accent bg-accent text-white"
                              : current
                                ? "border-accent bg-accent-soft text-accent"
                                : "border-line-strong bg-surface text-transparent"
                        }`}
                      >
                        {failed ? <XCircle className="h-2.5 w-2.5" /> : done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                      </span>
                      <span
                        className={`text-[12.5px] leading-5 ${
                          current ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-4"
                        }`}
                      >
                        {s.label}
                        {current && running ? <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin text-accent" /> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {errorContent ? (
              <Callout tone={errorContent.tone} title={errorContent.title} icon={<AlertTriangle className="h-4 w-4" />}>
                <div className="space-y-2">
                  <p>{errorContent.body}</p>
                  {error === "underpaid" && payment.receivedAmount ? (
                    <p className="tnum">
                      Requested {fmtAmount(payment.amount)} {TOKEN.symbol} · received{" "}
                      {fmtAmount(payment.receivedAmount)} {TOKEN.symbol}
                    </p>
                  ) : null}
                  {error === "overpaid" && payment.receivedAmount ? (
                    <p className="tnum">
                      Requested {fmtAmount(payment.amount)} {TOKEN.symbol} · received{" "}
                      {fmtAmount(payment.receivedAmount)} {TOKEN.symbol}
                    </p>
                  ) : null}
                  {errorContent.retry ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setError(null);
                        setStep(0);
                        if (error === "wrong_network") void wallet.switchNetwork();
                      }}
                    >
                      Try again
                    </Button>
                  ) : null}
                </div>
              </Callout>
            ) : null}

            <Divider />

            {/* Wallet panel */}
            <div className="space-y-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Your wallet</p>
              <div className="rounded-md border border-line p-3.5">
                {wallet.status === "disconnected" || wallet.status === "rejected" || wallet.status === "disconnected_unexpectedly" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                      <div>
                        <p className="text-[13px] font-medium text-ink">
                          {wallet.status === "rejected" ? "Connection rejected" : "Connect your wallet"}
                        </p>
                        <p className="text-[11.5px] leading-relaxed text-ink-3">
                          {wallet.status === "rejected"
                            ? "The wallet request was declined. You can try again."
                            : wallet.hasProvider
                              ? "MetaMask or another compatible EVM wallet."
                              : "No browser wallet detected — a simulated demo wallet will be used."}
                        </p>
                        {wallet.status === "disconnected_unexpectedly" ? (
                          <p className="mt-1 text-[11.5px] text-warn">{wallet.error}</p>
                        ) : null}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={wallet.connect} loading={wallet.busy}>
                      {wallet.status === "rejected" ? "Try connecting again" : "Connect wallet"}
                    </Button>
                  </div>
                ) : wallet.status === "wrong_network" ? (
                  <div className="space-y-2.5">
                    <p className="text-[13px] font-medium text-warn">Connected to the wrong network</p>
                    <p className="text-[11.5px] leading-relaxed text-ink-3">
                      {wallet.error ?? `Switch to ${DEFAULT_NETWORK.name} (chain ${DEFAULT_NETWORK.chainId}) to continue.`}
                    </p>
                    <Button variant="secondary" size="sm" onClick={wallet.switchNetwork} loading={wallet.busy}>
                      Switch network
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{wallet.providerName}</p>
                      <code className="font-mono text-[11.5px] text-ink-3">{wallet.address}</code>
                      {wallet.simulated ? (
                        <p className="mt-0.5 text-[11px] text-warn">Simulated wallet — no browser wallet detected.</p>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="sm" onClick={wallet.disconnect}>
                      Disconnect
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Field label="Email for your receipt (optional)" error={emailError}>
              <Input
                type="email"
                value={email}
                invalid={Boolean(emailError)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.example"
              />
            </Field>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={running}
              disabled={wallet.status === "wrong_network"}
              onClick={() => {
                if (email.trim() && !isEmail(email.trim())) {
                  setEmailError("Enter a valid email address");
                  return;
                }
                setEmailError(null);
                void run();
              }}
            >
              {running ? "Processing payment…" : `Authorize payment of ${fmtAmount(amountToPay)} ${TOKEN.symbol}`}
            </Button>

            <p className="text-center text-[11.5px] leading-relaxed text-ink-4">
              {GASLESS_DISCLOSURE}
            </p>
            <p className="text-center text-[11px] text-ink-4">
              Simulated demo checkout — no signature is requested from your wallet and nothing is broadcast
              to Whitechain.
            </p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="px-5 py-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Order summary</p>
              <div className="mt-2 space-y-1">
                <KeyValue label="Merchant">{data.merchant.displayName}</KeyValue>
                <KeyValue label="Description">{payment.description}</KeyValue>
                <KeyValue label="Amount">
                  <AmountDisplay base={amountToPay} />
                </KeyValue>
                <KeyValue label="Token">
                  {TOKEN.symbol} · {TOKEN.name}
                </KeyValue>
                <KeyValue label="Network">
                  {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId}
                </KeyValue>
                <KeyValue label="Payment reference">
                  <code className="font-mono text-[11.5px]">{payment.id}</code>
                  <CopyButton value={payment.id} label="Copy" size="xs" />
                </KeyValue>
                {payment.invoiceId ? (
                  <KeyValue label="Invoice">
                    <code className="font-mono text-[11.5px]">{payment.invoiceId}</code>
                  </KeyValue>
                ) : null}
                <KeyValue label="Expires">{fmtDateTime(payment.expiresAt)}</KeyValue>
              </div>
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="mt-3 flex w-full items-center justify-between rounded-md border border-line bg-canvas px-3 py-2 text-[12.5px] font-medium text-ink-2 hover:bg-canvas-alt"
              >
                Recipient and verification details
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
              </button>
              {showDetails ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-ink-4">Merchant payout wallet</p>
                    <AddressDisplay address={payment.payoutWallet} full className="mt-1" />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-4">
                      Check this address before authorising. The gateway signature covers it, but only you can
                      confirm it is the merchant you expect.
                    </p>
                  </div>
                  <PayeeShieldPanel record={payment.payeeShield} target={{ paymentId: payment.id }} compact />
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="bg-canvas/60">
            <div className="space-y-2 px-5 py-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <Info className="h-3.5 w-3.5 text-accent" />
                What happens when you pay
              </p>
              <ol className="space-y-1.5 text-[11.5px] leading-relaxed text-ink-3">
                <li>1. You connect your wallet and confirm the network.</li>
                <li>2. You sign a payment authorization for this exact amount and recipient.</li>
                <li>3. The gateway relayer submits the transaction and sponsors the network gas.</li>
                <li>4. The gateway waits for the settlement record before marking the payment successful.</li>
                <li>5. Your receipt is emailed if you provided an address.</li>
              </ol>
            </div>
          </Card>

          <Card>
            <div className="space-y-2.5 px-5 py-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Demo outcome controls</p>
              <p className="text-[11.5px] leading-relaxed text-ink-4">
                Frontend demo only. Choose how the simulated settlement completes.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["normal", "Successful"],
                    ["underpaid", "Underpaid"],
                    ["overpaid", "Overpaid"],
                    ["rejected", "Signature rejected"],
                    ["insufficient", "Insufficient USDT"],
                    ["relayer", "Relayer failure"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setDemoMode(value)}
                    className={`rounded-md border px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors ${
                      demoMode === value ? "border-accent bg-accent-soft text-accent" : "border-line-strong text-ink-2 hover:bg-canvas"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </CheckoutFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Success                                                            */
/* ------------------------------------------------------------------ */

export function CheckoutSuccess({ payment, merchantName }: { payment: Payment; merchantName: string }) {
  const navigate = useNavigate();
  const data = useDemo((s) => s.data);
  const invoice = data.invoices.find((i) => i.id === payment.invoiceId);

  return (
    <CheckoutFrame>
      <Card>
        <div className="border-b border-line px-6 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft text-positive">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-ink">Payment successful</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {merchantName} received your payment. A simulated settlement was recorded.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-md border border-line bg-canvas p-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-ink-4">Amount paid</p>
            <AmountDisplay base={payment.receivedAmount ?? payment.amount} className="text-[26px]" />
          </div>
          <div className="space-y-1">
            <KeyValue label="Merchant">{merchantName}</KeyValue>
            <KeyValue label="Your wallet">
              <code className="break-all font-mono text-[11.5px]">{payment.payerWallet}</code>
            </KeyValue>
            <KeyValue label="Payment ID">
              <code className="font-mono text-[11.5px]">{payment.id}</code>
              <CopyButton value={payment.id} label="Copy" size="xs" />
            </KeyValue>
            <KeyValue label="Transaction reference">
              <TxRefDisplay value={payment.txRef} />
            </KeyValue>
            <KeyValue label="Network">{DEFAULT_NETWORK.name}</KeyValue>
            <KeyValue label="Paid at">{fmtDateTime(payment.settledAt)}</KeyValue>
            <KeyValue label="Receipt email">
              <StatusBadge
                tone={payment.receiptEmail === "delivered" ? "positive" : "warn"}
                label={payment.receiptEmail.replace(/_/g, " ")}
              />
            </KeyValue>
            {payment.customerEmail ? <KeyValue label="Sent to">{payment.customerEmail}</KeyValue> : null}
          </div>

          <div className="rounded-md border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-warn">
            Demo transaction — the reference above was generated by the mock service layer. Nothing was
            broadcast to Whitechain and there is no on-chain record.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => navigate(`/receipt/${payment.id}`)}>
              View receipt
            </Button>
            {invoice?.id ? (
              <a href={`#/receipt/${payment.id}`} className="flex-1">
                <Button variant="secondary" className="w-full">
                  Invoice {invoice.id}
                </Button>
              </a>
            ) : null}
            {payment.source?.kind === "payment_link" ? (
              <a href="#/dashboard">
                <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Return to merchant
                </Button>
              </a>
            ) : (
              <a href="#/dashboard">
                <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Continue
                </Button>
              </a>
            )}
          </div>

          <div className="pt-2">
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Payment timeline</p>
            <Timeline
              entries={payment.timeline.map((t, i) => ({
                label: t.label,
                detail: t.detail,
                at: t.at,
                state: i === payment.timeline.length - 1 ? "current" : "done",
                simulated: t.simulated,
              }))}
            />
          </div>

          <p className="text-center text-[11.5px] text-ink-4">
            Status: {PAYMENT_STATUS_META[payment.status].label} · settlement recorded by the gateway, not by
            this page
          </p>
          <p className="text-center text-[11px] text-ink-4">
            <ExternalLink className="mr-1 inline h-3 w-3" />
            Explorer links are placeholders in demo mode
          </p>
        </div>
      </Card>
    </CheckoutFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Frame                                                              */
/* ------------------------------------------------------------------ */

export function CheckoutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-white">
              W
            </span>
            <span className="text-[13px] font-semibold text-ink">EzPayz</span>
          </div>
          <span className="flex items-center gap-1.5 rounded border border-warn-line bg-warn-soft px-2 py-1 text-[11px] font-semibold text-warn">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
            Demo checkout · simulated
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid-lines pointer-events-none fixed inset-0 -z-10 opacity-40" />
        {children}
      </main>
      <footer className="border-t border-line bg-surface px-5 py-4">
        <p className="mx-auto max-w-5xl text-[11.5px] text-ink-4">
          Payments are settled in {TOKEN.symbol} on {DEFAULT_NETWORK.name}. This is a frontend demo: wallets,
          signatures and settlements are simulated.{" "}
          <Link to="/roadmap" className="hover:text-ink">
            Roadmap
          </Link>
        </p>
      </footer>
    </div>
  );
}
