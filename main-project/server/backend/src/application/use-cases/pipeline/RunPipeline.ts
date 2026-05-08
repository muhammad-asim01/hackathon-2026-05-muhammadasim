import type { IRunRepository } from "@/application/ports/IRunRepository";
import type { ILeadRepository } from "@/application/ports/ILeadRepository";
import type { PlaceResult } from "@/application/ports/IMapsService";
import { DiscoverBusinesses } from "@/application/use-cases/scout/DiscoverBusinesses";
import { AuditWebsite } from "@/application/use-cases/analyst/AuditWebsite";
import { AnalyzeReviews } from "@/application/use-cases/analyst/AnalyzeReviews";
import { GenerateOutreachEmail } from "@/application/use-cases/writer/GenerateOutreachEmail";
import { LogLead } from "@/application/use-cases/tracker/LogLead";
import { isDomainError } from "@/domain/errors";
import { logger } from "@/utils/logger";

export interface RunPipelineInput {
  readonly prompt: string;
  readonly scoreThreshold?: number | undefined;
  readonly wordLimit?: number | undefined;
}

export interface RunPipelineOutput {
  /** Returned immediately — the actual pipeline work runs in the background. */
  readonly runId: string;
}

// Max 3 concurrent website crawls — Playwright launches a full browser per
// crawl; t3.micro has ~1 GB usable RAM after OS/Node overhead.
// Cheerio secondary-page passes are lightweight (no browser), so 3 is safe.
const BATCH_SIZE = 3;

async function batchProcess<T>(
  items: readonly T[],
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fn));
  }
}

export class RunPipeline {
  constructor(
    private readonly runRepo: IRunRepository,
    private readonly leadRepo: ILeadRepository,
    private readonly discoverBusinesses: DiscoverBusinesses,
    private readonly auditWebsite: AuditWebsite,
    private readonly analyzeReviews: AnalyzeReviews,
    private readonly generateEmail: GenerateOutreachEmail,
    private readonly logLead: LogLead
  ) {}

  /**
   * Creates the run record, marks it RUNNING, then fires the pipeline work
   * in the background. Returns the runId immediately so the HTTP handler can
   * respond with 202 while the frontend streams events via SSE polling.
   */
  async execute(input: RunPipelineInput): Promise<RunPipelineOutput> {
    const run = await this.runRepo.create(input.prompt);

    await this.runRepo.update(run.id, { status: "RUNNING" });
    await this.runRepo.addEvent(run.id, {
      agentName: "pipeline",
      level: "INFO",
      message: `Pipeline started for: "${input.prompt}"`,
    });

    // Fire-and-forget — background work continues after HTTP response is sent
    void this._background(run.id, input).catch((err) => {
      logger.error({ err, runId: run.id }, "Pipeline background worker crashed");
    });

    return { runId: run.id };
  }

  // ─── Background worker ────────────────────────────────────────────────────────

