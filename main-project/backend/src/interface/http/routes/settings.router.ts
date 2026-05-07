/**
 * GET   /api/settings   — return the singleton Settings row (upsert on first call)
 * PATCH /api/settings   — update configurable pipeline settings
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";
import { ValidationError } from "@/domain/errors";

const router = Router();

// ─── GET /api/settings ────────────────────────────────────────────────────────

router.get(
  "/",
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await container.prisma.settings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton" },
        update: {},
      });
      res.json({ ok: true, data: settings });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/settings ──────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  dailyQuota: z.number().int().min(1).max(200).optional(),
  scoreThreshold: z.number().int().min(0).max(100).optional(),
  emailWordLimit: z.number().int().min(50).max(500).optional(),
  targetNiches: z.array(z.string().min(1).max(100)).optional(),
  targetCities: z.array(z.string().min(1).max(100)).optional(),
  fromName: z.string().max(100).nullable().optional(),
  replyToEmail: z.string().email().nullable().optional(),
});

router.patch(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid body"));
      return;
    }

    try {
      const updated = await container.prisma.settings.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          ...(parsed.data.dailyQuota !== undefined && { dailyQuota: parsed.data.dailyQuota }),
          ...(parsed.data.scoreThreshold !== undefined && { scoreThreshold: parsed.data.scoreThreshold }),
          ...(parsed.data.emailWordLimit !== undefined && { emailWordLimit: parsed.data.emailWordLimit }),
          ...(parsed.data.targetNiches !== undefined && { targetNiches: parsed.data.targetNiches }),
          ...(parsed.data.targetCities !== undefined && { targetCities: parsed.data.targetCities }),
          ...(parsed.data.fromName !== undefined && { fromName: parsed.data.fromName }),
          ...(parsed.data.replyToEmail !== undefined && { replyToEmail: parsed.data.replyToEmail }),
        },
        update: {
          ...(parsed.data.dailyQuota !== undefined && { dailyQuota: parsed.data.dailyQuota }),
          ...(parsed.data.scoreThreshold !== undefined && { scoreThreshold: parsed.data.scoreThreshold }),
          ...(parsed.data.emailWordLimit !== undefined && { emailWordLimit: parsed.data.emailWordLimit }),
          ...(parsed.data.targetNiches !== undefined && { targetNiches: parsed.data.targetNiches }),
          ...(parsed.data.targetCities !== undefined && { targetCities: parsed.data.targetCities }),
          ...(parsed.data.fromName !== undefined && { fromName: parsed.data.fromName }),
          ...(parsed.data.replyToEmail !== undefined && { replyToEmail: parsed.data.replyToEmail }),
        },
      });
      res.json({ ok: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export { router as settingsRouter };
