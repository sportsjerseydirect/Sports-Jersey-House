/**
 * Resolve catalogue CONFLICT drafts with corroborating evidence.
 * Never trusts title or slug alone when they disagree.
 * Never invents sports, leagues, sizes, or option sets.
 */
import {
  explicitSportsInText,
  hasCollegeEvidence,
  hasCollegeMascotMismatch,
  type CatalogueSport
} from "./college-international-signals";

export type ConflictDisposition = "SAFE_TO_FIX" | "HUMAN_REVIEW" | "INVALID_PRODUCT";

export type ConflictResolution = {
  disposition: ConflictDisposition;
  sport: CatalogueSport | null;
  league: string | null;
  reason: string;
  evidence: {
    title: string;
    slug: string;
    tags: string[];
    team: string | null;
    titleSports: CatalogueSport[];
    slugSports: CatalogueSport[];
    tagsCorroborateTitle: boolean;
    tagsCorroborateSlug: boolean;
    diacriticOnlyMismatch: boolean;
  };
  hasOptionSet: boolean;
};

const OPTION_SET_SPORTS = new Set<CatalogueSport>([
  "Football",
  "Basketball",
  "Hockey",
  "Baseball",
  "Soccer"
]);

const STOP = new Set([
  "jersey",
  "jerseys",
  "white",
  "black",
  "navy",
  "maroon",
  "royal",
  "cream",
  "green",
  "purple",
  "gold",
  "red",
  "blue",
  "gray",
  "grey",
  "custom",
  "premium",
  "fashion",
  "lightweight",
  "gameday",
  "greats",
  "colosseum",
  "college",
  "limited",
  "player",
  "alumni",
  "home",
  "away",
  "alternate",
  "series",
  "swingman",
  "mitchell",
  "hardwood",
  "classics",
  "practice",
  "cancer",
  "fights",
  "fanatics",
  "breakaway",
  "premier",
  "strategy",
  "unisex",
  "mens",
  "men",
  "women",
  "youth",
  "edition",
  "icon",
  "select",
  "wordmark",
  "collection",
  "new",
  "arrival",
  "international",
  "team",
  "world",
  "cup",
  "fifa",
  "ncaa",
  "nil",
  "pick",
  "game",
  "with",
  "patch",
  "champions",
  "national",
  "major",
  "league",
  "baseball",
  "hockey",
  "football",
  "basketball",
  "soccer",
  "softball",
  "volleyball"
]);

const NHL =
  /\b(maple leafs|canadiens|blackhawks|red wings|oilers|flames|canucks|jets|senators|sabres|devils|islanders|flyers|capitals|lightning|panthers|blue jackets|predators|stars|blues|\bwild\b|avalanche|anaheim ducks|los angeles kings|san jose sharks|kraken|golden knights|coyotes|penguins|boston bruins|new york rangers|carolina hurricanes|tampa bay lightning|vegas golden knights)\b/i;
const MLB =
  /\b(yankees|red sox|dodgers|mets|cubs|white sox|braves|phillies|astros|seattle mariners|texas rangers|athletics|orioles|rays|blue jays|twins|guardians|detroit tigers|kansas city royals|brewers|st\.? louis cardinals|cincinnati reds|pirates|rockies|diamondbacks|padres|san francisco giants|los angeles angels|marlins|washington nationals)\b/i;
const NBA =
  /\b(lakers|celtics|bulls|warriors|brooklyn nets|knicks|heat|bucks|suns|nuggets|mavericks|clippers|sixers|76ers|raptors|pistons|hawks|hornets|wizards|magic|pacers|cavaliers|grizzlies|pelicans|spurs|rockets|thunder|timberwolves|blazers|trail blazers|sacramento kings|minnesota timberwolves|golden state warriors|oklahoma city thunder|new orleans pelicans|san antonio spurs)\b/i;
const NFL =
  /\b(packers|dallas cowboys|patriots|chiefs|49ers|steelers|ravens|bills|dolphins|commanders|vikings|saints|buccaneers|texans|colts|jaguars|titans|broncos|raiders|chargers|bengals|browns|seahawks|los angeles rams|philadelphia eagles|new york giants|chicago bears|detroit lions)\b/i;

const GENERIC_SCHOOL_TOKENS = new Set([
  "texas",
  "michigan",
  "washington",
  "florida",
  "carolina",
  "virginia",
  "california",
  "arizona",
  "colorado",
  "georgia",
  "ohio",
  "iowa",
  "oregon",
  "indiana",
  "alabama",
  "tennessee",
  "kentucky",
  "oklahoma",
  "mississippi",
  "missouri",
  "wisconsin",
  "minnesota",
  "illinois",
  "kansas",
  "nebraska",
  "utah",
  "navy",
  "army",
  "boston",
  "north",
  "south",
  "west",
  "state",
  "college",
  "university"
]);

