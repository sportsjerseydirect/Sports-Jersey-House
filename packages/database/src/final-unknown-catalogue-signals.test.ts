import { describe, expect, it } from "vitest";
import { classifyFinalUnknown } from "./final-unknown-catalogue-signals";

describe("final unknown catalogue pass", () => {
  it("resolves soccer country with FIFA + soccer tags", () => {
    const r = classifyFinalUnknown({
      title: "Ukraine 2026 Home Jersey",
      slug: "ukraine-2026-home-jersey",
      tags: ["FIFA 2026", "Jerseys", "SOCCER"],
      collections: ["Soccer Jerseys", "FIFA 2026"]
    });
    expect(r.action).toBe("RESOLVE");
    expect(r.sport).toBe("Soccer");
    expect(r.category).toBe("tags_only_soccer");
  });

  it("resolves LA Clippers with basketball collection", () => {
    const r = classifyFinalUnknown({
      title: "PJ Tucker LA Clippers 17 Jersey",
      slug: "pj-tucker-la-clippers-17-jersey",
      tags: ["Basketball J", "DMCA"],
      collections: ["Basketball Jerseys", "Shop All"]
    });
    expect(r.action).toBe("RESOLVE");
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBe("NBA");
  });

  it("does not resolve tags_only on Basketball J alone", () => {
    const r = classifyFinalUnknown({
      title: "LeBron James All-American 32 Jersey",
      slug: "lebron-james-all-american-32-jersey",
      tags: ["Basketball J", "NCAAB"],
      collections: ["Basketball Jerseys", "NCAA BASKETBALL"]
    });
    expect(r.action).toBe("BLOCK");
  });

  it("resolves college conflict with polluted Georgia tags", () => {
    const r = classifyFinalUnknown({
      title: "Jahmai Mashack Tennessee Volunteers 15 Jersey",
      slug: "jahmai-mashack-tennessee-volunteers-15-jersey",
      tags: ["Anthony Edwards", "Basketball J", "Georgia Bulldogs", "NCAAB"],
      collections: ["Basketball Jerseys", "NCAA BASKETBALL"]
    });
    expect(r.action).toBe("RESOLVE");
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBe("NCAA");
    expect(r.category).toBe("conflict_college_polluted_tags");
  });

  it("resolves MLB conflict when tags corroborate title franchise", () => {
    const r = classifyFinalUnknown({
      title: "Pete Crow-Armstrong Chicago Cubs Jersey - White",
      slug: "boston-red-sox-home-limited-custom-jersey-white",
      tags: ["BASEBALL J", "Chicago Cubs", "Major League Baseball"],
      collections: ["Baseball Jerseys", "Chicago Cubs Baseball Team Jersey"]
    });
    expect(r.action).toBe("RESOLVE");
    expect(r.sport).toBe("Baseball");
    expect(r.league).toBe("MLB");
  });

  it("resolves NBA conflict when franchise in tags", () => {
    const r = classifyFinalUnknown({
      title: "Stephen Curry Golden State Warriors 2025/26 Authentic Jersey",
      slug: "detroit-pistons-authentic-custom-jersey-blue",
      tags: ["Basketball", "Basketball J", "Golden State Warriors"],
      collections: ["Basketball Jerseys", "Golden State Warriors Basketball Team Jersey"]
    });
    expect(r.action).toBe("RESOLVE");
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBe("NBA");
  });

  it("blocks NBA conflict without franchise in tags", () => {
    const r = classifyFinalUnknown({
      title: "Markelle Fultz Orlando Magic 20 Jersey",
      slug: "duncan-robinson-miami-heat-55-jersey",
      tags: ["Basketball J"],
      collections: ["Basketball Jerseys"]
    });
    expect(r.action).toBe("BLOCK");
    expect(r.category).toBe("conflict_unresolved");
  });

  it("blocks high school products", () => {
    const r = classifyFinalUnknown({
      title: "Michael Jordan Laney 23 High School Jersey",
      slug: "michael-jordan-laney-23-high-school-jersey",
      tags: ["Basketball J", "High School Jersey"],
      collections: ["HIGH SCHOOL BASKETBALL JERSEYS", "Basketball Jerseys"]
    });
    expect(r.action).toBe("BLOCK");
    expect(r.category).toBe("high_school_blocked");
  });

  it("blocks non-jersey shorts", () => {
    const r = classifyFinalUnknown({
      title: "Miami Heat Basketball Shorts",
      slug: "miami-heat-basketball-shorts",
      tags: ["Basketball Shorts", "Miami Heat"],
      collections: ["Basketball Shorts"]
    });
    expect(r.action).toBe("BLOCK");
    expect(r.category).toBe("non_jersey_blocked");
  });

  it("blocks movie novelty", () => {
    const r = classifyFinalUnknown({
      title: "Lola Bunny Space Jam Tune Squad 10 Jersey",
      slug: "lola-bunny-space-jam-tune-squad-10-jersey",
      tags: ["Basketball J", "Movie Jerseys", "NCAAB"],
      collections: ["MOVIE JERSEYS", "Basketball Jerseys"]
    });
    expect(r.action).toBe("BLOCK");
    expect(r.category).toBe("movie_novelty_blocked");
  });
});
