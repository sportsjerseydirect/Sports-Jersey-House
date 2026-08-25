import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require" });
  try {
    const tables = await sql`select to_regclass('public.product_option_sets') as t`;
    const cols = await sql`
      select table_name, column_name
      from information_schema.columns
      where (table_name = 'products' and column_name = 'option_set_id')
         or (table_name = 'cart_items' and column_name = 'selected_options')
         or (table_name = 'order_items' and column_name in ('selected_options','colour_label','shopify_product_id','shopify_variant_id','storefront'))
      order by table_name, column_name`;
    const enumVals = await sql`
      select e.enumlabel
      from pg_type t
      join pg_enum e on t.oid = e.enumtypid
      where t.typname = 'customisation_mode'
      order by e.enumsortorder`;
    const [linked] = await sql`
      select
        count(*) filter (where option_set_id is not null)::int as with_set,
        count(*) filter (where option_set_id is null)::int as without_set,
        count(*)::int as total
      from products
      where deleted_at is null and status = 'published' and shopify_id is not null`.catch(() => [
      { with_set: null, without_set: null, total: null }
    ]);
    const sets = await sql`
      select slug, jsonb_array_length(sizes) as size_count
      from product_option_sets
      where deleted_at is null
      order by slug
    `.catch(() => []);
    console.log(JSON.stringify({ tables, cols, enumVals, linked, sets }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
