import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  CALIBRATABLE_CATEGORIES,
  buildImageAltText,
  draftMetaDescription,
  evaluateDescriptionQuality,
  inferTaxonomyFromCatalogueText,
  isHighConfidenceChange,
  nextCategoryModeAfterDecision,
  sportFromLeague,
  type CatalogueChangeCategory
} from "@sjh/shared";
import { createCatalogueProposal } from "./catalogue-intelligence";
import { createDatabaseClient } from "./client";
import { products, seoRecords } from "./schema-catalogue";
import {
  aiAgentCategoryModes,
  aiAgentSettings,
  aiChangeLog
} from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for catalogue agent operations.");
  }
  return url;
}

export type AiCategoryModeSnapshot = {
  category: CatalogueChangeCategory;
  mode: "learning" | "autonomous";
  consecutiveApprovals: number;
  approvalThreshold: number;
  alwaysRequireApproval: boolean;
  label: string;
  progressLabel: string;
};

export type AiAgentStatusSnapshot = {
  autonomousEnabledGlobally: boolean;
  modeLabel: "LEARNING" | "AUTONOMOUS" | "PAUSED";
  categories: AiCategoryModeSnapshot[];
};

export type AiChangeLogSnapshot = {
  id: string;
  category: string;
  productId: string | null;
  fieldName: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  confidence: string | null;
  decision: string;
  decidedBy: string | null;
  decidedAt: Date | null;
  appliedAt: Date | null;
  createdAt: Date;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getAiAgentStatus(databaseUrl?: string): Promise<AiAgentStatusSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [settings] = await db.select().from(aiAgentSettings).where(eq(aiAgentSettings.id, "default")).limit(1);
  const categories = await db.select().from(aiAgentCategoryModes).orderBy(aiAgentCategoryModes.category);

  const mapped: AiCategoryModeSnapshot[] = categories.map((row) => {
    const threshold = row.approvalThreshold;
    const consecutive = row.consecutiveApprovals;
    const mode = row.mode === "autonomous" ? "autonomous" : "learning";
    return {
      category: row.category as CatalogueChangeCategory,
      mode,
      consecutiveApprovals: consecutive,
      approvalThreshold: threshold,
      alwaysRequireApproval: row.alwaysRequireApproval,
      label: row.label,
      progressLabel:
        mode === "autonomous"
          ? `${threshold}/${threshold} → AUTONOMOUS`
          : `${Math.min(consecutive, threshold)}/${threshold} approvals`
    };
  });

  const anyAutonomous =
    (settings?.autonomousEnabled ?? true) && mapped.some((row) => row.mode === "autonomous");
  const modeLabel: AiAgentStatusSnapshot["modeLabel"] = !(settings?.autonomousEnabled ?? true)
    ? "PAUSED"
    : anyAutonomous
      ? "AUTONOMOUS"
      : "LEARNING";

  return {
    autonomousEnabledGlobally: settings?.autonomousEnabled ?? true,
    modeLabel,
    categories: mapped
  };
}

export async function setAiAgentAutonomousEnabled(
  enabled: boolean,
  actor = "admin",
  databaseUrl?: string
): Promise<AiAgentStatusSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  await db
    .update(aiAgentSettings)
    .set({
      autonomousEnabled: enabled,
      updatedAt: new Date(),
      updatedBy: actor
    })
    .where(eq(aiAgentSettings.id, "default"));
  return getAiAgentStatus(databaseUrl);
}

async function getCategoryRow(category: CatalogueChangeCategory, databaseUrl?: string) {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db
    .select()
    .from(aiAgentCategoryModes)
    .where(eq(aiAgentCategoryModes.category, category))
    .limit(1);
  if (!row) {
    throw new Error(`Unknown AI catalogue category: ${category}`);
  }
  return row;
}

export async function isCategoryAutonomous(
  category: CatalogueChangeCategory,
  databaseUrl?: string
): Promise<boolean> {
  const status = await getAiAgentStatus(databaseUrl);
  if (!status.autonomousEnabledGlobally) {
    return false;
  }
  const row = status.categories.find((entry) => entry.category === category);
  if (!row || row.alwaysRequireApproval) {
    return false;
  }
  return row.mode === "autonomous";
}

