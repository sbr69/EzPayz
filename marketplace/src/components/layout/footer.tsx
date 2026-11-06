import Link from "next/link";
import { ShopWordmark } from "./shop-wordmark";

export function Footer() {
  return (
    <footer className="store-footer">
      <div className="site-width footer-inner">
        <div>
          <ShopWordmark />
          <p>Home goods and everyday objects.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/items">Collection</Link>
          <Link href="/cart">Bag</Link>
          <Link href="/x402">Agent payments</Link>
        </nav>
      </div>
    </footer>
  );
}
