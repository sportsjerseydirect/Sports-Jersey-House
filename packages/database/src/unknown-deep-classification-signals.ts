/**
 * Deep classification for UNKNOWN catalogue drafts.
 * HIGH = multiple independent signals agree. Never guess from bare ambiguous tokens.
 */
import type { CatalogueSport } from "./college-international-signals";

export type EvidenceTier = "HIGH" | "MEDIUM" | "LOW" | "CONFLICT";

export type UnknownDeepResult = {
  tier: EvidenceTier;
  sport: CatalogueSport | null;
  league: string | null;
  reason: string;
  evidence: string[];
  hasOptionSet: boolean;
  isJerseyProduct: boolean;
  group: string;
};

const OPTION_SET_SPORTS = new Set<CatalogueSport>([
  "Football",
  "Basketball",
  "Hockey",
  "Baseball",
  "Soccer"
]);

/** Full franchise names only — never bare Bucks/Giants/Rangers/etc. */
const NBA_FRANCHISES: { re: RegExp; name: string }[] = [
  { re: /\blos\s+angeles\s+lakers\b/i, name: "Los Angeles Lakers" },
  { re: /\bboston\s+celtics\b/i, name: "Boston Celtics" },
  { re: /\bchicago\s+bulls\b/i, name: "Chicago Bulls" },
  { re: /\bgolden\s+state\s+warriors\b/i, name: "Golden State Warriors" },
  { re: /\bbrooklyn\s+nets\b/i, name: "Brooklyn Nets" },
  { re: /\bnew\s+york\s+knicks\b/i, name: "New York Knicks" },
  { re: /\bmiami\s+heat\b/i, name: "Miami Heat" },
  { re: /\bmilwaukee\s+bucks\b/i, name: "Milwaukee Bucks" },
  { re: /\bphoenix\s+suns\b/i, name: "Phoenix Suns" },
  { re: /\bdenver\s+nuggets\b/i, name: "Denver Nuggets" },
  { re: /\bdallas\s+mavericks\b/i, name: "Dallas Mavericks" },
  { re: /\blos\s+angeles\s+clippers\b/i, name: "Los Angeles Clippers" },
  { re: /\bphiladelphia\s+(76ers|sixers)\b/i, name: "Philadelphia 76ers" },
  { re: /\btoronto\s+raptors\b/i, name: "Toronto Raptors" },
  { re: /\bdetroit\s+pistons\b/i, name: "Detroit Pistons" },
  { re: /\batlanta\s+hawks\b/i, name: "Atlanta Hawks" },
  { re: /\bcharlotte\s+hornets\b/i, name: "Charlotte Hornets" },
  { re: /\bwashington\s+wizards\b/i, name: "Washington Wizards" },
  { re: /\borlando\s+magic\b/i, name: "Orlando Magic" },
  { re: /\bindiana\s+pacers\b/i, name: "Indiana Pacers" },
  { re: /\bcleveland\s+cavaliers\b/i, name: "Cleveland Cavaliers" },
  { re: /\bmemphis\s+grizzlies\b/i, name: "Memphis Grizzlies" },
  { re: /\bnew\s+orleans\s+pelicans\b/i, name: "New Orleans Pelicans" },
  { re: /\bsan\s+antonio\s+spurs\b/i, name: "San Antonio Spurs" },
  { re: /\bhouston\s+rockets\b/i, name: "Houston Rockets" },
  { re: /\boklahoma\s+city\s+thunder\b/i, name: "Oklahoma City Thunder" },
  { re: /\bminnesota\s+timberwolves\b/i, name: "Minnesota Timberwolves" },
  { re: /\bportland\s+trail\s+blazers\b/i, name: "Portland Trail Blazers" },
  { re: /\bsacramento\s+kings\b/i, name: "Sacramento Kings" },
  { re: /\butah\s+jazz\b/i, name: "Utah Jazz" }
];

