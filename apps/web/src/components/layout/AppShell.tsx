import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
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

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5 px-3 py-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[14px] font-bold text-white">
        W
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight text-ink">EzPayz</span>
          <span className="block truncate text-[13px] text-ink-4">USDT gateway</span>
        </span>
      ) : null}
    </Link>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-6 pt-2 scroll-thin">
      {MERCHANT_NAV.map((section) => (
        <div key={section.title}>
          {!collapsed ? (
            <p className="px-3 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-wider text-ink-4">
              {section.title}
            </p>
          ) : (
            <Divider className="my-2" />
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-2.5 rounded-md px-3 py-[7px] text-[15px] font-medium transition-colors",
                      isActive
                        ? "bg-accent-soft text-accent"
                        : "text-ink-2 hover:bg-canvas-alt hover:text-ink",
                      collapsed && "justify-center px-0",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
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
      <div className="px-3 pb-2">
        <button
          onClick={() => setCreateOpen(true)}
          title="Switch workspace"
          className="flex h-8 w-full items-center justify-center rounded-md border border-line bg-surface text-ink-3 hover:text-ink"
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
    <div ref={ref} className="relative px-2 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-line-strong"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink text-[13px] font-bold text-white">
          {merchant.logoText}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{merchant.displayName}</span>
          <span className="block truncate text-[13px] text-ink-4">Test workspace</span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-ink-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute bottom-[calc(100%+4px)] left-2 right-2 z-30 overflow-hidden rounded-md border border-line bg-surface shadow-[0_10px_30px_rgba(27,31,30,0.12)]">
          <div className="flex items-center gap-2.5 border-b border-line bg-accent-soft/60 px-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-[12px] font-bold text-white">
              {merchant.logoText}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-ink">{merchant.businessName}</p>
              <p className="truncate text-[13px] text-ink-3">Active workspace</p>
            </div>
            <Check className="h-3.5 w-3.5 text-accent" />
          </div>
          <button
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-ink-2 hover:bg-canvas"
          >
            <Plus className="h-3.5 w-3.5 text-ink-4" />
            Create new workspace
          </button>
        </div>
      ) : null}
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
      <p className="text-[14px] text-ink-3">A single demo workspace is available.</p>
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
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-ink-3 transition-colors hover:border-line hover:bg-surface hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white tnum">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-md border border-line bg-surface shadow-[0_14px_40px_rgba(27,31,30,0.14)]">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <p className="text-[15px] font-semibold text-ink">Notifications</p>
            <button
              onClick={markAll}
              className="text-[13px] font-medium text-accent hover:underline"
              disabled={!unread}
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto scroll-thin">
            {notifications.length === 0 ? (
              <li className="px-3.5 py-6 text-center text-[14px] text-ink-4">No notifications</li>
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
                        <p className="text-[14px] font-medium text-ink">{n.title}</p>
                        <p className="truncate text-[14px] text-ink-3">{n.body}</p>
                        <p className="mt-0.5 text-[13px] text-ink-4">{timeAgo(n.at)}</p>
                      </div>
                    </div>
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
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
        className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 transition-colors hover:border-line hover:bg-surface"
        aria-label="Account menu"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-alt text-[13px] font-bold text-ink-2">
          {merchant.logoText}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-60 overflow-hidden rounded-md border border-line bg-surface shadow-[0_14px_40px_rgba(27,31,30,0.14)]">
          <div className="border-b border-line px-3.5 py-2.5">
            <p className="truncate text-[14px] font-semibold text-ink">{merchant.businessEmail}</p>
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
                className="block px-3.5 py-2 text-[14px] text-ink-2 hover:bg-canvas"
              >
                {i.label}
              </a>
            ))}
            <Divider className="my-1" />
            <button
              onClick={() => {
                setOpen(false);
                signOut();
                navigate("/sign-in");
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[14px] text-ink-2 hover:bg-canvas"
            >
              <CircleUser className="h-3.5 w-3.5 text-ink-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  useSyncRealData(); // Fetch real API data → populate Zustand store for all dashboard pages
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const reset = useDemo((s) => s.reset);
  const pushToast = useDemo((s) => s.pushToast);
  const location = useLocation();
  const merchant = useDemo((s) => s.data.merchant);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface lg:flex",
          collapsed ? "w-[68px]" : "w-[236px]",
        )}
      >
        <Logo collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <MerchantSwitcher collapsed={collapsed} />
        <div className="border-t border-line px-2 py-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[14px] font-medium text-ink-3 hover:bg-canvas-alt hover:text-ink"
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
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(27,31,30,0.3)]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[270px] flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="mr-2 rounded p-1.5 text-ink-3 hover:bg-canvas-alt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <MerchantSwitcher collapsed={false} />
          </aside>
        </div>
      ) : null}

      <div className={cn("flex min-h-screen flex-col", collapsed ? "lg:pl-[68px]" : "lg:pl-[236px]")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-canvas-alt lg:hidden"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <span className="hidden items-center gap-1.5 rounded-md border border-warn-line bg-warn-soft px-2 py-1 text-[13px] font-semibold text-warn sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" />
            Testnet · demo mode
          </span>
          <span className="hidden items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-[13px] font-medium text-ink-3 md:inline-flex">
            {DEFAULT_NETWORK.name} · chain {DEFAULT_NETWORK.chainId}
          </span>
          <span className="hidden items-center gap-1.5 text-[13px] text-ink-4 xl:inline-flex">
            Payout wallet
            <code className="font-mono text-[13px] text-ink-2">
              {merchant.payoutWallet.slice(0, 8)}…{merchant.payoutWallet.slice(-4)}
            </code>
            {merchant.walletVerified ? <ShieldCheck className="h-3.5 w-3.5 text-positive" /> : null}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setResetOpen(true)}
              className="hidden items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-[14px] font-medium text-ink-3 transition-colors hover:border-line hover:bg-surface hover:text-ink sm:flex"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset demo data
            </button>
            <a
              href="#/developers/quickstart"
              className="hidden items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-[14px] font-medium text-ink-3 transition-colors hover:border-line hover:bg-surface hover:text-ink sm:flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Docs
            </a>
            <a
              href="#/roadmap"
              className="hidden h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-ink md:flex"
              aria-label="Roadmap"
              title="Roadmap"
            >
              <LifeBuoy className="h-4 w-4" />
            </a>
            <NotificationCenter />
            <a
              href="#/developers/quickstart"
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-ink md:hidden"
              aria-label="Documentation"
            >
              <HelpCircle className="h-4 w-4" />
            </a>
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1240px] space-y-5">
            <DemoModeBanner />
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-line bg-surface px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center justify-between gap-2 text-[13px] text-ink-4">
            <p>
              EzPayz frontend demo · {DEFAULT_NETWORK.name} · USDT · all transactions simulated
            </p>
            <div className="flex items-center gap-3">
              <a href="#/roadmap" className="hover:text-ink">
                Roadmap
              </a>
              <a href="#/developers/api-reference" className="hover:text-ink">
                API reference
              </a>
              <a href="#/developers/quickstart" className="hover:text-ink">
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
