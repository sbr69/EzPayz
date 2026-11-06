import Link from "next/link";

export function ShopWordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Sill and Shelf home">
      <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M8 35h32M13 30v-3a11 11 0 0 1 22 0v3M24 8v5M9 17l4 4m26-4-4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
      Sill &amp; Shelf
    </Link>
  );
}
