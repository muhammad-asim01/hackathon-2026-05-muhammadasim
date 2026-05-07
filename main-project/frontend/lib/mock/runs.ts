// ─── Pipeline Run types ───────────────────────────────────────────────────────

export type RunStatus = "running" | "complete" | "failed";
export type AgentStatus = "pending" | "running" | "done" | "failed";
export type EventLevel = "info" | "success" | "warning" | "error";

export interface RunEvent {
  id: string;
  agentName: string;
  message: string;
  level: EventLevel;
  timestamp: string; // ISO
}

export interface AgentProgress {
  scout: AgentStatus;
  analyst: AgentStatus;
  writer: AgentStatus;
  tracker: AgentStatus;
  reporter: AgentStatus;
}

export interface PipelineRun {
  id: string;
  niche: string;
  city: string;
  status: RunStatus;
  startedAt: string; // ISO
  completedAt: string | null; // ISO
  leadsFound: number;
  leadsScored: number;
  leadsDrafted: number;
  leadsEmailed: number;
  agentProgress: AgentProgress;
  events: RunEvent[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_RUNS: PipelineRun[] = [
  {
    id: "run_001",
    niche: "Auto Repair",
    city: "Chicago, IL",
    status: "complete",
    startedAt: "2026-05-04T07:00:02Z",
    completedAt: "2026-05-04T07:08:44Z",
    leadsFound: 23,
    leadsScored: 6,
    leadsDrafted: 6,
    leadsEmailed: 3,
    agentProgress: {
      scout: "done",
      analyst: "done",
      writer: "done",
      tracker: "done",
      reporter: "done",
    },
    events: [
      {
        id: "evt_001_01",
        agentName: "Scout",
        message: 'Querying Google Maps for "Auto Repair" in Chicago, IL',
        level: "info",
        timestamp: "2026-05-04T07:00:05Z",
      },
      {
        id: "evt_001_02",
        agentName: "Scout",
        message: "Found 23 places — 8 within bounding box, deduplicating against 30-day cache",
        level: "info",
        timestamp: "2026-05-04T07:00:14Z",
      },
      {
        id: "evt_001_03",
        agentName: "Scout",
        message: "After dedup: 23 unique leads queued for analysis",
        level: "success",
        timestamp: "2026-05-04T07:00:21Z",
      },
      {
        id: "evt_001_04",
        agentName: "Analyst",
        message: "Crawling Thornton's Auto Repair (thorntonsauto.net)",
        level: "info",
        timestamp: "2026-05-04T07:01:03Z",
      },
      {
        id: "evt_001_05",
        agentName: "Analyst",
        message: "thorntonsauto.net → PageSpeed 18, Mobile 31, no HTTPS — score: 22",
        level: "warning",
        timestamp: "2026-05-04T07:01:39Z",
      },
      {
        id: "evt_001_06",
        agentName: "Analyst",
        message: "Crawling Bellini's Ristorante (bellinischi.com)",
        level: "info",
        timestamp: "2026-05-04T07:02:01Z",
      },
      {
        id: "evt_001_07",
        agentName: "Analyst",
        message: "bellinischi.com → PageSpeed 34, Mobile 29 — score: 41",
        level: "warning",
        timestamp: "2026-05-04T07:02:28Z",
      },
      {
        id: "evt_001_08",
        agentName: "Analyst",
        message: "17 leads scored above 75 — skipped",
        level: "info",
        timestamp: "2026-05-04T07:04:55Z",
      },
      {
        id: "evt_001_09",
        agentName: "Analyst",
        message: "6 leads qualify for outreach (score ≤ 75)",
        level: "success",
        timestamp: "2026-05-04T07:05:02Z",
      },
      {
        id: "evt_001_10",
        agentName: "Writer",
        message: "Drafting email for Thornton's Auto Repair — referencing HTTPS issue + review",
        level: "info",
        timestamp: "2026-05-04T07:05:14Z",
      },
      {
        id: "evt_001_11",
        agentName: "Writer",
        message: "Draft complete: 182 words — trimming to 180 target",
        level: "info",
        timestamp: "2026-05-04T07:05:31Z",
      },
      {
        id: "evt_001_12",
        agentName: "Writer",
        message: "All 6 email drafts generated and queued for approval",
        level: "success",
        timestamp: "2026-05-04T07:06:44Z",
      },
      {
        id: "evt_001_13",
        agentName: "Tracker",
        message: "Logging 6 leads to Google Sheets CRM",
        level: "info",
        timestamp: "2026-05-04T07:07:02Z",
      },
      {
        id: "evt_001_14",
        agentName: "Tracker",
        message: "Leads appended to Sheets tab 'Leads 2026-05' — rows 47–52",
        level: "success",
        timestamp: "2026-05-04T07:07:19Z",
      },
      {
        id: "evt_001_15",
        agentName: "Reporter",
        message: "Sending daily summary email to muhammadasim.code@gmail.com",
        level: "info",
        timestamp: "2026-05-04T07:08:30Z",
      },
      {
        id: "evt_001_16",
        agentName: "Reporter",
        message: "Summary delivered — run complete",
        level: "success",
        timestamp: "2026-05-04T07:08:44Z",
      },
    ],
  },
  {
    id: "run_002",
    niche: "Pet Grooming",
    city: "Chicago, IL",
    status: "complete",
    startedAt: "2026-05-04T14:00:01Z",
    completedAt: "2026-05-04T14:11:22Z",
    leadsFound: 19,
    leadsScored: 5,
    leadsDrafted: 5,
    leadsEmailed: 2,
    agentProgress: {
      scout: "done",
      analyst: "done",
      writer: "done",
      tracker: "done",
      reporter: "done",
    },
    events: [
      {
        id: "evt_002_01",
        agentName: "Scout",
        message: 'Querying Google Maps for "Pet Grooming" in Chicago, IL',
        level: "info",
        timestamp: "2026-05-04T14:00:05Z",
      },
      {
        id: "evt_002_02",
        agentName: "Scout",
        message: "Found 19 places — applying 30-day dedup cache",
        level: "info",
        timestamp: "2026-05-04T14:00:18Z",
      },
      {
        id: "evt_002_03",
        agentName: "Analyst",
        message: "Analyzing 19 websites — running PageSpeed + mobile checks",
        level: "info",
        timestamp: "2026-05-04T14:01:00Z",
      },
      {
        id: "evt_002_04",
        agentName: "Analyst",
        message: "14 leads above score threshold — skipped",
        level: "info",
        timestamp: "2026-05-04T14:06:11Z",
      },
      {
        id: "evt_002_05",
        agentName: "Analyst",
        message: "5 leads qualify (score ≤ 75)",
        level: "success",
        timestamp: "2026-05-04T14:06:14Z",
      },
      {
        id: "evt_002_06",
        agentName: "Writer",
        message: "Generating 5 personalized drafts via Claude Sonnet 4.6",
        level: "info",
        timestamp: "2026-05-04T14:06:30Z",
      },
      {
        id: "evt_002_07",
        agentName: "Writer",
        message: "All 5 drafts complete — queued in approval inbox",
        level: "success",
        timestamp: "2026-05-04T14:09:02Z",
      },
      {
        id: "evt_002_08",
        agentName: "Tracker",
        message: "Synced 5 leads to Google Sheets — rows 53–57",
        level: "success",
        timestamp: "2026-05-04T14:10:41Z",
      },
      {
        id: "evt_002_09",
        agentName: "Reporter",
        message: "Daily summary sent — run complete",
        level: "success",
        timestamp: "2026-05-04T14:11:22Z",
      },
    ],
  },
  {
    id: "run_003",
    niche: "HVAC",
    city: "Chicago, IL",
    status: "failed",
    startedAt: "2026-05-05T07:00:00Z",
    completedAt: "2026-05-05T07:03:17Z",
    leadsFound: 31,
    leadsScored: 8,
    leadsDrafted: 0,
    leadsEmailed: 0,
    agentProgress: {
      scout: "done",
      analyst: "done",
      writer: "failed",
      tracker: "pending",
      reporter: "pending",
    },
    events: [
      {
        id: "evt_003_01",
        agentName: "Scout",
        message: 'Querying Google Maps for "HVAC" in Chicago, IL',
        level: "info",
        timestamp: "2026-05-05T07:00:04Z",
      },
      {
        id: "evt_003_02",
        agentName: "Scout",
        message: "Found 31 places — 12 new after dedup",
        level: "success",
        timestamp: "2026-05-05T07:00:22Z",
      },
      {
        id: "evt_003_03",
        agentName: "Analyst",
        message: "Scoring 12 leads",
        level: "info",
        timestamp: "2026-05-05T07:00:40Z",
      },
      {
        id: "evt_003_04",
        agentName: "Analyst",
        message: "8 leads qualify for outreach",
        level: "success",
        timestamp: "2026-05-05T07:01:58Z",
      },
      {
        id: "evt_003_05",
        agentName: "Writer",
        message: "Calling Claude Sonnet 4.6 API",
        level: "info",
        timestamp: "2026-05-05T07:02:10Z",
      },
      {
        id: "evt_003_06",
        agentName: "Writer",
        message: "API error: 529 Overloaded — retry 1/3",
        level: "warning",
        timestamp: "2026-05-05T07:02:31Z",
      },
      {
        id: "evt_003_07",
        agentName: "Writer",
        message: "API error: 529 Overloaded — retry 2/3",
        level: "warning",
        timestamp: "2026-05-05T07:02:52Z",
      },
      {
        id: "evt_003_08",
        agentName: "Writer",
        message: "API error: 529 Overloaded — max retries exceeded. Writer agent failed.",
        level: "error",
        timestamp: "2026-05-05T07:03:17Z",
      },
    ],
  },
  {
    id: "run_004",
    niche: "Landscaping",
    city: "Austin, TX",
    status: "complete",
    startedAt: "2026-05-05T08:00:01Z",
    completedAt: "2026-05-05T08:14:09Z",
    leadsFound: 27,
    leadsScored: 4,
    leadsDrafted: 4,
    leadsEmailed: 1,
    agentProgress: {
      scout: "done",
      analyst: "done",
      writer: "done",
      tracker: "done",
      reporter: "done",
    },
    events: [
      {
        id: "evt_004_01",
        agentName: "Scout",
        message: 'Querying Google Maps for "Landscaping" in Austin, TX',
        level: "info",
        timestamp: "2026-05-05T08:00:05Z",
      },
      {
        id: "evt_004_02",
        agentName: "Scout",
        message: "Found 27 places — 14 new after dedup",
        level: "success",
        timestamp: "2026-05-05T08:00:29Z",
      },
      {
        id: "evt_004_03",
        agentName: "Analyst",
        message: "Running PageSpeed + mobile audit on 14 sites",
        level: "info",
        timestamp: "2026-05-05T08:01:00Z",
      },
      {
        id: "evt_004_04",
        agentName: "Analyst",
        message: "10 leads above score threshold — skipped",
        level: "info",
        timestamp: "2026-05-05T08:05:44Z",
      },
      {
        id: "evt_004_05",
        agentName: "Analyst",
        message: "4 leads qualify (score ≤ 75)",
        level: "success",
        timestamp: "2026-05-05T08:05:48Z",
      },
      {
        id: "evt_004_06",
        agentName: "Writer",
        message: "Drafting 4 personalized emails",
        level: "info",
        timestamp: "2026-05-05T08:06:00Z",
      },
      {
        id: "evt_004_07",
        agentName: "Writer",
        message: "All 4 drafts ready",
        level: "success",
        timestamp: "2026-05-05T08:10:22Z",
      },
      {
        id: "evt_004_08",
        agentName: "Tracker",
        message: "Logged 4 leads to Sheets — rows 58–61",
        level: "success",
        timestamp: "2026-05-05T08:12:55Z",
      },
      {
        id: "evt_004_09",
        agentName: "Reporter",
        message: "Summary delivered — run complete",
        level: "success",
        timestamp: "2026-05-05T08:14:09Z",
      },
    ],
  },
];
