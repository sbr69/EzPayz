import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { PenLine, Store, User, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { Card } from "@/components/ui";
import { DrawnCheck, EASE_OUT_QUART } from "@/components/ui/motion";
import { TOKEN } from "@/config/app";

/* --------------------------------- CoinMark -------------------------------- */

/** Small USDT-style coin rendered in the brand accent. */
export function CoinMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-accent font-semibold text-white shadow-xs",
        className,
      )}
      aria-hidden
    >
      <span className="translate-y-[-4%] text-[54%] leading-none">₮</span>
    </span>
  );
}

/* ---------------------------- PaymentLifecycle ----------------------------- */

const LIFECYCLE_STEPS = [
  { label: "Payment requested", detail: "Payment link · inv_7103" },
  { label: "Customer signs", detail: "EIP-3009 authorization" },
  { label: "Relayer submits", detail: "Gas sponsored · 0 WBT" },
  { label: "Settled on-chain", detail: "Payer → merchant wallet" },
] as const;

const STEP_MS = 2200;

/**
 * Hero visual — a hosted-checkout mockup that loops through the real payment
 * lifecycle: requested → signed → relayed (0 gas) → settled.
 */
export function PaymentLifecycleVisual() {
  const [step, setStep] = useState(0);
  const settled = step === LIFECYCLE_STEPS.length - 1;

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % LIFECYCLE_STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="overflow-hidden p-0 shadow-lg">
      {/* Browser chrome */}
      <div className="flex items-center justify-between border-b border-line bg-canvas px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        </div>
        <span className="font-mono text-[13px] text-ink-4">checkout.ezpayz.io</span>
        <CoinMark className="h-5 w-5" />
      </div>

      <div className="p-5 sm:p-6">
        {/* Amount summary */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] text-ink-4">Acme Studio requests</p>
            <p className="mt-0.5 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink tnum">
              1,600.00 <span className="text-accent">{TOKEN.symbol}</span>
            </p>
          </div>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[13px] font-medium text-ink-3">
            <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-accent" />
            {settled ? "Settled" : "Awaiting signature"}
          </span>
        </div>

        {/* Lifecycle steps */}
        <div className="mt-5 space-y-1.5">
          {LIFECYCLE_STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <div
                key={s.label}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors duration-500",
                  state === "active" && "border-accent-line bg-accent-soft/60",
                  state === "done" && "border-transparent bg-canvas/60",
                  state === "todo" && "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tnum",
                    state === "todo" && "bg-canvas-alt text-ink-4",
                    state === "active" && "bg-accent text-white",
                    state === "done" && "bg-positive-soft text-positive",
                  )}
                >
                  {state === "done" ? <Check /> : i + 1}
                </span>
                <span
                  className={cn(
                    "flex-1 text-[16px] transition-colors duration-500",
                    state === "todo" ? "text-ink-4" : "text-ink",
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "hidden font-mono text-[13px] transition-colors duration-500 sm:block",
                    state === "active" ? "text-accent" : "text-ink-4",
                  )}
                >
                  {s.detail}
                </span>
              </div>
            );
          })}
        </div>

        {/* Settled banner — fixed-height slot so the card height never changes mid-loop */}
        <div className="mt-4 h-14">
          <AnimatePresence>
            {settled ? (
              <motion.div
                key="settled"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
                className="flex h-full items-center gap-3 rounded-[10px] border border-positive-line bg-positive-soft px-3.5 py-3"
              >
                <DrawnCheck size={22} className="shrink-0 text-positive" />
                <p className="text-[16px] font-medium text-positive">Payment settled — receipt sent</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Cycle progress */}
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-canvas-alt">
          <motion.div
            className="h-full rounded-full bg-accent"
            animate={{ width: `${((step + 1) / LIFECYCLE_STEPS.length) * 100}%` }}
            transition={{ duration: 0.6, ease: EASE_OUT_QUART }}
          />
        </div>
      </div>
    </Card>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M3 8.5 L6.5 12 L13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --------------------------------- Marquee --------------------------------- */

/**
 * Infinite horizontal ticker. Content is rendered twice so the -50% keyframe
 * loops seamlessly; hover pauses it.
 */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("relative overflow-hidden py-5", className)} aria-hidden>
      <div className="animate-marquee flex w-max items-center">
        {doubled.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-7 pr-7 text-[18px] text-ink-3">
            {item}
            <span className="h-1.5 w-1.5 rounded-full bg-accent/60" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-canvas to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-canvas to-transparent" />
    </div>
  );
}

/* --------------------------------- CountUp --------------------------------- */

/** Animates a number from 0 to `to` when scrolled into view. */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - p, 4); // matches EASE_OUT_QUART
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  const display = Number.isInteger(to) ? Math.round(value) : value.toFixed(2);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* -------------------------------- GaslessFlow ------------------------------ */

const FLOW_NODES = [
  { icon: User, label: "Payer", sub: "connects a wallet" },
  { icon: PenLine, label: "Signs", sub: "EIP-3009 authorization" },
  { icon: Zap, label: "Relayer", sub: "pays the gas" },
  { icon: Store, label: "Merchant", sub: "receives USDT" },
] as const;

/** Animated payer → relayer → merchant flow with a traveling payment dot. */
export function GaslessFlow({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 items-start gap-y-6 sm:grid-cols-4 sm:gap-y-0", className)}>
      {FLOW_NODES.map((node, i) => (
        <div key={node.label} className="flex items-start sm:flex-1">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent-line bg-accent-soft text-accent">
              <node.icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <span className="text-[16px] font-semibold text-ink">{node.label}</span>
            <span className="max-w-[13ch] text-[14px] leading-snug text-ink-4">{node.sub}</span>
          </div>
          {i < FLOW_NODES.length - 1 ? (
            <div className="relative mx-2 mt-6 hidden h-px flex-1 bg-line-strong sm:block">
              <motion.span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-accent"
                animate={{ left: ["0%", "92%"], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.45, repeatDelay: 0.9 }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
