import type { ILLMProvider } from "@/application/ports/ILLMProvider";
import type { PlaceResult } from "@/application/ports/IMapsService";
import { EmailWordCount } from "@/domain/value-objects/EmailWordCount";
import { InternalError } from "@/domain/errors";
import { logger } from "@/utils/logger";

export interface AuditContext {
  readonly topIssue?: string;
  readonly pageSpeedScore?: number;
  readonly mobileScore?: number;
  readonly hasSSL?: boolean;
}

export interface ReviewContext {
  readonly positives: readonly string[];
  readonly negatives: readonly string[];
  readonly avgRating: number;
  readonly excerpt?: string;
}

export interface GenerateEmailInput {
  readonly place: PlaceResult;
  readonly wordLimit: number;
  readonly auditFindings?: AuditContext;
  readonly reviewSummary?: ReviewContext;
}

export interface GeneratedEmail {
  readonly subject: string;
  readonly body: string;
  readonly wordCount: number;
}

// Prompt instructs the model to return JSON — deterministic extraction.
function buildSystemPrompt(wordLimit: number): string {
  return `You are an expert cold-email copywriter for a digital agency.
Your task: write a highly personalised outreach email to a local business owner.

Rules:
- Maximum ${wordLimit} words in the body (strict — count them)
- Reference at least one specific, real detail from the business data provided
- Close with an open-ended question
- Never mention competitors
- No platitudes ("I hope this email finds you well", "I wanted to reach out")
- Tone: direct, human, helpful — not salesy
- Return ONLY valid JSON with keys: "subject" (string) and "body" (string)`;
}

function buildUserMessage(
  place: PlaceResult,
  wordLimit: number,
  audit?: AuditContext,
  review?: ReviewContext
): string {
  const lines = [
    `Business: ${place.businessName}`,
    `Location: ${place.city} (${place.address})`,
    `Industry: ${place.niche}`,
  ];
  if (place.googleRating !== undefined) lines.push(`Google Rating: ${place.googleRating}/5`);
  if (place.reviewCount > 0) lines.push(`Review Count: ${place.reviewCount}`);
  if (place.website !== undefined) lines.push(`Website: ${place.website}`);
  else lines.push("Website: none detected");
  if (place.phone !== undefined) lines.push(`Phone: ${place.phone}`);

  if (audit) {
    lines.push("\n--- Digital Audit Findings ---");
    if (audit.topIssue) lines.push(`Top issue: ${audit.topIssue}`);
    if (audit.pageSpeedScore !== undefined) lines.push(`Desktop PageSpeed score: ${audit.pageSpeedScore}/100`);
    if (audit.mobileScore !== undefined) lines.push(`Mobile PageSpeed score: ${audit.mobileScore}/100`);
    if (audit.hasSSL === false) lines.push("SSL: missing (no HTTPS)");
  }

  if (review) {
    lines.push("\n--- Customer Review Intelligence ---");
    if (review.avgRating > 0) lines.push(`Average rating: ${review.avgRating}/5`);
    if (review.positives.length > 0) lines.push(`What customers love: ${review.positives.join("; ")}`);
    if (review.negatives.length > 0) lines.push(`Common complaints: ${review.negatives.join("; ")}`);
    if (review.excerpt) lines.push(`Notable review excerpt: "${review.excerpt}"`);
  }

  return (
    lines.join("\n") +
    `\n\nWrite a ${wordLimit}-word (maximum) outreach email body and a subject line. ` +
    `Reference at least one specific audit finding or review insight above. Return JSON only.`
  );
}

interface LLMJsonResponse {
  subject?: unknown;
  body?: unknown;
}

function parseEmailJson(raw: string): { subject: string; body: string } {
  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  let parsed: LLMJsonResponse;
  try {
    parsed = JSON.parse(cleaned) as LLMJsonResponse;
  } catch {
    throw new InternalError("LLM did not return valid JSON for email draft", {
      raw: raw.slice(0, 200),
    });
  }
  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new InternalError('LLM JSON missing "subject" or "body" keys', {
      keys: Object.keys(parsed),
    });
  }
  return { subject: parsed.subject, body: parsed.body };
}

export class GenerateOutreachEmail {
  constructor(private readonly llm: ILLMProvider) {}

  async execute(input: GenerateEmailInput): Promise<GeneratedEmail> {
    const { place, wordLimit, auditFindings, reviewSummary } = input;
    const log = logger.child({ useCase: "GenerateOutreachEmail", placeId: place.placeId });
    const systemPrompt = buildSystemPrompt(wordLimit);
    const userMessage = buildUserMessage(place, wordLimit, auditFindings, reviewSummary);

    log.info({ business: place.businessName }, "Generating outreach email");

    const raw = await this.llm.generate(systemPrompt, [
      { role: "user", content: userMessage },
    ]);
    const { subject, body } = parseEmailJson(raw);

    const wc = EmailWordCount.fromText(body);

    if (wc.isWithinLimit(wordLimit)) {
      log.info({ wordCount: wc.count }, "Email generated within word limit");
      return { subject, body, wordCount: wc.count };
    }

    // Retry once with a stricter constraint
    log.warn(
      { wordCount: wc.count, overshoot: wc.overshootBy(wordLimit) },
      "Email over word limit — retrying with stricter prompt"
    );

    const retryMessage =
      `${buildUserMessage(place, wordLimit, auditFindings, reviewSummary)}\n\n` +
      `IMPORTANT: Your previous attempt had ${wc.count} words. ` +
      `You MUST cut it to strictly ${wordLimit} words or fewer. Be ruthless — remove any sentence that is not essential.`;

    const retryRaw = await this.llm.generate(systemPrompt, [
      { role: "user", content: retryMessage },
    ]);
    const retry = parseEmailJson(retryRaw);
    const retryWc = EmailWordCount.fromText(retry.body);

    log.info({ wordCount: retryWc.count }, "Retry email word count");

    return {
      subject: retry.subject,
      body: retry.body,
      wordCount: retryWc.count,
    };
  }
}
