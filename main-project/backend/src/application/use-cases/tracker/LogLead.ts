import type { ILeadRepository } from "@/application/ports/ILeadRepository";
import type { IEmailRepository } from "@/application/ports/IEmailRepository";
import type { Email } from "@/domain/types";
import { logger } from "@/utils/logger";

export interface LogLeadInput {
  readonly leadId: string;
  readonly email: {
    readonly subject: string;
    readonly body: string;
    readonly wordCount: number;
    /** Auto-extracted from the business website during discovery */
    readonly recipientEmail?: string;
  };
}

export interface LogLeadOutput {
  readonly email: Email;
}

export class LogLead {
  constructor(
    private readonly leadRepo: ILeadRepository,
    private readonly emailRepo: IEmailRepository
  ) {}

  async execute(input: LogLeadInput): Promise<LogLeadOutput> {
    const { leadId, email } = input;
    const log = logger.child({ useCase: "LogLead", leadId });

    const savedEmail = await this.emailRepo.create({
      leadId,
      cadence: "DAY_0",
      subject: email.subject,
      body: email.body,
      wordCount: email.wordCount,
      ...(email.recipientEmail !== undefined && { recipientEmail: email.recipientEmail }),
    });

    await this.leadRepo.update(leadId, { status: "PENDING_APPROVAL" });

    log.info(
      { leadId, emailId: savedEmail.id, recipientEmail: email.recipientEmail ?? null },
      email.recipientEmail
        ? `Email draft persisted with recipientEmail "${email.recipientEmail}"`
        : "Email draft persisted — no recipientEmail (admin must supply at approval)"
    );

    return { email: savedEmail };
  }
}