  private async _background(runId: string, input: RunPipelineInput): Promise<void> {
    const scoreThreshold = input.scoreThreshold ?? 75;
    const wordLimit = input.wordLimit ?? 180;
    const log = logger.child({ useCase: "RunPipeline", runId, prompt: input.prompt });

    let leadsFound = 0;
    let leadsScored = 0;
    let leadsDrafted = 0;

    try {
      // ── Scout ──────────────────────────────────────────────────────────────────
      const { places, skippedExisting } = await this.discoverBusinesses.execute({
        query: input.prompt,
      });

      leadsFound = places.length;
      await this.runRepo.update(runId, { leadsFound });
      await this.runRepo.addEvent(runId, {
        agentName: "scout",
        level: "SUCCESS",
        message: `Scout found ${leadsFound} new business${leadsFound !== 1 ? "es" : ""} (${skippedExisting} already known)`,
        payload: { leadsFound, skippedExisting },
      });

      // ── Analyst + Writer + Tracker (batched) ───────────────────────────────────
      if (places.length > 0) {
        await this.runRepo.addEvent(runId, {
          agentName: "analyst",
          level: "INFO",
          message: `Analyst auditing ${places.length} business${places.length !== 1 ? "es" : ""}…`,
        });
      }

      await batchProcess(places, async (place) => {
        const placeLog = log.child({ placeId: place.placeId, business: place.businessName });

        const lead = await this.leadRepo.create({
          gmapsPlaceId: place.placeId,
          businessName: place.businessName,
          address: place.address,
          city: place.city,
          niche: place.niche,
          reviewCount: place.reviewCount,
          runId,
          ...(place.phone !== undefined && { phone: place.phone }),
          ...(place.website !== undefined && { website: place.website }),
          ...(place.googleRating !== undefined && { googleRating: place.googleRating }),
        });

        // ── Analyst ────────────────────────────────────────────────────────────
        let auditScore = 0;
        let auditContext: {
          topIssue?: string;
          pageSpeedScore?: number;
          mobileScore?: number;
          hasSSL?: boolean;
        } | undefined;
        let reviewContext: {
          positives: readonly string[];
          negatives: readonly string[];
          avgRating: number;
          excerpt?: string;
        } | undefined;
        let reviewExcerpt: string | undefined;

        // Emit before crawl so the frontend shows the URL being visited
        if (place.website) {
          await this.runRepo.addEvent(runId, {
            agentName: "analyst",
            level: "INFO",
            message: `Analyzing website: ${place.website}`,
            payload: { placeId: place.placeId },
          });
        }

        const [auditSettled, reviewSettled] = await Promise.allSettled([
          this.auditWebsite.execute({ leadId: lead.id, place }),
          place.reviews && place.reviews.length > 0
            ? this.analyzeReviews.execute({
                businessName: place.businessName,
                reviews: place.reviews,
              })
            : Promise.resolve(null),
        ]);

        let extractedEmail: string | undefined;
        // Populated from DB after AuditWebsite writes it — robust fallback when
        // extractedEmails[0] is undefined (e.g. crawl returned empty list).
        let updatedLeadContactEmail: string | undefined;

        if (auditSettled.status === "fulfilled") {
          const { score, audit, extractedEmails } = auditSettled.value;
          auditScore = score.value;
          extractedEmail = extractedEmails[0];

          const updatedLead = await this.leadRepo.findById(lead.id);
          updatedLeadContactEmail = updatedLead?.contactEmail;
          auditContext = {
            ...(updatedLead?.topIssue !== undefined && { topIssue: updatedLead.topIssue }),
            ...(audit.pageSpeedScore !== undefined && { pageSpeedScore: audit.pageSpeedScore }),
            ...(audit.mobileScore !== undefined && { mobileScore: audit.mobileScore }),
            hasSSL: audit.hasSSL,
          };
          await this.runRepo.addEvent(runId, {
            agentName: "analyst",
            level: "SUCCESS",
            message: `Audited ${place.businessName} — score ${auditScore}`,
            payload: { placeId: place.placeId, score: auditScore },
          });

          // Emit email extraction result
          if (extractedEmails.length > 0) {
            await this.runRepo.addEvent(runId, {
              agentName: "analyst",
              level: "INFO",
              message: `Found ${extractedEmails.length} email${extractedEmails.length !== 1 ? "s" : ""}: ${extractedEmails.slice(0, 3).join(", ")}`,
              payload: { placeId: place.placeId, emails: [...extractedEmails] },
            });
          } else if (place.website) {
            await this.runRepo.addEvent(runId, {
              agentName: "analyst",
              level: "WARNING",
              message: `No contact email found on ${place.website}`,
              payload: { placeId: place.placeId },
            });
          }
        } else {
          placeLog.error({ err: auditSettled.reason }, "Audit failed — using fallback score");
          auditScore = this.fallbackScore(place);
          await this.runRepo.addEvent(runId, {
            agentName: "analyst",
            level: "WARNING",
            message: `Audit failed for ${place.businessName}, using fallback score ${auditScore}`,
            payload: { placeId: place.placeId },
          });
          await this.leadRepo.update(lead.id, { digitalScore: auditScore });
        }

        leadsScored++;
        // Persist immediately so the frontend stats strip reflects progress
        await this.runRepo.update(runId, { leadsScored });

        if (auditScore > scoreThreshold) {
          await this.leadRepo.update(lead.id, { status: "SKIPPED" });
          await this.runRepo.addEvent(runId, {
            agentName: "analyst",
            level: "INFO",
            message: `Skipped ${place.businessName} — score ${auditScore} exceeds threshold ${scoreThreshold}`,
            payload: { placeId: place.placeId, score: auditScore },
          });
          return;
        }

        if (reviewSettled.status === "fulfilled" && reviewSettled.value !== null) {
          const summary = reviewSettled.value;
          reviewContext = {
            positives: summary.positives,
            negatives: summary.negatives,
            avgRating: summary.avgRating,
            excerpt: summary.excerpt,
          };
          reviewExcerpt = summary.excerpt || undefined;

          const sentiment =
            summary.avgRating >= 4 ? "positive" : summary.avgRating >= 3 ? "mixed" : "negative";
          await this.leadRepo.update(lead.id, {
            reviewSentiment: sentiment,
            ...(reviewExcerpt !== undefined && { reviewExcerpt }),
          });
        } else if (reviewSettled.status === "rejected") {
          placeLog.warn({ err: reviewSettled.reason }, "Review analysis failed — continuing without");
        }

        // ── Writer ─────────────────────────────────────────────────────────────
        await this.runRepo.addEvent(runId, {
          agentName: "writer",
          level: "INFO",
          message: `Writer generating email for ${place.businessName}…`,
        });

        let emailDraft: { subject: string; body: string; wordCount: number };
        try {
          emailDraft = await this.generateEmail.execute({
            place,
            wordLimit,
            ...(auditContext && { auditFindings: auditContext }),
            ...(reviewContext && { reviewSummary: reviewContext }),
          });

          await this.leadRepo.update(lead.id, { status: "EMAIL_DRAFTED" });
          await this.runRepo.addEvent(runId, {
            agentName: "writer",
            level: "SUCCESS",
            message: `Email drafted for ${place.businessName} (${emailDraft.wordCount} words)`,
            payload: { placeId: place.placeId, wordCount: emailDraft.wordCount },
          });
        } catch (err) {
          placeLog.error({ err }, "Writer failed — skipping this lead");
          await this.runRepo.addEvent(runId, {
            agentName: "writer",
            level: "ERROR",
            message: `Writer failed for ${place.businessName}: ${isDomainError(err) ? err.message : String(err)}`,
            payload: { placeId: place.placeId },
          });
          return;
        }

        // ── Tracker ────────────────────────────────────────────────────────────
        await this.runRepo.addEvent(runId, {
          agentName: "tracker",
          level: "INFO",
          message: `Tracker logging ${place.businessName} to CRM…`,
        });
        // Primary: extractedEmails[0] returned by AuditWebsite from crawler.
        // Fallback: Lead.contactEmail written to DB by AuditWebsite — catches
        // any divergence between the crawler return value and the DB write.
        const recipientEmail = extractedEmail ?? updatedLeadContactEmail;

        placeLog.info(
          { leadId: lead.id, recipientEmail: recipientEmail ?? null },
          recipientEmail
            ? `Tracker: persisting email draft — recipientEmail "${recipientEmail}"`
            : "Tracker: persisting email draft — no recipientEmail (admin supplies at approval)"
        );

        await this.logLead.execute({
          leadId: lead.id,
          email: {
            ...emailDraft,
            ...(recipientEmail !== undefined && { recipientEmail }),
          },
        });

        leadsDrafted++;
        // Persist immediately so the frontend stats strip reflects progress
        await this.runRepo.update(runId, { leadsDrafted });
        await this.runRepo.addEvent(runId, {
          agentName: "tracker",
          level: "SUCCESS",
          message: `${place.businessName} is pending approval`,
          payload: { placeId: place.placeId, score: auditScore },
        });
      });

      // ── Finalise ───────────────────────────────────────────────────────────────
      await this.runRepo.update(runId, {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        leadsFound,
        leadsScored,
        leadsDrafted,
      });

      await this.runRepo.addEvent(runId, {
        agentName: "pipeline",
        level: "SUCCESS",
        message: `Pipeline finished — ${leadsDrafted} leads pending approval`,
        payload: { leadsFound, leadsScored, leadsDrafted },
      });

      log.info({ leadsFound, leadsScored, leadsDrafted }, "Pipeline succeeded");
    } catch (err) {
      const msg = isDomainError(err) ? err.message : String(err);
      log.error({ err }, "Pipeline run failed");

      await this.runRepo.update(runId, {
        status: "FAILED",
        finishedAt: new Date(),
        leadsFound,
        leadsScored,
        leadsDrafted,
        errorMessage: msg,
      });

      await this.runRepo.addEvent(runId, {
        agentName: "pipeline",
        level: "ERROR",
        message: `Pipeline failed: ${msg}`,
      });
    }
  }

  private fallbackScore(place: PlaceResult): number {
    let score = 0;
    if (place.website !== undefined) score += 30;
    const r = place.googleRating ?? 0;
    if (r >= 4.5) score += 35;
    else if (r >= 4.0) score += 25;
    else if (r >= 3.5) score += 15;
    else if (r >= 3.0) score += 8;
    const rv = place.reviewCount;
    if (rv >= 200) score += 35;
    else if (rv >= 100) score += 25;
    else if (rv >= 50) score += 15;
    else if (rv >= 20) score += 8;
    else if (rv >= 5) score += 3;
    return Math.min(score, 100);
  }
}
