import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { DEFAULT_NETWORK } from "@/config/app";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/ui/motion";

const NAV_ITEMS = [
  { label: "Product", to: "/product" },
  { label: "Gasless", to: "/gasless" },
  { label: "Security", to: "/security" },
  { label: "Developers", to: "/build" },
];

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/logo.png" alt="EzPayz" className="h-8 w-8 rounded-[10px] object-cover shadow-xs" />
      <span className="text-[20px] font-semibold tracking-[-0.01em] text-ink">EzPayz</span>
    </Link>
  );
}

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "relative transition-colors duration-200 hover:text-ink",
              isActive ? "text-ink" : "text-ink-3",
              className,
            )
          }
        >
          {({ isActive }) => (
            <>
              {item.label}
              {isActive ? (
                <motion.span
                  layoutId="marketing-nav-underline"
                  className="absolute -bottom-[7px] left-0 right-0 h-[2px] rounded-full bg-accent"
                  transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                />
              ) : null}
            </>
          )}
        </NavLink>
      ))}
    </>
  );
}

/** Serif page hero shared by the marketing section pages. */
export function PageHero({ title, lede }: { title: ReactNode; lede: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-32 right-[-10%] h-[360px] w-[360px] rounded-full bg-accent-soft blur-3xl [animation:drift_18s_ease-in-out_infinite]" />
      </div>
      <div className="relative mx-auto w-full px-5 py-16 text-center sm:px-8 lg:py-24">
        <FadeIn>
          <h1 className="mx-auto max-w-3xl font-display text-[44px] leading-[1.05] text-ink sm:text-[60px]">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[19px] leading-relaxed text-ink-3">{lede}</p>
        </FadeIn>
      </div>
    </section>
  );
}

export function MarketingLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full items-center gap-4 px-5 sm:px-8 lg:px-12 2xl:px-20">
          <BrandMark />
          <nav className="ml-8 hidden items-center gap-7 text-[17px] md:flex">
            <NavLinks />
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link to="/sign-in">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button variant="primary" size="sm" iconRight={<ArrowRight className="h-4 w-4" />}>
                Get started
              </Button>
            </Link>
          </div>
          <button
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-surface text-ink-2 md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
              className="overflow-hidden border-t border-line bg-surface md:hidden"
            >
              <div className="flex flex-col gap-1 px-5 py-4 text-[18px]">
                <NavLinks onNavigate={() => setMenuOpen(false)} className="rounded-[10px] px-3 py-2.5" />
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-4">
                  <Link to="/sign-in" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Sign in
                    </Button>
                  </Link>
                  <Link to="/sign-up" className="flex-1" onClick={() => setMenuOpen(false)}>
                    <Button variant="primary" className="w-full">
                      Get started
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid w-full gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr] lg:px-12 2xl:px-20">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-ink-3">
              USDT payment infrastructure on {DEFAULT_NETWORK.name} — checkout, links, invoices,
              subscriptions and refunds in one integration.
            </p>
            <p className="mt-3 text-[14px] text-ink-4">
              Demo environment — wallets, signatures and settlements are simulated.
            </p>
          </div>
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wider text-ink-4">Product</p>
            <ul className="mt-4 space-y-2.5 text-[16px]">
              <li>
                <Link to="/product" className="text-ink-3 transition-colors hover:text-ink">
                  Product
                </Link>
              </li>
              <li>
                <Link to="/gasless" className="text-ink-3 transition-colors hover:text-ink">
                  Gasless
                </Link>
              </li>
              <li>
                <Link to="/security" className="text-ink-3 transition-colors hover:text-ink">
                  Security
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-ink-3 transition-colors hover:text-ink">
                  Open dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-wider text-ink-4">Developers</p>
            <ul className="mt-4 space-y-2.5 text-[16px]">
              <li>
                <Link to="/build" className="text-ink-3 transition-colors hover:text-ink">
                  Developer platform
                </Link>
              </li>
              <li>
                <Link to="/developers/quickstart" className="text-ink-3 transition-colors hover:text-ink">
                  Quickstart
                </Link>
              </li>
              <li>
                <Link to="/developers/api-reference" className="text-ink-3 transition-colors hover:text-ink">
                  API reference
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex w-full flex-wrap items-center justify-between gap-2 px-5 py-5 text-[14px] text-ink-4 sm:px-8 lg:px-12 2xl:px-20">
            <p>© 2026 EzPayz</p>
            <p>
              Built on {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
