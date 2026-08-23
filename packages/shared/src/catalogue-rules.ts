/**
 * Pure catalogue / SEO rules — no trademark blacklists, no title rewriting.
 */
export const LEAGUE_TO_SPORT: Record<string, string> = {
  NFL: "Football",
  NHL: "Hockey",
  MLB: "Baseball",
  NBA: "Basketball",
  MLS: "Soccer",
  "Premier League": "Soccer",
  "La Liga": "Soccer",
  "Serie A": "Soccer",
  Bundesliga: "Soccer",
  "Ligue 1": "Soccer",
  "FIFA World Cup": "Soccer",
  "UEFA Euro": "Soccer",
  "UEFA Champions League": "Soccer",
  UEFA: "Soccer"
};

export type CatalogueChangeCategory =
  | "taxonomy"
  | "collections"
  | "descriptions"
  | "seo"
  | "tags"
  | "retirement"
  | "new_listing";

export type InferredTaxonomy = {
  sport: string | null;
  league: string | null;
  team: string | null;
  player: string | null;
  productType: string | null;
  season: string | null;
};

const LEAGUE_PATTERNS: Array<{ pattern: RegExp; league: string }> = [
  { pattern: /\bnfl\b/i, league: "NFL" },
  { pattern: /\bnba\b/i, league: "NBA" },
  { pattern: /\bnhl\b/i, league: "NHL" },
  { pattern: /\bmlb\b/i, league: "MLB" },
  { pattern: /\bmls\b/i, league: "MLS" },
  { pattern: /\bpremier league\b/i, league: "Premier League" },
  { pattern: /\bla liga\b/i, league: "La Liga" },
  { pattern: /\bserie a\b/i, league: "Serie A" },
  { pattern: /\bbundesliga\b/i, league: "Bundesliga" },
  { pattern: /\bligue 1\b/i, league: "Ligue 1" },
  { pattern: /\bfifa world cup\b/i, league: "FIFA World Cup" },
  { pattern: /\bfifa euro\b|\beuro cup\b|\buefa euro\b/i, league: "UEFA Euro" },
  { pattern: /\buefa champions league\b|\bchampions league\b/i, league: "UEFA Champions League" },
  { pattern: /\buefa\b/i, league: "UEFA" }
];

/** Slug/handle prefixes commonly used by SJD for league routing. */
const SLUG_LEAGUE_PREFIXES: Array<{ pattern: RegExp; league: string }> = [
  { pattern: /^nfl-/i, league: "NFL" },
  { pattern: /^nba-/i, league: "NBA" },
  { pattern: /^nhl-/i, league: "NHL" },
  { pattern: /^mlb-/i, league: "MLB" },
  { pattern: /^mls-/i, league: "MLS" },
  { pattern: /^soccer-/i, league: "Soccer" },
  { pattern: /^football-/i, league: "Football" }
];

/** National teams and common soccer clubs for sport= Soccer when league unknown. */
const SOCCER_NATIONAL_TEAMS = new Set([
  "England",
  "Brazil",
  "Argentina",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Portugal",
  "Netherlands",
  "Belgium",
  "USA",
  "Mexico",
  "Japan",
  "South Korea",
  "Croatia",
  "Scotland",
  "Wales",
  "Ireland"
]);

const SOCCER_CLUB_TO_LEAGUE: Array<{ pattern: RegExp; league: string }> = [
  { pattern: /\b(manchester city|manchester united|liverpool|chelsea|arsenal|tottenham|brentford)\b/i, league: "Premier League" },
  { pattern: /\b(real madrid|barcelona|atletico)\b/i, league: "La Liga" },
  { pattern: /\b(bayern|dortmund)\b/i, league: "Bundesliga" },
  { pattern: /\b(juventus|inter milan|ac milan)\b/i, league: "Serie A" },
  { pattern: /\b(psg|paris saint)\b/i, league: "Ligue 1" }
];

const SOCCER_CLUB_HINTS =
  /\b(real madrid|barcelona|manchester city|manchester united|liverpool|chelsea|arsenal|tottenham|bayern|juventus|inter milan|ac milan|psg|paris saint|brentford|dortmund|atletico)\b/i;

