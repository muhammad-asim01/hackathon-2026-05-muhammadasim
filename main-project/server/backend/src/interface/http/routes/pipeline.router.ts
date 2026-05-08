/**
 * POST  /api/pipeline/run             — trigger a new pipeline run (202 + runId immediately)
 * GET   /api/pipeline/runs            — list all runs (paginated)
 * GET   /api/pipeline/runs/:id        — single run + events snapshot
 * GET   /api/pipeline/runs/:id/events — SSE live stream (?token= for EventSource compat)
 *
 * SSE optimisations vs the naïve implementation:
 *  • Single DB round-trip per tick via findByIdWithEvents (was two separate queries)
 *  • Adaptive poll interval: 200ms → 600ms → 1 500ms as the run ages without new events
 *  • Heartbeat comment frame every 25s — prevents proxy/CDN connection resets
 *  • Clean async-while loop — easier to reason about than recursive setTimeout
 */
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { container } from "@/config/container";
import { requireAuth } from "@/interface/http/middleware/auth";
import { RunNotFoundError, ValidationError } from "@/domain/errors";
import { logger } from "@/utils/logger";
import { toRunDTO, toRunEventDTO } from "@/interface/http/dto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function param(req: Request, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Injects ?token= into Authorization so requireAuth works for SSE clients. */
function injectSseToken(req: Request, _res: Response, next: NextFunction): void {
  const tokenParam = req.query.token;
  if (typeof tokenParam === "string" && tokenParam && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${tokenParam}`;
  }
  next();
}

// ─── Adaptive poll interval ───────────────────────────────────────────────────
//
// Pipeline steps are bursty: the Scout emits ~3 events in < 2s, then the
// Analyst goes quiet for 10–40s while Playwright crawls. Polling flat at
// 200ms wastes ~8 queries/s during the long crawl phase with no benefit.
//
// Strategy: start fast, back off after 3 consecutive empty polls, snap back
// to fast as soon as a new event arrives.

const POLL_FAST_MS  = 200;    // burst phase — events arriving
const POLL_MID_MS   = 700;    // settling — no events for 3 polls
const POLL_SLOW_MS  = 1_800;  // idle — no events for 8 polls
const POLL_EMPTY_MID   = 3;   // # consecutive empty polls → MID
const POLL_EMPTY_SLOW  = 8;   // # consecutive empty polls → SLOW

function nextInterval(emptyPolls: number): number {
  if (emptyPolls < POLL_EMPTY_MID)  return POLL_FAST_MS;
  if (emptyPolls < POLL_EMPTY_SLOW) return POLL_MID_MS;
  return POLL_SLOW_MS;
}

const SSE_MAX_DURATION_MS = 10 * 60 * 1_000; // 10-minute hard cap
const SSE_HEARTBEAT_MS    = 25_000;           // proxy keep-alive

const router = Router();

// ─── POST /api/pipeline/run ───────────────────────────────────────────────────

const startRunSchema = z.object({
  prompt:         z.string().min(3, "prompt must be at least 3 characters").max(2000, "prompt must be 2000 characters or fewer"),
  scoreThreshold: z.number().int().min(0).max(100).optional(),
  wordLimit:      z.number().int().min(50).max(500).optional(),
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
      const { runId } = await container.runPipeline.execute({
        prompt,
        ...(scoreThreshold !== undefined && { scoreThreshold }),
        ...(wordLimit      !== undefined && { wordLimit }),
      });
      res.status(202).json({ ok: true, data: { runId } });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/pipeline/runs ───────────────────────────────────────────────────

const listRunsSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(10),
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
      const runs      = await container.runRepo.findMany(parsed.data);
      const eventsMap = await container.runRepo.getEventsByRunIds(runs.map((r) => r.id));
      const dtos      = runs.map((run) => toRunDTO(run, eventsMap.get(run.id) ?? []));
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
      const result = await container.runRepo.findByIdWithEvents(id);
      if (!result) { next(new RunNotFoundError(id)); return; }
      res.json({ ok: true, data: toRunDTO(result.run, result.events) });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/pipeline/runs/:id/events  (SSE) ────────────────────────────────

router.get(
  "/runs/:id/events",
  injectSseToken,
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const runId = param(req, "id");
    const log   = logger.child({ handler: "SSE /runs/:id/events", runId });

    res.setHeader("Content-Type",      "text/event-stream");
    res.setHeader("Cache-Control",     "no-cache");
    res.setHeader("Connection",        "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");   // disable nginx buffering
    res.flushHeaders();

    const sentIds  = new Set<string>();
    let   closed   = false;

    req.on("close", () => {
      closed = true;
      log.info("SSE client disconnected");
    });

    const send = (payload: object): void => {
      if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // SSE comment frame — keeps the TCP connection alive through proxies/CDNs
    // without sending a real event the client has to handle.
    const heartbeat = (): void => {
      if (!closed) res.write(": heartbeat\n\n");
    };

    const deadline       = Date.now() + SSE_MAX_DURATION_MS;
    let   emptyPolls     = 0;
    let   lastHeartbeat  = Date.now();

    while (!closed && Date.now() < deadline) {
      // ── Heartbeat ─────────────────────────────────────────────────────────
      if (Date.now() - lastHeartbeat >= SSE_HEARTBEAT_MS) {
        heartbeat();
        lastHeartbeat = Date.now();
      }

      // ── Single DB round-trip (run + events) ───────────────────────────────
      let pollResult: Awaited<ReturnType<typeof container.runRepo.findByIdWithEvents>>;
      try {
        pollResult = await container.runRepo.findByIdWithEvents(runId);
      } catch (err) {
        log.error({ err }, "SSE poll DB error");
        send({ type: "error", message: "Internal polling error" });
        res.end();
        return;
      }

      if (!pollResult) {
        send({ type: "error", message: "Run not found" });
        res.end();
        return;
      }

      const { run, events } = pollResult;

      // ── Emit new events ───────────────────────────────────────────────────
      const newEvents = events.filter((e) => !sentIds.has(e.id));
      for (const evt of newEvents) {
        send({ type: "event", data: toRunEventDTO(evt) });
        sentIds.add(evt.id);
      }

      // ── Adaptive back-off ─────────────────────────────────────────────────
      if (newEvents.length > 0) {
        emptyPolls = 0;
      } else {
        emptyPolls++;
      }

      // ── Terminal states ───────────────────────────────────────────────────
      if (run.status === "SUCCEEDED" || run.status === "FAILED") {
        send({
          type:   "done",
          status: run.status === "SUCCEEDED" ? "complete" : "failed",
          data:   toRunDTO(run, events),
        });
        res.end();
        return;
      }

      await sleep(nextInterval(emptyPolls));
    }

    // Deadline reached or client already gone
    if (!closed) {
      send({ type: "timeout" });
      res.end();
    }
  }
);

export { router as pipelineRouter };
