/**
 * POST /api/contact — public contact form endpoint (no auth required).
 *
 * Rate-limited by publicLimiter in server.ts.
 * Sends an internal notification email via the configured emailSender.
 * Always returns { ok: true } — errors are logged, not exposed to caller.
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { logger } from "@/utils/logger";
import { env } from "@/config/env";
import type { IEmailSender } from "@/application/ports/IEmailSender";

// Injected at startup from server.ts so the contact router can reach the
// emailSender without it being part of the public container shape.
let _emailSender: IEmailSender | null = null;
export function registerContactEmailSender(sender: IEmailSender): void {
  _emailSender = sender;
}

const router = Router();

const contactSchema = z.object({
  name:    z.string().min(1).max(100).trim(),
  email:   z.string().email().max(200).trim(),
  message: z.string().min(1).max(2000).trim(),
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = contactSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid form data" },
    });
    return;
  }

  const { name, email, message } = parsed.data;

  // Log every submission so it's always recoverable from server logs
  logger.info({ from: email, name }, "Contact form submission received");

  // Best-effort email send — silently absorb failures so the sender
  // always sees a success state (prevents retry floods and info leakage)
  if (_emailSender) {
    try {
      const notifyAddress = env.GMAIL_SENDER_EMAIL || "hello@sift.ai";
      await _emailSender.send({
        to: notifyAddress,
        subject: `[sift.ai contact] ${name}`,
        body: `From: ${name} <${email}>\n\n${message}`,
        fromName: "sift.ai Contact Form",
      });
    } catch (err) {
      logger.error({ err, from: email }, "Contact form: email send failed (message still logged above)");
    }
  }

  res.json({ ok: true });
});

export { router as contactRouter };
