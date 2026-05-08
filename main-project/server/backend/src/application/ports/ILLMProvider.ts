export interface LLMMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface LLMOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface ILLMProvider {
  generate(
    systemPrompt: string,
    messages: readonly LLMMessage[],
    options?: LLMOptions
  ): Promise<string>;
}
