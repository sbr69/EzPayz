"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { motion } from "motion/react";
import { ProductCard } from "@/components/shared/product-card";
import type { Product } from "@/lib/server/schema";

interface CatalogViewProps {
  products: Product[];
  initialCategory?: string;
}

export function CatalogView({ products, initialCategory }: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.category)));
    return ["All", ...list];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All" || product.category.toLowerCase() === selectedCategory.toLowerCase();
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-8">
      {/* Search and Filters Bar */}
      <div className="catalog-tools">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            aria-label="Search collection"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search the collection"
            className="w-full py-2 pl-10 pr-10 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="catalog-filters" role="group" aria-label="Filter by category">
          {categories.map((cat) => {
            const active = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={active}
              >
                {active && <motion.span layoutId="catalog-category" className="catalog-filter-indicator" aria-hidden />}
                <span className="relative">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="sr-only" role="status">{filtered.length} {filtered.length === 1 ? "item" : "items"} shown</p>
      {filtered.length > 0 ? (
        <div className="product-grid">
          {filtered.map((product, index) => (
            <ProductCard key={product.slug} product={product} index={index} />
          ))}
        </div>
      ) : (
        <div className="work-panel py-12">
          <h3 className="font-serif-heading mt-4 text-xl font-bold text-[#1A1A1A]">
            No items found
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            We couldn’t find any items matching &ldquo;{searchQuery || selectedCategory}&rdquo;. Try adjusting your filters.
          </p>
          <button
            onClick={() => {
              setSelectedCategory("All");
              setSearchQuery("");
            }}
            className="mt-6 text-link"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
