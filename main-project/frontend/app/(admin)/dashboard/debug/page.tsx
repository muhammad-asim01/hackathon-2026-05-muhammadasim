"use client";

import { useState, useCallback } from "react";
import {
  Search, Globe, Zap, Mail, Send, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Loader, Terminal, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requests } from "@/lib/api/requests_helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error";

interface StepState {
  status: StepStatus;
  durationMs?: number;
  result?: unknown;
  error?: string;
}

// ─── JSON renderer ────────────────────────────────────────────────────────────

function JsonOutput({ data }: { data: unknown }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border border-border/40 bg-background mt-3">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors border-b border-border/40"
      >
        <span className="font-mono uppercase tracking-widest">Response</span>
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>
      {!collapsed && (
        <pre className="px-4 py-3 text-[11px] font-mono text-lp-green/80 leading-relaxed overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

interface StepCardProps {
  index: number;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  step: StepState;
  onRun: () => void;
  children?: React.ReactNode; // input fields
}

function StepCard({ index, icon: Icon, title, subtitle, step, onRun, children }: StepCardProps) {
  const borderColor =
    step.status === "done" ? "border-lp-green/30" :
    step.status === "error" ? "border-lp-red/30" :
    step.status === "running" ? "border-lp-amber/30" :
    "border-border/60";

  return (
    <div
      className={cn("bg-card border transition-colors duration-300", borderColor)}
      style={{ animation: "lp-slide-up 0.35s ease both", animationDelay: `${index * 0.07}s` }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
        <div className={cn(
          "w-8 h-8 border flex items-center justify-center shrink-0",
          step.status === "done" ? "border-lp-green/30 bg-lp-green/5" :
          step.status === "error" ? "border-lp-red/30 bg-lp-red/5" :
          step.status === "running" ? "border-lp-amber/30 bg-lp-amber/5" :
          "border-border/60"
        )}>
          <Icon className={cn(
            "w-4 h-4",
            step.status === "done" ? "text-lp-green" :
            step.status === "error" ? "text-lp-red" :
            step.status === "running" ? "text-lp-amber animate-pulse" :
            "text-muted-foreground/50"
          )} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{subtitle}</p>
        </div>

        {/* Status badge */}
        {step.status === "running" && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-lp-amber">
            <Loader className="w-3 h-3 animate-spin" />
            running
          </div>
        )}
        {step.status === "done" && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-lp-green">
            <CheckCircle2 className="w-3 h-3" />
            {step.durationMs ? `${step.durationMs}ms` : "done"}
          </div>
        )}
        {step.status === "error" && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-lp-red">
            <XCircle className="w-3 h-3" />
            error
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {children}
        <Button
          size="sm"
          onClick={onRun}
          disabled={step.status === "running"}
          className="gap-2 text-xs"
        >
          {step.status === "running" ? (
            <><Loader className="w-3.5 h-3.5 animate-spin" /> Running…</>
          ) : (
            <><Zap className="w-3.5 h-3.5" /> Run Test</>
          )}
        </Button>

        {step.status === "error" && (
          <div className="border border-lp-red/30 bg-lp-red/5 px-3 py-2">
            <p className="text-[11px] font-mono text-lp-red/80 leading-relaxed break-all">
              {step.error}
            </p>
          </div>
        )}

        {step.status === "done" && step.result !== undefined && (
          <JsonOutput data={step.result} />
        )}
      </div>
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

function DebugInput({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground/50">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 bg-background border border-border/60 text-xs text-foreground font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-lp-amber/50 transition-colors"
      />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function idle(): StepState { return { status: "idle" }; }

export default function DebugPage() {
  // ── Scout ──────────────────────────────────────────────────────────────────
  const [scoutQuery, setScoutQuery] = useState("auto repair Chicago IL");
  const [scoutStep, setScoutStep] = useState<StepState>(idle());

  // ── Crawl ──────────────────────────────────────────────────────────────────
  const [crawlUrl, setCrawlUrl] = useState("https://thorntonsauto.net");
  const [crawlStep, setCrawlStep] = useState<StepState>(idle());

  // ── PageSpeed ──────────────────────────────────────────────────────────────
  const [psUrl, setPsUrl] = useState("https://thorntonsauto.net");
  const [psStep, setPsStep] = useState<StepState>(idle());

  // ── Writer ─────────────────────────────────────────────────────────────────
  const [writerLeadId, setWriterLeadId] = useState("lead_001");
  const [writerStep, setWriterStep] = useState<StepState>(idle());

  // ── Approve ────────────────────────────────────────────────────────────────
  const [approveEmailId, setApproveEmailId] = useState("");
  const [approveStep, setApproveStep] = useState<StepState>(idle());

  // ── Runner factory ─────────────────────────────────────────────────────────
  const run = useCallback(
    <T,>(
      setter: React.Dispatch<React.SetStateAction<StepState>>,
      fn: () => Promise<T>
    ) => async () => {
      setter({ status: "running" });
      const t0 = Date.now();
      try {
        const result = await fn();
        setter({ status: "done", durationMs: Date.now() - t0, result });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "response" in err
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? JSON.stringify((err as any).response?.data ?? err)
            : String(err);
        setter({ status: "error", error: msg });
      }
    },
    []
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl" style={{ animation: "lp-slide-up 0.3s ease both" }}>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-lp-amber" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Agent Debug Console</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Test each pipeline step individually using mock services.
          </p>
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-2 border border-lp-amber/20 bg-lp-amber/8 px-3 py-1.5">
          <Terminal className="w-3.5 h-3.5 text-lp-amber" strokeWidth={1.5} />
          <span className="text-[10px] font-mono text-lp-amber uppercase tracking-widest">dev only</span>
        </div>
      </div>

      {/* Grid — 2 col on large, 1 col on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Scout */}
        <StepCard
          index={0}
          icon={Search}
          title="Scout Agent"
          subtitle="DiscoverBusinesses → Google Maps / OSM fallback"
          step={scoutStep}
          onRun={run(setScoutStep, () =>
            requests.post("/debug/scout", { query: scoutQuery })
          )}
        >
          <DebugInput
            label="Search Query"
            value={scoutQuery}
            onChange={setScoutQuery}
            placeholder="e.g. auto repair Chicago IL"
          />
        </StepCard>

        {/* 2. Crawler (Playwright) */}
        <StepCard
          index={1}
          icon={Globe}
          title="Crawler (Playwright)"
          subtitle="PageCrawler.crawl() — SSL, mobile, CTA, forms"
          step={crawlStep}
          onRun={run(setCrawlStep, () =>
            requests.post("/debug/crawl", { url: crawlUrl })
          )}
        >
          <DebugInput
            label="URL"
            value={crawlUrl}
            onChange={setCrawlUrl}
            placeholder="https://example.com"
            type="url"
          />
        </StepCard>

        {/* 3. PageSpeed */}
        <StepCard
          index={2}
          icon={Zap}
          title="PageSpeed Insights"
          subtitle="Google PSI — desktop & mobile scores"
          step={psStep}
          onRun={run(setPsStep, () =>
            requests.post("/debug/pagespeed", { url: psUrl })
          )}
        >
          <DebugInput
            label="URL"
            value={psUrl}
            onChange={setPsUrl}
            placeholder="https://example.com"
            type="url"
          />
        </StepCard>

        {/* 4. Writer */}
        <StepCard
          index={3}
          icon={Mail}
          title="Writer Agent"
          subtitle="GenerateOutreachEmail → LLM (mock or real)"
          step={writerStep}
          onRun={run(setWriterStep, () =>
            requests.post("/debug/writer", { leadId: writerLeadId, wordLimit: 180 })
          )}
        >
          <DebugInput
            label="Lead ID"
            value={writerLeadId}
            onChange={setWriterLeadId}
            placeholder="e.g. lead_001"
          />
          <p className="text-[10px] text-muted-foreground/40 font-mono">
            Seeded IDs: lead_001 → lead_020
          </p>
        </StepCard>

        {/* 5. Approve & Send */}
        <StepCard
          index={4}
          icon={Send}
          title="Approve & Send Email"
          subtitle="ApproveAndSendEmail → Gmail (mock or real)"
          step={approveStep}
          onRun={run(setApproveStep, () =>
            requests.post("/debug/approve", {
              emailId: approveEmailId,
              recipientEmail: "test@sift.ai.dev",
            })
          )}
        >
          <DebugInput
            label="Email Draft ID"
            value={approveEmailId}
            onChange={setApproveEmailId}
            placeholder="Paste an email ID from the Approvals page"
          />
          <p className="text-[10px] text-muted-foreground/40 font-mono">
            Recipient is hard-coded to test@sift.ai.dev — no real emails sent in mock mode
          </p>
        </StepCard>

        {/* Tip card */}
        <div
          className="bg-card border border-border/40 p-5 flex flex-col gap-3"
          style={{ animation: "lp-slide-up 0.35s ease both", animationDelay: "0.35s" }}
        >
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em]">How to use</p>
          <div className="space-y-2 text-[11px] text-muted-foreground/60 font-mono leading-relaxed">
            <p><span className="text-lp-amber/70">›</span> All steps use mock services when MOCK_MAPS=true / MOCK_LLM=true</p>
            <p><span className="text-lp-amber/70">›</span> Run steps in order: Scout → Crawl → Writer → Approve</p>
            <p><span className="text-lp-amber/70">›</span> Copy a lead_id from Scout results into the Writer field</p>
            <p><span className="text-lp-amber/70">›</span> Copy an email id from the Writer result into Approve</p>
            <p><span className="text-lp-amber/70">›</span> Check backend logs for detailed step-by-step output</p>
          </div>
        </div>

      </div>
    </div>
  );
}
