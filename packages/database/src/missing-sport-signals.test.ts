import { describe, expect, it } from "vitest";
import {
  isGenericJerseyOnly,
  isHighConfidenceBaseball,
  isHighConfidenceHockey
} from "./missing-sport-signals";

describe("missing-sport HIGH confidence rules", () => {
  it("rejects generic baseball jersey without MLB evidence", () => {
    expect(isHighConfidenceBaseball("Maryland Terrapins Custom Baseball Jersey – Red", "md-terrapins", null)).toBe(
      false
    );
    expect(isGenericJerseyOnly("Maryland Terrapins Custom Baseball Jersey – Red", "Baseball")).toBe(true);
  });

  it("rejects generic hockey jersey for college products", () => {
    expect(isHighConfidenceHockey("Georgetown Hoyas Spirit Hockey Jersey - Navy", "georgetown-hoyas", null)).toBe(
      false
    );
  });

  it("rejects Olympic/international hockey as HIGH", () => {
    expect(isHighConfidenceHockey("Canada National Team Olympic Hockey Jersey – Red", "canada-olympic", null)).toBe(
      false
    );
  });

  it("accepts explicit MLB franchise names", () => {
    expect(
      isHighConfidenceBaseball(
        "Aaron Judge #99 New York Yankees USA 250 Fourth of July Home Baseball Jersey",
        "aaron-judge-yankees",
        null
      )
    ).toBe(true);
  });

  it("accepts explicit NHL franchise names", () => {
    expect(isHighConfidenceHockey("Macklin Celebrini San Jose Sharks Home White Hockey Jersey", "celebrini-sharks", null)).toBe(
      true
    );
  });

  it("generic jersey alone is not HIGH for pro-looking title without franchise token", () => {
    expect(isHighConfidenceBaseball("Peter Lafluer Average Joe's Baseball Jersey", "average-joes", null)).toBe(false);
    expect(isHighConfidenceHockey("Dean Youngblood #10 Mustangs Hockey Jersey", "mustangs", null)).toBe(false);
  });
});
