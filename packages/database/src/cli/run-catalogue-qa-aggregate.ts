/**
 * Fast aggregate-only catalogue QA — no per-product DB writes.
 * Uses a single SQL query for gap counts across all Shopify imports.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");

  const sql = postgres(url.replace(":6543/", ":5432/"), {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 15,
    idle_timeout: 10
  });

  try {
    const [row] = await sql`
      with shopify_products as (
        select p.*
        from products p
        where p.deleted_at is null and p.shopify_id is not null
      ),
      img as (
        select product_id, count(*)::int as image_count
        from product_images
        where deleted_at is null
        group by product_id
      ),
      var as (
        select
          product_id,
          count(*)::int as variant_count,
          bool_or(price_amount is not null and price_amount::numeric > 0) as has_price
        from product_variants
        where deleted_at is null
        group by product_id
      ),
      seo as (
        select target_id as product_id,
          meta_description is not null and trim(meta_description) <> '' as has_meta,
          canonical_path is not null and trim(canonical_path) <> '' as has_canonical
        from seo_records
        where target_type = 'product'
      ),
      coll as (
        select product_id, count(*)::int as collection_count
        from collection_products
        group by product_id
      ),
      sig as (
        select
          count(*) filter (where is_duplicate_suspect)::int as duplicate_suspects,
          count(*) filter (where is_outdated)::int as outdated,
          count(*) filter (where health_status = 'at_risk')::int as at_risk
        from product_catalogue_signals
      )
      select
        count(*)::int as total,
        count(*) filter (where sp.sport is null)::int as missing_sport,
        count(*) filter (where sp.league is null)::int as missing_league,
        count(*) filter (where sp.team is null)::int as missing_team,
        count(*) filter (where sp.player_name is null)::int as missing_player,
        count(*) filter (where coalesce(trim(sp.description), '') = '')::int as missing_description,
        count(*) filter (where coalesce(i.image_count, 0) = 0)::int as missing_images,
        count(*) filter (where coalesce(v.variant_count, 0) = 0)::int as missing_variants,
        count(*) filter (where coalesce(v.has_price, false) = false)::int as missing_price,
        count(*) filter (where coalesce(s.has_meta, false) = false)::int as missing_seo_meta,
        count(*) filter (where coalesce(s.has_canonical, false) = false)::int as missing_canonical,
        count(*) filter (where coalesce(c.collection_count, 0) = 0)::int as missing_collections,
        count(*) filter (where sp.customisation_enabled = true)::int as customisation_enabled,
        count(*) filter (where sp.sport is not null)::int as with_sport,
        count(*) filter (where sp.league is not null)::int as with_league,
        count(*) filter (where sp.team is not null)::int as with_team,
        count(*) filter (where sp.player_name is not null)::int as with_player,
        (select duplicate_suspects from sig) as duplicate_suspects,
        (select outdated from sig) as outdated_candidates,
        (select at_risk from sig) as at_risk_signals
      from shopify_products sp
      left join img i on i.product_id = sp.id
      left join var v on v.product_id = sp.id
      left join seo s on s.product_id = sp.id
      left join coll c on c.product_id = sp.id
    `;

    const [status] = await sql`
      select status, count(*)::int as n
      from products
      where deleted_at is null
      group by status
      order by status
    `;

    const statuses = await sql`
      select status, count(*)::int as n
      from products where deleted_at is null
      group by status order by status
    `;

    const [memberships] = await sql`select count(*)::int as n from collection_products`;
    const proposals = await sql`
      select recommendation, count(*)::int as n
      from catalogue_proposals
      where deleted_at is null and status = 'pending_review'
      group by recommendation
    `;

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "aggregate_only",
          elapsedNote: "single-pass SQL — no per-product loops",
          productStatus: statuses,
          gaps: row,
          collectionMemberships: memberships?.n ?? 0,
          pendingProposals: proposals
        },
        null,
        2
      )
    );
    void status;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