export function sportFromLeague(league: string | null | undefined): string | null {
  if (!league) {
    return null;
  }
  return LEAGUE_TO_SPORT[league] ?? null;
}

/**
 * Infer structured taxonomy from title/tags/type.
 * Never mutates or rewrites the product title itself.
 */
export function inferTaxonomyFromCatalogueText(input: {
  title: string;
  tags?: string[];
  productType?: string | null;
  slug?: string | null;
  collections?: string[];
  existing?: Partial<InferredTaxonomy>;
}): InferredTaxonomy {
  const haystack = [
    input.title,
    ...(input.tags ?? []),
    ...(input.collections ?? []),
    input.productType ?? "",
    input.slug ?? ""
  ].join(" ");
  let league = input.existing?.league ?? null;

  for (const entry of LEAGUE_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      league = entry.league;
      break;
    }
  }

  if (!league && input.slug) {
    for (const entry of SLUG_LEAGUE_PREFIXES) {
      if (entry.pattern.test(input.slug)) {
        if (entry.league === "Soccer") {
          if (!sport) sport = "Soccer";
        } else if (entry.league === "Football") {
          if (!sport) sport = "Football";
        } else {
          league = entry.league;
        }
        break;
      }
    }
  }

  let sport = input.existing?.sport ?? sportFromLeague(league);

  // Soccer from FIFA/Euro/national/club hints when league not mapped to LEAGUE_TO_SPORT.
  if (!sport) {
    if (
      /\bfifa\b|\beuro cup\b|\bworld cup\b|\buefa\b/i.test(haystack) ||
      SOCCER_CLUB_HINTS.test(haystack)
    ) {
      sport = "Soccer";
    }
  }

  if (!league) {
    for (const entry of SOCCER_CLUB_TO_LEAGUE) {
      if (entry.pattern.test(haystack)) {
        league = entry.league;
        if (!sport) sport = "Soccer";
        break;
      }
    }
  }

  const seasonMatch = input.title.match(/\b((?:19|20)\d{2})(?:\s*[-/]\s*((?:19|20)\d{2}))?\b/);
  const season = input.existing?.season ?? (seasonMatch ? seasonMatch[0].replace(/\s+/g, "") : null);

  let productType = input.existing?.productType ?? input.productType ?? null;
  if (!productType && /\bjersey\b/i.test(haystack)) {
    productType = "Jersey";
  }

  let player = input.existing?.player ?? null;
  let team = input.existing?.team ?? null;

  // Drop obviously bad team/player values left from earlier heuristics before re-inferring.
  if (team && (/^\d+\s*Jersey$/i.test(team) || /^jersey$/i.test(team))) {
    team = null;
  }
  if (player && /jersey/i.test(player)) {
    player = null;
  }

  const normalizedTitle = input.title.replace(/\s+/g, " ").trim();

  // FIFA / Euro / national team jerseys: "{Player} {Country} {Number} FIFA Euro Cup Jersey"
  const fifaNational = normalizedTitle.match(
    /^(.+?)\s+(England|Brazil|Argentina|France|Germany|Spain|Italy|Portugal|Netherlands|Belgium|USA|Mexico|Japan|Scotland|Wales|Ireland|Croatia|South Korea)\s+(\d{1,3})\s+(?:FIFA|Euro|UEFA).*Jersey$/i
  );
  if (fifaNational?.[1] && fifaNational[2]) {
    if (!player) player = fifaNational[1].trim();
    if (!team) team = fifaNational[2];
    if (!sport) sport = "Soccer";
    if (!league && /fifa world cup/i.test(normalizedTitle)) league = "FIFA World Cup";
    if (!league && /euro|uefa euro/i.test(normalizedTitle)) league = "UEFA Euro";
  }

  const numberedJersey = normalizedTitle.match(/^(.*?)\s+(\d{1,3})\s+Jersey$/i);
  const jerseyHead = numberedJersey?.[1]?.trim();
  if (jerseyHead) {
    const headTokens = jerseyHead.split(" ").filter(Boolean);
    if (headTokens.length >= 3) {
      // Default: last two tokens ≈ City + Nickname; remainder ≈ player.
      // Exception: three-token place names like "Kansas City Royals", "Green Bay Packers",
      // "New York Yankees", "Tampa Bay Rays".
      let teamTokenCount = 2;
      if (headTokens.length >= 4) {
        const a = headTokens[headTokens.length - 3] ?? "";
        const b = headTokens[headTokens.length - 2] ?? "";
        if (
          /^(Kansas|New|Green|Tampa|Bay|Oklahoma|Salt)$/i.test(a) ||
          /^(City|Bay|York|Angeles|Diego|Jose|Francisco)$/i.test(b)
        ) {
          teamTokenCount = 3;
        }
      }
      team = headTokens.slice(-teamTokenCount).join(" ");
      const inferredPlayer = headTokens.slice(0, -teamTokenCount).join(" ");
      if (inferredPlayer.split(" ").length <= 4) {
        player = inferredPlayer;
      }
    }
  }

  if (!player) {
    const playerMatch = normalizedTitle.match(
      /^([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){0,3})\s+(?=[A-Z])/
    );
    if (playerMatch?.[1] && !/^(Nike|Adidas|Fanatics|Official)$/i.test(playerMatch[1])) {
      player = playerMatch[1].trim();
    }
  }

  if (!team && input.tags?.length) {
    const nonLeague = input.tags.find(
      (tag) =>
        !LEAGUE_PATTERNS.some((entry) => entry.pattern.test(tag)) &&
        !/^\d+$/.test(tag) &&
        !/jersey/i.test(tag)
    );
    team = nonLeague ?? null;
  }

  if (!sport && team && SOCCER_NATIONAL_TEAMS.has(team)) {
    sport = "Soccer";
  }

  return {
    sport,
    league,
    team,
    player,
    productType,
    season
  };
}