/**
 * Record a decision. Three consecutive approvals flip the category to AUTONOMOUS.
 * A rejection resets the consecutive approval streak.
 */
export async function decideAiChange(
  input: {
    changeId: string;
    decision: "approved" | "rejected";
    actor?: string;
  },
  databaseUrl?: string
): Promise<{ change: AiChangeLogSnapshot; categoryMode: AiCategoryModeSnapshot }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [change] = await db.select().from(aiChangeLog).where(eq(aiChangeLog.id, input.changeId)).limit(1);
  if (!change) {
    throw new Error("AI change not found.");
  }
  if (change.decision !== "pending") {
    throw new Error(`Change already decided as ${change.decision}.`);
  }

  const category = change.category as CatalogueChangeCategory;
  const categoryRow = await getCategoryRow(category, databaseUrl);
  const actor = input.actor ?? "admin";

  if (input.decision === "approved") {
    await applyAiChange(change.id, actor, databaseUrl);

    const next = nextCategoryModeAfterDecision({
      currentMode: categoryRow.mode === "autonomous" ? "autonomous" : "learning",
      consecutiveApprovals: categoryRow.consecutiveApprovals,
      threshold: categoryRow.approvalThreshold,
      alwaysRequireApproval: categoryRow.alwaysRequireApproval,
      decision: "approved"
    });

    await db
      .update(aiAgentCategoryModes)
      .set({
        consecutiveApprovals: next.consecutiveApprovals,
        mode: next.mode,
        updatedAt: new Date(),
        updatedBy: actor
      })
      .where(eq(aiAgentCategoryModes.category, category));
  } else {
    await db
      .update(aiChangeLog)
      .set({
        decision: "rejected",
        decidedBy: actor,
        decidedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiChangeLog.id, change.id));

    await db
      .update(aiAgentCategoryModes)
      .set({
        consecutiveApprovals: 0,
        mode: categoryRow.alwaysRequireApproval ? categoryRow.mode : "learning",
        updatedAt: new Date(),
        updatedBy: actor
      })
      .where(eq(aiAgentCategoryModes.category, category));
  }

  const [updatedChange] = await db.select().from(aiChangeLog).where(eq(aiChangeLog.id, change.id)).limit(1);
  const status = await getAiAgentStatus(databaseUrl);
  const categoryMode = status.categories.find((entry) => entry.category === category)!;

  return {
    change: mapChange(updatedChange!),
    categoryMode
  };
}

