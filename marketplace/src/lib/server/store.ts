import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { priceCart, validateCart, type CartItem } from "../domain";
import { getDb } from "./db";
import { orderLines, orders, products, type Product } from "./schema";
import fallbackCatalog from "../../../db/catalog.json";

const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function listProducts(): Promise<Product[]> {
  if (!process.env.DATABASE_URL) {
    return fallbackCatalog as Product[];
  }
  return getDb().select().from(products).orderBy(asc(products.slug));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  if (!process.env.DATABASE_URL) {
    return (fallbackCatalog as Product[]).find((p) => p.slug === slug);
  }
  const [product] = await getDb().select().from(products).where(eq(products.slug, slug));
  return product;
}

export type CreateOrderInput =
  | CartItem[]
  | {
      items: unknown;
      customerName?: unknown;
      customerEmail?: unknown;
    };

export async function createOrder(input: unknown) {
  let itemsInput: unknown;
  let customerName: string | undefined;
  let customerEmail: string | undefined;

  if (Array.isArray(input)) {
    itemsInput = input;
  } else if (input && typeof input === "object" && "items" in input) {
    const obj = input as { items: unknown; customerName?: unknown; customerEmail?: unknown };
    itemsInput = obj.items;
    if (typeof obj.customerName === "string" && obj.customerName.trim().length > 0) {
      customerName = obj.customerName.trim().slice(0, 100);
    }
    if (typeof obj.customerEmail === "string" && obj.customerEmail.trim().length > 0) {
      customerEmail = obj.customerEmail.trim().slice(0, 100);
    }
  } else {
    itemsInput = input;
  }

  const items = validateCart(itemsInput);
  const db = getDb();

  const catalog = await db.select().from(products).where(inArray(products.slug, items.map((item) => item.slug)));
  const { total, lines } = priceCart(items, catalog);
  const id = randomUUID();

  await db.batch([
    db.insert(orders).values({
      id,
      total,
      customerName: customerName ?? null,
      customerEmail: customerEmail ?? null,
    }),
    db.insert(orderLines).values(lines.map((line) => ({ ...line, orderId: id }))),
  ]);

  return { id };
}

export async function getOrder(id: string) {
  if (!uuidPattern.test(id) || !process.env.DATABASE_URL) return undefined;
  const db = getDb();
  const [[order], lines] = await db.batch([
    db.select().from(orders).where(eq(orders.id, id)),
    db.select().from(orderLines).where(eq(orderLines.orderId, id)).orderBy(asc(orderLines.productSlug)),
  ]);
  return order ? { ...order, lines } : undefined;
}

export async function listOrders() {
  if (!process.env.DATABASE_URL) return [];
  return getDb().select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id));
}

export async function getOrderByPaymentId(paymentId: string) {
  if (!process.env.DATABASE_URL) return undefined;
  const [order] = await getDb().select().from(orders).where(eq(orders.paymentId, paymentId));
  return order;
}

export async function claimCheckout(id: string) {
  if (!process.env.DATABASE_URL) return false;
  const [claimed] = await getDb()
    .update(orders)
    .set({ status: "creating" })
    .where(and(eq(orders.id, id), eq(orders.status, "pending"), isNull(orders.paymentId)))
    .returning({ id: orders.id });
  return Boolean(claimed);
}

export async function saveCheckout(id: string, paymentId: string, checkoutUrl: string) {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  const [saved] = await getDb()
    .update(orders)
    .set({ paymentId, checkoutUrl, status: "pending" })
    .where(and(eq(orders.id, id), eq(orders.status, "creating")))
    .returning({ id: orders.id });
  if (!saved) throw new Error("Checkout claim is unavailable");
}

export async function reviewCheckout(id: string) {
  if (!process.env.DATABASE_URL) return;
  await getDb()
    .update(orders)
    .set({ status: "review" })
    .where(and(eq(orders.id, id), eq(orders.status, "creating")));
}

export async function markPaid(id: string, paymentId: string, txRef: string) {
  if (!process.env.DATABASE_URL) return false;
  const [paid] = await getDb()
    .update(orders)
    .set({ status: "paid", txRef })
    .where(and(eq(orders.id, id), eq(orders.paymentId, paymentId), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  return Boolean(paid);
}

export async function markFulfilled(id: string) {
  if (!uuidPattern.test(id) || !process.env.DATABASE_URL) return false;
  const [fulfilled] = await getDb()
    .update(orders)
    .set({ status: "fulfilled", fulfilledAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.status, "paid")))
    .returning({ id: orders.id });
  return Boolean(fulfilled);
}
