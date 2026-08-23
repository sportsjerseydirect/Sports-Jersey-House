import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { applyMappedSupplierCosts } from "./margins";
import { createDatabaseClient } from "./client";
import { opsJobRuns, trackingExceptions } from "./schema-ops";
import { orderItems, orders, purchaseOrders, suppliers } from "./schema-commerce";
import { detectAndPersistSlaExceptions } from "./ops-sla";
import { createPurchaseOrderBatch } from "./suppliers";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for ops job operations.");
  }
  return url;
}

export type OpsJobType =
  | "daily_po_batch"
  | "supplier_tracking_request"
  | "tracking_ingest_check"
  | "ops_exception_detection"
  | "margin_cost_refresh";

export type OpsJobRunSnapshot = {
  id: string;
  jobType: string;
  idempotencyKey: string;
  status: string;
  dryRun: boolean;
  allowExternalSend: boolean;
  inputPayload: unknown;
  resultPayload: unknown;
  errorMessage: string | null;
  attemptCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
};

function mapOpsJobRun(row: typeof opsJobRuns.$inferSelect): OpsJobRunSnapshot {
  return {
    id: row.id,
    jobType: row.jobType,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    dryRun: row.dryRun,
    allowExternalSend: row.allowExternalSend,
    inputPayload: row.inputPayload,
    resultPayload: row.resultPayload,
    errorMessage: row.errorMessage,
    attemptCount: row.attemptCount,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt
  };
}

function resolveAllowExternalSend(requested?: boolean): boolean {
  // Never default to true; force false unless outbound email is explicitly enabled.
  if (process.env.ENABLE_OUTBOUND_EMAIL !== "true") {
    return false;
  }
  return requested === true;
}

export async function startOpsJobRun(
  input: {
    jobType: OpsJobType;
    idempotencyKey: string;
    dryRun?: boolean;
    inputPayload?: Record<string, unknown>;
    allowExternalSend?: boolean;
  },
  databaseUrl?: string
): Promise<OpsJobRunSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const idempotencyKey = input.idempotencyKey.trim();
  const dryRun = input.dryRun ?? true;
  const allowExternalSend = resolveAllowExternalSend(input.allowExternalSend);
  const inputPayload = input.inputPayload ?? {};

  const [existing] = await db
    .select()
    .from(opsJobRuns)
    .where(eq(opsJobRuns.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing && (existing.status === "succeeded" || existing.status === "running")) {
    return mapOpsJobRun(existing);
  }

  const now = new Date();

  if (existing) {
    const [updated] = await db
      .update(opsJobRuns)
      .set({
        jobType: input.jobType,
        status: "running",
        dryRun,
        allowExternalSend,
        inputPayload,
        resultPayload: null,
        errorMessage: null,
        attemptCount: existing.attemptCount + 1,
        startedAt: now,
        finishedAt: null,
        updatedAt: now
      })
      .where(eq(opsJobRuns.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to restart ops job run.");
    }
    return mapOpsJobRun(updated);
  }

  const [created] = await db
    .insert(opsJobRuns)
    .values({
      jobType: input.jobType,
      idempotencyKey,
      status: "running",
      dryRun,
      allowExternalSend,
      inputPayload,
      attemptCount: 1,
      startedAt: now
    })
    .returning();

  if (!created) {
    throw new Error("Failed to start ops job run.");
  }
  return mapOpsJobRun(created);
}

export async function finishOpsJobRun(
  id: string,
  input: {
    status: "succeeded" | "failed" | "skipped";
    resultPayload?: Record<string, unknown>;
    errorMessage?: string;
  },
  databaseUrl?: string
): Promise<OpsJobRunSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const now = new Date();

  const [updated] = await db
    .update(opsJobRuns)
    .set({
      status: input.status,
      ...(input.resultPayload !== undefined ? { resultPayload: input.resultPayload } : {}),
      ...(input.errorMessage !== undefined
        ? { errorMessage: input.errorMessage.trim() || null }
        : {}),
      finishedAt: now,
      updatedAt: now
    })
    .where(eq(opsJobRuns.id, id))
    .returning();

  if (!updated) {
    throw new Error("Ops job run not found.");
  }
  return mapOpsJobRun(updated);
}