const FIFA_COUNTRIES = new Set([
  "mexico",
  "brazil",
  "france",
  "portugal",
  "uruguay",
  "croatia",
  "canada",
  "argentina",
  "england",
  "spain",
  "germany",
  "italy",
  "wales",
  "scotland",
  "morocco",
  "japan",
  "usa",
  "serbia",
  "poland",
  "belgium",
  "netherlands"
]);

function distinctiveSchoolTokens(text: string): string[] {
  return mascotsFromConflictText(text).filter((t) => !GENERIC_SCHOOL_TOKENS.has(t));
}

function mascotsFromConflictText(text: string): string[] {
  // Reuse college mascot matcher via hasCollegeMascotMismatch inputs: pull tokens similarly
  const COLLEGE_MASCOTS =
    /\b(buckeyes|sooners|wolverines|crimson tide|tar heels|longhorns|bulldogs|wildcats|huskies|gators|razorbacks|mountaineers|sun devils|buffaloes|knights|black knights|eagles|seminoles|hurricanes|aggies|red raiders|golden gophers|panthers|illini|hokies|beavers|cougars|trojans|bruins|ducks|cardinal|bearcats|jayhawks|cyclones|horned frogs|gamecocks|volunteers|commodores|rebels|hoosiers|hoyas|fighting irish|badgers|terrapins|midshipmen|spartans|nittany lions|blue devils|wolfpack|yellow jackets|cornhuskers|hawkeyes|boilermakers|scarlet knights|golden bears|cowboys|mustangs|horns|miners|lobos|aztecs|bearkats|monarchs|paladins|demon deacons|blue raiders|mean green|roadrunners|bobcats|thundering herd|chippewas|rockets|bulls|ragin cajuns|warhawks|jaguars|redhawks|golden flashes|falcons|tigers|auburn|georgetown|clemson|oklahoma|ohio state|michigan|usc|ucla|tennessee|georgia|lsu|penn state|wisconsin|iowa|purdue|indiana|maryland|virginia|texas|notre dame|boston college|west virginia|north carolina|duke|kansas|kentucky|louisville|arizona|oregon|washington|colorado|utah|baylor|nebraska|minnesota|northwestern|illinois|michigan state|rutgers|pittsburgh|syracuse|wake forest|cal|stanford|ucf)\b/gi;
  return [...text.toLowerCase().replace(/-/g, " ").matchAll(COLLEGE_MASCOTS)].map((m) =>
    m[0]!.toLowerCase().replace(/\s+/g, "-")
  );
}

/** True when distinctive school/mascot tokens disagree (ignores shared state names like "texas"). */
export function hasDistinctSchoolMismatch(title: string, slug: string): boolean {
  const titleSchools = new Set(distinctiveSchoolTokens(title));
  const slugSchools = new Set(distinctiveSchoolTokens(slug));
  if (titleSchools.size === 0 || slugSchools.size === 0) return false;
  return ![...titleSchools].some((t) => slugSchools.has(t));
}

function fifaPlayerTokensFromTitle(title: string): string[] {
  const titleNorm = stripDiacritics(title)
    .replace(/fifa world cup jersey/g, "")
    .replace(/fifa world cup/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  return titleNorm
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !FIFA_COUNTRIES.has(p) && !/^\d+$/.test(p) && !STOP.has(p));
}

function fifaPlayerTokensFromSlug(slug: string): string[] {
  return stripDiacritics(slug)
    .split("-")
    .filter(
      (p) =>
        p.length >= 3 &&
        !FIFA_COUNTRIES.has(p) &&
        !/^\d+$/.test(p) &&
        !["fifa", "world", "cup", "jersey"].includes(p)
    );
}

