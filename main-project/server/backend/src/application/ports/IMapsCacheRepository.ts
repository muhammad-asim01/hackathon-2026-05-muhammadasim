export interface CachedPlace {
  readonly placeId: string;
  readonly data: unknown;
  readonly fetchedAt: Date;
  readonly expiresAt: Date;
}

export interface IMapsCacheRepository {
  get(placeId: string): Promise<CachedPlace | null>;
  set(placeId: string, data: unknown): Promise<void>;
  deleteExpired(): Promise<number>;
}
