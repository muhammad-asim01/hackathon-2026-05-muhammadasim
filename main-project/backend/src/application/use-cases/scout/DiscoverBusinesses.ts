import type { IMapsService, PlaceResult } from "@/application/ports/IMapsService";
import type { ILeadRepository } from "@/application/ports/ILeadRepository";
import { logger } from "@/utils/logger";

export interface DiscoverBusinessesInput {
  readonly query: string;
}

export interface DiscoverBusinessesOutput {
  readonly places: readonly PlaceResult[];
  readonly skippedExisting: number;
}

// ─── Lead quality thresholds ─────────────────────────────────────────────────

/** Skip businesses that already have a strong online presence */
const MAX_RATING = 4.8;
const MAX_REVIEW_COUNT = 400;

export class DiscoverBusinesses {
  constructor(
    private readonly mapsService: IMapsService,
    private readonly leadRepo: ILeadRepository
  ) {}

  async execute(input: DiscoverBusinessesInput): Promise<DiscoverBusinessesOutput> {
    const log = logger.child({ useCase: "DiscoverBusinesses", query: input.query });

    log.info("Starting place search");
    const searchResults = await this.mapsService.searchPlaces(input.query);
    log.info(
      { count: searchResults.length, source: searchResults[0]?.source ?? "unknown" },
      "Search returned places"
    );

    const newPlaces: PlaceResult[] = [];
    let skippedExisting = 0;

    for (const result of searchResults) {
      // Dedup against existing leads by gmapsPlaceId
      const existing = await this.leadRepo.findByGmapsPlaceId(result.placeId);
      if (existing !== null) {
        log.info({ placeId: result.placeId }, "Skipping — already in database");
        skippedExisting++;
        continue;
      }

      // Get enriched details: city, phone, website (cached after first call)
      const details = await this.mapsService.getPlaceDetails(result.placeId);

      log.info({ details }, "Details");
      // ── Quality filter: only target businesses with weak online presence ──
      if (!details.website) {
        log.info(
          { placeId: details.placeId, name: details.businessName },
          "Skipping — no website (nothing to audit)"
        );
        continue;
      }

      if ((details.googleRating ?? 0) >= MAX_RATING) {
        log.info(
          { placeId: details.placeId, name: details.businessName, rating: details.googleRating },
          `Skipping — rating >= ${MAX_RATING} (strong online presence)`
        );
        continue;
      }

      if (details.reviewCount >= MAX_REVIEW_COUNT) {
        log.info(
          { placeId: details.placeId, name: details.businessName, reviewCount: details.reviewCount },
          `Skipping — review count >= ${MAX_REVIEW_COUNT} (established business)`
        );
        continue;
      }

      // Email extraction happens in the Analyst phase (Playwright-based, reuses
      // the crawler session). Scout only qualifies businesses; contactEmail will
      // be populated after the website crawl in AuditWebsite.
      log.info(
        {
          placeId: details.placeId,
          name: details.businessName,
          rating: details.googleRating,
          reviews: details.reviewCount,
          website: details.website,
          source: details.source ?? "unknown",
        },
        "New business qualified for outreach"
      );
      newPlaces.push(details);
    }

    log.info(
      { new: newPlaces.length, skippedExisting },
      "Discovery complete"
    );

    return { places: newPlaces, skippedExisting };
  }
}