export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokens(text: string): string[] {
  return stripDiacritics(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

function significantOverlap(a: string[], b: Set<string>): string[] {
  return a.filter((t) => b.has(t));
}

/** True when FIFA title/slug differ only by accents/punctuation. */
export function isFifaDiacriticOnlyMismatch(title: string, slug: string): boolean {
  if (!/\bfifa world cup\b/i.test(title) && !/\bfifa\b/i.test(title)) return false;
  const titleNorm = stripDiacritics(title)
    .replace(/fifa world cup jersey/g, "")
    .replace(/fifa world cup/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  const parts = titleNorm.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const slugL = stripDiacritics(slug);
  const countries = FIFA_COUNTRIES;
  // Prefer first+second name tokens in slug (accent-stripped)
  const candidate = `${parts[0]}-${parts[1]}`;
  if (slugL.includes(candidate)) return true;
  // Single distinctive non-country name token must appear in slug AND a country token
  const nameParts = parts.filter((p) => !countries.has(p) && !/^\d+$/.test(p));
  const countryParts = parts.filter((p) => countries.has(p));
  if (nameParts.length === 0 || countryParts.length === 0) return false;
  const nameInSlug = nameParts.some((p) => p.length >= 4 && slugL.includes(p));
  const countryInSlug = countryParts.some((c) => slugL.includes(c));
  return nameInSlug && countryInSlug;
}

function sportFromTags(tags: string[]): CatalogueSport | null {
  const hay = tags.join(" ").toLowerCase();
  const hits: CatalogueSport[] = [];
  if (/\bhockey\b/.test(hay)) hits.push("Hockey");
  if (/\bbaseball\b/.test(hay)) hits.push("Baseball");
  if (/\bbasketball\b/.test(hay)) hits.push("Basketball");
  if (/\bfootball\b/.test(hay) && !/\bsoccer\b/.test(hay)) hits.push("Football");
  if (/\bsoccer\b/.test(hay)) hits.push("Soccer");
  if (/\bvolleyball\b/.test(hay)) hits.push("Volleyball");
  if (/\bsoftball\b/.test(hay)) hits.push("Softball");
  const unique = [...new Set(hits)];
  return unique.length === 1 ? unique[0]! : null;
}

function sportFromFranchise(title: string): { sport: CatalogueSport; league: string } | null {
  // Avoid college false positives (Oregon Ducks, etc.)
  if (/\bncaa\b|gameday greats|colosseum|nil |university|college\b/i.test(title)) {
    return null;
  }
  if (NHL.test(title)) return { sport: "Hockey", league: "NHL" };
  if (MLB.test(title)) return { sport: "Baseball", league: "MLB" };
  if (NBA.test(title)) return { sport: "Basketball", league: "NBA" };
  if (NFL.test(title)) return { sport: "Football", league: "NFL" };
  return null;
}

function resolveLeague(
  title: string,
  slug: string,
  tags: string[],
  sport: CatalogueSport,
  college: boolean
): string | null {
  const titleL = title.toLowerCase();
  const tagsL = tags.join(" ").toLowerCase();
  // Prefer title/tags for league — never promote slug-only FIFA/NCAA signals
  if (/\bfifa world cup\b|\bfifa 2026\b/.test(`${titleL} ${tagsL}`)) return "FIFA World Cup";
  if (/\bwbc\b|world baseball classic/.test(`${titleL} ${tagsL} ${slug}`)) return "International";
  if (/\bolympic|national team/.test(titleL) && !college) return "International";
  if (college || /\bncaa\b/.test(`${titleL} ${tagsL}`)) return "NCAA";
  if (sport === "Hockey" && NHL.test(title)) return "NHL";
  if (sport === "Baseball" && MLB.test(title)) return "MLB";
  if (sport === "Basketball" && NBA.test(title)) return "NBA";
  if (sport === "Football" && NFL.test(title)) return "NFL";
  if (sport === "Soccer" && /\bfifa|world cup|euro\b/.test(titleL)) return "FIFA World Cup";
  return null;
}

function isGarbageListing(title: string, slug: string): boolean {
  const t = title.trim();
  if (!t || t === "NAME" || /^avis-option/i.test(slug)) return true;
  if (t.length < 4) return true;
  return false;
}

export function resolveConflictProduct(input: {
  title: string;
  slug: string;
  team?: string | null;
  tags?: string[];
  productType?: string | null;
}): ConflictResolution {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const team = input.team ?? null;
  const tags = (input.tags ?? []).map(String);
  const titleSports = explicitSportsInText(title);
  const slugSports = explicitSportsInText(slug);
  const tagTokens = new Set(tokens(tags.join(" ")));
  const titleToks = tokens(title);
  const slugToks = tokens(slug.replace(/-/g, " "));
  const titleHits = significantOverlap(titleToks, tagTokens);
  const slugHits = significantOverlap(slugToks, tagTokens);
  const tagsCorroborateTitle = titleHits.length >= 1;
  const tagsCorroborateSlug = slugHits.length >= 1;
  const diacriticOnlyMismatch = isFifaDiacriticOnlyMismatch(title, slug);
  const college = hasCollegeEvidence(title, slug, tags.join(" "));

  const baseEvidence = {
    title,
    slug,
    tags,
    team,
    titleSports,
    slugSports,
    tagsCorroborateTitle,
    tagsCorroborateSlug,
    diacriticOnlyMismatch
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
    evidence: baseEvidence,
    hasOptionSet: sport !== null && OPTION_SET_SPORTS.has(sport)
  });

  if (isGarbageListing(title, slug)) {
    return done("INVALID_PRODUCT", null, null, "Corrupted/empty title or avis-option slug");
  }

  // 1) FIFA accent-only false positives
  if (diacriticOnlyMismatch) {
    return done(
      "SAFE_TO_FIX",
      "Soccer",
      "FIFA World Cup",
      "Title/slug match after diacritic normalization; FIFA World Cup soccer"
    );
  }

  // 1b) FIFA player/country mismatches — require player-name or country tag corroboration
  if (/\bfifa(\s+x)?\s+world cup\b/i.test(title) || /\bfifa world cup\b/i.test(title)) {
    const titlePlayer = fifaPlayerTokensFromTitle(title);
    const slugPlayer = fifaPlayerTokensFromSlug(slug);
    const tagSet = new Set(tokens(tags.join(" ")));
    const titlePlayerInTags = titlePlayer.filter((p) => tagSet.has(p));
    const slugPlayerInTags = slugPlayer.filter((p) => tagSet.has(p));

    if (titlePlayerInTags.length >= 1 && slugPlayerInTags.length === 0) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        "FIFA World Cup",
        `FIFA title player/country corroborated by tags (${titlePlayerInTags.join(",")}); slug differs`
      );
    }
    if (slugPlayerInTags.length >= 1 && titlePlayerInTags.length === 0) {
      return done(
        "HUMAN_REVIEW",
        null,
        null,
        `FIFA tags corroborate slug player (${slugPlayerInTags.join(",")}) not title — title rewrite not allowed`
      );
    }
    // National-team FIFA kits without a player name: country token in title + tags is enough
    const titleCountries = tokens(title).filter((t) => FIFA_COUNTRIES.has(t) || ["saudi", "arabia", "korea", "costa", "rica", "ghana", "senegal", "norway", "peru", "chile", "colombia", "venezuela", "jamaica", "qatar", "wales", "scotland", "ireland"].includes(t));
    const titleCountryInTags = titleCountries.filter((t) => tagSet.has(t));
    if (/\bnational team\b/i.test(title) && titleCountryInTags.length >= 1 && slugPlayerInTags.length === 0) {
      return done(
        "SAFE_TO_FIX",
        "Soccer",
        "FIFA World Cup",
        `FIFA national-team title country corroborated by tags (${titleCountryInTags.join(",")})`
      );
    }
    if (titlePlayerInTags.length === 0 && slugPlayerInTags.length === 0 && titleCountryInTags.length === 0) {
      return done(
        "INVALID_PRODUCT",
        null,
        null,
        "FIFA World Cup title/slug mismatch without player/country tag corroboration — likely cross-linked import"
      );
    }
    return done(
      "HUMAN_REVIEW",
      null,
      null,
      "FIFA tags mention tokens from both title and slug identities"
    );
  }

  // 2) Title + tags agree; slug disagrees — trust title only with tag corroboration
  if (tagsCorroborateTitle && !tagsCorroborateSlug) {
    let sport: CatalogueSport | null = titleSports.length === 1 ? titleSports[0]! : null;
    let league: string | null = null;

    if (!sport) {
      const franchise = sportFromFranchise(title);
      if (franchise) {
        sport = franchise.sport;
        league = franchise.league;
      }
    }

    // Never infer sport from tags alone — corrupted imports often retain slug-sport tags.
    if (!sport) {
      return done(
        "HUMAN_REVIEW",
        null,
        null,
        `Tags corroborate title identity (${titleHits.join(",")}) but sport is not explicit in title`
      );
    }

    // College products must not become pro leagues
    if (college && league && ["NHL", "MLB", "NBA", "NFL"].includes(league)) {
      league = "NCAA";
    }
    if (!league) league = resolveLeague(title, slug, tags, sport, college);

    if (college && league && ["NHL", "MLB", "NBA", "NFL"].includes(league)) {
      league = "NCAA";
    }

    if (!OPTION_SET_SPORTS.has(sport)) {
      return done(
        "SAFE_TO_FIX",
        sport,
        league ?? (college ? "NCAA" : null),
        `Title+tags agree on ${sport}; no Aris option set — classify but keep draft for publish`
      );
    }

    return done(
      "SAFE_TO_FIX",
      sport,
      league,
      `Tags corroborate title (${titleHits.join(",")}); slug appears corrupted; sport=${sport}`
    );
  }

  // 3) Same school, different sports — require distinctive mascot overlap + tags picking title sport
  if (
    titleSports.length === 1 &&
    slugSports.length === 1 &&
    titleSports[0] !== slugSports[0] &&
    !hasDistinctSchoolMismatch(title, slug) &&
    !hasCollegeMascotMismatch(title, slug)
  ) {
    const tagSport = sportFromTags(tags);
    if (tagSport && tagSport === titleSports[0] && tagsCorroborateTitle) {
      const league = resolveLeague(title, slug, tags, tagSport, college);
      return done(
        "SAFE_TO_FIX",
        tagSport,
        college ? "NCAA" : league,
        `Same school; tags corroborate title sport ${tagSport} over slug sport ${slugSports[0]}`
      );
    }
    if (tagSport && tagSport === slugSports[0] && !tagsCorroborateTitle) {
      return done(
        "HUMAN_REVIEW",
        null,
        null,
        `Title/slug sport conflict; tags lean slug (${tagSport}) — will not trust slug alone`
      );
    }
    return done(
      "HUMAN_REVIEW",
      null,
      null,
      `Title sport ${titleSports[0]} vs slug sport ${slugSports[0]} without decisive tag corroboration`
    );
  }

  // 3b) Different schools + different sports
  if (
    titleSports.length === 1 &&
    slugSports.length === 1 &&
    titleSports[0] !== slugSports[0] &&
    (hasDistinctSchoolMismatch(title, slug) || hasCollegeMascotMismatch(title, slug))
  ) {
    if (tagsCorroborateTitle && !tagsCorroborateSlug) {
      const sport = titleSports[0]!;
      const league = college ? "NCAA" : resolveLeague(title, slug, tags, sport, college);
      return done(
        "SAFE_TO_FIX",
        sport,
        league,
        `Different school tokens; tags corroborate title (${titleHits.join(",")}); sport=${sport}`
      );
    }
    // Shared generic tokens (e.g. "texas") may make tagsCorroborateSlug true — still allow if
    // distinctive title school tokens are in tags and slug-distinctive tokens are not.
    const titleSchools = distinctiveSchoolTokens(title);
    const slugSchools = distinctiveSchoolTokens(slug);
    const tagSet = new Set(tokens(tags.join(" ")));
    const titleSchoolInTags = titleSchools.filter((t) => tagSet.has(t));
    const slugSchoolInTags = slugSchools.filter((t) => tagSet.has(t));
    if (titleSchoolInTags.length >= 1 && slugSchoolInTags.length === 0) {
      const sport = titleSports[0]!;
      return done(
        "SAFE_TO_FIX",
        sport,
        college ? "NCAA" : resolveLeague(title, slug, tags, sport, college),
        `Distinctive school tags match title (${titleSchoolInTags.join(",")}); sport=${sport}`
      );
    }
    return done(
      "HUMAN_REVIEW",
      null,
      null,
      `Title sport ${titleSports[0]} / school vs slug sport ${slugSports[0]} / school without exclusive title tag corroboration`
    );
  }

  // 4) Tags corroborate slug only — do not rewrite title; leave for human
  if (tagsCorroborateSlug && !tagsCorroborateTitle) {
    return done(
      "HUMAN_REVIEW",
      null,
      null,
      `Tags corroborate slug (${slugHits.join(",")}) but not title — title rewrite not allowed`
    );
  }

  // 5) Tags corroborate tokens from both title and slug
  if (tagsCorroborateTitle && tagsCorroborateSlug) {
    return done(
      "HUMAN_REVIEW",
      null,
      null,
      "Tags corroborate tokens from both title and slug — genuinely ambiguous"
    );
  }

  // 6) Hard cross-franchise / school identity conflict without tag support
  if (titleHits.length === 0 && slugHits.length === 0) {
    const franchiseTitle = sportFromFranchise(title);
    const franchiseSlug = sportFromFranchise(slug.replace(/-/g, " "));
    if (franchiseTitle && franchiseSlug && franchiseTitle.league !== franchiseSlug.league) {
      return done(
        "INVALID_PRODUCT",
        null,
        null,
        "Title and slug reference different professional franchises with no corroborating tags"
      );
    }
    if (college && titleSports.length === 1 && slugSports.length === 1 && titleSports[0] !== slugSports[0]) {
      return done(
        "HUMAN_REVIEW",
        null,
        null,
        "College title/slug sport conflict without tag corroboration"
      );
    }
  }

  return done(
    "HUMAN_REVIEW",
    null,
    null,
    "Insufficient corroborating evidence to resolve conflict safely"
  );
}
