import postgres from "postgres";

export type MigrationVerificationResult = {
  ok: boolean;
  extensions: string[];
  tables: string[];
  productColumns: Array<{ columnName: string; dataType: string }>;
  commerceTables: string[];
  devSeedCount: number;
};

const REQUIRED_COMMERCE_TABLES = [
  "customers",
  "orders",
  "order_items",
  "suppliers",
  "purchase_orders",
  "courier_rules",
  "issue_cases",
  "size_charts",
  "customisation_profiles"
] as const;

export async function verifyMigration(databaseUrl: string): Promise<MigrationVerificationResult> {
  const options: Parameters<typeof postgres>[1] = {
    max: 1,
    prepare: false
  };

  if (/supabase\.co|sslmode=require/i.test(databaseUrl)) {
    options.ssl = "require";
  }

  const sql = postgres(databaseUrl, options);

  try {
    const extensions = await sql<{ extname: string }[]>`
      select extname
      from pg_extension
      where extname in ('vector', 'uuid-ossp')
      order by extname
    `;

    const tables = await sql<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in ('products', 'product_variants', 'migration_checkpoints')
      order by tablename
    `;

    const commerceTables = await sql<{ tablename: string }[]>`
      select tablename
      from pg_tables
      where schemaname = 'public'
        and tablename in (
          'customers',
          'orders',
          'order_items',
          'suppliers',
          'purchase_orders',
          'courier_rules',
          'issue_cases',
          'size_charts',
          'customisation_profiles'
        )
      order by tablename
    `;

    const productColumns = await sql<{ column_name: string; data_type: string }[]>`
      select column_name, udt_name as data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name in ('search_vector', 'embedding', 'customisation_enabled', 'size_chart_id')
      order by column_name
    `;

    const cartColumns = await sql<{ column_name: string }[]>`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'cart_items'
        and column_name in ('customisation', 'customisation_fingerprint')
    `;

    const devSeed = await sql<{ count: string }[]>`
      select count(*)::text as count
      from products
      where source_payload->>'seedTag' = 'dev-catalog-v1'
    `;

    const extensionNames = extensions.map((row) => row.extname);
    const tableNames = tables.map((row) => row.tablename);
    const commerceTableNames = commerceTables.map((row) => row.tablename);
    const hasVector = extensionNames.includes("vector");
    const hasProducts = tableNames.includes("products");
    const hasSearchVector = productColumns.some((row) => row.column_name === "search_vector");
    const hasEmbedding = productColumns.some(
      (row) => row.column_name === "embedding" && row.data_type === "vector"
    );
    const hasCommerce =
      REQUIRED_COMMERCE_TABLES.every((name) => commerceTableNames.includes(name)) &&
      cartColumns.length >= 2 &&
      productColumns.some((row) => row.column_name === "customisation_enabled");

    return {
      ok: hasVector && hasProducts && hasSearchVector && hasEmbedding && hasCommerce,
      extensions: extensionNames,
      tables: tableNames,
      productColumns: productColumns.map((row) => ({
        columnName: row.column_name,
        dataType: row.data_type
      })),
      commerceTables: commerceTableNames,
      devSeedCount: Number(devSeed[0]?.count ?? "0")
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
