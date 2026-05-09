/**
 * auditReportEmail.ts — Premium HTML email template for sift.ai audit reports.
 *
 * Pure TypeScript HTML builder — no React, no external renderer dependency.
 * Output is a full RFC 2822-compliant multipart HTML string that renders
 * correctly in Gmail (web + mobile), Apple Mail, and Outlook (via MSO
 * conditional comments and table-based layout).
 *
 * Design mirrors the /audit/[publicId] page:
 *  - Dark background (#0c0a09) with amber (#cab16a) accent
 *  - Score card + pass/warn/fail stats
 *  - Six-item audit checklist with colored left borders
 *  - Customer review excerpt (optional)
 *  - CTA section with report link + call booking button
 */

// ─── Design tokens ─────────────────────────────────────────────────────────────
// Hardcoded hex — email clients strip CSS variables.

const T = {
  bg:       "#0c0a09",
  card:     "#1c1917",
  border:   "#44403c",
  fg:       "#d4be98",
  muted:    "#a89984",
  mutedDim: "#6b6052",
  amber:    "#cab16a",
  green:    "#a9b665",
  red:      "#ea6962",
  orange:   "#e78a4e",
  bgGreen:  "#1a2214",
  bgRed:    "#2a1414",
  bgOrange: "#2a1c0e",
  bgAmber:  "#2a2110",
  white:    "#ffffff",
} as const;

// ─── Data types ────────────────────────────────────────────────────────────────

export interface AuditCheckItem {
  readonly label:  string;
  readonly status: "pass" | "warn" | "fail" | "pending";
  readonly detail: string;
}

export interface AuditEmailData {
  // Business
  readonly businessName:    string;
  readonly address:         string;
  readonly city:            string;
  readonly niche:           string;
  readonly website?:        string;
  readonly phone?:          string;

  // Scores
  readonly digitalScore?:    number;
  readonly pageSpeedScore?:  number;
  readonly mobileScore?:     number;

  // Issues
  readonly hasSSL?:           boolean;
  readonly topIssue?:         string;
  readonly reviewSentiment?:  "positive" | "mixed" | "negative";
  readonly reviewExcerpt?:    string;
  readonly googleRating?:     number;
  readonly reviewCount:       number;

  // Email content
  readonly emailSubject:  string;
  readonly emailBody:     string;  // LLM-generated plain-text body

  // Links
  readonly auditUrl:      string;  // https://sift.ai/audit/<publicId>
  readonly bookingUrl?:   string;  // optional calendar link
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score <= 30) return T.red;
  if (score <= 55) return T.orange;
  return T.amber;
}

function scoreLabel(score: number): string {
  if (score <= 30) return "CRITICAL";
  if (score <= 55) return "POOR";
  return "FAIR";
}

function statusColor(status: AuditCheckItem["status"]): string {
  return { pass: T.green, warn: T.orange, fail: T.red, pending: T.mutedDim }[status];
}

function statusBg(status: AuditCheckItem["status"]): string {
  return { pass: T.bgGreen, warn: T.bgOrange, fail: T.bgRed, pending: T.card }[status];
}

function statusIcon(status: AuditCheckItem["status"]): string {
  return { pass: "✓", warn: "!", fail: "✗", pending: "…" }[status];
}

