"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AuditError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Brand header */}
      <header className="border-b border-border/60 bg-card">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-lp-amber rounded-full flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-background leading-none">SA</span>
            </div>
            <span className="text-sm font-semibold text-foreground">sift.ai</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center space-y-5">
        <div className="w-14 h-14 border border-lp-red/20 bg-lp-red/5 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-lp-red/50" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Audit failed to load</p>
          <p className="text-xs text-muted-foreground/50 max-w-xs leading-relaxed">
            {error.message && error.message !== "undefined"
              ? error.message
              : "There was an error loading this audit. Please try again."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50 hover:text-lp-amber transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
          <span className="text-border">·</span>
          <Link
            href="/"
            className="text-xs text-muted-foreground/50 hover:text-lp-amber transition-colors"
          >
            ← Back to sift.ai
          </Link>
        </div>
      </main>
    </div>
  );
}
