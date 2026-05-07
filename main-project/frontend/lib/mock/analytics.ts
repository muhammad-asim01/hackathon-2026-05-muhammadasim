// ─── Analytics data types ─────────────────────────────────────────────────────

export interface FunnelStep {
  name: string;
  value: number;
  fill: string;
}

export interface ReplyRatePoint {
  date: string; // "May 1" etc.
  sent: number;
  replies: number;
  rate: number; // percentage 0–100
}

export interface ScoreDistBucket {
  range: string; // "0–10", "11–20", etc.
  count: number;
}

export interface NicheBreakdown {
  niche: string;
  leads: number;
  approved: number;
  sent: number;
}

// ─── Funnel data ──────────────────────────────────────────────────────────────

export const FUNNEL_DATA: FunnelStep[] = [
  { name: "Discovered",   value: 100, fill: "rgba(202,177,106,0.25)" },
  { name: "Scored ≤ 75",  value: 23,  fill: "rgba(202,177,106,0.40)" },
  { name: "Drafted",      value: 20,  fill: "rgba(202,177,106,0.60)" },
  { name: "Approved",     value: 12,  fill: "rgba(202,177,106,0.80)" },
  { name: "Sent",         value: 9,   fill: "rgba(202,177,106,1.00)" },
];

// ─── Reply rate (last 14 days) ────────────────────────────────────────────────

export const REPLY_RATE_DATA: ReplyRatePoint[] = [
  { date: "Apr 22", sent: 1, replies: 0, rate: 0   },
  { date: "Apr 23", sent: 2, replies: 1, rate: 50  },
  { date: "Apr 24", sent: 0, replies: 0, rate: 0   },
  { date: "Apr 25", sent: 3, replies: 0, rate: 0   },
  { date: "Apr 26", sent: 1, replies: 1, rate: 100 },
  { date: "Apr 27", sent: 2, replies: 0, rate: 0   },
  { date: "Apr 28", sent: 0, replies: 0, rate: 0   },
  { date: "Apr 29", sent: 2, replies: 1, rate: 50  },
  { date: "Apr 30", sent: 3, replies: 2, rate: 67  },
  { date: "May 1",  sent: 1, replies: 0, rate: 0   },
  { date: "May 2",  sent: 2, replies: 1, rate: 50  },
  { date: "May 3",  sent: 3, replies: 1, rate: 33  },
  { date: "May 4",  sent: 2, replies: 1, rate: 50  },
  { date: "May 5",  sent: 1, replies: 0, rate: 0   },
];

// ─── Score distribution ───────────────────────────────────────────────────────

export const SCORE_DIST_DATA: ScoreDistBucket[] = [
  { range: "0–10",   count: 2  },
  { range: "11–20",  count: 5  },
  { range: "21–30",  count: 7  },
  { range: "31–40",  count: 9  },
  { range: "41–50",  count: 6  },
  { range: "51–60",  count: 5  },
  { range: "61–75",  count: 3  },
];

// ─── Niche breakdown ──────────────────────────────────────────────────────────

export const NICHE_BREAKDOWN: NicheBreakdown[] = [
  { niche: "Auto Repair",    leads: 6,  approved: 3, sent: 2 },
  { niche: "Pet Grooming",   leads: 5,  approved: 2, sent: 2 },
  { niche: "HVAC",           leads: 8,  approved: 0, sent: 0 },
  { niche: "Landscaping",    leads: 4,  approved: 1, sent: 1 },
  { niche: "Restaurant",     leads: 3,  approved: 2, sent: 2 },
  { niche: "Dentist",        leads: 2,  approved: 0, sent: 0 },
];

// ─── Summary KPIs ─────────────────────────────────────────────────────────────

export const ANALYTICS_SUMMARY = {
  totalLeadsAllTime: 100,
  totalSent: 9,
  totalReplies: 3,
  overallReplyRate: 33.3,
  avgDigitalScore: 41.2,
  runsCompleted: 4,
  avgLeadsPerRun: 5.75,
};
