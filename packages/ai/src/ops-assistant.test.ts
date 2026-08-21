import { describe, expect, it } from "vitest";
import { parseOpsIntent } from "./ops-assistant";

describe("parseOpsIntent", () => {
  it("parses PO batch requests", () => {
    const intent = parseOpsIntent("Create PO batch for 2026-08-20");
    expect(intent?.actionType).toBe("create_po_batch");
    expect(intent?.input.batchDate).toBe("2026-08-20");
    expect(intent?.requiresConfirmation).toBe(true);
  });

  it("parses ageing queries as read-only", () => {
    const intent = parseOpsIntent("Show ageing orders older than 5 days");
    expect(intent?.actionType).toBe("list_ageing_orders");
    expect(intent?.input.olderThanDays).toBe(5);
    expect(intent?.requiresConfirmation).toBe(false);
  });

  it("parses issue creation with order number", () => {
    const intent = parseOpsIntent("Open issue for wrong item on SJH-1001");
    expect(intent?.actionType).toBe("create_issue_case");
    expect(intent?.input.orderNumber).toBe("SJH-1001");
    expect(intent?.input.reason).toBe("wrong_item");
  });
});
