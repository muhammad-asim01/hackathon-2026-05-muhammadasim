import type { PrismaClient } from "@prisma/client";
import type { IMapsCacheRepository, CachedPlace } from "@/application/ports/IMapsCacheRepository";

// 30-day TTL enforced here — callers never set expiresAt directly.
const CACHE_TTL_DAYS = 30;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class MapsCacheRepository implements IMapsCacheRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(placeId: string): Promise<CachedPlace | null> {
    const row = await this.prisma.mapsCache.findUnique({ where: { placeId } });
    if (!row) return null;
    // Treat expired entries as cache miss — don't delete inline (let deleteExpired() handle bulk cleanup)
    if (row.expiresAt < new Date()) return null;
    return {
      placeId: row.placeId,
      data: row.data,
      fetchedAt: row.fetchedAt,
      expiresAt: row.expiresAt,
    };
  }

  async set(placeId: string, data: unknown): Promise<void> {
    const fetchedAt = new Date();
    const expiresAt = addDays(fetchedAt, CACHE_TTL_DAYS);
    await this.prisma.mapsCache.upsert({
      where: { placeId },
      create: { placeId, data: data as object, fetchedAt, expiresAt },
      update: { data: data as object, fetchedAt, expiresAt },
    });
  }

  async deleteExpired(): Promise<number> {
    const { count } = await this.prisma.mapsCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
