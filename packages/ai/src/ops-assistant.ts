import { z } from "zod";
import { parseOpsIntentV2, type OpsToolIntent } from "./ops-tools";

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

/**
 * Deterministic ops intent parser (no provider required).
 * High-risk actions always require confirmation before execution.
 * Delegates to parseOpsIntentV2 when the tool maps onto a legacy action type.
 */
export function parseOpsIntent(prompt: string): OpsIntent | null {
  const v2 = parseOpsIntentV2(prompt);
  if (v2) {
    const legacy = mapV2ToLegacyIntent(v2);
    if (legacy) {
      return legacy;
    }
  }

  const text = prompt.trim();
  if (!text) {
    return null;
  }

  const lower = text.toLowerCase();

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

  return null;
}

function mapV2ToLegacyIntent(v2: OpsToolIntent): OpsIntent | null {
  switch (v2.toolName) {
    case "create_po_batch":
      return {
        actionType: "create_po_batch",
        input: v2.args,
        requiresConfirmation: v2.requiresConfirmation,
        previewSummary: v2.previewSummary,
        confidence: "high"
      };
    case "update_tracking":
      return {
        actionType: "ingest_tracking",
        input: v2.args,
        requiresConfirmation: v2.requiresConfirmation,
        previewSummary: v2.previewSummary,
        confidence: "high"
      };
    case "calculate_margin":
      return {
        actionType: "margin_report",
        input: v2.args,
        requiresConfirmation: false,
        previewSummary: v2.previewSummary,
        confidence: "high"
      };
    case "prepare_supplier_email":
      return {
        actionType: "draft_supplier_chase_email",
        input: v2.args,
        requiresConfirmation: false,
        previewSummary: v2.previewSummary,
        confidence: "high"
      };
    case "create_issue_case":
      return {
        actionType: "create_issue_case",
        input: v2.args,
        requiresConfirmation: v2.requiresConfirmation,
        previewSummary: v2.previewSummary,
        confidence: "high"
      };
    default:
      return null;
  }
}

export function isReadOnlyOpsAction(actionType: OpsActionType): boolean {
  return READ_ONLY.has(actionType);
}
