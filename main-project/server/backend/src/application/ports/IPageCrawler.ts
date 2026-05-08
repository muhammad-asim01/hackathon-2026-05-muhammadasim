export interface CrawlResult {
  readonly hasSSL: boolean;
  readonly hasMobileMeta: boolean;
  readonly hasMetaTags: boolean; // title + meta description both present
  readonly hasCTA: boolean; // at least one clear call-to-action
  readonly hasContactForm: boolean;
  readonly loadTimeMs: number;
  /** Contact emails extracted from the site (priority-sorted, deduped). May be empty. */
  readonly emails: readonly string[];
}

export interface IPageCrawler {
  crawl(url: string): Promise<CrawlResult>;
  shutdown(): Promise<void>;
}
