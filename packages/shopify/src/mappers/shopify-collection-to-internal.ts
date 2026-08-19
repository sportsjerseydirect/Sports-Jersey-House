import type { ShopifyCollectionNode } from "../index";

export type InternalCollectionDraft = {
  shopifyId: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "review" | "published" | "archived";
  sourcePayload: Record<string, unknown>;
  productShopifyIds: string[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapShopifyCollectionToInternal(node: ShopifyCollectionNode): InternalCollectionDraft {
  return {
    shopifyId: node.id,
    slug: node.handle,
    title: node.title,
    description: node.descriptionHtml ? stripHtml(node.descriptionHtml) : null,
    status: "draft",
    sourcePayload: {
      origin: "shopify-extract",
      shopifyUpdatedAt: node.updatedAt
    },
    productShopifyIds: node.products.edges.map((edge) => edge.node.id)
  };
}
