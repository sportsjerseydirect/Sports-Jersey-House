import postgres from "postgres";

export type MigrationVerificationResult = {
  ok: boolean;
  extensions: string[];
  tables: string[];
  productColumns: Array<{ columnName: string; dataType: string }>;
  devSeedCount: number;
};

export async function verifyMigration(databaseUrl: string): Promise<MigrationVerificationResult> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });

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

    const productColumns = await sql<{ column_name: string; data_type: string }[]>`
      select column_name, udt_name as data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name in ('search_vector', 'embedding')
      order by column_name
    `;

    const devSeed = await sql<{ count: string }[]>`
      select count(*)::text as count
      from products
      where source_payload->>'seedTag' = 'dev-catalog-v1'
    `;

    const extensionNames = extensions.map((row) => row.extname);
    const tableNames = tables.map((row) => row.tablename);
    const hasVector = extensionNames.includes("vector");
    const hasProducts = tableNames.includes("products");
    const hasSearchVector = productColumns.some((row) => row.column_name === "search_vector");
    const hasEmbedding = productColumns.some(
      (row) => row.column_name === "embedding" && row.data_type === "vector"
    );

    return {
      ok: hasVector && hasProducts && hasSearchVector && hasEmbedding,
      extensions: extensionNames,
      tables: tableNames,
      productColumns: productColumns.map((row) => ({
        columnName: row.column_name,
        dataType: row.data_type
      })),
      devSeedCount: Number(devSeed[0]?.count ?? "0")
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

