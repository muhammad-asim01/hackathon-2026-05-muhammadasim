import type { PrismaClient, Prisma, Lead as PrismaLead } from "@prisma/client";
import type { ILeadRepository, LeadFilter, CreateLeadData } from "@/application/ports/ILeadRepository";
import type { Lead } from "@/domain/types";

function toDomain(row: PrismaLead): Lead {
  return {
    id: row.id,
    publicId: row.publicId,
    gmapsPlaceId: row.gmapsPlaceId,
    businessName: row.businessName,
    address: row.address,
    city: row.city,
    niche: row.niche,
    reviewCount: row.reviewCount,
    status: row.status,
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

export class LeadRepository implements ILeadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Lead | null> {
    const row = await this.prisma.lead.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByPublicId(publicId: string): Promise<Lead | null> {
    const row = await this.prisma.lead.findUnique({ where: { publicId } });
    return row ? toDomain(row) : null;
  }

  async findByGmapsPlaceId(gmapsPlaceId: string): Promise<Lead | null> {
    const row = await this.prisma.lead.findUnique({ where: { gmapsPlaceId } });
    return row ? toDomain(row) : null;
  }

  async findMany(filter: LeadFilter): Promise<{ leads: readonly Lead[]; total: number }> {
    const {
      status,
      niche,
      city,
      digitalScore,
      search,
      page = 1,
      limit = 20,
    } = filter;

    const where: Prisma.LeadWhereInput = {};

    if (status !== undefined) {
      where.status = (Array.isArray(status)
        ? { in: [...status] }
        : status) as NonNullable<Prisma.LeadWhereInput["status"]>;
    }
    if (niche !== undefined) where.niche = { equals: niche, mode: "insensitive" };
    if (city !== undefined) where.city = { contains: city, mode: "insensitive" };
    if (digitalScore !== undefined) {
      where.digitalScore = {};
      if (digitalScore.lte !== undefined) where.digitalScore.lte = digitalScore.lte;
      if (digitalScore.gte !== undefined) where.digitalScore.gte = digitalScore.gte;
    }
    if (search !== undefined) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { niche: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { discoveredAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { leads: rows.map(toDomain), total };
  }

  async create(data: CreateLeadData): Promise<Lead> {
    const row = await this.prisma.lead.create({
      data: {
        gmapsPlaceId: data.gmapsPlaceId,
        businessName: data.businessName,
        address: data.address,
        city: data.city,
        niche: data.niche,
        reviewCount: data.reviewCount,
        runId: data.runId,
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.googleRating !== undefined && { googleRating: data.googleRating }),
        ...(data.digitalScore !== undefined && { digitalScore: data.digitalScore }),
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    data: Partial<Omit<Lead, "id" | "publicId" | "runId" | "discoveredAt">>
  ): Promise<Lead> {
    const row = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.businessName !== undefined && { businessName: data.businessName }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.niche !== undefined && { niche: data.niche }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail }),
        ...(data.googleRating !== undefined && { googleRating: data.googleRating }),
        ...(data.reviewCount !== undefined && { reviewCount: data.reviewCount }),
        ...(data.digitalScore !== undefined && { digitalScore: data.digitalScore }),
        ...(data.reviewSentiment !== undefined && { reviewSentiment: data.reviewSentiment }),
        ...(data.topIssue !== undefined && { topIssue: data.topIssue }),
        ...(data.reviewExcerpt !== undefined && { reviewExcerpt: data.reviewExcerpt }),
      },
    });
    return toDomain(row);
  }
}
