import postgres from "postgres";
const url = process.env.DATABASE_URL!.replace(":6543/", ":5432/");
const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
const cleared = await sql`
  UPDATE products
  SET league = NULL, updated_at = now(), updated_by = 'league-token-guard'
  WHERE deleted_at IS NULL AND shopify_id IS NOT NULL AND status = 'published'
    AND (
      (sport = 'Hockey' AND league = 'NHL' AND title !~* '\\bnhl\\b' AND lower(slug) !~ 'nhl')
      OR (sport = 'Baseball' AND league = 'MLB' AND title !~* '\\bmlb\\b' AND lower(slug) !~ 'mlb')
      OR (sport = 'Football' AND league = 'NFL' AND title !~* '\\bnfl\\b' AND lower(slug) !~ 'nfl')
      OR (sport = 'Basketball' AND league = 'NBA' AND title !~* '\\bnba\\b' AND lower(slug) !~ 'nba')
    )
`;
console.log(JSON.stringify({ leaguesCleared: cleared.count }));
await sql.end({ timeout: 5 });
