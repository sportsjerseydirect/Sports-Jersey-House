/**
 * Investigate missing-sport drafts — classify confidence buckets WITHOUT writing.
 * Pass --apply to write ONLY high-confidence sport/league updates.
 *
 * Buckets: HIGH | MEDIUM | UNKNOWN | CONFLICT
 * Never invents sizes or sports without clear evidence.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const APPLY = process.argv.includes("--apply");

function pgUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  return url.replace(":6543/", ":5432/");
}

async function main(): Promise<void> {
  const sql = postgres(pgUrl(), { max: 1, prepare: false, ssl: "require", connect_timeout: 60 });

  try {
    // Pattern inventory among null-sport drafts
    const patterns = await sql`
      WITH d AS (
        SELECT
          id,
          title,
          slug,
          lower(coalesce(title, '')) AS title_l,
          lower(coalesce(slug, '')) AS slug_l,
          lower(coalesce(vendor, '')) AS vendor_l,
          lower(coalesce(product_type, '')) AS type_l,
          lower(coalesce(team, '')) AS team_l,
          lower(coalesce(league, '')) AS league_l,
          lower(coalesce(source_payload::text, '')) AS payload_l
        FROM products
        WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      )
      SELECT pattern, count(*)::int AS n FROM (
        SELECT
          CASE
            WHEN title_l ~ '\\bncaa\\b' OR slug_l ~ 'ncaa' OR payload_l ~ '\\bncaa\\b' THEN 'NCAA / college'
            WHEN title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR title_l ~ 'football jersey' THEN 'NFL / football signal'
            WHEN title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' OR title_l ~ 'basketball jersey' THEN 'NBA / basketball signal'
            WHEN title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR title_l ~ 'hockey jersey' THEN 'NHL / hockey signal'
            WHEN title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR title_l ~ 'baseball jersey' THEN 'MLB / baseball signal'
            WHEN title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|uefa|fifa|world cup)\\b'
              OR title_l ~ '\\b(fc|cf)\\b' THEN 'Soccer / football-club signal'
            WHEN title_l ~ '\\bolympic\\b' OR slug_l ~ 'olympic' THEN 'Olympic'
            WHEN title_l ~ '\\b(al ittihad|al hilal|al-nassr|saudi)\\b' THEN 'Saudi league signal'
            WHEN title_l ~ '\\b(volleyball|lacrosse|cricket|rugby|formula|motogp)\\b' THEN 'Other sport keyword'
            WHEN title_l ~ 'jersey' THEN 'Generic jersey (no sport keyword)'
            ELSE 'No clear pattern'
          END AS pattern
        FROM d
      ) x
      GROUP BY pattern
      ORDER BY n DESC`;

    // Confidence scoring with conflict detection
    const scored = await sql`
      WITH d AS (
        SELECT
          p.id,
          p.title,
          p.slug,
          p.league,
          p.team,
          p.vendor,
          p.product_type,
          lower(coalesce(p.title, '')) AS title_l,
          lower(coalesce(p.slug, '')) AS slug_l,
          lower(coalesce(p.league, '')) AS league_l,
          lower(coalesce(p.team, '')) AS team_l,
          lower(coalesce(p.source_payload::text, '')) AS payload_l
        FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft' AND p.sport IS NULL
      ),
      signals AS (
        SELECT
          id, title, slug, league, team,
          (title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR league_l = 'nfl'
            OR (title_l ~ 'football jersey' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')) AS sig_football,
          (title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' OR league_l = 'nba'
            OR (title_l ~ 'basketball jersey' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
                AND title_l !~ '\\b(mountaineers|razorbacks|sun devils|bulldogs|wildcats|huskies|gators|tigers|bears|eagles|cougars|hoyas|buffaloes|knights)\\b')) AS sig_basketball,
          (title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR league_l = 'nhl'
            OR title_l ~ 'hockey jersey') AS sig_hockey,
          (title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR league_l = 'mlb'
            OR title_l ~ 'baseball jersey') AS sig_baseball,
          (league_l IN ('mls','premier league','la liga','serie a','bundesliga','ligue 1','fifa world cup','uefa euro','uefa champions league','uefa','international','saudi pro league')
            OR title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup|euro cup)\\b'
            OR title_l ~ '\\b(manchester (city|united)|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona|bayern|juventus|ac milan|inter milan|psg|dortmund)\\b'
            OR (title_l ~ '\\b(fc|cf)\\b' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')) AS sig_soccer,
          (title_l ~ '\\bncaa\\b' OR slug_l ~ 'ncaa' OR payload_l ~ '\\bncaa\\b'
            OR title_l ~ '\\b(gameday greats|colosseum|nil |pick a player)\\b') AS sig_ncaa,
          (title_l ~ '\\bolympic\\b' OR slug_l ~ 'olympic') AS sig_olympic
        FROM d
      ),
      classified AS (
        SELECT
          *,
          (CASE WHEN sig_football THEN 1 ELSE 0 END
           + CASE WHEN sig_basketball THEN 1 ELSE 0 END
           + CASE WHEN sig_hockey THEN 1 ELSE 0 END
           + CASE WHEN sig_baseball THEN 1 ELSE 0 END
           + CASE WHEN sig_soccer THEN 1 ELSE 0 END) AS sport_signal_count,
          CASE
            WHEN sig_ncaa AND (sig_football OR sig_basketball OR sig_hockey OR sig_soccer) THEN 'CONFLICT'
            WHEN (CASE WHEN sig_football THEN 1 ELSE 0 END
                 + CASE WHEN sig_basketball THEN 1 ELSE 0 END
                 + CASE WHEN sig_hockey THEN 1 ELSE 0 END
                 + CASE WHEN sig_baseball THEN 1 ELSE 0 END
                 + CASE WHEN sig_soccer THEN 1 ELSE 0 END) > 1 THEN 'CONFLICT'
            WHEN sig_football AND NOT sig_ncaa THEN 'HIGH'
            WHEN sig_basketball AND NOT sig_ncaa THEN 'HIGH'
            WHEN sig_hockey AND NOT sig_ncaa THEN 'HIGH'
            WHEN sig_baseball AND NOT sig_ncaa THEN 'HIGH'
            WHEN sig_soccer AND NOT sig_ncaa THEN 'HIGH'
            WHEN sig_ncaa THEN 'MEDIUM'
            WHEN sig_olympic THEN 'MEDIUM'
            WHEN sig_football OR sig_basketball OR sig_hockey OR sig_baseball OR sig_soccer THEN 'MEDIUM'
            ELSE 'UNKNOWN'
          END AS confidence,
          CASE
            WHEN sig_football AND NOT sig_ncaa
              AND NOT (sig_basketball OR sig_hockey OR sig_baseball OR sig_soccer) THEN 'Football'
            WHEN sig_basketball AND NOT sig_ncaa
              AND NOT (sig_football OR sig_hockey OR sig_baseball OR sig_soccer) THEN 'Basketball'
            WHEN sig_hockey AND NOT sig_ncaa
              AND NOT (sig_football OR sig_basketball OR sig_baseball OR sig_soccer) THEN 'Hockey'
            WHEN sig_baseball AND NOT sig_ncaa
              AND NOT (sig_football OR sig_basketball OR sig_hockey OR sig_soccer) THEN 'Baseball'
            WHEN sig_soccer AND NOT sig_ncaa
              AND NOT (sig_football OR sig_basketball OR sig_hockey OR sig_baseball) THEN 'Soccer'
            ELSE NULL
          END AS inferred_sport,
          CASE
            WHEN sig_football AND not sig_ncaa AND league IS NULL THEN 'NFL'
            WHEN sig_basketball AND not sig_ncaa AND league IS NULL THEN 'NBA'
            WHEN sig_hockey AND not sig_ncaa AND league IS NULL THEN 'NHL'
            WHEN sig_baseball AND not sig_ncaa AND league IS NULL THEN 'MLB'
            ELSE league
          END AS inferred_league
        FROM signals
      )
      SELECT confidence, inferred_sport, count(*)::int AS n
      FROM classified
      GROUP BY 1, 2
      ORDER BY confidence, n DESC`;

    const highDetail = await sql`
      WITH d AS (
        SELECT
          p.id,
          lower(coalesce(p.title, '')) AS title_l,
          lower(coalesce(p.slug, '')) AS slug_l,
          lower(coalesce(p.league, '')) AS league_l,
          p.league
        FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.status = 'draft' AND p.sport IS NULL
      ),
      classified AS (
        SELECT
          id,
          CASE
            WHEN (title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR league_l = 'nfl'
              OR (title_l ~ 'football jersey' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'))
              AND title_l !~ '\\bnba\\b' AND title_l !~ '\\bnhl\\b' AND title_l !~ '\\bmlb\\b'
              AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
              THEN 'Football'
            WHEN (title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' OR league_l = 'nba')
              AND title_l !~ '\\bnfl\\b' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
              THEN 'Basketball'
            WHEN (title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR league_l = 'nhl'
              OR title_l ~ 'hockey jersey')
              AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
              THEN 'Hockey'
            WHEN (title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR league_l = 'mlb'
              OR title_l ~ 'baseball jersey')
              AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
              THEN 'Baseball'
            WHEN (league_l IN ('mls','premier league','la liga','serie a','bundesliga','ligue 1','fifa world cup','uefa euro','uefa champions league','uefa','international','saudi pro league')
              OR title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup)\\b'
              OR title_l ~ '\\b(manchester (city|united)|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona|bayern|juventus|ac milan|inter milan|psg)\\b')
              AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
              AND title_l !~ '\\bnfl\\b' AND title_l !~ '\\bnba\\b'
              THEN 'Soccer'
            ELSE NULL
          END AS sport,
          CASE
            WHEN title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR league_l = 'nfl' THEN 'title/slug/league NFL token'
            WHEN title_l ~ 'football jersey' THEN 'title contains football jersey (non-NCAA)'
            WHEN title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' THEN 'title/slug NBA token'
            WHEN title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR title_l ~ 'hockey jersey' THEN 'title/slug NHL/hockey token'
            WHEN title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR title_l ~ 'baseball jersey' THEN 'title/slug MLB/baseball token'
            WHEN title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa)\\b' THEN 'soccer league keyword'
            WHEN title_l ~ '\\b(manchester|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona)\\b' THEN 'known soccer club'
            ELSE 'other'
          END AS evidence,
          CASE
            WHEN (title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR league_l = 'nfl') THEN 'NFL'
            WHEN (title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' OR league_l = 'nba') THEN 'NBA'
            WHEN (title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR league_l = 'nhl') THEN 'NHL'
            WHEN (title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR league_l = 'mlb') THEN 'MLB'
            WHEN title_l ~ 'premier league' THEN 'Premier League'
            WHEN title_l ~ 'la liga' THEN 'La Liga'
            WHEN title_l ~ 'serie a' THEN 'Serie A'
            WHEN title_l ~ '\\bmls\\b' THEN 'MLS'
            WHEN title_l ~ 'fifa|world cup' THEN 'FIFA World Cup'
            WHEN title_l ~ 'uefa|euro' THEN 'UEFA'
            ELSE coalesce(nullif(league,''), null)
          END AS league_out
        FROM d
      )
      SELECT sport, league_out AS league, evidence, count(*)::int AS n
      FROM classified
      WHERE sport IS NOT NULL
      GROUP BY 1, 2, 3
      ORDER BY sport, n DESC`;

    const bucketCounts = await sql`
      WITH d AS (
        SELECT
          lower(coalesce(title, '')) AS title_l,
          lower(coalesce(slug, '')) AS slug_l,
          lower(coalesce(league, '')) AS league_l,
          lower(coalesce(source_payload::text, '')) AS payload_l
        FROM products
        WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
      ),
      b AS (
        SELECT
          CASE
            WHEN (title_l ~ '\\bncaa\\b' OR slug_l ~ 'ncaa' OR payload_l ~ '\\bncaa\\b'
                  OR title_l ~ '\\b(gameday greats|colosseum|nil )\\b')
              AND (title_l ~ '\\b(nfl|nba|nhl|mlb|football jersey|basketball jersey|hockey jersey)\\b'
                   OR slug_l ~ '(nfl|nba|nhl|mlb)')
              THEN 'CONFLICT'
            WHEN (
              ((title_l ~ '\\bnfl\\b' OR slug_l ~ '(^|-)nfl(-|$)' OR league_l = 'nfl'
                OR (title_l ~ 'football jersey' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'))
               AND title_l !~ '\\bnba\\b' AND title_l !~ '\\bnhl\\b' AND title_l !~ '\\bmlb\\b'
               AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')
              OR ((title_l ~ '\\bnba\\b' OR slug_l ~ '(^|-)nba(-|$)' OR league_l = 'nba')
                  AND title_l !~ '\\bnfl\\b' AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')
              OR ((title_l ~ '\\bnhl\\b' OR slug_l ~ '(^|-)nhl(-|$)' OR league_l = 'nhl' OR title_l ~ 'hockey jersey')
                  AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')
              OR ((title_l ~ '\\bmlb\\b' OR slug_l ~ '(^|-)mlb(-|$)' OR league_l = 'mlb' OR title_l ~ 'baseball jersey')
                  AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa')
              OR ((league_l IN ('mls','premier league','la liga','serie a','bundesliga','ligue 1','fifa world cup','uefa euro','uefa champions league','uefa','international','saudi pro league')
                   OR title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup)\\b'
                   OR title_l ~ '\\b(manchester (city|united)|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona|bayern|juventus|ac milan|inter milan|psg)\\b')
                  AND title_l !~ '\\bncaa\\b' AND slug_l !~ 'ncaa'
                  AND title_l !~ '\\bnfl\\b' AND title_l !~ '\\bnba\\b')
            ) THEN 'HIGH'
            WHEN title_l ~ '\\bncaa\\b' OR slug_l ~ 'ncaa' OR title_l ~ '\\bolympic\\b'
              OR title_l ~ '\\b(gameday greats|volleyball|lacrosse|cricket|rugby)\\b'
              THEN 'MEDIUM'
            ELSE 'UNKNOWN'
          END AS bucket
        FROM d
      )
      SELECT bucket, count(*)::int AS n FROM b GROUP BY 1 ORDER BY n DESC`;

    let applied = { sportUpdated: 0, leagueUpdated: 0, optionSetsLinked: 0 };
    if (APPLY) {
      const sportUp = await sql`
        UPDATE products p
        SET
          sport = v.sport,
          updated_at = now(),
          updated_by = 'missing-sport-high-confidence'
        FROM (
          SELECT id,
            CASE
              WHEN (lower(title) ~ '\\bnfl\\b' OR lower(slug) ~ '(^|-)nfl(-|$)' OR lower(coalesce(league,'')) = 'nfl'
                OR (lower(title) ~ 'football jersey' AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'))
                AND lower(title) !~ '\\bnba\\b' AND lower(title) !~ '\\bnhl\\b' AND lower(title) !~ '\\bmlb\\b'
                AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'
                THEN 'Football'
              WHEN (lower(title) ~ '\\bnba\\b' OR lower(slug) ~ '(^|-)nba(-|$)' OR lower(coalesce(league,'')) = 'nba')
                AND lower(title) !~ '\\bnfl\\b' AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'
                THEN 'Basketball'
              WHEN (lower(title) ~ '\\bnhl\\b' OR lower(slug) ~ '(^|-)nhl(-|$)' OR lower(coalesce(league,'')) = 'nhl'
                OR lower(title) ~ 'hockey jersey')
                AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'
                THEN 'Hockey'
              WHEN (lower(title) ~ '\\bmlb\\b' OR lower(slug) ~ '(^|-)mlb(-|$)' OR lower(coalesce(league,'')) = 'mlb'
                OR lower(title) ~ 'baseball jersey')
                AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'
                THEN 'Baseball'
              WHEN (lower(coalesce(league,'')) IN ('mls','premier league','la liga','serie a','bundesliga','ligue 1','fifa world cup','uefa euro','uefa champions league','uefa','international','saudi pro league')
                OR lower(title) ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup)\\b'
                OR lower(title) ~ '\\b(manchester (city|united)|liverpool|chelsea|arsenal|tottenham|real madrid|barcelona|bayern|juventus|ac milan|inter milan|psg)\\b')
                AND lower(title) !~ '\\bncaa\\b' AND lower(slug) !~ 'ncaa'
                AND lower(title) !~ '\\bnfl\\b' AND lower(title) !~ '\\bnba\\b'
                THEN 'Soccer'
              ELSE NULL
            END AS sport
          FROM products
          WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft' AND sport IS NULL
        ) v
        WHERE p.id = v.id AND v.sport IS NOT NULL
      `;
      applied.sportUpdated = sportUp.count;

      const leagueUp = await sql`
        UPDATE products p
        SET
          league = v.league,
          updated_at = now(),
          updated_by = 'missing-sport-high-confidence'
        FROM (
          SELECT id,
            CASE
              WHEN sport = 'Football' AND league IS NULL THEN 'NFL'
              WHEN sport = 'Basketball' AND league IS NULL THEN 'NBA'
              WHEN sport = 'Hockey' AND league IS NULL THEN 'NHL'
              WHEN sport = 'Baseball' AND league IS NULL THEN 'MLB'
              ELSE NULL
            END AS league
          FROM products
          WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft'
            AND sport IN ('Football','Basketball','Hockey','Baseball')
            AND league IS NULL
            AND updated_by = 'missing-sport-high-confidence'
        ) v
        WHERE p.id = v.id AND v.league IS NOT NULL
      `;
      // Also set league for rows we just set sport on even if updated_by differs on race - safer broader update for newly classified only
      const leagueUp2 = await sql`
        UPDATE products
        SET
          league = CASE sport
            WHEN 'Football' THEN 'NFL'
            WHEN 'Basketball' THEN 'NBA'
            WHEN 'Hockey' THEN 'NHL'
            WHEN 'Baseball' THEN 'MLB'
            ELSE league
          END,
          updated_at = now(),
          updated_by = 'missing-sport-high-confidence'
        WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'draft'
          AND sport IN ('Football','Basketball','Hockey','Baseball')
          AND league IS NULL
      `;
      applied.leagueUpdated = leagueUp.count + leagueUp2.count;

      const charts = await sql`
        UPDATE products p
        SET size_chart_id = sc.id, updated_at = now(), updated_by = 'missing-sport-high-confidence'
        FROM size_charts sc
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.size_chart_id IS NULL
          AND p.sport IS NOT NULL AND sc.deleted_at IS NULL
          AND (
            (lower(p.sport) = 'football' AND sc.slug = 'nfl-adult')
            OR (lower(p.sport) = 'basketball' AND sc.slug = 'nba-adult')
            OR (lower(p.sport) = 'hockey' AND sc.slug = 'nhl-adult')
            OR (lower(p.sport) = 'baseball' AND sc.slug = 'mlb-adult')
            OR (lower(p.sport) = 'soccer' AND sc.slug = 'soccer-adult')
          )`;

      const linked = await sql`
        UPDATE products p
        SET option_set_id = os.id, updated_at = now(), updated_by = 'missing-sport-high-confidence'
        FROM product_option_sets os
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL AND p.option_set_id IS NULL
          AND os.deleted_at IS NULL
          AND (
            (lower(p.sport) = 'baseball' AND os.slug = 'baseball-jerseys')
            OR (lower(p.sport) = 'hockey' AND os.slug = 'hockey-jerseys')
            OR (lower(p.sport) = 'soccer' AND os.slug = 'soccer-jerseys')
            OR (lower(p.sport) = 'football' AND os.slug = 'football-jerseys')
            OR (lower(p.sport) = 'basketball' AND os.slug = 'basketball-jerseys')
          )`;
      applied.optionSetsLinked = linked.count;
      void charts;
    }

    const report = {
      apply: APPLY,
      patterns,
      bucketCounts,
      scoredByConfidenceSport: scored,
      highConfidenceDetail: highDetail,
      applied
    };

    mkdirSync(join(process.cwd(), "../../docs/full-import-logs"), { recursive: true });
    const out = join(process.cwd(), "../../docs/full-import-logs/MISSING-SPORT-INVESTIGATION.json");
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.error(`wrote ${out}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
