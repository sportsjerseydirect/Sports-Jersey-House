import { and, desc, eq, isNull } from "drizzle-orm";
import type { IssueReason, IssueStatus } from "@sjh/shared";
import { createDatabaseClient } from "./client";
import { issueCases, orderItems, orders } from "./schema-commerce";
import { issueCaseEvidence, issueCaseEvents } from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for issue case operations.");
  }
  return url;
}

export type IssueCaseSnapshot = {
  id: string;
  caseNumber: string;
  orderId: string;
  orderNumber: string;
  orderItemId: string | null;
  reason: IssueReason;
  status: string;
  evidence: unknown;
  internalNotes: string | null;
  customerNotes: string | null;
  decision: string | null;
  replacementOrderId: string | null;
  replacementOrderNumber: string | null;
  replacementCostAmount: string | null;
  supplierResponsibility: boolean | null;
  resolution: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

export type IssueEvidenceSnapshot = {
  id: string;
  issueCaseId: string;
  kind: string;
  label: string | null;
  url: string | null;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: Date;
};

async function recordIssueEvent(
  db: ReturnType<typeof createDatabaseClient>,
  issueCaseId: string,
  eventType: string,
  actor: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await db.insert(issueCaseEvents).values({
    issueCaseId,
    eventType,
    actor,
    payload
  });
}

async function loadIssueSnapshot(
  db: ReturnType<typeof createDatabaseClient>,
  caseId: string
): Promise<IssueCaseSnapshot | null> {
  const [row] = await db.select().from(issueCases).where(eq(issueCases.id, caseId)).limit(1);
  if (!row || row.deletedAt) {
    return null;
  }

  const [order] = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, row.orderId))
    .limit(1);

  let replacementOrderNumber: string | null = null;
  if (row.replacementOrderId) {
    const [replacement] = await db
      .select({ orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, row.replacementOrderId))
      .limit(1);
    replacementOrderNumber = replacement?.orderNumber ?? null;
  }

  return {
    id: row.id,
    caseNumber: row.caseNumber,
    orderId: row.orderId,
    orderNumber: order?.orderNumber ?? "—",
    orderItemId: row.orderItemId,
    reason: row.reason as IssueReason,
    status: row.status,
    evidence: row.evidence,
    internalNotes: row.internalNotes,
    customerNotes: row.customerNotes,
    decision: row.decision,
    replacementOrderId: row.replacementOrderId,
    replacementOrderNumber,
    replacementCostAmount: row.replacementCostAmount,
    supplierResponsibility: row.supplierResponsibility,
    resolution: row.resolution,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt
  };
}

export async function listIssueCases(limit = 50, databaseUrl?: string): Promise<IssueCaseSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select({ id: issueCases.id })
    .from(issueCases)
    .where(isNull(issueCases.deletedAt))
    .orderBy(desc(issueCases.createdAt))
    .limit(limit);

  const snapshots: IssueCaseSnapshot[] = [];
  for (const row of rows) {
    const snapshot = await loadIssueSnapshot(db, row.id);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }
  return snapshots;
}

export async function getIssueCaseByNumber(
  caseNumber: string,
  databaseUrl?: string
): Promise<IssueCaseSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [row] = await db
    .select({ id: issueCases.id })
    .from(issueCases)
    .where(eq(issueCases.caseNumber, caseNumber))
    .limit(1);

  if (!row) {
    return null;
  }

  return loadIssueSnapshot(db, row.id);
}

