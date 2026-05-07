"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { useState } from "react";
import {
  useAnalyticsSummary,
  useAnalyticsFunnel,
  useAnalyticsScoreDistribution,
  useAnalyticsNicheBreakdown,
} from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import { REPLY_RATE_DATA } from "@/lib/mock/analytics";

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const CARD_BG = "#1c1917";
const BORDER = "#44403c";
const MUTED = "#a89984";
const AMBER = "#cab16a";
const GREEN = "#59a569";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 0,
    fontSize: 11,
    fontFamily: "monospace",
    color: "#fff",
  },
  labelStyle: { color: MUTED, fontSize: 10 },
  cursor: { stroke: BORDER, strokeWidth: 1 },
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ChartPanel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/60">
      <div className="px-5 py-4 border-b border-border/60">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sub && <p className="text-[11px] text-muted-foreground/40 mt-0.5">{sub}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Chart skeleton ───────────────────────────────────────────────────────────

function ChartSkeleton({ height = "h-52" }: { height?: string }) {
  return (
    <div className={cn("animate-pulse bg-border/10 border border-border/20", height)}>
      <div className="h-full flex items-end gap-2 p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-border/30 rounded-none"
            style={{ height: `${30 + Math.sin(i) * 40 + 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip() {
  const { data: s, isLoading } = useAnalyticsSummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/40 border border-border/40 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card px-5 py-4 space-y-2">
            <div className="h-2.5 w-20 bg-border/30 rounded-none" />
            <div className="h-7 w-14 bg-border/40 rounded-none" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    { label: "Total Leads",    value: s?.totalLeadsAllTime ?? "—"             },
    { label: "Total Sent",     value: s?.totalSent         ?? "—"             },
    { label: "Total Replies",  value: s?.totalReplies      ?? "—"             },
    { label: "Reply Rate",     value: s ? `${s.overallReplyRate}%` : "—"      },
    { label: "Avg Score",      value: s?.avgDigitalScore   ?? "—"             },
    { label: "Runs Completed", value: s?.runsCompleted     ?? "—"             },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/40 border border-border/40">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-5 py-4">
          <p className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.12em]">
            {item.label}
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-foreground mt-1.5">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Funnel chart ─────────────────────────────────────────────────────────────

function LeadFunnel() {
  const { data: funnelData = [], isLoading } = useAnalyticsFunnel();

  return (
    <ChartPanel
      title="Lead Funnel"
      sub="Discovery → Score → Draft → Approve → Send"
    >
      {isLoading ? (
        <ChartSkeleton height="h-72" />
      ) : funnelData.length === 0 ? (
        <div className="h-72 flex items-center justify-center text-sm text-muted-foreground/30">
          No pipeline data yet.
        </div>
      ) : null}
      <div className={cn("h-72", (isLoading || funnelData.length === 0) && "hidden")}>
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart margin={{ top: 4, right: 100, bottom: 4, left: 0 }}>
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number, name: string) => [v, name]}
            />
            <Funnel
              dataKey="value"
              data={funnelData}
              isAnimationActive
              labelLine={false}
            >
              <LabelList
                position="right"
                fill={MUTED}
                stroke="none"
                dataKey="name"
                style={{ fontSize: 10, fontFamily: "monospace" }}
              />
              <LabelList
                position="center"
                fill="#fff"
                stroke="none"
                dataKey="value"
                style={{ fontSize: 11, fontWeight: "bold", fontFamily: "monospace" }}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

// ─── Reply rate chart — kept as mock (no time-series endpoint yet) ────────────

function ReplyRateChart() {
  return (
    <ChartPanel
      title="Reply Rate — Last 14 Days"
      sub="% of sent emails that received a reply"
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={REPLY_RATE_DATA}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="replyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={GREEN} stopOpacity={0.25} />
                <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={BORDER}
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: MUTED, fontSize: 9, fontFamily: "monospace" }}
              axisLine={{ stroke: BORDER }}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 9, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [`${v}%`, "Reply rate"]}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke={GREEN}
              strokeWidth={1.5}
              fill="url(#replyGrad)"
              dot={false}
              activeDot={{ r: 3, fill: GREEN, stroke: "#0c0a09", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

// ─── Score distribution ───────────────────────────────────────────────────────

function ScoreDistChart() {
  const { data: scoreData = [], isLoading } = useAnalyticsScoreDistribution();

  function barColor(range: string): string {
    const low = parseInt(range.split("–")[0]);
    if (low <= 20) return "#ea6962";
    if (low <= 40) return "#cc5b33";
    return AMBER;
  }

  return (
    <ChartPanel
      title="Score Distribution"
      sub="Digital score buckets across all discovered leads"
    >
      {isLoading && <ChartSkeleton />}
      <div className={cn("h-52", isLoading && "hidden")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={scoreData}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={BORDER}
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="range"
              tick={{ fill: MUTED, fontSize: 9, fontFamily: "monospace" }}
              axisLine={{ stroke: BORDER }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 9, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [v, "leads"]}
            />
            <Bar dataKey="count" radius={0} maxBarSize={32}>
              {scoreData.map((entry) => (
                <Cell key={entry.range} fill={barColor(entry.range)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

// ─── Niche breakdown ──────────────────────────────────────────────────────────

const NICHE_LIMIT = 10;

function NicheTable() {
  const [page, setPage] = useState(1);
  const offset = (page - 1) * NICHE_LIMIT;

  const { data: result } = useAnalyticsNicheBreakdown({ limit: NICHE_LIMIT, offset });
  const rows       = result?.data  ?? [];
  const total      = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / NICHE_LIMIT));

  return (
    <ChartPanel title="Niche Breakdown" sub="Leads by vertical">
      <div className="divide-y divide-border/40">
        {/* Column headers */}
        <div className="flex gap-2 pb-2">
          <p className="flex-1 min-w-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em]">Niche</p>
          <p className="w-10 shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em]">Leads</p>
          <p className="w-10 shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em]">Apr.</p>
          <p className="w-10 shrink-0 text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-[0.1em]">Sent</p>
        </div>

        {/* Rows */}
        {rows.map((row, i) => (
          <div
            key={row.niche}
            className="flex gap-2 py-2.5"
            style={{
              animation: "lp-fade-in 0.3s ease both",
              animationDelay: `${i * 0.04}s`,
            }}
          >
            <p className="flex-1 min-w-0 text-xs text-foreground truncate">{row.niche}</p>
            <p className="w-10 shrink-0 text-xs font-mono text-muted-foreground tabular-nums">{row.leads}</p>
            <p className="w-10 shrink-0 text-xs font-mono text-lp-green tabular-nums">{row.approved}</p>
            <p className="w-10 shrink-0 text-xs font-mono text-lp-amber tabular-nums">{row.sent}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground/50 pt-3 mt-1 border-t border-border/40">
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
    </ChartPanel>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnalyticsCharts() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline metrics and outreach performance.
        </p>
      </div>

      <KpiStrip />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadFunnel />
        <ReplyRateChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreDistChart />
        <NicheTable />
      </div>
    </div>
  );
}
