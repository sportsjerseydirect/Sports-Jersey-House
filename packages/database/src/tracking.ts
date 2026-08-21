import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { courierRules, orderItems, orders } from "./schema-commerce";
import { trackingExceptions } from "./schema-ops";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for tracking operations.");
  }
  return url;
}

export type CourierRuleSnapshot = {
  id: string;
  name: string;
  pattern: string;
  patternType: "regex" | "prefix" | "contains";
  courierCode: string;
  courierName: string;
  priority: number;
  isActive: boolean;
  notes: string | null;
};

export type MatchedCourier = {
  courierCode: string;
  courierName: string;
  ruleId: string | null;
  ruleName: string | null;
};

export type TrackingIngestLineResult = {
  raw: string;
  status: "assigned" | "exception" | "skipped";
  orderNumber?: string;
  orderItemId?: string;
  trackingNumber?: string;
  courier?: MatchedCourier | null;
  message: string;
};

export type TrackingIngestResult = {
  results: TrackingIngestLineResult[];
  assigned: number;
  exceptions: number;
  skipped: number;
};

export function matchCourierFromRules(
  trackingNumber: string,
  rules: Array<Pick<CourierRuleSnapshot, "id" | "name" | "pattern" | "patternType" | "courierCode" | "courierName" | "isActive">>
): MatchedCourier | null {
  const tracking = trackingNumber.trim();
  if (!tracking) {
    return null;
  }

  for (const rule of rules) {
    if (!rule.isActive) {
      continue;
    }

    let matched = false;
    switch (rule.patternType) {
      case "prefix":
        matched = tracking.toUpperCase().startsWith(rule.pattern.toUpperCase());
        break;
      case "contains":
        matched = tracking.toUpperCase().includes(rule.pattern.toUpperCase());
        break;
      case "regex":
      default:
        try {
          matched = new RegExp(rule.pattern, "i").test(tracking);
        } catch {
          matched = false;
        }
        break;
    }

    if (matched) {
      return {
        courierCode: rule.courierCode,
        courierName: rule.courierName,
        ruleId: rule.id,
        ruleName: rule.name
      };
    }
  }

  return null;
}

export async function listCourierRules(databaseUrl?: string): Promise<CourierRuleSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db
    .select()
    .from(courierRules)
    .where(isNull(courierRules.deletedAt))
    .orderBy(asc(courierRules.priority), asc(courierRules.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    patternType: row.patternType as CourierRuleSnapshot["patternType"],
    courierCode: row.courierCode,
    courierName: row.courierName,
    priority: row.priority,
    isActive: row.isActive,
    notes: row.notes
  }));
}

export async function createCourierRule(
  input: {
    name: string;
    pattern: string;
    patternType?: CourierRuleSnapshot["patternType"];
    courierCode: string;
    courierName: string;
    priority?: number;
    notes?: string;
  },
  databaseUrl?: string
): Promise<CourierRuleSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const patternType = input.patternType ?? "regex";

  if (patternType === "regex") {
    try {
      // Validate pattern compiles before persisting.
      void new RegExp(input.pattern);
    } catch {
      throw new Error("Invalid regex pattern.");
    }
  }

  const [row] = await db
    .insert(courierRules)
    .values({
      name: input.name.trim(),
      pattern: input.pattern,
      patternType,
      courierCode: input.courierCode.trim().toUpperCase(),
      courierName: input.courierName.trim(),
      priority: input.priority ?? 100,
      isActive: true,
      notes: input.notes?.trim() || null
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create courier rule.");
  }

  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    patternType: row.patternType as CourierRuleSnapshot["patternType"],
    courierCode: row.courierCode,
    courierName: row.courierName,
    priority: row.priority,
    isActive: row.isActive,
    notes: row.notes
  };
}

export async function matchCourier(
  trackingNumber: string,
  databaseUrl?: string
): Promise<MatchedCourier | null> {
  const rules = await listCourierRules(databaseUrl);
  return matchCourierFromRules(trackingNumber, rules);
}

