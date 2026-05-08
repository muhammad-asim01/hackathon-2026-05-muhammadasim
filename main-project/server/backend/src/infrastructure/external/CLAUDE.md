# Infrastructure — External Adapters

Each adapter implements one port interface from `application/ports/`. No direct use-case calls.

## LLM — `llm/AnthropicAdapter.ts`

Implements `ILLMProvider`. Uses `claude-sonnet-4-6` model with Anthropic prompt caching:
- System prompt is sent with `cache_control: { type: "ephemeral" }` → ~0 tokens on cache hits (90%+ rate).
- Transient error detection: HTTP 529 / "overloaded" → sets `retryable: true` on the thrown `ExternalServiceError`.
- `MockLLMAdapter` (same folder) returns canned responses — used when `container.ts` detects dev mode.

## Email — `email/GmailService.ts`

Implements `IEmailSender`. Sends via Gmail OAuth2 (`googleapis` package):
- Required env: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL`, `GMAIL_REDIRECT_URI`.
- Refresh token never expires unless revoked — set once.
- Lazy-loads `googleapis` at runtime (avoids startup crash if not installed).
- Encodes message as base64url per RFC 2822.
- `MockEmailSender` (same folder) logs the email to stdout — used in dev when `MOCK_EMAIL=true`.

## Maps — `maps/OSMMapsService.ts`

Implements `IMapsService`. Queries OpenStreetMap Nominatim + Overpass API:
- No API key required.
- Returns `gmapsPlaceId`, `businessName`, `address`, `city`, `niche`, `phone`, `website`.
- Results may lack `rating` and `reviewCount` — these default to `0` for OSM leads.

## PageSpeed — `pagespeed/PageSpeedService.ts`

Implements `IPageSpeedService`. Calls Google PageSpeed Insights API:
- Required env: `PAGESPEED_API_KEY`.
- Returns `performanceScore`, `mobileScore`, `hasSSL`, `hasMobileMeta`.
- On rate limit or API error → throws `ExternalServiceError(message, true)` (retryable).

## Web Crawler — `crawler/PageCrawler.ts`

Uses Playwright (headless Chromium) to crawl business websites:
- Extracts contact email addresses from page text / `mailto:` links.
- `BATCH_SIZE = 3` concurrent crawls (memory constraint for t3.micro deployment).
- Playwright browser instance is kept alive and shared; graceful shutdown on `SIGINT`/`SIGTERM` in `container.ts`.

## Adding a New Adapter

1. Define the port interface in `application/ports/IMyService.ts`.
2. Create the adapter in `infrastructure/external/myservice/MyServiceAdapter.ts` implementing the interface.
3. Wire it in `config/container.ts` (inject into the relevant use-case).
4. Optionally add a Mock variant for dev/test environments.
