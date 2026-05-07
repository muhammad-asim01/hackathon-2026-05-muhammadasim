"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRunDetail } from "@/hooks/useRuns";
import { RunDetail } from "@/components/admin/RunDetail";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RunDetailSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl animate-pulse">
      {/* Back link */}
      <div className="h-3.5 w-20 bg-border/30 rounded-none" />

      {/* Header */}
      <div className="space-y-2">
        <div className="h-5 w-64 bg-border/40 rounded-none" />
        <div className="h-3.5 w-40 bg-border/25 rounded-none" />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/40 border border-border/40">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card px-5 py-4 space-y-2">
            <div className="h-2.5 w-16 bg-border/30 rounded-none" />
            <div className="h-6 w-10 bg-border/40 rounded-none" />
          </div>
        ))}
      </div>

      {/* Agent steps */}
      <div className="bg-card border border-border/60">
        <div className="px-5 py-3.5 border-b border-border/60">
          <div className="h-3.5 w-28 bg-border/40 rounded-none" />
        </div>
        <div className="divide-y divide-border/40">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-5 h-5 rounded-full bg-border/30 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-border/40 rounded-none" />
                <div className="h-2.5 w-48 bg-border/25 rounded-none" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log panel */}
      <div className="bg-card border border-border/60 h-48" />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function RunDetailClient({ id }: { id: string }) {
  const { data: run, isLoading, isError } = useRunDetail(id);

  if (isLoading) return <RunDetailSkeleton />;

  if (isError || !run) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Link
          href="/dashboard/runs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Runs
        </Link>
        <p className="text-sm text-lp-red font-mono">Run not found or failed to load.</p>
      </div>
    );
  }

  return <RunDetail run={run} />;
}
