import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
  try {
    const counts = await sql`
      select status, count(*)::int as n
      from products where deleted_at is null
      group by status order by status`;
    const shopify = await sql`
      select count(*)::int as n from products
      where deleted_at is null and shopify_id is not null`;
    const taxonomy = await sql`
      select
        count(*) filter (where sport is not null)::int as with_sport,
        count(*) filter (where league is not null)::int as with_league,
        count(*) filter (where team is not null)::int as with_team,
        count(*) filter (where player_name is not null)::int as with_player,
        count(*)::int as total
      from products
      where deleted_at is null and shopify_id is not null`;
    const memberships = await sql`select count(*)::int as n from collection_products`;
    const seo = await sql`
      select count(*)::int as n from seo_records
      where target_type = 'product' and meta_description is not null`;
    const changes = await sql`
      select decision, count(*)::int as n from ai_change_log
      group by decision order by decision`;
    const modes = await sql`
      select category, mode, consecutive_approvals from ai_agent_category_modes
      order by category`;
    const signals = await sql`
      select
        count(*)::int as total,
        count(*) filter (where is_duplicate_suspect)::int as duplicates,
        count(*) filter (where is_outdated)::int as outdated
      from product_catalogue_signals`;
    const proposals = await sql`
      select recommendation, count(*)::int as n from catalogue_proposals
      group by recommendation order by recommendation`;
    const seeds = await sql`
      select count(*)::int as n from products
      where deleted_at is null and shopify_id is null and status = 'published'`;

    console.log(
      JSON.stringify(
        {
          counts,
          shopifyImported: shopify[0]?.n,
          taxonomy: taxonomy[0],
          memberships: memberships[0]?.n,
          seoWithMeta: seo[0]?.n,
          changes,
          modes,
          signals: signals[0],
          proposals,
          publishedSeeds: seeds[0]?.n
        },
        null,
        2
      )
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
