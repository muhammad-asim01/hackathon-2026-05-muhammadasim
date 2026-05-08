/**
 * GET   /api/leads          — list leads with filters (returns LeadDTO[])
 * GET   /api/leads/:id      — get single lead with emails
 * PATCH /api/leads/:id      — update status / fields
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";
import { LeadNotFoundError, ValidationError } from "@/domain/errors";
import type { LeadStatus } from "@/domain/types";
import { toLeadDTO, toEmailDTO } from "@/interface/http/dto";

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const router = Router();

// ─── GET /api/leads ───────────────────────────────────────────────────────────

const listLeadsSchema = z.object({
  // Accept frontend status values ("new", "contacted") or backend values
  status: z.string().optional(),
  niche: z.string().optional(),
  city: z.string().optional(),
  scoreLte: z.coerce.number().int().min(0).max(100).optional(),
  scoreGte: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Maps frontend status filter values to backend status arrays
function resolveStatusFilter(status: string): LeadStatus | readonly LeadStatus[] {
  switch (status) {
    case "new":
      return ["DISCOVERED", "AUDITED", "EMAIL_DRAFTED", "PENDING_APPROVAL"];
    case "contacted":
      return ["EMAIL_SENT", "REPLIED"];
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    case "cold":
      return ["COLD", "SKIPPED"];
    default:
      // Reject unknown status values — prevents arbitrary strings reaching the DB query
      throw new ValidationError(`Unknown status filter: "${status}". Valid values: new, contacted, approved, rejected, cold`);
  }
}

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listLeadsSchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ValidationError("Invalid query params"));
      return;
    }

    const { status, niche, city, scoreLte, scoreGte, search, page, limit } = parsed.data;

    try {
      const result = await container.leadRepo.findMany({
        ...(status !== undefined && { status: resolveStatusFilter(status) }),
        ...(niche !== undefined && { niche }),
        ...(city !== undefined && { city }),
        ...(search !== undefined && { search }),
        ...(scoreLte !== undefined || scoreGte !== undefined
          ? {
              digitalScore: {
                ...(scoreLte !== undefined && { lte: scoreLte }),
                ...(scoreGte !== undefined && { gte: scoreGte }),
              },
            }
          : {}),
        page,
        limit,
      });

      res.json({
        ok: true,
        data: {
          data: result.leads.map(toLeadDTO),
          meta: { total: result.total, page, limit },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/leads/:id ───────────────────────────────────────────────────────

router.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = param(req, "id");
    try {
      const lead = await container.leadRepo.findById(id);
      if (!lead) {
        next(new LeadNotFoundError(id));
        return;
      }
      const emails = await container.emailRepo.findByLeadId(lead.id);
      res.json({
        ok: true,
        data: {
          ...toLeadDTO(lead),
          emails: emails.map((e) => toEmailDTO(e, lead)),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/leads/:id ─────────────────────────────────────────────────────

const updateLeadSchema = z.object({
  status: z
    .enum([
      "DISCOVERED", "AUDITED", "EMAIL_DRAFTED", "PENDING_APPROVAL",
      "APPROVED", "EMAIL_SENT", "REPLIED", "COLD", "SKIPPED", "REJECTED",
    ])
    .optional(),
  topIssue: z.string().max(200).optional(),
  reviewExcerpt: z.string().max(500).optional(),
  reviewSentiment: z.enum(["positive", "mixed", "negative"]).optional(),
});

router.patch(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid body"));
      return;
    }
    const id = param(req, "id");
    try {
      const existing = await container.leadRepo.findById(id);
      if (!existing) {
        next(new LeadNotFoundError(id));
        return;
      }
      const updated = await container.leadRepo.update(id, {
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.topIssue !== undefined && { topIssue: parsed.data.topIssue }),
        ...(parsed.data.reviewExcerpt !== undefined && { reviewExcerpt: parsed.data.reviewExcerpt }),
        ...(parsed.data.reviewSentiment !== undefined && { reviewSentiment: parsed.data.reviewSentiment }),
      });
      res.json({ ok: true, data: toLeadDTO(updated) });
    } catch (err) {
      next(err);
    }
  }
);

export { router as leadsRouter };
