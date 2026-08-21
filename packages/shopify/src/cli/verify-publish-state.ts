import { createDatabaseClient } from "@sjh/database";
import { sql } from "drizzle-orm";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDatabaseClient(databaseUrl);
  const slug = "mlb-matthew-boyd-cleveland-guardians-16-jersey";

  const rows = await db.execute(sql`
    select
      (select count(*)::int from products where deleted_at is null and status='published') as published_count,
      (select count(*)::int from products where deleted_at is null and status='draft' and shopify_id is not null) as draft_shopify,
      (select count(*)::int from products where deleted_at is null and source_payload->>'seedTag'='dev-catalog-v1') as seed_count,
      (select status from products where slug=${slug} and deleted_at is null limit 1) as test_status,
      (select url from product_images pi join products p on p.id=pi.product_id
        where p.slug=${slug} and pi.deleted_at is null order by pi.sort_order limit 1) as test_image,
      (select count(*)::int from collection_products cp join products p on p.id=cp.product_id where p.slug=${slug}) as test_memberships
  `);

  console.log(JSON.stringify({
    sync: process.env.ENABLE_SHOPIFY_SYNC,
    sample: process.env.ENABLE_SHOPIFY_SAMPLE_IMPORT,
    row: Array.from(rows)[0]
  }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
