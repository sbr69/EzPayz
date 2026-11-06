import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <section className="site-width pb-20">
      <div className="page-heading">
        <p className="eyebrow">404 / Page unavailable</p>
        <h1 className="display">A little <em>lost.</em></h1>
        <p>We couldn’t find that page.</p>
      </div>
      <Link href="/items" className="text-link">Browse the collection <ArrowRight size={16} aria-hidden /></Link>
    </section>
  );
}
