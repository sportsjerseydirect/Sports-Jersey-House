import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
  try {
    const counts = await sql`
      select status, count(*)::int as n
      from products
      where deleted_at is null
      group by status
      order by status`;
    const shopify = await sql`
      select count(*)::int as n from products
      where shopify_id is not null and deleted_at is null`;
    const taxonomy = await sql`
      select mode, consecutive_approvals from ai_agent_category_modes where category = 'taxonomy'`;
    const changes = await sql`
      select decision, count(*)::int as n from ai_change_log group by decision order by decision`;
    const titles = await sql`
      select count(*)::int as rewritten from ai_change_log where field_name = 'title'`;
    console.log(
      JSON.stringify(
        { counts, shopify: shopify[0], taxonomy: taxonomy[0], changes, titleRewrites: titles[0] },
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
