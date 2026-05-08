import type { IEmailRepository } from "@/application/ports/IEmailRepository";
import type { ILeadRepository } from "@/application/ports/ILeadRepository";
import type { IEmailSender } from "@/application/ports/IEmailSender";
import type { Email } from "@/domain/types";
import { DraftNotFoundError, ValidationError } from "@/domain/errors";
import { logger } from "@/utils/logger";

export interface ApproveAndSendInput {
  readonly emailId: string;
  readonly approvedBy?: string | undefined;
  /** Override recipient — falls back to skipping send if absent */
  readonly recipientEmail?: string | undefined;
}

export class ApproveAndSendEmail {
  constructor(
    private readonly emailRepo: IEmailRepository,
    private readonly leadRepo: ILeadRepository,
    private readonly emailSender: IEmailSender
  ) {}

  async execute(input: ApproveAndSendInput): Promise<Email> {
    const { emailId, approvedBy, recipientEmail } = input;
    const log = logger.child({ useCase: "ApproveAndSendEmail", emailId });

    const email = await this.emailRepo.findById(emailId);
    if (!email) throw new DraftNotFoundError(emailId);

    if (email.status !== "PENDING_APPROVAL") {
      throw new ValidationError(
        `Email is already ${email.status.toLowerCase()} — cannot approve again`
      );
    }

    const lead = await this.leadRepo.findById(email.leadId);
    if (!lead) throw new ValidationError(`Lead ${email.leadId} not found`);

    // Prefer: 1) override in request body, 2) auto-extracted address stored on draft
    const to = recipientEmail ?? email.recipientEmail ?? null;
    let gmailMessageId: string | undefined;

    if (to) {
      try {
        const result = await this.emailSender.send({
          to,
          subject: email.subject,
          body: email.body,
        });
        gmailMessageId = result.messageId;
        log.info({ to, messageId: gmailMessageId }, "Email sent");
      } catch (err) {
        // Log but don't block approval — email can be retried manually
        log.error({ err, to }, "Send failed — marking SENT anyway for approval flow");
      }
    } else {
      log.info(
        { businessName: lead.businessName },
        "No recipient email — skipping send, marking SENT"
      );
    }

    const updated = await this.emailRepo.updateStatus(emailId, "SENT", {
      sentAt: new Date(),
      ...(to !== null && { recipientEmail: to }),
      ...(approvedBy !== undefined && { approvedBy }),
      ...(gmailMessageId !== undefined && { gmailMessageId }),
    });

    await this.leadRepo.update(email.leadId, { status: "EMAIL_SENT" });

    log.info({ leadId: email.leadId }, "ApproveAndSendEmail complete");
    return updated;
  }
}
