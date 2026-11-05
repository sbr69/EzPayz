import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleUser,
  HelpCircle,
  LifeBuoy,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { MERCHANT_NAV } from "@/config/ui";
import { DEFAULT_NETWORK } from "@/config/app";
import { useDemo } from "@/store/demoStore";
import { useSyncRealData } from "@/hooks/useSyncRealData";
import { timeAgo } from "@/lib/money";
import { Button, Callout, Divider } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { DemoModeBanner } from "@/components/ui/Feedback";
import { PageTransition, EASE_OUT_QUART } from "@/components/ui/motion";

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-3 px-4 py-4">
      <motion.span
        whileHover={{ rotate: -6, scale: 1.05 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#118a7e] to-accent text-[20px] font-bold text-white shadow-xs"
      >
        W
      </motion.span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[20px] font-semibold leading-tight text-ink">EzPayz</span>
          <span className="block truncate text-[14px] text-ink-4">USDT gateway</span>
        </span>
      ) : null}
    </Link>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
  search,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  search: string;
}) {
  const layoutId = "sidebar-active-pill";
  const q = search.trim().toLowerCase();
  const sections = MERCHANT_NAV.map((section) => ({
    ...section,
    items: q
      ? section.items.filter((item) => item.label.toLowerCase().includes(q) || section.title.toLowerCase().includes(q))
      : section.items,
  })).filter((section) => section.items.length > 0);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3.5 pb-6 pt-3 scroll-thin">
      {sections.length === 0 ? (
        <p className="px-3 py-8 text-center text-[14px] text-ink-4">No matches for “{search.trim()}”</p>
      ) : null}
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed ? (
            <p className="sticky top-0 z-10 bg-surface px-3 pb-2 pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {section.title}
            </p>
          ) : (
            <Divider className="my-2" />
          )}
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-[11px] px-3.5 py-2.5 text-[16px] font-medium transition-colors duration-150",
                      isActive ? "text-accent" : "text-ink-2 hover:text-ink",
                      collapsed && "justify-center px-0",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <motion.span
                          layoutId={layoutId}
                          transition={{ type: "spring", stiffness: 480, damping: 38 }}
                          className="absolute inset-0 rounded-[10px] bg-accent-soft"
                        />
                      ) : null}
                      <item.icon
                        className={cn(
                          "relative h-[18px] w-[18px] shrink-0 transition-colors",
                          isActive ? "text-accent" : "text-ink-3 group-hover:text-ink-2",
                        )}
                        strokeWidth={1.9}
                      />
                      {!collapsed ? <span className="relative truncate">{item.label}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function MerchantSwitcher({ collapsed }: { collapsed: boolean }) {
  const merchant = useDemo((s) => s.data.merchant);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (collapsed) {
    return (
      <div className="px-4 pb-3">
        <button
          onClick={() => setCreateOpen(true)}
          title="Switch workspace"
          className="flex h-9 w-full items-center justify-center rounded-[10px] border border-line bg-surface text-ink-3 hover:text-ink"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Workspaces"
          size="sm"
          footer={<Button variant="ghost" onClick={() => setCreateOpen(false)}>Close</Button>}
        >
          <WorkspaceList onNew={() => { setCreateOpen(false); setCreateOpen(false); }} />
        </Modal>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 pb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-2.5 py-2 text-left shadow-xs transition-all duration-200 hover:border-line-strong hover:shadow-sm"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-[18px] font-bold text-white">
          {merchant.logoText}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-ink">{merchant.displayName}</span>
          <span className="block truncate text-[13px] text-ink-4">Test workspace</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-ink-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE_OUT_QUART }}
            className="absolute bottom-[calc(100%+4px)] left-3 right-3 z-30 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="flex items-center gap-2.5 border-b border-line bg-accent-soft/60 px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[14px] font-bold text-white">
                {merchant.logoText}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold text-ink">{merchant.businessName}</p>
                <p className="truncate text-[13px] text-ink-3">Active workspace</p>
              </div>
              <Check className="h-3.5 w-3.5 text-accent" />
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[16px] text-ink-2 hover:bg-canvas"
            >
              <Plus className="h-3.5 w-3.5 text-ink-4" />
              Create new workspace
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a new workspace"
        size="sm"
        footer={<Button variant="ghost" onClick={() => setCreateOpen(false)}>Close</Button>}
      >
        <Callout tone="info" title="One workspace in this demo">
          This demo environment ships a single seeded merchant workspace so that every screen can share
          consistent data. Additional workspaces, and the merchant-level scoping they imply, require the
          backend account service.
        </Callout>
      </Modal>
    </div>
  );
}