const MLB_FRANCHISES: { re: RegExp; name: string }[] = [
  { re: /\bnew\s+york\s+yankees\b/i, name: "New York Yankees" },
  { re: /\bboston\s+red\s+sox\b/i, name: "Boston Red Sox" },
  { re: /\blos\s+angeles\s+dodgers\b/i, name: "Los Angeles Dodgers" },
  { re: /\bnew\s+york\s+mets\b/i, name: "New York Mets" },
  { re: /\bchicago\s+cubs\b/i, name: "Chicago Cubs" },
  { re: /\bchicago\s+white\s+sox\b/i, name: "Chicago White Sox" },
  { re: /\batlanta\s+braves\b/i, name: "Atlanta Braves" },
  { re: /\bphiladelphia\s+phillies\b/i, name: "Philadelphia Phillies" },
  { re: /\bhouston\s+astros\b/i, name: "Houston Astros" },
  { re: /\bseattle\s+mariners\b/i, name: "Seattle Mariners" },
  { re: /\btexas\s+rangers\b/i, name: "Texas Rangers" },
  { re: /\b(oakland\s+)?athletics\b|\boakland\s+a'?s\b/i, name: "Athletics" },
  { re: /\bbaltimore\s+orioles\b/i, name: "Baltimore Orioles" },
  { re: /\btampa\s+bay\s+rays\b/i, name: "Tampa Bay Rays" },
  { re: /\btoronto\s+blue\s+jays\b/i, name: "Toronto Blue Jays" },
  { re: /\bminnesota\s+twins\b/i, name: "Minnesota Twins" },
  { re: /\bcleveland\s+guardians\b/i, name: "Cleveland Guardians" },
  { re: /\bdetroit\s+tigers\b/i, name: "Detroit Tigers" },
  { re: /\bkansas\s+city\s+royals\b/i, name: "Kansas City Royals" },
  { re: /\bmilwaukee\s+brewers\b/i, name: "Milwaukee Brewers" },
  { re: /\bst\.?\s*louis\s+cardinals\b/i, name: "St. Louis Cardinals" },
  { re: /\bcincinnati\s+reds\b/i, name: "Cincinnati Reds" },
  { re: /\bpittsburgh\s+pirates\b/i, name: "Pittsburgh Pirates" },
  { re: /\bcolorado\s+rockies\b/i, name: "Colorado Rockies" },
  { re: /\barizona\s+diamondbacks\b/i, name: "Arizona Diamondbacks" },
  { re: /\bsan\s+diego\s+padres\b/i, name: "San Diego Padres" },
  { re: /\bsan\s+francisco\s+giants\b/i, name: "San Francisco Giants" },
  { re: /\blos\s+angeles\s+angels\b/i, name: "Los Angeles Angels" },
  { re: /\bmiami\s+marlins\b/i, name: "Miami Marlins" },
  { re: /\bwashington\s+nationals\b/i, name: "Washington Nationals" }
];

const NHL_FRANCHISES: { re: RegExp; name: string }[] = [
  { re: /\btoronto\s+maple\s+leafs\b/i, name: "Toronto Maple Leafs" },
  { re: /\bmontreal\s+canadiens\b/i, name: "Montreal Canadiens" },
  { re: /\bchicago\s+blackhawks\b/i, name: "Chicago Blackhawks" },
  { re: /\bdetroit\s+red\s+wings\b/i, name: "Detroit Red Wings" },
  { re: /\bedmonton\s+oilers\b/i, name: "Edmonton Oilers" },
  { re: /\bcalgary\s+flames\b/i, name: "Calgary Flames" },
  { re: /\bvancouver\s+canucks\b/i, name: "Vancouver Canucks" },
  { re: /\bwinnipeg\s+jets\b/i, name: "Winnipeg Jets" },
  { re: /\bottawa\s+senators\b/i, name: "Ottawa Senators" },
  { re: /\bbuffalo\s+sabres\b/i, name: "Buffalo Sabres" },
  { re: /\bnew\s+jersey\s+devils\b/i, name: "New Jersey Devils" },
  { re: /\bnew\s+york\s+islanders\b/i, name: "New York Islanders" },
  { re: /\bphiladelphia\s+flyers\b/i, name: "Philadelphia Flyers" },
  { re: /\bwashington\s+capitals\b/i, name: "Washington Capitals" },
  { re: /\btampa\s+bay\s+lightning\b/i, name: "Tampa Bay Lightning" },
  { re: /\bflorida\s+panthers\b/i, name: "Florida Panthers" },
  { re: /\bcolumbus\s+blue\s+jackets\b/i, name: "Columbus Blue Jackets" },
  { re: /\bnashville\s+predators\b/i, name: "Nashville Predators" },
  { re: /\bdallas\s+stars\b/i, name: "Dallas Stars" },
  { re: /\bst\.?\s*louis\s+blues\b/i, name: "St. Louis Blues" },
  { re: /\bminnesota\s+wild\b/i, name: "Minnesota Wild" },
  { re: /\bcolorado\s+avalanche\b/i, name: "Colorado Avalanche" },
  { re: /\banaheim\s+ducks\b/i, name: "Anaheim Ducks" },
  { re: /\blos\s+angeles\s+kings\b/i, name: "Los Angeles Kings" },
  { re: /\bsan\s+jose\s+sharks\b/i, name: "San Jose Sharks" },
  { re: /\bseattle\s+kraken\b/i, name: "Seattle Kraken" },
  { re: /\bvegas\s+golden\s+knights\b/i, name: "Vegas Golden Knights" },
  { re: /\b(arizona|utah)\s+coyotes\b/i, name: "Coyotes" },
  { re: /\butah\s+mammoth\b/i, name: "Utah Mammoth" },
  { re: /\bpittsburgh\s+penguins\b/i, name: "Pittsburgh Penguins" },
  { re: /\bboston\s+bruins\b/i, name: "Boston Bruins" },
  { re: /\bnew\s+york\s+rangers\b/i, name: "New York Rangers" },
  { re: /\bcarolina\s+hurricanes\b/i, name: "Carolina Hurricanes" }
];

const NFL_FRANCHISES: { re: RegExp; name: string }[] = [
  { re: /\bgreen\s+bay\s+packers\b/i, name: "Green Bay Packers" },
  { re: /\bdallas\s+cowboys\b/i, name: "Dallas Cowboys" },
  { re: /\bnew\s+england\s+patriots\b/i, name: "New England Patriots" },
  { re: /\bkansas\s+city\s+chiefs\b/i, name: "Kansas City Chiefs" },
  { re: /\bsan\s+francisco\s+49ers\b/i, name: "San Francisco 49ers" },
  { re: /\bpittsburgh\s+steelers\b/i, name: "Pittsburgh Steelers" },
  { re: /\bbaltimore\s+ravens\b/i, name: "Baltimore Ravens" },
  { re: /\bbuffalo\s+bills\b/i, name: "Buffalo Bills" },
  { re: /\bmiami\s+dolphins\b/i, name: "Miami Dolphins" },
  { re: /\bwashington\s+commanders\b/i, name: "Washington Commanders" },
  { re: /\bminnesota\s+vikings\b/i, name: "Minnesota Vikings" },
  { re: /\bnew\s+orleans\s+saints\b/i, name: "New Orleans Saints" },
  { re: /\btampa\s+bay\s+buccaneers\b/i, name: "Tampa Bay Buccaneers" },
  { re: /\bhouston\s+texans\b/i, name: "Houston Texans" },
  { re: /\bindianapolis\s+colts\b/i, name: "Indianapolis Colts" },
  { re: /\bjacksonville\s+jaguars\b/i, name: "Jacksonville Jaguars" },
  { re: /\btennessee\s+titans\b/i, name: "Tennessee Titans" },
  { re: /\bdenver\s+broncos\b/i, name: "Denver Broncos" },
  { re: /\blas\s+vegas\s+raiders\b/i, name: "Las Vegas Raiders" },
  { re: /\blos\s+angeles\s+chargers\b/i, name: "Los Angeles Chargers" },
  { re: /\bcincinnati\s+bengals\b/i, name: "Cincinnati Bengals" },
  { re: /\bcleveland\s+browns\b/i, name: "Cleveland Browns" },
  { re: /\bseattle\s+seahawks\b/i, name: "Seattle Seahawks" },
  { re: /\blos\s+angeles\s+rams\b/i, name: "Los Angeles Rams" },
  { re: /\bphiladelphia\s+eagles\b/i, name: "Philadelphia Eagles" },
  { re: /\bnew\s+york\s+giants\b/i, name: "New York Giants" },
  { re: /\bchicago\s+bears\b/i, name: "Chicago Bears" },
  { re: /\bdetroit\s+lions\b/i, name: "Detroit Lions" },
  { re: /\barizona\s+cardinals\b/i, name: "Arizona Cardinals" },
  { re: /\batlanta\s+falcons\b/i, name: "Atlanta Falcons" },
  { re: /\bcarolina\s+panthers\b/i, name: "Carolina Panthers" },
  { re: /\bnew\s+york\s+jets\b/i, name: "New York Jets" }
];

const SOCCER_CLUBS: { re: RegExp; name: string }[] = [
  { re: /\bmanchester\s+city\b/i, name: "Manchester City" },
  { re: /\bmanchester\s+united\b/i, name: "Manchester United" },
  { re: /\bliverpool\b/i, name: "Liverpool" },
  { re: /\barsenal\b/i, name: "Arsenal" },
  { re: /\bchelsea\b/i, name: "Chelsea" },
  { re: /\btottenham(\s+hotspur)?\b/i, name: "Tottenham" },
  { re: /\breal\s+madrid\b/i, name: "Real Madrid" },
  { re: /\b(fc\s+)?barcelona\b|\bbarça\b/i, name: "Barcelona" },
  { re: /\batl[eé]tico\s+madrid\b/i, name: "Atletico Madrid" },
  { re: /\bjuventus\b/i, name: "Juventus" },
  { re: /\binter\s+milan\b|\binternazionale\b/i, name: "Inter Milan" },
  { re: /\bac\s+milan\b/i, name: "AC Milan" },
  { re: /\bbayern(\s+munich)?\b/i, name: "Bayern Munich" },
  { re: /\bparis\s+saint[- ]germain\b|\bpsg\b/i, name: "PSG" },
  { re: /\bnapoli\b/i, name: "Napoli" },
  { re: /\bas\s+roma\b|\broma\s+fc\b/i, name: "Roma" },
  { re: /\bborussia\s+dortmund\b/i, name: "Borussia Dortmund" },
  { re: /\beverton\b/i, name: "Everton" },
  { re: /\bnewcastle(\s+united)?\b/i, name: "Newcastle" },
  { re: /\binter\s+miami\b/i, name: "Inter Miami" },
  { re: /\bla\s+galaxy\b/i, name: "LA Galaxy" },
  { re: /\bseattle\s+sounders\b/i, name: "Seattle Sounders" },
  { re: /\batlanta\s+united\b/i, name: "Atlanta United" },
  { re: /\bnew\s+york\s+city\s+fc\b|\bnycfc\b/i, name: "NYCFC" },
  { re: /\btoronto\s+fc\b/i, name: "Toronto FC" },
  { re: /\bajax\b/i, name: "Ajax" },
  { re: /\bporto\b/i, name: "Porto" },
  { re: /\bbenfica\b/i, name: "Benfica" }
];

const NCAA_BASKETBALL_SCHOOLS: { re: RegExp; name: string }[] = [
  { re: /\btennessee\s+volunteers\b/i, name: "Tennessee Volunteers" },
  { re: /\barizona\s+wildcats\b/i, name: "Arizona Wildcats" },
  { re: /\bgonzaga\s+bulldogs\b/i, name: "Gonzaga Bulldogs" },
  { re: /\bucla\b/i, name: "UCLA" },
  { re: /\bduke\s+blue\s+devils\b|\bduke\b(?!\s+university)/i, name: "Duke" },
  { re: /\bnorth\s+carolina\s+tar\s+heels\b|\bunc\s+tar\s+heels\b/i, name: "North Carolina" },
  { re: /\bkentucky\s+wildcats\b/i, name: "Kentucky Wildcats" },
  { re: /\bkansas\s+jayhawks\b/i, name: "Kansas Jayhawks" },
  { re: /\bmichigan\s+wolverines\b/i, name: "Michigan Wolverines" },
  { re: /\bindiana\s+hoosiers\b/i, name: "Indiana Hoosiers" },
  { re: /\bpurdue\s+boilermakers\b/i, name: "Purdue Boilermakers" },
  { re: /\bbaylor\s+bears\b/i, name: "Baylor Bears" },
  { re: /\bvillanova\s+wildcats\b/i, name: "Villanova Wildcats" },
  { re: /\bgeorgetown\s+hoyas\b/i, name: "Georgetown Hoyas" },
  { re: /\bsyracuse\s+orange\b/i, name: "Syracuse Orange" },
  { re: /\balabama\s+crimson\s+tide\b/i, name: "Alabama Crimson Tide" },
  { re: /\bgeorgia\s+bulldogs\b/i, name: "Georgia Bulldogs" },
  { re: /\bohio\s+state\s+buckeyes\b/i, name: "Ohio State Buckeyes" }
];

const NCAA_FOOTBALL_SCHOOLS: { re: RegExp; name: string }[] = [
  { re: /\balabama\s+crimson(\s+tide)?\b/i, name: "Alabama" },
  { re: /\bpurdue\s+boilermakers\b/i, name: "Purdue Boilermakers" },
  { re: /\bohio\s+state\s+buckeyes\b/i, name: "Ohio State" },
  { re: /\bmichigan\s+wolverines\b/i, name: "Michigan" },
  { re: /\bgeorgia\s+bulldogs\b/i, name: "Georgia Bulldogs" },
  { re: /\bnotre\s+dame(\s+fighting\s+irish)?\b/i, name: "Notre Dame" },
  { re: /\btexas\s+longhorns\b/i, name: "Texas Longhorns" },
  { re: /\busc\s+trojans\b|\bsouthern\s+california\s+trojans\b/i, name: "USC Trojans" }
];

function matchFranchise(
  text: string,
  list: { re: RegExp; name: string }[]
): string | null {
  for (const f of list) {
    if (f.re.test(text)) return f.name;
  }
  return null;
}

function matchAllFranchises(text: string, list: { re: RegExp; name: string }[]): string[] {
  const hits: string[] = [];
  for (const f of list) {
    if (f.re.test(text)) hits.push(f.name);
  }
  return [...new Set(hits)];
}

function hasBasketballSignal(tags: string[], collections: string[]): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\bbasketball\b/.test(hay);
}

