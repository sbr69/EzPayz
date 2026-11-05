import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  Code2,
  Gauge,
  Link2,
  PackageCheck,
  Receipt,
  RefreshCcw,
  Repeat,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { DEFAULT_NETWORK, GATEWAY, TOKEN } from "@/config/app";
import { Button, Card } from "@/components/ui";
import { CodeBlock } from "@/components/ui/display";
import { FadeIn, Reveal, Stagger, StaggerItem, EASE_OUT_QUART } from "@/components/ui/motion";

const capabilities = [
  {
    icon: Zap,
    title: "One-time USDT checkout",
    body: "A hosted checkout where the customer signs a payment authorization and the gateway relayer submits the transaction.",
  },
  {
    icon: Link2,
    title: "Payment links and QR codes",
    body: "Fixed, customer-entered and reusable links. Every checkout creates its own payment record.",
  },
  {
    icon: Receipt,
    title: "Invoices and paid receipts",
    body: "Signed invoices with line items, expiry and a paid receipt emailed after settlement.",
  },
  {
    icon: Repeat,
    title: "Recurring billing",
    body: "Hourly, daily and monthly plans with per-cycle caps, cumulative limits and retry policies.",
  },
  {
    icon: BarChart3,
    title: "Usage-based billing",
    body: "Meter units from your application and charge the calculated amount within the customer's authorization.",
  },
  {
    icon: RefreshCcw,
    title: "Full and partial refunds",
    body: "Refund any part of a settled payment, with sponsored or merchant-paid gas paths.",
  },
  {
    icon: Boxes,
    title: "Customers, products, fulfilment",
    body: "Customer records scoped to your workspace, a reusable catalogue and delivery tracking.",
  },
  {
    icon: Terminal,
    title: "Developer platform",
    body: "API keys, webhook endpoints, event logs, an SDK and searchable reference documentation.",
  },
];

