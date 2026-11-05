import { useState } from "react";
import { AlertTriangle, Eye, RefreshCcw, ShieldCheck, ShieldX } from "lucide-react";
import { api, type PayeeShieldMutation } from "@/services";
import { PAYEESHIELD_STATUS_META } from "@/config/ui";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { fmtAmount, fmtDateTime, toBase } from "@/lib/money";
import { Button, Callout, Divider, Drawer, KeyValue, Pill } from "@/components/ui";
import { CopyButton, StatusBadge } from "@/components/ui/display";
import type { PayeeShieldRecord } from "@/types";

export function PayeeShieldPanel({
  record,
  target,
  compact,
}: {
  record: PayeeShieldRecord | null;
  target: { invoiceId?: string; paymentId?: string };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ status: string; failedField: string | null } | null>(null);
  const meta = record ? PAYEESHIELD_STATUS_META[record.status] : null;

  async function reverify() {
    setChecking(true);
    const res = await api.verifySignedRequest(target);
    setResult(res);
    setChecking(false);
  }

  const tone = record?.status ?? "verification_pending";

  return (
    <>
      <div className="rounded-md border border-line bg-canvas/60 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                record?.status === "verified" ? "bg-positive-soft text-positive" : "bg-warn-soft text-warn"
              }`}
            >
              {record?.status === "verified" ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">
                PayeeShield {record ? meta?.label.toLowerCase() : "not signed"}
              </p>
              <p className="text-[11.5px] leading-relaxed text-ink-3">
                {record
                  ? `Signed by gateway key ${record.signingKeyId} · ${record.protectedFields.invoiceId}`
                  : "This request has not been signed by the gateway."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
              View verification details
            </Button>
          </div>
        </div>

        {!compact && record ? (
          <>
            <Divider className="my-3" />
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <KeyValue label="Signing key ID">{record.signingKeyId}</KeyValue>
              <KeyValue label="Key status">
                <Pill tone={record.signingKeyStatus === "active" ? "positive" : "warn"}>
                  {record.signingKeyStatus}
                </Pill>
              </KeyValue>
              <KeyValue label="Signed recipient">
                <code className="font-mono text-[11.5px]">{`${record.protectedFields.recipient.slice(0, 10)}…${record.protectedFields.recipient.slice(-6)}`}</code>
                <CopyButton value={record.protectedFields.recipient} label="Copy" size="xs" />
              </KeyValue>
              <KeyValue label="Signed amount">
                <span className="tnum">
                  {fmtAmount(record.protectedFields.amount)} {record.protectedFields.token}
                </span>
              </KeyValue>
            </div>
          </>
        ) : null}

        {result ? (
          <div className="mt-3">
            {result.status === "verified" ? (
              <Callout tone="positive" title="Re-verification passed">
                The recomputed digest matches the gateway signature. No protected field has changed.
              </Callout>
            ) : (
              <Callout tone="danger" title={`Re-verification failed: ${result.status.replace(/_/g, " ")}`}>
                The field <strong>{result.failedField}</strong> did not match the signed value. Do not pay
                this request.
              </Callout>
            )}
          </div>
        ) : null}
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="PayeeShield verification details"
        description="Protected fields covered by the gateway signature."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="secondary" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={checking} onClick={reverify}>
              Re-run verification
            </Button>
          </>
        }
      >
        {record ? (
          <div className="space-y-4">
            <StatusBadge
              tone={tone === "verified" ? "positive" : tone === "expired" ? "warn" : "danger"}
              label={meta?.label ?? "Unknown"}
            />
            <p className="text-[12.5px] leading-relaxed text-ink-3">{meta?.description}</p>
            <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-1">
              <KeyValue label="Invoice / request ID">{record.protectedFields.invoiceId}</KeyValue>
              <KeyValue label="Signed recipient">
                <code className="break-all font-mono text-[11px]">{record.protectedFields.recipient}</code>
                <CopyButton value={record.protectedFields.recipient} label="Copy" size="xs" />
              </KeyValue>
              <KeyValue label="Exact amount">
                <span className="tnum">
                  {fmtAmount(record.protectedFields.amount)} {record.protectedFields.token}
                </span>
              </KeyValue>
              <KeyValue label="Token">{record.protectedFields.token}</KeyValue>
              <KeyValue label="Network">{record.protectedFields.network}</KeyValue>
              <KeyValue label="Token contract">
                <code className="break-all font-mono text-[11px]">{TOKEN.contract}</code>
              </KeyValue>
              <KeyValue label="Expiry">{fmtDateTime(record.protectedFields.expiry)}</KeyValue>
              <KeyValue label="Nonce / reference">
                <code className="font-mono text-[11.5px]">{record.protectedFields.nonce}</code>
              </KeyValue>
              <KeyValue label="Signature timestamp">{fmtDateTime(record.signatureTimestamp)}</KeyValue>
              <KeyValue label="Verification timestamp">{fmtDateTime(record.verifiedAt)}</KeyValue>
              <KeyValue label="Signature digest">
                <code className="font-mono text-[11.5px]">{record.digest}</code>
              </KeyValue>
              <KeyValue label="Signing key ID">
                {record.signingKeyId}
                <Pill tone={record.signingKeyStatus === "active" ? "positive" : "warn"} className="ml-1">
                  {record.signingKeyStatus}
                </Pill>
              </KeyValue>
            </div>
            <Callout tone="neutral" title="What this signature does and does not prove">
              The signature proves the payment request was produced by the delegated gateway signing key
              and has not been modified since. It does not verify the merchant's legal identity, and it
              is not a substitute for your own review of the recipient address.
            </Callout>
          </div>
        ) : (
          <EmptyShield />
        )}
      </Drawer>
    </>
  );
}

function EmptyShield() {
  return (
    <Callout tone="warn" title="No signature on this request">
      <span className="inline-flex items-start gap-2">
        <ShieldX className="mt-0.5 h-4 w-4 shrink-0" />
        The request has no gateway signature. Customers will see a verification warning and the hosted
        checkout will block payment.
      </span>
    </Callout>
  );
}

/* ------------------------------------------------------------------ */
/* Tampering lab                                                      */
/* ------------------------------------------------------------------ */

export function PayeeShieldTamperLab({ invoiceId }: { invoiceId?: string }) {
  const [mutation, setMutation] = useState<PayeeShieldMutation | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: string; failedField: string | null } | null>(null);
  const target = invoiceId ? { invoiceId } : undefined;

  async function run(m: PayeeShieldMutation | null) {
    setMutation(m);
    setRunning(true);
    setResult(null);
    const res = await api.verifySignedRequest(target ?? {}, m ?? undefined);
    setResult(res);
    setRunning(false);
  }

  const scenarios: { label: string; mutation: PayeeShieldMutation | null }[] = [
    { label: "Unmodified request", mutation: null },
    { label: "Change recipient wallet", mutation: { field: "recipient", value: "0xd3000000000000000000000000000000000000bad" } },
    { label: "Change amount", mutation: { field: "amount", value: toBase("1") } },
    { label: "Change token", mutation: { field: "token", value: "USDC" } },
    { label: "Change network", mutation: { field: "network", value: "Ethereum" } },
  ];

  return (
    <div className="space-y-4">
      <Callout tone="info" title="PayeeShield tampering simulation">
        Pick a modification to apply to the signed request, then re-run verification. The gateway
        recomputes the signature over the protected fields and rejects any request where a protected
        value no longer matches.
      </Callout>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <Button
            key={s.label}
            size="sm"
            variant={mutation === s.mutation && s.mutation !== null ? "subtle" : "secondary"}
            onClick={() => run(s.mutation)}
            disabled={running}
          >
            {s.label}
          </Button>
        ))}
      </div>
      {running ? (
        <div className="rounded-md border border-line bg-canvas px-3.5 py-6 text-center text-[12.5px] text-ink-3">
          Recomputing gateway signature…
        </div>
      ) : result ? (
        result.status === "verified" ? (
          <Callout tone="positive" title="Verified">
            All protected fields matched the gateway signature. Checkout would proceed.
          </Callout>
        ) : (
          <Callout tone="danger" title="Rejected — request blocked">
            <div className="space-y-2">
              <p>
                Verification failed with status <strong>{result.status.replace(/_/g, " ")}</strong>. The
                field <strong>{result.failedField}</strong> does not match the value covered by the
                gateway signature.
              </p>
              <p>
                A customer opening this request would see a security warning, and the hosted checkout
                would block the payment flow until a correctly signed request is issued.
              </p>
            </div>
          </Callout>
        )
      ) : null}
      <div className="rounded-md border border-line bg-canvas/60 px-3.5 py-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-4">Protected fields</p>
        <ul className="mt-2 grid gap-1 text-[12px] text-ink-2 sm:grid-cols-2">
          {[
            "invoice / request ID",
            "recipient wallet",
            "exact amount",
            `token (${TOKEN.symbol})`,
            `network (${DEFAULT_NETWORK.name})`,
            "expiry timestamp",
            "nonce / reference",
          ].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