async function applyAiChange(
  changeId: string,
  actor: string,
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [change] = await db.select().from(aiChangeLog).where(eq(aiChangeLog.id, changeId)).limit(1);
  if (!change) {
    return;
  }

  // Never rewrite product titles.
  if (change.fieldName === "title") {
    await db
      .update(aiChangeLog)
      .set({
        decision: "cancelled",
        decidedBy: actor,
        decidedAt: new Date(),
        metadata: {
          ...(change.metadata as object),
          cancelledReason: "Product titles are never modified by the catalogue agent."
        },
        updatedAt: new Date()
      })
      .where(eq(aiChangeLog.id, changeId));
    return;
  }

  if (change.productId && change.category === "taxonomy") {
    const patch = (change.newValue ?? {}) as Record<string, unknown>;
    await db
      .update(products)
      .set({
        ...(typeof patch.sport === "string" ? { sport: patch.sport } : {}),
        ...(typeof patch.league === "string" ? { league: patch.league } : {}),
        ...(typeof patch.team === "string" ? { team: patch.team } : {}),
        ...(typeof patch.player === "string" ? { playerName: patch.player } : {}),
        ...(typeof patch.productType === "string" ? { productType: patch.productType } : {}),
        updatedAt: new Date(),
        updatedBy: actor
      })
      .where(eq(products.id, change.productId));
  }

  if (change.productId && change.category === "descriptions" && change.fieldName === "description") {
    const next = typeof change.newValue === "string" ? change.newValue : String(change.newValue ?? "");
    await db
      .update(products)
      .set({
        description: next,
        updatedAt: new Date(),
        updatedBy: actor
      })
      .where(eq(products.id, change.productId));
  }

  if (change.productId && change.category === "seo") {
    const next = (change.newValue ?? {}) as {
      title?: string;
      metaDescription?: string;
      canonicalPath?: string;
      imageAltText?: string;
    };
    const [existing] = await db
      .select()
      .from(seoRecords)
      .where(and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, change.productId)))
      .limit(1);

    // SEO works WITH the product title — store meta fields, do not overwrite products.title.
    if (existing) {
      await db
        .update(seoRecords)
        .set({
          ...(next.metaDescription ? { metaDescription: next.metaDescription } : {}),
          ...(next.canonicalPath ? { canonicalPath: next.canonicalPath } : {}),
          ...(next.title ? { title: next.title } : {}),
          updatedAt: new Date(),
          updatedBy: actor
        })
        .where(eq(seoRecords.id, existing.id));
    } else if (change.productId) {
      await db.insert(seoRecords).values({
        targetType: "product",
        targetId: change.productId,
        title: next.title ?? null,
        metaDescription: next.metaDescription ?? null,
        canonicalPath: next.canonicalPath ?? null,
        approvalStatus: "approved",
        createdBy: actor,
        updatedBy: actor
      });
    }

    if (next.imageAltText) {
      // Store alt suggestion on product source payload metadata only (non-destructive).
      const [product] = await db
        .select({ sourcePayload: products.sourcePayload })
        .from(products)
        .where(eq(products.id, change.productId))
        .limit(1);
      if (product) {
        await db
          .update(products)
          .set({
            sourcePayload: {
              ...(product.sourcePayload as object),
              suggestedImageAltText: next.imageAltText
            },
            updatedAt: new Date(),
            updatedBy: actor
          })
          .where(eq(products.id, change.productId));
      }
    }
  }

  // retirement / new_listing / collections: proposals only — never hard-delete, never auto-publish.
  if (change.category === "retirement" || change.category === "new_listing") {
    // Already represented as catalogue proposals when created; apply = mark change applied only.
  }

  await db
    .update(aiChangeLog)
    .set({
      decision: change.decision === "pending" ? "approved" : change.decision,
      decidedBy: actor,
      decidedAt: new Date(),
      appliedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(aiChangeLog.id, changeId));
}

function mapChange(row: typeof aiChangeLog.$inferSelect): AiChangeLogSnapshot {
  return {
    id: row.id,
    category: row.category,
    productId: row.productId,
    fieldName: row.fieldName,
    previousValue: row.previousValue,
    newValue: row.newValue,
    reason: row.reason,
    confidence: row.confidence,
    decision: row.decision,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    appliedAt: row.appliedAt,
    createdAt: row.createdAt
  };
}

export async function listPendingAiChanges(
  limit = 50,
  databaseUrl?: string
): Promise<AiChangeLogSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(aiChangeLog)
    .where(eq(aiChangeLog.decision, "pending"))
    .orderBy(desc(aiChangeLog.createdAt))
    .limit(limit);
  return rows.map(mapChange);
}

export async function listRecentAiChanges(
  limit = 50,
  databaseUrl?: string
): Promise<AiChangeLogSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(aiChangeLog)
    .orderBy(desc(aiChangeLog.createdAt))
    .limit(limit);
  return rows.map(mapChange);
}

async function enqueueChange(
  input: {
    category: CatalogueChangeCategory;
    productId?: string | null;
    fieldName: string;
    previousValue: unknown;
    newValue: unknown;
    reason: string;
    confidence: number;
    metadata?: Record<string, unknown>;
  },
  databaseUrl?: string
): Promise<{ changeId: string; decision: string }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const autonomous = await isCategoryAutonomous(input.category, databaseUrl);

  const [created] = await db
    .insert(aiChangeLog)
    .values({
      category: input.category,
      productId: input.productId ?? null,
      fieldName: input.fieldName,
      previousValue: input.previousValue as object,
      newValue: input.newValue as object,
      reason: input.reason,
      confidence: input.confidence.toFixed(2),
      decision: autonomous ? "pending" : "pending",
      metadata: {
        ...(input.metadata ?? {}),
        titlePolicy: "never_rewrite_product_title"
      }
    })
    .returning();

  if (!created) {
    throw new Error("Failed to enqueue AI change.");
  }

  if (autonomous) {
    await applyAiChange(created.id, "ai-autonomous", databaseUrl);
    await db
      .update(aiChangeLog)
      .set({
        decision: "auto_applied",
        decidedBy: "ai-autonomous",
        decidedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiChangeLog.id, created.id));
    return { changeId: created.id, decision: "auto_applied" };
  }

  return { changeId: created.id, decision: "pending" };
}

