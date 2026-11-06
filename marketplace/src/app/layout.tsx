import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CartProvider } from "@/features/storefront/cart-context";
import { StoreFeedback } from "@/components/ui/store-feedback";
import { WalletProvider } from "@/features/storefront/wallet-context";

export const metadata: Metadata = {
  title: "Sill & Shelf — Objects for everyday living",
  description: "Shop ceramics, textiles, and small comforts for the home.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAF7F0] text-[#1A1A1A] antialiased">
        <StoreFeedback><WalletProvider><CartProvider>
          <Header />
          {!process.env.DATABASE_URL && (
            <p className="border-b border-[#D6CCBD] bg-[#F2EBDD] px-4 py-2 text-center text-xs text-[#28334B]">
              Catalog preview. Checkout requires a configured marketplace database.
            </p>
          )}
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider></WalletProvider></StoreFeedback>
      </body>
    </html>
  );
}
