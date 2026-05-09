import {
  PrismaClient,
  RunStatus,
  LeadStatus,
  EmailStatus,
  EventLevel,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Wipe all seeded tables atomically — TRUNCATE CASCADE handles FK order
  // automatically, far more reliable than manual delete sequencing.
  await prisma.$executeRaw`TRUNCATE TABLE "RunEvent", "Email", "Audit", "Lead", "PipelineRun", "Settings", "Niche", "MapsCache" RESTART IDENTITY CASCADE`;

  // ─── Settings singleton ────────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      dailyQuota: 3,
      scoreThreshold: 75,
      emailWordLimit: 180,
      targetNiches: ["Auto Repair", "Pet Grooming", "HVAC", "Landscaping"],
      targetCities: ["Chicago, IL", "Austin, TX"],
      fromName: "Muhammad Asim",
      replyToEmail: "muhammadasim.code@gmail.com",
    },
    update: {
      dailyQuota: 3,
      scoreThreshold: 75,
      emailWordLimit: 180,
      targetNiches: ["Auto Repair", "Pet Grooming", "HVAC", "Landscaping"],
      targetCities: ["Chicago, IL", "Austin, TX"],
      fromName: "Muhammad Asim",
      replyToEmail: "muhammadasim.code@gmail.com",
    },
  });

  // ─── Pipeline Runs ─────────────────────────────────────────────────────────
  await prisma.pipelineRun.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "run_001",
        prompt: "Auto Repair in Chicago, IL",
        status: RunStatus.SUCCEEDED,
        startedAt: new Date("2026-05-04T07:00:02Z"),
        finishedAt: new Date("2026-05-04T07:08:44Z"),
        leadsFound: 23,
        leadsScored: 6,
        leadsDrafted: 6,
        leadsEmailed: 3,
      },
      {
        id: "run_002",
        prompt: "Pet Grooming in Chicago, IL",
        status: RunStatus.SUCCEEDED,
        startedAt: new Date("2026-05-04T14:00:01Z"),
        finishedAt: new Date("2026-05-04T14:11:22Z"),
        leadsFound: 19,
        leadsScored: 5,
        leadsDrafted: 5,
        leadsEmailed: 2,
      },
      {
        id: "run_003",
        prompt: "HVAC in Chicago, IL",
        status: RunStatus.FAILED,
        startedAt: new Date("2026-05-05T07:00:00Z"),
        finishedAt: new Date("2026-05-05T07:03:17Z"),
        leadsFound: 31,
        leadsScored: 8,
        leadsDrafted: 0,
        leadsEmailed: 0,
        errorMessage: "Writer agent failed after max retries: 529 Overloaded",
      },
      {
        id: "run_004",
        prompt: "Landscaping in Austin, TX",
        status: RunStatus.SUCCEEDED,
        startedAt: new Date("2026-05-05T08:00:01Z"),
        finishedAt: new Date("2026-05-05T08:14:09Z"),
        leadsFound: 27,
        leadsScored: 4,
        leadsDrafted: 4,
        leadsEmailed: 1,
      },
    ],
  });

  // ─── Leads ─────────────────────────────────────────────────────────────────
  // Status mapping: "new"+draft=PENDING_APPROVAL, "new"+no draft=AUDITED,
  // "contacted"=EMAIL_SENT, "approved"=APPROVED, "rejected"=REJECTED, "cold"=COLD
  await prisma.lead.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "lead_001",
        gmapsPlaceId: "ChIJplace001ChicagoAutoR",
        businessName: "Thornton's Auto Repair",
        address: "142 W Madison St",
        city: "Chicago, IL",
        niche: "Auto Repair",
        phone: "+1 (312) 847-1928",
        website: "thorntonsauto.net",
        googleRating: 4.1,
        reviewCount: 38,
        digitalScore: 22,
        reviewSentiment: "mixed",
        topIssue: "No HTTPS — site served over plain HTTP",
        reviewExcerpt:
          '"The work is solid but their website looks like it was made in 2009. Couldn\'t even find their hours."',
        status: LeadStatus.PENDING_APPROVAL,
        discoveredAt: new Date("2026-05-05T08:14:23Z"),
        runId: "run_001",
      },
      {
        id: "lead_002",
        gmapsPlaceId: "ChIJplace002ChicagoRest",
        businessName: "Bellini's Ristorante",
        address: "889 N Clark St",
        city: "Chicago, IL",
        niche: "Restaurant",
        phone: "+1 (312) 554-0312",
        website: "bellinischi.com",
        googleRating: 3.8,
        reviewCount: 112,
        digitalScore: 41,
        reviewSentiment: "negative",
        topIssue: "Mobile layout completely broken — menu not readable on phone",
        reviewExcerpt:
          '"Food is actually great but I had to call just to see the menu. Website is terrible on mobile."',
        status: LeadStatus.EMAIL_SENT,
        discoveredAt: new Date("2026-05-05T08:19:07Z"),
        runId: "run_001",
      },
      {
        id: "lead_003",
        gmapsPlaceId: "ChIJplace003ChicagoPlumb",
        businessName: "Cascade Plumbing Co.",
        address: "331 S Halsted St",
        city: "Chicago, IL",
        niche: "Plumbing",
        phone: "+1 (312) 203-7741",
        website: "cascadeplumbingco.com",
        googleRating: 4.4,
        reviewCount: 57,
        digitalScore: 58,
        reviewSentiment: "positive",
        topIssue: "No Google Business Profile photos — 0 images uploaded",
        reviewExcerpt:
          '"Called them for an emergency and they showed up fast. Website is basic but they get the job done."',
        status: LeadStatus.APPROVED,
        discoveredAt: new Date("2026-05-04T14:22:51Z"),
        runId: "run_001",
      },
      {
        id: "lead_004",
        gmapsPlaceId: "ChIJplace004ChicagoDent",
        businessName: "Meridian Dental Group",
        address: "1402 N Milwaukee Ave",
        city: "Chicago, IL",
        niche: "Dentist",
        phone: "+1 (312) 449-8830",
        website: "meridiandental.net",
        googleRating: 3.6,
        reviewCount: 89,
        digitalScore: 33,
        reviewSentiment: "negative",
        topIssue: "PageSpeed score 27 — largest contentful paint 8.3s",
        reviewExcerpt:
          '"Staff is nice but their booking system is so outdated. Had to call 3 times to confirm my appointment."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T09:02:14Z"),
        runId: "run_002",
      },
      {
        id: "lead_005",
        gmapsPlaceId: "ChIJplace005ChicagoPetG",
        businessName: "Paw & Whisker Grooming",
        address: "743 W Armitage Ave",
        city: "Chicago, IL",
        niche: "Pet Grooming",
        phone: "+1 (773) 882-4417",
        website: "pawwhiskerchi.com",
        googleRating: 4.7,
        reviewCount: 204,
        digitalScore: 47,
        reviewSentiment: "positive",
        topIssue: "No online booking — customers must call during business hours",
        reviewExcerpt:
          '"Love this place but I wish I could book online. Every time I call it goes to voicemail."',
        status: LeadStatus.PENDING_APPROVAL,
        discoveredAt: new Date("2026-05-05T09:31:44Z"),
        runId: "run_002",
      },
      {
        id: "lead_006",
        gmapsPlaceId: "ChIJplace006ChicagoGym",
        businessName: "Ironwood Fitness & Yoga",
        address: "218 S Wabash Ave",
        city: "Chicago, IL",
        niche: "Gym / Fitness",
        phone: "+1 (312) 771-0093",
        website: "ironwoodfitness.com",
        googleRating: 4.2,
        reviewCount: 163,
        digitalScore: 62,
        reviewSentiment: "positive",
        topIssue: "Social links broken — Instagram 404, Facebook page removed",
        reviewExcerpt:
          '"Great instructors. The social media presence is basically nonexistent though."',
        status: LeadStatus.REJECTED,
        discoveredAt: new Date("2026-05-04T11:45:00Z"),
        runId: "run_001",
      },
      {
        id: "lead_007",
        gmapsPlaceId: "ChIJplace007ChicagoHVAC",
        businessName: "Westside HVAC Solutions",
        address: "5514 W Chicago Ave",
        city: "Chicago, IL",
        niche: "HVAC",
        phone: "+1 (773) 320-6612",
        website: "westsidehvac.biz",
        googleRating: 3.9,
        reviewCount: 44,
        digitalScore: 19,
        reviewSentiment: "mixed",
        topIssue: "Site loads in 12.4s — failing Core Web Vitals on all metrics",
        reviewExcerpt:
          '"Technician knew his stuff but I couldn\'t find any info about pricing on the website."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T10:08:19Z"),
        runId: "run_003",
      },
      {
        id: "lead_008",
        gmapsPlaceId: "ChIJplace008ChicagoBake",
        businessName: "Primrose Bakery & Café",
        address: "1129 N Damen Ave",
        city: "Chicago, IL",
        niche: "Bakery",
        phone: "+1 (773) 661-2984",
        website: "primrosebakery.co",
        googleRating: 4.8,
        reviewCount: 347,
        digitalScore: 38,
        reviewSentiment: "positive",
        topIssue: "No structured data — missing LocalBusiness schema markup",
        reviewExcerpt:
          '"Best croissants in the city. Their Insta is great but the website doesn\'t show their daily specials."',
        status: LeadStatus.EMAIL_SENT,
        discoveredAt: new Date("2026-05-04T16:17:38Z"),
        runId: "run_002",
      },
      {
        id: "lead_009",
        gmapsPlaceId: "ChIJplace009ChicagoLaw",
        businessName: "Lakeview Legal Services",
        address: "3300 N Lincoln Ave",
        city: "Chicago, IL",
        niche: "Law Firm",
        phone: "+1 (773) 501-4480",
        website: "lakeviewlegal.com",
        googleRating: 3.4,
        reviewCount: 21,
        digitalScore: 55,
        reviewSentiment: "mixed",
        topIssue: "Only 21 reviews — competitors average 80+",
        reviewExcerpt:
          '"Handled our case well but very hard to get in touch with. No chat or contact form on the website."',
        status: LeadStatus.COLD,
        discoveredAt: new Date("2026-05-03T13:00:00Z"),
        runId: "run_001",
      },
      {
        id: "lead_010",
        gmapsPlaceId: "ChIJplace010ChicagoElec",
        businessName: "Northside Electric Co.",
        address: "4881 N Broadway St",
        city: "Chicago, IL",
        niche: "Electrician",
        phone: "+1 (773) 744-0921",
        website: "northsideelectric.net",
        googleRating: 4.5,
        reviewCount: 73,
        digitalScore: 28,
        reviewSentiment: "positive",
        topIssue: "Site not indexed — missing sitemap and robots.txt misconfigured",
        reviewExcerpt:
          '"Quick response, fair prices. I honestly found them by luck — couldn\'t find them on Google at first."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T11:20:05Z"),
        runId: "run_003",
      },
      {
        id: "lead_011",
        gmapsPlaceId: "ChIJplace011ChicagoNail",
        businessName: "Riviera Nail Studio",
        address: "2247 N Western Ave",
        city: "Chicago, IL",
        niche: "Nail Salon",
        phone: "+1 (773) 329-0047",
        website: "rivieranailchi.com",
        googleRating: 4.3,
        reviewCount: 188,
        digitalScore: 43,
        reviewSentiment: "positive",
        topIssue: "No gallery page — customers can't see nail designs before booking",
        reviewExcerpt:
          '"Amazing work but I wish their website showed photos. I had to scroll through Yelp to see examples."',
        status: LeadStatus.PENDING_APPROVAL,
        discoveredAt: new Date("2026-05-05T11:47:31Z"),
        runId: "run_003",
      },
      {
        id: "lead_012",
        gmapsPlaceId: "ChIJplace012ChicagoChiro",
        businessName: "Harbor View Chiropractic",
        address: "600 N Lake Shore Dr",
        city: "Chicago, IL",
        niche: "Chiropractor",
        phone: "+1 (312) 228-9910",
        website: "harborviewchiro.com",
        googleRating: 4.6,
        reviewCount: 92,
        digitalScore: 66,
        reviewSentiment: "positive",
        topIssue: "No testimonial page — 92 strong reviews not featured on site",
        reviewExcerpt:
          '"Dr. Harmon is incredible. Wish their site highlighted their reviews — people need to know about this place."',
        status: LeadStatus.APPROVED,
        discoveredAt: new Date("2026-05-04T09:33:18Z"),
        runId: "run_002",
      },
      {
        id: "lead_013",
        gmapsPlaceId: "ChIJplace013ChicagoLock",
        businessName: "Quickfire Locksmith",
        address: "837 W Belmont Ave",
        city: "Chicago, IL",
        niche: "Locksmith",
        phone: "+1 (773) 440-6638",
        website: "quickfirelocks.com",
        googleRating: 3.7,
        reviewCount: 51,
        digitalScore: 16,
        reviewSentiment: "mixed",
        topIssue: "PageSpeed 11 — site timing out on mobile connections",
        reviewExcerpt:
          '"They came fast in an emergency but the website looks sketchy — I almost didn\'t call them."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T12:05:44Z"),
        runId: "run_003",
      },
      {
        id: "lead_014",
        gmapsPlaceId: "ChIJplace014ChicagoPhoto",
        businessName: "Marigold Photography",
        address: "1754 N Clybourn Ave",
        city: "Chicago, IL",
        niche: "Photography",
        phone: "+1 (312) 663-2271",
        website: "marigoldphotowork.com",
        googleRating: 4.9,
        reviewCount: 76,
        digitalScore: 53,
        reviewSentiment: "positive",
        topIssue: "Portfolio images not optimized — 14MB uncompressed JPEGs on homepage",
        reviewExcerpt:
          '"Stunning photos and incredible professionalism. The website is beautiful but SO slow to load."',
        status: LeadStatus.EMAIL_SENT,
        discoveredAt: new Date("2026-05-04T15:08:55Z"),
        runId: "run_002",
      },
      {
        id: "lead_015",
        gmapsPlaceId: "ChIJplace015ChicagoTax",
        businessName: "Pinnacle Tax & Accounting",
        address: "200 W Adams St",
        city: "Chicago, IL",
        niche: "Accountant",
        phone: "+1 (312) 781-5540",
        website: "pinnacletaxchi.com",
        googleRating: 4.0,
        reviewCount: 33,
        digitalScore: 37,
        reviewSentiment: "positive",
        topIssue: "No appointment booking — contact form goes to unmonitored inbox",
        reviewExcerpt:
          '"Very thorough, saved me a lot on taxes. Their website hasn\'t been updated since at least 2021."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T12:44:02Z"),
        runId: "run_003",
      },
      {
        id: "lead_016",
        gmapsPlaceId: "ChIJplace016ChicagoRoof",
        businessName: "Sunset Roofing & Gutters",
        address: "3921 S Pulaski Rd",
        city: "Chicago, IL",
        niche: "Roofing",
        phone: "+1 (773) 580-4413",
        website: "sunsetroofchi.net",
        googleRating: 4.2,
        reviewCount: 61,
        digitalScore: 25,
        reviewSentiment: "mixed",
        topIssue: "No before/after project gallery — conversion blocker for roofing niche",
        reviewExcerpt:
          '"Good quality work but I had no way to verify their work online before hiring. Took a chance."',
        status: LeadStatus.PENDING_APPROVAL,
        discoveredAt: new Date("2026-05-05T13:17:29Z"),
        runId: "run_003",
      },
      {
        id: "lead_017",
        gmapsPlaceId: "ChIJplace017AustinWebD",
        businessName: "Gecko Web Design Studio",
        address: "1840 N Clybourn Ave",
        city: "Austin, TX",
        niche: "Web Design",
        phone: "+1 (512) 347-8820",
        website: "geckowebdesign.co",
        googleRating: 3.5,
        reviewCount: 17,
        digitalScore: 72,
        reviewSentiment: "mixed",
        topIssue: "Portfolio outdated — newest case study is from 2023",
        reviewExcerpt:
          '"The site looks modern but their own portfolio is years out of date. Ironic for a web design firm."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T07:01:11Z"),
        runId: "run_004",
      },
      {
        id: "lead_018",
        gmapsPlaceId: "ChIJplace018AustinLand",
        businessName: "Blue Mesa Landscaping",
        address: "4412 Burnet Rd",
        city: "Austin, TX",
        niche: "Landscaping",
        phone: "+1 (512) 894-3347",
        website: "bluemesalandscape.com",
        googleRating: 4.3,
        reviewCount: 49,
        digitalScore: 31,
        reviewSentiment: "positive",
        topIssue: "Homepage hero image is 9.2MB TIFF — blocking first paint",
        reviewExcerpt:
          '"Beautiful work on our backyard. Website is a mess though — couldn\'t even load it on my phone."',
        status: LeadStatus.PENDING_APPROVAL,
        discoveredAt: new Date("2026-05-05T07:24:55Z"),
        runId: "run_004",
      },
      {
        id: "lead_019",
        gmapsPlaceId: "ChIJplace019AustinHome",
        businessName: "Cardinal Home Inspections",
        address: "2209 S Congress Ave",
        city: "Austin, TX",
        niche: "Home Inspection",
        phone: "+1 (512) 441-7720",
        website: "cardinalhomeinspect.com",
        googleRating: 4.7,
        reviewCount: 134,
        digitalScore: 48,
        reviewSentiment: "positive",
        topIssue: "Booking page 404s — broken link on all CTAs since site migration",
        reviewExcerpt:
          '"Super thorough inspection. Tried to book online and the link was broken — had to call instead."',
        status: LeadStatus.EMAIL_SENT,
        discoveredAt: new Date("2026-05-04T18:09:28Z"),
        runId: "run_004",
      },
      {
        id: "lead_020",
        gmapsPlaceId: "ChIJplace020AustinBike",
        businessName: "Tandem Cycle & Repair",
        address: "908 W 12th St",
        city: "Austin, TX",
        niche: "Bike Shop",
        phone: "+1 (512) 773-0918",
        website: "tandemcycleaustin.com",
        googleRating: 4.6,
        reviewCount: 88,
        digitalScore: 44,
        reviewSentiment: "positive",
        topIssue: "No inventory page — customers can't see what bikes are in stock",
        reviewExcerpt:
          '"Great repairs at fair prices. Would love to browse their bike selection online but there\'s no inventory page."',
        status: LeadStatus.AUDITED,
        discoveredAt: new Date("2026-05-05T08:52:37Z"),
        runId: "run_004",
      },
    ],
  });

  // ─── Audits (one per lead) ─────────────────────────────────────────────────
  await prisma.audit.createMany({
    skipDuplicates: true,
    data: [
      { leadId: "lead_001", pageSpeedScore: 18, mobileScore: 31, hasSSL: false, hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_002", pageSpeedScore: 34, mobileScore: 29, hasSSL: true,  hasMobileMeta: false, hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_003", pageSpeedScore: 61, mobileScore: 55, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_004", pageSpeedScore: 27, mobileScore: 44, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_005", pageSpeedScore: 52, mobileScore: 39, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: false },
      { leadId: "lead_006", pageSpeedScore: 68, mobileScore: 58, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_007", pageSpeedScore: 14, mobileScore: 22, hasSSL: false, hasMobileMeta: false, hasMetaTags: false, hasCTA: false },
      { leadId: "lead_008", pageSpeedScore: 41, mobileScore: 36, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: false, hasCTA: true  },
      { leadId: "lead_009", pageSpeedScore: 59, mobileScore: 51, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: false },
      { leadId: "lead_010", pageSpeedScore: 23, mobileScore: 34, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_011", pageSpeedScore: 48, mobileScore: 40, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_012", pageSpeedScore: 71, mobileScore: 63, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_013", pageSpeedScore: 11, mobileScore: 19, hasSSL: false, hasMobileMeta: false, hasMetaTags: false, hasCTA: false },
      { leadId: "lead_014", pageSpeedScore: 47, mobileScore: 58, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_015", pageSpeedScore: 40, mobileScore: 35, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_016", pageSpeedScore: 20, mobileScore: 28, hasSSL: false, hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_017", pageSpeedScore: 75, mobileScore: 70, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: true  },
      { leadId: "lead_018", pageSpeedScore: 26, mobileScore: 38, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: false, hasCTA: false },
      { leadId: "lead_019", pageSpeedScore: 53, mobileScore: 45, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: false },
      { leadId: "lead_020", pageSpeedScore: 49, mobileScore: 41, hasSSL: true,  hasMobileMeta: true,  hasMetaTags: true,  hasCTA: false },
    ],
  });

  // ─── Emails ────────────────────────────────────────────────────────────────
  await prisma.email.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "email_001",
        leadId: "lead_001",
        subject: "Quick website issue costing you customers — Thornton's",
        body: `Hi,

I was searching for auto repair shops in Chicago and came across Thornton's — the Google reviews are genuinely impressive, especially the consistent mentions of honest pricing. The 4.1-star average with comments like "solid work, fair prices" is exactly what builds trust.

One thing I noticed, though: thorntonsauto.net is still serving over plain HTTP. Chrome flags it as "Not Secure," which research consistently shows causes 15–20% of visitors to leave immediately — especially new customers who don't know you yet. That's real revenue walking out the door before they even call.

On top of that, your mobile PageSpeed score is 31 out of 100. Most people searching "auto repair near me" are on their phones. A slow mobile site means Google ranks you lower and visitors bounce before they find your phone number.

I help local shops fix exactly these issues — typically in under a week, with no disruption to your current site. Results are measurable: more organic traffic, more calls.

Would a 15-minute call this week make sense to walk through what I found?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-04T07:06:01Z"),
      },
      {
        id: "email_002",
        leadId: "lead_002",
        subject: "Your menu is unreadable on phones — Bellini's",
        body: `Hi,

I had Bellini's recommended to me last week and pulled up bellinischi.com on my phone to check the menu — and I genuinely couldn't read it. The layout completely breaks on mobile: text overlaps the images, the menu PDF requires a separate download, and the navigation disappears.

One of your recent Google reviews captured it well: "Food is actually great but I had to call just to see the menu." That reviewer left 3 stars. The food deserved 5.

Here's the problem: 67% of restaurant searches happen on mobile. When your site fails on phones, Google's algorithm sees the bounce rate and deprioritizes you in local results. You're likely losing reservations to competitors with functional mobile sites — not better food.

Fixing the mobile experience typically takes 3–5 days and has a measurable impact on both search ranking and direct reservations within 30 days.

Would it be worth a 20-minute screen share this week so I can show you exactly what I'd change?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-04T07:06:18Z"),
      },
      {
        id: "email_003",
        leadId: "lead_003",
        subject: "57 reviews, zero photos — here's what that costs Cascade",
        body: `Hi,

Cascade Plumbing has 57 Google reviews averaging 4.4 stars — that's a strong foundation. Customers clearly trust you. The issue is that your Google Business Profile has zero photos uploaded, which matters more than most business owners realize.

Profiles with 10+ photos get 520% more calls than those without, according to Google's own data. When a potential customer in Chicago searches for a plumber and compares you to a competitor with a photo of their branded truck and a clean work example, they're going to call them first — even if your reviews are better.

This isn't a major project. A few high-quality photos (your van, a before/after job, your team) uploaded directly to your Google profile can shift your visibility meaningfully within weeks.

I help trades businesses like yours build a consistent digital presence that turns your strong reviews into actual inbound calls. The photo strategy is usually the fastest win.

Is there a good time this week for a quick call?`,
        wordCount: 180,
        status: EmailStatus.APPROVED,
        approvedBy: "admin",
        createdAt: new Date("2026-05-04T07:06:35Z"),
      },
      {
        id: "email_004",
        leadId: "lead_005",
        subject: "204 reviews, but no online booking — Paw & Whisker",
        body: `Hi,

Paw & Whisker Grooming has one of the best review profiles I've seen for a pet grooming shop in Chicago — 204 reviews at 4.7 stars is exceptional. Customers clearly love you. One review summed it up perfectly: "Love this place but I wish I could book online. Every time I call it goes to voicemail."

That one comment points to a real revenue gap. When pet owners can't book online, many simply move to the next option rather than call. With 204 fans already, even a fraction of that lost business adds up to meaningful revenue each month.

An online booking system connected to your existing schedule can be live in under a week. More importantly, it works while you're busy grooming — no phone tag, no missed calls, no lost appointments.

I've helped several Chicago service businesses add this exact capability. The setup is straightforward and the ROI typically shows in the first 30 days.

Would a 15-minute call this week make sense to walk through the options?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-05T08:19:12Z"),
      },
      {
        id: "email_005",
        leadId: "lead_006",
        subject: "Ironwood's social links are all broken",
        body: `Hi,

I came across Ironwood Fitness & Yoga online and noticed something that's likely hurting your new member acquisition: your social media links are broken. The Instagram link returns a 404, and the Facebook link points to a removed page.

For a fitness studio, social proof is everything. When a prospective member visits your site and clicks Instagram — hoping to see classes, instructors, and community — and hits an error, you lose them immediately. One recent reviewer specifically mentioned your social media presence (or lack of it) as a downside, which is unusual given your otherwise strong 4.2-star average.

The fix itself takes less than an hour: update the links, and either reconnect your existing accounts or help you set up fresh ones with a consistent posting strategy. The larger opportunity is using the genuine enthusiasm your members clearly have — visible in those 163 reviews — to attract new ones.

Would a quick call this week make sense? I can walk through exactly what I'd fix and what results look like.`,
        wordCount: 180,
        status: EmailStatus.REJECTED,
        createdAt: new Date("2026-05-04T07:06:52Z"),
      },
      {
        id: "email_006",
        leadId: "lead_008",
        subject: "Your daily specials aren't on your website — Primrose",
        body: `Hi,

Primrose Bakery has 347 Google reviews at 4.8 stars — that's remarkable. People genuinely love what you're making. One review caught my attention: "Best croissants in the city. Their Insta is great but the website doesn't show their daily specials."

That gap between your Instagram engagement and your website is a missed opportunity. Customers who find you through Google search land on a site that doesn't tell them what's available today — so they don't make the detour. Meanwhile, your Instagram followers already want to come in; they just need a reason to act today.

Adding a simple "Today's Specials" section to your homepage — even just pulling from an Instagram feed — can meaningfully increase daily foot traffic from search. Combined with fixing your structured data (your site is missing LocalBusiness schema, which affects how Google displays your hours and menu), the impact compounds.

I help Chicago restaurants and cafés connect their online presence to actual in-store traffic. Would a 15-minute call this week make sense?`,
        wordCount: 180,
        status: EmailStatus.SENT,
        approvedBy: "admin",
        sentAt: new Date("2026-05-04T16:05:11Z"),
        createdAt: new Date("2026-05-04T14:09:15Z"),
      },
      {
        id: "email_007",
        leadId: "lead_009",
        subject: "No contact form is costing Lakeview Legal clients",
        body: `Hi,

I reviewed Lakeview Legal Services online and noticed something that likely costs you consultations every week: there's no contact form or live chat on your website. Potential clients in a stressful legal situation who arrive at your site outside business hours have no way to initiate contact — so they move on to a firm that makes it easy to reach out at 10pm.

One of your recent reviewers put it directly: "Very hard to get in touch with. No chat or contact form on the website." For a law firm, trust and accessibility go hand in hand.

Your review count is also worth addressing. With 21 reviews against competitors averaging 80+, you're at a visibility disadvantage in local search — even with your 3.4-star base to build from. A simple review solicitation workflow, sent to satisfied clients at close of matter, can meaningfully shift that within 90 days.

I work with professional services firms to fix exactly these conversion gaps. Would a 20-minute call this week be a good fit?`,
        wordCount: 180,
        status: EmailStatus.SENT,
        approvedBy: "admin",
        sentAt: new Date("2026-05-04T10:25:33Z"),
        createdAt: new Date("2026-05-04T07:07:09Z"),
      },
      {
        id: "email_008",
        leadId: "lead_011",
        subject: "188 fans can't see your work online — Riviera",
        body: `Hi,

Riviera Nail Studio has 188 Google reviews at 4.3 stars — your customers clearly love what you create. But one review stood out: "Amazing work but I wish their website showed photos. I had to scroll through Yelp to see examples."

For a nail studio, visual evidence is the primary sales tool. When potential clients land on your website and can't see the quality of your nail art, they don't book — they keep searching until they find a studio that shows its work upfront. You're winning on quality but losing on presentation.

A gallery page featuring your best work (organized by style — gel, acrylic, nail art, seasonal) takes roughly a week to design and build. Done right, it becomes the page that converts browsers into first-time bookings, and combined with your strong review base, creates a compelling reason for people to choose Riviera over a competitor.

I help Chicago beauty businesses turn their reputation into consistent new client acquisition. Would a 15-minute call this week make sense?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-05T11:51:02Z"),
      },
      {
        id: "email_009",
        leadId: "lead_012",
        subject: "92 great reviews not showing on your site — Harbor View",
        body: `Hi,

Harbor View Chiropractic has 92 Google reviews averaging 4.6 stars. That's exceptional social proof — and it's essentially invisible to anyone who finds your website directly. One reviewer put it best: "Dr. Harmon is incredible. Wish their site highlighted their reviews — people need to know about this place."

In healthcare, trust is the deciding factor. When a new patient lands on your website trying to decide between chiropractors, the absence of testimonials creates doubt that your quality doesn't deserve. Competitors with fewer reviews but a testimonials page often win simply because they surface the evidence.

Adding a testimonials section — pulling your top reviews, organized by condition treated — combined with structured data markup that helps Google display your star rating in search results, typically increases organic click-through rates by 20–30% within 60 days.

This is a focused, high-impact change for a practice that has already done the hard work of earning patient trust. Would a 15-minute call this week work to discuss the approach?`,
        wordCount: 180,
        status: EmailStatus.APPROVED,
        approvedBy: "admin",
        createdAt: new Date("2026-05-04T14:09:38Z"),
      },
      {
        id: "email_010",
        leadId: "lead_014",
        subject: "Your portfolio is stunning — but it loads in 18 seconds",
        body: `Hi,

I came across Marigold Photography's portfolio online — the work is genuinely beautiful. One recent reviewer captured it well: "Stunning photos and incredible professionalism. The website is beautiful but SO slow to load."

That slowness is a real problem for a photography business. Your homepage is loading 14MB of uncompressed JPEG files — on a fast connection that's 18 seconds; on mobile it's a timeout. Clients browsing wedding photographers compare 6–8 studios in a session. If your site doesn't load in 3 seconds, most won't wait.

The fix is technically straightforward: convert images to WebP (50–70% smaller at identical visual quality), implement lazy loading so only visible images load first, and set up a CDN for global delivery. Your portfolio would look identical — just load in under 2 seconds.

For a business where the portfolio is the sales pitch, load speed directly affects revenue. I've done this exact optimization for photography and creative studios; results are immediate and measurable.

Would a quick call this week make sense to walk through the specifics?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-04T14:09:55Z"),
      },
      {
        id: "email_011",
        leadId: "lead_016",
        subject: "No project gallery is hurting Sunset Roofing conversions",
        body: `Hi,

I reviewed Sunset Roofing & Gutters online and noticed a significant gap between the quality of your work — 4.2 stars across 61 reviews is strong — and what your website communicates to prospects. One reviewer said it directly: "I had no way to verify their work online before hiring. Took a chance."

In roofing, the before/after gallery is the single most important conversion element. Homeowners making a $10,000–$25,000 decision need visual evidence before they call. Competitors with a project gallery consistently win the first call, even against contractors with better reviews.

Adding a gallery of your completed jobs — organized by project type (shingle replacement, gutters, storm damage repair) with clear before/after pairs — is typically a 1–2 week project. Combined with your existing review base and a clear service area map, it creates the complete trust package that converts searchers into consultations.

I work with Chicago-area home service contractors on exactly this kind of digital presence gap. Would a 20-minute call this week make sense?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-05T13:19:44Z"),
      },
      {
        id: "email_012",
        leadId: "lead_018",
        subject: "Your homepage image is 9MB — here's what that means",
        body: `Hi,

I came across Blue Mesa Landscaping while researching Austin landscape businesses. The work looks beautiful based on your reviews — 4.3 stars across 49 ratings is a strong reputation. But there's a technical issue that's likely costing you clients before they even see that work.

Your homepage hero image is a 9.2MB TIFF file. On a typical phone connection, it takes 22+ seconds to load. One reviewer mentioned it directly: "Website is a mess — couldn't even load it on my phone." When the first impression of a landscaping business is a blank screen, you've already lost that prospect.

The fix is a single afternoon of work: convert that image to a compressed WebP (under 200KB, visually identical), add lazy loading to your gallery, and your site loads in under 2 seconds. Google's algorithm rewards the speed improvement with better local ranking, which means more organic traffic.

For a business where the visual work is the selling point, a fast-loading site is a direct revenue driver. Would a 15-minute call this week make sense?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-05T07:27:19Z"),
      },
      {
        id: "email_013",
        leadId: "lead_019",
        subject: "Your booking page is broken — Cardinal Home Inspections",
        body: `Hi,

Cardinal Home Inspections has 134 Google reviews at 4.7 stars — that kind of trust is rare and hard-won. But there's a problem that's costing you bookings right now: your online booking page returns a 404 error. Every CTA button on your site leads to a broken page.

One recent reviewer captured the cost: "Tried to book online and the link was broken — had to call instead." That reviewer followed through. Most won't. Homebuyers under time pressure — trying to book an inspection before a contract deadline — will simply move to the next inspector whose booking system works.

This likely happened during a site migration. The fix is straightforward: update the broken links and verify the booking flow end-to-end. Given your strong review base and the urgency-driven nature of inspection bookings, restoring that online booking path could recover meaningful revenue within days.

I help service businesses identify and fix exactly these kinds of silent conversion killers. Would a 15-minute call this week work to walk through the full list of issues I found?`,
        wordCount: 180,
        status: EmailStatus.PENDING_APPROVAL,
        createdAt: new Date("2026-05-04T18:12:05Z"),
      },
    ],
  });

  // ─── Run Events ────────────────────────────────────────────────────────────
  await prisma.runEvent.createMany({
    skipDuplicates: true,
    data: [
      // run_001 — Auto Repair Chicago
      { id: "evt_001_01", runId: "run_001", agentName: "Scout",    level: EventLevel.INFO,    message: 'Querying Google Maps for "Auto Repair" in Chicago, IL',                    createdAt: new Date("2026-05-04T07:00:05Z") },
      { id: "evt_001_02", runId: "run_001", agentName: "Scout",    level: EventLevel.INFO,    message: "Found 23 places — 8 within bounding box, deduplicating against 30-day cache", createdAt: new Date("2026-05-04T07:00:14Z") },
      { id: "evt_001_03", runId: "run_001", agentName: "Scout",    level: EventLevel.SUCCESS, message: "After dedup: 23 unique leads queued for analysis",                          createdAt: new Date("2026-05-04T07:00:21Z") },
      { id: "evt_001_04", runId: "run_001", agentName: "Analyst",  level: EventLevel.INFO,    message: "Crawling Thornton's Auto Repair (thorntonsauto.net)",                        createdAt: new Date("2026-05-04T07:01:03Z") },
      { id: "evt_001_05", runId: "run_001", agentName: "Analyst",  level: EventLevel.WARNING, message: "thorntonsauto.net → PageSpeed 18, Mobile 31, no HTTPS — score: 22",         createdAt: new Date("2026-05-04T07:01:39Z") },
      { id: "evt_001_06", runId: "run_001", agentName: "Analyst",  level: EventLevel.INFO,    message: "Crawling Bellini's Ristorante (bellinischi.com)",                            createdAt: new Date("2026-05-04T07:02:01Z") },
      { id: "evt_001_07", runId: "run_001", agentName: "Analyst",  level: EventLevel.WARNING, message: "bellinischi.com → PageSpeed 34, Mobile 29 — score: 41",                     createdAt: new Date("2026-05-04T07:02:28Z") },
      { id: "evt_001_08", runId: "run_001", agentName: "Analyst",  level: EventLevel.INFO,    message: "17 leads scored above 75 — skipped",                                        createdAt: new Date("2026-05-04T07:04:55Z") },
      { id: "evt_001_09", runId: "run_001", agentName: "Analyst",  level: EventLevel.SUCCESS, message: "6 leads qualify for outreach (score ≤ 75)",                                 createdAt: new Date("2026-05-04T07:05:02Z") },
      { id: "evt_001_10", runId: "run_001", agentName: "Writer",   level: EventLevel.INFO,    message: "Drafting email for Thornton's Auto Repair — referencing HTTPS issue + review", createdAt: new Date("2026-05-04T07:05:14Z") },
      { id: "evt_001_11", runId: "run_001", agentName: "Writer",   level: EventLevel.INFO,    message: "Draft complete: 182 words — trimming to 180 target",                        createdAt: new Date("2026-05-04T07:05:31Z") },
      { id: "evt_001_12", runId: "run_001", agentName: "Writer",   level: EventLevel.SUCCESS, message: "All 6 email drafts generated and queued for approval",                      createdAt: new Date("2026-05-04T07:06:44Z") },
      { id: "evt_001_13", runId: "run_001", agentName: "Tracker",  level: EventLevel.INFO,    message: "Logging 6 leads to Google Sheets CRM",                                      createdAt: new Date("2026-05-04T07:07:02Z") },
      { id: "evt_001_14", runId: "run_001", agentName: "Tracker",  level: EventLevel.SUCCESS, message: "Leads appended to Sheets tab 'Leads 2026-05' — rows 47–52",                 createdAt: new Date("2026-05-04T07:07:19Z") },
      { id: "evt_001_15", runId: "run_001", agentName: "Reporter", level: EventLevel.INFO,    message: "Sending daily summary email to muhammadasim.code@gmail.com",                createdAt: new Date("2026-05-04T07:08:30Z") },
      { id: "evt_001_16", runId: "run_001", agentName: "Reporter", level: EventLevel.SUCCESS, message: "Summary delivered — run complete",                                           createdAt: new Date("2026-05-04T07:08:44Z") },

      // run_002 — Pet Grooming Chicago
      { id: "evt_002_01", runId: "run_002", agentName: "Scout",    level: EventLevel.INFO,    message: 'Querying Google Maps for "Pet Grooming" in Chicago, IL',                    createdAt: new Date("2026-05-04T14:00:05Z") },
      { id: "evt_002_02", runId: "run_002", agentName: "Scout",    level: EventLevel.INFO,    message: "Found 19 places — applying 30-day dedup cache",                             createdAt: new Date("2026-05-04T14:00:18Z") },
      { id: "evt_002_03", runId: "run_002", agentName: "Analyst",  level: EventLevel.INFO,    message: "Analyzing 19 websites — running PageSpeed + mobile checks",                 createdAt: new Date("2026-05-04T14:01:00Z") },
      { id: "evt_002_04", runId: "run_002", agentName: "Analyst",  level: EventLevel.INFO,    message: "14 leads above score threshold — skipped",                                  createdAt: new Date("2026-05-04T14:06:11Z") },
      { id: "evt_002_05", runId: "run_002", agentName: "Analyst",  level: EventLevel.SUCCESS, message: "5 leads qualify (score ≤ 75)",                                              createdAt: new Date("2026-05-04T14:06:14Z") },
      { id: "evt_002_06", runId: "run_002", agentName: "Writer",   level: EventLevel.INFO,    message: "Generating 5 personalized drafts via Claude Sonnet 4.6",                   createdAt: new Date("2026-05-04T14:06:30Z") },
      { id: "evt_002_07", runId: "run_002", agentName: "Writer",   level: EventLevel.SUCCESS, message: "All 5 drafts complete — queued in approval inbox",                          createdAt: new Date("2026-05-04T14:09:02Z") },
      { id: "evt_002_08", runId: "run_002", agentName: "Tracker",  level: EventLevel.SUCCESS, message: "Synced 5 leads to Google Sheets — rows 53–57",                              createdAt: new Date("2026-05-04T14:10:41Z") },
      { id: "evt_002_09", runId: "run_002", agentName: "Reporter", level: EventLevel.SUCCESS, message: "Daily summary sent — run complete",                                          createdAt: new Date("2026-05-04T14:11:22Z") },

      // run_003 — HVAC Chicago (failed)
      { id: "evt_003_01", runId: "run_003", agentName: "Scout",    level: EventLevel.INFO,    message: 'Querying Google Maps for "HVAC" in Chicago, IL',                            createdAt: new Date("2026-05-05T07:00:04Z") },
      { id: "evt_003_02", runId: "run_003", agentName: "Scout",    level: EventLevel.SUCCESS, message: "Found 31 places — 12 new after dedup",                                      createdAt: new Date("2026-05-05T07:00:22Z") },
      { id: "evt_003_03", runId: "run_003", agentName: "Analyst",  level: EventLevel.INFO,    message: "Scoring 12 leads",                                                          createdAt: new Date("2026-05-05T07:00:40Z") },
      { id: "evt_003_04", runId: "run_003", agentName: "Analyst",  level: EventLevel.SUCCESS, message: "8 leads qualify for outreach",                                              createdAt: new Date("2026-05-05T07:01:58Z") },
      { id: "evt_003_05", runId: "run_003", agentName: "Writer",   level: EventLevel.INFO,    message: "Calling Claude Sonnet 4.6 API",                                             createdAt: new Date("2026-05-05T07:02:10Z") },
      { id: "evt_003_06", runId: "run_003", agentName: "Writer",   level: EventLevel.WARNING, message: "API error: 529 Overloaded — retry 1/3",                                     createdAt: new Date("2026-05-05T07:02:31Z") },
      { id: "evt_003_07", runId: "run_003", agentName: "Writer",   level: EventLevel.WARNING, message: "API error: 529 Overloaded — retry 2/3",                                     createdAt: new Date("2026-05-05T07:02:52Z") },
      { id: "evt_003_08", runId: "run_003", agentName: "Writer",   level: EventLevel.ERROR,   message: "API error: 529 Overloaded — max retries exceeded. Writer agent failed.",    createdAt: new Date("2026-05-05T07:03:17Z") },

      // run_004 — Landscaping Austin
      { id: "evt_004_01", runId: "run_004", agentName: "Scout",    level: EventLevel.INFO,    message: 'Querying Google Maps for "Landscaping" in Austin, TX',                      createdAt: new Date("2026-05-05T08:00:05Z") },
      { id: "evt_004_02", runId: "run_004", agentName: "Scout",    level: EventLevel.SUCCESS, message: "Found 27 places — 14 new after dedup",                                      createdAt: new Date("2026-05-05T08:00:29Z") },
      { id: "evt_004_03", runId: "run_004", agentName: "Analyst",  level: EventLevel.INFO,    message: "Running PageSpeed + mobile audit on 14 sites",                              createdAt: new Date("2026-05-05T08:01:00Z") },
      { id: "evt_004_04", runId: "run_004", agentName: "Analyst",  level: EventLevel.INFO,    message: "10 leads above score threshold — skipped",                                  createdAt: new Date("2026-05-05T08:05:44Z") },
      { id: "evt_004_05", runId: "run_004", agentName: "Analyst",  level: EventLevel.SUCCESS, message: "4 leads qualify (score ≤ 75)",                                              createdAt: new Date("2026-05-05T08:05:48Z") },
      { id: "evt_004_06", runId: "run_004", agentName: "Writer",   level: EventLevel.INFO,    message: "Drafting 4 personalized emails",                                            createdAt: new Date("2026-05-05T08:06:00Z") },
      { id: "evt_004_07", runId: "run_004", agentName: "Writer",   level: EventLevel.SUCCESS, message: "All 4 drafts ready",                                                        createdAt: new Date("2026-05-05T08:10:22Z") },
      { id: "evt_004_08", runId: "run_004", agentName: "Tracker",  level: EventLevel.SUCCESS, message: "Logged 4 leads to Sheets — rows 58–61",                                     createdAt: new Date("2026-05-05T08:12:55Z") },
      { id: "evt_004_09", runId: "run_004", agentName: "Reporter", level: EventLevel.SUCCESS, message: "Summary delivered — run complete",                                           createdAt: new Date("2026-05-05T08:14:09Z") },
    ],
  });

  console.log("Seed complete — 4 runs, 20 leads, 20 audits, 13 emails, 41 events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
