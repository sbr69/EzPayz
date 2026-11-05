import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { TOKEN } from "@/config/app";
import { cmpBase, fmtAmount, subBase, toBase, validateAmount } from "@/lib/money";
import { Button, Callout, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { AmountDisplay } from "@/components/ui/display";
import type { Payment } from "@/types";

/* ------------------------- Create payment intent ------------------------- */

export function CreatePaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const customers = useDemo((s) => s.data.customers);
  const pushToast = useDemo((s) => s.pushToast);
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [expires, setExpires] = useState("24");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const next: Record<string, string | null> = {
      amount: validateAmount(amount),
      description: description.trim().length < 3 ? "Describe what this payment is for" : null,
      email: email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) ? "Enter a valid email address" : null,
      expires: Number(expires) < 1 || Number(expires) > 720 ? "Expiry must be between 1 and 720 hours" : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }

  async function submit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payment = await api.createPaymentIntent({
        amount: toBase(amount),
        description: description.trim(),
        customerId: customerId || null,
        customerEmail: email.trim() || null,
        kind: "one_time",
        expiresInHours: Number(expires),
      });
      pushToast({
        title: "Payment intent created",
        body: `${payment.id} is ready to share. The customer authorises the payment on the hosted checkout page.`,
        tone: "success",
      });
      onClose();
      setAmount("");
      setDescription("");
      setEmail("");
      navigate(`/payments/${payment.id}`);
    } catch (err) {
      pushToast({ title: "Could not create payment", body: (err as Error).message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a payment"
      description="Creates a payment intent and a hosted checkout page for one-time USDT collection."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Create payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${TOKEN.symbol})`} required error={errors.amount} htmlFor="cp-amount">
            <Input
              id="cp-amount"
              inputMode="decimal"
              placeholder="129.00"
              value={amount}
              invalid={Boolean(errors.amount)}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Expires after" required error={errors.expires} htmlFor="cp-exp">
            <Select id="cp-exp" value={expires} onChange={(e) => setExpires(e.target.value)}>
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </Select>
          </Field>
        </div>
        <Field label="Description" required error={errors.description} htmlFor="cp-desc">
          <Input
            id="cp-desc"
            placeholder="Support retainer — March"
            value={description}
            invalid={Boolean(errors.description)}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer (optional)" htmlFor="cp-customer">
            <Select id="cp-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Guest checkout</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Receipt email (optional)"
            error={errors.email}
            htmlFor="cp-email"
            hint="Used to send the paid receipt after settlement."
          >
            <Input
              id="cp-email"
              placeholder="billing@company.example"
              value={email}
              invalid={Boolean(errors.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Callout tone="neutral" title="Gasless for the payer">
          The customer signs a payment authorization and the gateway relayer sponsors the network gas for
          this flow. Signature submission is simulated in demo mode.
        </Callout>
      </div>
    </Modal>
  );
}

/* -------------------------------- Refunds -------------------------------- */

export function RefundDialog({
  payment,
  open,
  onClose,
}: {
  payment: Payment;
  open: boolean;
  onClose: () => void;
}) {
  const pushToast = useDemo((s) => s.pushToast);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState(fromDisplayRemaining(payment));
  const [reason, setReason] = useState("");
  const [gas, setGas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"form" | "authorizing" | "processing">("form");

  const remaining = subBase(payment.amount, payment.refundedAmount);
  const refundable = ["succeeded", "partially_refunded", "overpaid"].includes(payment.status);

  async function submit() {
    const target = mode === "full" ? remaining : toBase(amount);
    if (cmpBase(target, "0") <= 0) {
      setError("Enter a refund amount greater than zero.");
      return;
    }
    if (cmpBase(target, remaining) > 0) {
      setError(
        `The cumulative refund cannot exceed the remaining refundable amount of ${fmtAmount(remaining)} ${TOKEN.symbol}.`,
      );
      return;
    }
    if (reason.trim().length < 5) {
      setError("Add a short reason so the refund is auditable.");
      return;
    }
    setError(null);
    try {
      setStage("authorizing");
      const refund = await api.createRefund({
        paymentId: payment.id,
        amount: target,
        reason: reason.trim(),
        gasSponsored: gas,
      });
      await api.authorizeRefund(refund.id);
      setStage("processing");
      await api.processRefund(refund.id);
      pushToast({
        title: "Refund settled (demo)",
        body: `${fmtAmount(target)} ${TOKEN.symbol} refunded to ${payment.payerWallet?.slice(0, 10)}…`,
        tone: "success",
      });
      onClose();
      setStage("form");
      setReason("");
      navigate(`/refunds/${refund.id}`);
    } catch (err) {
      setStage("form");
      setError((err as Error).message);
    }
  }

  if (!refundable) {
    return (
      <Modal open={open} onClose={onClose} title="Issue a refund" size="sm">
        <Callout tone="warn" title="This payment cannot be refunded">
          Only payments that have settled can be refunded. The current status is{" "}
          <strong>{payment.status.replace(/_/g, " ")}</strong>.
        </Callout>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Issue a refund"
      description="A refund is a new USDT transfer from your payout wallet to the customer. It does not reverse the original transaction."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={stage !== "form"}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={stage !== "form"}>
            {stage === "authorizing"
              ? "Awaiting your authorization…"
              : stage === "processing"
                ? "Processing refund…"
                : "Authorize and refund"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-canvas p-3 sm:grid-cols-4">
          <div>
            <p className="text-[16px] uppercase tracking-wide text-ink-4">Original</p>
            <AmountDisplay base={payment.amount} className="text-[18px]" />
          </div>
          <div>
            <p className="text-[16px] uppercase tracking-wide text-ink-4">Refunded</p>
            <AmountDisplay base={payment.refundedAmount} className="text-[18px]" />
          </div>
          <div>
            <p className="text-[16px] uppercase tracking-wide text-ink-4">Refundable</p>
            <AmountDisplay base={remaining} className="text-[18px] text-accent" />
          </div>
          <div>
            <p className="text-[16px] uppercase tracking-wide text-ink-4">Payer</p>
            <code className="font-mono text-[16px] text-ink-2">
              {payment.payerWallet ? `${payment.payerWallet.slice(0, 8)}…${payment.payerWallet.slice(-4)}` : "—"}
            </code>
          </div>
        </div>

        <div className="flex gap-2">
          {(["full", "partial"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setAmount(fromDisplayRemaining(payment));
                setError(null);
              }}
              className={`flex-1 rounded-md border px-3 py-2 text-left text-[18px] transition-colors ${
                mode === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface hover:bg-canvas"
              }`}
            >
              <span className="block font-semibold">{m === "full" ? "Full refund" : "Partial refund"}</span>
              <span className="block text-[16px] opacity-80">
                {m === "full" ? `Remaining ${fmtAmount(remaining)} ${TOKEN.symbol}` : "Choose the amount"}
              </span>
            </button>
          ))}
        </div>

        {mode === "partial" ? (
          <Field
            label={`Refund amount (${TOKEN.symbol})`}
            required
            error={error && mode === "partial" ? error : null}
            hint={`Maximum ${fmtAmount(remaining)} ${TOKEN.symbol}`}
          >
            <Input
              inputMode="decimal"
              value={amount}
              invalid={Boolean(error)}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Reason" required hint="Stored with the refund record and shown to the customer.">
          <Textarea
            value={reason}
            placeholder="Duplicate line item on the Q1 statement."
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <Field label="Gas for the refund transfer">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line p-3">
              <input
                type="radio"
                checked={gas}
                onChange={() => setGas(true)}
                className="mt-0.5 accent-[#0d7a6f]"
              />
              <span>
                <span className="block text-[18px] font-medium text-ink">Sponsored (gasless) refund</span>
                <span className="block text-[16px] leading-relaxed text-ink-3">
                  You sign a delegated transfer authorization and the GasGuard relayer submits the
                  transaction and pays gas. Availability depends on the token contract supporting
                  delegated transfers — unverified for this contract.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line p-3">
              <input type="radio" checked={!gas} onChange={() => setGas(false)} className="mt-0.5 accent-[#0d7a6f]" />
              <span>
                <span className="block text-[18px] font-medium text-ink">Merchant-paid gas</span>
                <span className="block text-[16px] leading-relaxed text-ink-3">
                  You submit the transfer directly from your wallet and pay network gas in WBT. Always
                  available.
                </span>
              </span>
            </label>
          </div>
        </Field>

        {error && mode === "full" ? (
          <Callout tone="danger" title="Refund not created">
            {error}
          </Callout>
        ) : null}
      </div>
    </Modal>
  );
}

function fromDisplayRemaining(payment: Payment): string {
  const remaining = subBase(payment.amount, payment.refundedAmount);
  return fmtAmount(remaining);
}