const steps = [
  { title: "Create an account", body: "Connect your payout wallet and configure checkout in a guided onboarding flow." },
  { title: "Drop in the SDK", body: "Create a payment intent server-side and render the checkout widget with your publishable key." },
  { title: "Get notified", body: "Subscribe to webhook events and reconcile settlement, refunds and renewals." },
  { title: "Operate after payment", body: "Track fulfilment, resolve exceptions and analyse volume from one dashboard." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full items-center gap-4 px-5 sm:px-8 lg:px-12 2xl:px-20">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#118a7e] to-accent text-[18px] font-bold text-white shadow-xs">
              W
            </span>
            <span className="text-[20px] font-semibold tracking-[-0.01em] text-ink">EzPayz</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-[18px] text-ink-2 md:flex">
            <a href="#capabilities" className="transition-colors hover:text-ink">
              Product
            </a>
            <a href="#gasless" className="transition-colors hover:text-ink">
              Gasless
            </a>
            <a href="#security" className="transition-colors hover:text-ink">
              Security
            </a>
            <a href="#developers" className="transition-colors hover:text-ink">
              Developers
            </a>
            <Link to="/roadmap" className="transition-colors hover:text-ink">
              Roadmap
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="primary" size="sm">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-accent-soft blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
          <div className="absolute top-40 left-[-8%] h-[320px] w-[320px] rounded-full bg-info-soft/70 blur-3xl [animation:drift_22s_ease-in-out_infinite_reverse]" />
        </div>
        <div className="relative mx-auto grid w-full gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24 lg:px-10 2xl:px-16">
          <Stagger gap={0.08}>
            <StaggerItem>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[14px] font-medium text-ink-3 shadow-xs">
                <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-accent" />
                {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId} · {TOKEN.symbol}
              </span>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-5 text-[41px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[52px]">
                One integration.{" "}
                <span className="bg-gradient-to-r from-accent to-[#1f5f8b] bg-clip-text text-transparent">
                  Complete USDT payment infrastructure
                </span>{" "}
                on Whitechain.
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 max-w-xl text-[20px] leading-relaxed text-ink-2">
                Accept USDT with hosted checkout, payment links and invoices. Bill on a schedule or by
                usage. Refund, track delivery and resolve payment exceptions — from the first signature to
                what happens after settlement.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link to="/sign-up">
                  <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
                    Get started
                  </Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="secondary" size="lg">
                    Open dashboard
                  </Button>
                </Link>
                <Link to="/developers/quickstart">
                  <Button variant="ghost" size="lg">
                    View documentation
                  </Button>
                </Link>
              </div>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-4 text-[16px] text-ink-4">
                This is a frontend demo. Wallets, signatures and settlements are simulated — nothing is
                broadcast to Whitechain.
              </p>
            </StaggerItem>
          </Stagger>

          <FadeIn delay={0.25} y={20}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Card className="overflow-hidden p-0 shadow-md">
                <div className="flex items-center justify-between border-b border-line bg-canvas px-6 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  </div>
                  <span className="font-mono text-[14px] text-ink-4">checkout.tsx</span>
                </div>
                <div className="p-5">
                  <CodeBlock
                    language="tsx"
                    filename="app/checkout.tsx"
                    code={`import { EzPayzProvider, Checkout } from "@whitepay/usdt-sdk";

export default function Pay() {
  return (
    <EzPayzProvider publishableKey={process.env.PUBLIC_KEY!}>
      <Checkout
        sessionId={session.id}
        onSuccess={(payment) => router.push("/receipt/" + payment.id)}
      />
    </EzPayzProvider>
  );
}`}
                  />
                  <div className="mt-4 space-y-2">
                    {[
                      "Payment intent created server-side",
                      "Customer signs the payment authorization",
                      "Relayer submits and sponsors gas",
                      "Webhook confirms settlement",
                    ].map((line, i) => (
                      <motion.div
                        key={line}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.12, duration: 0.4, ease: EASE_OUT_QUART }}
                        className="flex items-center gap-2.5 text-[16px] text-ink-2"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent tnum">
                          {i + 1}
                        </span>
                        {line}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          </FadeIn>
        </div>
      </section>

      {/* Metrics strip */}
      <section className="border-b border-line bg-canvas-alt/60">
        <div className="mx-auto grid w-full gap-6 px-5 py-8 sm:px-8 sm:grid-cols-3 lg:px-12 2xl:px-20">
          {[
            { label: "Settlement asset", value: `${TOKEN.symbol} on ${DEFAULT_NETWORK.name}` },
            { label: "Gas for payers", value: "Sponsored on supported flows" },
            { label: "Post-payment tooling", value: "Refunds, delivery, exceptions" },
          ].map((m, i) => (
            <Reveal key={m.label} delay={i * 0.08}>
              <p className="text-[14px] font-semibold uppercase tracking-wider text-ink-4">{m.label}</p>
              <p className="mt-1 text-[20px] font-medium text-ink">{m.value}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-20 border-b border-line">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-ink">Everything you need to get paid</h2>
            <p className="mt-2 max-w-2xl text-[18px] leading-relaxed text-ink-3">
              The payment is only the middle of the story. The gateway covers the request before payment,
              the checkout itself, and the operations that follow it.
            </p>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
            {capabilities.map((c) => (
              <StaggerItem key={c.title}>
                <Card className="group h-full p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                    <c.icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-3 text-[18px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-ink-3">{c.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Gasless */}
      <section id="gasless" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto grid w-full gap-8 px-5 py-16 lg:grid-cols-2 lg:px-10 2xl:px-16">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-[14px] font-semibold text-accent">
              <Gauge className="h-3.5 w-3.5" />
              GasGuard
            </span>
            <h2 className="mt-4 text-[32px] font-bold tracking-[-0.02em] text-ink">
              Gasless checkout for your customers
            </h2>
            <p className="mt-3 text-[18px] leading-relaxed text-ink-2">
              Supported one-time payment flows are sponsored by the merchant through the gateway relayer.
              The customer does not need WBT for gas on those flows — they still connect a wallet and
              still sign the payment authorization.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Delegated transfer authorization instead of a customer-paid transfer",
                "Relayer policies: gas caps, budgets, rate limits, replay protection",
                "Merchant-level sponsorship budget visibility and reporting",
                "Explicit fallback to merchant-paid gas where delegation is unavailable",
              ].map((t, i) => (
                <motion.li
                  key={t}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT_QUART }}
                  className="flex items-start gap-2.5 text-[18px] text-ink-2"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {t}
                </motion.li>
              ))}
            </ul>
            <p className="mt-5 rounded-[10px] border border-warn-line bg-warn-soft px-3.5 py-3 text-[16px] leading-relaxed text-warn">
              Delegated transfers require the token contract to support them. Support for the configured
              test {TOKEN.symbol} contract has not been verified yet, so this demo simulates the flow
              rather than claiming it works on-chain.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <Card className="p-5 shadow-sm">
              <p className="text-[14px] font-semibold uppercase tracking-wider text-ink-4">Relayer policy</p>
              <div className="mt-3 space-y-3">
                {[
                  ["Max gas per transaction", "120,000"],
                  ["Merchant budget", "5 WBT"],
                  ["Daily sponsorship limit", "1 WBT"],
                  ["Allowed network", DEFAULT_NETWORK.name],
                  ["Allowed token", TOKEN.symbol],
                  ["Replay protection", "Enabled"],
                  ["Emergency pause", "Off"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 border-b border-line pb-2.5 last:border-0">
                    <span className="text-[16px] text-ink-3">{k}</span>
                    <span className="text-[16px] font-medium text-ink tnum">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 border-b border-line">
        <div className="mx-auto grid w-full gap-8 px-5 py-16 lg:grid-cols-[1fr_1fr] lg:px-10 2xl:px-16">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-line bg-positive-soft px-2.5 py-1 text-[14px] font-semibold text-positive">
              <ShieldCheck className="h-3.5 w-3.5" />
              PayeeShield
            </span>
            <h2 className="mt-4 text-[32px] font-bold tracking-[-0.02em] text-ink">
              Signed payment requests your customers can verify
            </h2>
            <p className="mt-3 text-[18px] leading-relaxed text-ink-2">
              Every invoice and payment request is signed by a delegated gateway key over the fields that
              matter: recipient, amount, token, network, expiry and reference. The customer sees the
              verification result before they authorize anything.
            </p>
            <ul className="mt-5 space-y-2.5 text-[18px] text-ink-2">
              {[
                "Tampered requests are rejected before checkout",
                "Signing keys are rotated and can be revoked",
                "Verification history is recorded per request",
              ].map((t, i) => (
                <motion.li
                  key={t}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT_QUART }}
                  className="flex items-start gap-2.5"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  {t}
                </motion.li>
              ))}
            </ul>
            <p className="mt-5 text-[16px] leading-relaxed text-ink-4">
              The gateway signature proves the request came from the delegated signing key and was not
              modified. It is not legal merchant verification.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <Card className="p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-positive-soft text-positive">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <p className="text-[18px] font-semibold text-ink">Verified merchant request</p>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ["Invoice", "inv_7103"],
                  ["Amount", "1,600.00 USDT"],
                  ["Token", TOKEN.symbol],
                  ["Network", DEFAULT_NETWORK.name],
                  ["Recipient", `${"0xd3000000…0000aa01"}`],
                  ["Expiry", "14 days"],
                  ["Signing key", "gwk_2F91A"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 text-[16px]">
                    <span className="text-ink-3">{k}</span>
                    <span className="font-mono text-ink-2">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[10px] border border-positive-line bg-positive-soft px-3 py-2.5 text-[16px] text-positive">
                All protected fields matched. If any value is changed after signing, verification fails and
                checkout is blocked.
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="scroll-mt-20 border-b border-line bg-surface">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[14px] font-semibold text-ink-3">
                <Code2 className="h-3.5 w-3.5" />
                {GATEWAY.sdkPackage}
              </span>
              <h2 className="mt-4 text-[32px] font-bold tracking-[-0.02em] text-ink">
                Built for developers first
              </h2>
              <p className="mt-3 text-[18px] leading-relaxed text-ink-2">
                A typed SDK, predictable resources and webhook events that mirror the payment lifecycle.
                The integration below is the whole checkout surface.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link to="/developers/quickstart">
                  <Button variant="primary">Read the quickstart</Button>
                </Link>
                <Link to="/developers/api-reference">
                  <Button variant="secondary">API reference</Button>
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.15}>
              <CodeBlock
                language="ts"
                filename="server/create-intent.ts"
                caption="Provisional API surface — the backend contract is not finalised."
                code={`import { EzPayz } from "@whitepay/usdt-sdk";

const wp = new EzPayz({ secretKey: process.env.SECRET_KEY! });

const session = await wp.checkout.sessions.create({
  amount: "1600.00",
  token: "USDT",
  network: "whitechain-sepolia",
  description: "Audit sprint — balance",
  expiresInHours: 72,
  successUrl: "https://example.com/thanks",
});

console.log(session.url);`}
              />
            </Reveal>
          </div>

          <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.07}>
            {steps.map((s, i) => (
              <StaggerItem key={s.title}>
                <Card className="h-full p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[14px] font-bold text-accent tnum">
                    {i + 1}
                  </span>
                  <h3 className="mt-2.5 text-[18px] font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-[16px] leading-relaxed text-ink-3">{s.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Post payment */}
      <section className="border-b border-line">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-ink">What happens after payment</h2>
            <p className="mt-2 max-w-2xl text-[18px] leading-relaxed text-ink-3">
              Refunds, delivery tracking, exception handling and reporting live alongside the payment record
              they belong to, with one consistent set of references.
            </p>
          </Reveal>
          <Stagger className="mt-8 grid gap-5 sm:grid-cols-3" gap={0.08}>
            {[
              {
                icon: RefreshCcw,
                title: "Refunds",
                body: "Full or partial, with remaining-refundable validation and clear gas attribution.",
              },
              {
                icon: PackageCheck,
                title: "DeliveryGuard",
                body: "Merchant-reported fulfilment status with a customer-facing order page. Not escrow.",
              },
              {
                icon: BarChart3,
                title: "Exception intelligence",
                body: "Underpayments, relayer failures, webhook outages — with recommended next actions.",
              },
            ].map((c) => (
              <StaggerItem key={c.title}>
                <Card className="group h-full p-4 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                    <c.icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-3 text-[18px] font-semibold text-ink">{c.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-ink-3">{c.body}</p>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-surface">
        <div className="mx-auto w-full px-5 py-16 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent-soft via-surface to-info-soft/50 px-6 py-12 text-center shadow-sm">
              <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
              <div className="relative">
                <h2 className="text-[32px] font-bold tracking-[-0.02em] text-ink">
                  Start accepting USDT on Whitechain
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[18px] leading-relaxed text-ink-2">
                  Open the demo merchant workspace to explore checkout, invoices, subscriptions, refunds and
                  the developer platform with seeded data.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2.5">
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
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12 2xl:px-20 text-[16px] text-ink-4">
          <p>
            EzPayz — frontend demo for {DEFAULT_NETWORK.name}. {TOKEN.symbol} contract{" "}
            <code className="font-mono">{TOKEN.contract.slice(0, 12)}…</code>
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/developers/quickstart" className="transition-colors hover:text-ink">
              Documentation
            </Link>
            <Link to="/developers/api-reference" className="transition-colors hover:text-ink">
              API reference
            </Link>
            <Link to="/roadmap" className="transition-colors hover:text-ink">
              Roadmap
            </Link>
            <Link to="/sign-in" className="transition-colors hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
