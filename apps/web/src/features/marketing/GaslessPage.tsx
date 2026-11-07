import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, Gauge } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { EASE_OUT_QUART, Reveal } from "@/components/ui/motion";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { GaslessFlow } from "./visuals";
import { PageHero } from "./MarketingLayout";

const GASLESS_POINTS = [
  "Delegated transfer authorization instead of a customer-paid transfer",
  "Relayer policies: gas caps, budgets, rate limits, replay protection",
  "Merchant-level sponsorship budget visibility and reporting",
  "Explicit fallback to merchant-paid gas where delegation is unavailable",
];

export function GaslessPage() {
  return (
    <div>
      <PageHero
        title={
          <>
            Checkout without <span className="italic text-accent">the gas</span>.
          </>
        }
        lede={`On supported one-time payment flows the merchant sponsors gas through the gateway relayer. Customers connect a wallet and sign — no ${"WBT"} needed on those flows.`}
      />

      {/* Flow */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8">
          <Reveal>
            <GaslessFlow />
          </Reveal>
        </div>
      </section>

      {/* Details */}
      <section className="border-b border-line">
        <div className="mx-auto grid w-full gap-10 px-5 py-16 lg:grid-cols-2 lg:px-10 2xl:px-16">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-2.5 py-1 text-[14px] font-semibold text-accent">
              <Gauge className="h-3.5 w-3.5" />
              GasGuard
            </span>
            <h2 className="mt-4 font-display text-[36px] leading-[1.05] text-ink sm:text-[44px]">
              Sponsored by the merchant, <span className="italic text-accent">guarded by policy</span>
            </h2>
            <ul className="mt-6 space-y-3">
              {GASLESS_POINTS.map((t, i) => (
                <motion.li
                  key={t}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT_QUART }}
                  className="flex items-start gap-2.5 text-[18px] text-ink-2"
                >
                  <Check className="mt-1 h-4 w-4 shrink-0 text-accent" />
                  {t}
                </motion.li>
              ))}
            </ul>
            <p className="mt-6 rounded-[10px] border border-positive-line bg-positive-soft px-3.5 py-3 text-[16px] leading-relaxed text-positive">
              The configured test {TOKEN.symbol} contract supports delegated transfers (EIP-3009) —
              verified on-chain. Real checkout flows submit signed authorizations through the relayer,
              so your customers pay zero gas.
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
                  <div
                    key={k}
                    className="flex items-center justify-between gap-4 border-b border-line pb-2.5 last:border-0"
                  >
                    <span className="text-[16px] text-ink-3">{k}</span>
                    <span className="text-[16px] font-medium text-ink tnum">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
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
          <Link to="/gasguard">
            <Button variant="secondary" size="lg" iconRight={<ArrowRight className="h-4 w-4" />}>
              See GasGuard in the dashboard
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

export default GaslessPage;
