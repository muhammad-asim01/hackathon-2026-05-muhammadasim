import type { IPageSpeedService, PageSpeedResult } from "@/application/ports/IPageSpeedService";
import { logger } from "@/utils/logger";

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

export class MockPageSpeedService implements IPageSpeedService {
  async analyze(url: string): Promise<PageSpeedResult> {
    const desktopScore = rand(25, 60);
    const mobileScore = rand(15, 50);

    const result: PageSpeedResult = {
      desktop: {
        score: desktopScore,
        loadTimeMs: rand(3_500, 8_000),
        fcp: rand(1_200, 3_000),
        lcp: rand(2_500, 6_000),
      },
      mobile: {
        score: mobileScore,
        loadTimeMs: rand(5_000, 12_000),
        fcp: rand(2_000, 5_000),
        lcp: rand(4_000, 9_000),
      },
    };

    logger.info({ url, desktopScore, mobileScore }, "MockPageSpeedService: analyze");
    return result;
  }
}
