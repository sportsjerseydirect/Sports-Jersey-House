/**
 * Typed shopping assistant tools — real DB, no LLM required for execution.
 */
import type { ProductDetail, ProductSummary } from "@sjh/shared";
import type { ShoppingSearchProvider } from "./index";

export type ShoppingToolExecution =
  | { tool: "search_products"; query: string; results: ProductSummary[] }
  | { tool: "get_product"; slug: string; product: ProductDetail | null }
  | { tool: "get_size_chart"; slug: string; guidance: string }
  | { tool: "get_customisation"; slug: string; info: string }
  | { tool: "get_shipping_info"; info: string }
  | { tool: "get_returns_policy"; info: string }
  | { tool: "compare_products"; slugs: string[]; products: ProductDetail[] }
  | { tool: "get_order_status"; orderNumber: string; message: string };

export async function executeShoppingTool(
  tool: string,
  input: Record<string, unknown>,
  search: ShoppingSearchProvider
): Promise<ShoppingToolExecution | null> {
  switch (tool) {
    case "search_products": {
      const query = String(input.query ?? "");
      const response = await search.search({ query, limit: 8, filters: { availableOnly: true } });
      return {
        tool: "search_products",
        query,
        results: response.results.map((r) => r.product)
      };
    }
    case "get_product": {
      const slug = String(input.slug ?? "");
      const product = await search.getProductBySlug(slug);
      return { tool: "get_product", slug, product };
    }
    case "get_size_chart": {
      const slug = String(input.slug ?? "");
      const product = await search.getProductBySlug(slug);
      const guidance = product?.sizeChart
        ? `Size chart "${product.sizeChart.title}" is on the product page. ${product.sizeChart.notes ?? "Compare measurements before ordering."}`
        : "Open the product page for the size guide. If unsure, order your usual size for this sport.";
      return { tool: "get_size_chart", slug, guidance };
    }
    case "get_customisation": {
      const slug = String(input.slug ?? "");
      const product = await search.getProductBySlug(slug);
      if (!product?.customisationProfile) {
        return {
          tool: "get_customisation",
          slug,
          info: "Customisation availability varies by product. This item may not support name/number personalisation."
        };
      }
      const modes = product.customisationProfile.allowedModes.join(", ");
      return {
        tool: "get_customisation",
        slug,
        info: `Customisation modes: ${modes}. Names are produced exactly as entered. Check the product page for pricing.`
      };
    }
    case "get_shipping_info":
      return {
        tool: "get_shipping_info",
        info: "Jerseys are made to order. Production typically takes a few weeks before dispatch. See /pages/shipping for regional expectations."
      };
    case "get_returns_policy":
      return {
        tool: "get_returns_policy",
        info: "Customised and made-to-order jerseys cannot be returned unless faulty. See /pages/returns for full policy."
      };
    case "compare_products": {
      const slugs = Array.isArray(input.slugs) ? input.slugs.map(String) : [];
      const products: ProductDetail[] = [];
      for (const slug of slugs.slice(0, 3)) {
        const p = await search.getProductBySlug(slug);
        if (p) products.push(p);
      }
      return { tool: "compare_products", slugs, products };
    }
    case "get_order_status":
      return {
        tool: "get_order_status",
        orderNumber: String(input.orderNumber ?? ""),
        message: "Order tracking is available via your confirmation email. Live order lookup in chat is not enabled yet."
      };
    default:
      return null;
  }
}
