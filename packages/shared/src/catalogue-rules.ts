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
  "Ligue 1": "Soccer"
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
  { pattern: /\bligue 1\b/i, league: "Ligue 1" }
];

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
  existing?: Partial<InferredTaxonomy>;
}): InferredTaxonomy {
  const haystack = [input.title, ...(input.tags ?? []), input.productType ?? ""].join(" ");
  let league = input.existing?.league ?? null;

  for (const entry of LEAGUE_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      league = entry.league;
      break;
    }
  }

  const sport = input.existing?.sport ?? sportFromLeague(league);
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

  return {
    sport,
    league,
    team,
    player,
    productType,
    season
  };
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
