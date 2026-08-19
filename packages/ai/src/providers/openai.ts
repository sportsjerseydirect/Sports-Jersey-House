import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

export type OpenAiProviderConfig = {
  apiKey: string;
  defaultModel?: string;
};

const DEFAULT_MODEL = "gpt-4.1-mini";

type OpenAiChatResponse = {
  model: string;
  choices: Array<{ message: { content: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;

  constructor(private readonly config: OpenAiProviderConfig) {}

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    const model = request.model ?? this.config.defaultModel ?? DEFAULT_MODEL;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0.2,
        response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices[0]?.message.content ?? "";

    const usage: AiCompletionResponse["usage"] = {};

    if (payload.usage?.prompt_tokens !== undefined) {
      usage.inputTokens = payload.usage.prompt_tokens;
    }

    if (payload.usage?.completion_tokens !== undefined) {
      usage.outputTokens = payload.usage.completion_tokens;
    }

    return {
      provider: this.name,
      model: payload.model,
      content,
      ...(Object.keys(usage).length > 0 ? { usage } : {})
    };
  }
}
