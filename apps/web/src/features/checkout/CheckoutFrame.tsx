import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { DEFAULT_NETWORK, TOKEN } from "@/config/app";

/**
 * Shared visual frame for customer-facing checkout pages: centered card with the
 * EzPayz brand header. Pure presentation — no data or state logic.
 */
export function CheckoutFrame({
  children,
  badge,
  width = "max-w-[440px]",
}: {
  children: ReactNode;
  badge?: ReactNode;
  width?: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="grid-lines absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-24 right-[-8%] h-[360px] w-[360px] rounded-full bg-accent-soft blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
      </div>
      <FadeIn className={`relative mx-auto w-full ${width} px-6 py-10 sm:py-14`}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.img
              src="/logo.png"
              alt="EzPayz"
              whileHover={{ rotate: -6, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="h-8 w-8 rounded-[10px] object-cover shadow-xs"
            />
            <div>
              <p className="text-[18px] font-semibold leading-tight text-ink">EzPayz Checkout</p>
              <p className="text-[13px] leading-tight text-ink-4">
                {TOKEN.symbol} · {DEFAULT_NETWORK.name}
              </p>
            </div>
          </div>
          {badge ?? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-positive-line bg-positive-soft px-2.5 py-1 text-[13px] font-semibold text-positive">
              <ShieldCheck className="h-3 w-3" />
              Secured
            </span>
          )}
        </div>
        {children}
        <p className="mt-5 text-center text-[13px] leading-relaxed text-ink-4">
          Powered by EzPayz · {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId}
        </p>
      </FadeIn>
    </div>
  );
}
