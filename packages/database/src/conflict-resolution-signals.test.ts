import { describe, expect, it } from "vitest";
import {
  isFifaDiacriticOnlyMismatch,
  resolveConflictProduct,
  stripDiacritics
} from "./conflict-resolution-signals";

describe("conflict resolution", () => {
  it("strips diacritics", () => {
    expect(stripDiacritics("Raúl Jiménez")).toBe("raul jimenez");
    expect(stripDiacritics("Pelé")).toBe("pele");
  });

  it("detects FIFA accent-only mismatches as safe", () => {
    expect(
      isFifaDiacriticOnlyMismatch(
        "Raúl Jiménez Mexico 9 FIFA World Cup Jersey",
        "raul-jimenez-mexico-9-fifa-world-cup-jersey"
      )
    ).toBe(true);

    const r = resolveConflictProduct({
      title: "Raúl Jiménez Mexico 9 FIFA World Cup Jersey",
      slug: "raul-jimenez-mexico-9-fifa-world-cup-jersey",
      tags: ["FIFA 2026", "Mexico", "Raul Jimenez", "soccer"]
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
    expect(r.league).toBe("FIFA World Cup");
  });

  it("resolves title+tags over corrupted slug", () => {
    const r = resolveConflictProduct({
      title: "Lamar Jackson Louisville Cardinals Football Alumni Jersey - Red",
      slug: "1-kentucky-wildcats-alternate-game-jersey-black-ncaa",
      tags: ["Football J", "Jerseys", "Louisville Cardinals", "NCAA"]
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NCAA");
  });

  it("resolves NHL title corroborated by tags", () => {
    const r = resolveConflictProduct({
      title: "Quinn Hughes Minnesota Wild  Home Breakaway Jersey - Green",
      slug: "los-angeles-kings-2026-hockey-fights-cancer-custom-practice-jersey-white",
      tags: ["HOCKEY J", "Jerseys", "Minnesota Wild", "New Arrival"]
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Hockey");
    expect(r.league).toBe("NHL");
  });

  it("keeps sport-unknown title+tags as human review", () => {
    const r = resolveConflictProduct({
      title: "#00 Kansas Jayhawks Premier Strategy Jersey - White",
      slug: "iowa-state-cyclones-gameday-greats-hockey-jersey-cardinal-ncaa",
      tags: ["Jerseys", "Kansas Jayhawks", "NCAA"]
    });
    expect(r.disposition).toBe("HUMAN_REVIEW");
    expect(r.sport).toBeNull();
  });

  it("does not trust slug when tags lean slug", () => {
    const r = resolveConflictProduct({
      title: "Something Ambiguous Jersey",
      slug: "calgary-flames-alternate-premium-custom-jersey-black",
      tags: ["Calgary Flames", "HOCKEY J"]
    });
    expect(r.disposition).toBe("HUMAN_REVIEW");
  });

  it("flags FIFA player mismatch without tags as invalid", () => {
    const r = resolveConflictProduct({
      title: "Lovro Majer Croatia 7 FIFA World Cup Jersey",
      slug: "josip-sutalo-croatia-24-fifa-world-cup-jersey",
      tags: ["FIFA 2026", "soccer"]
    });
    expect(r.disposition).toBe("INVALID_PRODUCT");
  });

  it("fixes FIFA player mismatch when tags corroborate title", () => {
    const r = resolveConflictProduct({
      title: "Lovro Majer Croatia 7 FIFA World Cup Jersey",
      slug: "josip-sutalo-croatia-24-fifa-world-cup-jersey",
      tags: ["Croatia", "FIFA 2026", "Lovro Majer", "soccer"]
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
  });

  it("does not assign slug-echoed tag sport when title lacks sport", () => {
    const r = resolveConflictProduct({
      title: "Baker Mayfield Oklahoma Sooners Alumni Player Game Jersey - Crimson",
      slug: "0-ohio-state-buckeyes-gameday-greats-hockey-jersey-white-ncaa",
      tags: ["HOCKEY J", "Oklahoma Sooners", "NCAA", "Jerseys"]
    });
    expect(r.disposition).toBe("HUMAN_REVIEW");
    expect(r.sport).toBeNull();
  });

  it("resolves different-school sport conflict when tags exclusively corroborate title", () => {
    const r = resolveConflictProduct({
      title: "Texas Longhorns Custom Football Game Jersey - Texas Orange",
      slug: "12-texas-a-m-aggies-gameday-greats-hockey-fashion-jersey-maroon-ncaa",
      tags: ["Football J", "Texas Longhorns", "NCAA", "Jerseys"]
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NCAA");
  });

  it("marks garbage listings invalid", () => {
    const r = resolveConflictProduct({
      title: "NAME",
      slug: "avis-option-1701096316636-469910",
      tags: []
    });
    expect(r.disposition).toBe("INVALID_PRODUCT");
  });
});
