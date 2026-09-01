/**
 * Final evidence pass for remaining UNKNOWN drafts.
 * RESOLVE only when >=2 independent signals agree. Never infer from J-tags alone.
 */
import type { CatalogueSport } from "./college-international-signals";
import {
  classifyUnknownDeep,
  normalizeCollections,
  type UnknownDeepInput
} from "./unknown-deep-classification-signals";

export type FinalUnknownAction = "RESOLVE" | "BLOCK";

export type FinalUnknownCategory =
  | "tags_only_soccer"
  | "tags_only_nba"
  | "conflict_college_polluted_tags"
  | "conflict_title_tags_mlb"
  | "conflict_title_tags_nhl"
  | "conflict_title_tags_nba"
  | "high_school_blocked"
  | "non_jersey_blocked"
  | "movie_novelty_blocked"
  | "garbage_blocked"
  | "insufficient_evidence"
  | "conflict_unresolved";

export type FinalUnknownResult = {
  action: FinalUnknownAction;
  sport: CatalogueSport | null;
  league: string | null;
  category: FinalUnknownCategory;
  reason: string;
  blocker: string | null;
  evidence: string[];
  hasOptionSet: boolean;
  isJerseyProduct: boolean;
  priorGroup: string;
};

const OPTION_SET_SPORTS = new Set<CatalogueSport>([
  "Football",
  "Basketball",
  "Hockey",
  "Baseball",
  "Soccer"
]);

const COUNTRY_RE =
  /\b(ukraine|italy|argentina|portugal|brazil|france|spain|germany|england|scotland|wales|mexico|canada|japan|usa|australia|croatia|serbia|poland|netherlands|belgium|sweden|norway|denmark|switzerland|ireland|colombia|chile|ecuador|peru|venezuela|qatar|saudi|korea|ghana|nigeria|senegal|morocco|cameroon|austria|hungary|czech|greece|turkey|uruguay|paraguay|northern ireland|south africa|wales|hungary)\b/i;

const NBA_ALIASES: { re: RegExp; name: string }[] = [
  { re: /\bla\s+clippers\b|\blos\s+angeles\s+clippers\b/i, name: "LA Clippers" },
  { re: /\blos\s+angeles\s+lakers\b/i, name: "Los Angeles Lakers" },
  { re: /\bboston\s+celtics\b/i, name: "Boston Celtics" },
  { re: /\bchicago\s+bulls\b/i, name: "Chicago Bulls" },
  { re: /\bmiami\s+heat\b/i, name: "Miami Heat" },
  { re: /\bdetroit\s+pistons\b/i, name: "Detroit Pistons" },
  { re: /\bhouston\s+rockets\b/i, name: "Houston Rockets" },
  { re: /\bdallas\s+mavericks\b/i, name: "Dallas Mavericks" },
  { re: /\bbrooklyn\s+nets\b/i, name: "Brooklyn Nets" },
  { re: /\bnew\s+york\s+knicks\b/i, name: "New York Knicks" },
  { re: /\bgolden\s+state\s+warriors\b/i, name: "Golden State Warriors" },
  { re: /\bphiladelphia\s+(76ers|sixers)\b/i, name: "Philadelphia 76ers" },
  { re: /\btoronto\s+raptors\b/i, name: "Toronto Raptors" },
  { re: /\bmilwaukee\s+bucks\b/i, name: "Milwaukee Bucks" },
  { re: /\bphoenix\s+suns\b/i, name: "Phoenix Suns" },
  { re: /\bdenver\s+nuggets\b/i, name: "Denver Nuggets" },
  { re: /\butah\s+jazz\b/i, name: "Utah Jazz" },
  { re: /\borlando\s+magic\b/i, name: "Orlando Magic" },
  { re: /\bcharlotte\s+hornets\b/i, name: "Charlotte Hornets" },
  { re: /\bindiana\s+pacers\b/i, name: "Indiana Pacers" },
  { re: /\bcleveland\s+cavaliers\b/i, name: "Cleveland Cavaliers" },
  { re: /\boklahoma\s+city\s+thunder\b/i, name: "Oklahoma City Thunder" },
  { re: /\bminnesota\s+timberwolves\b/i, name: "Minnesota Timberwolves" },
  { re: /\bsan\s+antonio\s+spurs\b/i, name: "San Antonio Spurs" },
  { re: /\bmemphis\s+grizzlies\b/i, name: "Memphis Grizzlies" },
  { re: /\bnew\s+orleans\s+pelicans\b/i, name: "New Orleans Pelicans" },
  { re: /\batlanta\s+hawks\b/i, name: "Atlanta Hawks" },
  { re: /\bwashington\s+wizards\b/i, name: "Washington Wizards" },
  { re: /\bportland\s+trail\s+blazers\b/i, name: "Portland Trail Blazers" },
  { re: /\bsacramento\s+kings\b/i, name: "Sacramento Kings" }
];

