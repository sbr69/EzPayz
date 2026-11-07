import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Link2,
  PackageCheck,
  Receipt,
  RefreshCcw,
  Repeat,
  Terminal,
  Zap,
} from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { TOKEN } from "@/config/app";
import { PageHero } from "./MarketingLayout";

const CAPABILITIES = [
  {
    icon: Zap,
    title: "One-time USDT checkout",
    body: "Hosted checkout: the customer signs, the relayer submits.",
  },
  {
    icon: Link2,
    title: "Payment links & QR codes",
    body: "Fixed, customer-entered and reusable — each with its own payment record.",
  },
  {
    icon: Receipt,
    title: "Invoices & receipts",
    body: "Signed invoices with line items and a paid receipt after settlement.",
  },
  {
    icon: Repeat,
    title: "Recurring billing",
    body: "Hourly, daily and monthly plans with caps and retry policies.",
  },
  {
    icon: BarChart3,
    title: "Usage-based billing",
    body: "Meter units in your app; charge within the customer's authorization.",
  },
  {
    icon: RefreshCcw,
    title: "Full & partial refunds",
    body: "Refund any settled amount, with clear gas attribution.",
  },
  {
    icon: Boxes,
    title: "Customers, products & fulfilment",
    body: "Workspace-scoped records, a reusable catalogue and delivery tracking.",
  },
  {
    icon: Terminal,
    title: "Developer platform",
    body: "API keys, webhooks, event logs, an SDK and searchable reference.",
  },
];

const POST_PAYMENT = [
  {
    icon: RefreshCcw,
    title: "Refunds",
    body: "Full or partial, with remaining-refundable validation.",
  },
  {
    icon: PackageCheck,
    title: "DeliveryGuard",
    body: "Merchant-reported fulfilment with a customer-facing order page. Not escrow.",
  },
  {
    icon: BarChart3,
    title: "Exception intelligence",
    body: "Underpayments, relayer failures, webhook outages — with next actions.",
  },
];

export function ProductPage() {
  return (
    <div>
      <PageHero
        title={
          <>
            Everything you need to <span className="italic text-accent">get paid</span>.
          </>
        }
        lede={`The payment is only the middle of the story — ${TOKEN.symbol} on Whitechain covers the request before payment, the checkout itself, and the operations that follow it.`}
      />

      {/* Capabilities */}
      <section className="border-b border-line">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
            {CAPABILITIES.map((c) => (
              <StaggerItem key={c.title}>
                <Card className="group h-full p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                    <c.icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.01em] text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-ink-3">{c.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Post payment */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <h2 className="font-display text-[36px] leading-[1.05] text-ink sm:text-[44px]">
              What happens <span className="italic text-accent">after</span> payment
            </h2>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 sm:grid-cols-3" gap={0.08}>
            {POST_PAYMENT.map((c) => (
              <StaggerItem key={c.title}>
                <Card className="group h-full p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                    <c.icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.01em] text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-ink-3">{c.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-3 px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Link to="/sign-up">
            <Button variant="primary" size="lg">
              Get started
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="secondary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              Open dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default ProductPage;
