export interface PageSpeedMetrics {
  readonly score: number; // 0-100
  readonly loadTimeMs: number;
  readonly fcp: number; // first contentful paint ms
  readonly lcp: number; // largest contentful paint ms
}

export interface PageSpeedResult {
  readonly desktop: PageSpeedMetrics;
  readonly mobile: PageSpeedMetrics;
}

export interface IPageSpeedService {
  analyze(url: string): Promise<PageSpeedResult>;
}
