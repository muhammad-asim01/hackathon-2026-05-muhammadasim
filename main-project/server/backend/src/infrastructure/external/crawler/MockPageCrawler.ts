import type { IPageCrawler, CrawlResult } from "@/application/ports/IPageCrawler";
import { logger } from "@/utils/logger";

function coin(trueProbability: number): boolean {
  return Math.random() < trueProbability;
}

export class MockPageCrawler implements IPageCrawler {
  async crawl(url: string): Promise<CrawlResult> {
    // Simulate network + parse time (200–600 ms mirrors a slow small-business site)
    await new Promise<void>((r) => setTimeout(r, 200 + Math.random() * 400));

    const result: CrawlResult = {
      hasSSL:         coin(0.55),  // ~half of small businesses lack HTTPS
      hasMobileMeta:  coin(0.45),  // many old sites missing viewport meta
      hasMetaTags:    coin(0.5),
      hasCTA:         coin(0.4),
      hasContactForm: coin(0.35),
      loadTimeMs:     Math.round(2_800 + Math.random() * 6_000),
      emails:         [],          // mock never extracts real emails
    };

    logger.info({ url, ...result }, "MockPageCrawler: crawl");
    return result;
  }

  async shutdown(): Promise<void> {
    // No browser instance to tear down
  }
}
