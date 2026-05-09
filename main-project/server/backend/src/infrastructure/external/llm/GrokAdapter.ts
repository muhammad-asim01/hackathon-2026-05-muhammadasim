/**
 * GrokAdapter — ILLMProvider implementation backed by Groq's Responses API.
 *
 * Groq exposes an OpenAI-compatible Responses API at /v1/responses.
 * This is distinct from /v1/chat/completions — request and response shapes differ.
 *
 * Request:  { model, input: [{role, content}], max_output_tokens }
 * Response: { output: [{ type:"message"|"reasoning", content:[{type:"output_text", text}] }] }
 *
 * Primary provider in the LLM fallback chain:
 *   GrokAdapter → AnthropicAdapter → MockLLMAdapter (dev only)
 *
 * Model default: openai/gpt-oss-20b
 * Docs: https://console.groq.com/docs/openai
 */
import type { ILLMProvider, LLMMessage, LLMOptions } from "@/application/ports/ILLMProvider";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/utils/logger";

const GROQ_BASE_URL  = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL  = "openai/gpt-oss-20b";

// ─── Wire-format types (Responses API) ───────────────────────────────────────

interface GroqInputMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqRequest {
  model:             string;
  input:             GroqInputMessage[];
  max_output_tokens: number;
  reasoning?:        { effort: "low" | "medium" | "high" };
}

interface GroqOutputContent {
  type: "output_text" | "reasoning_text";
  text: string;
  annotations?: unknown[];
  logprobs?:    null;
}

interface GroqOutputItem {
  type:     "message" | "reasoning";
  id:       string;
  status:   "completed" | "in_progress" | "failed";
  role?:    "assistant";
  content?: GroqOutputContent[];
  summary?: unknown[];
}

interface GroqResponseBody {
  id:          string;
  object:      string;
  status:      "completed" | "in_progress" | "failed";
  created_at:  number;
  model:       string;
  output:      GroqOutputItem[];
  temperature: number;
  top_p:       number;
  usage?: {
    input_tokens:          number;
    output_tokens:         number;
    total_tokens:          number;
    input_tokens_details?: { cached_tokens: number };
    output_tokens_details?: { reasoning_tokens: number };
  };
  error:             null | { message: string };
  incomplete_details: null | unknown;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class GrokAdapter implements ILLMProvider {
  private readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string = DEFAULT_MODEL
  ) {
    this.model = model;
  }

  async generate(
    systemPrompt: string,
    messages: readonly LLMMessage[],
    options: LLMOptions = {}
  ): Promise<string> {
    const maxOutputTokens = options.maxTokens ?? 1024;

    const body: GroqRequest = {
      model:             this.model,
      max_output_tokens: maxOutputTokens,
      reasoning:         { effort: "medium" },
      input: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role:    m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${GROQ_BASE_URL}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${this.apiKey}`,
        },
        body:   JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      throw new ExternalServiceError(
        `Groq API network error: ${String(err)}`,
        isTimeout
      );
    }

    if (!response.ok) {
      const isRetryable = response.status === 429 || response.status >= 500;
      let errBody = "";
      try { errBody = await response.text(); } catch { /* ignore */ }
      throw new ExternalServiceError(
        `Groq API ${response.status}: ${errBody.slice(0, 300)}`,
        isRetryable
      );
    }

    let data: GroqResponseBody;
    try {
      data = (await response.json()) as GroqResponseBody;
    } catch (err) {
      throw new ExternalServiceError(
        `Groq API returned non-JSON response: ${String(err)}`,
        false
      );
    }

    // Primary: message item → output_text block
    let content: string | undefined;
    const messageItem = data.output?.find((o) => o.type === "message");
    content = messageItem?.content?.find((c) => c.type === "output_text")?.text;

    // Fallback: scan every output item for any non-empty text block
    if (!content?.trim()) {
      for (const item of data.output ?? []) {
        for (const block of item.content ?? []) {
          if (block.text?.trim()) {
            content = block.text;
            break;
          }
        }
        if (content?.trim()) break;
      }
    }

    if (!content?.trim()) {
      logger.error({ output: data.output }, "GrokAdapter: no text content in response");
      throw new ExternalServiceError(
        "Groq API returned empty or missing output_text content",
        false
      );
    }

    logger.debug(
      {
        model:        this.model,
        inputTokens:  data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      "GrokAdapter: response received"
    );

    return content;
  }
}
