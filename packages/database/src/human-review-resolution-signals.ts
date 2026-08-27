/**
 * Second-pass resolution for HUMAN_REVIEW / INVALID_PRODUCT conflicts.
 * Requires strong multi-source corroboration. Never guesses sport/league/team.
 * SEO title alone is NOT independent evidence (usually derived from title).
 */
import {
  explicitSportsInText,
  hasCollegeEvidence,
  type CatalogueSport
} from "./college-international-signals";
import {
  type ConflictDisposition,
  type ConflictResolution,
  stripDiacritics
} from "./conflict-resolution-signals";

const OPTION_SET_SPORTS = new Set<CatalogueSport>([
  "Football",
  "Basketball",
  "Hockey",
  "Baseball",
  "Soccer"
]);

/** Well-known college alumni whose primary jersey sport is unambiguous American football. */
const FOOTBALL_ALUMNI: { pattern: RegExp; label: string }[] = [
  { pattern: /\bbaker\s+mayfield\b/i, label: "Baker Mayfield" },
  { pattern: /\bchristian\s+mccaffrey\b/i, label: "Christian McCaffrey" },
  { pattern: /\bmarcus\s+allen\b/i, label: "Marcus Allen" },
  { pattern: /\btravis\s+hunter\b/i, label: "Travis Hunter" },
  { pattern: /\blamar\s+jackson\b/i, label: "Lamar Jackson" }
];

const COUNTRY_ALIASES: { id: string; patterns: RegExp[] }[] = [
  { id: "saudi-arabia", patterns: [/\bsaudi\s+arabia\b/i, /\bsaudi\b/i] },
  { id: "south-korea", patterns: [/\bsouth\s+korea\b/i, /\bkorea\b/i] },
  { id: "costa-rica", patterns: [/\bcosta\s+rica\b/i] },
  { id: "northern-ireland", patterns: [/\bnorthern\s+ireland\b/i] },
  { id: "united-states", patterns: [/\bunited\s+states\b/i, /\bteam\s+usa\b/i, /\busa\b/i] },
  { id: "brazil", patterns: [/\bbrazil\b/i] },
  { id: "argentina", patterns: [/\bargentina\b/i] },
  { id: "portugal", patterns: [/\bportugal\b/i] },
  { id: "spain", patterns: [/\bspain\b/i] },
  { id: "italy", patterns: [/\bitaly\b/i] },
  { id: "germany", patterns: [/\bgermany\b/i] },
  { id: "france", patterns: [/\bfrance\b/i] },
  { id: "england", patterns: [/\bengland\b/i] },
  { id: "wales", patterns: [/\bwales\b/i] },
  { id: "scotland", patterns: [/\bscotland\b/i] },
  { id: "belgium", patterns: [/\bbelgium\b/i] },
  { id: "netherlands", patterns: [/\bnetherlands\b/i, /\bholland\b/i] },
  { id: "mexico", patterns: [/\bmexico\b/i] },
  { id: "canada", patterns: [/\bcanada\b/i] },
  { id: "japan", patterns: [/\bjapan\b/i] },
  { id: "morocco", patterns: [/\bmorocco\b/i] },
  { id: "senegal", patterns: [/\bsenegal\b/i] },
  { id: "ghana", patterns: [/\bghana\b/i] },
  { id: "nigeria", patterns: [/\bnigeria\b/i] },
  { id: "norway", patterns: [/\bnorway\b/i] },
  { id: "sweden", patterns: [/\bsweden\b/i] },
  { id: "switzerland", patterns: [/\bswitzerland\b/i] },
  { id: "serbia", patterns: [/\bserbia\b/i] },
  { id: "croatia", patterns: [/\bcroatia\b/i] },
  { id: "poland", patterns: [/\bpoland\b/i] },
  { id: "uruguay", patterns: [/\buruguay\b/i] },
  { id: "chile", patterns: [/\bchile\b/i] },
  { id: "colombia", patterns: [/\bcolombia\b/i] },
  { id: "venezuela", patterns: [/\bvenezuela\b/i] },
  { id: "qatar", patterns: [/\bqatar\b/i] },
  { id: "denmark", patterns: [/\bdenmark\b/i] },
  { id: "peru", patterns: [/\bperu\b/i] },
  { id: "ecuador", patterns: [/\becuador\b/i] },
  { id: "australia", patterns: [/\baustralia\b/i] },
  { id: "ireland", patterns: [/\bireland\b/i] }
];

function countriesIn(text: string): string[] {
  const hits: string[] = [];
  for (const { id, patterns } of COUNTRY_ALIASES) {
    if (patterns.some((p) => p.test(text))) hits.push(id);
  }
  return [...new Set(hits)];
}

function hasSoccerSignal(tags: string[], collections: string[], title: string): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")} ${title}`.toLowerCase();
  return (
    /\bsoccer\b/.test(hay) ||
    /\bfifa\b/.test(hay) ||
    /\bworld\s+cup\b/.test(hay) ||
    /\bnational\s+football\s+team\b/.test(hay) ||
    /\bfootball\s+kit\b/.test(hay) ||
    /\bhome\s+kit\b/.test(hay) ||
    /\baway\s+kit\b/.test(hay)
  );
}

