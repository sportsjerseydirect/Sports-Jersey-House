import { describe, expect, it } from "vitest";
import { assertWorkflowTransition } from "./product-workflow";

describe("product workflow transitions", () => {
  it("allows draft → review → approved → published", () => {
    expect(assertWorkflowTransition("send_to_review", "draft")).toBe("review");
    expect(assertWorkflowTransition("approve", "review")).toBe("approved");
    expect(assertWorkflowTransition("publish", "approved")).toBe("published");
  });

  it("allows return to draft from published without deleting identity", () => {
    expect(assertWorkflowTransition("reject_to_draft", "published")).toBe("draft");
  });

  it("rejects illegal publish from draft", () => {
    expect(() => assertWorkflowTransition("publish", "draft")).toThrow(/Cannot publish/);
  });
});