const MLB_ALIASES: { re: RegExp; name: string }[] = [
  { re: /\bnew\s+york\s+yankees\b/i, name: "New York Yankees" },
  { re: /\bboston\s+red\s+sox\b/i, name: "Boston Red Sox" },
  { re: /\blos\s+angeles\s+dodgers\b/i, name: "Los Angeles Dodgers" },
  { re: /\bchicago\s+cubs\b/i, name: "Chicago Cubs" },
  { re: /\bchicago\s+white\s+sox\b/i, name: "Chicago White Sox" },
  { re: /\bcincinnati\s+reds\b/i, name: "Cincinnati Reds" },
  { re: /\bwashington\s+nationals\b/i, name: "Washington Nationals" },
  { re: /\btoronto\s+blue\s+jays\b/i, name: "Toronto Blue Jays" },
  { re: /\batlanta\s+braves\b/i, name: "Atlanta Braves" },
  { re: /\bhouston\s+astros\b/i, name: "Houston Astros" },
  { re: /\bseattle\s+mariners\b/i, name: "Seattle Mariners" },
  { re: /\btexas\s+rangers\b/i, name: "Texas Rangers" },
  { re: /\bphiladelphia\s+phillies\b/i, name: "Philadelphia Phillies" },
  { re: /\bsan\s+francisco\s+giants\b/i, name: "San Francisco Giants" },
  { re: /\blos\s+angeles\s+angels\b/i, name: "Los Angeles Angels" },
  { re: /\bdetroit\s+tigers\b/i, name: "Detroit Tigers" },
  { re: /\bkansas\s+city\s+royals\b/i, name: "Kansas City Royals" },
  { re: /\bmilwaukee\s+brewers\b/i, name: "Milwaukee Brewers" },
  { re: /\bst\.?\s*louis\s+cardinals\b/i, name: "St. Louis Cardinals" },
  { re: /\bpittsburgh\s+pirates\b/i, name: "Pittsburgh Pirates" },
  { re: /\bcolorado\s+rockies\b/i, name: "Colorado Rockies" },
  { re: /\barizona\s+diamondbacks\b/i, name: "Arizona Diamondbacks" },
  { re: /\bsan\s+diego\s+padres\b/i, name: "San Diego Padres" },
  { re: /\bmiami\s+marlins\b/i, name: "Miami Marlins" },
  { re: /\bbaltimore\s+orioles\b/i, name: "Baltimore Orioles" },
  { re: /\btampa\s+bay\s+rays\b/i, name: "Tampa Bay Rays" },
  { re: /\bminnesota\s+twins\b/i, name: "Minnesota Twins" },
  { re: /\bcleveland\s+guardians\b/i, name: "Cleveland Guardians" }
];