function hasBaseballSignal(tags: string[], collections: string[]): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\bbaseball\b|\bmajor league baseball\b|\bmlb\b/.test(hay);
}

function hasHockeySignal(tags: string[], collections: string[]): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\bhockey\b|\bnhl\b/.test(hay);
}

function hasFootballSignal(tags: string[], collections: string[]): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\bfootball\b/.test(hay) && !/\bsoccer\b/.test(hay);
}

function hasSoccerSignal(tags: string[], collections: string[], title = ""): boolean {
  const hay = `${tags.join(" ")} ${collections.join(" ")} ${title}`.toLowerCase();
  return (
    /\bsoccer\b/.test(hay) ||
    /\bfifa\b/.test(hay) ||
    /\bclub teams\b/.test(hay) ||
    /\bnational football team\b/.test(hay) ||
    /\bworld\s+cup\b/.test(hay)
  );
}

function isJerseyLike(title: string, productType: string | null): boolean {
  const t = title.toLowerCase();
  if (/\b(shorts|toque|beanie|patch|hoodie|pants|hat)\b/.test(t)) return false;
  if (/^name$/i.test(title.trim())) return false;
  if (/^add patch/i.test(title.trim())) return false;
  if (/avis-option|avisplus/i.test(title)) return false;
  if (productType && /short/i.test(productType) && !/jersey/i.test(t)) return false;
  return /\bjersey\b|\bkit\b|\bswingman\b|\bbreakaway\b|\bauthentic\b/i.test(t) || /jersey/i.test(productType ?? "");
}

