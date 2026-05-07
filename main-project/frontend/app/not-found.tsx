import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-6">
      <div className="w-14 h-14 border border-border/60 bg-card flex items-center justify-center">
        <FileQuestion className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.5} />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-[0.15em]">
          404
        </p>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground/60 max-w-xs leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-xs font-medium text-lp-amber hover:text-lp-amber/80 transition-colors"
        >
          Go to Dashboard →
        </Link>
        <span className="text-border">·</span>
        <Link
          href="/"
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
