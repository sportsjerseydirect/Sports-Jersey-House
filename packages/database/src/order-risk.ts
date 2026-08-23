/**
 * Chargeback / customer-risk scoring — advisory only.
 * Never auto-refuses customers; surfaces evidence for human review.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";
import { issueCases, orderItems, orders } from "./schema-commerce";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

export type RiskSignal = {
  code: string;
  label: string;
  weight: number;
};

export type OrderRiskSnapshot = {
  orderId: string;
  orderNumber: string;
  riskScore: number;
  riskBand: "low" | "medium" | "high";
  signals: RiskSignal[];
  recommendedAction: string;
};

function bandForScore(score: number): "low" | "medium" | "high" {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function recommend(band: "low" | "medium" | "high", signals: RiskSignal[]): string {
  if (band === "high") {
    return "Preserve evidence, respond with verified facts only, escalate for human review before refund/replacement.";
  }
  if (band === "medium") {
    return "Review case notes and tracking evidence before approving goodwill or replacement.";
  }
  if (signals.length === 0) {
    return "No elevated dispute signals detected.";
  }
  return "Monitor — low risk; continue standard service.";
}

export async function evaluateOrderRisk(
  orderNumber: string,
  databaseUrl?: string
): Promise<OrderRiskSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)))
    .limit(1);
  if (!order) return null;

  const signals: RiskSignal[] = [];

  const issues = await db
    .select()
    .from(issueCases)
    .where(and(eq(issueCases.orderId, order.id), isNull(issueCases.deletedAt)));

  for (const issue of issues) {
    if (issue.reason === "lost_shipment") {
      signals.push({
        code: "lost_shipment_claim",
        label: "Lost shipment claim on file",
        weight: 25
      });
    }
    if (issue.reason === "customer_issue" || issue.reason === "goodwill_replacement") {
      signals.push({
        code: "customer_issue_or_goodwill",
        label: "Customer issue / goodwill replacement case",
        weight: 20
      });
    }
    if (issue.replacementOrderId) {
      signals.push({
        code: "replacement_issued",
        label: "Replacement already linked",
        weight: 15
      });
    }
  }

  const lines = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.orderId, order.id), isNull(orderItems.deletedAt)));

  for (const line of lines) {
    const custom = line.customisation as { mode?: string } | null;
    if (custom?.mode && custom.mode !== "none") {
      signals.push({
        code: "customised_item",
        label: "Customised made-to-order item (returns typically not accepted for preference)",
        weight: 10
      });
      break;
    }
  }

  for (const line of lines) {
    if (line.shippedAt && !line.deliveredAt) {
      const days = (Date.now() - new Date(line.shippedAt).getTime()) / (86400_000);
      if (days > 30) {
        signals.push({
          code: "delivery_overdue",
          label: "Shipment open >30 days without delivery mark",
          weight: 20
        });
        break;
      }
    }
  }

  if (order.email) {
    const priorRows = await db.execute<{ n: number }>(sql`
      select count(*)::int as n
      from issue_cases ic
      inner join orders o on o.id = ic.order_id
      where lower(o.email) = lower(${order.email})
        and ic.deleted_at is null
        and ic.order_id <> ${order.id}::uuid
    `);
    const priorCount = (Array.isArray(priorRows) ? priorRows[0] : priorRows)?.n ?? 0;
    if (priorCount > 0) {
      signals.push({
        code: "prior_issue_history",
        label: `Prior issue history for this email (${priorCount})`,
        weight: Math.min(25, priorCount * 10)
      });
    }
  }

  const riskScore = Math.min(
    100,
    signals.reduce((sum, signal) => sum + signal.weight, 0)
  );
  const riskBand = bandForScore(riskScore);
  const recommendedAction = recommend(riskBand, signals);

  await db.execute(sql`
    insert into order_risk_scores (order_id, risk_score, risk_band, signals, recommended_action, last_evaluated_at, updated_at)
    values (
      ${order.id}::uuid,
      ${riskScore},
      ${riskBand},
      ${JSON.stringify(signals)}::jsonb,
      ${recommendedAction},
      now(),
      now()
    )
    on conflict (order_id) do update set
      risk_score = excluded.risk_score,
      risk_band = excluded.risk_band,
      signals = excluded.signals,
      recommended_action = excluded.recommended_action,
      last_evaluated_at = now(),
      updated_at = now()
  `);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    riskScore,
    riskBand,
    signals,
    recommendedAction
  };
}

export async function listElevatedRiskOrders(
  limit = 40,
  databaseUrl?: string
): Promise<{ count: number; rows: Array<Record<string, unknown>> }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<Record<string, unknown>>(sql`
    select
      o.order_number,
      o.status,
      o.email,
      r.risk_score,
      r.risk_band,
      r.recommended_action,
      r.last_evaluated_at
    from order_risk_scores r
    inner join orders o on o.id = r.order_id
    where r.risk_band in ('medium', 'high')
    order by r.risk_score desc
    limit ${limit}
  `);
  const list = Array.isArray(rows) ? rows : [];
  return { count: list.length, rows: list };
}

export async function evaluateRecentOrdersRisk(
  limit = 50,
  databaseUrl?: string
): Promise<{ evaluated: number; elevated: number }> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const recent = await db
    .select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .orderBy(desc(orders.placedAt))
    .limit(limit);

  let elevated = 0;
  for (const row of recent) {
    const result = await evaluateOrderRisk(row.orderNumber, databaseUrl);
    if (result && (result.riskBand === "medium" || result.riskBand === "high")) {
      elevated += 1;
    }
  }
  return { evaluated: recent.length, elevated };
}