function isMovieOrNovelty(title: string, tags: string[], collections: string[]): boolean {
  const hay = `${title} ${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\b(movie|space jam|tune squad|above the rim|one tree hill|family matters|sandlot|rockford peaches|milwaukee beers|average joe|ovo jersey|graduation album|kanye|tupac|drake #|king james 23)\b/i.test(
    hay
  );
}

function isHighSchool(title: string, tags: string[], collections: string[]): boolean {
  const hay = `${title} ${tags.join(" ")} ${collections.join(" ")}`.toLowerCase();
  return /\bhigh school\b/.test(hay);
}

function conflictingSchoolsInTags(title: string, tags: string[]): boolean {
  const titleSchools = matchAllFranchises(title, [
    ...NCAA_BASKETBALL_SCHOOLS,
    ...NCAA_FOOTBALL_SCHOOLS,
    { re: /\bgeorgia\s+bulldogs\b/i, name: "Georgia Bulldogs" },
    { re: /\btennessee\s+volunteers\b/i, name: "Tennessee Volunteers" }
  ]);
  const tagText = tags.join(" ");
  const tagSchools = matchAllFranchises(tagText, [
    ...NCAA_BASKETBALL_SCHOOLS,
    ...NCAA_FOOTBALL_SCHOOLS,
    { re: /\bgeorgia\s+bulldogs\b/i, name: "Georgia Bulldogs" },
    { re: /\btennessee\s+volunteers\b/i, name: "Tennessee Volunteers" }
  ]);
  if (titleSchools.length === 0 || tagSchools.length === 0) return false;
  return !titleSchools.some((s) => tagSchools.includes(s));
}

export type UnknownDeepInput = {
  title: string;
  slug: string;
  tags?: string[];
  collections?: string[];
  productType?: string | null;
  vendor?: string | null;
  team?: string | null;
};

export function classifyUnknownDeep(input: UnknownDeepInput): UnknownDeepResult {
  const title = input.title.trim();
  const slug = input.slug.trim();
  const tags = (input.tags ?? []).map(String);
  const collections = (input.collections ?? []).map(String);
  const productType = input.productType ?? null;
  const jersey = isJerseyLike(title, productType);
  const evidence: string[] = [];

  const done = (
    tier: EvidenceTier,
    sport: CatalogueSport | null,
    league: string | null,
    reason: string,
    group: string
  ): UnknownDeepResult => ({
    tier,
    sport,
    league,
    reason,
    evidence,
    hasOptionSet: sport !== null && OPTION_SET_SPORTS.has(sport),
    isJerseyProduct: jersey,
    group
  });

  if (!title || /^name$/i.test(title) || /avisplus-product-options/i.test(tags.join(" "))) {
    if (/^name$/i.test(title) || /^add patch/i.test(title) || /avis-option/i.test(slug)) {
      return done("LOW", null, null, "Corrupted/avis option listing — not a sellable jersey", "garbage");
    }
  }

  if (!jersey) {
    const nba = matchFranchise(title, NBA_FRANCHISES);
    if (nba && hasBasketballSignal(tags, collections)) {
      return done(
        "MEDIUM",
        "Basketball",
        "NBA",
        `Non-jersey product with NBA franchise (${nba}) — classify deferred for publish`,
        "nba_non_jersey"
      );
    }
    return done("LOW", null, null, "Non-jersey product type (shorts/toque/other)", "non_jersey");
  }

  if (isMovieOrNovelty(title, tags, collections)) {
    if (hasBasketballSignal(tags, collections)) {
      return done(
        "MEDIUM",
        "Basketball",
        null,
        "Movie/novelty basketball — sport clear, league not assigned",
        "movie_novelty"
      );
    }
    if (hasBaseballSignal(tags, collections)) {
      return done(
        "MEDIUM",
        "Baseball",
        null,
        "Movie/novelty baseball — sport clear, league not assigned",
        "movie_novelty"
      );
    }
    return done("LOW", null, null, "Movie/novelty without decisive sport corroboration", "movie_novelty");
  }

  if (isHighSchool(title, tags, collections)) {
    if (hasBasketballSignal(tags, collections)) {
      return done(
        "MEDIUM",
        "Basketball",
        null,
        "High school basketball — sport clear, no pro/NCAA league",
        "high_school"
      );
    }
    if (hasBaseballSignal(tags, collections)) {
      return done(
        "MEDIUM",
        "Baseball",
        null,
        "High school baseball — sport clear, no pro league",
        "high_school"
      );
    }
    return done("LOW", null, null, "High school without sport corroboration", "high_school");
  }

  // Title vs slug franchise conflict across leagues
  const titleNba = matchAllFranchises(title, NBA_FRANCHISES);
  const slugNba = matchAllFranchises(slug.replace(/-/g, " "), NBA_FRANCHISES);
  if (titleNba.length && slugNba.length && !titleNba.some((n) => slugNba.includes(n))) {
    return done(
      "CONFLICT",
      null,
      null,
      `NBA franchise title (${titleNba.join(",")}) vs slug (${slugNba.join(",")})`,
      "conflict_nba"
    );
  }
  const titleMlb = matchAllFranchises(title, MLB_FRANCHISES);
  const slugMlb = matchAllFranchises(slug.replace(/-/g, " "), MLB_FRANCHISES);
  if (titleMlb.length && slugMlb.length && !titleMlb.some((n) => slugMlb.includes(n))) {
    return done(
      "CONFLICT",
      null,
      null,
      `MLB franchise title (${titleMlb.join(",")}) vs slug (${slugMlb.join(",")})`,
      "conflict_mlb"
    );
  }
  const titleNhl = matchAllFranchises(title, NHL_FRANCHISES);
  const slugNhl = matchAllFranchises(slug.replace(/-/g, " "), NHL_FRANCHISES);
  if (titleNhl.length && slugNhl.length && !titleNhl.some((n) => slugNhl.includes(n))) {
    return done(
      "CONFLICT",
      null,
      null,
      `NHL franchise title (${titleNhl.join(",")}) vs slug (${slugNhl.join(",")})`,
      "conflict_nhl"
    );
  }
  const titleNfl = matchAllFranchises(title, NFL_FRANCHISES);
  const slugNfl = matchAllFranchises(slug.replace(/-/g, " "), NFL_FRANCHISES);
  if (titleNfl.length && slugNfl.length && !titleNfl.some((n) => slugNfl.includes(n))) {
    return done(
      "CONFLICT",
      null,
      null,
      `NFL franchise title (${titleNfl.join(",")}) vs slug (${slugNfl.join(",")})`,
      "conflict_nfl"
    );
  }

  if (conflictingSchoolsInTags(title, tags)) {
    return done(
      "CONFLICT",
      null,
      null,
      "College school in title disagrees with school tokens in tags",
      "conflict_college_tags"
    );
  }

  // ── NBA HIGH ────────────────────────────────────────────────────────────
  const nba = matchFranchise(title, NBA_FRANCHISES);
  if (nba && hasBasketballSignal(tags, collections)) {
    evidence.push(`nba_franchise:${nba}`, "basketball_tags_or_collections");
    return done("HIGH", "Basketball", "NBA", `Full NBA franchise (${nba}) + basketball tags/collections`, "nba");
  }
  if (nba && !hasBasketballSignal(tags, collections)) {
    return done("MEDIUM", "Basketball", "NBA", `NBA franchise (${nba}) without basketball tag/collection corroboration`, "nba");
  }

  // ── MLB HIGH ────────────────────────────────────────────────────────────
  const mlb = matchFranchise(title, MLB_FRANCHISES);
  const mlbLeagueTag = /\bmajor league baseball\b|\bmlb\b/i.test(tags.join(" ")) || /\bmlb\b/i.test(collections.join(" "));
  if (mlb && (hasBaseballSignal(tags, collections) || mlbLeagueTag)) {
    evidence.push(`mlb_franchise:${mlb}`, "baseball_tags_or_collections");
    return done("HIGH", "Baseball", "MLB", `Full MLB franchise (${mlb}) + baseball/MLB tags/collections`, "mlb");
  }
  if (mlb) {
    return done("MEDIUM", "Baseball", "MLB", `MLB franchise (${mlb}) without baseball corroboration`, "mlb");
  }

  // ── NHL HIGH ────────────────────────────────────────────────────────────
  const nhl = matchFranchise(title, NHL_FRANCHISES);
  if (nhl) {
    const conflictingSportTag = /\b(baseball|basketball|football|soccer)\b/i.test(tags.join(" ")) &&
      !/\bhockey\b/i.test(tags.join(" "));
    const franchiseInTags = matchFranchise(tags.join(" "), NHL_FRANCHISES) === nhl;
    if (hasHockeySignal(tags, collections) || /penguins jerseys|hockey/i.test(collections.join(" "))) {
      evidence.push(`nhl_franchise:${nhl}`, "hockey_tags_or_collections");
      return done("HIGH", "Hockey", "NHL", `Full NHL franchise (${nhl}) + hockey tags/collections`, "nhl");
    }
    if (collections.some((c) => new RegExp(nhl.split(" ").pop()!, "i").test(c))) {
      evidence.push(`nhl_franchise:${nhl}`, "team_collection");
      return done("HIGH", "Hockey", "NHL", `Full NHL franchise (${nhl}) + matching team collection`, "nhl");
    }
    // Distinctive NHL franchise in title + same franchise in tags (Flames/Oilers/etc. are uniquely hockey)
    if (franchiseInTags && !conflictingSportTag) {
      evidence.push(`nhl_franchise:${nhl}`, "franchise_tag_corroboration");
      return done(
        "HIGH",
        "Hockey",
        "NHL",
        `Full NHL franchise (${nhl}) in title and tags — uniquely hockey identity`,
        "nhl"
      );
    }
    return done("MEDIUM", "Hockey", "NHL", `NHL franchise (${nhl}) without hockey corroboration`, "nhl");
  }

  // ── NFL HIGH ────────────────────────────────────────────────────────────
  const nfl = matchFranchise(title, NFL_FRANCHISES);
  if (nfl && hasFootballSignal(tags, collections)) {
    evidence.push(`nfl_franchise:${nfl}`, "football_tags_or_collections");
    return done("HIGH", "Football", "NFL", `Full NFL franchise (${nfl}) + football tags/collections`, "nfl");
  }
  if (nfl) {
    return done("MEDIUM", "Football", "NFL", `NFL franchise (${nfl}) without football corroboration`, "nfl");
  }

  // ── Soccer club HIGH ────────────────────────────────────────────────────
  const club = matchFranchise(title, SOCCER_CLUBS);
  if (club && hasSoccerSignal(tags, collections, title)) {
    evidence.push(`soccer_club:${club}`, "soccer_tags_or_collections");
    return done("HIGH", "Soccer", null, `Soccer club (${club}) + soccer tags/collections`, "soccer_club");
  }
  if (club) {
    return done("MEDIUM", "Soccer", null, `Soccer club (${club}) without soccer corroboration`, "soccer_club");
  }

  // ── FIFA / national team HIGH ───────────────────────────────────────────
  if (/\bfifa(\s+x)?\s+world\s+cup\b/i.test(title) && hasSoccerSignal(tags, collections, title)) {
    evidence.push("fifa_world_cup_title", "soccer_signal");
    return done(
      "HIGH",
      "Soccer",
      "FIFA World Cup",
      "FIFA World Cup in title + soccer tags/collections",
      "fifa"
    );
  }
  if (/\bnational\s+team\b/i.test(title) && hasSoccerSignal(tags, collections, title)) {
    const countryTag = tags.some((t) => /national/i.test(t));
    if (countryTag || /\bfifa\b/i.test(tags.join(" "))) {
      evidence.push("national_team_title", "soccer_signal");
      return done(
        "HIGH",
        "Soccer",
        /\bfifa|world\s+cup/i.test(`${title} ${tags.join(" ")}`) ? "FIFA World Cup" : "International",
        "National team title + soccer tags/collections",
        "national_team"
      );
    }
    return done(
      "MEDIUM",
      "Soccer",
      "International",
      "National team title with soccer signal but weak country tag corroboration",
      "national_team"
    );
  }

  // ── Team USA / Olympic basketball HIGH ──────────────────────────────────
  if (
    (/\bteam\s+usa\b/i.test(title) || /\bolympic\b/i.test(title) || /\bfiba\b/i.test(title)) &&
    hasBasketballSignal(tags, collections) &&
    !/\bfootball\b/i.test(title)
  ) {
    evidence.push("intl_basketball_title", "basketball_signal");
    return done(
      "HIGH",
      "Basketball",
      "International",
      "Team USA/Olympic/FIBA basketball + basketball tags/collections",
      "intl_basketball"
    );
  }

  // ── NCAA basketball HIGH ────────────────────────────────────────────────
  const ncaaB = matchFranchise(title, NCAA_BASKETBALL_SCHOOLS);
  const ncaaBasketCol =
    /\bncaa\s*b|\bncaab\b|ncaa basketball/i.test(`${tags.join(" ")} ${collections.join(" ")}`);
  if (ncaaB && hasBasketballSignal(tags, collections) && ncaaBasketCol) {
    evidence.push(`ncaa_school:${ncaaB}`, "ncaa_basketball_collection_or_tag");
    return done(
      "HIGH",
      "Basketball",
      "NCAA",
      `College school (${ncaaB}) + basketball + NCAA basketball collection/tag`,
      "ncaa_basketball"
    );
  }
  if (ncaaB && hasBasketballSignal(tags, collections)) {
    return done(
      "MEDIUM",
      "Basketball",
      "NCAA",
      `College school (${ncaaB}) + basketball without NCAA collection corroboration`,
      "ncaa_basketball"
    );
  }

  // ── NCAA football HIGH ──────────────────────────────────────────────────
  const ncaaF = matchFranchise(title, NCAA_FOOTBALL_SCHOOLS);
  const ncaaFootTag = /\bncaaf\b|\bncaa\s*f|ncaa football/i.test(`${tags.join(" ")} ${collections.join(" ")}`);
  if (ncaaF && hasFootballSignal(tags, collections) && (ncaaFootTag || /\bncaa\b/i.test(tags.join(" ")))) {
    evidence.push(`ncaa_fb_school:${ncaaF}`, "football_signal");
    return done(
      "HIGH",
      "Football",
      "NCAA",
      `College football school (${ncaaF}) + football tags + NCAA signal`,
      "ncaa_football"
    );
  }
  if (ncaaF && hasFootballSignal(tags, collections)) {
    return done(
      "MEDIUM",
      "Football",
      "NCAA",
      `College school (${ncaaF}) + football without NCAA tag`,
      "ncaa_football"
    );
  }

  // ── International hockey (Team Canada etc.) ─────────────────────────────
  if (
    (/\bteam\s+canada\b|\burss\b|\bcccp\b|\bolympic\b/i.test(title) || /\bnational\s+team\b/i.test(title)) &&
    hasHockeySignal(tags, collections)
  ) {
    evidence.push("intl_hockey", "hockey_signal");
    return done(
      "HIGH",
      "Hockey",
      "International",
      "International/olympic hockey title + hockey tags/collections",
      "intl_hockey"
    );
  }

  // Sport-only signals without franchise
  if (hasBasketballSignal(tags, collections) && /\bbasketball\b/i.test(title)) {
    return done("MEDIUM", "Basketball", null, "Basketball wording + tags without franchise", "sport_only");
  }
  if (hasBaseballSignal(tags, collections) && /\bbaseball\b/i.test(title)) {
    return done("MEDIUM", "Baseball", null, "Baseball wording + tags without franchise", "sport_only");
  }
  if (hasHockeySignal(tags, collections) && /\bhockey\b/i.test(title)) {
    return done("MEDIUM", "Hockey", null, "Hockey wording + tags without franchise", "sport_only");
  }
  if (hasSoccerSignal(tags, collections, title) && /\bsoccer\b/i.test(title)) {
    return done("MEDIUM", "Soccer", null, "Soccer wording + tags without team", "sport_only");
  }

  if (hasBasketballSignal(tags, collections)) {
    return done("LOW", null, null, "Basketball tags/collections only — no franchise/title sport", "tags_only");
  }
  if (hasBaseballSignal(tags, collections)) {
    return done("LOW", null, null, "Baseball tags/collections only — no franchise", "tags_only");
  }
  if (hasHockeySignal(tags, collections)) {
    return done("LOW", null, null, "Hockey tags/collections only — no franchise", "tags_only");
  }
  if (hasSoccerSignal(tags, collections, title)) {
    return done("LOW", null, null, "Soccer tags/collections only — no team identity", "tags_only");
  }

  return done("LOW", null, null, "No strong sport/franchise evidence", "unclassified");
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
