"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Plus, X, Check, AlertTriangle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyFieldProps {
  label: string;
  hint: string;
  placeholder: string;
}

// ─── API Key field with show/hide (local state only — not persisted to backend) ─

function ApiKeyField({ label, hint, placeholder }: ApiKeyFieldProps) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const isSet = value.length > 0;

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 border-b border-border/40 last:border-0">
      <div className="sm:w-52 shrink-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/40 mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <div className="flex-1 relative">
        <input
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full h-9 px-3 pr-10 bg-background border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-lp-amber/40 font-mono transition-colors"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        >
          {visible ? (
            <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} />
          ) : (
            <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
          )}
        </button>
        {isSet && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="w-1.5 h-1.5 rounded-full bg-lp-green" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Controlled tag input ──────────────────────────────────────────────────────

function TagInput({
  label,
  hint,
  tags,
  onTagsChange,
}: {
  label: string;
  hint: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onTagsChange([...tags, val]);
    }
    setInput("");
  }

  function removeTag(tag: string) {
    onTagsChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 border-b border-border/40 last:border-0">
      <div className="sm:w-52 shrink-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/40 mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 h-6 px-2 bg-border/30 border border-border/60 text-[11px] text-muted-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTag(); }
            }}
            className="flex-1 h-8 px-3 bg-background border border-border/60 text-xs text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-lp-amber/40 transition-colors"
          />
          <button
            type="button"
            onClick={addTag}
            className="h-8 px-3 border border-border/60 hover:border-lp-amber/40 text-muted-foreground/50 hover:text-lp-amber transition-colors flex items-center"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Controlled text row ──────────────────────────────────────────────────────

function TextRow({
  label,
  hint,
  placeholder,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 border-b border-border/40 last:border-0">
      <div className="sm:w-52 shrink-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/40 mt-0.5 leading-relaxed">{hint}</p>
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 h-9 px-3 bg-background border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-lp-amber/40 transition-colors"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsForm() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [scoreThreshold, setScoreThreshold] = useState("75");
  const [dailyQuota, setDailyQuota] = useState("200");
  const [emailWordLimit, setEmailWordLimit] = useState("180");
  const [fromName, setFromName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");
  const [targetNiches, setTargetNiches] = useState<string[]>([
    "Auto Repair", "Plumbing", "Pet Grooming", "Restaurant", "HVAC", "Dentist",
  ]);
  const [targetCities, setTargetCities] = useState<string[]>(["Chicago, IL", "Austin, TX"]);

  useEffect(() => {
    if (!settings) return;
    setScoreThreshold(String(settings.scoreThreshold));
    setDailyQuota(String(settings.dailyQuota));
    setEmailWordLimit(String(settings.emailWordLimit));
    setFromName(settings.fromName ?? "");
    setReplyToEmail(settings.replyToEmail ?? "");
    if (settings.targetNiches.length > 0) setTargetNiches(settings.targetNiches);
    if (settings.targetCities.length > 0) setTargetCities(settings.targetCities);
  }, [settings]);

  function handleSave() {
    updateSettings.mutate({
      scoreThreshold: parseInt(scoreThreshold, 10) || 75,
      dailyQuota: parseInt(dailyQuota, 10) || 200,
      emailWordLimit: parseInt(emailWordLimit, 10) || 180,
      fromName: fromName.trim() || null,
      replyToEmail: replyToEmail.trim() || null,
      targetNiches,
      targetCities,
    });
  }

  const isSaving = updateSettings.isPending;
  const isSaved = updateSettings.isSuccess;

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pipeline defaults, API credentials, and outreach preferences.
        </p>
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em]">
            API Credentials
          </p>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-lp-amber/8 border border-lp-amber/20">
            <AlertTriangle className="w-3 h-3 text-lp-amber" strokeWidth={1.5} />
            <span className="text-[9px] text-lp-amber font-semibold uppercase tracking-[0.1em]">
              Stored in .env only
            </span>
          </div>
        </div>
        {/* form wrapper silences browser warnings about password inputs outside forms */}
        <form onSubmit={(e) => e.preventDefault()} autoComplete="off">
          <div className="border border-border/60 bg-card divide-y divide-border/40">
            <ApiKeyField
              label="Anthropic API Key"
              hint="Claude Sonnet 4.6 — Writer Agent"
              placeholder="sk-ant-api03-…"
            />
            <ApiKeyField
              label="Google Maps API Key"
              hint="Places API — Scout Agent"
              placeholder="AIzaSy…"
            />
            <ApiKeyField
              label="PageSpeed Insights Key"
              hint="Web Vitals — Analyst Agent"
              placeholder="AIzaSy…"
            />
            <ApiKeyField
              label="Google Sheets API Key"
              hint="CRM logging — Tracker Agent"
              placeholder="AIzaSy…"
            />
            <ApiKeyField
              label="Gmail OAuth Client ID"
              hint="Send email — Reporter Agent"
              placeholder="…apps.googleusercontent.com"
            />
            <ApiKeyField
              label="Gmail OAuth Client Secret"
              hint="Paired with Client ID above"
              placeholder="GOCSPX-…"
            />
          </div>
        </form>
      </div>

      {/* Pipeline defaults */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em]">
          Pipeline Defaults
        </p>
        {isLoading ? (
          <div className="border border-border/60 bg-card px-5 py-6 flex items-center gap-3 text-muted-foreground">
            <Loader className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} />
            <span className="text-xs font-mono">Loading…</span>
          </div>
        ) : (
          <div className="border border-border/60 bg-card">
            <TextRow
              label="Score threshold"
              hint="Leads scoring above this are skipped"
              placeholder="75"
              type="number"
              value={scoreThreshold}
              onChange={setScoreThreshold}
            />
            <TextRow
              label="Daily quota"
              hint="Maximum Maps API calls per day (free tier = 200)"
              placeholder="200"
              type="number"
              value={dailyQuota}
              onChange={setDailyQuota}
            />
            <TextRow
              label="Email word limit"
              hint="Target length for AI-drafted emails"
              placeholder="180"
              type="number"
              value={emailWordLimit}
              onChange={setEmailWordLimit}
            />
            <TextRow
              label="From name"
              hint="Displayed in the email From field"
              placeholder="Your name or agency"
              value={fromName}
              onChange={setFromName}
            />
            <TextRow
              label="Reply-to email"
              hint="Where prospect replies are delivered"
              placeholder="you@example.com"
              type="email"
              value={replyToEmail}
              onChange={setReplyToEmail}
            />
          </div>
        )}
      </div>

      {/* Target niches */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em]">
          Target Niches
        </p>
        <div className="border border-border/60 bg-card">
          <TagInput
            label="Niches"
            hint="Sectors the Scout Agent will query on each run"
            tags={targetNiches}
            onTagsChange={setTargetNiches}
          />
        </div>
      </div>

      {/* Target markets */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-lp-amber uppercase tracking-[0.14em]">
          Target Markets
        </p>
        <div className="border border-border/60 bg-card">
          <TagInput
            label="Cities"
            hint="Cities included in Scout Agent queries"
            tags={targetCities}
            onTagsChange={setTargetCities}
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "gap-2 transition-all duration-200",
            isSaved && "bg-lp-green/20 text-lp-green border border-lp-green/30 hover:bg-lp-green/25"
          )}
        >
          {isSaving ? (
            <>
              <Loader className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              Saving…
            </>
          ) : isSaved ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : (
            "Save Settings"
          )}
        </Button>
      </div>
    </div>
  );
}
