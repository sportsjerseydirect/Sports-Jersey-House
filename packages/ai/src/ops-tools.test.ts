import { describe, expect, it } from "vitest";
import { OPS_TOOL_DEFINITIONS, parseOpsIntentV2 } from "./ops-tools";

describe("OPS_TOOL_DEFINITIONS", () => {
  it("exposes the expected tool surface", () => {
    const names = OPS_TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toContain("create_po_batch");
    expect(names).toContain("prepare_supplier_email");
    expect(names).toContain("inspect_catalogue");
  });
});

describe("parseOpsIntentV2", () => {
  it("parses PO batch with dry-run flag", () => {
    const intent = parseOpsIntentV2("Create PO batch dry run for 2026-08-20");
    expect(intent?.toolName).toBe("create_po_batch");
    expect(intent?.args.batchDate).toBe("2026-08-20");
    expect(intent?.args.dryRun).toBe(true);
    expect(intent?.requiresConfirmation).toBe(true);
  });

  it("parses tracking ingest", () => {
    const intent = parseOpsIntentV2("Ingest tracking paste\n```SJH-1 1Z999\n```");
    expect(intent?.toolName).toBe("update_tracking");
    expect(String(intent?.args.paste)).toContain("SJH-1");
  });

  it("parses margin calculation", () => {
    const intent = parseOpsIntentV2("Calculate margin for SJH-1001");
    expect(intent?.toolName).toBe("calculate_margin");
    expect(intent?.args.orderNumber).toBe("SJH-1001");
    expect(intent?.requiresConfirmation).toBe(false);
  });

  it("parses prepare_* tools as draft intents", () => {
    const supplier = parseOpsIntentV2("Prepare supplier email chase for PO-1001");
    expect(supplier?.toolName).toBe("prepare_supplier_email");
    expect(supplier?.args.poNumber).toBe("PO-1001");

    const customer = parseOpsIntentV2("Email customer shipping update for SJH-1001");
    expect(customer?.toolName).toBe("prepare_customer_email");
    expect(customer?.args.orderNumber).toBe("SJH-1001");
  });

  it("parses catalogue inspect", () => {
    const intent = parseOpsIntentV2("Inspect catalogue duplicates");
    expect(intent?.toolName).toBe("inspect_catalogue");
    expect(intent?.requiresConfirmation).toBe(false);
  });

  it("returns null for empty prompts", () => {
    expect(parseOpsIntentV2("")).toBeNull();
    expect(parseOpsIntentV2("   ")).toBeNull();
  });
});
