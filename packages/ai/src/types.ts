import { z } from "zod";
import type { CreativeAsset, ProductSummary, RiskLevel, SeoDraft } from "@sjh/shared";

export const aiProviderNameSchema = z.enum(["openai", "anthropic", "disabled"]);
export type AiProviderName = z.infer<typeof aiProviderNameSchema>;

export type AiCompletionRequest = {
  system: string;
  user: string;
  responseFormat?: "json" | "text";
  temperature?: number;
  model?: string;
};

export type AiCompletionResponse = {
  provider: AiProviderName;
  model: string;
  content: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type AiProvider = {
  readonly name: AiProviderName;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
};

export type AiRouterConfig = {
  defaultProvider: AiProvider;
  providers?: Partial<Record<AiProviderName, AiProvider>>;
};

export class AiRouter {
  constructor(private readonly config: AiRouterConfig) {}

  complete(request: AiCompletionRequest, providerName?: AiProviderName): Promise<AiCompletionResponse> {
    const provider = providerName ? this.config.providers?.[providerName] : undefined;
    return (provider ?? this.config.defaultProvider).complete(request);
  }
}

export type SeoAgentInput = {
  product: ProductSummary;
  canonicalPath: string;
};

export type SeoAgent = {
  draftProductSeo(input: SeoAgentInput): Promise<SeoDraft>;
};

export type ComplianceScanInput = {
  targetType: "product" | "collection" | "creative" | "page";
  targetId: string;
  text: string;
  claims?: string[];
};

export type ComplianceScanResult = {
  riskLevel: RiskLevel;
  reasons: string[];
  recommendation: string;
  requiresHumanApproval: boolean;
  legalDisclaimer: "risk_detection_only";
};

export type CreativeBrief = {
  assetType: CreativeAsset["assetType"];
  objective: string;
  placement: string;
  audience: string;
  constraints: string[];
  requiresHumanApproval: boolean;
};
