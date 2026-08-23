/**
 * Conservative batch sport/league classification + size chart linking.
 * Uses title, slug, league, team, tags, source_payload — single SQL pass.
 * Never rewrites titles. Never invents facts without clear evidence.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 20 });

  try {
    const sportUpdated = await sql`
      WITH candidates AS (
        SELECT
          p.id,
          lower(coalesce(p.league, '')) AS league_l,
          lower(coalesce(p.sport, '')) AS sport_l,
          lower(p.title) AS title_l,
          lower(p.slug) AS slug_l,
          lower(coalesce(p.team, '')) AS team_l,
          lower(coalesce(p.source_payload::text, '')) AS payload_l
        FROM products p
        WHERE p.deleted_at IS NULL
          AND p.shopify_id IS NOT NULL
          AND p.sport IS NULL
      ),
      inferred AS (
        SELECT
          id,
          CASE
            WHEN league_l = 'nfl' OR title_l ~ '\\bnfl\\b' OR slug_l ~ '^nfl-' THEN 'Football'
            WHEN league_l = 'nba' OR title_l ~ '\\bnba\\b' OR slug_l ~ '^nba-' THEN 'Basketball'
            WHEN league_l = 'nhl' OR title_l ~ '\\bnhl\\b' OR slug_l ~ '^nhl-' THEN 'Hockey'
            WHEN league_l = 'mlb' OR title_l ~ '\\bmlb\\b' OR slug_l ~ '^mlb-' THEN 'Baseball'
            WHEN title_l ~ '\\bolympic\\b'
              AND title_l ~ '\\b(rj barrett|shai gilgeous|melvin ejim|mfiondu kabengele|phil scrubb|thomas scrubb|trey lyles)\\b'
              THEN 'Basketball'
            WHEN title_l ~ '\\bolympic\\b'
              AND title_l ~ '\\b(adriana leon|cyle larin|janine beckie|jessie fleming|kadeisha buchanan)\\b'
              THEN 'Soccer'
            WHEN league_l IN ('mls', 'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
              'fifa world cup', 'uefa euro', 'uefa champions league', 'uefa')
              OR title_l ~ '\\b(premier league|la liga|serie a|bundesliga|mls|fifa|uefa|world cup|euro cup)\\b'
              OR slug_l ~ '^(soccer-|football-)'
              OR payload_l ~ '\\b(premier league|la liga|fifa|uefa|world cup)\\b'
              OR team_l IN ('soccer', 'club teams', 'west ham', 'united fc')
              OR team_l ~ 'everton|evertn|spain|ittihad|hilal'
              OR title_l ~ '\\b(west ham|everton|evertn|newcastle|aston villa|bournemouth|brighton|burnley|crystal palace|fulham|luton|sheffield|wolverhampton|nottingham forest)\\b'
              OR title_l ~ '\\b(ac monza|alaves|almeria|as roma|atalanta|athletic bilbao|bologna|cadiz|cagliari|celta vigo|frosinone|genova|getafe|girona|granada|hella verona|lazio|las palmas|napoli|osasuna|rayo vallecano|real betis|real mallorca|real sociedad|salernitana|sassuolo|sevilla|torino|udinese|valencia|villarreal)\\b'
              OR title_l ~ '\\b(spain|england|france|germany|italy|portugal|brazil|argentina|mexico|japan|canada)\\b'
              OR title_l ~ '\\b(al ittihad|al hilal|al-hilal|neymar|karim benzema)\\b'
              OR team_l IN ('england', 'brazil', 'argentina', 'france', 'germany', 'spain', 'italy',
                'portugal', 'netherlands', 'belgium', 'mexico', 'japan', 'scotland', 'wales', 'team canada')
              OR title_l ~ '\\b(real madrid|barcelona|manchester city|manchester united|liverpool|chelsea|arsenal|tottenham|bayern|juventus|ac milan|inter milan|psg|dortmund|atletico)\\b'
              THEN 'Soccer'
            ELSE NULL
          END AS new_sport
        FROM candidates
      )
      UPDATE products p
      SET
        sport = i.new_sport,
        updated_at = now(),
        updated_by = 'ai-autonomous'
      FROM inferred i
      WHERE p.id = i.id AND i.new_sport IS NOT NULL
    `;

    const leagueUpdated = await sql`
      WITH candidates AS (
        SELECT
          p.id,
          lower(coalesce(p.league, '')) AS league_l,
          lower(p.title) AS title_l,
          lower(p.slug) AS slug_l,
          lower(coalesce(p.team, '')) AS team_l,
          lower(coalesce(p.source_payload::text, '')) AS payload_l,
          lower(coalesce(p.sport, '')) AS sport_l
        FROM products p
        WHERE p.deleted_at IS NULL
          AND p.shopify_id IS NOT NULL
          AND p.league IS NULL
          AND p.sport IS NOT NULL
      ),
      inferred AS (
        SELECT
          id,
          CASE
            WHEN title_l ~ '\\bnfl\\b' OR slug_l ~ '^nfl-' OR payload_l ~ '\\bnfl\\b' OR sport_l = 'football' THEN 'NFL'
            WHEN title_l ~ '\\bnba\\b' OR slug_l ~ '^nba-' OR sport_l = 'basketball' THEN 'NBA'
            WHEN title_l ~ '\\bnhl\\b' OR slug_l ~ '^nhl-' OR sport_l = 'hockey' THEN 'NHL'
            WHEN title_l ~ '\\bmlb\\b' OR slug_l ~ '^mlb-' OR sport_l = 'baseball' THEN 'MLB'
            WHEN title_l ~ '\\bpremier league\\b' OR payload_l ~ 'premier league'
              OR title_l ~ '\\b(west ham|everton|evertn|newcastle|aston villa|bournemouth|brighton|burnley|crystal palace|fulham|luton|sheffield|wolverhampton|nottingham forest)\\b'
              OR team_l IN ('west ham', 'club teams', 'united fc')
              OR team_l ~ 'everton|evertn' THEN 'Premier League'
            WHEN title_l ~ '\\bla liga\\b'
              OR title_l ~ '\\b(alaves|almeria|athletic bilbao|cadiz|celta vigo|getafe|girona|granada|las palmas|osasuna|rayo vallecano|real betis|real mallorca|real sociedad|sevilla|valencia|villarreal)\\b'
              THEN 'La Liga'
            WHEN title_l ~ '\\bserie a\\b'
              OR title_l ~ '\\b(ac monza|as roma|atalanta|bologna|frosinone|genova|hella verona|lazio|napoli|salernitana|sassuolo|torino|udinese|cagliari)\\b'
              THEN 'Serie A'
            WHEN title_l ~ '\\bfifa world cup\\b' THEN 'FIFA World Cup'
            WHEN title_l ~ '\\b(euro cup|uefa euro)\\b' THEN 'UEFA Euro'
            WHEN title_l ~ '\\bchampions league\\b' THEN 'UEFA Champions League'
            WHEN title_l ~ '\\b(spain|england|france|germany|italy|portugal|brazil|argentina)\\b' THEN 'International'
            WHEN title_l ~ '\\b(al ittihad|al hilal|al-hilal)\\b' OR team_l ~ 'ittihad|hilal' THEN 'Saudi Pro League'
            WHEN title_l ~ '\\bolympic\\b' AND sport_l = 'basketball' THEN 'Olympics'
            WHEN title_l ~ '\\bolympic\\b' AND sport_l = 'soccer' THEN 'Olympics'
            ELSE NULL
          END AS new_league
        FROM candidates
      )
      UPDATE products p
      SET
        league = i.new_league,
        updated_at = now(),
        updated_by = 'ai-autonomous'
      FROM inferred i
      WHERE p.id = i.id AND i.new_league IS NOT NULL
    `;

    const chartsLinked = await sql`
      UPDATE products p
      SET
        size_chart_id = sc.id,
        updated_at = now(),
        updated_by = 'ai-autonomous'
      FROM size_charts sc
      WHERE p.deleted_at IS NULL
        AND p.shopify_id IS NOT NULL
        AND p.size_chart_id IS NULL
        AND p.sport IS NOT NULL
        AND sc.deleted_at IS NULL
        AND (
          (lower(p.sport) = 'football' AND sc.slug = 'nfl-adult')
          OR (lower(p.sport) = 'basketball' AND sc.slug = 'nba-adult')
          OR (lower(p.sport) = 'hockey' AND sc.slug = 'nhl-adult')
          OR (lower(p.sport) = 'baseball' AND sc.slug = 'mlb-adult')
          OR (lower(p.sport) = 'soccer' AND sc.slug = 'soccer-adult')
        )
    `;

    const [coverage] = await sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE sport IS NOT NULL)::int AS with_sport,
        count(*) FILTER (WHERE league IS NOT NULL)::int AS with_league,
        count(*) FILTER (WHERE size_chart_id IS NOT NULL)::int AS with_size_chart,
        count(*) FILTER (WHERE sport IS NULL)::int AS missing_sport
      FROM products
      WHERE deleted_at IS NULL AND shopify_id IS NOT NULL
    `;

    const [stillReview] = await sql`
      WITH sp AS (
        SELECT p.* FROM products p
        WHERE p.deleted_at IS NULL AND p.shopify_id IS NOT NULL
      ),
      img AS (
        SELECT product_id, count(*)::int AS n FROM product_images
        WHERE deleted_at IS NULL GROUP BY product_id
      ),
      var AS (
        SELECT product_id, count(*)::int AS n,
          bool_or(price_amount IS NOT NULL AND price_amount::numeric > 0) AS has_price
        FROM product_variants WHERE deleted_at IS NULL GROUP BY product_id
      ),
      seo AS (
        SELECT target_id AS product_id,
          meta_description IS NOT NULL AND trim(meta_description) <> '' AS has_meta
        FROM seo_records WHERE target_type = 'product'
      ),
      enriched AS (
        SELECT sp.id,
          (sp.title IS NOT NULL AND trim(sp.title) <> '') AS ok_title,
          (sp.slug IS NOT NULL AND trim(sp.slug) <> '') AS ok_slug,
          coalesce(v.has_price, false) AS ok_price,
          coalesce(v.n, 0) > 0 AS ok_variants,
          coalesce(i.n, 0) > 0 AS ok_images,
          coalesce(s.has_meta, false) AS ok_seo,
          sp.size_chart_id IS NOT NULL AS ok_size_chart,
          sp.customisation_profile_id IS NOT NULL AS ok_customisation,
          (sp.sport IS NOT NULL OR sp.league IS NOT NULL OR sp.team IS NOT NULL) AS ok_taxonomy,
          (sp.description IS NOT NULL AND trim(sp.description) <> '') AS ok_description
        FROM sp
        LEFT JOIN img i ON i.product_id = sp.id
        LEFT JOIN var v ON v.product_id = sp.id
        LEFT JOIN seo s ON s.product_id = sp.id
      ),
      classified AS (
        SELECT *,
          NOT (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images) AS is_blocked,
          (ok_title AND ok_slug AND ok_price AND ok_variants AND ok_images)
            AND NOT (ok_seo AND ok_size_chart AND ok_customisation AND ok_taxonomy AND ok_description) AS needs_review
        FROM enriched
      )
      SELECT
        count(*) FILTER (WHERE NOT is_blocked AND NOT needs_review)::int AS ready,
        count(*) FILTER (WHERE NOT is_blocked AND needs_review)::int AS needs_review,
        count(*) FILTER (WHERE is_blocked)::int AS blocked
      FROM classified
    `;

    console.log(
      JSON.stringify(
        {
          ok: true,
          sportRowsUpdated: sportUpdated.count,
          leagueRowsUpdated: leagueUpdated.count,
          sizeChartsLinked: chartsLinked.count,
          coverage,
          readiness: stillReview
        },
        null,
        2
      )
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
