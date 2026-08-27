import { describe, expect, it } from "vitest";
import { classifyUnknownDeep } from "./unknown-deep-classification-signals";

describe("unknown deep classification", () => {
  it("HIGH NBA with full franchise + basketball tags", () => {
    const r = classifyUnknownDeep({
      title: "Bilal Coulibaly Washington Wizards 0 Jersey",
      slug: "bilal-coulibaly-washington-wizards-0-jersey",
      tags: ["Basketball", "Basketball J", "Bilal Coulibaly", "Washington Wizards 0"],
      collections: ["Basketball Jerseys"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBe("NBA");
  });

  it("rejects bare Bucks without Milwaukee", () => {
    const r = classifyUnknownDeep({
      title: "Custom Bucks Jersey",
      slug: "custom-bucks-jersey",
      tags: ["Basketball J"],
      collections: ["Basketball Jerseys"]
    });
    expect(r.tier).not.toBe("HIGH");
    expect(r.league).not.toBe("NBA");
  });

  it("HIGH MLB with franchise + Major League Baseball tag", () => {
    const r = classifyUnknownDeep({
      title: "Cincinnati Reds City Connect Jersey - Black",
      slug: "cincinnati-reds-city-connect-jersey-black",
      tags: ["BASEBALL J", "Cincinnati Reds", "Major League Baseball"],
      collections: ["Baseball Jerseys"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Baseball");
    expect(r.league).toBe("MLB");
  });

  it("HIGH NHL Penguins with team collection", () => {
    const r = classifyUnknownDeep({
      title: "Pittsburgh Penguins Practice Jersey - Blue",
      slug: "pittsburgh-penguins-away-premium-custom-jersey-white",
      tags: ["Jerseys", "Pittsburgh Penguins"],
      collections: ["Penguins Jerseys", "Shop All"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Hockey");
    expect(r.league).toBe("NHL");
  });

  it("does not treat Texas Rangers as NHL Rangers", () => {
    const r = classifyUnknownDeep({
      title: "Corey Seager Texas Rangers Jersey",
      slug: "corey-seager-texas-rangers-jersey",
      tags: ["BASEBALL J", "Texas Rangers", "Major League Baseball"],
      collections: ["Baseball Jerseys"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Baseball");
    expect(r.league).toBe("MLB");
  });

  it("HIGH FIFA World Cup with soccer tags even if slug lacks fifa", () => {
    const r = classifyUnknownDeep({
      title: "Cristiano Ronaldo Portugal 7 FIFA World Cup Jersey",
      slug: "cristiano-ronaldo-portugal-7-jersey",
      tags: ["FIFA 2026", "Portugal", "soccer"],
      collections: ["Soccer Jerseys", "FIFA 2026"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Soccer");
    expect(r.league).toBe("FIFA World Cup");
  });

  it("HIGH soccer club with soccer collections", () => {
    const r = classifyUnknownDeep({
      title: "Rico Lewis Manchester City 82 Jersey",
      slug: "rico-lewis-manchester-city-82-jersey",
      tags: ["club teams", "soccer"],
      collections: ["Soccer Jerseys", "CLUB TEAMS"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Soccer");
  });

  it("CONFLICT when college tags disagree with title school", () => {
    const r = classifyUnknownDeep({
      title: "Jahmai Mashack Tennessee Volunteers 15 Jersey",
      slug: "jahmai-mashack-tennessee-volunteers-15-jersey",
      tags: ["Basketball J", "Georgia Bulldogs", "NCAAB"],
      collections: ["Basketball Jerseys", "NCAA BASKETBALL"]
    });
    expect(r.tier).toBe("CONFLICT");
  });

  it("MEDIUM for high school basketball", () => {
    const r = classifyUnknownDeep({
      title: "Michael Jordan Laney 23 High School Jersey",
      slug: "michael-jordan-laney-23-high-school-jersey",
      tags: ["Basketball J", "High School Jersey"],
      collections: ["Basketball Jerseys", "HIGH SCHOOL BASKETBALL JERSEYS"]
    });
    expect(r.tier).toBe("MEDIUM");
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBeNull();
  });

  it("MEDIUM for non-jersey NBA merchandise", () => {
    const r = classifyUnknownDeep({
      title: "Sacramento Kings Toque",
      slug: "sacramento-kings-toque",
      tags: ["Basketball J"],
      collections: ["Basketball Jerseys"]
    });
    expect(r.tier).toBe("MEDIUM");
    expect(r.isJerseyProduct).toBe(false);
  });

  it("HIGH NFL with full franchise + football tags", () => {
    const r = classifyUnknownDeep({
      title: "Patrick Mahomes Kansas City Chiefs Game Jersey",
      slug: "patrick-mahomes-kansas-city-chiefs-game-jersey",
      tags: ["Football J", "New Arrival"],
      collections: ["Football Jerseys"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NFL");
  });

  it("HIGH NHL when franchise appears in both title and tags", () => {
    const r = classifyUnknownDeep({
      title: "Calgary Flames Home Premium Custom Jersey - Red",
      slug: "calgary-flames-fanatics-alternate-premium-custom-jersey",
      tags: ["Calgary Flames", "Jerseys", "New Arrival"],
      collections: ["Shop All", "New Arrivals"]
    });
    expect(r.tier).toBe("HIGH");
    expect(r.sport).toBe("Hockey");
    expect(r.league).toBe("NHL");
  });

  it("keeps Milwaukee Bucks + baseball tag as MEDIUM not HIGH NBA", () => {
    const r = classifyUnknownDeep({
      title: "Milwaukee Bucks Pop Baseball Jersey - Black",
      slug: "milwaukee-bucks-pop-baseball-jersey",
      tags: ["BASEBALL J", "DMCA", "Jerseys", "Milwaukee Bucks"],
      collections: ["Shop All"]
    });
    expect(r.tier).toBe("MEDIUM");
  });
});