export async function listOpsJobRuns(
  limit = 50,
  databaseUrl?: string
): Promise<OpsJobRunSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(opsJobRuns)
    .orderBy(desc(opsJobRuns.createdAt))
    .limit(limit);
  return rows.map(mapOpsJobRun);
}

async function countEligiblePoLines(
  db: ReturnType<typeof createDatabaseClient>
): Promise<{ eligibleLineCount: number; skippedUnmapped: number }> {
  const eligible = await db
    .select({
      orderItemId: orderItems.id,
      lineSupplierId: orderItems.supplierId,
      mappingSupplierId: sql<string | null>`(
        select psm.supplier_id
        from product_supplier_mappings psm
        where psm.product_id = ${orderItems.productId}
          and psm.is_primary = true
          and psm.deleted_at is null
        limit 1
      )`
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        isNull(orderItems.deletedAt),
        isNull(orders.deletedAt),
        isNull(orderItems.purchaseOrderId),
        eq(orderItems.fulfilmentStatus, "unfulfilled"),
        inArray(orders.status, ["pending_payment", "paid"])
      )
    );

  let skippedUnmapped = 0;
  for (const line of eligible) {
    if (!line.lineSupplierId && !line.mappingSupplierId) {
      skippedUnmapped += 1;
    }
  }

  return { eligibleLineCount: eligible.length, skippedUnmapped };
}

export async function runDailyPoBatchJob(
  input: { dryRun?: boolean; batchDate?: string } = {},
  databaseUrl?: string
): Promise<{
  run: OpsJobRunSnapshot;
  result: {
    dryRun: boolean;
    batchDate: string;
    eligibleLineCount: number;
    skippedUnmapped: number;
    createdCount: number;
    poNumbers: string[];
  };
}> {
  const url = resolveDatabaseUrl(databaseUrl);
  const dryRun = input.dryRun ?? true;
  const batchDate = input.batchDate ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = `daily_po_batch:${batchDate}:${dryRun ? "dry" : "live"}`;

  const run = await startOpsJobRun(
    {
      jobType: "daily_po_batch",
      idempotencyKey,
      dryRun,
      allowExternalSend: false,
      inputPayload: { batchDate, dryRun }
    },
    url
  );

  if (run.status === "succeeded") {
    return {
      run,
      result: (run.resultPayload ?? {
        dryRun,
        batchDate,
        eligibleLineCount: 0,
        skippedUnmapped: 0,
        createdCount: 0,
        poNumbers: []
      }) as {
        dryRun: boolean;
        batchDate: string;
        eligibleLineCount: number;
        skippedUnmapped: number;
        createdCount: number;
        poNumbers: string[];
      }
    };
  }

  try {
    let result: {
      dryRun: boolean;
      batchDate: string;
      eligibleLineCount: number;
      skippedUnmapped: number;
      createdCount: number;
      poNumbers: string[];
    };

    if (dryRun) {
      const db = createDatabaseClient(url);
      const counts = await countEligiblePoLines(db);
      result = {
        dryRun: true,
        batchDate,
        eligibleLineCount: counts.eligibleLineCount,
        skippedUnmapped: counts.skippedUnmapped,
        createdCount: 0,
        poNumbers: []
      };
    } else {
      const batch = await createPurchaseOrderBatch(batchDate, url);
      result = {
        dryRun: false,
        batchDate: batch.batchDate,
        eligibleLineCount: batch.eligibleLineCount,
        skippedUnmapped: batch.skippedUnmapped,
        createdCount: batch.created.length,
        poNumbers: batch.created.map((po) => po.poNumber)
      };
    }

    const finished = await finishOpsJobRun(
      run.id,
      { status: "succeeded", resultPayload: result },
      url
    );
    return { run: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily PO batch failed.";
    await finishOpsJobRun(run.id, { status: "failed", errorMessage: message }, url);
    throw error;
  }
}

export async function runMarginCostRefreshJob(
  input: { dryRun?: boolean; limit?: number } = {},
  databaseUrl?: string
): Promise<{
  run: OpsJobRunSnapshot;
  result: { dryRun: boolean; ordersScanned: number; linesWouldUpdate: number; linesUpdated: number };
}> {
  const url = resolveDatabaseUrl(databaseUrl);
  const dryRun = input.dryRun ?? true;
  const limit = input.limit ?? 50;
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `margin_cost_refresh:${day}:${dryRun ? "dry" : "live"}:${limit}`;

  const run = await startOpsJobRun(
    {
      jobType: "margin_cost_refresh",
      idempotencyKey,
      dryRun,
      allowExternalSend: false,
      inputPayload: { dryRun, limit }
    },
    url
  );

  if (run.status === "succeeded") {
    return {
      run,
      result: (run.resultPayload ?? {
        dryRun,
        ordersScanned: 0,
        linesWouldUpdate: 0,
        linesUpdated: 0
      }) as {
        dryRun: boolean;
        ordersScanned: number;
        linesWouldUpdate: number;
        linesUpdated: number;
      }
    };
  }

  try {
    const db = createDatabaseClient(url);
    const recentOrders = await db
      .select({ orderNumber: orders.orderNumber, id: orders.id })
      .from(orders)
      .where(isNull(orders.deletedAt))
      .orderBy(desc(orders.placedAt), desc(orders.createdAt))
      .limit(limit);

    let linesWouldUpdate = 0;
    let linesUpdated = 0;

    for (const order of recentOrders) {
      const nullCostLines = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, order.id),
            isNull(orderItems.deletedAt),
            isNull(orderItems.supplierCostAmount)
          )
        );

      if (nullCostLines.length === 0) {
        continue;
      }

      if (dryRun) {
        linesWouldUpdate += nullCostLines.length;
        continue;
      }

      const updated = await applyMappedSupplierCosts(order.orderNumber, url);
      linesUpdated += updated;
      linesWouldUpdate += nullCostLines.length;
    }

    const result = {
      dryRun,
      ordersScanned: recentOrders.length,
      linesWouldUpdate,
      linesUpdated: dryRun ? 0 : linesUpdated
    };

    const finished = await finishOpsJobRun(
      run.id,
      { status: "succeeded", resultPayload: result },
      url
    );
    return { run: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Margin cost refresh failed.";
    await finishOpsJobRun(run.id, { status: "failed", errorMessage: message }, url);
    throw error;
  }
}

