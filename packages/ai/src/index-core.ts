import type { RiskLevel } from "@sjh/shared";
import { DisabledAiProvider } from "./providers/disabled";
import { OpenAiProvider } from "./providers/openai";
import {
  AiRouter,
  type AiProvider,
  type AiProviderName,
  type ComplianceScanResult,
  type CreativeBrief
} from "./types";

export function createComplianceResult(input: {
  riskLevel: RiskLevel;
  reasons: string[];
  recommendation: string;
}): ComplianceScanResult {
  return {
    ...input,
    requiresHumanApproval: input.riskLevel === "high" || input.riskLevel === "critical",
    legalDisclaimer: "risk_detection_only"
  };
}

export function createInitialBrandBrief(): CreativeBrief {
  return {
    assetType: "logo",
    objective: "Explore original Sports Jersey House logo directions before selecting a production identity.",
    placement: "Brand system, website header, favicon, social previews",
    audience: "US and Canadian jersey shoppers who expect a premium ecommerce experience",
    constraints: [
      "Original brand identity only",
      "Do not imitate Apple, another sports retailer, a league, a team, or a player brand",
      "Avoid implying official endorsement or affiliation",
      "Prepare concepts for human approval before publishing"
    ],
    requiresHumanApproval: true
  };
}

export function createAiRouterFromEnv(env: NodeJS.ProcessEnv = process.env): AiRouter {
  const providers: Partial<Record<AiProviderName, AiProvider>> = {
    disabled: new DisabledAiProvider()
  };

  if (env.OPENAI_API_KEY) {
    const openAiConfig: ConstructorParameters<typeof OpenAiProvider>[0] = {
      apiKey: env.OPENAI_API_KEY
    };

    if (env.AI_DEFAULT_MODEL) {
      openAiConfig.defaultModel = env.AI_DEFAULT_MODEL;
    }

    providers.openai = new OpenAiProvider(openAiConfig);
  }

  const defaultProvider = providers.openai ?? providers.disabled!;

  return new AiRouter({
    defaultProvider,
    providers
  });
}

export { DisabledAiProvider } from "./providers/disabled";
export { OpenAiProvider } from "./providers/openai";
export {
  aiProviderNameSchema,
  AiRouter,
  type AiCompletionRequest,
  type AiCompletionResponse,
  type AiProvider,
  type AiProviderName,
  type AiRouterConfig,
  type ComplianceScanInput,
  type ComplianceScanResult,
  type CreativeBrief,
  type SeoAgent,
  type SeoAgentInput
} from "./types";
