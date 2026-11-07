import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { useDemo } from "@/store/demoStore";
import { DEMO } from "@/config/app";
import { Button } from "./primitives";
import { EASE_OUT_QUART } from "./motion";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
      className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas-alt text-ink-3 shadow-xs">
        {icon ?? <Info className="h-5 w-5" />}
      </div>
      <p className="text-[18px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-[16px] leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </motion.div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="text-[18px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-[16px] text-ink-3">{description}</p> : null}
      {onRetry ? (
        <Button className="mt-4" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </motion.div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-lg bg-canvas-alt", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton
              key={c}
              className={cn("h-3.5", c === 0 ? "w-28" : c === cols - 1 ? "ml-auto w-16" : "w-20")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function InlineLoading({ label = "Working…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-10 text-[18px] text-ink-3">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/* ---------------------------------- Toasts --------------------------------- */

export function ToastHost() {
  const toasts = useDemo((s) => s.toasts);
  const dismiss = useDemo((s) => s.dismissToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 5200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-positive" />,
    error: <AlertCircle className="h-4 w-4 text-danger" />,
    info: <Info className="h-4 w-4 text-info" />,
    warn: <TriangleAlert className="h-4 w-4 text-warn" />,
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            role="status"
            layout
            initial={{ opacity: 0, x: 48, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 32, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ duration: 0.32, ease: EASE_OUT_QUART }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-lg"
          >
            <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-semibold text-ink">{t.title}</p>
              {t.body ? <p className="mt-0.5 text-[16px] leading-relaxed text-ink-3">{t.body}</p> : null}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-ink-4 transition-colors hover:bg-canvas-alt hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- Demo banner -------------------------------- */

export function DemoModeBanner({ compact }: { compact?: boolean }) {
  if (!DEMO.demoMode) return null;
  return (
    <div className="flex items-start gap-2 rounded-[10px] border border-warn-line bg-warn-soft px-3 py-2 text-warn">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="text-[16px] leading-relaxed">
        <span className="font-semibold">Demo mode.</span>{" "}
        {compact ? (
          <>
            <span className="sm:hidden">Everything is simulated.</span>
            <span className="hidden sm:inline">
              All wallets, signatures, transactions and settlements shown here are simulated in the
              browser. No on-chain state is read or written and nothing is verified on Whitechain.
            </span>
          </>
        ) : (
          "All wallets, signatures, transactions and settlements shown here are simulated in the browser. No on-chain state is read or written and nothing is verified on Whitechain."
        )}
      </p>
    </div>
  );
}

export function SimulatedBadge({ label = "Simulated" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warn-line bg-warn-soft px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wide text-warn">
      {label}
    </span>
  );
}

export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface/75 backdrop-blur-[2px]">
      <Loader2 className="h-5 w-5 animate-spin text-accent" />
      <p className="text-[16px] font-medium text-ink-2">{label}</p>
    </div>
  );
}
