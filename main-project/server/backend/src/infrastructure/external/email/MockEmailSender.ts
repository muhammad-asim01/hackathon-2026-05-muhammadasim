import type { IEmailSender, SendEmailInput } from "@/application/ports/IEmailSender";
import { logger } from "@/utils/logger";

/**
 * No-op email sender used when Gmail credentials are not configured.
 * Logs the email content and returns a fake messageId so the full
 * approve → SENT flow works end-to-end without a real Gmail account.
 */
export class MockEmailSender implements IEmailSender {
  async send(input: SendEmailInput): Promise<{ messageId: string }> {
    const messageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    logger.info(
      {
        to: input.to,
        subject: input.subject,
        fromName: input.fromName,
        bodyPreview: input.body.slice(0, 80),
        messageId,
      },
      "MockEmailSender: simulated send (no Gmail credentials configured)"
    );
    return { messageId };
  }
}
