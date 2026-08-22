import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { productImages, products } from "./schema-catalogue";
import {
  catalogueProposals,
  catalogueReviewQueue,
  contentIpRiskFlags,
  productCatalogueSignals
} from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for catalogue intelligence.");
  }
  return url;
}

export type CatalogueRecommendation =
  | "KEEP"
  | "UPDATE"
  | "REVIEW"
  | "RETIRE"
  | "DUPLICATE"
  | "CREATE_NEW_LISTING";

export type ProductSignalSnapshot = {
  id: string;
  productId: string | null;
  qualityScore: string | null;
  healthStatus: string;
  lifecycleLabel: string | null;
  isOutdated: boolean;
  isDuplicateSuspect: boolean;
  missingOpportunity: boolean;
  marginFlag: string | null;
  contentFlag: string | null;
  signals: unknown;
  evidence: unknown;
  computedAt: Date;
};

export type CatalogueProposalSnapshot = {
  id: string;
  proposalNumber: string;
  recommendation: CatalogueRecommendation;
  status: string;
  productId: string | null;
  title: string;
  rationale: string;
  evidence: unknown;
  proposedChanges: unknown;
  ipRiskLevel: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
};

export type CatalogueReviewQueueSnapshot = {
  id: string;
  proposalId: string;
  priority: number;
  queueStatus: string;
  assignedTo: string | null;
  proposalNumber: string | null;
  recommendation: CatalogueRecommendation | null;
  title: string | null;
  createdAt: Date;
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter((token) => token.length > 2));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.max(a.size, b.size);
}

function extractYears(title: string): number[] {
  const matches = title.match(/\b(19|20)\d{2}\b/g);
  if (!matches) {
    return [];
  }
  return matches.map((year) => Number.parseInt(year, 10)).filter((year) => Number.isFinite(year));
}

function mapSignal(row: typeof productCatalogueSignals.$inferSelect): ProductSignalSnapshot {
  return {
    id: row.id,
    productId: row.productId,
    qualityScore: row.qualityScore,
    healthStatus: row.healthStatus,
    lifecycleLabel: row.lifecycleLabel,
    isOutdated: row.isOutdated,
    isDuplicateSuspect: row.isDuplicateSuspect,
    missingOpportunity: row.missingOpportunity,
    marginFlag: row.marginFlag,
    contentFlag: row.contentFlag,
    signals: row.signals,
    evidence: row.evidence,
    computedAt: row.computedAt
  };
}

function mapProposal(row: typeof catalogueProposals.$inferSelect): CatalogueProposalSnapshot {
  return {
    id: row.id,
    proposalNumber: row.proposalNumber,
    recommendation: row.recommendation as CatalogueRecommendation,
    status: row.status,
    productId: row.productId,
    title: row.title,
    rationale: row.rationale,
    evidence: row.evidence,
    proposedChanges: row.proposedChanges,
    ipRiskLevel: row.ipRiskLevel,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt
  };
}

/**
 * Compute catalogue quality / outdated / duplicate-suspect signals.
 * Never deletes products — signals and proposals only.
 */
