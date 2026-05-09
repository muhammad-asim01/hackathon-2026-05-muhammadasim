/**
 * GenerateOutreachEmail — Writer agent use-case.
 *
 * Builds a personalized cold outreach email from real audit findings.
 * Uses the injected ILLMProvider (Grok → Anthropic fallback in production,
 * MockLLMAdapter in dev when no keys are configured).
 *
 * Prompt strategy:
 *  - System prompt:  invariant rules (cached by Anthropic, reused by Grok)
 *  - User message:   all available audit + review data, scored by severity
 *  - Retry once if the model overshoots the word limit
 */
import type { ILLMProvider } from "@/application/ports/ILLMProvider";
import type { PlaceResult }  from "@/application/ports/IMapsService";
import { EmailWordCount }    from "@/domain/value-objects/EmailWordCount";
import { InternalError }     from "@/domain/errors";
import { logger }            from "@/utils/logger";

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface AuditContext {
  readonly topIssue?:       string;
  readonly pageSpeedScore?: number;  // desktop PSI 0-100
  readonly mobileScore?:    number;  // mobile  PSI 0-100
  readonly hasSSL?:         boolean;
  readonly hasMobileMeta?:  boolean;
  readonly hasMetaTags?:    boolean;
  readonly hasCTA?:         boolean;
  readonly loadTimeMs?:     number;  // desktop load time
  readonly digitalScore?:   number;  // overall 0-100 computed score
}

export interface ReviewContext {
  readonly positives:  readonly string[];
  readonly negatives:  readonly string[];
  readonly avgRating:  number;
  readonly excerpt?:   string;
}

export interface GenerateEmailInput {
  readonly place:           PlaceResult;
  readonly wordLimit:       number;
  readonly auditFindings?:  AuditContext;
  readonly reviewSummary?:  ReviewContext;
}

