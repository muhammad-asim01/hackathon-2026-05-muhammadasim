/**
 * MockWebsiteEmailExtractor — dev/test stand-in for WebsiteEmailExtractor.
 * Derives a plausible contact email from the website domain without
 * making any real HTTP requests. Used in the debug router to keep
 * debug panel tests fast and network-free.
 */
import { logger } from "@/utils/logger";

export class MockWebsiteEmailExtractor {
  async extract(websiteUrl: string): Promise<string | null> {
    // Extract bare domain: "https://sunriseplumbing-atx.com/about" → "sunriseplumbing-atx.com"
    const match = websiteUrl.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i);
    const domain = match?.[1] ?? "mockbusiness.com";
    const email = `contact@${domain}`;

    logger.info({ url: websiteUrl, email }, "MockWebsiteEmailExtractor: extract");
    return email;
  }
}
