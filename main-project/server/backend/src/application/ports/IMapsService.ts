export interface Review {
  readonly authorName: string;
  readonly rating: number;
  readonly text: string;
  readonly time: number; // unix timestamp
}

export interface PlaceResult {
  readonly placeId: string;
  readonly businessName: string;
  readonly address: string;
  readonly city: string;
  readonly niche: string;
  readonly phone?: string;
  readonly website?: string;
  readonly googleRating?: number;
  readonly reviewCount: number;
  readonly reviews?: readonly Review[];
  /** Auto-extracted from website — set during discovery, stored on the email draft */
  readonly contactEmail?: string;
  /** Where this result came from — for logging and provenance */
  readonly source?: "google_places" | "osm_fallback" | "mock";
}

export interface IMapsService {
  searchPlaces(query: string): Promise<readonly PlaceResult[]>;
  getPlaceDetails(placeId: string): Promise<PlaceResult>;
}
