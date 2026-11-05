import type { PaymentIntent, PaymentStatus, Prisma } from "../generated";
import { BaseRepository } from "./base";

/**
 * PaymentIntent repository — every query scoped by merchantId (tenant isolation).
 * The create path forces merchantId to the authenticated merchant.
 */
export class PaymentIntentRepository extends BaseRepository {
  async create(data: Omit<Prisma.PaymentIntentCreateInput, "merchantId">): Promise<PaymentIntent> {
    return this.prisma.paymentIntent.create({
      data: { ...data, merchantId: this.merchantId },
      include: { timeline: true },
    });
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    // findFirst with tenant filter — a cross-merchant id returns null (isolated).
    return this.prisma.paymentIntent.findFirst({
      where: { id, ...this.tenant },
      include: { timeline: { orderBy: { at: "asc" } } },
    });
  }

  async list(params: { status?: PaymentStatus; cursor?: string; limit?: number } = {}): Promise<PaymentIntent[]> {
    return this.prisma.paymentIntent.findMany({
      where: { ...this.tenant, ...(params.status ? { status: params.status } : {}) },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 20,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  async updateStatus(id: string, status: PaymentStatus, patch: Partial<Prisma.PaymentIntentUncheckedUpdateManyInput> = {}): Promise<PaymentIntent> {
    // updateMany enforces the tenant filter; count===0 means not-found or cross-tenant.
    const res = await this.prisma.paymentIntent.updateMany({
      where: { id, ...this.tenant },
      data: { status, ...patch },
    });
    if (res.count === 0) throw new Error(`PaymentIntent ${id} not found for this merchant`);
    return this.findById(id) as Promise<PaymentIntent>;
  }

  async addTimelineEntry(
    id: string,
    entry: { status: string; label: string; detail?: string; simulated?: boolean },
  ): Promise<void> {
    // Verify ownership before writing a child record.
    const owned = await this.prisma.paymentIntent.findFirst({
      where: { id, ...this.tenant },
      select: { id: true },
    });
    if (!owned) throw new Error(`PaymentIntent ${id} not found for this merchant`);
    await this.prisma.paymentTimelineEntry.create({
      data: { paymentId: id, ...entry },
    });
  }
}
