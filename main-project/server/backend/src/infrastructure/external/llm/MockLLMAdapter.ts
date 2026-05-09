/**
 * MockLLMAdapter — drop-in replacement for real LLM providers when no API
 * keys are configured (dev / CI environments).
 *
 * Returns realistic data that mirrors what Grok/Anthropic would actually
 * produce, so the full pipeline runs end-to-end without any external calls.
 *
 * Detection logic:
 *   • System prompt contains "business intelligence analyst" → review analysis
 *   • Otherwise → email generation (parses business name from user message)
 */
import type { ILLMProvider, LLMMessage, LLMOptions } from "@/application/ports/ILLMProvider";
import { logger } from "@/utils/logger";

// ─── Canned review analysis ───────────────────────────────────────────────────

const REVIEW_ANALYSIS = JSON.stringify({
  positives: [
    "Friendly, professional staff who explain everything clearly",
    "Reliable and punctual — customers rarely wait longer than quoted",
  ],
  negatives: [
    "Website is hard to navigate on mobile",
    "No online booking — customers have to call during business hours",
  ],
  avgRating: 3.9,
  excerpt:
    "The team do great work but I had to call three times because I couldn't find the right number on their website.",
});

// ─── Email generation — score-aware realistic drafts ─────────────────────────

/**
 * Extracts the digital score from the user message if present, so the
 * mock can vary urgency to match what a real model would produce.
 */
function extractScore(message: string): number | null {
  const m = message.match(/Overall score\s*:\s*(\d+)\/100/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extracts a specific audit finding to reference in the mock email.
 * Returns the most impactful one found, or a generic fallback.
 */
function extractLeadingIssue(message: string): string {
  if (/Chrome is showing.*Not Secure/i.test(message))
    return 'Chrome is showing "Not Secure" to every visitor before they see your phone number';
  if (/mobile.*scores? (\d+)\/100/i.test(message)) {
    const m = message.match(/mobile.*scores? (\d+)\/100/i);
    return `the site scores ${m?.[1] ?? "low"}/100 on mobile PageSpeed`;
  }
  if (/no clear call-to-action/i.test(message))
    return "there's no clear way for visitors to contact you or book directly from the site";
  if (/missing meta.*tags/i.test(message))
    return "the site is missing SEO meta tags and isn't indexing properly on Google";
  return "the site has several friction points making it harder for potential customers to take action";
}

function makeEmail(businessName: string, userMessage: string): string {
  const score = extractScore(userMessage);
  const issue = extractLeadingIssue(userMessage);

  // Match urgency to score bracket
  const isCritical = score !== null && score <= 25;
  const isPoor     = score !== null && score > 25 && score <= 50;

  let body: string;
  let subject: string;

  if (isCritical) {
    subject = `${businessName}'s site is losing mobile customers`;
    body =
      `Hi,\n\n` +
      `I ran a technical audit on ${businessName}'s website and the most urgent finding is that ${issue}. ` +
      `At a score of ${score}/100 overall, the site is actively pushing people toward competitors on a daily basis — ` +
      `not because your work is worse, but because the first impression never loads properly.\n\n` +
      `I've fixed this exact situation for three local ${businessName.toLowerCase().includes("plumb") ? "trade" : "service"} businesses in the past quarter. ` +
      `The fixes typically take a week and double inbound enquiries within 30 days.\n\n` +
      `Would a 15-minute call to walk through what I found be worth your time?`;
  } else if (isPoor) {
    subject = `Quick audit finding for ${businessName}`;
    body =
      `Hi,\n\n` +
      `I did a quick audit on ${businessName}'s website and spotted a few things worth fixing — ` +
      `the main one being that ${issue}. ` +
      `With a score of ${score}/100, you're leaving a portion of your potential customers at the door.\n\n` +
      `These aren't big rebuilds — usually a few targeted changes that take a day or two. ` +
      `I work with local businesses and the goal is always the same: more inbound calls without changing what already works.\n\n` +
      `Worth a 15-minute call to go through the specifics?`;
  } else {
    subject = `One thing I noticed on ${businessName}'s site`;
    body =
      `Hi,\n\n` +
      `I came across ${businessName} while researching businesses in your area and ran a quick technical audit. ` +
      `The main thing I noticed is that ${issue}.\n\n` +
      `Everything else looks reasonably solid — this is really about making sure potential customers ` +
      `who land on your site don't hit any friction before they reach out.\n\n` +
      `I do a free 15-minute walkthrough of the findings. Would that be useful?`;
  }

  return JSON.stringify({ subject, body });
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class MockLLMAdapter implements ILLMProvider {
  async generate(
    systemPrompt: string,
    messages:     readonly LLMMessage[],
    _options:     LLMOptions = {}
  ): Promise<string> {
    // Realistic latency: 150–450 ms
    await new Promise<void>((r) => setTimeout(r, 150 + Math.random() * 300));

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Detect review analysis by the unique system-prompt identifier
    if (systemPrompt.toLowerCase().includes("business intelligence analyst")) {
      logger.debug("MockLLM: returning review analysis");
      return REVIEW_ANALYSIS;
    }

    // Email generation — extract business name from the structured message
    const match = lastUserMessage.match(/Business name\s*:\s*(.+)/i);
    const businessName = match?.[1]?.trim() ?? "the business";

    logger.debug({ businessName }, "MockLLM: returning email draft");
    return makeEmail(businessName, lastUserMessage);
  }
}
