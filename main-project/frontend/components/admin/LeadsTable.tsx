"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronUp, ChevronDown, Search, X, SlidersHorizontal } from "lucide-react";
import { useLeads, type LeadFilters } from "@/hooks/useLeads";
import { scoreVariant, type Lead, type LeadStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

type SortKey = "businessName" | "digitalScore" | "discoveredAt" | "status";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  approved: "Approved",
  rejected: "Rejected",
  cold: "Cold",
};

const STATUS_VARIANTS: Record<LeadStatus, "muted" | "warning" | "success" | "error" | "default"> = {
  new: "muted",
  contacted: "warning",
  approved: "success",
  rejected: "error",
  cold: "muted",
};

const ITEMS_PER_PAGE = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export function LeadsTable() {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(75);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | "">("");
  const [selectedNiche, setSelectedNiche] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // ── Sort (client-side on returned page) ──────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("discoveredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Build API filter params ───────────────────────────────────────────────
  const filters: LeadFilters = {
    ...(search && { search }),
    ...(selectedStatus && { status: selectedStatus }),
    ...(selectedNiche && { niche: selectedNiche }),
    ...(scoreMin > 0 && { scoreGte: scoreMin }),
    ...(scoreMax < 100 && { scoreLte: scoreMax }),
    page,
    limit: ITEMS_PER_PAGE,
  };

  const { data, isLoading, isError } = useLeads(filters);

  const leads = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const hasActiveFilters = search || scoreMin > 0 || scoreMax < 75 || selectedStatus || selectedNiche;

  function clearFilters() {
    setSearch("");
    setScoreMin(0);
    setScoreMax(75);
    setSelectedStatus("");
    setSelectedNiche("");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Client-side sort within the current page
  const sorted = [...leads].sort((a, b) => {
    const av = (a[sortKey] ?? "") as string | number;
    const bv = (b[sortKey] ?? "") as string | number;
    if (typeof av === "string" && typeof bv === "string") {
      return sortDir === "asc"
        ? av.toLowerCase().localeCompare(bv.toLowerCase())
        : bv.toLowerCase().localeCompare(av.toLowerCase());
    }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading…" : `${total} businesses discovered · ${leads.length} on this page`}
          </p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Search business, city, niche…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 bg-background border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-lp-amber/40 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-2 h-9 px-3 border text-xs font-medium transition-colors",
            showFilters || hasActiveFilters
              ? "border-lp-amber/40 text-lp-amber bg-lp-amber/5"
              : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-4 h-4 bg-lp-amber text-background text-[9px] font-bold flex items-center justify-center rounded-full">
              !
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 h-9 px-3 text-xs text-muted-foreground/50 hover:text-muted-foreground border border-border/40 hover:border-border/60 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div
          className="border border-border/60 bg-card p-5 grid grid-cols-1 sm:grid-cols-3 gap-5"
          style={{ animation: "lp-slide-up 0.2s ease both" }}
        >
          {/* Score range */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              Score range
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={scoreMax}
                value={scoreMin}
                onChange={(e) => { setScoreMin(Number(e.target.value)); setPage(1); }}
                className="w-16 h-8 px-2 text-sm bg-background border border-border/60 text-foreground focus:outline-none focus:border-lp-amber/40"
              />
              <span className="text-muted-foreground/40 text-xs">–</span>
              <input
                type="number"
                min={scoreMin}
                max={100}
                value={scoreMax}
                onChange={(e) => { setScoreMax(Number(e.target.value)); setPage(1); }}
                className="w-16 h-8 px-2 text-sm bg-background border border-border/60 text-foreground focus:outline-none focus:border-lp-amber/40"
              />
            </div>
          </div>

          {/* Status select */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              Status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSelectedStatus(selectedStatus === s ? "" : s); setPage(1); }}
                  className={cn(
                    "h-6 px-2 text-[10px] font-medium border transition-colors",
                    selectedStatus === s
                      ? "border-lp-amber/40 bg-lp-amber/10 text-lp-amber"
                      : "border-border/60 text-muted-foreground hover:border-border"
                  )}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Niche input */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">
              Niche
            </p>
            <input
              type="text"
              placeholder="e.g. restaurants"
              value={selectedNiche}
              onChange={(e) => { setSelectedNiche(e.target.value); setPage(1); }}
              className="w-full h-8 px-2 text-sm bg-background border border-border/60 text-foreground focus:outline-none focus:border-lp-amber/40"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-border/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-card">
              <SortTh label="Business" sortKey="businessName" active={sortKey} dir={sortDir} onToggle={toggleSort} className="text-left px-5 py-3" />
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em] whitespace-nowrap hidden sm:table-cell">
                Niche
              </th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em] whitespace-nowrap hidden md:table-cell">
                City
              </th>
              <SortTh label="Score" sortKey="digitalScore" active={sortKey} dir={sortDir} onToggle={toggleSort} className="text-center px-4 py-3 w-24" />
              <SortTh label="Status" sortKey="status" active={sortKey} dir={sortDir} onToggle={toggleSort} className="text-left px-4 py-3 hidden sm:table-cell" />
              <SortTh label="Discovered" sortKey="discoveredAt" active={sortKey} dir={sortDir} onToggle={toggleSort} className="text-left px-4 py-3 hidden lg:table-cell" />
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : isError ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-sm text-lp-red/60">
                  Failed to load leads. Check your connection.
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground/40">
                  No leads match your filters.
                </td>
              </tr>
            ) : (
              sorted.map((lead, i) => <LeadRow key={lead.id} lead={lead} index={i} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground/50">
          <span>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 px-3 border border-border/60 hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ‹ Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "h-7 w-7 border transition-colors font-mono",
                  p === page
                    ? "border-lp-amber/40 bg-lp-amber/10 text-lp-amber"
                    : "border-border/60 hover:border-border text-muted-foreground/50"
                )}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 px-3 border border-border/60 hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SortTh ───────────────────────────────────────────────────────────────────

function SortTh({
  label, sortKey, active, dir, onToggle, className,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onToggle: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={cn(
        "text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em] whitespace-nowrap cursor-pointer select-none hover:text-muted-foreground/70 transition-colors",
        className
      )}
      onClick={() => onToggle(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="flex flex-col">
          <ChevronUp className={cn("w-2.5 h-2.5 -mb-0.5", isActive && dir === "asc" ? "text-lp-amber" : "opacity-30")} />
          <ChevronDown className={cn("w-2.5 h-2.5", isActive && dir === "desc" ? "text-lp-amber" : "opacity-30")} />
        </span>
      </span>
    </th>
  );
}

// ─── LeadRow ─────────────────────────────────────────────────────────────────

function LeadRow({ lead, index }: { lead: Lead; index: number }) {
  const formatted = new Date(lead.discoveredAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <tr
      className="hover:bg-border/15 transition-colors group"
      style={{ animation: "lp-fade-in 0.3s ease both", animationDelay: `${index * 0.03}s` }}
    >
      <td className="px-5 py-3.5">
        <div>
          <Link
            href={`/dashboard/leads/${lead.id}`}
            className="text-sm font-medium text-foreground hover:text-lp-amber transition-colors"
          >
            {lead.businessName}
          </Link>
          {lead.website && (
            <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-mono">{lead.website}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <span className="text-xs text-muted-foreground">{lead.niche}</span>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-xs text-muted-foreground/60">{lead.city}</span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <Badge variant={scoreVariant(lead.digitalScore)} className="font-mono text-[11px] px-2 tabular-nums">
          {lead.digitalScore ?? "—"}
        </Badge>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <Badge variant={STATUS_VARIANTS[lead.status]} className="text-[10px] capitalize">
          {STATUS_LABELS[lead.status]}
        </Badge>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <span className="text-[11px] text-muted-foreground/40 font-mono tabular-nums">{formatted}</span>
      </td>
      <td className="px-4 py-3.5">
        <Link
          href={`/dashboard/leads/${lead.id}`}
          className="text-muted-foreground/20 hover:text-lp-amber transition-colors flex items-center justify-center"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-3 bg-border/40 rounded-none w-3/4" />
        </td>
      ))}
    </tr>
  );
}
