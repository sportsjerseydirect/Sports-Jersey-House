/**
 * TypeScript mirrors of missing-sport HIGH-confidence rules (for tests + docs).
 * Generic "baseball jersey" / "hockey jersey" alone must NEVER qualify as HIGH.
 */

const COLLEGE =
  /\b(ncaa|gameday greats|colosseum|midshipmen|terrapins|hoosiers|hoyas|fighting irish|badgers|notre dame|georgetown|washington state cougars|navy midshipmen)\b/i;

const OLYMPIC_INTL =
  /\b(olympic|national team|canada national|germany national|sweden olympic)\b/i;

const MLB_TOKEN = /\bmlb\b/i;
const NHL_TOKEN = /\bnhl\b/i;
const MLB_SLUG = /(^|-)mlb(-|$)/;
const NHL_SLUG = /(^|-)nhl(-|$)/;

const MLB_FRANCHISE =
  /\b(yankees|red sox|dodgers|mets|cubs|white sox|braves|phillies|astros|mariners|rangers|athletics|orioles|rays|blue jays|twins|guardians|tigers|royals|brewers|cardinals|reds|pirates|rockies|diamondbacks|padres|giants|angels|marlins|nationals|city connect|usa 250)\b/i;

const NHL_FRANCHISE =
  /\b(maple leafs|canadiens|blackhawks|red wings|oilers|flames|canucks|jets|senators|sabres|devils|islanders|flyers|capitals|lightning|panthers|blue jackets|predators|stars|blues|wild|avalanche|ducks|kings|sharks|kraken|golden knights|coyotes)\b/i;

export function hasCollegeSignal(title: string, slug: string, payload = ""): boolean {
  return COLLEGE.test(title) || /ncaa/i.test(slug) || COLLEGE.test(payload);
}

export function hasOlympicIntlSignal(title: string, slug: string): boolean {
  return OLYMPIC_INTL.test(title) || /olympic/i.test(slug);
}

export function hasExplicitMlbEvidence(title: string, slug: string, league: string | null): boolean {
  const ll = (league ?? "").toLowerCase();
  return MLB_TOKEN.test(title) || MLB_SLUG.test(slug) || ll === "mlb" || MLB_FRANCHISE.test(title);
}

export function hasExplicitNhlEvidence(title: string, slug: string, league: string | null): boolean {
  const ll = (league ?? "").toLowerCase();
  return NHL_TOKEN.test(title) || NHL_SLUG.test(slug) || ll === "nhl" || NHL_FRANCHISE.test(title);
}

/** HIGH confidence — explicit MLB/NHL evidence only; generic jersey wording insufficient */
export function isHighConfidenceBaseball(title: string, slug: string, league: string | null, payload = ""): boolean {
  if (hasCollegeSignal(title, slug, payload) || hasOlympicIntlSignal(title, slug)) return false;
  return hasExplicitMlbEvidence(title, slug, league);
}

export function isHighConfidenceHockey(title: string, slug: string, league: string | null, payload = ""): boolean {
  if (hasCollegeSignal(title, slug, payload) || hasOlympicIntlSignal(title, slug)) return false;
  return hasExplicitNhlEvidence(title, slug, league);
}

/** Generic wording alone — MEDIUM at best, never auto-apply */
export function isGenericJerseyOnly(title: string, sport: "Baseball" | "Hockey"): boolean {
  if (sport === "Baseball") return /baseball jersey/i.test(title) && !hasExplicitMlbEvidence(title, "", null);
  return /hockey jersey/i.test(title) && !hasExplicitNhlEvidence(title, "", null);
}
