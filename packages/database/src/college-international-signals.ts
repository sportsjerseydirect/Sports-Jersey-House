/**
 * Deterministic college / international / other-sport classification for draft products.
 * Never maps college or national teams to NHL/NFL/NBA/MLB.
 * Generic "jersey" alone is never sufficient.
 */

export type CatalogueSport =
  | "Football"
  | "Basketball"
  | "Hockey"
  | "Baseball"
  | "Soccer"
  | "Volleyball"
  | "Lacrosse"
  | "Softball"
  | "Cricket"
  | "Rugby"
  | "Wrestling";

export type ClassificationCategory =
  | "college_slug_prefix"
  | "college_explicit_sport"
  | "international_explicit"
  | "other_sport_no_options"
  | "conflict"
  | "unknown";

export type ClassificationResult = {
  sport: CatalogueSport | null;
  league: string | null;
  category: ClassificationCategory;
  evidence: string;
  /** Sport has a matching Aris option set in SJD */
  hasOptionSet: boolean;
};

const OPTION_SET_SPORTS = new Set<CatalogueSport>([
  "Football",
  "Basketball",
  "Hockey",
  "Baseball",
  "Soccer"
]);

const COLLEGE_MARKERS =
  /\b(ncaa|gameday greats|colosseum|midshipmen|terrapins|hoosiers|hoyas|fighting irish|badgers|notre dame|georgetown|washington state cougars|navy midshipmen|wolverines|buckeyes|crimson tide|tar heels|longhorns|bulldogs|wildcats|huskies|gators|razorbacks|mountaineers|sun devils|buffaloes|knights|eagles|seminoles|hurricanes|aggies|red raiders|golden gophers|panthers|illini|hokies|beavers|cougars|trojans|bruins|ducks|cardinal|bearcats|jayhawks|cyclones|horned frogs|gamecocks|volunteers|commodores|rebels|razorbacks|orange|orange crush|nil pick|pick a player|collegiate|university|college)\b/i;

const PRO_LEAGUE_BLOCK =
  /\b(nfl|nba|nhl|mlb)\b|(^|-)nfl(-|$)|(^|-)nba(-|$)|(^|-)nhl(-|$)|(^|-)mlb(-|$)/i;

const MLB_FRANCHISE =
  /\b(yankees|red sox|dodgers|mets|cubs|white sox|braves|phillies|astros|mariners|rangers|athletics|orioles|rays|blue jays|twins|guardians|tigers|royals|brewers|cardinals|reds|pirates|rockies|diamondbacks|padres|giants|angels|marlins|nationals|city connect|penguins|blackhawks|maple leafs|canadiens|oilers|flames|canucks|wild\b|sharks|kraken|golden knights|coyotes|capitals|lightning|panthers|devils|islanders|flyers|red wings|senators|sabres|jets\b|kings\b|ducks\b|stars\b|blues\b|avalanche|predators|wizards|lakers|celtics|bulls|warriors|heat|bucks|suns|nuggets|mavericks|clippers|knicks|nets|76ers|sixers|raptors|spurs|rockets|thunder|timberwolves|blazers|pelicans|hornets|pacers|cavaliers|grizzlies|packers|cowboys|patriots|chiefs|eagles\b|49ers|steelers|ravens|bills|dolphins|jets\b|giants\b|commanders|bears\b|lions\b|vikings|saints|buccaneers|falcons|panthers\b|texans|colts|jaguars|titans|broncos|raiders|chargers|bengals|browns)\b/i;

const INTERNATIONAL_MARKERS =
  /\b(national team|olympic|fifa world cup|world cup|uefa euro|euro cup|euro 20|team usa|wbc\b|world baseball classic)\b/i;

