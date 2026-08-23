import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import type { IssueReason } from "@sjh/shared";
import { computeProductSignals, listReviewQueue } from "./catalogue-intelligence";
import { createDatabaseClient } from "./client";
import { createIssueCase } from "./issues";
import { getOrderMargins, listRecentOrderMargins } from "./margins";
import {
  getOpsAttentionBrief,
  listDeliveryOverdueForOps,
  listLowMarginOrdersForOps,
  listPoorSeoProductsForOps,
  listTrackingOverdueForOps
} from "./ops-attention";
import {
  evaluateOrderRisk,
  evaluateRecentOrdersRisk,
  listElevatedRiskOrders
} from "./order-risk";
import { aiActionAudits, orderItems, orders } from "./schema-commerce";
import { createPurchaseOrderBatch, getPurchaseOrderByNumber } from "./suppliers";
import { ingestTrackingPaste, matchCourier } from "./tracking";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for AI ops.");
  }
  return url;
}

export type AiActionAuditSnapshot = {
  id: string;
  actionType: string;
  actor: string;
  status: string;
  inputPayload: unknown;
  previewPayload: unknown;
  resultPayload: unknown;
  requiresConfirmation: boolean;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  executedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
};

function mapAudit(row: typeof aiActionAudits.$inferSelect): AiActionAuditSnapshot {
  return {
    id: row.id,
    actionType: row.actionType,
    actor: row.actor,
    status: row.status,
    inputPayload: row.inputPayload,
    previewPayload: row.previewPayload,
    resultPayload: row.resultPayload,
    requiresConfirmation: row.requiresConfirmation,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt,
    executedAt: row.executedAt,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt
  };
}

export async function listAiActionAudits(
  limit = 40,
  databaseUrl?: string
): Promise<AiActionAuditSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(aiActionAudits)
    .orderBy(desc(aiActionAudits.createdAt))
    .limit(limit);
  return rows.map(mapAudit);
}

async function executeOpsAction(
  actionType: string,
  input: Record<string, unknown>,
  databaseUrl?: string
): Promise<unknown> {
  switch (actionType) {
    case "create_po_batch": {
      const batchDate =
        typeof input.batchDate === "string" ? input.batchDate : new Date().toISOString().slice(0, 10);
      const result = await createPurchaseOrderBatch(batchDate, databaseUrl);
      return {
        batchDate: result.batchDate,
        createdCount: result.created.length,
        eligibleLineCount: result.eligibleLineCount,
        skippedUnmapped: result.skippedUnmapped,
        poNumbers: result.created.map((po) => po.poNumber)
      };
    }
    case "ingest_tracking": {
      const paste = typeof input.paste === "string" ? input.paste : "";
      if (!paste.trim()) {
        throw new Error("Tracking paste is required.");
      }
      return ingestTrackingPaste(paste, databaseUrl);
    }
    case "list_ageing_orders": {
      const olderThanDays = typeof input.olderThanDays === "number" ? input.olderThanDays : 3;
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
      const rows = await db
        .select({
          orderNumber: orders.orderNumber,
          status: orders.status,
          fulfilmentStatus: orders.fulfilmentStatus,
          placedAt: orders.placedAt,
          productTitle: orderItems.productTitle,
          lineFulfilment: orderItems.fulfilmentStatus,
          trackingNumber: orderItems.trackingNumber
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            isNull(orderItems.deletedAt),
            isNull(orders.deletedAt),
            isNull(orderItems.trackingNumber),
            lt(orders.placedAt, cutoff)
          )
        )
        .orderBy(asc(orders.placedAt))
        .limit(100);
      return { olderThanDays, count: rows.length, rows };
    }
    case "margin_report": {
      if (typeof input.orderNumber === "string") {
        const margin = await getOrderMargins(input.orderNumber, databaseUrl);
        if (!margin) {
          throw new Error("Order not found.");
        }
        return margin;
      }
      const limit = typeof input.limit === "number" ? input.limit : 20;
      return listRecentOrderMargins(limit, databaseUrl);
    }
    case "draft_supplier_chase_email": {
      const poNumber = typeof input.poNumber === "string" ? input.poNumber : "";
      if (!poNumber) {
        throw new Error("PO number is required for supplier chase draft.");
      }
      const po = await getPurchaseOrderByNumber(poNumber, databaseUrl);
      if (!po) {
        throw new Error("Purchase order not found.");
      }
      return {
        to: po.emailTo,
        subject: `Follow-up: ${po.poNumber} / ${po.batchDate ?? "batch"}`,
        bodyText: [
          `Hello ${po.supplier.name},`,
          "",
          `Checking status on purchase order ${po.poNumber} (${po.lines.length} line(s)).`,
          "Please reply with production/ship ETA when you can.",
          "",
          "DRAFT ONLY — not sent automatically."
        ].join("\n"),
        sent: false
      };
    }
    case "create_issue_case": {
      const orderNumber = typeof input.orderNumber === "string" ? input.orderNumber : "";
      const reason = (typeof input.reason === "string" ? input.reason : "customer_issue") as IssueReason;
      if (!orderNumber) {
        throw new Error("Order number is required.");
      }
      return createIssueCase(
        {
          orderNumber,
          reason,
          ...(typeof input.customerNotes === "string" ? { customerNotes: input.customerNotes } : {}),
          ...(typeof input.internalNotes === "string" ? { internalNotes: input.internalNotes } : {})
        },
        databaseUrl
      );
    }
    case "identify_courier": {
      const trackingNumber = typeof input.trackingNumber === "string" ? input.trackingNumber : "";
      if (!trackingNumber.trim()) {
        throw new Error("Tracking number is required.");
      }
      return matchCourier(trackingNumber, databaseUrl);
    }
    case "inspect_catalogue": {
      const productId = typeof input.productId === "string" ? input.productId : undefined;
      const [signals, reviewQueue] = await Promise.all([
        computeProductSignals(productId, databaseUrl),
        listReviewQueue(20, databaseUrl)
      ]);
      return {
        signalCount: signals.length,
        outdatedCount: signals.filter((row) => row.isOutdated).length,
        duplicateSuspectCount: signals.filter((row) => row.isDuplicateSuspect).length,
        openReviewCount: reviewQueue.length,
        sample: signals.slice(0, 10).map((row) => ({
          productId: row.productId,
          healthStatus: row.healthStatus,
          qualityScore: row.qualityScore,
          isOutdated: row.isOutdated,
          isDuplicateSuspect: row.isDuplicateSuspect
        }))
      };
    }
    case "attention_today":
      return getOpsAttentionBrief(databaseUrl);
    case "list_tracking_overdue":
      return listTrackingOverdueForOps(
        typeof input.limit === "number" ? input.limit : 50,
        databaseUrl
      );
    case "list_delivery_overdue":
      return listDeliveryOverdueForOps(
        typeof input.limit === "number" ? input.limit : 50,
        databaseUrl
      );
    case "list_low_margin_orders":
      return listLowMarginOrdersForOps(
        typeof input.limit === "number" ? input.limit : 40,
        databaseUrl
      );
    case "list_poor_seo":
      return listPoorSeoProductsForOps(
        typeof input.limit === "number" ? input.limit : 40,
        databaseUrl
      );
    case "list_chargeback_risk": {
      if (typeof input.orderNumber === "string") {
        return evaluateOrderRisk(input.orderNumber, databaseUrl);
      }
      if (input.evaluateRecent === true) {
        const summary = await evaluateRecentOrdersRisk(
          typeof input.limit === "number" ? input.limit : 40,
          databaseUrl
        );
        const elevated = await listElevatedRiskOrders(40, databaseUrl);
        return { ...summary, elevated };
      }
      return listElevatedRiskOrders(
        typeof input.limit === "number" ? input.limit : 40,
        databaseUrl
      );
    }
    case "prepare_replacement":
    case "prepare_customer_email":
    case "update_supplier_cost":
      throw new Error(
        `${actionType} is preview-only or requires a dedicated admin form — not auto-executed.`
      );
    default:
      throw new Error(`Unsupported action: ${actionType}`);
  }
}

