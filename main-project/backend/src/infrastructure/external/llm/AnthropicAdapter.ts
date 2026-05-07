import Anthropic from "@anthropic-ai/sdk";
import type { ILLMProvider, LLMMessage, LLMOptions } from "@/application/ports/ILLMProvider";
import { ExternalServiceError } from "@/domain/errors";

// Prompt caching reduces costs when the system prompt is reused across calls.
// Cache TTL is 5 minutes on Anthropic's side — high hit rate for pipeline batches.
const CACHE_CONTROL = { type: "ephemeral" } as const;

export class AnthropicAdapter implements ILLMProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    systemPrompt: string,
    messages: readonly LLMMessage[],
    options: LLMOptions = {}
  ): Promise<string> {
    const maxTokens = options.maxTokens ?? 512;
    const temperature = options.temperature;

    let response;
    try {
      response = await this.client.beta.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        ...(temperature !== undefined && { temperature }),
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: CACHE_CONTROL,
          },
        ],
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        betas: ["prompt-caching-2024-07-31"],
      });
    } catch (err) {
      const isTransient =
        err instanceof Error &&
        (err.message.includes("529") || err.message.includes("overloaded"));
      throw new ExternalServiceError(
        `Anthropic API call failed: ${String(err)}`,
        isTransient
      );
    }

    const block = response.content[0];
    if (block?.type !== "text") {
      throw new ExternalServiceError(
        "Anthropic returned non-text content block",
        false
      );
    }

    return block.text;
  }
}