function WorkspaceList({ onNew }: { onNew: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[16px] text-ink-3">A single demo workspace is available.</p>
      <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={onNew}>
        New workspace
      </Button>
    </div>
  );
}

function NotificationCenter() {
  const notifications = useDemo((s) => s.data.notifications);
  const markRead = useDemo((s) => s.markNotificationRead);
  const markAll = useDemo((s) => s.markAllNotificationsRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-ink-3 transition-all hover:border-line hover:bg-surface hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[12px] font-bold text-white tnum"
          >
            {unread}
          </motion.span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT_QUART }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(360px,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <p className="text-[16px] font-semibold text-ink">Notifications</p>
              <button
                onClick={markAll}
                className="text-[14px] font-medium text-accent hover:underline"
                disabled={!unread}
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto scroll-thin">
              {notifications.length === 0 ? (
                <li className="px-3.5 py-6 text-center text-[16px] text-ink-4">No notifications</li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id}>
                    <a
                      href={`#${n.link ?? "/dashboard"}`}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                      className={cn("block px-3.5 py-2.5 transition-colors hover:bg-canvas", !n.read && "bg-accent-soft/25")}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                            n.read ? "bg-line-strong" : "bg-accent",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-[16px] font-medium text-ink">{n.title}</p>
                          <p className="truncate text-[16px] text-ink-3">{n.body}</p>
                          <p className="mt-0.5 text-[13px] text-ink-4">{timeAgo(n.at)}</p>
                        </div>
                      </div>
                    </a>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProfileMenu() {
  const merchant = useDemo((s) => s.data.merchant);
  const signOut = useDemo((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-transparent px-1 py-1 transition-all hover:border-line hover:bg-surface"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-alt text-[14px] font-bold text-ink-2">
          {merchant.logoText}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-4" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT_QUART }}
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-60 origin-top-right overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
          >
            <div className="border-b border-line px-3.5 py-2.5">
              <p className="truncate text-[16px] font-semibold text-ink">{merchant.businessEmail}</p>
              <p className="truncate text-[13px] text-ink-3">Merchant admin (demo)</p>
            </div>
            <div className="py-1">
              {[
                { label: "Business profile", to: "/settings/business" },
                { label: "Payout wallet", to: "/settings/wallet" },
                { label: "Security", to: "/settings/security" },
                { label: "API keys", to: "/developers/api-keys" },
              ].map((i) => (
                <a
                  key={i.to}
                  href={`#${i.to}`}
                  onClick={() => setOpen(false)}
                  className="block px-3.5 py-2 text-[16px] text-ink-2 hover:bg-canvas"
                >
                  {i.label}
                </a>
              ))}
              <Divider className="my-1" />
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                  localStorage.removeItem("wcp_token");
                  localStorage.removeItem("wcp_merchant_id");
                  navigate("/sign-in");
                }}
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[16px] text-ink-2 hover:bg-canvas"
              >
                <CircleUser className="h-3.5 w-3.5 text-ink-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AppShell() {
  useSyncRealData(); // Fetch real API data → populate Zustand store for all dashboard pages
  const signedIn = useDemo((s) => s.signedIn);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const reset = useDemo((s) => s.reset);
  const pushToast = useDemo((s) => s.pushToast);
  const location = useLocation();
  const merchant = useDemo((s) => s.data.merchant);

  // Auth guard: redirect to sign-in if not signed in (and no JWT in localStorage).
  const hasJwt = typeof window !== "undefined" && !!localStorage.getItem("wcp_token");
  if (!signedIn && !hasJwt) {
    return <Navigate to="/sign-in" replace />;
  }

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleReset() {
    setResetting(true);
    await new Promise((r) => setTimeout(r, 700));
    reset();
    setResetting(false);
    setResetOpen(false);
    pushToast({ title: "Demo data reset", body: "All seeded records were restored.", tone: "success" });
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 80 : 296 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface lg:flex"
      >
        <Logo collapsed={collapsed} />
        {!collapsed ? (
          <div className="px-3.5 pb-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
              <input
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="Search pages…"
                aria-label="Search navigation"
                className="h-10 w-full rounded-[10px] border border-line bg-canvas pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12"
              />
            </div>
          </div>
        ) : null}
        <SidebarNav collapsed={collapsed} search={navSearch} />
        <MerchantSwitcher collapsed={collapsed} />
        <div className="border-t border-line px-2 py-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2.5 text-[16px] font-medium text-ink-3 transition-colors hover:bg-canvas-alt hover:text-ink"
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <ChevronsLeft className="h-3.5 w-3.5" />
                Collapse
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-[rgba(27,31,30,0.35)] backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%", transition: { duration: 0.22, ease: EASE_OUT_QUART } }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-[296px] flex-col border-r border-line bg-surface shadow-xl"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                  className="mr-2 rounded-lg p-1.5 text-ink-3 hover:bg-canvas-alt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-3.5 pb-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-4" />
                  <input
                    value={navSearch}
                    onChange={(e) => setNavSearch(e.target.value)}
                    placeholder="Search pages…"
                    aria-label="Search navigation"
                    className="h-10 w-full rounded-[10px] border border-line bg-canvas pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-4 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12"
                  />
                </div>
              </div>
              <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} search={navSearch} />
              <MerchantSwitcher collapsed={false} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className={cn("flex min-h-screen flex-col transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[80px]" : "lg:pl-[296px]")}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-canvas-alt lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <span className="hidden items-center gap-1.5 rounded-full border border-warn-line bg-warn-soft px-2.5 py-1 text-[14px] font-semibold text-warn sm:inline-flex">
            <span className="anim-pulse-soft h-1.5 w-1.5 rounded-full bg-warn" />
            Testnet · demo mode
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[14px] font-medium text-ink-3 md:inline-flex">
            {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId}
          </span>
          <span className="hidden items-center gap-1.5 text-[14px] text-ink-4 xl:inline-flex">
            Payout wallet
            <code className="font-mono text-[14px] text-ink-2">
              {merchant.payoutWallet.slice(0, 8)}…{merchant.payoutWallet.slice(-4)}
            </code>
            {merchant.walletVerified ? <ShieldCheck className="h-3.5 w-3.5 text-positive" /> : null}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setResetOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[14px] font-medium text-ink-3 transition-all hover:border-line hover:bg-surface hover:text-ink sm:flex"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset demo data
            </button>
            <a
              href="#/developers/quickstart"
              className="hidden items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[14px] font-medium text-ink-3 transition-all hover:border-line hover:bg-surface hover:text-ink sm:flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </a>
            <a
              href="#/roadmap"
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface hover:text-ink md:flex"
              aria-label="Roadmap"
              title="Roadmap"
            >
              <LifeBuoy className="h-4 w-4" />
            </a>
            <NotificationCenter />
            <a
              href="#/developers/quickstart"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface hover:text-ink md:hidden"
              aria-label="Documentation"
            >
              <HelpCircle className="h-4 w-4" />
            </a>
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12 sm:py-10 2xl:px-20">
          <div className="w-full space-y-8">
            <DemoModeBanner />
            <PageTransition key={location.pathname} className="space-y-8">
              <Outlet />
            </PageTransition>
          </div>
        </main>

        <footer className="border-t border-line bg-surface px-5 py-5 sm:px-8 lg:px-12 2xl:px-20">
          <div className="flex w-full flex-wrap items-center justify-between gap-2 text-[14px] text-ink-4">
            <p>
              EzPayz frontend demo · {DEFAULT_NETWORK.name} · USDT · all transactions simulated
            </p>
            <div className="flex items-center gap-3">
              <a href="#/roadmap" className="transition-colors hover:text-ink">
                Roadmap
              </a>
              <a href="#/developers/api-reference" className="transition-colors hover:text-ink">
                API reference
              </a>
              <a href="#/developers/quickstart" className="transition-colors hover:text-ink">
                SDK docs
              </a>
            </div>
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title="Reset demo data"
        confirmLabel="Reset demo data"
        destructive
        loading={resetting}
        body="Every payment, invoice, refund, subscription, exception and developer record you created in this session will be replaced with the original seeded demo data."
      />
    </div>
  );
}