export async function createOpsAuditPreview(
  input: {
    actionType: string;
    actor?: string;
    requiresConfirmation: boolean;
    inputPayload: Record<string, unknown>;
    previewPayload: Record<string, unknown>;
    executeImmediately?: boolean;
  },
  databaseUrl?: string
): Promise<AiActionAuditSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const status = input.requiresConfirmation ? "pending_confirmation" : "preview";

  const [row] = await db
    .insert(aiActionAudits)
    .values({
      actionType: input.actionType,
      actor: input.actor ?? "admin",
      status,
      inputPayload: input.inputPayload,
      previewPayload: input.previewPayload,
      requiresConfirmation: input.requiresConfirmation
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create AI action audit.");
  }

  if (input.executeImmediately && !input.requiresConfirmation) {
    try {
      const result = await executeOpsAction(input.actionType, input.inputPayload, databaseUrl);
      const [updated] = await db
        .update(aiActionAudits)
        .set({
          status: "executed",
          resultPayload: result as Record<string, unknown>,
          executedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(aiActionAudits.id, row.id))
        .returning();
      return mapAudit(updated ?? row);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed.";
      const [failed] = await db
        .update(aiActionAudits)
        .set({
          status: "failed",
          errorMessage: message,
          updatedAt: new Date()
        })
        .where(eq(aiActionAudits.id, row.id))
        .returning();
      return mapAudit(failed ?? row);
    }
  }

  return mapAudit(row);
}

export async function confirmOpsAction(
  auditId: string,
  confirmedBy = "admin",
  databaseUrl?: string
): Promise<AiActionAuditSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db.select().from(aiActionAudits).where(eq(aiActionAudits.id, auditId)).limit(1);

  if (!row) {
    throw new Error("Audit not found.");
  }

  if (row.status === "executed") {
    return mapAudit(row);
  }

  if (row.status === "rejected") {
    throw new Error("Action was rejected.");
  }

  const now = new Date();
  await db
    .update(aiActionAudits)
    .set({
      status: "confirmed",
      confirmedBy,
      confirmedAt: now,
      updatedAt: now
    })
    .where(eq(aiActionAudits.id, row.id));

  try {
    const result = await executeOpsAction(
      row.actionType,
      (row.inputPayload ?? {}) as Record<string, unknown>,
      databaseUrl
    );
    const [updated] = await db
      .update(aiActionAudits)
      .set({
        status: "executed",
        resultPayload: result as Record<string, unknown>,
        executedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(aiActionAudits.id, row.id))
      .returning();
    return mapAudit(updated ?? row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execution failed.";
    await db
      .update(aiActionAudits)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date()
      })
      .where(eq(aiActionAudits.id, row.id));
    throw new Error(message);
  }
}

export async function rejectOpsAction(
  auditId: string,
  confirmedBy = "admin",
  databaseUrl?: string
): Promise<AiActionAuditSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [updated] = await db
    .update(aiActionAudits)
    .set({
      status: "rejected",
      confirmedBy,
      confirmedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(aiActionAudits.id, auditId))
    .returning();

  if (!updated) {
    throw new Error("Audit not found.");
  }

  return mapAudit(updated);
}