export async function computeProductSignals(
  productId?: string,
  databaseUrl?: string,
  options?: { scope?: "published" | "shopify_imports" | "all" }
): Promise<ProductSignalSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const currentYear = new Date().getFullYear();
  const outdatedYearThreshold = currentYear - 2;
  const scope = options?.scope ?? "published";

  let productRows;
  if (productId) {
    productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)));
  } else if (scope === "shopify_imports") {
    productRows = await db
      .select()
      .from(products)
      .where(and(isNull(products.deletedAt), sql`${products.shopifyId} is not null`));
  } else if (scope === "all") {
    productRows = await db.select().from(products).where(isNull(products.deletedAt));
  } else {
    productRows = await db
      .select()
      .from(products)
      .where(and(eq(products.status, "published"), isNull(products.deletedAt)));
  }

  const comparisonScope =
    scope === "shopify_imports" || scope === "all"
      ? productRows
      : await db
          .select({
            id: products.id,
            title: products.title,
            team: products.team,
            status: products.status
          })
          .from(products)
          .where(and(eq(products.status, "published"), isNull(products.deletedAt)));

  const allPublished = comparisonScope.map((row) => ({
    id: row.id,
    title: row.title,
    team: row.team,
    status: row.status
  }));

  const tokenByProduct = new Map(
    allPublished.map((row) => [row.id, titleTokens(row.title)] as const)
  );

  const results: ProductSignalSnapshot[] = [];

  for (const product of productRows) {
    const [imageCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productImages)
      .where(and(eq(productImages.productId, product.id), isNull(productImages.deletedAt)));

    const hasTitle = Boolean(product.title?.trim());
    const hasDescription = Boolean(product.description?.trim());
    const imageCount = imageCountRow?.count ?? 0;
    const hasImage = imageCount > 0;

    let qualityScore = 0;
    if (hasTitle) qualityScore += 40;
    if (hasDescription) qualityScore += 30;
    if (hasImage) qualityScore += 30;

    const years = extractYears(product.title);
    const isOutdatedByYear = years.some((year) => year < outdatedYearThreshold);
    const isOutdated = product.status === "archived" || isOutdatedByYear;

    const ownTokens = tokenByProduct.get(product.id) ?? titleTokens(product.title);
    const duplicateIds: string[] = [];
    for (const other of allPublished) {
      if (other.id === product.id) {
        continue;
      }
      const sameTeam =
        Boolean(product.team) &&
        Boolean(other.team) &&
        product.team!.toLowerCase() === other.team!.toLowerCase();
      const otherTokens = tokenByProduct.get(other.id) ?? titleTokens(other.title);
      const overlap = tokenOverlap(ownTokens, otherTokens);
      if (overlap >= 0.7 || (sameTeam && overlap >= 0.45)) {
        duplicateIds.push(other.id);
      }
    }
    const isDuplicateSuspect = duplicateIds.length > 0;

    let healthStatus = "healthy";
    if (isOutdated || isDuplicateSuspect || qualityScore < 50) {
      healthStatus = "needs_review";
    }
    if (qualityScore < 30 || (isOutdated && isDuplicateSuspect)) {
      healthStatus = "at_risk";
    }

    const lifecycleLabel = isOutdated ? "outdated" : product.status === "published" ? "active" : product.status;
    const evidence = [
      { kind: "quality", hasTitle, hasDescription, imageCount },
      ...(isOutdatedByYear ? [{ kind: "outdated_year", years, threshold: outdatedYearThreshold }] : []),
      ...(isDuplicateSuspect ? [{ kind: "duplicate_suspect", productIds: duplicateIds }] : [])
    ];

    const signals = {
      qualityScore,
      hasTitle,
      hasDescription,
      hasImage,
      imageCount,
      isOutdated,
      isDuplicateSuspect,
      duplicateIds
    };

    const [existing] = await db
      .select({ id: productCatalogueSignals.id })
      .from(productCatalogueSignals)
      .where(eq(productCatalogueSignals.productId, product.id))
      .orderBy(desc(productCatalogueSignals.computedAt))
      .limit(1);

    const now = new Date();
    const values = {
      productId: product.id,
      qualityScore: qualityScore.toFixed(2),
      healthStatus,
      lifecycleLabel,
      isOutdated,
      isDuplicateSuspect,
      missingOpportunity: false,
      marginFlag: null as string | null,
      contentFlag: qualityScore < 50 ? "thin_content" : null,
      signals,
      evidence,
      computedAt: now,
      updatedAt: now
    };

    let row: typeof productCatalogueSignals.$inferSelect | undefined;
    if (existing) {
      const [updated] = await db
        .update(productCatalogueSignals)
        .set(values)
        .where(eq(productCatalogueSignals.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [created] = await db.insert(productCatalogueSignals).values(values).returning();
      row = created;
    }

    if (row) {
      results.push(mapSignal(row));
    }
  }

  return results;
}

export async function createCatalogueProposal(
  input: {
    recommendation: CatalogueRecommendation;
    title: string;
    rationale: string;
    evidence?: unknown[];
    productId?: string;
    proposedChanges?: Record<string, unknown>;
    ipRiskLevel?: string;
  },
  databaseUrl?: string
): Promise<CatalogueProposalSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));

  const [created] = await db
    .insert(catalogueProposals)
    .values({
      recommendation: input.recommendation,
      status: "pending_review",
      title: input.title.trim(),
      rationale: input.rationale.trim(),
      evidence: input.evidence ?? [],
      proposedChanges: input.proposedChanges ?? {},
      ipRiskLevel: input.ipRiskLevel ?? "low",
      ...(input.productId ? { productId: input.productId } : {})
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create catalogue proposal.");
  }

  await db.insert(catalogueReviewQueue).values({
    proposalId: created.id,
    priority:
      input.recommendation === "RETIRE" || input.recommendation === "DUPLICATE" ? 50 : 100,
    queueStatus: "open"
  });

  return mapProposal(created);
}

