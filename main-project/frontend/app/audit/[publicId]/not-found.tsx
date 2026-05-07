import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function AuditNotFound() {
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
        <div className="w-14 h-14 border border-border/60 flex items-center justify-center bg-card">
          <FileQuestion className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Audit Not Found</h1>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            This audit link may have expired or the business ID is invalid.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-lp-amber transition-colors"
        >
          ← Back to sift.ai
        </Link>
      </main>
    </div>
  );
}
