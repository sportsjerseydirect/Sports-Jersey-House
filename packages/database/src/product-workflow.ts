import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ProductStatus } from "@sjh/shared";
import { createDatabaseClient } from "./client";
import {
  collectionProducts,
  collections,
  productImages,
  products,
  productVariants,
  seoRecords
} from "./schema-catalogue";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for product workflow operations.");
  }
  return url;
}

export type ProductWorkflowAction =
  | "send_to_review"
  | "approve"
  | "publish"
  | "reject_to_draft"
  | "archive";

const TRANSITIONS: Record<ProductWorkflowAction, { from: ProductStatus[]; to: ProductStatus }> = {
  send_to_review: { from: ["draft", "approved"], to: "review" },
  approve: { from: ["review"], to: "approved" },
  publish: { from: ["approved"], to: "published" },
  reject_to_draft: { from: ["review", "approved", "published"], to: "draft" },
  archive: { from: ["draft", "review", "approved", "published"], to: "archived" }
};

export type ReadinessSeverity = "READY" | "NEEDS_REVIEW" | "BLOCKED";

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "info" | "warning" | "blocker";
  detail: string;
};

export type ProductReadiness = {
  productId: string;
  slug: string;
  status: ProductStatus;
  overall: ReadinessSeverity;
  checks: ReadinessCheck[];
  canPublish: boolean;
};

export type CatalogueProductListItem = {
  id: string;
  slug: string;
  title: string;
  status: ProductStatus;
  shopifyId: string | null;
  vendor: string | null;
  productType: string | null;
  sport: string | null;
  league: string | null;
  team: string | null;
  primaryImageUrl: string | null;
  variantCount: number;
  imageCount: number;
  isSeed: boolean;
};

export function assertWorkflowTransition(
  action: ProductWorkflowAction,
  current: ProductStatus
): ProductStatus {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(current)) {
    throw new Error(
      `Cannot ${action.replaceAll("_", " ")} from status "${current}". Allowed from: ${rule.from.join(", ")}.`
    );
  }
  return rule.to;
}

