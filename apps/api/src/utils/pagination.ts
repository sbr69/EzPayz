/**
 * Cursor-based pagination helpers — mirrors Stripe's pagination model.
 * Usage: ?limit=20&cursor=<lastItemIdFromPreviousPage>
 * Response: { data: [...], hasMore: boolean, nextCursor: string | null }
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export interface PaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawLimit = Number(query.limit ?? DEFAULT_PAGE_LIMIT);
  const limit = Math.min(Math.max(1, rawLimit || DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
  const cursor = typeof query.cursor === "string" && query.cursor.length > 0 ? query.cursor : undefined;
  return { limit, cursor };
}

/**
 * Builds Prisma findMany args for cursor pagination.
 * Pass the result into `prisma.model.findMany({ ...args, where, orderBy, include })`.
 */
export function cursorPrismaArgs(params: PaginationParams, orderByField: string = "createdAt") {
  return {
    take: params.limit + 1, // fetch one extra to determine hasMore
    ...(params.cursor
      ? { skip: 1, cursor: { id: params.cursor } }
      : {}),
    orderBy: { [orderByField]: "desc" as const },
  };
}

/**
 * Converts the raw query results (+1 fetched) into a paginated response.
 */
export function paginate<T extends { id: string }>(items: T[], limit: number): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;
  return { data, hasMore, nextCursor };
}
