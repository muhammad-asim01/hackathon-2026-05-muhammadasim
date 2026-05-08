/**
 * Public routes — no authentication required.
 *
 * GET /api/public/audit/:publicId
 *   Returns audit data for the prospect-facing page at /audit/[publicId].
 *   Includes lead data + audit scores (when available from Analyst phase).
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { container } from "@/config/container";
import { NotFoundError } from "@/domain/errors";
import type { PublicAuditDTO } from "@/interface/http/dto";

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

const router = Router();

router.get(
  "/audit/:publicId",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const publicId = param(req, "publicId");

    try {
      const lead = await container.leadRepo.findByPublicId(publicId);
      if (!lead) {
        next(new NotFoundError(`Audit not found: ${publicId}`));
        return;
      }

      // Try to load audit scores (populated by Analyst agent in Phase 5).
      // Returns null if Analyst hasn't run yet — frontend handles gracefully.
      const audit = await container.prisma.audit.findUnique({
        where: { leadId: lead.id },
      });

      const dto: PublicAuditDTO = {
        id: lead.id,
        publicId: lead.publicId,
        businessName: lead.businessName,
        address: lead.address,
        city: lead.city,
        niche: lead.niche,
        reviewCount: lead.reviewCount,
        ...(lead.phone !== undefined && { phone: lead.phone }),
        ...(lead.website !== undefined && { website: lead.website }),
        ...(lead.googleRating !== undefined && { googleRating: lead.googleRating }),
        ...(lead.digitalScore !== undefined && { digitalScore: lead.digitalScore }),
        ...(lead.reviewSentiment !== undefined && { reviewSentiment: lead.reviewSentiment }),
        ...(lead.topIssue !== undefined && { topIssue: lead.topIssue }),
        ...(lead.reviewExcerpt !== undefined && { reviewExcerpt: lead.reviewExcerpt }),
        // Analyst scores (null until Phase 5)
        ...(audit?.pageSpeedScore !== undefined && audit.pageSpeedScore !== null && {
          pageSpeedScore: audit.pageSpeedScore,
        }),
        ...(audit?.mobileScore !== undefined && audit.mobileScore !== null && {
          mobileScore: audit.mobileScore,
        }),
        ...(audit !== null && {
          hasSSL: audit.hasSSL,
          hasMobileMeta: audit.hasMobileMeta,
        }),
      };

      res.json({ ok: true, data: dto });
    } catch (err) {
      next(err);
    }
  }
);

export { router as publicRouter };
