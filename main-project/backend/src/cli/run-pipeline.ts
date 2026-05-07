#!/usr/bin/env tsx
/**
 * CLI runner for the Sift.ai pipeline.
 *
 * Usage:
 *   tsx src/cli/run-pipeline.ts "restaurants in Austin TX"
 *   tsx src/cli/run-pipeline.ts "dentists in Seattle WA" --threshold 65 --words 160
 *
 * Options:
 *   --threshold <n>   Score threshold for skipping leads (default: 75)
 *   --words <n>       Email word limit (default: 180)
 */
import { container } from "@/config/container";
import { logger } from "@/utils/logger";

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(): { prompt: string; threshold: number; words: number } {
  const args = process.argv.slice(2);

  // First positional arg is the query prompt
  const prompt = args.find((a) => !a.startsWith("--")) ?? "";
  if (!prompt) {
    console.error(
      "Usage: tsx src/cli/run-pipeline.ts \"<query>\" [--threshold N] [--words N]"
    );
    process.exit(1);
  }

  const thresholdIdx = args.indexOf("--threshold");
  const wordsIdx = args.indexOf("--words");

  const threshold =
    thresholdIdx !== -1 ? parseInt(args[thresholdIdx + 1] ?? "75", 10) : 75;
  const words =
    wordsIdx !== -1 ? parseInt(args[wordsIdx + 1] ?? "180", 10) : 180;

  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    console.error("--threshold must be an integer between 0 and 100");
    process.exit(1);
  }
  if (isNaN(words) || words < 50 || words > 500) {
    console.error("--words must be an integer between 50 and 500");
    process.exit(1);
  }

  return { prompt, threshold, words };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { prompt, threshold, words } = parseArgs();

  logger.info({ prompt, threshold, words }, "Starting pipeline CLI run");

  const { runId } = await container.runPipeline.execute({
    prompt,
    scoreThreshold: threshold,
    wordLimit: words,
  });

  console.log("\n──────────────────────────────────────────");
  console.log(" sift.ai Pipeline — Started");
  console.log("──────────────────────────────────────────");
  console.log(` Run ID: ${runId}`);
  console.log(` Pipeline running in background…`);
  console.log("──────────────────────────────────────────\n");

  // Keep the process alive until the pipeline finishes
  const checkDone = async () => {
    const run = await container.prisma.pipelineRun.findUnique({
      where: { id: runId },
      select: { status: true, leadsFound: true, leadsScored: true, leadsDrafted: true },
    });
    if (run?.status === "SUCCEEDED" || run?.status === "FAILED") {
      if (run.status === "SUCCEEDED") {
        console.log(` Leads found:    ${run.leadsFound}`);
        console.log(` Leads scored:   ${run.leadsScored}`);
        console.log(` Drafts created: ${run.leadsDrafted}`);
      } else {
        console.log(" Pipeline FAILED — check server logs for details");
      }
      console.log("──────────────────────────────────────────\n");
      await container.prisma.$disconnect();
    } else {
      setTimeout(() => { void checkDone(); }, 2_000);
    }
  };

  await checkDone();
}

main().catch((err: unknown) => {
  logger.error({ err }, "CLI run failed");
  process.exit(1);
});
