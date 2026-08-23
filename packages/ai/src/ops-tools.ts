export type OpsToolRisk = "read" | "write" | "external" | "financial" | "customer";

export type OpsToolName =
  | "create_po_batch"
  | "update_tracking"
  | "identify_courier"
  | "update_supplier_cost"
  | "calculate_margin"
  | "create_issue_case"
  | "prepare_replacement"
  | "prepare_supplier_email"
  | "prepare_customer_email"
  | "inspect_catalogue"
  | "attention_today"
  | "list_tracking_overdue"
  | "list_delivery_overdue"
  | "list_low_margin_orders"
  | "list_poor_seo"
  | "list_chargeback_risk";

export type OpsToolDefinition = {
  name: OpsToolName;
  description: string;
  requiresConfirmation: boolean;
  risk: OpsToolRisk;
  /** Zod-like plain object description for LLM tool schemas (not runtime Zod). */
  inputSchema: Record<string, unknown>;
};

export type OpsToolIntent = {
  toolName: OpsToolName;
  args: Record<string, unknown>;
  requiresConfirmation: boolean;
  previewSummary: string;
};

export const OPS_TOOL_DEFINITIONS: OpsToolDefinition[] = [
  {
    name: "create_po_batch",
    description: "Create a daily purchase-order batch (one PO per supplier for eligible lines).",
    requiresConfirmation: true,
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        batchDate: { type: "string", description: "ISO date YYYY-MM-DD" },
        dryRun: { type: "boolean", description: "Count eligible lines without creating POs" }
      }
    }
  },
  {
    name: "update_tracking",
    description: "Ingest tracking paste and assign numbers to order lines.",
    requiresConfirmation: true,
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        paste: { type: "string", description: "Multi-line order/tracking paste" }
      },
      required: ["paste"]
    }
  },
  {
    name: "identify_courier",
    description: "Match a tracking number to a courier rule.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: {
        trackingNumber: { type: "string" }
      },
      required: ["trackingNumber"]
    }
  },
  {
    name: "update_supplier_cost",
    description: "Update supplier cost on an order line or product mapping.",
    requiresConfirmation: true,
    risk: "financial",
    inputSchema: {
      type: "object",
      properties: {
        orderItemId: { type: "string" },
        productId: { type: "string" },
        supplierCostAmount: { type: "string" },
        unitCostAmount: { type: "string" }
      }
    }
  },
  {
    name: "calculate_margin",
    description: "Calculate or report margin for an order or recent orders.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "create_issue_case",
    description: "Open an issue / replacement case on an order.",
    requiresConfirmation: true,
    risk: "write",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        reason: { type: "string" },
        orderItemId: { type: "string" },
        notes: { type: "string" }
      },
      required: ["orderNumber", "reason"]
    }
  },
  {
    name: "prepare_replacement",
    description: "Prepare a replacement plan for an issue case (draft only).",
    requiresConfirmation: true,
    risk: "financial",
    inputSchema: {
      type: "object",
      properties: {
        caseNumber: { type: "string" },
        replacementCostAmount: { type: "string" }
      },
      required: ["caseNumber"]
    }
  },
  {
    name: "prepare_supplier_email",
    description: "Prepare a supplier chase/PO email draft. Never sends.",
    requiresConfirmation: false,
    risk: "external",
    inputSchema: {
      type: "object",
      properties: {
        poNumber: { type: "string" },
        purpose: { type: "string", description: "chase | packing_slip | tracking_request" }
      }
    }
  },
  {
    name: "prepare_customer_email",
    description: "Prepare a customer shipping/issue email draft. Never sends.",
    requiresConfirmation: false,
    risk: "customer",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        purpose: { type: "string", description: "shipping | issue | goodwill" }
      },
      required: ["orderNumber"]
    }
  },
  {
    name: "inspect_catalogue",
    description: "Inspect catalogue signals, proposals, or IP risk flags (read-only).",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: {
        productId: { type: "string" },
        proposalNumber: { type: "string" }
      }
    }
  },
  {
    name: "attention_today",
    description: "Summarise orders, SLA, issues, margins, and jobs needing attention today.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "list_tracking_overdue",
    description: "List supplier lines missing tracking beyond the SLA window.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } }
    }
  },
  {
    name: "list_delivery_overdue",
    description: "List shipments older than 30 days without delivery.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } }
    }
  },
  {
    name: "list_low_margin_orders",
    description: "List orders with contribution margin below 20% where supplier cost is known.",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } }
    }
  },
  {
    name: "list_poor_seo",
    description: "List published products with SEO metadata gaps (does not rewrite titles).",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } }
    }
  },
  {
    name: "list_chargeback_risk",
    description: "List or evaluate chargeback/dispute risk scores (advisory only).",
    requiresConfirmation: false,
    risk: "read",
    inputSchema: {
      type: "object",
      properties: {
        orderNumber: { type: "string" },
        evaluateRecent: { type: "boolean" },
        limit: { type: "number" }
      }
    }
  }
];

