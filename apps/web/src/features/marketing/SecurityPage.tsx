import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { EASE_OUT_QUART, Reveal } from "@/components/ui/motion";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";
import { PageHero } from "./MarketingLayout";

const SECURITY_POINTS = [
  "Tampered requests are rejected before checkout",
  "Signing keys are rotated and can be revoked",
  "Verification history is recorded per request",
];

export function SecurityPage() {
  return (
    <div>
      <PageHero
        title={
          <>
            Signed requests, <span className="italic text-accent">verified</span> checkout.
          </>
        }
        lede="Every invoice and payment request is signed by a delegated gateway key over the fields that matter. The customer sees the verification result before they authorize anything."
      />

      {/* Details */}
      <section className="border-b border-line">
        <div className="mx-auto grid w-full gap-10 px-5 py-16 lg:grid-cols-2 lg:px-10 2xl:px-16">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-line bg-positive-soft px-2.5 py-1 text-[14px] font-semibold text-positive">
              <ShieldCheck className="h-3.5 w-3.5" />
              PayeeShield
            </span>
            <h2 className="mt-4 font-display text-[36px] leading-[1.05] text-ink sm:text-[44px]">
              Nothing authorizes until <span className="italic text-accent">everything matches</span>
            </h2>
            <ul className="mt-6 space-y-3 text-[18px] text-ink-2">
              {SECURITY_POINTS.map((t, i) => (
                <motion.li
                  key={t}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: EASE_OUT_QUART }}
                  className="flex items-start gap-2.5"
                >
                  <Check className="mt-1 h-4 w-4 shrink-0 text-positive" />
                  {t}
                </motion.li>
              ))}
            </ul>
            <p className="mt-6 text-[16px] leading-relaxed text-ink-4">
              The gateway signature proves the request came from the delegated signing key and was
              not modified. It is not legal merchant verification.
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
                  ["Recipient", "0xd3000000…0000aa01"],
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
                All protected fields matched. If any value is changed after signing, verification
                fails and checkout is blocked.
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

export default SecurityPage;