function statusLabel(status: AuditCheckItem["status"]): string {
  return { pass: "PASS", warn: "WARN", fail: "FAIL", pending: "—" }[status];
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

/** Build the 6-item audit checklist from lead fields. */
export function buildCheckItems(data: AuditEmailData): AuditCheckItem[] {
  const issue = (data.topIssue ?? "").toLowerCase();

  const speed: AuditCheckItem = data.pageSpeedScore !== undefined
    ? {
        label: "PageSpeed Performance",
        status: data.pageSpeedScore >= 70 ? "pass" : data.pageSpeedScore >= 50 ? "warn" : "fail",
        detail: data.pageSpeedScore >= 70
          ? `Score ${data.pageSpeedScore}/100 — good loading performance`
          : data.pageSpeedScore >= 50
          ? `Score ${data.pageSpeedScore}/100 — room for improvement`
          : `Score ${data.pageSpeedScore}/100 — critical performance issues`,
      }
    : { label: "PageSpeed Performance", status: "pending", detail: "Score pending" };

  const mobile: AuditCheckItem = data.mobileScore !== undefined
    ? {
        label: "Mobile Friendliness",
        status: data.mobileScore >= 70 ? "pass" : data.mobileScore >= 50 ? "warn" : "fail",
        detail: data.mobileScore >= 70
          ? `Score ${data.mobileScore}/100 — responsive design detected`
          : data.mobileScore >= 50
          ? `Score ${data.mobileScore}/100 — some mobile layout issues`
          : `Score ${data.mobileScore}/100 — major mobile problems detected`,
      }
    : { label: "Mobile Friendliness", status: "pending", detail: "Analysis pending" };

  const ssl: AuditCheckItem = data.hasSSL !== undefined
    ? {
        label: "HTTPS / SSL Certificate",
        status: data.hasSSL ? "pass" : "fail",
        detail: data.hasSSL
          ? "SSL certificate valid — secure connection"
          : 'Site not served over HTTPS — browsers show "Not Secure"',
      }
    : { label: "HTTPS / SSL Certificate", status: "pending", detail: "Analysis pending" };

  const gbp: AuditCheckItem = {
    label: "Google Business Profile",
    status: data.reviewCount < 20 ? "warn" : "pass",
    detail: `${data.reviewCount} reviews${data.googleRating !== undefined ? ` · ${data.googleRating}★` : ""}`,
  };

  const seo: AuditCheckItem = issue
    ? {
        label: "Structured Data & SEO",
        status: issue.includes("schema") || issue.includes("meta") ? "fail" : "pass",
        detail: issue.includes("schema")
          ? "Missing schema markup — invisible to rich search results"
          : issue.includes("meta")
          ? "Missing meta title/description — not indexing properly"
          : "Schema and search indexing appear healthy",
      }
    : { label: "Structured Data & SEO", status: "pending", detail: "Analysis pending" };

  const booking: AuditCheckItem = issue
    ? {
        label: "Online Booking / Contact",
        status:
          issue.includes("book") || issue.includes("contact") || issue.includes("cta")
            ? "fail"
            : "pass",
        detail:
          issue.includes("book") || issue.includes("appointment")
            ? "No booking system — customers must call during business hours"
            : issue.includes("cta") || issue.includes("contact")
            ? "No clear call-to-action on the page"
            : "Contact and booking flow accessible",
      }
    : { label: "Online Booking / Contact", status: "pending", detail: "Analysis pending" };

  return [speed, mobile, ssl, gbp, seo, booking];
}

// ─── Section builders ──────────────────────────────────────────────────────────

function renderHeader(): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${T.card};border-bottom:1px solid ${T.border};">
    <tr>
      <td class="pad" style="padding:16px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <div style="width:28px;height:28px;background:${T.amber};border-radius:50%;
                                display:inline-block;text-align:center;line-height:28px;
                                font-family:monospace;font-size:10px;font-weight:700;
                                color:${T.bg};">SA</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                                 font-size:15px;font-weight:700;color:${T.fg};letter-spacing:-0.01em;">
                      sift.ai
                    </span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:9px;font-weight:600;letter-spacing:0.12em;
                           text-transform:uppercase;color:${T.mutedDim};">
                Digital Audit Report
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderEmailBody(data: AuditEmailData): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:32px 32px 24px;">
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                  font-size:15px;line-height:1.7;color:${T.fg};margin:0 0 0 0;white-space:pre-line;">
          ${nl2br(data.emailBody)}
        </p>
      </td>
    </tr>
  </table>`;
}

function renderSectionDivider(label: string): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:8px 32px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border-top:1px solid ${T.border};"></td>
            <td style="padding:0 12px;white-space:nowrap;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:9px;font-weight:700;letter-spacing:0.14em;
                           text-transform:uppercase;color:${T.mutedDim};">
                ${esc(label)}
              </span>
            </td>
            <td style="border-top:1px solid ${T.border};"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderScoreCard(data: AuditEmailData, items: AuditCheckItem[]): string {
  const passCount    = items.filter((i) => i.status === "pass").length;
  const warnCount    = items.filter((i) => i.status === "warn").length;
  const failCount    = items.filter((i) => i.status === "fail").length;
  const hasScore     = data.digitalScore !== undefined;
  const score        = data.digitalScore ?? 0;
  const color        = hasScore ? scoreColor(score) : T.mutedDim;
  const label        = hasScore ? scoreLabel(score) : "PENDING";

  const issueText = [
    failCount > 0
      ? `<span style="color:${T.red};font-weight:600;">${failCount} critical issue${failCount !== 1 ? "s" : ""}</span>`
      : "",
    warnCount > 0
      ? `<span style="color:${T.orange};font-weight:600;">${warnCount} warning${warnCount !== 1 ? "s" : ""}</span>`
      : "",
  ]
    .filter(Boolean)
    .join(" and ");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${T.card};border:1px solid ${T.border};">
          <tr>
            <!-- Score badge -->
            <td class="score-badge" width="120" style="padding:24px 20px 24px 24px;vertical-align:middle;text-align:center;
                                    border-right:1px solid ${T.border};">
              <div style="width:88px;height:88px;border-radius:50%;
                          border:4px solid ${color};display:inline-block;
                          text-align:center;background:${T.bg};">
                <table width="88" height="88" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" valign="middle">
                      <span style="font-family:'Courier New',Courier,monospace;
                                   font-size:${hasScore ? "28" : "20"}px;font-weight:700;
                                   color:${color};line-height:1;">${hasScore ? score : "—"}</span>
                      <br>
                      <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                                   font-size:8px;font-weight:700;letter-spacing:0.12em;
                                   text-transform:uppercase;color:${color};">${label}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>

            <!-- Score description + mini stats -->
            <td class="score-desc" style="padding:24px;vertical-align:middle;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;
                        color:${T.mutedDim};margin:0 0 8px 0;">Digital Presence Score</p>
              ${hasScore
                ? `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                             font-size:14px;color:${T.fg};margin:0 0 8px 0;line-height:1.5;">
                     Your website scored
                     <strong style="font-family:'Courier New',Courier,monospace;color:${color};">${score}</strong>
                     out of <strong style="font-family:'Courier New',Courier,monospace;">100</strong>.
                     ${issueText ? `We found ${issueText} that are costing you customers.` : ""}
                   </p>`
                : `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                             font-size:14px;color:${T.muted};margin:0 0 8px 0;">Audit in progress.</p>`
              }
              ${hasScore ? `
              <!-- Mini stats row -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;
                     border-top:1px solid ${T.border};padding-top:12px;width:100%;">
                <tr>
                  <td style="padding-top:12px;padding-right:16px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                              font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;
                              color:${T.mutedDim};margin:0 0 3px 0;">Passed</p>
                    <span style="font-family:'Courier New',Courier,monospace;font-size:20px;
                                 font-weight:700;color:${T.green};">${passCount}</span>
                  </td>
                  <td style="padding-top:12px;padding-right:16px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                              font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;
                              color:${T.mutedDim};margin:0 0 3px 0;">Warnings</p>
                    <span style="font-family:'Courier New',Courier,monospace;font-size:20px;
                                 font-weight:700;color:${T.orange};">${warnCount}</span>
                  </td>
                  <td style="padding-top:12px;">
                    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                              font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;
                              color:${T.mutedDim};margin:0 0 3px 0;">Failed</p>
                    <span style="font-family:'Courier New',Courier,monospace;font-size:20px;
                                 font-weight:700;color:${T.red};">${failCount}</span>
                  </td>
                </tr>
              </table>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderBusinessCard(data: AuditEmailData): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 20px;">
        <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                   font-size:20px;font-weight:700;color:${T.fg};margin:0 0 8px 0;
                   letter-spacing:-0.02em;">
          ${esc(data.businessName)}
        </h1>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td class="info-cell" style="padding-right:16px;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:12px;color:${T.muted};">
                📍 ${esc(data.address)}, ${esc(data.city)}
              </span>
            </td>
            ${data.website ? `
            <td class="info-cell" style="padding-right:16px;">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:12px;color:${T.muted};">
                🌐 ${esc(data.website)}
              </span>
            </td>` : ""}
            ${data.phone ? `
            <td class="info-cell">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:12px;color:${T.muted};">
                📞 ${esc(data.phone)}
              </span>
            </td>` : ""}
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderCheckItem(item: AuditCheckItem, index: number): string {
  const color  = statusColor(item.status);
  const bg     = statusBg(item.status);
  const icon   = statusIcon(item.status);
  const badge  = statusLabel(item.status);
  const mt     = index === 0 ? "0" : "2px";

  return `
  <tr>
    <td style="padding-top:${mt};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${bg};border:1px solid ${color}22;border-left:3px solid ${color};">
        <tr>
          <!-- Status icon cell -->
          <td width="36" style="padding:12px 0 12px 14px;vertical-align:middle;text-align:center;">
            <span style="font-family:'Courier New',Courier,monospace;font-size:13px;
                         font-weight:700;color:${color};">${icon}</span>
          </td>
          <!-- Label + detail -->
          <td style="padding:12px 14px;vertical-align:middle;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                               font-size:13px;font-weight:600;color:${T.fg};">${esc(item.label)}</span>
                </td>
                <td align="right">
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                               font-size:9px;font-weight:700;letter-spacing:0.1em;
                               text-transform:uppercase;color:${color};">${badge}</span>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:3px;">
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                               font-size:11px;color:${T.muted};line-height:1.5;">${esc(item.detail)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function renderChecklist(items: AuditCheckItem[], passCount: number): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 24px;">
        <!-- Section header -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="margin-bottom:10px;">
          <tr>
            <td>
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:9px;font-weight:700;letter-spacing:0.12em;
                           text-transform:uppercase;color:${T.mutedDim};">Audit Checklist</span>
            </td>
            <td align="right">
              <span style="font-family:'Courier New',Courier,monospace;font-size:10px;
                           color:${T.mutedDim};">${passCount}/${items.length} passed</span>
            </td>
          </tr>
        </table>
        <!-- Items -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${items.map((item, i) => renderCheckItem(item, i)).join("")}
        </table>
      </td>
    </tr>
  </table>`;
}

function renderReviewCard(data: AuditEmailData): string {
  if (!data.reviewSentiment || !data.reviewExcerpt) return "";

  const sentimentColor = { positive: T.green, mixed: T.orange, negative: T.red }[data.reviewSentiment];
  const sentimentBg    = { positive: T.bgGreen, mixed: T.bgOrange, negative: T.bgRed }[data.reviewSentiment];
  const sentimentLabel = { positive: "Positive", mixed: "Mixed", negative: "Negative" }[data.reviewSentiment];

  const filledStars = data.googleRating !== undefined ? Math.round(data.googleRating) : 0;
  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < filledStars ? T.amber : T.border};font-size:12px;">★</span>`
  ).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 24px;">
        <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                  font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
                  color:${T.mutedDim};margin:0 0 10px 0;">What Your Customers Are Saying</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${T.card};border:1px solid ${T.border};">
          <tr>
            <td style="padding:16px 20px;">
              <!-- Stars + sentiment badge row -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:10px;">
                <tr>
                  <td>
                    ${stars}
                    ${data.googleRating !== undefined
                      ? `<span style="font-family:'Courier New',Courier,monospace;font-size:11px;
                                     color:${T.muted};margin-left:6px;">${data.googleRating} · ${data.reviewCount} reviews</span>`
                      : `<span style="font-family:'Courier New',Courier,monospace;font-size:11px;
                                     color:${T.muted};margin-left:6px;">${data.reviewCount} reviews</span>`}
                  </td>
                  <td align="right">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                                 font-size:9px;font-weight:700;letter-spacing:0.1em;
                                 text-transform:uppercase;padding:3px 8px;
                                 background:${sentimentBg};color:${sentimentColor};
                                 border:1px solid ${sentimentColor}33;">
                      ${sentimentLabel}
                    </span>
                  </td>
                </tr>
              </table>
              <!-- Excerpt -->
              <p style="font-family:Georgia,'Times New Roman',Times,serif;
                        font-size:13px;color:${T.muted};line-height:1.65;
                        margin:0 0 10px 0;font-style:italic;
                        border-left:2px solid ${T.border};padding-left:12px;">
                &ldquo;${esc(data.reviewExcerpt)}&rdquo;
              </p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;
                        color:${T.mutedDim};margin:0;">
                Google review · ${esc(data.businessName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderCTA(data: AuditEmailData): string {
  const bookingUrl = data.bookingUrl ?? `mailto:hello@sift.ai?subject=Free Strategy Call — ${encodeURIComponent(data.businessName)}`;

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${T.bgAmber};border:1px solid ${T.amber}33;text-align:center;">
          <tr>
            <td style="padding:28px 24px;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:16px;font-weight:700;color:${T.fg};margin:0 0 6px 0;">
                Ready to fix these issues?
              </p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:13px;color:${T.muted};margin:0 0 20px 0;line-height:1.6;
                        max-width:380px;display:inline-block;">
                A free 20-minute strategy call is all it takes to map out exactly
                what&apos;s holding your business back online.
              </p>
              <br>
              <!-- View full report button -->
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                href="${esc(data.auditUrl)}" style="height:42px;width:200px;v-text-anchor:middle;" arcsize="50%"
                stroke="f" fillcolor="${T.amber}">
                <w:anchorlock/>
                <center style="color:${T.bg};font-family:Arial,sans-serif;font-size:13px;font-weight:700;">
                  View Full Report →
                </center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${esc(data.auditUrl)}" class="cta-btn"
                 style="display:inline-block;background:${T.amber};color:${T.bg};
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:13px;font-weight:700;text-decoration:none;padding:11px 28px;
                        border-radius:100px;letter-spacing:0.01em;">
                View Full Report &rarr;
              </a>
              <!--<![endif]-->
              <br><br>
              <!-- Book call secondary link -->
              <a href="${esc(bookingUrl)}"
                 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:12px;color:${T.amber};text-decoration:underline;">
                Book a Free Strategy Call
              </a>
              <br>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                        font-size:10px;color:${T.mutedDim};margin:12px 0 0 0;">
                No credit card &nbsp;·&nbsp; No obligation &nbsp;·&nbsp; 20 minutes
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderFooter(_data: AuditEmailData): string {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pad" style="padding:0 32px 32px;border-top:1px solid ${T.border};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="padding-top:20px;">
          <tr>
            <td>
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:10px;color:${T.mutedDim};">
                Generated by sift.ai &nbsp;·&nbsp; Automated digital audit
              </span>
            </td>
            <td class="footer-right" align="right">
              <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
                           font-size:10px;color:${T.mutedDim};">
                Results based on publicly available data
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// ─── Main builder ──────────────────────────────────────────────────────────────

/**
 * Renders the full audit report HTML email string.
 * Returns a self-contained HTML document ready for multipart/alternative sending.
 */
export function buildAuditReportHtml(data: AuditEmailData): string {
  const items      = buildCheckItems(data);
  const passCount  = items.filter((i) => i.status === "pass").length;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: dark light; supported-color-schemes: dark light; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0; mso-table-rspace: 0; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      /* Shrink 32px side padding to 16px */
      .pad { padding-left: 16px !important; padding-right: 16px !important; }
      /* Score card: stack badge above stats */
      .score-badge { display: block !important; width: 100% !important; box-sizing: border-box !important;
                     border-right: 0 !important; border-bottom: 1px solid ${T.border} !important;
                     padding: 20px 16px !important; text-align: center !important; }
      .score-desc  { display: block !important; width: 100% !important; box-sizing: border-box !important;
                     padding: 16px !important; }
      /* Business info: stack address / website / phone vertically */
      .info-cell { display: block !important; padding-right: 0 !important; padding-bottom: 6px !important; }
      /* Check item: shrink detail text slightly */
      .check-detail { font-size: 11px !important; }
      /* CTA button: full-width tap target */
      .cta-btn { display: block !important; width: auto !important;
                 margin: 0 auto !important; text-align: center !important; }
      /* Footer: hide right-side text to prevent overflow */
      .footer-right { display: none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${T.bg};word-break:break-word;">
  <!-- Email wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${T.bg};min-height:100%;">
    <tr>
      <td align="center" style="padding:24px 16px 40px;">
        <!-- 600px container -->
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:${T.bg};border:1px solid ${T.border};">
          ${renderHeader()}
          ${renderEmailBody(data)}
          ${renderSectionDivider("Your Digital Audit Report")}
          ${renderBusinessCard(data)}
          ${renderScoreCard(data, items)}
          ${renderChecklist(items, passCount)}
          ${renderReviewCard(data)}
          ${renderCTA(data)}
          ${renderFooter(data)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
