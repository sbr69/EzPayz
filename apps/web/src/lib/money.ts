import { DEMO, TOKEN } from "@/config/app";
import type { BaseAmount } from "@/types";

/* ------------------------------------------------------------------ */
/* Base-unit money maths (no floating point in transfer logic)          */
/* ------------------------------------------------------------------ */

export const ZERO: BaseAmount = "0";

export function toBase(displayAmount: string, decimals: number | null = TOKEN.decimals): BaseAmount {
  const cleaned = (displayAmount || "").trim().replace(/,/g, "");
  if (!/^\d*(\.\d*)?$/.test(cleaned)) return ZERO;
  const dec = decimals ?? 0;
  const [whole = "0", frac = ""] = cleaned.split(".");
  const padded = (frac + "0".repeat(dec)).slice(0, dec);
  const base = `${whole || "0"}${padded}`;
  return base.replace(/^0+(?=\d)/, "") || "0";
}

export function fromBase(base: BaseAmount, decimals: number | null = TOKEN.decimals): string {
  const dec = decimals ?? 0;
  const negative = base.startsWith("-");
  const abs = negative ? base.slice(1) : base;
  if (dec === 0) return negative ? `-${abs}` : abs;
  const padded = abs.padStart(dec + 1, "0");
  const whole = padded.slice(0, padded.length - dec);
  let frac = padded.slice(padded.length - dec);
  if (TOKEN.displayPrecision > 0 && frac.length > TOKEN.displayPrecision) {
    frac = frac.slice(0, TOKEN.displayPrecision);
  }
  const trimmed = frac.replace(/0+$/, "");
  const out = trimmed ? `${whole}.${trimmed}` : whole;
  return negative ? `-${out}` : out;
}

export function addBase(a: BaseAmount, b: BaseAmount): BaseAmount {
  return (BigInt(a || "0") + BigInt(b || "0")).toString();
}

export function subBase(a: BaseAmount, b: BaseAmount): BaseAmount {
  return (BigInt(a || "0") - BigInt(b || "0")).toString();
}

export function cmpBase(a: BaseAmount, b: BaseAmount): number {
  const x = BigInt(a || "0");
  const y = BigInt(b || "0");
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isPositive(a: BaseAmount): boolean {
  return cmpBase(a, ZERO) > 0;
}

export function mulBaseInt(a: BaseAmount, factor: number): BaseAmount {
  return (BigInt(a || "0") * BigInt(factor)).toString();
}

/** Sum a list of base amounts. */
export function sumBase(list: BaseAmount[]): BaseAmount {
  return list.reduce((acc, v) => addBase(acc, v), ZERO);
}

/** Percentage of total, returned as a display string (used for charts only). */
export function ratio(part: BaseAmount, total: BaseAmount): number {
  if (!total || BigInt(total) === 0n) return 0;
  const p = BigInt(part) * 10000n;
  return Number(p / BigInt(total)) / 100;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function fmtAmount(base: BaseAmount, opts?: { symbol?: string; precision?: number }): string {
  const value = fromBase(base);
  const precision = opts?.precision ?? TOKEN.displayPrecision;
  const [whole, frac] = value.split(".");
  const grouped = (whole || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracOut = precision > 0 ? `.${(frac ?? "").padEnd(precision, "0").slice(0, precision)}` : "";
  return `${grouped}${fracOut}`;
}

export function fmtUsd(base: BaseAmount, symbol = TOKEN.symbol): string {
  return `${fmtAmount(base)} ${symbol}`;
}

export function fmtCompact(base: BaseAmount, symbol = TOKEN.symbol): string {
  const n = Number(fromBase(base));
  const abs = Math.abs(n);
  let out: string;
  if (abs >= 1_000_000) out = `${(n / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) out = `${(n / 1_000).toFixed(2)}K`;
  else out = n.toFixed(2);
  // Empty symbol → compact number only (used for chart axis ticks, which have no room for units).
  return symbol ? `${out} ${symbol}` : out;
}

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

export function untilFuture(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (!value) return "—";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function shortId(prefix: string, n = 10): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 2 + n)}`;
}

/** Demo transaction reference. Deliberately NOT a real on-chain hash. */
export function demoTxRef(): string {
  return `${DEMO.txPrefix}-${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function demoAuthRef(): string {
  return `${DEMO.authPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function pseudoDigest(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `sig_${h.toString(16).padStart(8, "0")}${((h >>> 7) % 0xffff).toString(16)}`;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test((value || "").trim());
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || "").trim());
}

export function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateAmount(
  value: string,
  { min, max }: { min?: string; max?: string } = {},
): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return "Amount is required";
  if (!/^\d*(\.\d*)?$/.test(trimmed)) return "Enter a valid amount";
  if (Number(trimmed) === 0) return "Amount must be greater than zero";
  if (Number(trimmed) > 1_000_000) return "Amount exceeds the demo limit of 1,000,000 USDT";
  const base = toBase(trimmed);
  if (min && cmpBase(base, min) < 0) return `Minimum amount is ${fmtAmount(min)} ${TOKEN.symbol}`;
  if (max && cmpBase(base, max) > 0) return `Maximum amount is ${fmtAmount(max)} ${TOKEN.symbol}`;
  return null;
}

export function dateAfter(value: string, compare: Date): boolean {
  if (!value) return false;
  return new Date(value).getTime() > compare.getTime();
}

export function toLocalInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