function sportTags(tags: string[]): CatalogueSport[] {
  const hay = tags.join(" ").toLowerCase();
  const hits: CatalogueSport[] = [];
  if (/\bhockey\b/.test(hay)) hits.push("Hockey");
  if (/\bbaseball\b/.test(hay)) hits.push("Baseball");
  if (/\bbasketball\b/.test(hay)) hits.push("Basketball");
  if (/\bfootball\b/.test(hay) && !/\bsoccer\b/.test(hay)) hits.push("Football");
  if (/\bsoccer\b/.test(hay)) hits.push("Soccer");
  if (/\bvolleyball\b/.test(hay)) hits.push("Volleyball");
  if (/\bsoftball\b/.test(hay)) hits.push("Softball");
  return [...new Set(hits)];
}

function collectionSports(collections: string[]): CatalogueSport[] {
  const hay = collections.join(" ").toLowerCase();
  const hits: CatalogueSport[] = [];
  if (/\bhockey\b/.test(hay)) hits.push("Hockey");
  if (/\bbaseball\b/.test(hay)) hits.push("Baseball");
  if (/\bbasketball\b/.test(hay)) hits.push("Basketball");
  if (/\bfootball\s+jerseys?\b/.test(hay) && !/\bsoccer\b/.test(hay)) hits.push("Football");
  if (/\bsoccer\b/.test(hay)) hits.push("Soccer");
  if (/\bvolleyball\b/.test(hay)) hits.push("Volleyball");
  if (/\bsoftball\b/.test(hay)) hits.push("Softball");
  return [...new Set(hits)];
}

function titleCountryCorroborated(
  title: string,
  slug: string,
  tags: string[],
  collections: string[]
): { ok: boolean; countries: string[]; via: string[] } {
  const titleC = countriesIn(title);
  const slugC = countriesIn(slug.replace(/-/g, " "));
  const tagC = countriesIn(tags.join(" "));
  const colC = countriesIn(collections.join(" "));
  const via: string[] = [];
  const inTags = titleC.filter((c) => tagC.includes(c));
  const inCols = titleC.filter((c) => colC.includes(c));
  if (inTags.length) via.push(`tags:${inTags.join(",")}`);
  if (inCols.length) via.push(`collections:${inCols.join(",")}`);

  // Slug-only country in tags while title country absent → conflict
  const slugOnlyInTags = slugC.filter((c) => tagC.includes(c) && !titleC.includes(c));
  if (slugOnlyInTags.length > 0 && inTags.length === 0) {
    return { ok: false, countries: titleC, via: [`slug-tag-conflict:${slugOnlyInTags.join(",")}`] };
  }

  return { ok: via.length > 0 && titleC.length > 0, countries: titleC, via };
}

function sameCountryTitleSlug(title: string, slug: string): boolean {
  const t = countriesIn(title);
  const s = countriesIn(slug.replace(/-/g, " "));
  if (t.length === 0 || s.length === 0) return false;
  return t.some((c) => s.includes(c));
}

export type HumanReviewInput = {
  title: string;
  slug: string;
  team?: string | null;
  tags?: string[];
  collections?: string[];
  productType?: string | null;
  /** Prior disposition from first-pass conflict resolver */
  priorDisposition: ConflictDisposition;
  priorReason: string;
};

/**
 * Second-pass: upgrade HUMAN_REVIEW / INVALID only with strong corroboration.
 * Returns the prior disposition unchanged when evidence is still ambiguous.
 */
