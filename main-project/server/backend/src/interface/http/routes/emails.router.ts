/**
 * GET   /api/emails               — list emails with lead context (returns EmailDTO[])
 * PATCH /api/emails/:id           — inline edit body/subject
 * POST  /api/emails/:id/approve   — approve → sets status APPROVED
 * POST  /api/emails/:id/reject    — reject  → sets status REJECTED
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { Lead as PrismaLead, Email as PrismaEmail } from "@prisma/client";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";
import { DraftNotFoundError, ValidationError } from "@/domain/errors";
import { toEmailDTO } from "@/interface/http/dto";
import type { Lead, Email, LeadStatus, EmailStatus, EmailCadence } from "@/domain/types";
import type { ApproveAndSendEmail } from "@/application/use-cases/email/ApproveAndSendEmail";

// Prisma returns null for missing fields; domain types use optional (undefined).
function prismaEmailToDomain(row: PrismaEmail): Email {
  return {
    id: row.id,
    leadId: row.leadId,
    cadence: row.cadence as EmailCadence,
    subject: row.subject,
    body: row.body,
    wordCount: row.wordCount,
    status: row.status as EmailStatus,
    createdAt: row.createdAt,
    // recipientEmail was missing — EmailRepository.toDomain() maps it correctly
    // but this local helper duplicated the shape without including it. Now fixed.
    ...(row.recipientEmail !== null && { recipientEmail: row.recipientEmail }),
    ...(row.approvedBy !== null && { approvedBy: row.approvedBy }),
    ...(row.sentAt !== null && { sentAt: row.sentAt }),
    ...(row.gmailMessageId !== null && { gmailMessageId: row.gmailMessageId }),
  };
}

function prismaLeadToDomain(row: PrismaLead): Lead {
  return {
    id: row.id,
    publicId: row.publicId,
    gmapsPlaceId: row.gmapsPlaceId,
    businessName: row.businessName,
    address: row.address,
    city: row.city,
    niche: row.niche,
    reviewCount: row.reviewCount,
    status: row.status as LeadStatus,
    discoveredAt: row.discoveredAt,
    runId: row.runId,
    ...(row.phone !== null && { phone: row.phone }),
    ...(row.website !== null && { website: row.website }),
    ...(row.contactEmail !== null && { contactEmail: row.contactEmail }),
    ...(row.googleRating !== null && { googleRating: row.googleRating }),
    ...(row.digitalScore !== null && { digitalScore: row.digitalScore }),
    ...(row.reviewSentiment !== null && { reviewSentiment: row.reviewSentiment }),
    ...(row.topIssue !== null && { topIssue: row.topIssue }),
    ...(row.reviewExcerpt !== null && { reviewExcerpt: row.reviewExcerpt }),
  };
}

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// Injected by container — avoids circular import between router and container
let _approveAndSend: ApproveAndSendEmail | null = null;
export function registerApproveAndSend(uc: ApproveAndSendEmail): void {
  _approveAndSend = uc;
}

const router = Router();

// ─── GET /api/emails ──────────────────────────────────────────────────────────

const listEmailsSchema = z.object({
  status: z
    .enum(["PENDING_APPROVAL", "APPROVED", "REJECTED", "SENT", "FAILED",
           "pending", "approved", "rejected", "sent"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listEmailsSchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ValidationError("Invalid query params"));
      return;
    }

    try {
      const { limit, offset, status } = parsed.data;

      // Map optional frontend-format status to Prisma uppercase values
      const STATUS_MAP: Record<string, string> = {
        pending: "PENDING_APPROVAL",
        approved: "APPROVED",
        rejected: "REJECTED",
        sent: "SENT",
      };
      const prismaStatus = status ? (STATUS_MAP[status] ?? status) : undefined;

      // Fetch emails with lead data in a single Prisma query to avoid N+1
      const rows = await container.prisma.email.findMany({
        where: prismaStatus
          ? { status: prismaStatus as "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SENT" | "FAILED" }
          : {},
        include: { lead: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });

      const dtos = rows.map((row) =>
        toEmailDTO(prismaEmailToDomain(row), prismaLeadToDomain(row.lead))
      );
      res.json({ ok: true, data: dtos });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/emails/:id ────────────────────────────────────────────────────

const editEmailSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
});

router.patch(
  "/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = editEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid body"));
      return;
    }
    const id = param(req, "id");
    try {
      const email = await container.emailRepo.findById(id);
      if (!email) {
        next(new DraftNotFoundError(id));
        return;
      }
      const updated = await container.emailRepo.update(id, {
        ...(parsed.data.subject !== undefined && { subject: parsed.data.subject }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
      });
      const lead = await container.leadRepo.findById(updated.leadId);
      res.json({ ok: true, data: toEmailDTO(updated, lead ?? undefined) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/emails/:id/approve ────────────────────────────────────────────

const approveSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

router.post(
  "/:id/approve",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = param(req, "id");
    const parsed = approveSchema.safeParse(req.body);
    const recipientEmail = parsed.success ? parsed.data.recipientEmail : undefined;

    try {
      if (_approveAndSend) {
        // Phase 6: send via Gmail (or mock) then mark SENT
        const updated = await _approveAndSend.execute({
          emailId: id,
          approvedBy: req.user?.email,
          recipientEmail,
        });
        const lead = await container.leadRepo.findById(updated.leadId);
        res.json({ ok: true, data: toEmailDTO(updated, lead ?? undefined) });
      } else {
        // Fallback: just mark APPROVED (pre-Phase 6 behaviour)
        const email = await container.emailRepo.findById(id);
        if (!email) { next(new DraftNotFoundError(id)); return; }
        const updated = await container.emailRepo.updateStatus(id, "APPROVED", {
          ...(req.user?.email !== undefined && { approvedBy: req.user.email }),
        });
        await container.leadRepo.update(updated.leadId, { status: "APPROVED" });
        const lead = await container.leadRepo.findById(updated.leadId);
        res.json({ ok: true, data: toEmailDTO(updated, lead ?? undefined) });
      }
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/emails/:id/reject ─────────────────────────────────────────────

router.post(
  "/:id/reject",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = param(req, "id");
    try {
      const email = await container.emailRepo.findById(id);
      if (!email) {
        next(new DraftNotFoundError(id));
        return;
      }
      const updated = await container.emailRepo.updateStatus(id, "REJECTED", {
        ...(req.user?.email !== undefined && { approvedBy: req.user.email }),
      });
      // Mark the lead as rejected
      await container.leadRepo.update(updated.leadId, { status: "REJECTED" });

      const lead = await container.leadRepo.findById(updated.leadId);
      res.json({ ok: true, data: toEmailDTO(updated, lead ?? undefined) });
    } catch (err) {
      next(err);
    }
  }
);

export { router as emailsRouter };
