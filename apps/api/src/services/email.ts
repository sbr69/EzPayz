import { Prisma } from "../db/generated";
import { prisma } from "../db/client";
import { getEmailQueue } from "../queues";

/**
 * Email stub: logs to EmailLog + enqueues a "send" job. The worker marks it sent
 * (no real SMTP in MVP). PRD §13.3, FLOW §14.3 — email failure never reverses settlement.
 */
export async function enqueueEmail(opts: {
  merchantId: string;
  to: string;
  template: string;
  subject: string;
  body: Record<string, unknown>;
  relatedPaymentId?: string;
}) {
  const log = await prisma.emailLog.create({
    data: {
      merchantId: opts.merchantId,
      toAddress: opts.to,
      template: opts.template,
      subject: opts.subject,
      bodyJson: opts.body as unknown as Prisma.InputJsonValue,
      status: "queued",
      relatedPaymentId: opts.relatedPaymentId,
    },
  });
  await getEmailQueue().add("send", { emailLogId: log.id }, { jobId: log.id });
  return log;
}

export async function processEmail(emailLogId: string): Promise<void> {
  const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!log) return;
  await prisma.emailLog.update({ where: { id: emailLogId }, data: { status: "sent", sentAt: new Date() } });
}
