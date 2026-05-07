// ─── Email Draft types ────────────────────────────────────────────────────────

export type DraftStatus = "pending" | "approved" | "rejected" | "sent";

export interface EmailDraft {
  id: string;
  leadId: string;
  businessName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  wordCount: number;
  status: DraftStatus;
  createdAt: string; // ISO
  approvedAt: string | null; // ISO
  sentAt: string | null; // ISO
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_DRAFTS: EmailDraft[] = [
  {
    id: "draft_001",
    leadId: "lead_001",
    businessName: "Thornton's Auto Repair",
    recipientEmail: "info@thorntonsauto.net",
    subject: "Quick website issue costing you customers — Thornton's",
    body: `Hi,

I was searching for auto repair shops in Chicago and came across Thornton's — the Google reviews are genuinely impressive, especially the consistent mentions of honest pricing. The 4.1-star average with comments like "solid work, fair prices" is exactly what builds trust.

One thing I noticed, though: thorntonsauto.net is still serving over plain HTTP. Chrome flags it as "Not Secure," which research consistently shows causes 15–20% of visitors to leave immediately — especially new customers who don't know you yet. That's real revenue walking out the door before they even call.

On top of that, your mobile PageSpeed score is 31 out of 100. Most people searching "auto repair near me" are on their phones. A slow mobile site means Google ranks you lower and visitors bounce before they find your phone number.

I help local shops fix exactly these issues — typically in under a week, with no disruption to your current site. Results are measurable: more organic traffic, more calls.

Would a 15-minute call this week make sense to walk through what I found?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-04T07:06:01Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_002",
    leadId: "lead_002",
    businessName: "Bellini's Ristorante",
    recipientEmail: "hello@bellinischi.com",
    subject: "Your menu is unreadable on phones — Bellini's",
    body: `Hi,

I had Bellini's recommended to me last week and pulled up bellinischi.com on my phone to check the menu — and I genuinely couldn't read it. The layout completely breaks on mobile: text overlaps the images, the menu PDF requires a separate download, and the navigation disappears.

One of your recent Google reviews captured it well: "Food is actually great but I had to call just to see the menu." That reviewer left 3 stars. The food deserved 5.

Here's the problem: 67% of restaurant searches happen on mobile. When your site fails on phones, Google's algorithm sees the bounce rate and deprioritizes you in local results. You're likely losing reservations to competitors with functional mobile sites — not better food.

Fixing the mobile experience typically takes 3–5 days and has a measurable impact on both search ranking and direct reservations within 30 days.

Would it be worth a 20-minute screen share this week so I can show you exactly what I'd change?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-04T07:06:18Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_003",
    leadId: "lead_003",
    businessName: "Cascade Plumbing Co.",
    recipientEmail: "contact@cascadeplumbingco.com",
    subject: "57 reviews, zero photos — here's what that costs Cascade",
    body: `Hi,

Cascade Plumbing has 57 Google reviews averaging 4.4 stars — that's a strong foundation. Customers clearly trust you. The issue is that your Google Business Profile has zero photos uploaded, which matters more than most business owners realize.

Profiles with 10+ photos get 520% more calls than those without, according to Google's own data. When a potential customer in Chicago searches for a plumber and compares you to a competitor with a photo of their branded truck and a clean work example, they're going to call them first — even if your reviews are better.

This isn't a major project. A few high-quality photos (your van, a before/after job, your team) uploaded directly to your Google profile can shift your visibility meaningfully within weeks.

I help trades businesses like yours build a consistent digital presence that turns your strong reviews into actual inbound calls. The photo strategy is usually the fastest win.

Is there a good time this week for a quick call?`,
    wordCount: 180,
    status: "approved",
    createdAt: "2026-05-04T07:06:35Z",
    approvedAt: "2026-05-04T09:14:02Z",
    sentAt: null,
  },
  {
    id: "draft_004",
    leadId: "lead_005",
    businessName: "Paw & Whisker Grooming",
    recipientEmail: "pawwhisker@pawwhiskerchi.com",
    subject: "204 reviews, but no online booking — Paw & Whisker",
    body: `Hi,

Paw & Whisker Grooming has one of the best review profiles I've seen for a pet grooming shop in Chicago — 204 reviews at 4.7 stars is exceptional. Customers clearly love you. One review summed it up perfectly: "Love this place but I wish I could book online. Every time I call it goes to voicemail."

That one comment points to a real revenue gap. When pet owners can't book online, many simply move to the next option rather than call. With 204 fans already, even a fraction of that lost business adds up to meaningful revenue each month.

An online booking system connected to your existing schedule can be live in under a week. More importantly, it works while you're busy grooming — no phone tag, no missed calls, no lost appointments.

I've helped several Chicago service businesses add this exact capability. The setup is straightforward and the ROI typically shows in the first 30 days.

Would a 15-minute call this week make sense to walk through the options?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-05T08:19:12Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_005",
    leadId: "lead_006",
    businessName: "Ironwood Fitness & Yoga",
    recipientEmail: "hello@ironwoodfitness.com",
    subject: "Ironwood's social links are all broken",
    body: `Hi,

I came across Ironwood Fitness & Yoga online and noticed something that's likely hurting your new member acquisition: your social media links are broken. The Instagram link returns a 404, and the Facebook link points to a removed page.

For a fitness studio, social proof is everything. When a prospective member visits your site and clicks Instagram — hoping to see classes, instructors, and community — and hits an error, you lose them immediately. One recent reviewer specifically mentioned your social media presence (or lack of it) as a downside, which is unusual given your otherwise strong 4.2-star average.

The fix itself takes less than an hour: update the links, and either reconnect your existing accounts or help you set up fresh ones with a consistent posting strategy. The larger opportunity is using the genuine enthusiasm your members clearly have — visible in those 163 reviews — to attract new ones.

Would a quick call this week make sense? I can walk through exactly what I'd fix and what results look like.`,
    wordCount: 180,
    status: "rejected",
    createdAt: "2026-05-04T07:06:52Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_006",
    leadId: "lead_008",
    businessName: "Primrose Bakery & Café",
    recipientEmail: "hello@primrosebakery.co",
    subject: "Your daily specials aren't on your website — Primrose",
    body: `Hi,

Primrose Bakery has 347 Google reviews at 4.8 stars — that's remarkable. People genuinely love what you're making. One review caught my attention: "Best croissants in the city. Their Insta is great but the website doesn't show their daily specials."

That gap between your Instagram engagement and your website is a missed opportunity. Customers who find you through Google search land on a site that doesn't tell them what's available today — so they don't make the detour. Meanwhile, your Instagram followers already want to come in; they just need a reason to act today.

Adding a simple "Today's Specials" section to your homepage — even just pulling from an Instagram feed — can meaningfully increase daily foot traffic from search. Combined with fixing your structured data (your site is missing LocalBusiness schema, which affects how Google displays your hours and menu), the impact compounds.

I help Chicago restaurants and cafés connect their online presence to actual in-store traffic. Would a 15-minute call this week make sense?`,
    wordCount: 180,
    status: "sent",
    createdAt: "2026-05-04T14:09:15Z",
    approvedAt: "2026-05-04T16:02:44Z",
    sentAt: "2026-05-04T16:05:11Z",
  },
  {
    id: "draft_007",
    leadId: "lead_009",
    businessName: "Lakeview Legal Services",
    recipientEmail: "info@lakeviewlegal.com",
    subject: "No contact form is costing Lakeview Legal clients",
    body: `Hi,

I reviewed Lakeview Legal Services online and noticed something that likely costs you consultations every week: there's no contact form or live chat on your website. Potential clients in a stressful legal situation who arrive at your site outside business hours have no way to initiate contact — so they move on to a firm that makes it easy to reach out at 10pm.

One of your recent reviewers put it directly: "Very hard to get in touch with. No chat or contact form on the website." For a law firm, trust and accessibility go hand in hand.

Your review count is also worth addressing. With 21 reviews against competitors averaging 80+, you're at a visibility disadvantage in local search — even with your 3.4-star base to build from. A simple review solicitation workflow, sent to satisfied clients at close of matter, can meaningfully shift that within 90 days.

I work with professional services firms to fix exactly these conversion gaps. Would a 20-minute call this week be a good fit?`,
    wordCount: 180,
    status: "sent",
    createdAt: "2026-05-04T07:07:09Z",
    approvedAt: "2026-05-04T10:22:17Z",
    sentAt: "2026-05-04T10:25:33Z",
  },
  {
    id: "draft_008",
    leadId: "lead_011",
    businessName: "Riviera Nail Studio",
    recipientEmail: "hello@rivieranailchi.com",
    subject: "188 fans can't see your work online — Riviera",
    body: `Hi,

Riviera Nail Studio has 188 Google reviews at 4.3 stars — your customers clearly love what you create. But one review stood out: "Amazing work but I wish their website showed photos. I had to scroll through Yelp to see examples."

For a nail studio, visual evidence is the primary sales tool. When potential clients land on your website and can't see the quality of your nail art, they don't book — they keep searching until they find a studio that shows its work upfront. You're winning on quality but losing on presentation.

A gallery page featuring your best work (organized by style — gel, acrylic, nail art, seasonal) takes roughly a week to design and build. Done right, it becomes the page that converts browsers into first-time bookings, and combined with your strong review base, creates a compelling reason for people to choose Riviera over a competitor.

I help Chicago beauty businesses turn their reputation into consistent new client acquisition. Would a 15-minute call this week make sense?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-05T11:51:02Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_009",
    leadId: "lead_012",
    businessName: "Harbor View Chiropractic",
    recipientEmail: "info@harborviewchiro.com",
    subject: "92 great reviews not showing on your site — Harbor View",
    body: `Hi,

Harbor View Chiropractic has 92 Google reviews averaging 4.6 stars. That's exceptional social proof — and it's essentially invisible to anyone who finds your website directly. One reviewer put it best: "Dr. Harmon is incredible. Wish their site highlighted their reviews — people need to know about this place."

In healthcare, trust is the deciding factor. When a new patient lands on your website trying to decide between chiropractors, the absence of testimonials creates doubt that your quality doesn't deserve. Competitors with fewer reviews but a testimonials page often win simply because they surface the evidence.

Adding a testimonials section — pulling your top reviews, organized by condition treated — combined with structured data markup that helps Google display your star rating in search results, typically increases organic click-through rates by 20–30% within 60 days.

This is a focused, high-impact change for a practice that has already done the hard work of earning patient trust. Would a 15-minute call this week work to discuss the approach?`,
    wordCount: 180,
    status: "approved",
    createdAt: "2026-05-04T14:09:38Z",
    approvedAt: "2026-05-05T08:44:19Z",
    sentAt: null,
  },
  {
    id: "draft_010",
    leadId: "lead_014",
    businessName: "Marigold Photography",
    recipientEmail: "hello@marigoldphotowork.com",
    subject: "Your portfolio is stunning — but it loads in 18 seconds",
    body: `Hi,

I came across Marigold Photography's portfolio online — the work is genuinely beautiful. One recent reviewer captured it well: "Stunning photos and incredible professionalism. The website is beautiful but SO slow to load."

That slowness is a real problem for a photography business. Your homepage is loading 14MB of uncompressed JPEG files — on a fast connection that's 18 seconds; on mobile it's a timeout. Clients browsing wedding photographers compare 6–8 studios in a session. If your site doesn't load in 3 seconds, most won't wait.

The fix is technically straightforward: convert images to WebP (50–70% smaller at identical visual quality), implement lazy loading so only visible images load first, and set up a CDN for global delivery. Your portfolio would look identical — just load in under 2 seconds.

For a business where the portfolio is the sales pitch, load speed directly affects revenue. I've done this exact optimization for photography and creative studios; results are immediate and measurable.

Would a quick call this week make sense to walk through the specifics?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-04T14:09:55Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_011",
    leadId: "lead_016",
    businessName: "Sunset Roofing & Gutters",
    recipientEmail: "contact@sunsetroofchi.net",
    subject: "No project gallery is hurting Sunset Roofing conversions",
    body: `Hi,

I reviewed Sunset Roofing & Gutters online and noticed a significant gap between the quality of your work — 4.2 stars across 61 reviews is strong — and what your website communicates to prospects. One reviewer said it directly: "I had no way to verify their work online before hiring. Took a chance."

In roofing, the before/after gallery is the single most important conversion element. Homeowners making a $10,000–$25,000 decision need visual evidence before they call. Competitors with a project gallery consistently win the first call, even against contractors with better reviews.

Adding a gallery of your completed jobs — organized by project type (shingle replacement, gutters, storm damage repair) with clear before/after pairs — is typically a 1–2 week project. Combined with your existing review base and a clear service area map, it creates the complete trust package that converts searchers into consultations.

I work with Chicago-area home service contractors on exactly this kind of digital presence gap. Would a 20-minute call this week make sense?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-05T13:19:44Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_012",
    leadId: "lead_018",
    businessName: "Blue Mesa Landscaping",
    recipientEmail: "hello@bluemesalandscape.com",
    subject: "Your homepage image is 9MB — here's what that means",
    body: `Hi,

I came across Blue Mesa Landscaping while researching Austin landscape businesses. The work looks beautiful based on your reviews — 4.3 stars across 49 ratings is a strong reputation. But there's a technical issue that's likely costing you clients before they even see that work.

Your homepage hero image is a 9.2MB TIFF file. On a typical phone connection, it takes 22+ seconds to load. One reviewer mentioned it directly: "Website is a mess — couldn't even load it on my phone." When the first impression of a landscaping business is a blank screen, you've already lost that prospect.

The fix is a single afternoon of work: convert that image to a compressed WebP (under 200KB, visually identical), add lazy loading to your gallery, and your site loads in under 2 seconds. Google's algorithm rewards the speed improvement with better local ranking, which means more organic traffic.

For a business where the visual work is the selling point, a fast-loading site is a direct revenue driver. Would a 15-minute call this week make sense?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-05T07:27:19Z",
    approvedAt: null,
    sentAt: null,
  },
  {
    id: "draft_013",
    leadId: "lead_019",
    businessName: "Cardinal Home Inspections",
    recipientEmail: "info@cardinalhomeinspect.com",
    subject: "Your booking page is broken — Cardinal Home Inspections",
    body: `Hi,

Cardinal Home Inspections has 134 Google reviews at 4.7 stars — that kind of trust is rare and hard-won. But there's a problem that's costing you bookings right now: your online booking page returns a 404 error. Every CTA button on your site leads to a broken page.

One recent reviewer captured the cost: "Tried to book online and the link was broken — had to call instead." That reviewer followed through. Most won't. Homebuyers under time pressure — trying to book an inspection before a contract deadline — will simply move to the next inspector whose booking system works.

This likely happened during a site migration. The fix is straightforward: update the broken links and verify the booking flow end-to-end. Given your strong review base and the urgency-driven nature of inspection bookings, restoring that online booking path could recover meaningful revenue within days.

I help service businesses identify and fix exactly these kinds of silent conversion killers. Would a 15-minute call this week work to walk through the full list of issues I found?`,
    wordCount: 180,
    status: "pending",
    createdAt: "2026-05-04T18:12:05Z",
    approvedAt: null,
    sentAt: null,
  },
];

/** Returns drafts by status for the approval queue */
export function getDraftsByStatus(status: DraftStatus): EmailDraft[] {
  return MOCK_DRAFTS.filter((d) => d.status === status);
}
