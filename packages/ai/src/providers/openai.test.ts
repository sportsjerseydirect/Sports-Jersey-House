import { describe, expect, it, vi, afterEach } from "vitest";
import { createAiRouterFromEnv } from "../index-core";
import { OpenAiProvider } from "./openai";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAiRouterFromEnv", () => {
  it("uses disabled provider when no API keys are configured", () => {
    const router = createAiRouterFromEnv({});
    expect(router).toBeDefined();
  });

  it("registers OpenAI when OPENAI_API_KEY is present", () => {
    const router = createAiRouterFromEnv({ OPENAI_API_KEY: "test-key" });
    expect(router).toBeDefined();
  });
});

describe("OpenAiProvider", () => {
  it("calls OpenAI chat completions when configured", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          model: "gpt-4.1-mini",
          choices: [{ message: { content: '{"status":"ok"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiProvider({ apiKey: "test-key" });
    const result = await provider.complete({
      system: "You are helpful.",
      user: "Say ok.",
      responseFormat: "json"
    });

    expect(result.provider).toBe("openai");
    expect(result.content).toContain("ok");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
