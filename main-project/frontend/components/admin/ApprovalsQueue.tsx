"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Pencil, ChevronDown, ChevronUp, Send, Clock } from "lucide-react";
import { useApprovals, useApproveEmail, useRejectEmail, useEditEmail } from "@/hooks/useApprovals";
import { type EmailDraft, type DraftStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<DraftStatus, "warning" | "success" | "error" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  sent: "success",
};

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({ draft, index }: { draft: EmailDraft; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [subject, setSubject] = useState(draft.subject);
  // Recipient override — shown when draft has no stored recipientEmail
  const [recipientInput, setRecipientInput] = useState("");

  const approve = useApproveEmail();
  const reject = useRejectEmail();
  const edit = useEditEmail();

  const isResolved = draft.status === "approved" || draft.status === "rejected" || draft.status === "sent";
  const isPending = draft.status === "pending";
  const needsRecipient = !draft.recipientEmail;

  function handleApprove() {
    const to = draft.recipientEmail || recipientInput.trim() || undefined;
    approve.mutate({ id: draft.id, recipientEmail: to });
  }

  function handleSaveEdit() {
    edit.mutate(
      { id: draft.id, body, subject },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <div
      className={cn(
        "bg-card border transition-colors duration-200",
        draft.status === "approved" ? "border-lp-green/20 bg-lp-green/3"
          : draft.status === "rejected" ? "border-lp-red/15 opacity-60"
          : "border-border/60 hover:border-border"
      )}
      style={{ animation: "lp-slide-up 0.35s ease both", animationDelay: `${0.04 + index * 0.06}s` }}
    >
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{draft.businessName}</p>
            <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5 truncate">
              To: {draft.recipientEmail || "—"}
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[draft.status]} className="text-[10px] capitalize shrink-0">
            {draft.status}
          </Badge>
        </div>

        {/* Subject */}
        <div className="border-l-2 border-lp-amber/30 pl-3">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em] mb-0.5">Subject</p>
          {editing ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2 py-1 bg-background border border-lp-amber/30 text-xs text-foreground font-mono focus:outline-none"
            />
          ) : (
            <p className="text-xs text-foreground leading-relaxed">{draft.subject}</p>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/40 font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(draft.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </span>
          <span>{draft.wordCount} words</span>
        </div>
      </div>

      {/* Expand / collapse body */}
      <div className="border-t border-border/40">
        <button
          onClick={() => { setExpanded((v) => !v); if (editing) setEditing(false); }}
          className="w-full flex items-center justify-between px-5 py-2.5 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <span>{expanded ? "Hide email body" : "Preview email body"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="px-5 pb-4" style={{ animation: "lp-slide-up 0.2s ease both" }}>
            {editing ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="w-full px-3 py-2.5 bg-background border border-lp-amber/30 text-xs text-foreground font-mono leading-relaxed focus:outline-none resize-none"
              />
            ) : (
              <div className="bg-background border border-border/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                {draft.body}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isPending && !isResolved && (
        <div className="border-t border-border/40 px-5 py-3.5 space-y-3">
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={edit.isPending}
                className="gap-1.5 text-xs"
              >
                {edit.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(false); setBody(draft.body); setSubject(draft.subject); }}
                className="gap-1.5 text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <>
              {/* Recipient override — only shown when no email was auto-extracted */}
              {needsRecipient && (
                <div className="space-y-1">
                  <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40">
                    Recipient email <span className="text-lp-amber/60">(required to send)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="owner@business.com"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    className="w-full bg-background border border-border/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-lp-amber/40 transition-colors"
                  />
                </div>
              )}

              {/* CTA row */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approve.isPending || (needsRecipient && !recipientInput.trim())}
                  className="gap-1.5 text-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {approve.isPending ? "Sending…" : "Approve & Send"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditing(true); setExpanded(true); }}
                  className="gap-1.5 text-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reject.mutate(draft.id)}
                  disabled={reject.isPending}
                  className="gap-1.5 text-xs text-lp-red hover:text-lp-red hover:bg-lp-red/10"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Discard
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resolved state */}
      {isResolved && (
        <div
          className={cn(
            "border-t px-5 py-3.5 flex items-center gap-2 text-xs font-medium",
            draft.status === "approved" || draft.status === "sent"
              ? "border-lp-green/20 text-lp-green"
              : "border-lp-red/20 text-lp-red"
          )}
          style={{ animation: "lp-step-done 0.35s cubic-bezier(0.34,1.56,0.64,1) both" }}
        >
          {draft.status === "approved" || draft.status === "sent" ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          {draft.status === "sent"
            ? draft.recipientEmail
              ? `Sent to ${draft.recipientEmail}`
              : "Email sent"
            : draft.status === "approved"
              ? "Email sent"
              : "Draft discarded"}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterTab = "pending" | "approved" | "rejected" | "sent" | "all";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "sent",     label: "Sent"     },
  { key: "rejected", label: "Rejected" },
  { key: "all",      label: "All"      },
];

export function ApprovalsQueue() {
  const [tab, setTab] = useState<FilterTab>("pending");
  // Fetch up to 200 items — approval queue uses client-side tab filtering across
  // all statuses so it must load the full set, not rely on the backend default of 10.
  const { data: allDrafts = [], isLoading } = useApprovals({ limit: 200 });

  const displayed = tab === "all" ? allDrafts : allDrafts.filter((d) => d.status === tab);
  const pendingCount = allDrafts.filter((d) => d.status === "pending").length;

  function countFor(key: FilterTab) {
    return key === "all" ? allDrafts.length : allDrafts.filter((d) => d.status === key).length;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve AI-drafted outreach before anything sends.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="shrink-0 flex items-center gap-2 bg-lp-amber/8 border border-lp-amber/20 px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-lp-amber animate-pulse" />
            <span className="text-xs font-semibold text-lp-amber">{pendingCount} pending</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border/60 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "shrink-0 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-lp-amber text-lp-amber"
                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            {t.label}
            <span className={cn(
              "ml-1.5 font-mono tabular-nums",
              tab === t.key ? "text-lp-amber/70" : "text-muted-foreground/30"
            )}>
              {isLoading ? "…" : countFor(t.key)}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/60 p-5 h-32 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="border border-border/60 flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-muted-foreground/50">No {tab} drafts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((d, i) => (
            <DraftCard key={d.id} draft={d} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
