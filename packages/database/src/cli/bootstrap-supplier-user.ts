import { and, eq, isNull } from "drizzle-orm";
import { createDatabaseClient } from "../client";
import { suppliers } from "../schema-commerce";
import { createSupplier } from "../suppliers";
import { bootstrapSupplierUser } from "../supplier-portal";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.replace(":6543/", ":5432/");
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  const supplierCode = (process.argv[2] ?? "DEFAULT").toUpperCase();
  const db = createDatabaseClient(databaseUrl);
  const [existing] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.code, supplierCode), isNull(suppliers.deletedAt)))
    .limit(1);

  if (!existing) {
    await createSupplier(
      {
        code: supplierCode,
        name: supplierCode === "DEFAULT" ? "Default supplier" : supplierCode,
        email: "supplier@example.com",
        packingSlipFormat: "default_html"
      },
      databaseUrl
    );
  }
  const email = process.argv[3] ?? "supplier@example.com";
  const password = process.argv[4] ?? "change-me-supplier";
  const displayName = process.argv[5] ?? "Default Supplier";

  const result = await bootstrapSupplierUser({ supplierCode, email, password, displayName });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