const SPORT_PATTERNS: { sport: CatalogueSport; pattern: RegExp }[] = [
  { sport: "Hockey", pattern: /\bhockey(\s|-)?jersey|\bhockey fashion|\bcollege hockey|\bhockey\b/i },
  { sport: "Baseball", pattern: /\bbaseball(\s|-)?jersey|\bbaseball fashion|\bcollege baseball|\bwbc\b|world baseball classic/i },
  { sport: "Basketball", pattern: /\bbasketball(\s|-)?jersey|\bbasketball fashion|\bcollege basketball|\bbasketball\b/i },
  {
    sport: "Football",
    pattern: /\bfootball(\s|-)?jersey|\bfootball fashion|\bcollegiate football|\bcollege football|\bgridiron\b|\bfootball\b/i
  },
  { sport: "Soccer", pattern: /\bsoccer(\s|-)?jersey|\bsoccer(\s|-)?fashion|\bfootball kit|\bhome kit|\baway kit|\bfifa world cup jersey|\beuro\b.*jersey/i },
  { sport: "Volleyball", pattern: /\bvolleyball(\s|-)?jersey|\bvolleyball fashion|\bvolleyball\b/i },
  { sport: "Lacrosse", pattern: /\blacrosse(\s|-)?jersey|\blacrosse\b/i },
  { sport: "Softball", pattern: /\bsoftball(\s|-)?jersey|\bsoftball\b/i },
  { sport: "Cricket", pattern: /\bcricket(\s|-)?jersey|\bcricket\b/i },
  { sport: "Rugby", pattern: /\brugby(\s|-)?jersey|\brugby\b/i },
  { sport: "Wrestling", pattern: /\bwrestling(\s|-)?jersey|\bwrestling\b/i }
];

const COLLEGE_MASCOTS =
  /\b(buckeyes|sooners|wolverines|crimson tide|tar heels|longhorns|bulldogs|wildcats|huskies|gators|razorbacks|mountaineers|sun devils|buffaloes|knights|black knights|eagles|seminoles|hurricanes|aggies|red raiders|golden gophers|panthers|illini|hokies|beavers|cougars|trojans|bruins|ducks|cardinal|bearcats|jayhawks|cyclones|horned frogs|gamecocks|volunteers|commodores|rebels|hoosiers|hoyas|fighting irish|badgers|terrapins|midshipmen|spartans|nittany lions|blue devils|wolfpack|yellow jackets|cornhuskers|hawkeyes|boilermakers|scarlet knights|golden bears|cowboys|mustangs|horns|miners|lobos|aztecs|bearkats|monarchs|paladins|demon deacons|blue raiders|mean green|roadrunners|bobcats|thundering herd|chippewas|rockets|bulls|ragin cajuns|warhawks|jaguars|redhawks|golden flashes|falcons|tigers|auburn|army|navy|alabama|georgetown|clemson|oklahoma|ohio state|michigan|usc|ucla|tennessee|georgia|lsu|penn state|wisconsin|iowa|purdue|indiana|maryland|virginia|texas|notre dame|boston college|west virginia|north carolina|duke|kansas|kentucky|louisville|arizona|oregon|washington|colorado|utah|baylor|nebraska|minnesota|northwestern|illinois|michigan state|rutgers|pittsburgh|syracuse|wake forest|cal|stanford)\b/i;

function norm(text: string): string {
  return text.toLowerCase();
}

export function hasCollegeEvidence(title: string, slug: string, payload = ""): boolean {
  const hay = `${title} ${slug} ${payload}`;
  return COLLEGE_MARKERS.test(hay) || /^ncaa[baf]-/i.test(slug) || /-ncaa(-|$)/i.test(slug);
}

export function hasInternationalEvidence(title: string, slug: string, team: string | null): boolean {
  const hay = `${title} ${slug} ${team ?? ""}`;
  return INTERNATIONAL_MARKERS.test(hay) || /\bfifa 2026\b/i.test(team ?? "");
}

export function hasProLeagueFranchiseEvidence(title: string, slug: string): boolean {
  const hay = `${title} ${slug}`;
  return PRO_LEAGUE_BLOCK.test(hay) || MLB_FRANCHISE.test(hay);
}

/** Sports explicitly named in text (not generic jersey). */
export function explicitSportsInText(text: string): CatalogueSport[] {
  const found: CatalogueSport[] = [];
  for (const { sport, pattern } of SPORT_PATTERNS) {
    if (pattern.test(text)) found.push(sport);
  }
  return [...new Set(found)];
}

function mascotsInText(text: string): string[] {
  return [...text.toLowerCase().matchAll(new RegExp(COLLEGE_MASCOTS.source, "gi"))].map((m) =>
    m[0]!.toLowerCase().replace(/\s+/g, "-")
  );
}

