import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { courierRules, orderItems, orders } from "./schema-commerce";

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
      results.push({
        raw,
        status: "exception",
        message: "Missing tracking number."
      });
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
        results.push({
          raw,
          status: "exception",
          orderNumber,
          trackingNumber,
          courier,
          message: `Order ${orderNumber} not found.`
        });
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
        results.push({
          raw,
          status: "exception",
          orderNumber,
          trackingNumber,
          courier,
          message: `No untracked lines on ${orderNumber}.`
        });
        continue;
      }

      orderItemId = line.id;
    } else {
      results.push({
        raw,
        status: "exception",
        trackingNumber,
        courier,
        message: "Tracking without order number — add to exception list."
      });
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
