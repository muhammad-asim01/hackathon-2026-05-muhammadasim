import type { PrismaClient, Email as PrismaEmail } from "@prisma/client";
import type { IEmailRepository, CreateEmailData } from "@/application/ports/IEmailRepository";
import type { Email, EmailStatus } from "@/domain/types";

function toDomain(row: PrismaEmail): Email {
  return {
    id: row.id,
    leadId: row.leadId,
    cadence: row.cadence,
    subject: row.subject,
    body: row.body,
    wordCount: row.wordCount,
    status: row.status,
    createdAt: row.createdAt,
    ...(row.recipientEmail !== null && { recipientEmail: row.recipientEmail }),
    ...(row.approvedBy !== null && { approvedBy: row.approvedBy }),
    ...(row.sentAt !== null && { sentAt: row.sentAt }),
    ...(row.gmailMessageId !== null && { gmailMessageId: row.gmailMessageId }),
  };
}

export class EmailRepository implements IEmailRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateEmailData): Promise<Email> {
    const row = await this.prisma.email.create({
      data: {
        leadId: data.leadId,
        cadence: data.cadence,
        subject: data.subject,
        body: data.body,
        wordCount: data.wordCount,
        ...(data.recipientEmail !== undefined && { recipientEmail: data.recipientEmail }),
      },
    });
    return toDomain(row);
  }

  async findById(id: string): Promise<Email | null> {
    const row = await this.prisma.email.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByLeadId(leadId: string): Promise<readonly Email[]> {
    const rows = await this.prisma.email.findMany({
      where: { leadId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async findPendingApprovals(
    options?: { limit?: number; offset?: number }
  ): Promise<readonly Email[]> {
    const rows = await this.prisma.email.findMany({
      where: { status: "PENDING_APPROVAL" },
      orderBy: { createdAt: "asc" },
      ...(options?.limit !== undefined && { take: options.limit }),
      ...(options?.offset !== undefined && { skip: options.offset }),
    });
    return rows.map(toDomain);
  }

  async update(
    id: string,
    data: Partial<Pick<Email, "body" | "subject" | "status" | "recipientEmail" | "approvedBy" | "sentAt" | "gmailMessageId">>
  ): Promise<Email> {
    const row = await this.prisma.email.update({
      where: { id },
      data: {
        ...(data.body !== undefined && { body: data.body }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.recipientEmail !== undefined && { recipientEmail: data.recipientEmail }),
        ...(data.approvedBy !== undefined && { approvedBy: data.approvedBy }),
        ...(data.sentAt !== undefined && { sentAt: data.sentAt }),
        ...(data.gmailMessageId !== undefined && { gmailMessageId: data.gmailMessageId }),
      },
    });
    return toDomain(row);
  }

  async updateStatus(
    id: string,
    status: EmailStatus,
    data?: { recipientEmail?: string; approvedBy?: string; sentAt?: Date; gmailMessageId?: string }
  ): Promise<Email> {
    const row = await this.prisma.email.update({
      where: { id },
      data: {
        status,
        ...(data?.recipientEmail !== undefined && { recipientEmail: data.recipientEmail }),
        ...(data?.approvedBy !== undefined && { approvedBy: data.approvedBy }),
        ...(data?.sentAt !== undefined && { sentAt: data.sentAt }),
        ...(data?.gmailMessageId !== undefined && { gmailMessageId: data.gmailMessageId }),
      },
    });
    return toDomain(row);
  }
}