export function hasCollegeMascotMismatch(title: string, slug: string): boolean {
  const titleMascots = mascotsInText(title);
  const slugMascots = mascotsInText(slug.replace(/-/g, " "));
  if (titleMascots.length === 0 || slugMascots.length === 0) return false;
  const titleSet = new Set(titleMascots);
  const slugSet = new Set(slugMascots);
  const overlap = [...titleSet].some((m) => slugSet.has(m));
  if (overlap) return false;
  return true;
}

/** FIFA/Euro player jerseys: require a surname token from title to appear in slug. */
function hasFifaPlayerSlugMismatch(title: string, slug: string): boolean {
  if (!/\bfifa world cup\b/i.test(title)) return false;
  const slugL = norm(slug);
  const parts = title.replace(/\bfifa world cup jersey\b/i, "").trim().split(/\s+/);
  if (parts.length < 2) return false;
  const surname = norm(parts[0]!);
  if (surname.length < 3) return false;
  return !slugL.includes(surname);
}

function slugPrefixSport(slug: string): CatalogueSport | null {
  if (/^ncaab-/i.test(slug)) return "Basketball";
  if (/^ncaaf-/i.test(slug)) return "Football";
  return null;
}

function slugExplicitSport(slug: string): CatalogueSport | null {
  const sports = explicitSportsInText(slug);
  return sports.length === 1 ? sports[0]! : null;
}

function titleExplicitSport(title: string): CatalogueSport | null {
  const sports = explicitSportsInText(title);
  return sports.length === 1 ? sports[0]! : null;
}

/** Detect country/token mismatch between title and slug for international jerseys. */
export function hasTitleSlugTokenConflict(title: string, slug: string): boolean {
  const titleL = norm(title);
  const slugL = norm(slug);

  const titleSports = explicitSportsInText(title);
  const slugSports = explicitSportsInText(slug);
  if (titleSports.length === 1 && slugSports.length === 1 && titleSports[0] !== slugSports[0]) {
    return true;
  }

  // Obvious cross-sport slug/title pairs in college fashion imports
  if (titleL.includes("hockey") && slugL.includes("baseball") && !slugL.includes("hockey")) return true;
  if (titleL.includes("baseball") && slugL.includes("hockey") && !slugL.includes("baseball")) return true;
  if (titleL.includes("volleyball") && (slugL.includes("baseball") || slugL.includes("hockey"))) return true;
  if (titleL.includes("softball") && slugL.includes("hockey")) return true;

  // International: title country vs slug country (common tokens)
  const countries =
    /\b(argentina|scotland|england|france|germany|spain|italy|portugal|brazil|mexico|japan|canada|usa|uruguay|croatia|netherlands|belgium|sweden|norway|denmark|wales|ireland|australia|senegal|morocco|cameroon|ghana|nigeria|poland|serbia|switzerland|austria|colombia|chile|ecuador|peru|venezuela|honduras|costa rica|jamaica|qatar|saudi|korea|morocco)\b/gi;
  const titleCountries = [...titleL.matchAll(countries)].map((m) => m[0]!.toLowerCase());
  const slugCountries = [...slugL.matchAll(countries)].map((m) => m[0]!.toLowerCase());
  if (titleCountries.length === 1 && slugCountries.length === 1 && titleCountries[0] !== slugCountries[0]) {
    return true;
  }

  // NBA/MLB/NHL player jersey slug vs unrelated franchise in title
  if (MLB_FRANCHISE.test(title) && MLB_FRANCHISE.test(slug)) {
    const titleFranchise = titleL.match(MLB_FRANCHISE)?.[0];
    const slugFranchise = slugL.match(MLB_FRANCHISE)?.[0];
    if (titleFranchise && slugFranchise && titleFranchise !== slugFranchise) return true;
  }

  return false;
}

function result(
  sport: CatalogueSport | null,
  league: string | null,
  category: ClassificationCategory,
  evidence: string
): ClassificationResult {
  return {
    sport,
    league,
    category,
    evidence,
    hasOptionSet: sport !== null && OPTION_SET_SPORTS.has(sport)
  };
}

