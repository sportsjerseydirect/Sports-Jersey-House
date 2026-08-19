import type { AiCompletionRequest, AiCompletionResponse, AiProvider } from "../types";

export class DisabledAiProvider implements AiProvider {
  readonly name = "disabled" as const;

  async complete(_request: AiCompletionRequest): Promise<AiCompletionResponse> {
    void _request;

    return {
      provider: this.name,
      model: "disabled",
      content: JSON.stringify({
        status: "disabled",
        message: "AI provider is not configured. The storefront must continue without AI output."
      })
    };
  }
}