const NHL_ALIASES: { re: RegExp; name: string }[] = [
  { re: /\bvancouver\s+canucks\b/i, name: "Vancouver Canucks" },
  { re: /\bcarolina\s+hurricanes\b/i, name: "Carolina Hurricanes" },
  { re: /\bcalgary\s+flames\b/i, name: "Calgary Flames" },
  { re: /\butah\s+mammoth\b/i, name: "Utah Mammoth" },
  { re: /\btoronto\s+maple\s+leafs\b/i, name: "Toronto Maple Leafs" },
  { re: /\bmontreal\s+canadiens\b/i, name: "Montreal Canadiens" },
  { re: /\bchicago\s+blackhawks\b/i, name: "Chicago Blackhawks" },
  { re: /\bedmonton\s+oilers\b/i, name: "Edmonton Oilers" },
  { re: /\bpittsburgh\s+penguins\b/i, name: "Pittsburgh Penguins" },
  { re: /\bboston\s+bruins\b/i, name: "Boston Bruins" },
  { re: /\bnew\s+york\s+rangers\b/i, name: "New York Rangers" },
  { re: /\btampa\s+bay\s+lightning\b/i, name: "Tampa Bay Lightning" },
  { re: /\bflorida\s+panthers\b/i, name: "Florida Panthers" },
  { re: /\bwinnipeg\s+jets\b/i, name: "Winnipeg Jets" },
  { re: /\blos\s+angeles\s+kings\b/i, name: "Los Angeles Kings" },
  { re: /\bsan\s+jose\s+sharks\b/i, name: "San Jose Sharks" },
  { re: /\bvegas\s+golden\s+knights\b/i, name: "Vegas Golden Knights" },
  { re: /\bseattle\s+kraken\b/i, name: "Seattle Kraken" },
  { re: /\bminnesota\s+wild\b/i, name: "Minnesota Wild" },
  { re: /\bcolorado\s+avalanche\b/i, name: "Colorado Avalanche" },
  { re: /\bdallas\s+stars\b/i, name: "Dallas Stars" },
  { re: /\banaheim\s+ducks\b/i, name: "Anaheim Ducks" },
  { re: /\bnew\s+jersey\s+devils\b/i, name: "New Jersey Devils" },
  { re: /\bottawa\s+senators\b/i, name: "Ottawa Senators" },
  { re: /\bbuffalo\s+sabres\b/i, name: "Buffalo Sabres" },
  { re: /\bphiladelphia\s+flyers\b/i, name: "Philadelphia Flyers" },
  { re: /\bwashington\s+capitals\b/i, name: "Washington Capitals" },
  { re: /\bnashville\s+predators\b/i, name: "Nashville Predators" },
  { re: /\bst\.?\s*louis\s+blues\b/i, name: "St. Louis Blues" },
  { re: /\bcolumbus\s+blue\s+jackets\b/i, name: "Columbus Blue Jackets" },
  { re: /\bnew\s+york\s+islanders\b/i, name: "New York Islanders" },
  { re: /\bdetroit\s+red\s+wings\b/i, name: "Detroit Red Wings" }
];

const NCAA_SCHOOLS: { re: RegExp; name: string }[] = [
  { re: /\btennessee\s+volunteers\b/i, name: "Tennessee Volunteers" },
  { re: /\bmichigan\s+wolverines\b/i, name: "Michigan Wolverines" },
  { re: /\bindiana\s+hoosiers\b/i, name: "Indiana Hoosiers" },
  { re: /\bpurdue\s+boilermakers\b/i, name: "Purdue Boilermakers" },
  { re: /\bucla\s+bruins\b/i, name: "UCLA Bruins" }
];

/** Known bulk-import tag pollution — never trust over title+slug school match */
const POLLUTED_TAG_MARKERS = /\b(anthony edwards|georgia bulldogs)\b/i;

function matchOne(text: string, list: { re: RegExp; name: string }[]): string | null {
  for (const f of list) {
    if (f.re.test(text)) return f.name;
  }
  return null;
}

function tokenInSlug(slug: string, name: string): boolean {
  const slugL = slug.toLowerCase().replace(/-/g, " ");
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  return parts.some((p) => slugL.includes(p));
}

function hasSoccerSignal(tags: string[], collections: string[], title: string): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")} ${title}`.toLowerCase();
  return (
    /\bsoccer\b/.test(hay) ||
    /\bfifa\b/.test(hay) ||
    /\binternational\s+team\b/.test(hay) ||
    /\bfootball\s+kit\b/.test(hay) ||
    /\bhome\s+shirt\b|\baway\s+shirt\b/.test(hay) ||
    collections.some((c) => /\bsoccer jerseys\b/i.test(c))
  );
}