export async function listCatalogueProposals(
  limit = 50,
  databaseUrl?: string
): Promise<CatalogueProposalSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(catalogueProposals)
    .where(isNull(catalogueProposals.deletedAt))
    .orderBy(desc(catalogueProposals.createdAt))
    .limit(limit);
  return rows.map(mapProposal);
}

export async function listReviewQueue(
  limit = 50,
  databaseUrl?: string
): Promise<CatalogueReviewQueueSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select({
      id: catalogueReviewQueue.id,
      proposalId: catalogueReviewQueue.proposalId,
      priority: catalogueReviewQueue.priority,
      queueStatus: catalogueReviewQueue.queueStatus,
      assignedTo: catalogueReviewQueue.assignedTo,
      createdAt: catalogueReviewQueue.createdAt,
      proposalNumber: catalogueProposals.proposalNumber,
      recommendation: catalogueProposals.recommendation,
      title: catalogueProposals.title
    })
    .from(catalogueReviewQueue)
    .innerJoin(catalogueProposals, eq(catalogueReviewQueue.proposalId, catalogueProposals.id))
    .where(eq(catalogueReviewQueue.queueStatus, "open"))
    .orderBy(catalogueReviewQueue.priority, desc(catalogueReviewQueue.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    proposalId: row.proposalId,
    priority: row.priority,
    queueStatus: row.queueStatus,
    assignedTo: row.assignedTo,
    proposalNumber: row.proposalNumber,
    recommendation: row.recommendation as CatalogueRecommendation,
    title: row.title,
    createdAt: row.createdAt
  }));
}

/**
 * Human review only. Approved stays approved — never auto-applies publish/delete.
 */
export async function reviewCatalogueProposal(
  proposalNumber: string,
  input: {
    decision: "approved" | "rejected";
    reviewedBy: string;
    notes?: string;
  },
  databaseUrl?: string
): Promise<CatalogueProposalSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [existing] = await db
    .select()
    .from(catalogueProposals)
    .where(
      and(
        eq(catalogueProposals.proposalNumber, proposalNumber),
        isNull(catalogueProposals.deletedAt)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Catalogue proposal not found.");
  }

  const now = new Date();
  // status becomes approved|rejected — never "applied" here (human applies later).
  const status = input.decision === "approved" ? "approved" : "rejected";

  const [updated] = await db
    .update(catalogueProposals)
    .set({
      status,
      reviewedBy: input.reviewedBy.trim(),
      reviewedAt: now,
      ...(input.notes !== undefined ? { reviewNotes: input.notes.trim() || null } : {}),
      updatedAt: now
    })
    .where(eq(catalogueProposals.id, existing.id))
    .returning();

  if (!updated) {
    throw new Error("Failed to review catalogue proposal.");
  }

  await db
    .update(catalogueReviewQueue)
    .set({
      queueStatus: input.decision === "approved" ? "approved" : "rejected",
      updatedAt: now
    })
    .where(eq(catalogueReviewQueue.proposalId, existing.id));

  return mapProposal(updated);
}

/**
 * Publishing / compliance risk flag only.
 * Must NOT block search indexing or storefront discovery.
 */
export async function flagContentIpRisk(
  input: {
    productId?: string;
    proposalId?: string;
    term: string;
    context?: string;
    riskLevel?: string;
  },
  databaseUrl?: string
): Promise<{ id: string; term: string; riskLevel: string; status: string }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));

  const [created] = await db
    .insert(contentIpRiskFlags)
    .values({
      term: input.term.trim(),
      riskLevel: input.riskLevel ?? "medium",
      status: "open",
      notes: "Publishing risk only — must not block search.",
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.proposalId ? { proposalId: input.proposalId } : {}),
      ...(input.context !== undefined ? { context: input.context } : {})
    })
    .returning();

  if (!created) {
    throw new Error("Failed to flag content IP risk.");
  }

  return {
    id: created.id,
    term: created.term,
    riskLevel: created.riskLevel,
    status: created.status
  };
}
