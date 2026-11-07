import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { Card } from "@/components/ui/primitives";

export function MetricCard({
  label,
  value,
  sub,
  delta,
  icon,
  to,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat"; label?: string };
  icon?: ReactNode;
  to?: string;
  tone?: "neutral" | "positive" | "warn" | "danger" | "accent";
  className?: string;
}) {
  const body = (
    <Card
      className={cn(
        "group h-full min-w-0 p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[14px] font-semibold uppercase tracking-wider text-ink-4">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas-alt text-ink-3 transition-colors duration-300 group-hover:bg-accent-soft group-hover:text-accent">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 whitespace-nowrap text-[22px] font-semibold leading-none tracking-[-0.02em] tnum sm:text-[26px]",
          tone === "positive" && "text-positive",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
          tone === "accent" && "text-accent",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        {delta && delta.direction !== "flat" ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[16px] font-semibold tnum",
              delta.direction === "up" ? "text-positive" : "text-danger",
            )}
          >
            {delta.direction === "up" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {delta.value}
          </span>
        ) : null}
        {sub ? <span className="min-w-0 truncate text-[16px] text-ink-3">{sub}</span> : null}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block h-full min-w-0">{body}</Link> : body;
}

export function MiniStat({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "warn" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border border-line bg-canvas/60 px-3 py-2", className)}>
      <p className="truncate text-[14px] font-medium uppercase tracking-wide text-ink-4">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate whitespace-nowrap text-[18px] font-semibold tnum sm:text-[20px]",
          tone === "positive" && "text-positive",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
          !tone && "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