export async function runOpsExceptionDetectionJob(
  input: { dryRun?: boolean } = {},
  databaseUrl?: string
): Promise<{
  run: OpsJobRunSnapshot;
  result: {
    dryRun: boolean;
    openExceptionCount: number;
    trackingOverdueCreated: number;
    deliveryOverdueCreated: number;
    trackingOverdueCandidates: number;
    deliveryOverdueCandidates: number;
  };
}> {
  const url = resolveDatabaseUrl(databaseUrl);
  const dryRun = input.dryRun ?? true;
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `ops_exception_detection:${day}:${dryRun ? "dry" : "live"}`;

  const run = await startOpsJobRun(
    {
      jobType: "ops_exception_detection",
      idempotencyKey,
      dryRun,
      allowExternalSend: false,
      inputPayload: { dryRun }
    },
    url
  );

  if (run.status === "succeeded") {
    return {
      run,
      result: (run.resultPayload ?? {
        dryRun,
        openExceptionCount: 0,
        trackingOverdueCreated: 0,
        deliveryOverdueCreated: 0,
        trackingOverdueCandidates: 0,
        deliveryOverdueCandidates: 0
      }) as {
        dryRun: boolean;
        openExceptionCount: number;
        trackingOverdueCreated: number;
        deliveryOverdueCreated: number;
        trackingOverdueCandidates: number;
        deliveryOverdueCandidates: number;
      }
    };
  }

  try {
    const db = createDatabaseClient(url);
    const slaResult = await detectAndPersistSlaExceptions({ dryRun }, url);

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackingExceptions)
      .where(
        and(eq(trackingExceptions.status, "open"), isNull(trackingExceptions.deletedAt))
      );

    const result = {
      dryRun,
      openExceptionCount: row?.count ?? 0,
      trackingOverdueCreated: slaResult.trackingOverdueCreated,
      deliveryOverdueCreated: slaResult.deliveryOverdueCreated,
      trackingOverdueCandidates: slaResult.trackingOverdueCandidates,
      deliveryOverdueCandidates: slaResult.deliveryOverdueCandidates
    };

    const finished = await finishOpsJobRun(
      run.id,
      { status: "succeeded", resultPayload: result },
      url
    );
    return { run: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ops exception detection failed.";
    await finishOpsJobRun(run.id, { status: "failed", errorMessage: message }, url);
    throw error;
  }
}