function hasBasketballSignal(tags: string[], collections: string[], title: string): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")} ${title}`.toLowerCase();
  if (/\bbaseball\b/.test(tags.join(" ").toLowerCase())) return false;
  return /\bbasketball\b/.test(hay) || collections.some((c) => /\bbasketball jerseys\b/i.test(c));
}

function hasBaseballSignal(tags: string[], collections: string[]): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return (
    /\bbaseball\b/.test(hay) ||
    /\bmajor league baseball\b/.test(hay) ||
    collections.some((c) => /\bbaseball jerseys\b/i.test(c))
  );
}

function franchiseInTags(franchise: string, tags: string[]): boolean {
  const key = franchise.toLowerCase();
  return tags.some((t) => t.toLowerCase().includes(key) || key.includes(t.toLowerCase()));
}

function resolve(
  sport: CatalogueSport,
  league: string | null,
  category: FinalUnknownCategory,
  reason: string,
  evidence: string[],
  prior: ReturnType<typeof classifyUnknownDeep>
): FinalUnknownResult {
  return {
    action: "RESOLVE",
    sport,
    league,
    category,
    reason,
    blocker: null,
    evidence,
    hasOptionSet: OPTION_SET_SPORTS.has(sport),
    isJerseyProduct: prior.isJerseyProduct,
    priorGroup: prior.group
  };
}

function block(
  category: FinalUnknownCategory,
  blocker: string,
  reason: string,
  prior: ReturnType<typeof classifyUnknownDeep>
): FinalUnknownResult {
  return {
    action: "BLOCK",
    sport: null,
    league: null,
    category,
    reason,
    blocker,
    evidence: [],
    hasOptionSet: false,
    isJerseyProduct: prior.isJerseyProduct,
    priorGroup: prior.group
  };
}