function parseTrackingPasteLine(line: string): {
  orderNumber?: string;
  trackingNumber?: string;
  skipped?: boolean;
  reason?: string;
} {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return { skipped: true, reason: "Blank or comment." };
  }

  // ORDER TRACKING  |  ORDER|TRACKING  |  TRACKING alone
  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    const orderNumber = pipeParts[0];
    const trackingNumber = pipeParts[pipeParts.length - 1];
    return {
      ...(orderNumber ? { orderNumber } : {}),
      ...(trackingNumber ? { trackingNumber } : {})
    };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2 && /^[A-Z0-9][A-Z0-9_-]*-\d+$/i.test(tokens[0] ?? "")) {
    const orderNumber = tokens[0];
    const trackingNumber = tokens.slice(1).join("");
    return {
      ...(orderNumber ? { orderNumber } : {}),
      ...(trackingNumber ? { trackingNumber } : {})
    };
  }

  if (tokens.length === 1) {
    const trackingNumber = tokens[0];
    return trackingNumber ? { trackingNumber } : { skipped: true, reason: "Unrecognised line." };
  }

  // Last token as tracking, first as order when first looks like order number
  if (tokens.length >= 2) {
    const orderNumber = tokens[0];
    const trackingNumber = tokens[tokens.length - 1];
    return {
      ...(orderNumber ? { orderNumber } : {}),
      ...(trackingNumber ? { trackingNumber } : {})
    };
  }

  return { skipped: true, reason: "Unrecognised line." };
}

export async function ingestTrackingPaste(
  paste: string,
  databaseUrl?: string
): Promise<TrackingIngestResult> {
  const url = resolveDatabaseUrl(databaseUrl);
  const db = createDatabaseClient(url);
  const rules = await listCourierRules(url);
  const lines = paste.split(/\r?\n/);
  const results: TrackingIngestLineResult[] = [];
  const ingestBatchId = crypto.randomUUID();

  for (const raw of lines) {
    const parsed = parseTrackingPasteLine(raw);
    if (parsed.skipped) {
      if (raw.trim()) {
        results.push({
          raw,
          status: "skipped",
          message: parsed.reason ?? "Skipped."
        });
      }
      continue;
    }

    const trackingNumber = parsed.trackingNumber?.trim();
    if (!trackingNumber) {
      const message = "Missing tracking number.";
      results.push({
        raw,
        status: "exception",
        message
      });
      await persistTrackingException(
        {
          rawLine: raw,
          reason: message,
          ingestBatchId
        },
        url
      );
      continue;
    }

    const courier = matchCourierFromRules(trackingNumber, rules);
    let orderItemId: string | undefined;
    let orderNumber = parsed.orderNumber;
    let orderId: string | undefined;

    if (orderNumber) {
      const [order] = await db
        .select({ id: orders.id, orderNumber: orders.orderNumber })
        .from(orders)
        .where(and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)))
        .limit(1);

      if (!order) {
        const message = `Order ${orderNumber} not found.`;
        results.push({
          raw,
          status: "exception",
          orderNumber,
          trackingNumber,
          courier,
          message
        });
        await persistTrackingException(
          {
            rawLine: raw,
            trackingNumber,
            orderNumber,
            courierGuess: courier?.courierName ?? null,
            reason: message,
            ingestBatchId
          },
          url
        );
        continue;
      }

      orderId = order.id;
      orderNumber = order.orderNumber;

      const [line] = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, order.id),
            isNull(orderItems.deletedAt),
            isNull(orderItems.trackingNumber)
          )
        )
        .orderBy(asc(orderItems.createdAt))
        .limit(1);

      if (!line) {
        const message = `No untracked lines on ${orderNumber}.`;
        results.push({
          raw,
          status: "exception",
          orderNumber,
          trackingNumber,
          courier,
          message
        });
        await persistTrackingException(
          {
            rawLine: raw,
            trackingNumber,
            orderNumber,
            courierGuess: courier?.courierName ?? null,
            reason: message,
            ingestBatchId
          },
          url
        );
        continue;
      }

      orderItemId = line.id;
    } else {
      const message = "Tracking without order number — add to exception list.";
      results.push({
        raw,
        status: "exception",
        trackingNumber,
        courier,
        message
      });
      await persistTrackingException(
        {
          rawLine: raw,
          trackingNumber,
          courierGuess: courier?.courierName ?? null,
          reason: message,
          ingestBatchId
        },
        url
      );
      continue;
    }

    const now = new Date();
    await db
      .update(orderItems)
      .set({
        trackingNumber,
        courier: courier?.courierName ?? null,
        fulfilmentStatus: "shipped",
        shippedAt: now,
        updatedAt: now
      })
      .where(eq(orderItems.id, orderItemId));

    if (orderId) {
      const remaining = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(
          and(
            eq(orderItems.orderId, orderId),
            isNull(orderItems.deletedAt),
            sql`${orderItems.trackingNumber} is null`
          )
        )
        .limit(1);

      if (remaining.length === 0) {
        await db
          .update(orders)
          .set({
            status: "shipped",
            fulfilmentStatus: "shipped",
            updatedAt: now
          })
          .where(eq(orders.id, orderId));
      }
    }

    results.push({
      raw,
      status: "assigned",
      orderNumber,
      orderItemId,
      trackingNumber,
      courier,
      message: courier
        ? `Assigned via rule ${courier.ruleName ?? courier.courierCode}.`
        : "Assigned; no courier rule matched."
    });
  }

  return {
    results,
    assigned: results.filter((row) => row.status === "assigned").length,
    exceptions: results.filter((row) => row.status === "exception").length,
    skipped: results.filter((row) => row.status === "skipped").length
  };
}

