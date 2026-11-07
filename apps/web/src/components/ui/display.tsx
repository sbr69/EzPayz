import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/utils/cn";
import { fmtAmount, truncateMiddle } from "@/lib/money";
import { TOKEN } from "@/config/app";
import { PAYEEESHIELD_TONES } from "@/components/ui/statusTones";
import type { Tone } from "@/config/ui";
import type { PayeeShieldRecord, TimelineEntry } from "@/types";

/* -------------------------------- CopyButton -------------------------------- */

export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
  className,
}: {
  value: string;
  label?: string;
  size?: "sm" | "xs";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void navigator.clipboard?.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      title={`Copy ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface font-medium text-ink-3",
        "transition-all duration-150 hover:border-line-strong hover:text-ink active:scale-95",
        size === "sm" ? "h-6 px-1.5 text-[14px]" : "h-5 px-1 text-[13px]",
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
      {size === "sm" ? <span>{copied ? "Copied" : label}</span> : null}
    </button>
  );
}

export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[16px] font-medium uppercase tracking-wide text-ink-4">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={cn(
            "min-w-0 flex-1 truncate rounded border border-line bg-canvas px-2.5 py-1.5 text-[18px] text-ink-2",
            mono && "font-mono",
          )}
        >
          {value}
        </code>
        <CopyButton value={value} label="Copy" />
      </div>
    </div>
  );
}

/* ------------------------------- StatusBadge -------------------------------- */

const toneClass: Record<Tone, string> = {
  neutral: "bg-canvas-alt text-ink-3 border-line",
  subtle: "bg-canvas text-ink-3 border-line-strong",
  info: "bg-info-soft text-info border-info-line",
  positive: "bg-positive-soft text-positive border-positive-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  accent: "bg-accent-soft text-accent border-accent-line",
};

export function StatusBadge({
  label,
  tone = "neutral",
  dot = true,
  className,
}: {
  label: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  const dotClass: Record<Tone, string> = {
    neutral: "bg-ink-4",
    subtle: "bg-ink-4",
    info: "bg-info",
    positive: "bg-positive",
    warn: "bg-warn",
    danger: "bg-danger",
    accent: "bg-accent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[14px] font-medium leading-4",
        toneClass[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} /> : null}
      {label}
    </span>
  );
}

/* ------------------------------- Money & addr ------------------------------- */

export function AmountDisplay({
  base,
  symbol = TOKEN.symbol,
  className,
  signed,
  prefix,
  precision,
}: {
  base: string;
  symbol?: string | null;
  className?: string;
  signed?: boolean;
  prefix?: string;
  precision?: number;
}) {
  return (
    <span className={cn("tnum font-semibold text-ink", className)}>
      {prefix}
      {signed && !base.startsWith("-") ? "+" : ""}
      {fmtAmount(base, { precision })}
      {symbol ? <span className="ml-1 font-medium text-ink-3">{symbol}</span> : null}
    </span>
  );
}

export function AddressDisplay({
  address,
  href,
  className,
  full,
  label,
}: {
  address?: string | null;
  href?: string;
  className?: string;
  full?: boolean;
  label?: string;
}) {
  if (!address) return <span className="text-ink-4">—</span>;
  const text = full ? address : truncateMiddle(address);
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <code className="min-w-0 break-all font-mono text-[18px] text-ink-2">{text}</code>
      <CopyButton value={address} label={label ?? "Copy"} size="xs" />
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-ink-3 hover:text-accent">
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </span>
  );
}

/** Demo transaction reference with an explicit "not on-chain" treatment. */
export function TxRefDisplay({
  value,
  className,
  size = "sm",
}: {
  value?: string | null;
  className?: string;
  size?: "sm" | "xs";
}) {
  if (!value) return <span className="text-ink-4">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title="Demo reference — not an on-chain transaction hash">
      <code className="font-mono text-[16px] text-ink-2">{truncateMiddle(value, 14, 8)}</code>
      <CopyButton value={value} label="Copy" size={size} />
    </span>
  );
}

export function ExplorerLinkPlaceholder({ txRef }: { txRef?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 text-[16px] font-medium text-accent hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        View transaction
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-[rgba(27,31,30,0.32)]" />
          <div
            className="relative z-10 w-full max-w-md rounded-[10px] border border-line bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[20px] font-semibold text-ink">Explorer links are not available</h3>
            <p className="mt-2 text-[18px] leading-relaxed text-ink-3">
              This is a frontend demo. The reference <code className="font-mono">{txRef ?? "—"}</code> is a
              simulated value produced by the mock service layer. No transaction was broadcast to
              Whitechain Sepolia and there is no on-chain record to inspect.
            </p>
            <p className="mt-2 text-[18px] leading-relaxed text-ink-3">
              Explorer deep links will be enabled once the backend and indexer integration exists.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 h-8 rounded-md border border-line-strong bg-surface px-3 text-[18px] font-medium text-ink hover:bg-canvas-alt"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------- Timeline -------------------------------- */

export function Timeline({
  entries,
  compact,
}: {
  entries: TimelineEntry[];
  compact?: boolean;
}) {
  return (
    <ol className="relative">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        return (
          <li key={`${entry.label}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className={cn(
                  "absolute left-[5px] top-4 h-full w-px",
                  entry.state === "todo" ? "bg-line" : "bg-line-strong",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-colors",
                entry.state === "done"
                  ? "border-accent bg-accent"
                  : entry.state === "current"
                    ? "anim-pulse-soft border-accent bg-surface ring-4 ring-accent/15"
                    : "border-line-strong bg-surface",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className={cn(
                    "text-[18px] font-medium",
                    entry.state === "todo" ? "text-ink-4" : "text-ink",
                  )}
                >
                  {entry.label}
                </p>
                {entry.simulated ? (
                  <span className="rounded border border-warn-line bg-warn-soft px-1 py-px text-[14px] font-semibold uppercase tracking-wide text-warn">
                    simulated
                  </span>
                ) : null}
              </div>
              {entry.detail ? (
                <p className={cn("text-[18px] leading-relaxed text-ink-3", compact && "line-clamp-2")}>{entry.detail}</p>
              ) : null}
              {entry.at ? (
                <p className="mt-0.5 text-[16px] text-ink-4 tnum">
                  {new Date(entry.at).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------ PayeeShield chip ---------------------------- */

export function PayeeShieldChip({ record }: { record: PayeeShieldRecord | null }) {
  if (!record) {
    return <StatusBadge label="Not signed" tone="neutral" />;
  }
  const tone = PAYEEESHIELD_TONES[record.status];
  return (
    <StatusBadge
      tone={tone}
      label={
        <span className="inline-flex items-center gap-1">
          {tone === "positive" ? <ShieldCheck className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
          PayeeShield {record.status === "verified" ? "verified" : record.status.replace(/_/g, " ")}
        </span>
      }
    />
  );
}

/* -------------------------------- CodeBlock --------------------------------- */

export function CodeBlock({
  code,
  language = "bash",
  caption,
  filename,
  dense = false,
}: {
  code: string;
  language?: string;
  caption?: string;
  filename?: string;
  /** Compact 14px variant for marketing pages (default 16px suits the dashboard). */
  dense?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-[10px] border border-line bg-[#fbfaf8] shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-1.5">
        <span className={cn("font-mono text-ink-3", dense ? "text-[13px]" : "text-[16px]")}>{filename ?? language}</span>
        <CopyButton value={code} label="Copy" size="xs" />
      </div>
      <pre className={cn("overflow-x-auto px-3.5 py-3 leading-relaxed scroll-thin", dense ? "text-[14px]" : "text-[16px]")}>
        <code className="font-mono text-ink-2">{code}</code>
      </pre>
      {caption ? <figcaption className={cn("border-t border-line px-3.5 py-2 text-ink-4", dense ? "text-[13px]" : "text-[16px]")}>{caption}</figcaption> : null}
    </figure>
  );
}
