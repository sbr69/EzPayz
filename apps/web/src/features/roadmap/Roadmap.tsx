import { Link } from "react-router-dom";
import { ArrowRight, Clock, Sparkles } from "lucide-react";
import { ROADMAP } from "@/config/app";
import { Button, Callout, Card, CardHeader, PageHeader, Pill } from "@/components/ui";

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-[18px] font-bold text-white">
              W
            </span>
            <span className="text-[20px] font-semibold tracking-[-0.01em] text-ink">EzPayz</span>
          </Link>
          <div className="ml-auto flex gap-2">
            <Link to="/developers/quickstart">
              <Button variant="ghost" size="sm">
                Documentation
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="primary" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                Open dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <PageHeader
          title="Roadmap and future integrations"
          description="Capabilities that are planned but not built. Nothing on this page is a working product feature, and no integration below is live."
          meta={<Pill tone="warn">Coming later</Pill>}
        />

        <Callout tone="warn" title="These are not active capabilities" icon={<Clock className="h-4 w-4" />}>
          Each item below depends on external availability, eligibility or a technical dependency that is not
          in place yet. They are listed so the product direction is transparent — no fake integrations are
          shipped in this build.
        </Callout>

        <div className="grid gap-5 sm:grid-cols-2">
          {ROADMAP.map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[18px] font-semibold text-ink">{item.title}</h2>
                <Pill tone="neutral">{item.status}</Pill>
              </div>
              <p className="mt-2 text-[18px] leading-relaxed text-ink-3">{item.detail}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[16px] text-ink-4">
                <Clock className="h-3.5 w-3.5" />
                Not implemented in this build
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="What is implemented today" description="The scope you can test in this demo" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {[
              ["Hosted USDT checkout", "Gasless one-time payment flow with wallet states and simulated authorization."],
              ["Payment links and QR codes", "Fixed, customer-entered and reusable links."],
              ["Signed invoices and paid receipts", "PayeeShield verification, tamper detection and receipt preview."],
              ["Subscriptions and usage billing", "Allowance approval, activation, renewals, retries and cancellation."],
              ["Refunds", "Full and partial, with sponsored and merchant-paid gas paths."],
              ["Post-payment operations", "DeliveryGuard fulfilment tracking and payment exception handling."],
              ["Developer platform", "API keys, webhooks, event logs, SDK docs and API reference."],
              ["Analytics and settings", "Reconciled reporting and workspace configuration."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-md border border-line bg-canvas/60 p-3.5">
                <p className="flex items-center gap-1.5 text-[18px] font-semibold text-ink">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  {title}
                </p>
                <p className="mt-1 text-[18px] leading-relaxed text-ink-3">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
