import { prisma } from "../db/client";
import type { ExceptionType, ExceptionSeverity } from "../db/generated";

/** Records a payment exception (underpaid/overpaid/duplicate/failed/etc.). PRD §15, FLOW §13. */
export async function recordException(opts: {
  merchantId: string;
  type: ExceptionType;
  severity?: ExceptionSeverity;
  paymentId?: string;
  whatHappened: string;
  whyItHappened?: string;
  suggestedAction?: string;
}) {
  return prisma.paymentException.create({
    data: {
      merchantId: opts.merchantId,
      type: opts.type,
      severity: opts.severity ?? "medium",
      status: "open",
      paymentId: opts.paymentId,
      whatHappened: opts.whatHappened,
      whyItHappened: opts.whyItHappened ?? "",
      suggestedAction: opts.suggestedAction ?? "",
    },
  });
}
