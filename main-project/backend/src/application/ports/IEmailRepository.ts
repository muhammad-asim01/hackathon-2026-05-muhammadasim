import type { Email, EmailCadence, EmailStatus } from "@/domain/types";

export interface CreateEmailData {
  readonly leadId: string;
  readonly cadence: EmailCadence;
  readonly subject: string;
  readonly body: string;
  readonly wordCount: number;
  /** Auto-extracted from the business website during discovery */
  readonly recipientEmail?: string;
}

export interface IEmailRepository {
  create(data: CreateEmailData): Promise<Email>;
  findById(id: string): Promise<Email | null>;
  findByLeadId(leadId: string): Promise<readonly Email[]>;
  findPendingApprovals(options?: { limit?: number; offset?: number }): Promise<readonly Email[]>;
  update(id: string, data: Partial<Pick<Email, "body" | "subject" | "status" | "recipientEmail" | "approvedBy" | "sentAt" | "gmailMessageId">>): Promise<Email>;
  updateStatus(id: string, status: EmailStatus, data?: { recipientEmail?: string; approvedBy?: string; sentAt?: Date; gmailMessageId?: string }): Promise<Email>;
}
