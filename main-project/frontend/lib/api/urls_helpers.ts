// All backend API URL paths in one place.
// The axios instance in lib/api.ts prepends NEXT_PUBLIC_API_URL automatically.

export const API_URLS = {
  leads: {
    list: "/leads",
    detail: (id: string) => `/leads/${id}`,
    update: (id: string) => `/leads/${id}`,
  },
  runs: {
    list: "/pipeline/runs",
    detail: (id: string) => `/pipeline/runs/${id}`,
    events: (id: string) => `/pipeline/runs/${id}/events`,
    start: "/pipeline/run",
  },
  emails: {
    list: "/emails",
    update: (id: string) => `/emails/${id}`,
    approve: (id: string) => `/emails/${id}/approve`,
    reject: (id: string) => `/emails/${id}/reject`,
  },
  analytics: {
    summary: "/analytics/summary",
    funnel: "/analytics/funnel",
    scoreDistribution: "/analytics/score-distribution",
    nicheBreakdown: "/analytics/niche-breakdown",
  },
  settings: "/settings",
  public: {
    audit: (publicId: string) => `/public/audit/${publicId}`,
  },
} as const;
