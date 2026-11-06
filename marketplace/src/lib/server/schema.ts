import { bigint, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const products = pgTable("marketplace_products", {
  slug: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
  category: text().notNull(),
  image: text().notNull(),
  price: integer().notNull(),
});

export const orders = pgTable("marketplace_orders", {
  id: uuid().primaryKey(),
  total: bigint({ mode: "number" }).notNull(),
  status: text().$type<"pending" | "creating" | "review" | "paid" | "fulfilled">().notNull().default("pending"),
  paymentId: text("payment_id").unique(),
  checkoutUrl: text("checkout_url"),
  txRef: text("tx_ref"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
});

export const orderLines = pgTable("marketplace_order_lines", {
  orderId: uuid("order_id").notNull().references(() => orders.id),
  productSlug: text("product_slug").notNull(),
  name: text().notNull(),
  quantity: integer().notNull(),
  unitPrice: integer("unit_price").notNull(),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLine = typeof orderLines.$inferSelect;
