/**
 * Amount conversion utilities.
 *
 * The public REST API and SDK accept human-readable decimal amounts (e.g. "10.00")
 * at the input boundary. Internally (DB, on-chain, EIP-3009 signatures) all amounts
 * are base-unit integer strings (USDT has 6 decimals → "10000000" for 10 USDT).
 *
 * The conversion happens at the route boundary, BEFORE the value reaches the service
 * layer or the database. EIP-3009 authorization `value` fields are NEVER converted —
 * they are cryptographically bound to the contract's base-unit representation.
 *
 * PRD §7.2, §17.6 — human-readable public API; base units internally.
 */

export const USDT_DECIMALS = 6;

const HUMAN_AMOUNT_RE = /^\d+(\.\d+)?$/;

/**
 * Parses a human-readable decimal amount string into a base-unit integer string.
 * @example parseHumanAmount("10.00", 6) → "10000000"
 * @example parseHumanAmount("0.01", 6)  → "10000"
 * @example parseHumanAmount("10", 6)    → "10000000"
 * @throws if the input is not a valid non-negative decimal with ≤ `decimals` fractional digits.
 */
export function parseHumanAmount(input: string, decimals: number = USDT_DECIMALS): string {
  if (typeof input !== "string" || !HUMAN_AMOUNT_RE.test(input)) {
    throw { statusCode: 400, code: "invalid_amount", message: `Amount must be a decimal string like "10.00" (got "${input}")` };
  }
  const [intPart, fracPart = ""] = input.split(".");
  if (fracPart.length > decimals) {
    throw { statusCode: 400, code: "invalid_amount", message: `Amount has more than ${decimals} decimal places (got "${input}")` };
  }
  const factor = 10n ** BigInt(decimals);
  const intUnits = BigInt(intPart) * factor;
  const fracPadded = fracPart.padEnd(decimals, "0");
  const fracUnits = fracPadded === "" ? 0n : BigInt(fracPadded);
  const total = intUnits + fracUnits;
  if (total === 0n) {
    throw { statusCode: 400, code: "invalid_amount", message: "Amount must be greater than zero" };
  }
  return total.toString();
}

/**
 * Formats a base-unit integer string as a human-readable decimal string (2 decimal places for display).
 * @example formatBaseUnits("10000000", 6) → "10.00"
 * @example formatBaseUnits("10000", 6)    → "0.01"
 */
export function formatBaseUnits(baseUnits: string, decimals: number = USDT_DECIMALS): string {
  const v = BigInt(baseUnits || "0");
  const factor = 10n ** BigInt(decimals);
  const intPart = v / factor;
  const fracPart = v % factor;
  const fracStr = fracPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr.length === 0 ? `${intPart}.00` : `${intPart}.${fracStr.length < 2 ? fracStr.padEnd(2, "0") : fracStr}`;
}

/** Zod-friendly human amount schema (accepts decimals, rejects negatives/scientific notation). */
export const humanAmountSchema = (decimals: number = USDT_DECIMALS) => {
  const re = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/;
  return {
    validate: (val: string): true | string => {
      if (typeof val !== "string" || !re.test(val)) {
        return `Amount must be a decimal string with at most ${decimals} decimal places (e.g. "10.00")`;
      }
      return true;
    },
  };
};