export type CatalogueAgentRunResult = {
  productsScanned: number;
  changesProposed: number;
  changesAutoApplied: number;
  newListingProposals: number;
  skippedTitleRewrites: number;
};

/**
 * Simplified intelligence pass over Shopify-imported products.
 * Never rewrites titles. Never hard-deletes. Never auto-publishes.
 */
export async function runSimplifiedCatalogueAgent(
  options: { limit?: number; productIds?: string[] } = {},
  databaseUrl?: string
): Promise<CatalogueAgentRunResult> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const limit = Math.min(options.limit ?? 80, 600);

  const conditions = [isNull(products.deletedAt), sql`${products.shopifyId} is not null`];
  if (options.productIds?.length) {
    conditions.push(inArray(products.id, options.productIds));
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.updatedAt))
    .limit(limit);

  let changesProposed = 0;
  let changesAutoApplied = 0;
  let newListingProposals = 0;
  const skippedTitleRewrites = 0;

  for (const product of rows) {
    const payload = (product.sourcePayload ?? {}) as Record<string, unknown>;
    const tags = Array.isArray(payload.tags) ? (payload.tags as string[]) : [];
    const sourceHtml = typeof payload.descriptionHtml === "string" ? payload.descriptionHtml : null;

    const inferred = inferTaxonomyFromCatalogueText({
      title: product.title,
      tags,
      productType: product.productType,
      existing: {
        sport: product.sport,
        league: product.league,
        team: product.team,
        player: product.playerName,
        productType: product.productType
      }
    });

    // Ensure sport follows league mapping (NFL → Football) without removing league.
    if (inferred.league && !inferred.sport) {
      inferred.sport = sportFromLeague(inferred.league);
    }

    const taxonomyPatch: Record<string, string> = {};
    if (inferred.sport && inferred.sport !== product.sport) taxonomyPatch.sport = inferred.sport;
    if (inferred.league && inferred.league !== product.league) taxonomyPatch.league = inferred.league;
    if (inferred.team && inferred.team !== product.team) taxonomyPatch.team = inferred.team;
    if (inferred.player && inferred.player !== product.playerName) {
      taxonomyPatch.player = inferred.player;
    }
    if (inferred.productType && inferred.productType !== product.productType) {
      taxonomyPatch.productType = inferred.productType;
    }

    if (Object.keys(taxonomyPatch).length > 0) {
      const result = await enqueueChange(
        {
          category: "taxonomy",
          productId: product.id,
          fieldName: "taxonomy",
          previousValue: {
            sport: product.sport,
            league: product.league,
            team: product.team,
            player: product.playerName,
            productType: product.productType
          },
          newValue: taxonomyPatch,
          reason: "Fill/normalize structured discovery fields from title/tags/league mapping. Title unchanged.",
          confidence: 0.82,
          metadata: { displayCategory: inferred.sport ? `${inferred.sport} Jerseys` : null }
        },
        databaseUrl
      );
      changesProposed += 1;
      if (result.decision === "auto_applied") changesAutoApplied += 1;
    }

    const descriptionDecision = evaluateDescriptionQuality({
      title: product.title,
      description: product.description,
      sourceHtml
    });

    if (descriptionDecision.action === "improve" && sourceHtml) {
      const cleaned = stripHtml(sourceHtml);
      if (cleaned && cleaned !== product.description) {
        const result = await enqueueChange(
          {
            category: "descriptions",
            productId: product.id,
            fieldName: "description",
            previousValue: product.description,
            newValue: cleaned,
            reason: descriptionDecision.reason,
            confidence: 0.75
          },
          databaseUrl
        );
        changesProposed += 1;
        if (result.decision === "auto_applied") changesAutoApplied += 1;
      }
    }

    const [existingSeo] = await db
      .select({ id: seoRecords.id, metaDescription: seoRecords.metaDescription })
      .from(seoRecords)
      .where(and(eq(seoRecords.targetType, "product"), eq(seoRecords.targetId, product.id)))
      .limit(1);

    if (!existingSeo?.metaDescription) {
      const metaDescription = draftMetaDescription({
        title: product.title,
        description: product.description,
        team: inferred.team ?? product.team,
        league: inferred.league ?? product.league,
        sport: inferred.sport ?? product.sport
      });
      const imageAlt = buildImageAltText({
        title: product.title,
        team: inferred.team ?? product.team,
        player: inferred.player ?? product.playerName
      });

      const result = await enqueueChange(
        {
          category: "seo",
          productId: product.id,
          fieldName: "seo_metadata",
          previousValue: existingSeo
            ? { metaDescription: existingSeo.metaDescription }
            : null,
          newValue: {
            title: product.title,
            metaDescription,
            canonicalPath: `/products/${product.slug}`,
            imageAltText: imageAlt
          },
          reason:
            "SEO works with the existing product title. Propose meta description, canonical, and alt text only.",
          confidence: 0.8
        },
        databaseUrl
      );
      changesProposed += 1;
      if (result.decision === "auto_applied") changesAutoApplied += 1;
    }
  }

  // Simple missing-listing opportunity from teams present in sample (no auto-publish).
  const teams = [
    ...new Set(rows.map((row) => row.team).filter((team): team is string => Boolean(team)))
  ].slice(0, 5);

  for (const team of teams) {
    const year = new Date().getFullYear();
    const suggestedTitle = `${team} ${year} Home Jersey`;
    const existing = rows.some((row) =>
      row.title.toLowerCase().includes(`${year}`) && row.team?.toLowerCase() === team.toLowerCase()
    );
    if (existing) {
      continue;
    }

    await createCatalogueProposal(
      {
        recommendation: "CREATE_NEW_LISTING",
        title: suggestedTitle,
        rationale: `${suggestedTitle} appears to be a likely catalogue opportunity based on team coverage in the imported sample.`,
        evidence: [
          {
            type: "opportunity",
            team,
            year,
            note: "Suggestion only — admin decides whether SJH should create the listing."
          }
        ],
        proposedChanges: {
          suggestedTitle,
          team,
          sport: null,
          league: null,
          productType: "Jersey",
          autoPublish: false
        },
        ipRiskLevel: "low"
      },
      databaseUrl
    );

    await enqueueChange(
      {
        category: "new_listing",
        productId: null,
        fieldName: "create_new_listing",
        previousValue: null,
        newValue: { suggestedTitle, team, productType: "Jersey" },
        reason: "Catalogue opportunity suggestion — never auto-published.",
        confidence: 0.55,
        metadata: { requiresHumanDecision: true }
      },
      databaseUrl
    );
    newListingProposals += 1;
    changesProposed += 1;
  }

  return {
    productsScanned: rows.length,
    changesProposed,
    changesAutoApplied,
    newListingProposals,
    skippedTitleRewrites
  };
}

