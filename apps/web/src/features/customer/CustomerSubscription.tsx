import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Clock, ShieldOff, Wallet } from "lucide-react";
import { api } from "@/services";
import { useDemo } from "@/store/demoStore";
import { INTERVAL_LABEL, SUBSCRIPTION_STATUS_META } from "@/config/ui";
import { DEFAULT_NETWORK, SUBSCRIPTION_GAS_DISCLOSURE, TOKEN } from "@/config/app";
import { fmtAmount, fmtDateTime } from "@/lib/money";
import { Button, Callout, Card, CardHeader, EmptyState, KeyValue, PageHeader, StatusBadge } from "@/components/ui";
import { AddressDisplay, AmountDisplay, Timeline } from "@/components/ui/display";
import { SUBSCRIPTION_TONES } from "@/components/ui/statusTones";
import { ConfirmDialog } from "@/components/ui/Dialog";

export function CustomerSubscriptionPage() {
  const { id = "" } = useParams();
  const data = useDemo((s) => s.data);
  const pushToast = useDemo((s) => s.pushToast);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const subscription = data.subscriptions.find((s) => s.id === id);
  const plan = data.plans.find((p) => p.id === subscription?.planId);
  const customer = data.customers.find((c) => c.id === subscription?.customerId);

  if (!subscription || !plan) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Card>
          <EmptyState title="Subscription not found" description={`No subscription with ID ${id}.`} />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-[12px] font-bold text-white">
            {data.merchant.logoText}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight text-ink">{data.merchant.displayName}</p>
            <p className="text-[11.5px] text-ink-4">Your subscription</p>
          </div>
          <span className="ml-auto rounded border border-warn-line bg-warn-soft px-2 py-1 text-[11px] font-semibold text-warn">
            Demo · simulated
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-5 py-8">
        <PageHeader
          title={plan.name}
          description={plan.description}
          meta={
            <>
              <StatusBadge label={SUBSCRIPTION_STATUS_META[subscription.status].label} tone={SUBSCRIPTION_TONES[subscription.status]} />
              <StatusBadge label={`Billed ${plan.interval}`} tone="neutral" dot={false} />
              <span className="font-mono text-[11.5px] text-ink-4">{subscription.id}</span>
            </>
          }
          actions={
            <>
              <Button
                variant="danger"
                icon={<Ban className="h-4 w-4" />}
                disabled={subscription.status === "cancelled" || subscription.status === "expired"}
                onClick={() => setCancelOpen(true)}
              >
                Cancel subscription
              </Button>
              <Button
                variant="secondary"
                icon={<ShieldOff className="h-4 w-4" />}
                disabled={Boolean(subscription.allowanceRevokedAt)}
                onClick={() => setRevokeOpen(true)}
              >
                Revoke remaining allowance
              </Button>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Subscription" />
            <div className="px-5 py-2">
              <KeyValue label="Merchant">{data.merchant.displayName}</KeyValue>
              <KeyValue label="Plan">{plan.name}</KeyValue>
              <KeyValue label="Amount per cycle">
                {subscription.amount === "0" ? "Usage-based" : <AmountDisplay base={subscription.amount} />}
              </KeyValue>
              <KeyValue label="Billing interval">{INTERVAL_LABEL[subscription.interval]}</KeyValue>
              <KeyValue label="Next renewal">{fmtDateTime(subscription.nextBillingAt)}</KeyValue>
              <KeyValue label="Subscription expiry">{fmtDateTime(subscription.expiresAt)}</KeyValue>
              <KeyValue label="Status">
                <StatusBadge label={SUBSCRIPTION_STATUS_META[subscription.status].label} tone={SUBSCRIPTION_TONES[subscription.status]} />
              </KeyValue>
            </div>
          </Card>

          <Card>
            <CardHeader title="Your authorization" />
            <div className="px-5 py-2">
              <KeyValue label="Maximum per cycle">
                <AmountDisplay base={subscription.maxChargePerCycle} />
              </KeyValue>
              <KeyValue label="Cumulative limit">
                <AmountDisplay base={subscription.cumulativeLimit} />
              </KeyValue>
              <KeyValue label="Amount spent">
                <AmountDisplay base={subscription.spent} />
              </KeyValue>
              <KeyValue label="Authorization remaining">
                <AmountDisplay base={subscription.allowanceRemaining} />
              </KeyValue>
              <KeyValue label="Authorization expiry">{fmtDateTime(subscription.expiresAt)}</KeyValue>
              <KeyValue label="Allowance status">
                <StatusBadge
                  label={subscription.allowanceRevokedAt ? "Revoked" : "Active"}
                  tone={subscription.allowanceRevokedAt ? "danger" : "positive"}
                />
              </KeyValue>
            </div>
            <div className="border-t border-line px-5 py-3">
              <p className="text-[11.5px] leading-relaxed text-ink-4">
                The merchant can never charge more than the per-cycle cap, and never more in total than the
                cumulative limit you approved.
              </p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Wallet and gas" />
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ink-4">Your wallet</p>
              <AddressDisplay address={customer?.wallet} full className="mt-1" />
            </div>
            <Callout tone="warn" title="Gas you pay">
              {SUBSCRIPTION_GAS_DISCLOSURE} Cancellation and allowance revocation are also customer-paid
              transactions on {DEFAULT_NETWORK.name}.
            </Callout>
            <p className="text-[11.5px] leading-relaxed text-ink-4">
              Renewals are submitted by the gateway relayer, so you do not pay gas for recurring charges.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment history" description="Renewals charged to this subscription" />
          {subscription.billingHistory.length === 0 ? (
            <EmptyState title="No charges yet" description="No renewal has been executed for this subscription." />
          ) : (
            <ul className="divide-y divide-line">
              {subscription.billingHistory.map((b) => (
                <li key={b.paymentId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <code className="font-mono text-[12px] text-ink">{b.paymentId}</code>
                    <p className="text-[11.5px] text-ink-3 tnum">{fmtDateTime(b.at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AmountDisplay base={b.amount} className="text-[12.5px]" />
                    <StatusBadge label={b.status} tone="positive" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Activity" />
          <div className="px-5 py-4">
            <Timeline
              entries={[
                { label: "Subscription created", at: subscription.createdAt, state: "done", simulated: true },
                {
                  label: "Token allowance approved",
                  detail: subscription.approvalTxRef ?? "Pending",
                  at: subscription.createdAt,
                  state: subscription.approvalTxRef ? "done" : "current",
                  simulated: true,
                },
                {
                  label: "Subscription activated",
                  detail: subscription.activationTxRef ?? "Pending",
                  at: subscription.createdAt,
                  state: subscription.activationTxRef ? "done" : "current",
                  simulated: true,
                },
                ...(subscription.cancelledAt
                  ? [{ label: "Subscription cancelled", at: subscription.cancelledAt, state: "done" as const }]
                  : []),
                ...(subscription.allowanceRevokedAt
                  ? [{ label: "Allowance revoked", at: subscription.allowanceRevokedAt, state: "done" as const }]
                  : []),
              ]}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Two separate actions" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="rounded-md border border-line p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                <Ban className="h-3.5 w-3.5 text-danger" />
                Cancel subscription
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
                Stops future charges. You submit the cancellation transaction and normally pay WBT gas. Your
                remaining allowance is <strong>not</strong> automatically revoked.
              </p>
            </div>
            <div className="rounded-md border border-line p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                <ShieldOff className="h-3.5 w-3.5 text-warn" />
                Revoke remaining allowance
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">
                Submits <code className="font-mono">approve(subscriptionContract, 0)</code> so no further
                tokens can be pulled. You pay WBT gas for this transaction.
              </p>
            </div>
          </div>
        </Card>

        <Callout tone="neutral" title="Need help?" icon={<Wallet className="h-4 w-4" />}>
          Contact {data.merchant.supportEmail} for billing questions. The gateway cannot change the terms of
          your subscription — only the merchant can.
        </Callout>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-ink-4">
          <Clock className="h-3.5 w-3.5" />
          Authorised in {TOKEN.symbol} on {DEFAULT_NETWORK.name} · demo transactions only
        </p>
        <p className="text-center text-[11.5px] text-ink-4">
          <Link to="/subscriptions" className="hover:text-ink">
            Merchant view of this subscription
          </Link>
        </p>
      </main>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        destructive
        title="Cancel this subscription?"
        confirmLabel="Cancel subscription"
        loading={busy}
        body={
          <div className="space-y-2">
            <p>Cancellation stops future subscription charges. Keep in mind:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The cancellation transaction is submitted to the subscription contract.</li>
              <li>You normally pay WBT gas for the cancellation in the current MVP.</li>
              <li>Your remaining ERC-20 allowance is not automatically revoked.</li>
              <li>Charges already settled are not reversed.</li>
            </ul>
          </div>
        }
        onConfirm={async () => {
          setBusy(true);
          await api.cancelSubscription(subscription.id);
          setBusy(false);
          setCancelOpen(false);
          pushToast({
            title: "Subscription cancelled (demo)",
            body: "No further renewals will be attempted. Your allowance is still active.",
            tone: "info",
          });
        }}
      />

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        destructive
        title="Revoke the remaining allowance?"
        confirmLabel="Revoke allowance"
        loading={busy}
        body={
          <div className="space-y-2">
            <p>
              This submits <code className="font-mono">approve(subscriptionContract, 0)</code> from your
              wallet so the merchant can no longer pull {TOKEN.symbol} under this authorization.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You normally pay WBT gas for this transaction in the current MVP.</li>
              <li>
                {fmtAmount(subscription.allowanceRemaining)} {TOKEN.symbol} of authorization remains.
              </li>
              <li>An active subscription will stop being renewable until you approve a new allowance.</li>
            </ul>
          </div>
        }
        onConfirm={async () => {
          setBusy(true);
          await api.revokeAllowance(subscription.id);
          setBusy(false);
          setRevokeOpen(false);
          pushToast({
            title: "Allowance revoked (demo)",
            body: "No further transfers can be executed under this authorization.",
            tone: "info",
          });
        }}
      />
    </div>
  );
}
