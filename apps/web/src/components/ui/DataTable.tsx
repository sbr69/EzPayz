import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, Input, Select } from "./primitives";
import { EmptyState, TableSkeleton } from "./Feedback";
import { downloadCsv } from "@/lib/money";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  align?: "left" | "right";
  hideOnMobile?: boolean;
  csv?: (row: T) => string | number | null | undefined;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchValue?: (row: T) => string;
  filters?: FilterDef<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  pageSize?: number;
  exportName?: string;
  toolbarExtra?: ReactNode;
  dense?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  searchPlaceholder = "Search…",
  searchValue,
  filters = [],
  loading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  pageSize = 10,
  exportName,
  toolbarExtra,
  dense,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let out = rows;
    if (query.trim() && searchValue) {
      const q = query.trim().toLowerCase();
      out = out.filter((r) => searchValue(r).toLowerCase().includes(q));
    }
    filters.forEach((f) => {
      const v = filterState[f.key];
      if (v && v !== "all") out = out.filter((r) => f.match(r, v));
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, filters, filterState, sort, columns, searchValue]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function handleExport() {
    const header = columns.map((c) => (typeof c.header === "string" ? c.header : c.key));
    const body = filtered.map((row) =>
      columns.map((c) => (c.csv ? c.csv(row) : String(c.sortValue?.(row) ?? ""))),
    );
    downloadCsv(`${exportName ?? "export"}.csv`, [header, ...body]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        {searchValue ? (
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-[15px]"
              aria-label="Search table"
            />
          </div>
        ) : null}
        {filters.map((f) => (
          <Select
            key={f.key}
            value={filterState[f.key] ?? "all"}
            onChange={(e) => {
              setFilterState((s) => ({ ...s, [f.key]: e.target.value }));
              setPage(0);
            }}
            className="h-8 w-auto min-w-[130px] text-[14px]"
            aria-label={f.label}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          {exportName ? (
            <Button size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={handleExport}>
              CSV
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={pageSize > 6 ? 6 : pageSize} cols={Math.min(columns.length, 6)} />
      ) : filtered.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                {columns.map((c) => {
                  const sortable = Boolean(c.sortValue);
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn(
                        "px-4 py-2.5 text-[13px] font-semibold uppercase tracking-wide text-ink-4",
                        c.align === "right" && "text-right",
                        c.hideOnMobile && "hidden lg:table-cell",
                      )}
                    >
                      {sortable ? (
                        <button
                          onClick={() =>
                            setSort((s) =>
                              s?.key === c.key
                                ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                                : { key: c.key, dir: "desc" },
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-ink",
                            active && "text-ink",
                            c.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {c.header}
                          {active ? (
                            sort?.dir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : null}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paged.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (onRowClick && e.key === "Enter") onRowClick(row);
                  }}
                  className={cn(
                    "bg-surface transition-colors",
                    onRowClick && "cursor-pointer hover:bg-canvas/70",
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 align-middle text-[15px] text-ink-2",
                        dense ? "py-2" : "py-3",
                        c.align === "right" && "text-right",
                        c.hideOnMobile && "hidden lg:table-cell",
                        c.className,
                      )}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <p className="text-[14px] text-ink-4 tnum">
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              icon={<ChevronLeft className="h-3.5 w-3.5" />}
            >
              Previous
            </Button>
            <span className="px-1 text-[14px] text-ink-3 tnum">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              iconRight={<ChevronRight className="h-3.5 w-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
