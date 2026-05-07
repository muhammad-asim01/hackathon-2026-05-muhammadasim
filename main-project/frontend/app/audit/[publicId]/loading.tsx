// Shown by Next.js while the server component fetches audit data.

export default function AuditLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="border-b border-border/60 bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-lp-amber rounded-full" />
            <div className="h-3.5 w-24 bg-border/40 animate-pulse rounded-none" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8 animate-pulse">
        {/* Business name */}
        <div className="space-y-2">
          <div className="h-7 w-72 bg-border/40 rounded-none" />
          <div className="h-3.5 w-56 bg-border/30 rounded-none" />
        </div>

        {/* Score block */}
        <div className="bg-card border border-border/60 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-[140px] h-[140px] rounded-full border-[10px] border-border/40 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-3 w-32 bg-border/30 rounded-none" />
              <div className="h-4 w-full bg-border/40 rounded-none" />
              <div className="h-4 w-4/5 bg-border/30 rounded-none" />
              <div className="h-4 w-3/5 bg-border/30 rounded-none" />
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-4 bg-border/5 border border-border/20"
            >
              <div className="w-8 h-8 bg-border/30 rounded-none shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-border/40 rounded-none" />
                <div className="h-3 w-64 bg-border/25 rounded-none" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