export function classifyCollegeInternationalProduct(input: {
  title: string;
  slug: string;
  team?: string | null;
  league?: string | null;
  sourcePayload?: string;
}): ClassificationResult {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const team = input.team ?? null;
  const payload = input.sourcePayload ?? "";

  if (!title || !slug) {
    return result(null, null, "unknown", "Missing title or slug");
  }

  if (hasTitleSlugTokenConflict(title, slug)) {
    return result(null, null, "conflict", "Title and slug contain conflicting sport or team evidence");
  }

  if (hasCollegeMascotMismatch(title, slug)) {
    return result(null, null, "conflict", "College mascot/team in title does not match slug");
  }

  if (hasFifaPlayerSlugMismatch(title, slug)) {
    return result(null, null, "conflict", "FIFA World Cup player name in title does not match slug");
  }

  const college = hasCollegeEvidence(title, slug, payload);
  const international = hasInternationalEvidence(title, slug, team);
  const proFranchise = hasProLeagueFranchiseEvidence(title, slug);

  // Pro-franchise without college/international context — out of scope, do not guess
  if (proFranchise && !college && !international) {
    return result(null, null, "unknown", "Professional franchise evidence without college/international context");
  }

  // ── College: definitive slug prefixes ─────────────────────────────────────
  const prefixSport = slugPrefixSport(slug);
  if (prefixSport) {
    return result(prefixSport, "NCAA", "college_slug_prefix", `Slug prefix ${slug.split("-")[0]}`);
  }

  // ── International: FIFA / Euro / WBC / Olympic with explicit sport ────────
  if (international) {
    const titleSport = titleExplicitSport(title);
    const slugSport = slugExplicitSport(slug);

    if (/\bfifa world cup\b/i.test(title) && /\bfifa|world-cup|world-cup-jersey\b/i.test(slug)) {
      return result("Soccer", "FIFA World Cup", "international_explicit", "FIFA World Cup in title and slug");
    }
    if (/\b(uefa euro|euro cup|euro 20)\b/i.test(title) && /\beuro|fifa\b/i.test(slug)) {
      return result("Soccer", "UEFA Euro", "international_explicit", "UEFA Euro in title and slug");
    }
    if (/\bwbc\b|world baseball classic/i.test(`${title} ${slug}`)) {
      return result("Baseball", "International", "international_explicit", "World Baseball Classic");
    }
    if (/\bnational team\b.*\bhockey\b|\bolympic\b.*\bhockey\b|\bhockey\b.*\b(national team|olympic)\b/i.test(title)) {
      return result("Hockey", "International", "international_explicit", "National/Olympic hockey in title");
    }
    if (/\bnational team\b.*\b(soccer|football kit)\b|\bhome kit\b/i.test(title) && slugSport === "Soccer") {
      return result("Soccer", "International", "international_explicit", "National soccer kit");
    }
    if (/\bolympic\b/i.test(title) && titleSport && OPTION_SET_SPORTS.has(titleSport)) {
      return result(titleSport, "International", "international_explicit", `Olympic ${titleSport} in title`);
    }
    if (/\bteam usa\b/i.test(title) && titleSport === "Basketball") {
      return result("Basketball", "International", "international_explicit", "Team USA basketball");
    }

    // International signal but sport not explicit enough
    if (!titleSport && !slugSport) {
      return result(null, null, "unknown", "International markers without explicit sport");
    }
  }

  // ── College: explicit sport in title or slug (must agree if both present) ─
  if (college) {
    const titleSport = titleExplicitSport(title);
    const slugSport = slugExplicitSport(slug);

    if (titleSport && slugSport && titleSport !== slugSport) {
      return result(null, null, "conflict", `College title sport ${titleSport} vs slug sport ${slugSport}`);
    }

    const sport = titleSport ?? slugSport;
    if (sport) {
      if (!OPTION_SET_SPORTS.has(sport)) {
        return result(sport, "NCAA", "other_sport_no_options", `College ${sport} — no Aris option set`);
      }
      return result(sport, "NCAA", "college_explicit_sport", `College explicit ${sport} in title/slug`);
    }
  }

  // ── Other sports without college/international (explicit only) ──────────────
  const combinedSport = titleExplicitSport(`${title} ${slug}`);
  if (combinedSport && !OPTION_SET_SPORTS.has(combinedSport)) {
    return result(combinedSport, null, "other_sport_no_options", `Explicit ${combinedSport} — no Aris option set`);
  }

  return result(null, null, "unknown", "Insufficient explicit college/international sport evidence");
}
