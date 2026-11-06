import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { listProducts } from "@/lib/server/store";
import { CatalogView } from "@/features/storefront/catalog-view";

export const revalidate = 60;

interface ItemsPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const { category } = await searchParams;
  const products = await listProducts();

  return (
    <div className="site-width pb-20">
      <div className="page-heading">
        <p className="eyebrow">Collection / 01</p>
        <h1 className="display">The <em>collection.</em></h1>
        <p>{products.length} pieces for the home. Every item is under 10 USDT.</p>
      </div>
      <aside className="catalog-chat" aria-label="Shopping help">
        <div className="catalog-chat-copy">
          <MessageCircle size={22} aria-hidden />
          <div>
            <h2>Looking for something specific?</h2>
            <p>Describe what you need and we’ll suggest items from the collection.</p>
          </div>
        </div>
        <Link href="/x402" className="action action-green">Open shop chat <ArrowRight size={16} aria-hidden /></Link>
      </aside>
      <CatalogView products={products} initialCategory={category} />
    </div>
  );
}
