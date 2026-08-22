import { describe, expect, it } from "vitest";
import { parseShoppingIntent, SHOPPING_ASSISTANT_NAME } from "./index";

describe("shopping assistant", () => {
  it("identifies as SJH AI", () => {
    expect(SHOPPING_ASSISTANT_NAME).toBe("SJH AI");
  });

  it("parses basketball team search intent", () => {
    const intent = parseShoppingIntent("Find me a Lakers jersey under £40");
    expect(intent.tool).toBe("search_products");
    expect(intent.filters?.sport).toEqual(["Basketball"]);
    expect(intent.filters?.priceMax).toBe(40);
  });

  it("parses soccer search intent", () => {
    const intent = parseShoppingIntent("Show me football jerseys");
    expect(intent.filters?.sport).toEqual(["Football"]);
  });

  it("routes customisation questions", () => {
    const intent = parseShoppingIntent("Can I customise this jersey?");
    expect(intent.tool).toBe("customisation_info");
  });
});
