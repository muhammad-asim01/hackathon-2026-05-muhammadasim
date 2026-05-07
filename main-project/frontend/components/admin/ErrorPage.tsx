"use client";

// Shared error UI used by all route-segment error.tsx files.
// Next.js requires error.tsx to be a Client Component.

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Human-readable name of the page/section that failed */
  section?: string;
}

export function ErrorPage({ error, reset, section }: ErrorPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
      {/* Icon */}
      <div className="w-14 h-14 border border-lp-red/20 bg-lp-red/5 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-lp-red/60" strokeWidth={1.5} />
      </div>

      {/* Copy */}
      <div className="space-y-2 max-w-sm">
        <p className="text-sm font-semibold text-foreground">
          {section ? `${section} failed to load` : "Something went wrong"}
        </p>
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          {error.message && error.message !== "undefined"
            ? error.message
            : "An unexpected error occurred. Try refreshing the page."}
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/25 mt-1">
            ID: {error.digest}
          </p>
        )}
      </div>

      {/* Action */}
      <Button size="sm" variant="outline" onClick={reset} className="gap-2">
        <RefreshCw className="w-3.5 h-3.5" />
        Try again
      </Button>
    </div>
  );
}