export type CalibrationApplyResult = {
  category: CatalogueChangeCategory;
  calibrated: number;
  autoApplied: number;
  leftPending: number;
  mode: "learning" | "autonomous";
  progressLabel: string;
};

/**
 * System calibration: apply first N high-confidence, low-risk pending changes per category
 * as `system-calibration` (not user approvals). After 3 consecutive calibrations, category
 * becomes AUTONOMOUS and remaining high-confidence pending changes are auto-applied.
 *
 * Never calibrates retirement / new_listing into destructive auto-apply of products.
 */
export async function calibrateAndApplyPendingChanges(
  options: {
    categories?: CatalogueChangeCategory[];
    minConfidence?: number;
    calibrationCount?: number;
  } = {},
  databaseUrl?: string
): Promise<{
  results: CalibrationApplyResult[];
  status: AiAgentStatusSnapshot;
  totalCalibrated: number;
  totalAutoApplied: number;
}> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const categories = options.categories ?? CALIBRATABLE_CATEGORIES;
  const calibrationCount = options.calibrationCount ?? 3;
  const results: CalibrationApplyResult[] = [];
  let totalCalibrated = 0;
  let totalAutoApplied = 0;

  for (const category of categories) {
    const categoryRow = await getCategoryRow(category, databaseUrl);
    if (categoryRow.alwaysRequireApproval) {
      results.push({
        category,
        calibrated: 0,
        autoApplied: 0,
        leftPending: 0,
        mode: categoryRow.mode === "autonomous" ? "autonomous" : "learning",
        progressLabel: "always human"
      });
      continue;
    }

    const pending = await db
      .select()
      .from(aiChangeLog)
      .where(and(eq(aiChangeLog.category, category), eq(aiChangeLog.decision, "pending")))
      .orderBy(desc(aiChangeLog.confidence), desc(aiChangeLog.createdAt));

    const highConfidence = pending.filter((row) => isHighConfidenceChange(row.confidence));
    let calibrated = 0;
    let autoApplied = 0;

    let mode: "learning" | "autonomous" =
      categoryRow.mode === "autonomous" ? "autonomous" : "learning";
    let consecutive = categoryRow.consecutiveApprovals;

    // If still learning, calibrate up to threshold with system-calibration actor.
    if (mode === "learning") {
      const needed = Math.max(0, categoryRow.approvalThreshold - consecutive);
      const toCalibrate = highConfidence.slice(0, Math.min(calibrationCount, needed || calibrationCount));

      for (const change of toCalibrate) {
        await applyAiChange(change.id, "system-calibration", databaseUrl);
        await db
          .update(aiChangeLog)
          .set({
            decision: "approved",
            decidedBy: "system-calibration",
            decidedAt: new Date(),
            metadata: {
              ...(change.metadata as object),
              calibration: true,
              note: "System calibration decision — not a user approval."
            },
            updatedAt: new Date()
          })
          .where(eq(aiChangeLog.id, change.id));

        const next = nextCategoryModeAfterDecision({
          currentMode: mode,
          consecutiveApprovals: consecutive,
          threshold: categoryRow.approvalThreshold,
          alwaysRequireApproval: false,
          decision: "approved"
        });
        consecutive = next.consecutiveApprovals;
        mode = next.mode;
        calibrated += 1;
      }

      await db
        .update(aiAgentCategoryModes)
        .set({
          consecutiveApprovals: consecutive,
          mode,
          updatedAt: new Date(),
          updatedBy: "system-calibration"
        })
        .where(eq(aiAgentCategoryModes.category, category));
    }

    // Once autonomous (or already was), apply remaining high-confidence pending.
    if (mode === "autonomous" && (await getAiAgentStatus(databaseUrl)).autonomousEnabledGlobally) {
      const remaining = await db
        .select()
        .from(aiChangeLog)
        .where(and(eq(aiChangeLog.category, category), eq(aiChangeLog.decision, "pending")))
        .orderBy(desc(aiChangeLog.createdAt));

      for (const change of remaining) {
        if (!isHighConfidenceChange(change.confidence)) {
          continue;
        }
        await applyAiChange(change.id, "ai-autonomous", databaseUrl);
        await db
          .update(aiChangeLog)
          .set({
            decision: "auto_applied",
            decidedBy: "ai-autonomous",
            decidedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(aiChangeLog.id, change.id));
        autoApplied += 1;
      }
    }

    const leftPending = (
      await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiChangeLog)
        .where(and(eq(aiChangeLog.category, category), eq(aiChangeLog.decision, "pending")))
    )[0]?.count ?? 0;

    totalCalibrated += calibrated;
    totalAutoApplied += autoApplied;

    results.push({
      category,
      calibrated,
      autoApplied,
      leftPending,
      mode,
      progressLabel:
        mode === "autonomous"
          ? `${categoryRow.approvalThreshold}/${categoryRow.approvalThreshold} → AUTONOMOUS`
          : `${consecutive}/${categoryRow.approvalThreshold} approvals`
    });
  }

  return {
    results,
    status: await getAiAgentStatus(databaseUrl),
    totalCalibrated,
    totalAutoApplied
  };
}
