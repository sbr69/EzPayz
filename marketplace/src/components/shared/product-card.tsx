import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import * as motion from "motion/react-client";
import { formatUsdt } from "@/features/storefront/cart";
import type { Product } from "@/lib/server/schema";
import { AddToCartButton } from "./add-to-cart-button";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <motion.article className="product-tile" layout="position" initial={{ opacity: 0.75, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }}
      transition={{ type: "tween", duration: 0.48, delay: (index % 4) * 0.065, ease: [0.22, 1, 0.36, 1] }}>
      <Link href={`/items/${product.slug}`} className="product-media" aria-label={product.name}>
        <Image src={product.image} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 25vw" className="object-cover" />
        <span className="product-peek" aria-hidden="true">View item <ArrowUpRight size={14} /></span>
      </Link>
      <div className="product-meta">
        <p className="eyebrow">{product.category}</p>
        <h3><Link href={`/items/${product.slug}`}>{product.name}</Link></h3>
        <div className="product-actions">
          <p className="product-price">{formatUsdt(product.price)}</p>
          <AddToCartButton slug={product.slug} name={product.name} compact />
        </div>
      </div>
    </motion.article>
  );
}
