import { describe, expect, it } from "vitest";
import { matchCourierFromRules } from "./tracking";

describe("matchCourierFromRules", () => {
  const rules = [
    {
      id: "1",
      name: "Prefix demo",
      pattern: "1Z",
      patternType: "prefix" as const,
      courierCode: "UPS",
      courierName: "UPS",
      isActive: true
    },
    {
      id: "2",
      name: "Regex demo",
      pattern: "^[A-Z]{2}\\d{9}GB$",
      patternType: "regex" as const,
      courierCode: "RM",
      courierName: "Royal Mail",
      isActive: true
    },
    {
      id: "3",
      name: "Inactive",
      pattern: "XYZ",
      patternType: "contains" as const,
      courierCode: "X",
      courierName: "X",
      isActive: false
    }
  ];

  it("matches prefix rules first by list order", () => {
    const match = matchCourierFromRules("1Z999AA10123456784", rules);
    expect(match?.courierCode).toBe("UPS");
  });

  it("matches regex rules", () => {
    const match = matchCourierFromRules("AB123456789GB", rules);
    expect(match?.courierCode).toBe("RM");
  });

  it("ignores inactive rules", () => {
    expect(matchCourierFromRules("XYZ999", rules)).toBeNull();
  });
});
