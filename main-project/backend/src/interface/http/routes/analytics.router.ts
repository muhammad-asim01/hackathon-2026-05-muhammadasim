/**
 * GET /api/analytics/summary          — KPI totals
 * GET /api/analytics/funnel           — lead status funnel
 * GET /api/analytics/score-distribution — digitalScore bucket histogram
 * GET /api/analytics/niche-breakdown  — per-niche lead/sent counts
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";

const router = Router();

// ─── GET /api/analytics/summary ──────────────────────────────────────────────

router.get(
  "/summary",
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [
        totalLeads,
        totalSent,
        totalReplies,
        totalRuns,
        avgScore,
      ] = await Promise.all([
        container.prisma.lead.count(),
        container.prisma.email.count({ where: { status: "SENT" } }),
        container.prisma.lead.count({ where: { status: "REPLIED" } }),
        container.prisma.pipelineRun.count({ where: { status: "SUCCEEDED" } }),
        container.prisma.lead.aggregate({
          _avg: { digitalScore: true },
          where: { digitalScore: { not: null } },
        }),
      ]);

      res.json({
        ok: true,
        data: {
          totalLeadsAllTime: totalLeads,
          totalSent,
          totalReplies,
          overallReplyRate: totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0,
          avgDigitalScore: Math.round(avgScore._avg.digitalScore ?? 0),
          runsCompleted: totalRuns,
          avgLeadsPerRun: totalRuns > 0 ? Math.round(totalLeads / totalRuns) : 0,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analytics/funnel ────────────────────────────────────────────────

router.get(
  "/funnel",
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [discovered, drafted, approved, sent, replied] = await Promise.all([
        container.prisma.lead.count({
          where: { status: { notIn: [] } }, // all leads = discovered
        }),
        container.prisma.lead.count({
          where: {
            status: {
              in: ["EMAIL_DRAFTED", "PENDING_APPROVAL", "APPROVED", "EMAIL_SENT", "REPLIED"],
            },
          },
        }),
        container.prisma.lead.count({
          where: { status: { in: ["APPROVED", "EMAIL_SENT", "REPLIED"] } },
        }),
        container.prisma.email.count({ where: { status: "SENT" } }),
        container.prisma.lead.count({ where: { status: "REPLIED" } }),
      ]);

      res.json({
        ok: true,
        data: [
          { name: "Discovered",  value: discovered  },
          { name: "Drafted",     value: drafted      },
          { name: "Approved",    value: approved     },
          { name: "Sent",        value: sent         },
          { name: "Replied",     value: replied      },
        ],
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analytics/score-distribution ────────────────────────────────────

router.get(
  "/score-distribution",
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leads = await container.prisma.lead.findMany({
        select: { digitalScore: true },
        where: { digitalScore: { not: null } },
      });

      const buckets: Record<string, number> = {
        "0–10": 0, "11–20": 0, "21–30": 0, "31–40": 0,
        "41–50": 0, "51–60": 0, "61–75": 0,
      };

      for (const { digitalScore } of leads) {
        if (digitalScore === null) continue;
        if (digitalScore <= 10)      buckets["0–10"]++;
        else if (digitalScore <= 20) buckets["11–20"]++;
        else if (digitalScore <= 30) buckets["21–30"]++;
        else if (digitalScore <= 40) buckets["31–40"]++;
        else if (digitalScore <= 50) buckets["41–50"]++;
        else if (digitalScore <= 60) buckets["51–60"]++;
        else                         buckets["61–75"]++;
      }

      const data = Object.entries(buckets).map(([range, count]) => ({ range, count }));
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/analytics/niche-breakdown ──────────────────────────────────────
// Note: Prisma groupBy does NOT support relation filters in `where` (e.g.
// `emails: { some: ... }`). Those queries throw at runtime. The sent-count is
// derived via findMany + manual aggregation instead.

router.get(
  "/niche-breakdown",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawLimit  = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit  = Number.isFinite(rawLimit)  && rawLimit  > 0 ? Math.min(rawLimit, 100) : 10;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    try {
      // Count total distinct niches (for pagination total)
      const allNicheGroups = await container.prisma.lead.groupBy({
        by: ["niche"],
        _count: { id: true },
      });
      const total = allNicheGroups.length;

      if (total === 0) {
        res.json({ ok: true, data: { data: [], total: 0 } });
        return;
      }

      // Paginated slice — orderBy lead count desc, apply take + skip
      const byNiche = await container.prisma.lead.groupBy({
        by: ["niche"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: limit,
        skip: offset,
      });

      if (byNiche.length === 0) {
        res.json({ ok: true, data: { data: [], total } });
        return;
      }

      const niches = byNiche.map((r) => r.niche);

      // Approved leads per niche (simple status filter — groupBy safe)
      const approvedByNiche = await container.prisma.lead.groupBy({
        by: ["niche"],
        _count: { id: true },
        where: {
          niche: { in: niches },
          status: { in: ["APPROVED", "EMAIL_SENT", "REPLIED"] },
        },
      });

      // Sent count: relation filter NOT allowed in groupBy — use findMany instead.
      // Fetch niche for each lead that has at least one SENT email, then aggregate.
      const sentLeads = await container.prisma.lead.findMany({
        where: {
          niche: { in: niches },
          emails: { some: { status: "SENT" } },
        },
        select: { niche: true },
      });

      // Build lookup maps
      const approvedMap = new Map(approvedByNiche.map((r) => [r.niche, r._count.id]));
      const sentMap = new Map<string, number>();
      for (const { niche } of sentLeads) {
        sentMap.set(niche, (sentMap.get(niche) ?? 0) + 1);
      }

      const data = byNiche.map((r) => ({
        niche: r.niche,
        leads: r._count.id,
        approved: approvedMap.get(r.niche) ?? 0,
        sent: sentMap.get(r.niche) ?? 0,
      }));

      res.json({ ok: true, data: { data, total } });
    } catch (err) {
      next(err);
    }
  }
);

export { router as analyticsRouter };