export async function listCatalogueProductsForAdmin(
  options: { status?: ProductStatus[]; limit?: number; shopifyOnly?: boolean } = {},
  databaseUrl?: string
): Promise<CatalogueProductListItem[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const limit = Math.min(options.limit ?? 100, 200);
  const conditions = [isNull(products.deletedAt)];

  if (options.status?.length) {
    conditions.push(inArray(products.status, options.status));
  }
  if (options.shopifyOnly) {
    conditions.push(sql`${products.shopifyId} is not null`);
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      status: products.status,
      shopifyId: products.shopifyId,
      vendor: products.vendor,
      productType: products.productType,
      sport: products.sport,
      league: products.league,
      team: products.team,
      sourcePayload: products.sourcePayload
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.updatedAt))
    .limit(limit);

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) {
    return [];
  }

  const [variantCounts, imageCounts, primaryImages] = await Promise.all([
    db
      .select({
        productId: productVariants.productId,
        count: sql<number>`count(*)::int`
      })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, ids), isNull(productVariants.deletedAt)))
      .groupBy(productVariants.productId),
    db
      .select({
        productId: productImages.productId,
        count: sql<number>`count(*)::int`
      })
      .from(productImages)
      .where(and(inArray(productImages.productId, ids), isNull(productImages.deletedAt)))
      .groupBy(productImages.productId),
    db.execute(sql`
      select distinct on (product_id) product_id, url
      from product_images
      where deleted_at is null and product_id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `
      )})
      order by product_id, sort_order asc
    `)
  ]);

  const variantMap = Object.fromEntries(variantCounts.map((row) => [row.productId, row.count]));
  const imageMap = Object.fromEntries(imageCounts.map((row) => [row.productId, row.count]));
  const primaryMap = Object.fromEntries(
    Array.from(primaryImages as unknown as Array<{ product_id: string; url: string }>).map(
      (row) => [row.product_id, row.url]
    )
  );

  return rows.map((row) => {
    const payload = (row.sourcePayload ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status as ProductStatus,
      shopifyId: row.shopifyId,
      vendor: row.vendor,
      productType: row.productType,
      sport: row.sport,
      league: row.league,
      team: row.team,
      primaryImageUrl: primaryMap[row.id] ?? null,
      variantCount: variantMap[row.id] ?? 0,
      imageCount: imageMap[row.id] ?? 0,
      isSeed: payload.seedTag === "dev-catalog-v1"
    };
  });
}

export async function evaluateProductReadiness(
  productId: string,
  databaseUrl?: string
): Promise<ProductReadiness> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);

  if (!product) {
    throw new Error("Product not found.");
  }

  const [variants, images, seo, memberships] = await Promise.all([
    db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, productId), isNull(productVariants.deletedAt))),
    db
      .select()
      .from(productImages)
      .where(and(eq(productImages.productId, productId), isNull(productImages.deletedAt))),
    db
      .select()
      .from(seoRecords)
      .where(and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, productId)))
      .limit(1),
    db
      .select({
        collectionId: collectionProducts.collectionId,
        title: collections.title,
        slug: collections.slug,
        status: collections.status
      })
      .from(collectionProducts)
      .innerJoin(collections, eq(collections.id, collectionProducts.collectionId))
      .where(and(eq(collectionProducts.productId, productId), isNull(collections.deletedAt)))
  ]);

  const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
  const customization = (payload.customizationHints ?? {}) as Record<string, unknown>;
  const seoTitleFromPayload =
    payload.seo && typeof payload.seo === "object"
      ? String((payload.seo as { title?: string }).title ?? "")
      : "";
  const seoDescFromPayload =
    payload.seo && typeof payload.seo === "object"
      ? String((payload.seo as { description?: string }).description ?? "")
      : "";

  const primaryVariant = variants[0];
  const hasPrice = Boolean(primaryVariant?.priceAmount && Number.parseFloat(primaryVariant.priceAmount) > 0);
  const hasUsableImage = images.some(
    (image) => image.url.startsWith("http://") || image.url.startsWith("https://")
  );
  const seoRow = seo[0];
  const effectiveSeoTitle = seoRow?.title || seoTitleFromPayload || product.title;
  const effectiveSeoDescription =
    seoRow?.metaDescription || seoDescFromPayload || product.description || "";
  const canonical = seoRow?.canonicalPath || `/products/${product.slug}`;

  const checks: ReadinessCheck[] = [
    {
      id: "title",
      label: "Product title",
      ok: Boolean(product.title?.trim()),
      severity: "blocker",
      detail: product.title?.trim() ? "Title present." : "Title is missing."
    },
    {
      id: "handle",
      label: "Product handle / slug",
      ok: Boolean(product.slug?.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(product.slug)),
      severity: "blocker",
      detail: product.slug ? `Handle: ${product.slug}` : "Handle/slug is missing or invalid."
    },
    {
      id: "price",
      label: "Price",
      ok: hasPrice,
      severity: "blocker",
      detail: hasPrice
        ? `${primaryVariant?.priceAmount} ${primaryVariant?.currencyCode}`
        : "No variant price > 0."
    },
    {
      id: "variants",
      label: "At least one variant",
      ok: variants.length > 0,
      severity: "blocker",
      detail: variants.length > 0 ? `${variants.length} variant(s).` : "No variants."
    },
    {
      id: "images",
      label: "At least one usable image",
      ok: hasUsableImage || images.length > 0,
      severity: hasUsableImage ? "info" : images.length > 0 ? "warning" : "blocker",
      detail: hasUsableImage
        ? `${images.length} image(s) with absolute URL.`
        : images.length > 0
          ? "Images exist but none are absolute http(s) CDN URLs."
          : "No images."
    },
    {
      id: "product_type",
      label: "Product type",
      ok: Boolean(product.productType?.trim()),
      severity: "warning",
      detail: product.productType || "Product type missing."
    },
    {
      id: "classification",
      label: "Sport / team classification",
      ok: Boolean(product.sport || product.league || product.team),
      severity: "warning",
      detail:
        [product.sport, product.league, product.team].filter(Boolean).join(" · ") ||
        "Sport/league/team not set."
    },
    {
      id: "size_options",
      label: "Product size options",
      ok: Boolean(product.optionSetId),
      severity: "warning",
      detail: product.optionSetId
        ? "Size option set linked (Aris-compatible)."
        : "No size option set — product needs review before sellable size selection."
    },
    {
      id: "size_chart",
      label: "Size chart linked",
      ok: Boolean(product.sizeChartId),
      severity: "warning",
      detail: product.sizeChartId ? "Size guide available on PDP." : "No size chart assigned."
    },
    {
      id: "customisation_profile",
      label: "Customisation profile",
      ok: Boolean(product.customisationProfileId),
      severity: "warning",
      detail: product.customisationProfileId
        ? "Customisation profile linked."
        : "No customisation profile assigned."
    },
    {
      id: "customization",
      label: "Customization configuration",
      ok: Boolean(product.customisationEnabled && product.customisationProfileId),
      severity: "info",
      detail: product.customisationEnabled
        ? "Customisation enabled on product."
        : customization.personalizationLikely
          ? "Source hints suggest personalization."
          : "No customization profile/hints."
    },
    {
      id: "seo_title",
      label: "SEO title",
      ok: Boolean(effectiveSeoTitle?.trim()),
      severity: "warning",
      detail: effectiveSeoTitle || "SEO title missing."
    },
    {
      id: "seo_description",
      label: "Meta description",
      ok: Boolean(effectiveSeoDescription?.trim()) && effectiveSeoDescription.trim().length >= 40,
      severity: "warning",
      detail: effectiveSeoDescription
        ? `Meta description length ${effectiveSeoDescription.trim().length}.`
        : "Meta description missing or very short."
    },
    {
      id: "canonical",
      label: "Canonical URL path",
      ok: Boolean(canonical?.trim()),
      severity: "info",
      detail: canonical
    },
    {
      id: "collections",
      label: "Collection membership",
      ok: memberships.length > 0,
      severity: "info",
      detail:
        memberships.length > 0
          ? memberships.map((row) => row.title).join(", ")
          : "Not linked to any collections."
    },
    {
      id: "description",
      label: "Description / source content",
      ok: Boolean(product.description?.trim() || payload.descriptionHtml),
      severity: "warning",
      detail: product.description?.trim()
        ? "Product description present."
        : payload.descriptionHtml
          ? "Source HTML present in sourcePayload (not yet promoted to description)."
          : "No description content."
    }
  ];

  const hasBlocker = checks.some((check) => !check.ok && check.severity === "blocker");
  const hasWarning = checks.some((check) => !check.ok && check.severity === "warning");
  const overall: ReadinessSeverity = hasBlocker ? "BLOCKED" : hasWarning ? "NEEDS_REVIEW" : "READY";

  return {
    productId: product.id,
    slug: product.slug,
    status: product.status as ProductStatus,
    overall,
    checks,
    canPublish: !hasBlocker
  };
}

export async function transitionProductStatus(
  input: {
    productId: string;
    action: ProductWorkflowAction;
    actor?: string;
    forcePublishDespiteWarnings?: boolean;
  },
  databaseUrl?: string
): Promise<{ productId: string; status: ProductStatus; readiness: ProductReadiness }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
    .limit(1);

  if (!product) {
    throw new Error("Product not found.");
  }

  const nextStatus = assertWorkflowTransition(input.action, product.status as ProductStatus);
  const readiness = await evaluateProductReadiness(input.productId, databaseUrl);

  if (input.action === "publish") {
    if (!readiness.canPublish) {
      throw new Error("Publish blocked: readiness checklist has blockers.");
    }
    if (readiness.overall === "NEEDS_REVIEW" && !input.forcePublishDespiteWarnings) {
      throw new Error(
        "Publish requires confirmation: readiness is NEEDS_REVIEW. Pass forcePublishDespiteWarnings to proceed."
      );
    }
  }

  await db
    .update(products)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
      updatedBy: input.actor ?? "admin-workflow"
    })
    .where(eq(products.id, input.productId));

  // Keep shopifyId / sourcePayload intact on all transitions (including unpublish).
  const refreshed = await evaluateProductReadiness(input.productId, databaseUrl);
  return {
    productId: input.productId,
    status: nextStatus,
    readiness: refreshed
  };
}

export async function ensureSeoRecordForProduct(
  productId: string,
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);

  if (!product) {
    return;
  }

  const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
  const seo =
    payload.seo && typeof payload.seo === "object"
      ? (payload.seo as { title?: string | null; description?: string | null })
      : {};

  const title = seo.title?.trim() || product.title;
  const metaDescription =
    seo.description?.trim() ||
    product.description?.trim() ||
    `Shop ${product.title} at Sports Jersey House.`;
  const canonicalPath = `/products/${product.slug}`;

  const [existing] = await db
    .select({ id: seoRecords.id })
    .from(seoRecords)
    .where(and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, productId)))
    .limit(1);

  if (existing) {
    await db
      .update(seoRecords)
      .set({
        title,
        metaDescription,
        canonicalPath,
        updatedAt: new Date(),
        updatedBy: "admin-workflow"
      })
      .where(eq(seoRecords.id, existing.id));
    return;
  }

  await db.insert(seoRecords).values({
    targetType: "product",
    targetId: productId,
    title,
    metaDescription,
    canonicalPath,
    approvalStatus: "draft",
    createdBy: "admin-workflow",
    updatedBy: "admin-workflow"
  });
}