export async function runSupplierTrackingRequestJob(
  input: { dryRun?: boolean } = {},
  databaseUrl?: string
): Promise<{
  run: OpsJobRunSnapshot;
  result: {
    dryRun: boolean;
    draftsCount: number;
    drafts: Array<{ poNumber: string; to: string | null; subject: string; bodyText: string }>;
  };
}> {
  const url = resolveDatabaseUrl(databaseUrl);
  const dryRun = input.dryRun ?? true;
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `supplier_tracking_request:${day}:${dryRun ? "dry" : "live"}`;

  const run = await startOpsJobRun(
    {
      jobType: "supplier_tracking_request",
      idempotencyKey,
      dryRun,
      allowExternalSend: false,
      inputPayload: { dryRun }
    },
    url
  );

  if (run.status === "succeeded") {
    return {
      run,
      result: (run.resultPayload ?? { dryRun, draftsCount: 0, drafts: [] }) as {
        dryRun: boolean;
        draftsCount: number;
        drafts: Array<{ poNumber: string; to: string | null; subject: string; bodyText: string }>;
      }
    };
  }

  try {
    const db = createDatabaseClient(url);
    const rows = await db
      .select({
        poNumber: purchaseOrders.poNumber,
        emailTo: purchaseOrders.emailTo,
        batchDate: purchaseOrders.batchDate,
        supplierName: suppliers.name,
        supplierEmail: suppliers.email
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(
        and(
          isNull(purchaseOrders.deletedAt),
          isNull(purchaseOrders.emailSentAt),
          inArray(purchaseOrders.status, ["ready", "sent", "acknowledged"])
        )
      )
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100);

    // Draft chase payloads only — never send email from this job.
    const drafts = rows.map((row) => {
      const to = row.emailTo ?? row.supplierEmail;
      const batch = row.batchDate ?? "unspecified";
      return {
        poNumber: row.poNumber,
        to,
        subject: `Tracking request — Sports Jersey House ${row.poNumber}`,
        bodyText: [
          `Hello ${row.supplierName},`,
          "",
          `Please share tracking for purchase order ${row.poNumber} (batch ${batch}).`,
          "",
          "This is a DRAFT chase email — not sent automatically.",
          "",
          "Thanks,",
          "Sports Jersey House Ops"
        ].join("\n")
      };
    });

    const result = {
      dryRun,
      draftsCount: drafts.length,
      drafts
    };

    const finished = await finishOpsJobRun(
      run.id,
      { status: "succeeded", resultPayload: result },
      url
    );
    return { run: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supplier tracking request job failed.";
    await finishOpsJobRun(run.id, { status: "failed", errorMessage: message }, url);
    throw error;
  }
}

export async function runTrackingIngestCheckJob(
  input: { dryRun?: boolean } = {},
  databaseUrl?: string
): Promise<{
  run: OpsJobRunSnapshot;
  result: { dryRun: boolean; openExceptionCount: number };
}> {
  const url = resolveDatabaseUrl(databaseUrl);
  const dryRun = input.dryRun ?? true;
  const day = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `tracking_ingest_check:${day}:${dryRun ? "dry" : "live"}`;

  const run = await startOpsJobRun(
    {
      jobType: "tracking_ingest_check",
      idempotencyKey,
      dryRun,
      allowExternalSend: false,
      inputPayload: { dryRun }
    },
    url
  );

  if (run.status === "succeeded") {
    return {
      run,
      result: (run.resultPayload ?? { dryRun, openExceptionCount: 0 }) as {
        dryRun: boolean;
        openExceptionCount: number;
      }
    };
  }

  try {
    const db = createDatabaseClient(url);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(trackingExceptions)
      .where(
        and(eq(trackingExceptions.status, "open"), isNull(trackingExceptions.deletedAt))
      );

    const result = {
      dryRun,
      openExceptionCount: row?.count ?? 0
    };

    const finished = await finishOpsJobRun(
      run.id,
      { status: "succeeded", resultPayload: result },
      url
    );
    return { run: finished, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking ingest check failed.";
    await finishOpsJobRun(run.id, { status: "failed", errorMessage: message }, url);
    throw error;
  }
}