export function classifyFinalUnknown(input: UnknownDeepInput): FinalUnknownResult {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const tags = (input.tags ?? []).map(String);
  const collections = normalizeCollections(input.collections);
  const prior = classifyUnknownDeep(input);

  // ── Policy blocks (never auto-publish) ───────────────────────────────────
  if (prior.group === "high_school") {
    return block(
      "high_school_blocked",
      "no_sport_only_fulfilment_policy",
      "High-school product — sport may be inferable but no fulfilment/options policy for non-pro jerseys",
      prior
    );
  }
  if (prior.group === "non_jersey" || prior.group === "nba_non_jersey") {
    return block(
      "non_jersey_blocked",
      "no_non_jersey_option_set",
      "Shorts/toques/hats — no Aris jersey option set or non-jersey fulfilment model",
      prior
    );
  }
  if (prior.group === "movie_novelty") {
    return block(
      "movie_novelty_blocked",
      "novelty_no_league_or_options_path",
      "Movie/novelty jersey — no pro league; publish blocked without explicit fulfilment policy",
      prior
    );
  }
  if (prior.group === "garbage") {
    return block("garbage_blocked", "corrupted_listing", "Avis-option or empty listing", prior);
  }

  // ── PRIORITY 2: title/slug conflicts with title+tag corroboration ─────────
  if (prior.group.startsWith("conflict_")) {
    // College polluted tags: title school in slug, ignore Georgia pollution
    const school = matchOne(title, NCAA_SCHOOLS);
    if (
      school &&
      prior.group === "conflict_college_tags" &&
      tokenInSlug(slug, school) &&
      hasBasketballSignal(tags, collections, title) &&
      (/\bncaab\b/i.test(tags.join(" ")) ||
        collections.some((c) => /\bncaa\s*basketball\b/i.test(c)))
    ) {
      const polluted = tags.some((t) => POLLUTED_TAG_MARKERS.test(t));
      if (polluted || !tags.some((t) => t.toLowerCase().includes(school.split(" ")[0]!.toLowerCase()))) {
        return resolve(
          "Basketball",
          "NCAA",
          "conflict_college_polluted_tags",
          `Title+slug agree on ${school}; NCAAB/collection corroborate; polluted cross-school tags ignored`,
          [`school:${school}`, "slug_match", "ncaab_collection"],
          prior
        );
      }
    }

    const mlb = matchOne(title, MLB_ALIASES);
    if (mlb && prior.group === "conflict_mlb" && franchiseInTags(mlb, tags) && hasBaseballSignal(tags, collections)) {
      return resolve(
        "Baseball",
        "MLB",
        "conflict_title_tags_mlb",
        `MLB title franchise (${mlb}) corroborated by tags/collections; slug disagrees`,
        [`mlb:${mlb}`, "tags_corroborate_title"],
        prior
      );
    }

    const nhl = matchOne(title, NHL_ALIASES);
    if (nhl && prior.group === "conflict_nhl" && franchiseInTags(nhl, tags)) {
      return resolve(
        "Hockey",
        "NHL",
        "conflict_title_tags_nhl",
        `NHL title franchise (${nhl}) corroborated by tags; slug disagrees`,
        [`nhl:${nhl}`, "tags_corroborate_title"],
        prior
      );
    }

    const nba = matchOne(title, NBA_ALIASES);
    if (
      nba &&
      prior.group === "conflict_nba" &&
      franchiseInTags(nba, tags) &&
      hasBasketballSignal(tags, collections, title)
    ) {
      return resolve(
        "Basketball",
        "NBA",
        "conflict_title_tags_nba",
        `NBA title franchise (${nba}) corroborated by tags/collections; slug disagrees`,
        [`nba:${nba}`, "tags_corroborate_title"],
        prior
      );
    }

    return block(
      "conflict_unresolved",
      "title_slug_conflict_no_decisive_tags",
      `Title/slug conflict (${prior.group}) without exclusive tag corroboration of title`,
      prior
    );
  }

  // ── PRIORITY 1: tags_only soccer — country/title + soccer tags/collections
  if (prior.group === "tags_only" || prior.group === "sport_only") {
    const countryMatch = title.match(COUNTRY_RE);
    const country = countryMatch?.[0] ?? null;
    const countryInTags = country
      ? tags.some((t) => t.toLowerCase().includes(country.toLowerCase()))
      : false;
    const fifaSignal = tags.some((t) => /\bfifa\b/i.test(t)) || collections.some((c) => /\bfifa\b/i.test(c));
    const soccerCol = collections.some((c) => /\bsoccer jerseys\b/i.test(c));
    const soccerTag = tags.some((t) => /\bsoccer\b/i.test(t));
    const intlTag = tags.some((t) => /\binternational team\b/i.test(t));

    if (
      country &&
      hasSoccerSignal(tags, collections, title) &&
      ((countryInTags && (soccerTag || intlTag)) ||
        (fifaSignal && (soccerTag || soccerCol)) ||
        (/\bsoccer\b/i.test(title) && (soccerTag || soccerCol)))
    ) {
      const league =
        fifaSignal || /\bfifa|world cup\b/i.test(title) ? "FIFA World Cup" : "International";
      return resolve(
        "Soccer",
        league,
        "tags_only_soccer",
        `Country (${country}) in title + independent soccer/FIFA tags or collections`,
        [`country:${country}`, fifaSignal ? "fifa_signal" : "soccer_tags"],
        prior
      );
    }

    const nba = matchOne(title, NBA_ALIASES);
    if (nba && hasBasketballSignal(tags, collections, title)) {
      const teamCol = collections.some((c) => new RegExp(nba.split(" ").pop()!, "i").test(c));
      const basketballJerseysCol = collections.some((c) => /\bbasketball jerseys\b/i.test(c));
      if (franchiseInTags(nba, tags) || teamCol || basketballJerseysCol) {
        return resolve(
          "Basketball",
          "NBA",
          "tags_only_nba",
          `NBA franchise (${nba}) in title + basketball tags/collection corroboration`,
          [
            `nba:${nba}`,
            franchiseInTags(nba, tags)
              ? "franchise_tag"
              : teamCol
                ? "team_collection"
                : "basketball_jerseys_collection"
          ],
          prior
        );
      }
    }
  }

  return block(
    "insufficient_evidence",
    prior.reason || "insufficient_dual_evidence",
    `No >=2 independent signals (${prior.group})`,
    prior
  );
}

export { normalizeCollections };
