const POWERED_BY = [
  "Google Maps Platform",
  "Anthropic Claude",
  "PageSpeed Insights",
  "Gmail API",
  "Google Sheets",
] as const;

export default function TechStrip() {
  return (
    <div className="border-y border-border/60">
      <div className="max-w-7xl mx-auto px-6 py-4 lg:py-5">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-8">
          <span className="shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.15em]">
            Powered by
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-0">
            {POWERED_BY.map((name, i) => (
              <span
                key={name}
                className="flex items-center gap-0 text-xs text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors duration-200 cursor-default select-none"
                style={{
                  animation: "lp-fade-in 0.4s ease",
                  animationDelay: `${0.1 + i * 0.07}s`,
                  animationFillMode: "both",
                }}
              >
                {i > 0 && (
                  <span className="mx-4 text-muted-foreground/20 text-sm">
                    ·
                  </span>
                )}
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