export interface GeneratedEmail {
  readonly subject:   string;
  readonly body:      string;
  readonly wordCount: number;
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

function scoreSeverity(score: number): string {
  if (score <= 25) return "CRITICAL — this site is actively losing customers every day";
  if (score <= 50) return "POOR — multiple issues are reducing inbound leads";
  return "NEEDS WORK — specific fixes could meaningfully improve conversion";
}

/**
 * Returns an industry-specific framing hint so the model opens with
 * language that resonates with that business type.
 */
function nicheAngle(niche: string, city: string): string {
  const n = niche.toLowerCase();
  const c = city || "your area";
  if (/plumb|electr|hvac|heat|cool|roof|emergency/.test(n))
    return `Emergency-service context: when someone has a burst pipe or power issue, they search "${niche} ${c}" on their phone and call the first result that loads. A slow or broken mobile experience means missed emergency calls.`;
  if (/restaurant|cafe|coffee|bar|bistro|diner|pizza|sushi|food/.test(n))
    return `Hospitality context: diners check menus, hours, and reviews on mobile before deciding where to eat. A slow site or one that's hard to navigate on a phone sends them to a competitor two streets away.`;
  if (/dentist|doctor|clinic|physio|chiro|health|medical|therapy|counsel/.test(n))
    return `Healthcare context: patients research providers thoroughly before booking. SSL and trust signals matter enormously — a "Not Secure" warning or slow-loading site kills credibility before they've seen a single credential.`;
  if (/salon|spa|beauty|nail|hair|barber|wax|lash/.test(n))
    return `Appointment-based context: clients book beauty services on their phones, often on the go. No clear booking CTA or a slow mobile experience means they go to whoever they can book with in under 30 seconds.`;
  if (/gym|fitness|yoga|pilates|crossfit|personal train/.test(n))
    return `Fitness context: people searching for gyms want class schedules, pricing, and trial offers front and centre. Friction in that journey ends with them joining a competitor.`;
  if (/lawyer|attorney|legal|law firm/.test(n))
    return `Legal context: potential clients in distress need to feel trust instantly. A non-HTTPS site or one missing clear contact info reads as unprofessional and loses consultations.`;
  if (/hotel|motel|inn|b&b|accommodation|stay/.test(n))
    return `Accommodation context: travellers compare options fast on mobile. Load speed and clear CTAs (Book Now, Check Availability) are the difference between a direct booking and one through a 15%-commission OTA.`;
  return `Local business context: someone in ${c} searching for "${niche}" is choosing between several options. The business with the fastest, clearest site wins — regardless of who's actually better at the work.`;
}

/**
 * Derive the single most impactful issue to lead the email with,
 * expressed as customer impact (not a technical metric).
 */
function leadingIssue(audit: AuditContext, niche: string): string {
  const mobile = audit.mobileScore ?? null;
  const desktop = audit.pageSpeedScore ?? null;

  if (audit.hasSSL === false)
    return 'Chrome is showing visitors "Not Secure" in the address bar before they even see a phone number or service description';
  if (mobile !== null && mobile < 30)
    return `The site scores ${mobile}/100 on mobile PageSpeed — most people searching for ${niche} are on their phones, and the site is too slow to keep them`;
  if (audit.hasCTA === false && audit.hasMobileMeta === false)
    return "There's no clear way to contact the business, and the site isn't formatted for mobile screens";
  if (audit.hasCTA === false)
    return "There's no clear call-to-action — visitors can't book, call, or enquire without searching for how to do it";
  if (desktop !== null && desktop < 40)
    return `The desktop site scores ${desktop}/100 on PageSpeed — a slow experience that gives visitors a reason to leave`;
  if (audit.hasMobileMeta === false)
    return "The site isn't optimised for mobile screens, making it hard to read or navigate on a phone";
  if (audit.hasMetaTags === false)
    return "The site is missing meta title and description tags — it's essentially invisible to Google";
  if (audit.loadTimeMs !== undefined && audit.loadTimeMs > 4000)
    return `The site takes ${(audit.loadTimeMs / 1000).toFixed(1)} seconds to load — most mobile visitors leave after 3 seconds`;
  if (audit.topIssue)
    return audit.topIssue;
  return "the website has several friction points that make it harder for potential customers to take action";
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

/**
 * System prompt — invariant section (cached by Anthropic, small overhead for Grok).
 * Sets persona, absolute hard rules, and output format.
 */
function buildSystemPrompt(wordLimit: number): string {
  return `You are a digital agency founder who personally audited a local business website. \
You found real technical problems. You are writing to the business owner, not to an AI evaluator. \
Write exactly as a knowledgeable human would — specific, respectful, direct.

Hard rules:
- Body must be ${wordLimit} words or fewer (count every word — trim ruthlessly if over)
- Open with the single most customer-damaging finding, framed as lost revenue or lost customers — never as a metric
- Include at least one exact number from the audit data (a score, load time, or rating)
- End with one soft binary question that requires no commitment (e.g. "Would a 15-minute call be worth it?")
- Zero filler openers: never write "I hope this finds you well", "I wanted to reach out", \
"touching base", "just following up", or any equivalent warm-up phrase
- No passive hedging: say "your site fails" not "there may be some issues"
- No bullet points, no headers — flowing prose only (2–4 short paragraphs)
- Never mention competitors by name
- Never claim specific ROI numbers unless they appear in the data provided
- Tone: peer-to-peer — not a vendor pitching, not a consultant reporting

Subject line rules:
- Six words or fewer
- Reference a specific finding, score, or business name if natural
- Avoid: "Quick question", "Following up", "One thing I noticed", "Your online presence"

OUTPUT FORMAT — CRITICAL:
Your ENTIRE response must be one valid JSON object and nothing else.
No explanation, no markdown, no code fences, no text before or after.
The very first character of your response must be { and the very last must be }.
Schema: { "subject": "<subject line>", "body": "<email body>" }`;
}

/**
 * User message — all available data packed for the model.
 * The richer this is, the more specific and human the output.
 */
function buildUserMessage(
  place:    PlaceResult,
  wordLimit: number,
  audit?:   AuditContext,
  review?:  ReviewContext
): string {
  const lines: string[] = [
    "=== BUSINESS DATA ===",
    `Business name : ${place.businessName}`,
    `Industry      : ${place.niche}`,
    `Location      : ${place.city}${place.address ? ` — ${place.address}` : ""}`,
    `Website       : ${place.website ?? "NONE DETECTED"}`,
    ...(place.phone          ? [`Phone         : ${place.phone}`]                          : []),
    ...(place.googleRating   ? [`Google rating : ${place.googleRating}/5`]                 : []),
    ...(place.reviewCount > 0 ? [`Review count  : ${place.reviewCount} reviews`]           : []),
  ];

  if (audit) {
    lines.push("", "=== AUDIT SCORES ===");
    if (audit.digitalScore !== undefined)
      lines.push(`Overall score   : ${audit.digitalScore}/100 — ${scoreSeverity(audit.digitalScore)}`);
    if (audit.pageSpeedScore !== undefined)
      lines.push(`Desktop speed   : ${audit.pageSpeedScore}/100`);
    if (audit.mobileScore !== undefined)
      lines.push(`Mobile speed    : ${audit.mobileScore}/100`);
    if (audit.loadTimeMs !== undefined)
      lines.push(`Desktop load    : ${(audit.loadTimeMs / 1000).toFixed(2)}s`);

    lines.push("", "=== TECHNICAL ISSUES ===");
    lines.push(`SSL / HTTPS     : ${audit.hasSSL === false ? 'MISSING — Chrome shows "Not Secure" to every visitor' : audit.hasSSL === true ? "Present" : "Unknown"}`);
    lines.push(`Mobile-optimised: ${audit.hasMobileMeta === false ? "NO — viewport meta tag absent" : audit.hasMobileMeta === true ? "Yes" : "Unknown"}`);
    lines.push(`SEO meta tags   : ${audit.hasMetaTags === false ? "MISSING — not indexing properly in Google" : audit.hasMetaTags === true ? "Present" : "Unknown"}`);
    lines.push(`Clear CTA       : ${audit.hasCTA === false ? "MISSING — no booking, call, or contact button visible" : audit.hasCTA === true ? "Present" : "Unknown"}`);
    if (audit.topIssue)
      lines.push(`Top issue       : ${audit.topIssue}`);

    lines.push("", "=== LEADING ISSUE FOR EMAIL ===");
    lines.push(leadingIssue(audit, place.niche));
  }

  if (review) {
    lines.push("", "=== CUSTOMER REVIEWS ===");
    if (review.avgRating > 0)
      lines.push(`Average rating  : ${review.avgRating}/5`);
    if (review.positives.length > 0)
      lines.push(`What they praise: ${review.positives.join("; ")}`);
    if (review.negatives.length > 0)
      lines.push(`Complaints      : ${review.negatives.join("; ")}`);
    if (review.excerpt)
      lines.push(`Notable excerpt : "${review.excerpt}"`);
  }

  lines.push("", "=== WRITING ANGLE ===");
  lines.push(nicheAngle(place.niche, place.city));

  lines.push(
    "",
    `Write a ${wordLimit}-word (maximum) personalised outreach email body and a subject line.`,
    `The email must open with the leading issue above, framed as customer/revenue impact.`,
    `Return ONLY JSON: { "subject": "...", "body": "..." }`
  );

  return lines.join("\n");
}

// ─── JSON parser ──────────────────────────────────────────────────────────────

interface LLMJsonResponse {
  subject?: unknown;
  body?:    unknown;
}

function parseEmailJson(raw: string): { subject: string; body: string } {
  // Reasoning models often wrap the JSON in prose or markdown.
  // Strategy: strip code fences, then locate the outermost { … } block.
  let candidate = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Pull out the first { … last } block — handles leading/trailing prose
  const start = candidate.indexOf("{");
  const end   = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }

  let parsed: LLMJsonResponse;
  try {
    parsed = JSON.parse(candidate) as LLMJsonResponse;
  } catch {
    throw new InternalError("LLM did not return valid JSON for email draft", {
      raw: raw.slice(0, 300),
    });
  }

  if (typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
    throw new InternalError('LLM JSON missing "subject" or "body" keys', {
      keys: Object.keys(parsed),
    });
  }

  return { subject: parsed.subject.trim(), body: parsed.body.trim() };
}

// ─── Use-case ─────────────────────────────────────────────────────────────────

export class GenerateOutreachEmail {
  constructor(private readonly llm: ILLMProvider) {}