const TOOL_BY_NAME = new Map(OPS_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractPasteBlock(text: string): string | null {
  const fenced = text.match(/```([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) {
    return fenced[1].trim();
  }
  return null;
}

/**
 * Interim keyword matcher structured for future LLM tool calling.
 * Returns toolName + args + confirmation flag + preview summary.
 */
export function parseOpsIntentV2(prompt: string): OpsToolIntent | null {
  const text = prompt.trim();
  if (!text) {
    return null;
  }

  const lower = text.toLowerCase();

  if (/\b(po|purchase order|batch)\b/.test(lower) && /\b(create|run|generate|batch)\b/.test(lower)) {
    const dateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const batchDate = dateMatch?.[1] ?? todayIsoDate();
    const tool = TOOL_BY_NAME.get("create_po_batch")!;
    return {
      toolName: "create_po_batch",
      args: { batchDate, dryRun: /\bdry\s*run\b/.test(lower) },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: `Create purchase-order batch for ${batchDate} (one PO per supplier for eligible lines).`
    };
  }

  if (/\b(tracking|track)\b/.test(lower) && /\b(paste|ingest|assign|add|update)\b/.test(lower)) {
    const paste = extractPasteBlock(text) ?? text;
    const tool = TOOL_BY_NAME.get("update_tracking")!;
    return {
      toolName: "update_tracking",
      args: { paste },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "Ingest tracking paste and assign to matching order lines (no customer email)."
    };
  }

  if (/\b(courier|identify courier|which courier)\b/.test(lower)) {
    const trackingMatch = text.match(/\b([A-Z0-9]{8,})\b/i);
    const tool = TOOL_BY_NAME.get("identify_courier")!;
    return {
      toolName: "identify_courier",
      args: trackingMatch?.[1] ? { trackingNumber: trackingMatch[1] } : {},
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: trackingMatch?.[1]
        ? `Identify courier for tracking ${trackingMatch[1]}.`
        : "Identify courier for a tracking number."
    };
  }

  if (/\b(supplier cost|unit cost|update cost)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("update_supplier_cost")!;
    const amountMatch = text.match(/\$?\d+(?:\.\d{1,2})?/);
    return {
      toolName: "update_supplier_cost",
      args: amountMatch ? { supplierCostAmount: amountMatch[0].replace("$", "") } : {},
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "Update supplier cost (confirmation required before write)."
    };
  }

  if (/\b(margin|profit|p&l|pnl|calculate margin)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    const tool = TOOL_BY_NAME.get("calculate_margin")!;
    return {
      toolName: "calculate_margin",
      args: orderMatch?.[1] ? { orderNumber: orderMatch[1].toUpperCase() } : { limit: 20 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: orderMatch?.[1]
        ? `Calculate margin for ${orderMatch[1].toUpperCase()}.`
        : "Show recent order margin summary (limit 20)."
    };
  }

  if (/\b(replacement|prepare replacement)\b/.test(lower) && /\b(case|issue|ISS-)\b/i.test(text)) {
    const caseMatch = text.match(/\b(ISS-\d+)\b/i);
    const tool = TOOL_BY_NAME.get("prepare_replacement")!;
    return {
      toolName: "prepare_replacement",
      args: caseMatch?.[1] ? { caseNumber: caseMatch[1].toUpperCase() } : {},
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: caseMatch?.[1]
        ? `Prepare replacement draft for ${caseMatch[1].toUpperCase()}.`
        : "Prepare replacement draft (case number required)."
    };
  }

  if (/\b(issue|wrong item|defect|damaged|lost)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    let reason = "customer_issue";
    if (/\bwrong\b/.test(lower)) reason = "wrong_item";
    else if (/\bdefect\b/.test(lower)) reason = "manufacturing_defect";
    else if (/\bdamaged\b/.test(lower)) reason = "damaged_in_transit";
    else if (/\blost\b/.test(lower)) reason = "lost_shipment";
    else if (/\bmissing\b/.test(lower)) reason = "missing_item";
    else if (/\bsupplier\b/.test(lower)) reason = "supplier_error";
    else if (/\bgoodwill\b/.test(lower)) reason = "goodwill_replacement";

    const tool = TOOL_BY_NAME.get("create_issue_case")!;
    return {
      toolName: "create_issue_case",
      args: {
        ...(orderMatch?.[1] ? { orderNumber: orderMatch[1].toUpperCase() } : {}),
        reason
      },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: orderMatch?.[1]
        ? `Open issue case on ${orderMatch[1].toUpperCase()} (${reason.replaceAll("_", " ")}).`
        : `Open issue case (${reason.replaceAll("_", " ")}) — order number required.`
    };
  }

  if (/\b(chase|supplier email|email supplier|follow.?up supplier|prepare supplier)\b/.test(lower)) {
    const poMatch = text.match(/\b(PO-\d+)\b/i);
    const tool = TOOL_BY_NAME.get("prepare_supplier_email")!;
    return {
      toolName: "prepare_supplier_email",
      args: {
        ...(poMatch?.[1] ? { poNumber: poMatch[1].toUpperCase() } : {}),
        purpose: "chase"
      },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: poMatch?.[1]
        ? `Draft supplier email for ${poMatch[1].toUpperCase()} (not sent).`
        : "Draft supplier email (PO number required)."
    };
  }

  if (/\b(customer email|email customer|shipping email|notify customer)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    const tool = TOOL_BY_NAME.get("prepare_customer_email")!;
    return {
      toolName: "prepare_customer_email",
      args: {
        ...(orderMatch?.[1] ? { orderNumber: orderMatch[1].toUpperCase() } : {}),
        purpose: /\bissue\b/.test(lower) ? "issue" : "shipping"
      },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: orderMatch?.[1]
        ? `Draft customer email for ${orderMatch[1].toUpperCase()} (not sent).`
        : "Draft customer email (order number required)."
    };
  }

  if (/\b(catalogue|catalog|listing|duplicate|retire|inspect catalogue)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("inspect_catalogue")!;
    return {
      toolName: "inspect_catalogue",
      args: {},
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "Inspect catalogue signals and review queue (read-only)."
    };
  }

  if (
    /\b(attention|needs my attention|what needs|today'?s priorities|action required)\b/.test(lower)
  ) {
    const tool = TOOL_BY_NAME.get("attention_today")!;
    return {
      toolName: "attention_today",
      args: {},
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "Summarise everything that needs attention today (read-only)."
    };
  }

  if (/\b(tracking overdue|missing tracking|waiting for tracking|no tracking)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("list_tracking_overdue")!;
    return {
      toolName: "list_tracking_overdue",
      args: { limit: 50 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "List orders/POs missing tracking beyond SLA (read-only)."
    };
  }

  if (/\b(delivery overdue|not delivered|older than 30|30 days)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("list_delivery_overdue")!;
    return {
      toolName: "list_delivery_overdue",
      args: { limit: 50 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "List shipments older than 30 days without delivery (read-only)."
    };
  }

  if (/\b(low[- ]margin|poor margin|margin below)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("list_low_margin_orders")!;
    return {
      toolName: "list_low_margin_orders",
      args: { limit: 40 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "List low-margin orders where supplier cost is known (read-only)."
    };
  }

  if (/\b(poor seo|seo issues|missing meta|not indexed|seo gap)\b/.test(lower)) {
    const tool = TOOL_BY_NAME.get("list_poor_seo")!;
    return {
      toolName: "list_poor_seo",
      args: { limit: 40 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: "List published products with SEO metadata gaps (titles unchanged)."
    };
  }

  if (/\b(chargeback|dispute risk|risk score|at risk)\b/.test(lower)) {
    const orderMatch = text.match(/\b(SJH-\d+)\b/i);
    const tool = TOOL_BY_NAME.get("list_chargeback_risk")!;
    return {
      toolName: "list_chargeback_risk",
      args: orderMatch?.[1]
        ? { orderNumber: orderMatch[1].toUpperCase() }
        : { evaluateRecent: true, limit: 40 },
      requiresConfirmation: tool.requiresConfirmation,
      previewSummary: orderMatch?.[1]
        ? `Evaluate chargeback/dispute risk for ${orderMatch[1].toUpperCase()} (advisory).`
        : "Evaluate recent orders for chargeback/dispute risk (advisory only)."
    };
  }

  return null;
}
