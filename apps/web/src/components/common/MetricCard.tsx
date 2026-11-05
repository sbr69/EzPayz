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
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat"; label?: string };
  icon?: ReactNode;
  to?: string;
  tone?: "neutral" | "positive" | "warn" | "danger" | "accent";
}) {
  const body = (
    <Card className="group h-full p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-semibold uppercase tracking-wider text-ink-4">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-canvas-alt text-ink-3 transition-colors duration-300 group-hover:bg-accent-soft group-hover:text-accent">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tnum",
          tone === "positive" && "text-positive",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
          tone === "accent" && "text-accent",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {delta && delta.direction !== "flat" ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[16px] font-semibold tnum",
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
        {sub ? <span className="text-[16px] text-ink-3">{sub}</span> : null}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "warn" | "danger";
}) {
  return (
    <div className="rounded-md border border-line bg-canvas/60 px-3 py-2">
      <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[20px] font-semibold tnum",
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