export function buildShippingEmailDraft(input: {
  orderNumber: string;
  email: string | null;
  trackingNumber: string;
  courierName: string | null;
}): { to: string | null; subject: string; bodyText: string } {
  return {
    to: input.email,
    subject: `Your Sports Jersey House order ${input.orderNumber} has shipped`,
    bodyText: [
      `Order ${input.orderNumber} is on its way.`,
      "",
      `Courier: ${input.courierName ?? "Not identified"}`,
      `Tracking: ${input.trackingNumber}`,
      "",
      "Tracking can take a short time to become active with the courier.",
      "",
      "This is a DRAFT email — not sent automatically."
    ].join("\n")
  };
}

export type TrackingExceptionSnapshot = {
  id: string;
  rawLine: string;
  trackingNumber: string | null;
  orderNumber: string | null;
  orderItemId: string | null;
  courierGuess: string | null;
  reason: string;
  status: string;
  ingestBatchId: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  createdAt: Date;
};

function mapTrackingException(
  row: typeof trackingExceptions.$inferSelect
): TrackingExceptionSnapshot {
  return {
    id: row.id,
    rawLine: row.rawLine,
    trackingNumber: row.trackingNumber,
    orderNumber: row.orderNumber,
    orderItemId: row.orderItemId,
    courierGuess: row.courierGuess,
    reason: row.reason,
    status: row.status,
    ingestBatchId: row.ingestBatchId,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    resolutionNotes: row.resolutionNotes,
    createdAt: row.createdAt
  };
}

export async function persistTrackingException(
  input: {
    rawLine: string;
    trackingNumber?: string | null;
    orderNumber?: string | null;
    orderItemId?: string | null;
    courierGuess?: string | null;
    reason: string;
    ingestBatchId?: string;
    metadata?: Record<string, unknown>;
  },
  databaseUrl?: string
): Promise<TrackingExceptionSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [created] = await db
    .insert(trackingExceptions)
    .values({
      rawLine: input.rawLine,
      reason: input.reason,
      status: "open",
      ...(input.trackingNumber !== undefined
        ? { trackingNumber: input.trackingNumber }
        : {}),
      ...(input.orderNumber !== undefined ? { orderNumber: input.orderNumber } : {}),
      ...(input.orderItemId !== undefined ? { orderItemId: input.orderItemId } : {}),
      ...(input.courierGuess !== undefined ? { courierGuess: input.courierGuess } : {}),
      ...(input.ingestBatchId !== undefined ? { ingestBatchId: input.ingestBatchId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    })
    .returning();

  if (!created) {
    throw new Error("Failed to persist tracking exception.");
  }
  return mapTrackingException(created);
}

export async function listTrackingExceptions(
  status?: "open" | "resolved" | "ignored",
  databaseUrl?: string
): Promise<TrackingExceptionSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = status
    ? await db
        .select()
        .from(trackingExceptions)
        .where(and(eq(trackingExceptions.status, status), isNull(trackingExceptions.deletedAt)))
        .orderBy(desc(trackingExceptions.createdAt))
        .limit(200)
    : await db
        .select()
        .from(trackingExceptions)
        .where(isNull(trackingExceptions.deletedAt))
        .orderBy(desc(trackingExceptions.createdAt))
        .limit(200);

  return rows.map(mapTrackingException);
}

