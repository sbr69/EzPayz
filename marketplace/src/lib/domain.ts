export type CartItem = { slug: string; quantity: number };
export type PricedProduct = { slug: string; name: string; price: number };

export function isItemPrice(price: number) {
  return Number.isSafeInteger(price) && price > 0 && price < 10_000_000;
}

export function validateCart(value: unknown): CartItem[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw new Error("Invalid cart");
  const slugs = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
        || item.slug.length > 80 || slugs.has(item.slug)
        || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error("Invalid cart");
    }
    slugs.add(item.slug);
    return { slug: item.slug, quantity: item.quantity };
  });
}

export function priceCart(items: CartItem[], products: PricedProduct[]) {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const lines = items.map(({ slug, quantity }) => {
    const product = bySlug.get(slug);
    if (!product || !isItemPrice(product.price)) throw new Error("An item is unavailable");
    return { productSlug: slug, name: product.name, unitPrice: product.price, quantity };
  });
  return { total: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), lines };
}
