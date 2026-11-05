import type { PrismaClient } from "../generated";

/**
 * Base repository enforcing merchant-level tenant isolation.
 *
 * Every merchant-owned query MUST scope by merchantId. This base class holds the
 * authenticated merchantId and rejects construction without one, so a repository
 * cannot be instantiated for an unauthenticated / cross-tenant request.
 *
 * PRD §8.3, §23.1: "Merchant A cannot retrieve Merchant B customer data or payments."
 */
export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaClient, protected readonly merchantId: string) {
    if (!merchantId || merchantId.length === 0) {
      throw new Error("BaseRepository requires a merchantId (tenant isolation enforced)");
    }
  }

  /** The tenant filter applied to every merchant-owned findMany/findFirst/where. */
  protected get tenant(): { merchantId: string } {
    return { merchantId: this.merchantId };
  }
}
