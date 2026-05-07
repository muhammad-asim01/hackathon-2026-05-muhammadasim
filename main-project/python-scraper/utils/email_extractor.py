"""
Email extraction utilities — exact Python port of the logic in
backend/src/infrastructure/external/crawler/PageCrawler.ts.

Priority, noise filters, allowed providers, and domain-overlap heuristic
are all replicated 1-to-1 so both implementations stay consistent.
"""

import re
from bs4 import BeautifulSoup

# ── Regex ──────────────────────────────────────────────────────────────────────
# Matches emails anywhere in raw HTML: attributes, JS literals, comments, text.

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# ── Noise patterns ─────────────────────────────────────────────────────────────

_NOISE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"noreply", re.I),
    re.compile(r"no-reply", re.I),
    re.compile(r"donotreply", re.I),
    re.compile(r"do-not-reply", re.I),
    re.compile(r"mailer-daemon", re.I),
    re.compile(r"postmaster", re.I),
    re.compile(r"webmaster", re.I),
    re.compile(r"bounce", re.I),
    re.compile(r"@sentry\.", re.I),
    re.compile(r"@bugsnag\.", re.I),
    re.compile(r"@rollbar\.", re.I),
    re.compile(r"\.png$", re.I),
    re.compile(r"\.jpg$", re.I),
    re.compile(r"\.gif$", re.I),
    re.compile(r"\.svg$", re.I),
    re.compile(r"\.webp$", re.I),
    re.compile(r"@example\.", re.I),
    re.compile(r"@yourdomain\.", re.I),
    re.compile(r"@domain\.", re.I),
    re.compile(r"@test\.", re.I),
    re.compile(r"localhost", re.I),
    # Website builder / CDN domains that appear in HTML but are not contact emails
    re.compile(r"wixpress\.com", re.I),
    re.compile(r"wix\.com", re.I),
    re.compile(r"squarespace\.com", re.I),
    re.compile(r"squarespace-mail", re.I),
    re.compile(r"shopify\.com", re.I),
    re.compile(r"myshopify\.com", re.I),
    re.compile(r"godaddy\.com", re.I),
    re.compile(r"googleapis\.com", re.I),
    re.compile(r"google\.com", re.I),
    re.compile(r"cloudflare\.com", re.I),
    re.compile(r"cloudfront\.net", re.I),
    re.compile(r"amazonaws\.com", re.I),
    re.compile(r"sendgrid\.", re.I),
    re.compile(r"mailchimp\.", re.I),
    re.compile(r"typeform\.", re.I),
    re.compile(r"hubspot\.", re.I),
    re.compile(r"salesforce\.", re.I),
]

# ── Allowed consumer / business email providers ────────────────────────────────
# Small businesses often use Gmail / Outlook — always keep these even when the
# email domain doesn't overlap with the website domain.

_ALLOWED_PROVIDERS: frozenset[str] = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "yahoo.co.uk",
        "hotmail.com",
        "hotmail.co.uk",
        "outlook.com",
        "outlook.co.uk",
        "live.com",
        "msn.com",
        "icloud.com",
        "me.com",
        "mac.com",
        "protonmail.com",
        "proton.me",
        "fastmail.com",
        "zoho.com",
    }
)

# ── Priority map ───────────────────────────────────────────────────────────────
# Lower number = higher priority in sorted output.

_EMAIL_PRIORITY: dict[str, int] = {
    "contact": 0,
    "hello": 1,
    "info": 2,
    "sales": 3,
    "support": 4,
    "admin": 5,
    "office": 6,
    "team": 7,
    "enquiries": 8,
    "enquiry": 9,
    "mail": 10,
}


def _priority(email: str) -> int:
    local = email.split("@")[0].lower() if "@" in email else ""
    return _EMAIL_PRIORITY.get(local, 99)


def is_noise(email: str) -> bool:
    return any(p.search(email) for p in _NOISE_PATTERNS)


# ── Core extraction helpers ────────────────────────────────────────────────────


def parse_emails(source: str, site_domain: str | None = None) -> list[str]:
    """
    Run regex over raw HTML / plain text, deduplicate, filter noise,
    optionally filter by site domain, then priority-sort.

    Mirrors parseEmails() in PageCrawler.ts.
    """
    raw: list[str] = EMAIL_REGEX.findall(source)
    seen: set[str] = set()
    out: list[str] = []

    for raw_email in raw:
        email = raw_email.lower().strip()
        if email in seen:
            continue
        seen.add(email)

        if is_noise(email):
            continue

        email_domain = email.split("@")[1] if "@" in email else ""

        if email_domain in _ALLOWED_PROVIDERS:
            out.append(email)
            continue

        if site_domain:
            site_parts = site_domain.removeprefix("www.").split(".")
            email_parts = email_domain.split(".")
            overlap = any(p in email_parts for p in site_parts)
            if not overlap and _priority(email) == 99:
                continue

        out.append(email)

    return sorted(out, key=_priority)


def extract_mailto_emails(html: str) -> list[str]:
    """
    Extract emails from <a href="mailto:..."> tags using BeautifulSoup.
    Highest-confidence extraction — mirrors step 1 in both Playwright and
    Cheerio paths in PageCrawler.ts.
    """
    soup = BeautifulSoup(html, "lxml")
    emails: list[str] = []

    for tag in soup.find_all("a", href=True):
        href: str = tag.get("href", "")
        if href.lower().startswith("mailto:"):
            email = href[7:].split("?")[0].strip().lower()
            if email and not is_noise(email):
                emails.append(email)

    return sorted(set(emails), key=_priority)
