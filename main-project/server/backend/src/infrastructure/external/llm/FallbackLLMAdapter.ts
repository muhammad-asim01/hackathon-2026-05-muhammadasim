/**
 * FallbackLLMAdapter — transparent failover wrapper around two ILLMProvider instances.
 *
 * Flow:
 *  1. Try primary (Grok).
 *  2. If primary throws for any reason, log a warning and try fallback (Anthropic).
 *  3. If both fail, throw an ExternalServiceError combining both error messages.
 *
 * Both adapters receive identical arguments — the wrapper is fully transparent
 * to callers like GenerateOutreachEmail and AnalyzeReviews.
 */
import type { ILLMProvider, LLMMessage, LLMOptions } from "@/application/ports/ILLMProvider";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

export class FallbackLLMAdapter implements ILLMProvider {
  constructor(
    private readonly primary:       ILLMProvider,
    private readonly fallback:      ILLMProvider,
    private readonly primaryName:   string = "primary",
    private readonly fallbackName:  string = "fallback"
  ) {}

  async generate(
    systemPrompt: string,
    messages:     readonly LLMMessage[],
    options:      LLMOptions = {}
  ): Promise<string> {
    // ── Primary attempt ───────────────────────────────────────────────────────
    try {
      const result = await this.primary.generate(systemPrompt, messages, options);
      logger.debug({ provider: this.primaryName }, "FallbackLLM: primary responded");
      return result;
    } catch (primaryErr) {
      logger.warn(
        { provider: this.primaryName, err: primaryErr },
        `FallbackLLM: primary failed — switching to ${this.fallbackName}`
      );
    }

    // ── Fallback attempt ──────────────────────────────────────────────────────
    try {
      const result = await this.fallback.generate(systemPrompt, messages, options);
      logger.info({ provider: this.fallbackName }, "FallbackLLM: fallback responded");
      return result;
    } catch (fallbackErr) {
      logger.error(
        { primary: this.primaryName, fallback: this.fallbackName, err: fallbackErr },
        "FallbackLLM: both providers failed"
      );
      throw new ExternalServiceError(
        `All LLM providers exhausted. ${this.primaryName} and ${this.fallbackName} both failed. Last error: ${String(fallbackErr)}`,
        false
      );
    }
  }
}