export type ProductHealthIssue = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type ProductHealthReport = {
  score: number;
  status: "healthy" | "needs_review" | "at_risk";
  issues: ProductHealthIssue[];
  recommendation: "KEEP" | "UPDATE" | "REVIEW";
};

/** Score catalogue completeness without rewriting titles or inventing facts. */
export function scoreProductHealth(input: {
  title: string;
  description?: string | null;
  sport?: string | null;
  league?: string | null;
  team?: string | null;
  player?: string | null;
  productType?: string | null;
  imageCount: number;
  variantCount: number;
  hasPrice: boolean;
  hasSeoMeta: boolean;
  hasCanonical: boolean;
  collectionCount: number;
  shopifyId?: string | null;
}): ProductHealthReport {
  const issues: ProductHealthIssue[] = [];
  let score = 0;

  if (input.title?.trim()) score += 15;
  else issues.push({ code: "missing_title", severity: "critical", message: "Title missing." });

  const desc = (input.description ?? "").trim();
  if (desc.length >= 40 && !/imported draft|placeholder|lorem ipsum/i.test(desc)) {
    score += 15;
  } else if (!desc) {
    issues.push({ code: "missing_description", severity: "warning", message: "Description missing." });
  } else {
    issues.push({ code: "thin_description", severity: "warning", message: "Description thin or placeholder." });
  }

  if (input.sport) score += 10;
  else issues.push({ code: "missing_sport", severity: "warning", message: "Sport not classified." });

  if (input.league) score += 5;
  if (input.team) score += 10;
  else issues.push({ code: "missing_team", severity: "info", message: "Team not identified." });

  if (input.player) score += 5;
  if (input.productType) score += 5;

  if (input.imageCount > 0) score += 15;
  else issues.push({ code: "missing_images", severity: "critical", message: "No product images." });

  if (input.variantCount > 0) score += 10;
  else issues.push({ code: "missing_variants", severity: "warning", message: "No variants." });

  if (input.hasPrice) score += 10;
  else issues.push({ code: "missing_price", severity: "warning", message: "No priced variant." });

  if (input.hasSeoMeta) score += 5;
  else issues.push({ code: "missing_seo_meta", severity: "info", message: "SEO meta description missing." });

  if (input.hasCanonical) score += 3;
  if (input.collectionCount > 0) score += 2;
  if (input.shopifyId) score += 0; // source traceability, not scored

  const status: ProductHealthReport["status"] =
    score >= 75 ? "healthy" : score >= 50 ? "needs_review" : "at_risk";

  const recommendation: ProductHealthReport["recommendation"] =
    issues.some((i) => i.severity === "critical") || score < 50
      ? "REVIEW"
      : issues.length > 0
        ? "UPDATE"
        : "KEEP";

  return { score: Math.min(100, score), status, issues, recommendation };
}

