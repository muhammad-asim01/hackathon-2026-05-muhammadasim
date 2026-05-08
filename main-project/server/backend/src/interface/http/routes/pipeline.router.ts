/**
 * POST  /api/pipeline/run             — trigger a new pipeline run (returns 202 + runId immediately)
 * GET   /api/pipeline/runs            — list all runs (paginated)
 * GET   /api/pipeline/runs/:id        — get run + events snapshot
 * GET   /api/pipeline/runs/:id/events — SSE live stream (accepts ?token= for EventSource compat)
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";
import { RunNotFoundError, ValidationError } from "@/domain/errors";
import { logger } from "@/utils/logger";
import { toRunDTO, toRunEventDTO } from "@/interface/http/dto";

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** Injects query-param token into the Authorization header so requireAuth works for SSE clients. */
function injectSseToken(req: Request, _res: Response, next: NextFunction): void {
  const tokenParam = req.query.token;
  if (typeof tokenParam === "string" && tokenParam && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${tokenParam}`;
  }
  next();
}

const router = Router();

// ─── POST /api/pipeline/run ───────────────────────────────────────────────────

const startRunSchema = z.object({
  prompt: z.string().min(3, "prompt must be at least 3 characters"),
  scoreThreshold: z.number().int().min(0).max(100).optional(),
  wordLimit: z.number().int().min(50).max(500).optional(),
});

router.post(
  "/run",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid body"));
      return;
    }

    try {
      const { prompt, scoreThreshold, wordLimit } = parsed.data;
      // Returns immediately — pipeline runs in background
      const { runId } = await container.runPipeline.execute({
        prompt,
        ...(scoreThreshold !== undefined && { scoreThreshold }),
        ...(wordLimit !== undefined && { wordLimit }),
      });
      res.status(202).json({ ok: true, data: { runId } });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/pipeline/runs ───────────────────────────────────────────────────

const listRunsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get(
  "/runs",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = listRunsSchema.safeParse(req.query);
    if (!parsed.success) {
      next(new ValidationError("Invalid query params"));
      return;
    }
    try {
      const runs = await container.runRepo.findMany(parsed.data);
      // Batch-fetch all events in a single query (avoids N+1)
      const eventsMap = await container.runRepo.getEventsByRunIds(runs.map((r) => r.id));
      const dtos = runs.map((run) => toRunDTO(run, eventsMap.get(run.id) ?? []));
      res.json({ ok: true, data: dtos });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/pipeline/runs/:id ───────────────────────────────────────────────

router.get(
  "/runs/:id",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = param(req, "id");
    try {
      const run = await container.runRepo.findById(id);
      if (!run) {
        next(new RunNotFoundError(id));
        return;
      }
      const events = await container.runRepo.getEvents(id);
      res.json({ ok: true, data: toRunDTO(run, events) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/pipeline/runs/:id/events  (SSE) ────────────────────────────────
// EventSource can't send custom headers — accepts ?token=<jwt> as fallback.

const SSE_POLL_INTERVAL_MS = 200;
const SSE_MAX_DURATION_MS = 10 * 60 * 1_000;

router.get(
  "/runs/:id/events",
  injectSseToken,
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const runId = param(req, "id");
    const log = logger.child({ handler: "SSE /runs/:id/events", runId });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Track sent event IDs in a Set — reliable regardless of ID format (CUID v2 is not sortable)
    const sentEventIds = new Set<string>();
    let closed = false;

    req.on("close", () => {
      closed = true;
      log.info("SSE client disconnected");
    });

    const deadline = Date.now() + SSE_MAX_DURATION_MS;

    const send = (payload: object) => {
      if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const poll = async () => {
      if (closed || Date.now() > deadline) {
        if (!closed) { send({ type: "timeout" }); res.end(); }
        return;
      }

      try {
        const run = await container.runRepo.findById(runId);
        if (!run) {
          send({ type: "error", message: "Run not found" });
          res.end();
          return;
        }

        const events = await container.runRepo.getEvents(runId);
        // Filter to only events not yet sent — Set-based dedup is ID-format-safe
        const newEvents = events.filter((e) => !sentEventIds.has(e.id));

        for (const event of newEvents) {
          send({ type: "event", data: toRunEventDTO(event) });
          sentEventIds.add(event.id);
        }

        if (run.status === "SUCCEEDED" || run.status === "FAILED") {
          send({
            type: "done",
            status: run.status === "SUCCEEDED" ? "complete" : "failed",
            data: toRunDTO(run, events),
          });
          res.end();
          return;
        }
      } catch (err) {
        log.error({ err }, "SSE poll error");
        send({ type: "error", message: "Internal polling error" });
        res.end();
        return;
      }

      setTimeout(() => { void poll(); }, SSE_POLL_INTERVAL_MS);
    };

    void poll();
  }
);

export { router as pipelineRouter };
