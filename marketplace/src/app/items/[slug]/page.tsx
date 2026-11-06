import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUsdt } from "@/features/storefront/cart";
import { ProductPurchaseBox } from "@/features/storefront/product-purchase-box";
import { getProduct, listProducts } from "@/lib/server/store";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await listProducts()).map(({ slug }) => ({ slug }));
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <section className="site-width pb-20">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 py-5 text-xs text-[#565A64]">
        <Link href="/items" className="underline underline-offset-4">Collection</Link>
        <span aria-hidden>/</span>
        <span>{product.name}</span>
      </nav>
      <div className="grid items-start gap-8 md:grid-cols-[1.16fr_1fr] lg:gap-16">
        <figure className="product-media">
          <Image src={product.image} alt={product.name} fill preload sizes="(max-width: 768px) 100vw, 55vw" className="object-cover" />
        </figure>
        <div className="md:pt-9">
          <p className="eyebrow">{product.category}</p>
          <h1 className="display mt-4 text-[length:var(--type-page)]">{product.name}</h1>
          <p className="mt-5 text-lg font-medium tabular-nums">{formatUsdt(product.price)}</p>
          <p className="my-7 max-w-[40ch] text-base leading-relaxed text-[#565A64]">{product.description}</p>
          <ProductPurchaseBox slug={product.slug} name={product.name} />
          <p className="mt-6 border-t border-[#D6CCBD] pt-4 text-xs text-[#565A64]">Test USDT · Whitechain Sepolia</p>
        </div>
      </div>
    </section>
  );
}
