import type { Lead, LeadStatus } from "@/domain/types";

export interface LeadFilter {
  readonly status?: LeadStatus | readonly LeadStatus[];
  readonly niche?: string;
  readonly city?: string;
  readonly digitalScore?: { readonly lte?: number; readonly gte?: number };
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface CreateLeadData {
  readonly gmapsPlaceId: string;
  readonly businessName: string;
  readonly address: string;
  readonly city: string;
  readonly niche: string;
  readonly phone?: string;
  readonly website?: string;
  readonly googleRating?: number;
  readonly reviewCount: number;
  readonly digitalScore?: number;
  readonly runId: string;
}

export interface ILeadRepository {
  findById(id: string): Promise<Lead | null>;
  findByPublicId(publicId: string): Promise<Lead | null>;
  findByGmapsPlaceId(gmapsPlaceId: string): Promise<Lead | null>;
  findMany(filter: LeadFilter): Promise<{ leads: readonly Lead[]; total: number }>;
  create(data: CreateLeadData): Promise<Lead>;
  update(id: string, data: Partial<Omit<Lead, "id" | "publicId" | "runId" | "discoveredAt">>): Promise<Lead>;
}