export function resolveHumanReviewProduct(input: HumanReviewInput): ConflictResolution {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const tags = (input.tags ?? []).map(String);
  const collections = (input.collections ?? []).map(String);
  const team = input.team ?? null;
  const titleSports = explicitSportsInText(title);
  const slugSports = explicitSportsInText(slug.replace(/-/g, " "));
  const college = hasCollegeEvidence(title, slug, tags.join(" "));
  const tagSports = sportTags(tags);
  const colSports = collectionSports(collections);

  const evidence = {
    title,
    slug,
    tags,
    team,
    titleSports,
    slugSports,
    tagsCorroborateTitle: false,
    tagsCorroborateSlug: false,
    diacriticOnlyMismatch: false
  };

  const done = (
    disposition: ConflictDisposition,
    sport: CatalogueSport | null,
    league: string | null,
    reason: string
  ): ConflictResolution => ({
    disposition,
    sport,
    league,
    reason,
    evidence: {
      ...evidence,
      tagsCorroborateTitle: disposition === "SAFE_TO_FIX"
    },
    hasOptionSet: sport !== null && OPTION_SET_SPORTS.has(sport)
  });

  const leave = (reason: string): ConflictResolution =>
    done(input.priorDisposition, null, null, reason);

  // ── 1) FIFA / national-team soccer with independent country corroboration ──
  const soccerOk = hasSoccerSignal(tags, collections, title);
  const country = titleCountryCorroborated(title, slug, tags, collections);
  const fifaTitle =
    /\bfifa(\s+x)?\s+world\s+cup\b/i.test(title) ||
    /\bfifa\s+world\s+cup\b/i.test(title) ||
    /\bnational\s+team\b/i.test(title) ||
    /\b\d{4}\s+(home|away|special)\s+(jersey|kit)\b/i.test(title) ||
    /\bcanada\s+soccer\b/i.test(title) ||
    /\bhome\s+kit\b|\baway\s+kit\b/i.test(title);

  if (fifaTitle && soccerOk) {
    if (sameCountryTitleSlug(title, slug) && (/\bfifa\b/i.test(title) || /\bsoccer\b/i.test(tags.join(" ")))) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        "FIFA World Cup",
        `Title/slug share country; soccer/FIFA signals present (${countriesIn(title).join(",")})`
      );
    }
    if (country.ok) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        /\bfifa|world\s+cup/i.test(`${title} ${tags.join(" ")}`)
          ? "FIFA World Cup"
          : "International",
        `Title country corroborated via ${country.via.join("; ")}; soccer signals present`
      );
    }
    if (/\bcanada\s+soccer\b/i.test(title) && /\bcanada\b/i.test(tags.join(" "))) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        "International",
        "Title contains Canada Soccer; tags corroborate Canada"
      );
    }
  }

  // Explicit soccer word in title (e.g. Canada Soccer) even if SPORT_PATTERNS missed it
  if (/\bsoccer\b/i.test(title) && country.ok) {
    return done(
      "SAFE_TO_FIX",
      "Soccer",
      /\bfifa|world\s+cup/i.test(`${title} ${tags.join(" ")}`) ? "FIFA World Cup" : "International",
      `Explicit soccer in title; country via ${country.via.join("; ")}`
    );
  }

  // ── 2) College football: school tags + Football J + Football Jerseys collection ──
  const schoolTag = tags.some((t) => /ncaa|bulldogs|buckeyes|bruins|mountaineers|huskies|trojans|cardinal|sooners|buffaloes|jayhawks|wildcats|aggies|hawkeyes|boilermakers|hurricanes|wolfpack|knights/i.test(t));
  const footballJ = tags.some((t) => /\bfootball\b/i.test(t));
  const footballCol = colSports.includes("Football") && !colSports.some((s) => s !== "Football");
  const conflictingColSport = colSports.some((s) => s !== "Football" && s !== "Soccer");
  if (
    college &&
    schoolTag &&
    footballJ &&
    footballCol &&
    !conflictingColSport &&
    titleSports.length === 0 &&
    !tagSports.some((s) => s !== "Football")
  ) {
    return done(
      "SAFE_TO_FIX",
      "Football",
      "NCAA",
      "Title school corroborated by tags; Football J tag + Football Jerseys collection (no conflicting sport)"
    );
  }

  // ── 3) Famous football alumni in title; tags corroborate school (ignore slug-sport tags) ──
  if (college && /\balumni\b/i.test(title)) {
    const alumni = FOOTBALL_ALUMNI.find((a) => a.pattern.test(title));
    if (alumni && schoolTag) {
      return done(
        "SAFE_TO_FIX",
        "Football",
        "NCAA",
        `Known football alumni (${alumni.label}) in title; school tags corroborate identity`
      );
    }
  }

  // ── 4) Volleyball/Softball explicit in title; same-school or title-only school tags; no conflicting sport tags/collections ──
  if (
    titleSports.length === 1 &&
    (titleSports[0] === "Volleyball" || titleSports[0] === "Softball")
  ) {
    const sport = titleSports[0]!;
    const conflictSports = [...tagSports, ...colSports].filter((s) => s !== sport);
    if (conflictSports.length === 0) {
      const schoolsMatch =
        slugSports.length === 0 ||
        (slugSports.length === 1 && slugSports[0] !== sport) ||
        titleSports[0] !== slugSports[0];
      // Prefer when tags name the school and do not name a conflicting sport
      if (schoolTag || (schoolsMatch && tags.some((t) => /\bncaa\b/i.test(t)))) {
        return done(
          "SAFE_TO_FIX",
          sport,
          "NCAA",
          `Title explicit ${sport}; school/NCAA tags corroborate; no conflicting sport tags/collections — no Aris option set`
        );
      }
    }
  }

  // ── 5) INVALID FIFA: only upgrade when country independently corroborated (not SEO) ──
  if (input.priorDisposition === "INVALID_PRODUCT") {
    if (soccerOk && country.ok) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        "FIFA World Cup",
        `INVALID upgraded: title country via ${country.via.join("; ")}; soccer/FIFA signals`
      );
    }
    if (soccerOk && !country.ok) {
      return leave(
        `${input.priorReason} | re-review: soccer clear but country only in title/SEO without tags/collections — leave draft`
      );
    }
    return leave(`${input.priorReason} | re-review: still insufficient for deterministic correction`);
  }

  // Default: keep prior HUMAN_REVIEW reason (augment slightly)
  return leave(
    `${input.priorReason} | second-pass: no strong multi-source sport corroboration`
  );
}

export function normalizeCollections(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object" && "title" in c) return String((c as { title: unknown }).title);
      return "";
    })
    .filter(Boolean);
}

export { stripDiacritics };
