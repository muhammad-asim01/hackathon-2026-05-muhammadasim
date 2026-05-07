/**
 * MockLLMAdapter — drop-in replacement for AnthropicAdapter when
 * MOCK_LLM=true or no real API key is configured.
 *
 * Returns realistic fake data so the full pipeline runs end-to-end
 * without an Anthropic API key.
 */
import type { ILLMProvider, LLMMessage, LLMOptions } from "@/application/ports/ILLMProvider";
import { logger } from "@/utils/logger";

// ─── Canned responses ─────────────────────────────────────────────────────────

const REVIEW_ANALYSIS = JSON.stringify({
  positives: [
    "Friendly and professional staff",
    "Fast response time and reliable service",
  ],
  negatives: [
    "Website is difficult to navigate on mobile",
    "No online booking or contact form",
  ],
  avgRating: 3.9,
  excerpt: "Staff were great but I couldn't find their hours online anywhere — had to call twice.",
});

function makeEmail(businessName: string): string {
  const subject = `Quick question about ${businessName}'s online presence`;
  const body =
    `Hi there,\n\n` +
    `I came across ${businessName} while looking for services in your area and ran into ` +
    `a few friction points — outdated contact info, no online booking, and the site loads ` +
    `slowly on mobile.\n\n` +
    `I help local businesses fix exactly that. Last quarter I helped three similar businesses ` +
    `increase their inbound calls by 40% simply by cleaning up their Google listing and adding ` +
    `a simple booking page.\n\n` +
    `I ran a quick audit on your current online presence and the biggest thing holding you back ` +
    `is that your site scores 18 out of 100 on mobile — most of your potential customers are ` +
    `browsing on their phones and leaving before they even see your phone number.\n\n` +
    `I do a free 20-minute call where I walk you through exactly what I found and what it ` +
    `would cost to fix. No pitch, just the findings.\n\n` +
    `Would Thursday or Friday afternoon work for a quick call?`;
  return JSON.stringify({ subject, body });
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class MockLLMAdapter implements ILLMProvider {
  async generate(
    systemPrompt: string,
    messages: readonly LLMMessage[],
    _options: LLMOptions = {}
  ): Promise<string> {
    // Realistic latency: 200–600 ms
    await new Promise<void>((r) => setTimeout(r, 200 + Math.random() * 400));

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    // Detect review analysis by the unique system-prompt identifier (not "review" which
    // also appears in the email generation prompt's user message).
    if (systemPrompt.toLowerCase().includes("business intelligence analyst")) {
      logger.debug("MockLLM: returning review analysis");
      return REVIEW_ANALYSIS;
    }

    // Email generation — extract business name from the message
    const match = lastUserMessage.match(/Business(?:\s+Name)?:\s*(.+)/i);
    const businessName = match?.[1]?.trim() ?? "the business";
    logger.debug({ businessName }, "MockLLM: returning email draft");
    return makeEmail(businessName);
  }
}
