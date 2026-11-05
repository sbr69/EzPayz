import type { Merchant, Prisma, PrismaClient } from "../generated";
import { BaseRepository } from "./base";

/**
 * Merchant is the tenant root. The authenticated merchantId IS the merchant's own id,
 * so reads/writes are scoped to that single record — a request for another merchant's
 * record returns null (isolated).
 */
export class MerchantRepository extends BaseRepository {
  async me(): Promise<Merchant | null> {
    return this.prisma.merchant.findUnique({ where: { id: this.merchantId } });
  }

  async update(data: Prisma.MerchantUpdateInput): Promise<Merchant> {
    // findUnique by id; only the authenticated merchant can update itself.
    return this.prisma.merchant.update({ where: { id: this.merchantId }, data });
  }

  /** Used by auth (register) — not tenant-scoped (creates a new tenant root). */
  static async create(prisma: PrismaClient, data: Prisma.MerchantCreateInput): Promise<Merchant> {
    return prisma.merchant.create({ data });
  }

  static async findByEmail(prisma: PrismaClient, businessEmail: string): Promise<Merchant | null> {
    return prisma.merchant.findUnique({ where: { businessEmail } });
  }
}