  async execute(input: GenerateEmailInput): Promise<GeneratedEmail> {
    const { place, wordLimit, auditFindings, reviewSummary } = input;
    const log = logger.child({ useCase: "GenerateOutreachEmail", placeId: place.placeId });

    const systemPrompt = buildSystemPrompt(wordLimit);
    const userMessage  = buildUserMessage(place, wordLimit, auditFindings, reviewSummary);

    log.info({ business: place.businessName }, "Generating outreach email");

    const raw = await this.llm.generate(systemPrompt, [
      { role: "user", content: userMessage },
    ], { maxTokens: 1024, temperature: 0.75 });

    const { subject, body } = parseEmailJson(raw);
    const wc = EmailWordCount.fromText(body);

    if (wc.isWithinLimit(wordLimit)) {
      log.info({ wordCount: wc.count }, "Email generated within word limit");
      return { subject, body, wordCount: wc.count };
    }

    // ── Retry with stricter constraint ────────────────────────────────────────
    log.warn(
      { wordCount: wc.count, overshoot: wc.overshootBy(wordLimit) },
      "Email over word limit — retrying with stricter prompt"
    );

    const retryMessage =
      `${buildUserMessage(place, wordLimit, auditFindings, reviewSummary)}\n\n` +
      `IMPORTANT: Your previous draft was ${wc.count} words — ${wc.overshootBy(wordLimit)} over the limit. ` +
      `You MUST cut the body to ${wordLimit} words or fewer. ` +
      `Remove any sentence that isn't directly about the leading issue or the closing question. ` +
      `Be ruthless. Quality over quantity. Return JSON only.`;

    const retryRaw = await this.llm.generate(systemPrompt, [
      { role: "user", content: retryMessage },
    ], { maxTokens: 1024, temperature: 0.6 }); // lower temp on retry for tighter control

    const retry   = parseEmailJson(retryRaw);
    const retryWc = EmailWordCount.fromText(retry.body);

    log.info({ wordCount: retryWc.count }, "Retry email word count");

    return {
      subject:   retry.subject,
      body:      retry.body,
      wordCount: retryWc.count,
    };
  }
}