export type DescriptionDecision = {
  action: "keep" | "improve";
  reason: string;
};

/** Only rewrite descriptions when genuinely necessary — never for keyword stuffing. */
export function evaluateDescriptionQuality(input: {
  title: string;
  description: string | null | undefined;
  sourceHtml?: string | null;
}): DescriptionDecision {
  const description = (input.description ?? "").trim();
  const source = (input.sourceHtml ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!description && source.length > 80) {
    return {
      action: "improve",
      reason: "Canonical description empty but usable source HTML exists — promote cleaned source copy."
    };
  }

  if (!description && !source) {
    return {
      action: "improve",
      reason: "Description missing and no usable source copy."
    };
  }

  if (description.length > 0 && description.length < 40) {
    return { action: "improve", reason: "Description is too thin / incomplete." };
  }

  if (/lorem ipsum|placeholder|todo|coming soon|test product/i.test(description)) {
    return { action: "improve", reason: "Description contains placeholder or unsuitable legacy copy." };
  }

  if (/imported draft — content pending review/i.test(description) && source.length > 80) {
    return {
      action: "improve",
      reason: "Placeholder import description should be replaced with cleaned SJD source copy."
    };
  }

  return { action: "keep", reason: "Existing description is acceptable — keep as-is." };
}

export function draftMetaDescription(input: {
  title: string;
  description?: string | null;
  team?: string | null;
  league?: string | null;
  sport?: string | null;
}): string {
  const base =
    input.description?.replace(/\s+/g, " ").trim() ||
    [input.title, input.team, input.league, input.sport].filter(Boolean).join(" · ");
  const sentence = `Shop ${input.title} at Sports Jersey House. ${base}`.replace(/\s+/g, " ").trim();
  return sentence.length > 155 ? `${sentence.slice(0, 152).trim()}…` : sentence;
}

export function buildImageAltText(input: {
  title: string;
  team?: string | null;
  player?: string | null;
}): string {
  return [input.title, input.player, input.team].filter(Boolean).join(" — ");
}

export function nextCategoryModeAfterDecision(input: {
  currentMode: "learning" | "autonomous";
  consecutiveApprovals: number;
  threshold: number;
  alwaysRequireApproval: boolean;
  decision: "approved" | "rejected";
}): { mode: "learning" | "autonomous"; consecutiveApprovals: number } {
  if (input.decision === "rejected") {
    return {
      mode: input.alwaysRequireApproval ? input.currentMode : "learning",
      consecutiveApprovals: 0
    };
  }

  const consecutive = input.consecutiveApprovals + 1;
  if (!input.alwaysRequireApproval && consecutive >= input.threshold) {
    return {
      mode: "autonomous",
      consecutiveApprovals: input.threshold
    };
  }

  return {
    mode: input.currentMode === "autonomous" ? "autonomous" : "learning",
    consecutiveApprovals: consecutive
  };
}

/** Categories eligible for system calibration → autonomous (never destructive). */
export const CALIBRATABLE_CATEGORIES: CatalogueChangeCategory[] = [
  "taxonomy",
  "descriptions",
  "seo",
  "collections",
  "tags"
];

export const HIGH_CONFIDENCE_THRESHOLD = 0.75;

export function isHighConfidenceChange(confidence: string | number | null | undefined): boolean {
  if (confidence === null || confidence === undefined) {
    return false;
  }
  const value = typeof confidence === "number" ? confidence : Number.parseFloat(confidence);
  return Number.isFinite(value) && value >= HIGH_CONFIDENCE_THRESHOLD;
}

export function displayCategoryLabel(sport: string | null, productType: string | null): string {
  const type = productType || "Jersey";
  if (!sport) {
    return `${type}s`;
  }
  return `${sport} ${type}s`;
}
