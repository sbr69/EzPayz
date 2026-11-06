import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, MessageCircle } from "lucide-react";
import { ProductCard } from "@/components/shared/product-card";
import { listProducts } from "@/lib/server/store";

export const revalidate = 60;

export default async function HomePage() {
  const products = await listProducts();
  const categories = [...new Set(products.map((product) => product.category))];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sill &amp; Shelf <span> / </span> Collection 01</p>
          <h1 className="display">Good things<br /><span>for <em>everyday</em></span><br />living.</h1>
          <p className="hero-intro">Ceramics, textiles and small comforts for the spaces you spend time in.</p>
          <div className="hero-actions">
            <Link href="/items" className="action action-gold">Shop the collection <ArrowRight size={17} aria-hidden /></Link>
            <Link href="/x402" className="action action-chat"><MessageCircle size={17} aria-hidden /> Shop with chat</Link>
          </div>
          <a className="hero-index" href="#collection"><ArrowDown size={14} aria-hidden /> Scroll to the edit</a>
        </div>
        <figure className="hero-image">
          <Image src="/images/collection.webp" alt="A warmly lit collection of home objects and textiles" fill preload sizes="(max-width: 800px) 100vw, 55vw" />
          <figcaption><span>01 / Collection</span><span>At home</span></figcaption>
        </figure>
      </section>

      <section className="site-width collection-section" id="collection">
        <div className="section-heading">
          <div><p className="eyebrow">The edit / 01</p><h2 className="display">Objects to <em>keep.</em></h2></div>
          <Link href="/items" className="text-link">View all items <ArrowRight size={16} aria-hidden /></Link>
        </div>
        {categories.length > 0 && <nav className="category-index" aria-label="Shop by category">
          {categories.map((category) => <Link key={category} href={{ pathname: "/items", query: { category } }}>{category}</Link>)}
        </nav>}
        {products.length ? <div className="product-grid">
          {products.slice(0, 4).map((product, index) => <ProductCard key={product.slug} product={product} index={index} />)}
        </div> : <p className="py-12 text-sm">The catalog is currently empty.</p>}
      </section>

      <section className="payment-note">
        <div className="site-width payment-note-inner">
          <p className="eyebrow">Behind the checkout / 02</p>
          <div><h2 className="display">Pay in <em>USDT.</em></h2><p>We use EzPayz to accept test USDT on Whitechain Sepolia.</p></div>
        </div>
      </section>
    </>
  );
}
