import { z } from "zod";

export const opsActionTypeSchema = z.enum([
  "create_po_batch",
  "ingest_tracking",
  "list_ageing_orders",
  "margin_report",
  "draft_supplier_chase_email",
  "create_issue_case"
]);
export type OpsActionType = z.infer<typeof opsActionTypeSchema>;

export type OpsIntent = {
  actionType: OpsActionType;
  input: Record<string, unknown>;
  requiresConfirmation: boolean;
  previewSummary: string;
  confidence: "high" | "medium" | "low";
};

const READ_ONLY = new Set<OpsActionType>(["list_ageing_orders", "margin_report", "draft_supplier_chase_email"]);

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministic ops intent parser (no provider required).
 * High-risk actions always require confirmation before execution.
 */
export function parseOpsIntent(prompt: string): OpsIntent | null {
  const text = prompt.trim();
  if (!text) {
    return null;
  }

  const lower = text.toLowerCase();

  if (/\b(po|purchase order|batch)\b/.test(lower) && /\b(create|run|generate|batch)\b/.test(lower)) {
    const dateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const batchDate = dateMatch?.[1] ?? todayIsoDate();
    return {
      actionType: "create_po_batch",
      input: { batchDate },
      requiresConfirmation: true,
      previewSummary: `Create purchase-order batch for ${batchDate} (one PO per supplier for eligible lines).`,
      confidence: "high"
    };
  }

  if (/\b(tracking|track|courier)\b/.test(lower) && /\b(paste|ingest|assign|add)\b/.test(lower)) {
    const paste = extractPasteBlock(text) ?? text;
    return {
      actionType: "ingest_tracking",
      input: { paste },
      requiresConfirmation: true,
      previewSummary: "Ingest tracking paste and assign to matching order lines (no customer email).",
      confidence: paste.includes("\n") || /\bSJH-/i.test(paste) ? "high" : "medium"
    };
  }

  if (/\b(ageing|aging|unfulfilled|waiting|stale)\b/.test(lower)) {
    const daysMatch = lower.match(/(\d+)\s*day/);
    const olderThanDays = daysMatch ? Number(daysMatch[1]) : 3;
    return {
      actionType: "list_ageing_orders",
      input: { olderThanDays },
      requiresConfirmation: false,
      previewSummary: `List orders/lines still awaiting fulfilment older than ${olderThanDays} day(s).`,
      confidence: "high"
    };
  }

  if (/\b(margin|profit|p&l|pnl)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    return {
      actionType: "margin_report",
      input: orderMatch?.[1] ? { orderNumber: orderMatch[1].toUpperCase() } : { limit: 20 },
      requiresConfirmation: false,
      previewSummary: orderMatch?.[1]
        ? `Show margin breakdown for ${orderMatch[1].toUpperCase()}.`
        : "Show recent order margin summary (limit 20).",
      confidence: "high"
    };
  }

  if (/\b(chase|supplier email|email supplier|follow.?up supplier)\b/.test(lower)) {
    const poMatch = text.match(/\b(PO-\d+)\b/i);
    return {
      actionType: "draft_supplier_chase_email",
      input: poMatch?.[1] ? { poNumber: poMatch[1].toUpperCase() } : {},
      requiresConfirmation: false,
      previewSummary: poMatch?.[1]
        ? `Draft supplier chase email for ${poMatch[1].toUpperCase()} (not sent).`
        : "Draft supplier chase email (PO number required in confirm payload).",
      confidence: poMatch ? "high" : "low"
    };
  }

  if (/\b(issue|replacement|wrong item|defect|damaged|lost)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    let reason = "customer_issue";
    if (/\bwrong\b/.test(lower)) reason = "wrong_item";
    else if (/\bdefect\b/.test(lower)) reason = "manufacturing_defect";
    else if (/\bdamaged\b/.test(lower)) reason = "damaged_in_transit";
    else if (/\blost\b/.test(lower)) reason = "lost_shipment";
    else if (/\bmissing\b/.test(lower)) reason = "missing_item";
    else if (/\bsupplier\b/.test(lower)) reason = "supplier_error";
    else if (/\bgoodwill\b/.test(lower)) reason = "goodwill_replacement";

    return {
      actionType: "create_issue_case",
      input: {
        ...(orderMatch?.[1] ? { orderNumber: orderMatch[1].toUpperCase() } : {}),
        reason
      },
      requiresConfirmation: true,
      previewSummary: orderMatch?.[1]
        ? `Open issue case on ${orderMatch[1].toUpperCase()} (${reason.replaceAll("_", " ")}).`
        : `Open issue case (${reason.replaceAll("_", " ")}) — order number required.`,
      confidence: orderMatch ? "high" : "low"
    };
  }

  return null;
}

function extractPasteBlock(text: string): string | null {
  const fenced = text.match(/```([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }
  return null;
}

export function isReadOnlyOpsAction(actionType: OpsActionType): boolean {
  return READ_ONLY.has(actionType);
}
