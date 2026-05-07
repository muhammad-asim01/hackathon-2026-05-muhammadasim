import type { ILLMProvider } from "@/application/ports/ILLMProvider";
import type { Review, ReviewSummary } from "@/domain/types";
import { InternalError } from "@/domain/errors";
import { logger } from "@/utils/logger";

export interface AnalyzeReviewsInput {
  readonly businessName: string;
  readonly reviews: readonly Review[];
}

// Cached system prompt — Anthropic charges ~0 tokens on cache hits (90%+ hit rate)
const SYSTEM_PROMPT = `You are a business intelligence analyst.
Given Google reviews for a local business, extract a structured summary.
Rules:
- positives: 2–3 bullet phrases of what customers praise most
- negatives: 2–3 bullet phrases of genuine complaints or concerns (be honest)
- Pick the single most useful review excerpt for an outreach email (authentic voice, max 30 words)
- avgRating: computed mean of the provided ratings (1 decimal place)
Return ONLY valid JSON: { "positives": string[], "negatives": string[], "excerpt": string, "avgRating": number }`;

interface LLMJsonResponse {
  positives?: unknown;
  negatives?: unknown;
  excerpt?: unknown;
  avgRating?: unknown;
}

function parseReviewJson(raw: string): {
  positives: string[];
  negatives: string[];
  excerpt: string;
  avgRating: number;
} {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  let parsed: LLMJsonResponse;
  try {
    parsed = JSON.parse(cleaned) as LLMJsonResponse;
  } catch {
    throw new InternalError("LLM did not return valid JSON for review summary", {
      raw: raw.slice(0, 200),
    });
  }

  const positives = Array.isArray(parsed.positives)
    ? (parsed.positives as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const negatives = Array.isArray(parsed.negatives)
    ? (parsed.negatives as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const excerpt = typeof parsed.excerpt === "string" ? parsed.excerpt : "";
  const avgRating = typeof parsed.avgRating === "number" ? parsed.avgRating : 0;

  return { positives, negatives, excerpt, avgRating };
}

export class AnalyzeReviews {
  constructor(private readonly llm: ILLMProvider) {}

  async execute(input: AnalyzeReviewsInput): Promise<ReviewSummary & { excerpt: string }> {
    const { businessName, reviews } = input;
    const log = logger.child({ useCase: "AnalyzeReviews", businessName });

    if (reviews.length === 0) {
      log.info("No reviews — returning empty summary");
      return { positives: [], negatives: [], avgRating: 0, count: 0, excerpt: "" };
    }

    // Take up to 10 most recent reviews (sorted by time desc)
    const sorted = [...reviews].sort((a, b) => b.time - a.time).slice(0, 10);

    const reviewText = sorted
      .map(
        (r, i) =>
          `[${i + 1}] Rating: ${r.rating}/5\nReview: "${r.text.trim()}"`
      )
      .join("\n\n");

    const userMessage = `Business: ${businessName}\n\nReviews:\n${reviewText}\n\nReturn JSON summary.`;

    log.info({ reviewCount: sorted.length }, "Analyzing reviews");

    const raw = await this.llm.generate(SYSTEM_PROMPT, [
      { role: "user", content: userMessage },
    ]);

    const parsed = parseReviewJson(raw);
    const avgRating =
      sorted.reduce((sum, r) => sum + r.rating, 0) / sorted.length;

    const summary: ReviewSummary & { excerpt: string } = {
      positives: parsed.positives,
      negatives: parsed.negatives,
      avgRating: Math.round(avgRating * 10) / 10,
      count: reviews.length,
      excerpt: parsed.excerpt,
    };

    log.info({ avgRating: summary.avgRating }, "Review analysis complete");
    return summary;
  }
}
