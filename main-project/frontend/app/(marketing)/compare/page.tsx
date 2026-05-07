import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Compare — sift.ai vs Manual, Hunter.io & Apollo.io",
  description:
    "See why sift.ai finds better leads than manual prospecting, Hunter.io, or Apollo.io. It targets local businesses that actually need your help — and writes the pitch.",
};

type CellValue = true | false | string;

interface CompareRow {
  feature: string;
  SiftAi: CellValue;
  manual: CellValue;
  hunter: CellValue;
  apollo: CellValue;
}

const ROWS: CompareRow[] = [
  {
    feature: "Targets local businesses",
    SiftAi: true,
    manual: true,
    hunter: false,
    apollo: false,
  },
  {
    feature: "Automated discovery",
    SiftAi: true,
    manual: false,
    hunter: "Partial",
    apollo: true,
  },
  {
    feature: "Digital presence scoring",
    SiftAi: true,
    manual: false,
    hunter: false,
    apollo: false,
  },
  {
    feature: "AI-personalized emails",
    SiftAi: true,
    manual: false,
    hunter: false,
    apollo: "Templates only",
  },
  {
    feature: "Approval queue before send",
    SiftAi: true,
    manual: true,
    hunter: false,
    apollo: false,
  },
  {
    feature: "Google Sheets CRM sync",
    SiftAi: true,
    manual: "Manual export",
    hunter: false,
    apollo: "Native CRM",
  },
  {
    feature: "Self-hosted / full data control",
    SiftAi: true,
    manual: true,
    hunter: false,
    apollo: false,
  },
  {
    feature: "Free tier available",
    SiftAi: true,
    manual: true,
    hunter: "Limited",
    apollo: "Limited",
  },
  {
    feature: "Designed for solo operators",
    SiftAi: true,
    manual: true,
    hunter: false,
    apollo: false,
  },
];

const TOOLS = [
  { id: "SiftAi", label: "sift.ai", highlight: true },
  { id: "manual", label: "Manual", highlight: false },
  { id: "hunter", label: "Hunter.io", highlight: false },
  { id: "apollo", label: "Apollo.io", highlight: false },
] as const;

function Cell({ value, highlight }: { value: CellValue; highlight: boolean }) {
  if (value === true) {
    return (
      <Check
        className={["w-4 h-4 mx-auto", highlight ? "text-lp-green" : "text-lp-green/60"].join(" ")}
        strokeWidth={2}
      />
    );
  }
  if (value === false) {
    return (
      <Minus className="w-4 h-4 text-muted-foreground/25 mx-auto" strokeWidth={1.5} />
    );
  }
  return (
    <span className="text-xs text-muted-foreground/60 text-center block leading-tight">
      {value}
    </span>
  );
}

export default function ComparePage() {
  return (
    <div className="pt-14 pb-28 lg:pt-20 lg:pb-36">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-16 mb-14 lg:mb-16">
          <div>
            <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em] mb-4">
              Compare
            </p>
            <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter text-foreground leading-tight">
              Built differently.
            </h1>
          </div>
          <div className="flex items-end">
            <p className="text-muted-foreground leading-relaxed max-w-[50ch]">
              Most tools find email addresses. sift.ai finds the local businesses
              that are quietly losing customers — and writes the pitch for you.
            </p>
          </div>
        </div>

        {/* Table */}
        <p className="text-[11px] text-muted-foreground/40 mb-3 sm:hidden">
          Swipe to compare all tools →
        </p>
        <div className="border border-border/60 overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-4 px-6 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider w-[42%]">
                  Feature
                </th>
                {TOOLS.map((tool) => (
                  <th
                    key={tool.id}
                    className={[
                      "py-4 px-4 text-sm font-semibold text-center",
                      tool.highlight
                        ? "text-lp-amber bg-lp-amber/[0.04]"
                        : "text-muted-foreground/60",
                    ].join(" ")}
                  >
                    {tool.label}
                    {tool.highlight && (
                      <span className="block text-[10px] font-normal text-lp-amber/50 mt-0.5 tracking-wide">
                        — you are here
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={row.feature}
                  className={[
                    "border-b border-border/40 last:border-b-0",
                    "hover:bg-card/30 transition-colors duration-150",
                    i % 2 === 1 ? "bg-card/10" : "",
                  ].join(" ")}
                >
                  <td className="py-3.5 px-6 text-sm text-foreground">
                    {row.feature}
                  </td>
                  {TOOLS.map((tool) => (
                    <td
                      key={tool.id}
                      className={[
                        "py-3.5 px-4 text-center",
                        tool.highlight ? "bg-lp-amber/[0.03]" : "",
                      ].join(" ")}
                    >
                      <Cell
                        value={row[tool.id as keyof CompareRow] as CellValue}
                        highlight={tool.highlight}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Try sift.ai free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 underline underline-offset-4"
          >
            See pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
