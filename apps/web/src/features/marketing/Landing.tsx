import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Gauge, ShieldCheck, Zap } from "lucide-react";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { Button, Card } from "@/components/ui";
import { CodeBlock } from "@/components/ui/display";
import { FadeIn, Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { CountUp, Marquee, PaymentLifecycleVisual } from "./visuals";

const MARQUEE_ITEMS = [
  "Hosted checkout",
  "Payment links",
  "Invoices",
  "Recurring billing",
  "Usage-based billing",
  "Full & partial refunds",
  "DeliveryGuard",
  "Exception intelligence",
  "Signed webhooks",
  "Typed SDK",
  "x402 agent payments",
];

const METRICS = [
  { value: 1, suffix: "", label: "customer signature — that's the whole checkout" },
  { value: 0, suffix: "", label: "WBT needed by customers on sponsored flows" },
  { value: 100, suffix: "%", label: "non-custodial — funds move payer → merchant directly" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Checkout everything",
    body: "Links, invoices, subscriptions and usage billing — one integration, one payment record each.",
    to: "/product",
    cta: "Explore the product",
  },
  {
    icon: Gauge,
    title: "Gasless for customers",
    body: "The relayer submits and sponsors gas. Customers connect a wallet and just sign.",
    to: "/gasless",
    cta: "How GasGuard works",
  },
  {
    icon: ShieldCheck,
    title: "Verified requests",
    body: "Every payment request is signed over the fields that matter and verified before checkout.",
    to: "/security",
    cta: "About PayeeShield",
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
          <div className="absolute -top-32 right-[-10%] h-[420px] w-[420px] rounded-full bg-accent-soft blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
          <div className="absolute top-40 left-[-8%] h-[320px] w-[320px] rounded-full bg-info-soft/70 blur-3xl [animation:drift_22s_ease-in-out_infinite_reverse]" />
        </div>
        <div className="relative mx-auto grid w-full gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-28 lg:px-10 2xl:px-16">
          <Stagger gap={0.09}>
            <StaggerItem>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[14px] font-medium text-ink-3 shadow-xs">
                <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-accent" />
                {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId} · {TOKEN.symbol}
              </span>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-6 font-display text-[50px] leading-[1.02] tracking-[0em] text-ink sm:text-[72px] xl:text-[84px]">
                <span className="italic">Get paid,</span> beautifully in{" "}
                <span className="text-accent">USDT.</span>
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 max-w-lg text-[20px] leading-relaxed text-ink-3">
                EzPayz is the non-custodial USDT payment gateway on Whitechain — checkout, payment
                links, invoices, subscriptions and refunds in one integration.
              </p>
            </StaggerItem>
            <StaggerItem>
              <div className="mt-8 flex flex-wrap items-center gap-2.5">
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
              </div>
            </StaggerItem>
          </Stagger>

          <FadeIn delay={0.25} y={20}>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <PaymentLifecycleVisual />
            </motion.div>
          </FadeIn>
        </div>
      </section>

      {/* Capability marquee */}
      <Marquee items={MARQUEE_ITEMS} className="border-b border-line bg-canvas" />

      {/* Metrics */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full gap-10 px-5 py-14 sm:px-8 sm:grid-cols-3 lg:px-12 2xl:px-20">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.08}>
              <p className="font-display text-[56px] leading-none text-ink">
                <CountUp to={m.value} suffix={m.suffix} />
              </p>
              <p className="mt-2.5 max-w-[28ch] text-[16px] leading-relaxed text-ink-3">{m.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature teaser */}
      <section className="border-b border-line">
        <div className="mx-auto w-full px-5 py-20 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <h2 className="font-display text-[40px] leading-[1.05] text-ink sm:text-[52px]">
              Everything you need to <span className="italic text-accent">get paid</span>.
            </h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-5 md:grid-cols-3" gap={0.08}>
            {FEATURES.map((f) => (
              <StaggerItem key={f.title}>
                <Link to={f.to} className="group block h-full">
                  <Card className="h-full p-6 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                      <f.icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.01em] text-ink">{f.title}</h3>
                    <p className="mt-2 text-[16px] leading-relaxed text-ink-3">{f.body}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[16px] font-medium text-accent">
                      {f.cta}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Developers teaser */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid w-full items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10 2xl:px-16">
          <Reveal>
            <h2 className="font-display text-[40px] leading-[1.05] text-ink sm:text-[52px]">
              Build in <span className="italic text-accent">minutes</span>.
            </h2>
            <p className="mt-4 max-w-lg text-[18px] leading-relaxed text-ink-3">
              A typed SDK, predictable resources and webhooks that mirror the payment lifecycle.
            </p>
            <div className="mt-6">
              <Link to="/build">
                <Button variant="primary" iconRight={<ArrowRight className="h-4 w-4" />}>
                  Explore the developer platform
                </Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <CodeBlock
              language="ts"
              filename="server/create-intent.ts"
              code={`const session = await ezpay.checkout.sessions.create({
  amount: "1600.00",
  token: "USDT",
  network: "whitechain-sepolia",
});

console.log(session.url);`}
            />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto w-full px-5 py-20 sm:px-8 lg:px-12 2xl:px-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-accent-soft via-surface to-info-soft/50 px-6 py-16 text-center shadow-sm">
              <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
              <div className="relative">
                <h2 className="font-display text-[40px] leading-[1.05] text-ink sm:text-[52px]">
                  Start accepting <span className="italic text-accent">USDT</span> today.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[18px] leading-relaxed text-ink-2">
                  Open the demo merchant workspace to explore checkout, invoices, subscriptions,
                  refunds and the developer platform with seeded data.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2.5">
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
    </div>
  );
}
