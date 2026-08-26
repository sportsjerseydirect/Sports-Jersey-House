/**
 * Deterministic storefront description from Shopify title + known taxonomy.
 * Does not invent product facts — uses title as supplied and standard made-to-order copy.
 */
import postgres from "postgres";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 30 });

  try {
    const updated = await sql`
      UPDATE products
      SET
        description = trim(
          title
          || CASE WHEN league IS NOT NULL THEN ' — ' || league ELSE '' END
          || CASE WHEN team IS NOT NULL AND team <> '' THEN '. ' || team ELSE '' END
          || '. Made to order. Allow approximately 15–35 business days for production and delivery.'
        ),
        updated_at = now(),
        updated_by = 'description-from-title'
      WHERE deleted_at IS NULL
        AND shopify_id IS NOT NULL
        AND (
          description IS NULL
          OR trim(description) = ''
          OR description ~* 'imported draft|content pending review'
        )
        AND title IS NOT NULL
        AND trim(title) <> ''
    `;

    console.log(JSON.stringify({ ok: true, descriptionsUpdated: updated.count }, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