export async function resolveTrackingException(
  id: string,
  input: {
    status: "resolved" | "ignored";
    resolvedBy: string;
    notes?: string;
  },
  databaseUrl?: string
): Promise<TrackingExceptionSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const now = new Date();
  const [updated] = await db
    .update(trackingExceptions)
    .set({
      status: input.status,
      resolvedBy: input.resolvedBy.trim(),
      resolvedAt: now,
      ...(input.notes !== undefined ? { resolutionNotes: input.notes.trim() || null } : {}),
      updatedAt: now
    })
    .where(and(eq(trackingExceptions.id, id), isNull(trackingExceptions.deletedAt)))
    .returning();

  if (!updated) {
    throw new Error("Tracking exception not found.");
  }
  return mapTrackingException(updated);
}

export async function updateCourierRule(
  id: string,
  fields: {
    name?: string;
    pattern?: string;
    patternType?: CourierRuleSnapshot["patternType"];
    courierCode?: string;
    courierName?: string;
    priority?: number;
    notes?: string | null;
  },
  databaseUrl?: string
): Promise<CourierRuleSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [existing] = await db
    .select()
    .from(courierRules)
    .where(and(eq(courierRules.id, id), isNull(courierRules.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new Error("Courier rule not found.");
  }

  const patternType = fields.patternType ?? (existing.patternType as CourierRuleSnapshot["patternType"]);
  const pattern = fields.pattern ?? existing.pattern;
  if (patternType === "regex") {
    try {
      void new RegExp(pattern);
    } catch {
      throw new Error("Invalid regex pattern.");
    }
  }

  const [updated] = await db
    .update(courierRules)
    .set({
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.pattern !== undefined ? { pattern: fields.pattern } : {}),
      ...(fields.patternType !== undefined ? { patternType: fields.patternType } : {}),
      ...(fields.courierCode !== undefined
        ? { courierCode: fields.courierCode.trim().toUpperCase() }
        : {}),
      ...(fields.courierName !== undefined ? { courierName: fields.courierName.trim() } : {}),
      ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
      ...(fields.notes !== undefined
        ? { notes: fields.notes === null ? null : fields.notes.trim() || null }
        : {}),
      updatedAt: new Date()
    })
    .where(eq(courierRules.id, id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update courier rule.");
  }

  return {
    id: updated.id,
    name: updated.name,
    pattern: updated.pattern,
    patternType: updated.patternType as CourierRuleSnapshot["patternType"],
    courierCode: updated.courierCode,
    courierName: updated.courierName,
    priority: updated.priority,
    isActive: updated.isActive,
    notes: updated.notes
  };
}

export async function setCourierRuleActive(
  id: string,
  isActive: boolean,
  databaseUrl?: string
): Promise<CourierRuleSnapshot> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [updated] = await db
    .update(courierRules)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(courierRules.id, id), isNull(courierRules.deletedAt)))
    .returning();

  if (!updated) {
    throw new Error("Courier rule not found.");
  }

  return {
    id: updated.id,
    name: updated.name,
    pattern: updated.pattern,
    patternType: updated.patternType as CourierRuleSnapshot["patternType"],
    courierCode: updated.courierCode,
    courierName: updated.courierName,
    priority: updated.priority,
    isActive: updated.isActive,
    notes: updated.notes
  };
}
