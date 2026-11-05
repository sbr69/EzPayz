import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

/* ---------------------------------- Button --------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover disabled:bg-accent/50 disabled:border-accent/50",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-canvas-alt disabled:text-ink-4",
  outline: "bg-transparent text-ink border border-line-strong hover:bg-surface",
  ghost: "bg-transparent text-ink-2 border border-transparent hover:bg-canvas-alt hover:text-ink",
  danger: "bg-danger text-white border border-danger hover:brightness-95",
  subtle: "bg-accent-soft text-accent border border-accent-line hover:bg-accent-soft/70",
};

const sizes: Record<Size, string> = {
  sm: "h-12 px-5 text-[17px] gap-2 rounded-lg",
  md: "h-12 px-5 text-[17px] gap-2.5 rounded-lg",
  lg: "h-14 px-7 text-[18px] gap-2.5 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none",
        "disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-ink-3 transition-colors",
        "hover:border-line hover:bg-surface hover:text-ink disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      className={cn(
        "rounded-[10px] border border-line bg-surface shadow-[0_1px_2px_rgba(27,31,30,0.04)]",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {description ? <p className="mt-1 text-[16px] text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

/* ---------------------------------- Fields --------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-[15px] font-medium text-ink-2">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[15px] font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[15px] leading-relaxed text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full rounded-lg border bg-surface px-4 text-[17px] text-ink placeholder:text-ink-4 transition-colors " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-canvas-alt disabled:text-ink-4";

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "h-12", invalid ? "border-danger" : "border-line-strong", className)}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-[84px] py-2 leading-relaxed", invalid ? "border-danger" : "border-line-strong", className)}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn(controlBase, "h-12 cursor-pointer appearance-none border-line-strong bg-[right_0.75rem_center] bg-no-repeat pr-10", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7470' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5", disabled && "cursor-not-allowed opacity-60", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong text-accent accent-[#0d7a6f]"
      />
      <span className="min-w-0">
        <span className="block text-[17px] font-medium text-ink">{label}</span>
        {description ? <span className="block text-[16px] leading-relaxed text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-accent bg-accent" : "border-line-strong bg-canvas-alt",
      )}
    >
      <span
        className={cn(
          "absolute h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[19px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

/* --------------------------------- Layout ---------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {breadcrumbs?.length ? (
        <nav className="mb-2 flex items-center gap-1.5 text-[15px] text-ink-3">
          {breadcrumbs.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1.5">
              {b.to ? (
                <a href={`#${b.to}`} className="hover:text-ink hover:underline">
                  {b.label}
                </a>
              ) : (
                <span className="text-ink-4">{b.label}</span>
              )}
              {i < breadcrumbs.length - 1 ? <span className="text-line-strong">/</span> : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-[17px] leading-relaxed text-ink-3">{description}</p> : null}
          {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line scroll-thin">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[17px] font-medium transition-colors",
            value === t.id
              ? "border-accent text-ink"
              : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
          )}
        >
          {t.label}
          {typeof t.count === "number" ? (
            <span className="ml-1.5 rounded bg-canvas-alt px-1.5 py-0.5 text-[13px] text-ink-3 tnum">{t.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "warn" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-canvas-alt text-ink-3 border-line",
    accent: "bg-accent-soft text-accent border-accent-line",
    positive: "bg-positive-soft text-positive border-positive-line",
    warn: "bg-warn-soft text-warn border-warn-line",
    danger: "bg-danger-soft text-danger border-danger-line",
    info: "bg-info-soft text-info border-info-line",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[15px] font-medium leading-5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "positive" | "neutral";
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-soft border-info-line text-info",
    warn: "bg-warn-soft border-warn-line text-warn",
    danger: "bg-danger-soft border-danger-line text-danger",
    positive: "bg-positive-soft border-positive-line text-positive",
    neutral: "bg-canvas-alt border-line text-ink-3",
  } as const;
  return (
    <div className={cn("rounded-md border px-3.5 py-3", tones[tone], className)}>
      <div className="flex gap-2.5">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0 space-y-1">
          {title ? <p className="text-[16px] font-semibold">{title}</p> : null}
          {children ? <div className="text-[15px] leading-relaxed opacity-90">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

export function KeyValue({
  label,
  children,
  className,
  copy,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  copy?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2", className)}>
      <dt className="shrink-0 text-[16px] text-ink-3">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right text-[16px] font-medium text-ink">
        <span className="min-w-0 break-words">{children}</span>
        {copy}
      </dd>
    </div>
  );
}

export function SectionTitle({
  children,
  description,
  actions,
  className,
}: {
  children: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
        {description ? <p className="mt-1 text-[16px] text-ink-3">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <p className="text-[15px] font-medium uppercase tracking-wide text-ink-4">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold text-ink tnum">{value}</p>
      {sub ? <p className="text-[16px] text-ink-3">{sub}</p> : null}
    </div>
  );
}
