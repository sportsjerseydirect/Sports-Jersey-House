/**
 * One-product publish test for Phase 11 sample (CLI only; not part of package exports).
 */
import {
  createDatabaseClient,
  ensureSeoRecordForProduct,
  evaluateProductReadiness,
  listCatalogueProductsForAdmin,
  products,
  transitionProductStatus
} from "@sjh/database";
import { and, eq, isNull, sql } from "drizzle-orm";
import { syncProductCollectionMembershipsFromSourcePayload } from "../load/sync-product-collection-memberships";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required");
  }

  console.error("[publish-test] syncing collection memberships from sourcePayload…");
  const memberships = await syncProductCollectionMembershipsFromSourcePayload(databaseUrl);
  console.error(JSON.stringify({ memberships }));

  const imported = await listCatalogueProductsForAdmin(
    { shopifyOnly: true, status: ["draft"], limit: 20 },
    databaseUrl
  );

  const candidate =
    imported.find((row) => row.imageCount > 0 && row.variantCount > 0) ?? imported[0];

  if (!candidate) {
    throw new Error("No draft Shopify products available for publish test.");
  }

  console.error(`[publish-test] selected ${candidate.slug} (${candidate.id})`);
  await ensureSeoRecordForProduct(candidate.id, databaseUrl);

  for (const action of ["send_to_review", "approve", "publish"] as const) {
    const readiness = await evaluateProductReadiness(candidate.id, databaseUrl);
    console.error(`[publish-test] before ${action}: readiness=${readiness.overall}`);
    const result = await transitionProductStatus(
      {
        productId: candidate.id,
        action,
        actor: "publish-test-cli",
        forcePublishDespiteWarnings: true
      },
      databaseUrl
    );
    console.error(`[publish-test] ${action} → ${result.status}`);
  }

  const db = createDatabaseClient(databaseUrl);

  await db.execute(sql`
    update collections c
    set status = 'published', updated_at = now(), updated_by = 'publish-test-cli'
    where c.deleted_at is null
      and c.status <> 'published'
      and c.id in (
        select cp.collection_id from collection_products cp where cp.product_id = ${candidate.id}::uuid
      )
  `);

  const [publishedRow] = await db.execute(sql`
    select p.id, p.slug, p.title, p.status,
      (select pi.url from product_images pi
        where pi.product_id = p.id and pi.deleted_at is null
        order by pi.sort_order asc limit 1) as primary_image,
      (select count(*)::int from product_variants pv
        where pv.product_id = p.id and pv.deleted_at is null) as variant_count,
      (select count(*)::int from collection_products cp
        where cp.product_id = p.id) as membership_count
    from products p
    where p.id = ${candidate.id}::uuid
  `);

  const row = publishedRow as {
    slug: string;
    title: string;
    status: string;
    primary_image: string | null;
    variant_count: number;
    membership_count: number;
  };

  if (!row || row.status !== "published") {
    throw new Error("Published product row missing or not published.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        productId: candidate.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        imageOk: Boolean(row.primary_image?.includes("cdn.shopify.com")),
        primaryImage: row.primary_image,
        variantCount: row.variant_count,
        membershipCount: row.membership_count,
        membershipSync: memberships
      },
      null,
      2
    )
  );

  const rolled = await transitionProductStatus(
    {
      productId: candidate.id,
      action: "reject_to_draft",
      actor: "publish-test-cli"
    },
    databaseUrl
  );

  const [after] = await db
    .select({ status: products.status, shopifyId: products.shopifyId })
    .from(products)
    .where(and(eq(products.id, candidate.id), isNull(products.deletedAt)))
    .limit(1);

  console.error(
    JSON.stringify({
      rollback: {
        status: rolled.status,
        shopifyIdPreserved: Boolean(after?.shopifyId),
        dbStatus: after?.status
      }
    })
  );

  await transitionProductStatus(
    { productId: candidate.id, action: "send_to_review", actor: "publish-test-cli" },
    databaseUrl
  );
  await transitionProductStatus(
    { productId: candidate.id, action: "approve", actor: "publish-test-cli" },
    databaseUrl
  );
  await transitionProductStatus(
    {
      productId: candidate.id,
      action: "publish",
      actor: "publish-test-cli",
      forcePublishDespiteWarnings: true
    },
    databaseUrl
  );

  console.error("[publish-test] final state: published (single product kept live)");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
