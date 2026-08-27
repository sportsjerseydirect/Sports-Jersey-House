import { describe, expect, it } from "vitest";
import { resolveHumanReviewProduct } from "./human-review-resolution-signals";

describe("human review second-pass resolution", () => {
  it("resolves national team when tags + soccer corroborate title country", () => {
    const r = resolveHumanReviewProduct({
      title: "Brazil National Team 2026 Home Match Authentic Jersey – Yellow",
      slug: "belgium-national-team-womens-2026-jersey-black",
      tags: ["Brazil National Team", "Federation Team", "soccer"],
      collections: ["Soccer Jerseys", "Brazil national football team"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "sport not explicit"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
    expect(r.league).toBe("International");
  });

  it("resolves 2026 kit when collection names title country", () => {
    const r = resolveHumanReviewProduct({
      title: "Portugal 2026 Special Jersey",
      slug: "scotland-2026-home-jersey",
      tags: ["FIFA 2026", "Jerseys", "SOCCER"],
      collections: ["Soccer Jerseys", "FIFA 2026", "Portugal national football team"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "Insufficient"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
  });

  it("does not upgrade FIFA country mismatch on SEO-only corroboration", () => {
    const r = resolveHumanReviewProduct({
      title: "Costa Rica FIFA World Cup Jersey",
      slug: "denmark-fifa-world-cup-jersey",
      tags: ["FIFA 2026", "International custom", "SOCCER"],
      collections: ["Soccer Jerseys", "FIFA 2026"],
      priorDisposition: "INVALID_PRODUCT",
      priorReason: "FIFA World Cup title/slug mismatch"
    });
    expect(r.disposition).toBe("INVALID_PRODUCT");
    expect(r.sport).toBeNull();
  });

  it("leaves Morocco/Mexico when tags conflict with title", () => {
    const r = resolveHumanReviewProduct({
      title: "Mexico National Team FIFA x World Cup 2026 Home On Field Authentic Jersey - Green",
      slug: "morocco-national-team-2026-away-jersey-white",
      tags: ["Federation Team", "FIFA 2026", "Morocco National Team", "SOCCER"],
      collections: ["Soccer Jerseys", "FIFA 2026"],
      priorDisposition: "INVALID_PRODUCT",
      priorReason: "mismatch"
    });
    expect(r.disposition).toBe("INVALID_PRODUCT");
    expect(r.sport).toBeNull();
  });

  it("resolves Football J + Football Jerseys collection with school tags", () => {
    const r = resolveHumanReviewProduct({
      title: "#25 Mississippi State Bulldogs Premier Strategy Jersey - Black",
      slug: "minnesota-golden-gophers-ccm-third-hockey-jersey-gold-ncaa",
      tags: ["Football J", "Jerseys", "Mississippi State Bulldogs", "NCAA"],
      collections: ["Football Jerseys", "Shop All"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "sport not explicit"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NCAA");
  });

  it("resolves known football alumni", () => {
    const r = resolveHumanReviewProduct({
      title: "Baker Mayfield Oklahoma Sooners Alumni Player Game Jersey - Crimson",
      slug: "0-ohio-state-buckeyes-gameday-greats-hockey-jersey-white-ncaa",
      tags: ["HOCKEY J", "Jerseys", "NCAA", "Oklahoma Sooners"],
      collections: ["Hockey Jerseys"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "sport not explicit"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NCAA");
  });

  it("classifies volleyball without option set when no conflicting sport tags", () => {
    const r = resolveHumanReviewProduct({
      title: "Tennessee Volunteers GameDay Greats Lightweight Volleyball Fashion Jersey - Blue",
      slug: "tennessee-volunteers-college-limited-baseball-jersey-white-ncaa",
      tags: ["Jerseys", "NCAA", "Tennessee Volunteers"],
      collections: ["Shop All"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "Volleyball vs Baseball"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Volleyball");
    expect(r.hasOptionSet).toBe(false);
  });

  it("keeps volleyball with conflicting hockey tags as human review", () => {
    const r = resolveHumanReviewProduct({
      title: "UConn Huskies GameDay Greats NIL Pick-A-Player Lightweight Collegiate Volleyball Fashion Jersey - Navy",
      slug: "uconn-huskies-gameday-greats-lightweight-mens-hockey-team-fashion-jersey-navy-ncaa",
      tags: ["HOCKEY J", "Jerseys", "NCAA", "Uconn Huskies"],
      collections: ["Hockey Jerseys"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "Volleyball vs Hockey"
    });
    expect(r.disposition).toBe("HUMAN_REVIEW");
    expect(r.sport).toBeNull();
  });

  it("resolves same-country FIFA player listing", () => {
    const r = resolveHumanReviewProduct({
      title: "Sadio Mane Senegal 10 FIFA World Cup Jersey",
      slug: "senegal-fifa-world-cup-jersey",
      tags: ["FIFA 2026", "international team", "Sadio Mane", "Senegal", "soccer"],
      collections: ["Soccer Jerseys"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "FIFA tags mention both"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
  });

  it("leaves national team without soccer signals", () => {
    const r = resolveHumanReviewProduct({
      title: "Serbia National Team 2026 Away Jersey - White",
      slug: "senegal-national-team-2026-pre-match-jersey-green",
      tags: ["Federation Team", "Jerseys", "New Arrival", "Serbia National Team"],
      collections: ["Shop All"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "sport not explicit"
    });
    expect(r.disposition).toBe("HUMAN_REVIEW");
    expect(r.sport).toBeNull();
  });

  it("resolves Canada Soccer title", () => {
    const r = resolveHumanReviewProduct({
      title: "Canada Soccer 2026 Pre-Match Top - Red",
      slug: "brazil-womens-national-team-womens-2025-26-away-jersey-blue",
      tags: ["Canada Soccer", "Federation Team"],
      collections: ["Shop All"],
      priorDisposition: "HUMAN_REVIEW",
      priorReason: "sport not explicit"
    });
    expect(r.disposition).toBe("SAFE_TO_FIX");
    expect(r.sport).toBe("Soccer");
  });
});
