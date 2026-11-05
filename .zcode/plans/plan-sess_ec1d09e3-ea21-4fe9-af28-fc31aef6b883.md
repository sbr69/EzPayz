# Layout Redesign + Spacing System Unification (`apps/web`)

## Context

After three rapid styling passes the layout works but has no consistent spacing system, and one genuine bug: the shell's section spacing is broken (`PageTransition` renders without a className, so `space-y-8` on the shell wrapper never reaches page sections — pages currently stack with zero gap). An audit also found: 4-way mixed card paddings (`p-4` / `px-5 py-4` / `px-6` / primitives `px-7` that nothing uses), three different horizontal padding scales (app vs landing vs checkout), stat rows with 4/5/6 columns depending on page, table chrome misaligned by 8px inside the payments card, three different max-widths/rhythms on standalone pages, and sidebar (296px) vs mobile drawer (300px) mismatch.

You chose: **unify + repair, restructure page compositions, refined sidebar shell** — desktop-only, fluid width, current type scale stays.

## Spacing system (single 4px-based standard, applied everywhere)

| Element | Standard |
|---|---|
| Page section rhythm | `space-y-8` (repair the shell bug: pass `className="space-y-8"` to `PageTransition`) |
| Grids between cards | `gap-5` (replaces gap-3/gap-4 mix) |
| Card header | `px-6 py-4` (primitives — bring CardHeader back from px-7 so it aligns with bodies) |
| Card body / content blocks | `px-6 py-5` (replaces all `p-4`, `px-5 py-4`, `px-6 py-10` body variants in features) |
| List rows inside cards | `px-6 py-3` (dashboard tables, refunds/exceptions lists) |
| Stat/KeyValue blocks | `px-6 py-2.5` unified |
| Shell horizontal scale | `px-5 sm:px-8 lg:px-12 2xl:px-20` — applied to main, footer, **landing** (currently 5/10/16) and **CheckoutFrame** (currently 4) |
| Standalone pages (onboarding, roadmap, customer views) | all `max-w-4xl mx-auto px-6 py-10 space-y-6` (replaces 3xl/4xl/5xl + space-y-4/4/5 + py-8/8/10) |
| Rails | settings 200/240 → 220/260 to match docs; mobile drawer 300 → 296 |
| DataTable | `py-[18px]` → `py-4`; toolbar stays `px-6 py-5`; payments Tabs (`px-4 pt-1`) and filter bar (`px-4 py-3`) → `px-6`/`px-6 py-4` so edges align |
| Stats rows | standard `sm:grid-cols-2 lg:grid-cols-4` on refunds (5→4), exceptions, gasguard, developers; dashboard keeps its 6-up metric row |

## Page restructure

- **Dashboard** (`features/dashboard/Dashboard.tsx`): recomposed — full-width 6-up metrics → volume chart (2/3) + donut (1/3) → stacked bar (2/3) + renewals (1/3) → full-width recent transactions (aligned `px-6 py-3.5` cells) → 3-up refunds/exceptions/relayer → full-width quick actions. All section wrappers use the new gap/padding standards.
- **List pages**: keep each page's structure; enforce the standard card/table chrome and stats-row pattern above.

## Refined sidebar shell (`components/layout/AppShell.tsx`)

Rebuild the sidebar (keep 296px expanded / 80px collapsed, active-pill animation, collapse toggle):
- Top block: logo + **integrated search field** (filters nav items live) + primary **quick-create button** (opens existing CreatePaymentDialog).
- Middle: nav with sticky section labels, cleaner grouping (same `MERCHANT_NAV` data).
- Bottom: refined workspace switcher + collapse control.
- Topbar/footer kept, aligned to the unified horizontal scale.

## Out of scope / untouched

Logic, API, routes, signing, store, type sizes (stay as scaled), checkout card widths (only frame padding unified), auth layout.

## Verification

1. `npx tsc --noEmit` + `pnpm build:web`.
2. Browser at 1920: dashboard (new composition + visible section gaps), payments (aligned tabs/filters/table), settings + developers (matching rails), landing + checkout (same horizontal scale), onboarding/roadmap (unified containers), sidebar search filtering + quick-create + collapse.
3. Report drift; no logic changes.