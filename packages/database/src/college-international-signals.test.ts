import { describe, expect, it } from "vitest";
import {
  classifyCollegeInternationalProduct,
  hasTitleSlugTokenConflict
} from "./college-international-signals";

describe("college/international classification", () => {
  it("classifies ncaab slug prefix as Basketball NCAA", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Sean Lonergan Michigan Wolverines 20 Jersey",
      slug: "ncaab-sean-lonergan-michigan-wolverines-20-jersey"
    });
    expect(r.sport).toBe("Basketball");
    expect(r.league).toBe("NCAA");
    expect(r.category).toBe("college_slug_prefix");
    expect(r.hasOptionSet).toBe(true);
  });

  it("classifies ncaaf slug prefix as Football NCAA", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Ian Book Notre Dame Fighting Irish 12 Jersey",
      slug: "ncaaf-ian-book-notre-dame-fighting-irish-12-jersey"
    });
    expect(r.sport).toBe("Football");
    expect(r.league).toBe("NCAA");
    expect(r.hasOptionSet).toBe(true);
  });

  it("classifies college hockey when title and slug agree", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Georgetown Hoyas GameDay Greats Spirit Hockey Jersey - Navy",
      slug: "georgetown-hoyas-gameday-greats-spirit-hockey-jersey-navy"
    });
    expect(r.sport).toBe("Hockey");
    expect(r.league).toBe("NCAA");
    expect(r.hasOptionSet).toBe(true);
  });

  it("rejects college title/slug sport conflict", () => {
    const r = classifyCollegeInternationalProduct({
      title: "#12 Texas A&M Aggies GameDay Greats Hockey Fashion Jersey – Maroon",
      slug: "texas-a-m-aggies-baseball-jersey-white-ncaa"
    });
    expect(r.category).toBe("conflict");
    expect(r.sport).toBeNull();
  });

  it("classifies FIFA World Cup when title and slug align", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Ousmane Dembele France 11 FIFA World Cup Jersey",
      slug: "ousmane-dembele-france-11-fifa-world-cup-jersey-2",
      team: "FIFA 2026"
    });
    expect(r.sport).toBe("Soccer");
    expect(r.league).toBe("FIFA World Cup");
    expect(r.hasOptionSet).toBe(true);
  });

  it("rejects international title/slug country conflict", () => {
    expect(
      hasTitleSlugTokenConflict(
        "Argentina 2026 Messi Home Jersey with World Champions Patch",
        "scotland-2026-home-kit"
      )
    ).toBe(true);
  });

  it("classifies Olympic hockey as International Hockey", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Canada National Team Olympic Hockey Jersey - Red",
      slug: "canada-national-team-olympic-hockey-jersey-red"
    });
    expect(r.sport).toBe("Hockey");
    expect(r.league).toBe("International");
  });

  it("classifies college volleyball without option set", () => {
    const r = classifyCollegeInternationalProduct({
      title: "#1 Florida Gators GameDay Greats Lightweight Volleyball Jersey - White",
      slug: "florida-gators-volleyball-jersey-white-ncaa"
    });
    expect(r.sport).toBe("Volleyball");
    expect(r.category).toBe("other_sport_no_options");
    expect(r.hasOptionSet).toBe(false);
  });

  it("does not classify generic unknown jerseys", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Custom Jersey Red",
      slug: "custom-jersey-red"
    });
    expect(r.category).toBe("unknown");
    expect(r.sport).toBeNull();
  });

  it("rejects FIFA title/slug player mismatch", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Jordan Veretout France 15 FIFA World Cup Jersey",
      slug: "adrien-rabiot-france-14-fifa-world-cup-jersey"
    });
    expect(r.category).toBe("conflict");
  });

  it("rejects army/auburn college school mismatch", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Auburn Tigers Home Football Game Jersey - Navy",
      slug: "1-army-black-knights-gameday-greats-unisex-lightweight-soccer-fashion-jersey-black-ncaa"
    });
    expect(r.category).toBe("conflict");
  });

  it("does not assign MLB to pro franchise draft without college/intl context", () => {
    const r = classifyCollegeInternationalProduct({
      title: "Cincinnati Reds City Connect Jersey - Black",
      slug: "cincinnati-reds-city-connect-jersey-black",
      team: "BASEBALL J"
    });
    expect(r.category).toBe("unknown");
  });
});
