import { describe, expect, it } from "vitest";
import {
  evaluateDescriptionQuality,
  HIGH_CONFIDENCE_THRESHOLD,
  inferTaxonomyFromCatalogueText,
  isHighConfidenceChange,
  nextCategoryModeAfterDecision,
  scoreProductHealth,
  sportFromLeague
} from "./catalogue-rules";

describe("catalogue rules", () => {
  it("maps NFL to Football without removing league", () => {
    expect(sportFromLeague("NFL")).toBe("Football");
    const inferred = inferTaxonomyFromCatalogueText({
      title: "Justin Fields Chicago Bears Jersey",
      tags: ["NFL", "Chicago Bears"]
    });
    expect(inferred.league).toBe("NFL");
    expect(inferred.sport).toBe("Football");
    expect(inferred.team).toBe("Chicago Bears");
  });

  it("parses player and team from numbered jersey titles", () => {
    const inferred = inferTaxonomyFromCatalogueText({
      title: "Matthew Boyd Cleveland Guardians 16 Jersey",
      tags: ["MLB"]
    });
    expect(inferred.league).toBe("MLB");
    expect(inferred.sport).toBe("Baseball");
    expect(inferred.player).toBe("Matthew Boyd");
    expect(inferred.team).toBe("Cleveland Guardians");
  });

  it("parses three-token team names like Kansas City Royals", () => {
    const inferred = inferTaxonomyFromCatalogueText({
      title: "Seth Lugo Kansas City Royals 67 Jersey",
      tags: ["MLB"]
    });
    expect(inferred.player).toBe("Seth Lugo");
    expect(inferred.team).toBe("Kansas City Royals");
  });

  it("keeps good descriptions", () => {
    const decision = evaluateDescriptionQuality({
      title: "Chicago Bears Home Jersey",
      description:
        "A premium Chicago Bears home jersey with authentic styling and comfortable fit for game day."
    });
    expect(decision.action).toBe("keep");
  });

  it("improves placeholder import descriptions when source exists", () => {
    const decision = evaluateDescriptionQuality({
      title: "Test",
      description: "Test (imported draft — content pending review)",
      sourceHtml: "<p>".padEnd(120, "x") + "</p>"
    });
    expect(decision.action).toBe("improve");
  });

  it("identifies high-confidence changes", () => {
    expect(HIGH_CONFIDENCE_THRESHOLD).toBe(0.75);
    expect(isHighConfidenceChange(0.82)).toBe(true);
    expect(isHighConfidenceChange("0.75")).toBe(true);
    expect(isHighConfidenceChange(0.5)).toBe(false);
  });

  it("parses FIFA Euro national team jerseys", () => {
    const inferred = inferTaxonomyFromCatalogueText({
      title: "Eberchi Eze England 21 FIFA Euro Cup Jersey",
      tags: ["Soccer"]
    });
    expect(inferred.sport).toBe("Soccer");
    expect(inferred.team).toBe("England");
    expect(inferred.player).toBe("Eberchi Eze");
    expect(inferred.league).toBe("UEFA Euro");
  });

  it("scores product health without rewriting titles", () => {
    const health = scoreProductHealth({
      title: "Matthew Boyd Cleveland Guardians 16 Jersey",
      description: "Authentic Cleveland Guardians jersey with comfortable fit.",
      sport: "Baseball",
      league: "MLB",
      team: "Cleveland Guardians",
      player: "Matthew Boyd",
      productType: "Jersey",
      imageCount: 2,
      variantCount: 5,
      hasPrice: true,
      hasSeoMeta: true,
      hasCanonical: true,
      collectionCount: 3,
      shopifyId: "gid://shopify/Product/1"
    });
    expect(health.status).toBe("healthy");
    expect(health.recommendation).toBe("KEEP");
  });
});

describe("3-approval autonomous learning", () => {
  it("stays learning for first two approvals", () => {
    const first = nextCategoryModeAfterDecision({
      currentMode: "learning",
      consecutiveApprovals: 0,
      threshold: 3,
      alwaysRequireApproval: false,
      decision: "approved"
    });
    expect(first).toEqual({ mode: "learning", consecutiveApprovals: 1 });

    const second = nextCategoryModeAfterDecision({
      currentMode: "learning",
      consecutiveApprovals: 1,
      threshold: 3,
      alwaysRequireApproval: false,
      decision: "approved"
    });
    expect(second).toEqual({ mode: "learning", consecutiveApprovals: 2 });
  });

  it("flips to autonomous on the third consecutive approval", () => {
    const third = nextCategoryModeAfterDecision({
      currentMode: "learning",
      consecutiveApprovals: 2,
      threshold: 3,
      alwaysRequireApproval: false,
      decision: "approved"
    });
    expect(third).toEqual({ mode: "autonomous", consecutiveApprovals: 3 });
  });

  it("resets streak on rejection", () => {
    const rejected = nextCategoryModeAfterDecision({
      currentMode: "learning",
      consecutiveApprovals: 2,
      threshold: 3,
      alwaysRequireApproval: false,
      decision: "rejected"
    });
    expect(rejected).toEqual({ mode: "learning", consecutiveApprovals: 0 });
  });

  it("never auto-flips always-require categories", () => {
    const third = nextCategoryModeAfterDecision({
      currentMode: "learning",
      consecutiveApprovals: 2,
      threshold: 3,
      alwaysRequireApproval: true,
      decision: "approved"
    });
    expect(third.mode).toBe("learning");
    expect(third.consecutiveApprovals).toBe(3);
  });
});