export async function createIssueCase(
  input: {
    orderNumber: string;
    orderItemId?: string;
    reason: IssueReason;
    customerNotes?: string;
    internalNotes?: string;
    evidence?: unknown[];
  },
  databaseUrl?: string
): Promise<IssueCaseSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, input.orderNumber), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (input.orderItemId) {
    const [line] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.id, input.orderItemId), eq(orderItems.orderId, order.id)))
      .limit(1);
    if (!line) {
      throw new Error("Order line does not belong to this order.");
    }
  }

  const [created] = await db
    .insert(issueCases)
    .values({
      orderId: order.id,
      orderItemId: input.orderItemId ?? null,
      customerId: order.customerId,
      reason: input.reason,
      status: "open",
      evidence: input.evidence ?? [],
      customerNotes: input.customerNotes?.trim() || null,
      internalNotes: input.internalNotes?.trim() || null
    })
    .returning({ id: issueCases.id });

  if (!created) {
    throw new Error("Failed to create issue case.");
  }

  await db
    .update(orders)
    .set({ status: "issue", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  await recordIssueEvent(db, created.id, "created", "system", {
    orderNumber: input.orderNumber,
    reason: input.reason
  });

  const snapshot = await loadIssueSnapshot(db, created.id);
  if (!snapshot) {
    throw new Error("Issue created but could not be reloaded.");
  }
  return snapshot;
}

export async function updateIssueCase(
  caseNumber: string,
  input: {
    status?: IssueStatus;
    decision?: string;
    resolution?: string;
    internalNotes?: string;
    customerNotes?: string;
    supplierResponsibility?: boolean;
    replacementCostAmount?: string;
    replacementOrderNumber?: string;
  },
  databaseUrl?: string
): Promise<IssueCaseSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [existing] = await db
    .select()
    .from(issueCases)
    .where(and(eq(issueCases.caseNumber, caseNumber), isNull(issueCases.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Issue case not found.");
  }

  let replacementOrderId = existing.replacementOrderId;
  if (input.replacementOrderNumber !== undefined) {
    if (!input.replacementOrderNumber) {
      replacementOrderId = null;
    } else {
      const [replacement] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderNumber, input.replacementOrderNumber))
        .limit(1);
      if (!replacement) {
        throw new Error("Replacement order not found.");
      }
      replacementOrderId = replacement.id;
    }
  }

  const status = input.status ?? existing.status;
  const resolvedAt =
    status === "resolved" || status === "closed"
      ? (existing.resolvedAt ?? new Date())
      : null;

  await db
    .update(issueCases)
    .set({
      ...(input.status ? { status: input.status } : {}),
      ...(input.decision !== undefined ? { decision: input.decision.trim() || null } : {}),
      ...(input.resolution !== undefined ? { resolution: input.resolution.trim() || null } : {}),
      ...(input.internalNotes !== undefined
        ? { internalNotes: input.internalNotes.trim() || null }
        : {}),
      ...(input.customerNotes !== undefined
        ? { customerNotes: input.customerNotes.trim() || null }
        : {}),
      ...(input.supplierResponsibility !== undefined
        ? { supplierResponsibility: input.supplierResponsibility }
        : {}),
      ...(input.replacementCostAmount !== undefined
        ? { replacementCostAmount: input.replacementCostAmount || null }
        : {}),
      replacementOrderId,
      resolvedAt,
      updatedAt: new Date()
    })
    .where(eq(issueCases.id, existing.id));

  await recordIssueEvent(db, existing.id, "updated", "system", {
    ...input,
    previousStatus: existing.status,
    status
  });

  const snapshot = await loadIssueSnapshot(db, existing.id);
  if (!snapshot) {
    throw new Error("Issue updated but could not be reloaded.");
  }
  return snapshot;
}

export async function addIssueEvidence(
  caseNumber: string,
  input: {
    kind: "note" | "url" | "image" | "file";
    label?: string;
    url?: string;
    notes?: string;
    uploadedBy?: string;
  },
  databaseUrl?: string
): Promise<IssueEvidenceSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [issue] = await db
    .select({ id: issueCases.id })
    .from(issueCases)
    .where(and(eq(issueCases.caseNumber, caseNumber), isNull(issueCases.deletedAt)))
    .limit(1);

  if (!issue) {
    throw new Error("Issue case not found.");
  }

  const [created] = await db
    .insert(issueCaseEvidence)
    .values({
      issueCaseId: issue.id,
      kind: input.kind,
      ...(input.label !== undefined ? { label: input.label.trim() || null } : {}),
      ...(input.url !== undefined ? { url: input.url.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      ...(input.uploadedBy !== undefined ? { uploadedBy: input.uploadedBy.trim() || null } : {})
    })
    .returning();

  if (!created) {
    throw new Error("Failed to add issue evidence.");
  }

  await recordIssueEvent(db, issue.id, "evidence_added", input.uploadedBy ?? "system", {
    evidenceId: created.id,
    kind: input.kind
  });

  return {
    id: created.id,
    issueCaseId: created.issueCaseId,
    kind: created.kind,
    label: created.label,
    url: created.url,
    notes: created.notes,
    uploadedBy: created.uploadedBy,
    createdAt: created.createdAt
  };
}

export async function listIssueEvidence(
  caseNumber: string,
  databaseUrl?: string
): Promise<IssueEvidenceSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [issue] = await db
    .select({ id: issueCases.id })
    .from(issueCases)
    .where(and(eq(issueCases.caseNumber, caseNumber), isNull(issueCases.deletedAt)))
    .limit(1);

  if (!issue) {
    throw new Error("Issue case not found.");
  }

  const rows = await db
    .select()
    .from(issueCaseEvidence)
    .where(and(eq(issueCaseEvidence.issueCaseId, issue.id), isNull(issueCaseEvidence.deletedAt)))
    .orderBy(desc(issueCaseEvidence.createdAt));

  return rows.map((row) => ({
    id: row.id,
    issueCaseId: row.issueCaseId,
    kind: row.kind,
    label: row.label,
    url: row.url,
    notes: row.notes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt
  }));
}
