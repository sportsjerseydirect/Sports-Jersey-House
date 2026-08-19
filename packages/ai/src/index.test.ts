import { describe, expect, it } from "vitest";
import { DisabledAiProvider, createComplianceResult, createInitialBrandBrief } from "./index";

describe("ai contracts", () => {
  it("fails closed when no provider is configured", async () => {
    const provider = new DisabledAiProvider();
    const response = await provider.complete({
      system: "system",
      user: "user"
    });

    expect(response.provider).toBe("disabled");
  });

  it("requires human approval for high-risk compliance results", () => {
    const result = createComplianceResult({
      riskLevel: "high",
      reasons: ["Potentially risky team affiliation claim."],
      recommendation: "Send for human review."
    });

    expect(result.requiresHumanApproval).toBe(true);
    expect(result.legalDisclaimer).toBe("risk_detection_only");
  });

  it("starts brand creative as an approval-gated logo brief", () => {
    const brief = createInitialBrandBrief();

    expect(brief.assetType).toBe("logo");
    expect(brief.requiresHumanApproval).toBe(true);
  });
});
