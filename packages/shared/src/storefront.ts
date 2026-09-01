import type { CollectionSummary } from "./index";
import { LEAGUE_BROWSE_SLUGS, LEAGUE_COLLECTION_SLUGS } from "./league-collections";

export { LEAGUE_BROWSE_SLUGS, LEAGUE_COLLECTION_SLUGS };

const INTERNAL_COLLECTION_PATTERNS = [
  /chatgpt/i,
  /all-products-chatgpt/i,
  /^all-products\b/i,
  /development collection/i
];

const INTERNAL_DESCRIPTION_PATTERNS = [
  /^development collection/i,
  /chatgpt/i,
  /ai product description/i
];

export function isInternalCollectionSlug(slug: string): boolean {
  return INTERNAL_COLLECTION_PATTERNS.some((pattern) => pattern.test(slug));
}

export function isInternalCollectionTitle(title: string): boolean {
  return INTERNAL_COLLECTION_PATTERNS.some((pattern) => pattern.test(title));
}

export function sanitizeCollectionDescription(description: string | undefined): string | undefined {
  if (!description) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (INTERNAL_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  if (trimmed.length > 140) {
    return `${trimmed.slice(0, 137).trimEnd()}…`;
  }
  return trimmed;
}

export function filterCustomerCollections(collections: CollectionSummary[]): CollectionSummary[] {
  return collections.filter(
    (collection) =>
      !isInternalCollectionSlug(collection.slug) && !isInternalCollectionTitle(collection.title)
  );
}

export function getLeagueBrowseCards(
  collections: CollectionSummary[]
): Array<{ slug: string; title: string; description?: string }> {
  const bySlug = new Map(collections.map((c) => [c.slug, c]));
  const cards: Array<{ slug: string; title: string; description?: string }> = [];

  for (const slug of LEAGUE_BROWSE_SLUGS) {
    const existing = bySlug.get(slug);
    const leagueMeta = LEAGUE_COLLECTION_SLUGS[slug];
    if (existing && !isInternalCollectionTitle(existing.title)) {
      const description = sanitizeCollectionDescription(existing.description);
      cards.push({
        slug: existing.slug,
        title: existing.title,
        ...(description ? { description } : {})
      });
    } else if (leagueMeta) {
      cards.push({
        slug,
        title: leagueMeta.title,
        ...(leagueMeta.description ? { description: leagueMeta.description } : {})
      });
    }
  }

  return cards;
}

export type StorefrontImageRef = {
  url: string;
  altText?: string | null;
};

/**
 * Pick the product image that best matches a colour label (variant galleries without per-variant IDs).
 */
export function resolveImageUrlForColour(
  images: StorefrontImageRef[],
  colourLabel: string | null | undefined
): string | undefined {
  if (images.length === 0) return undefined;
  if (!colourLabel?.trim()) return images[0]?.url;

  const needle = colourLabel.trim().toLowerCase();

  const byAlt = images.find((image) => image.altText?.toLowerCase().includes(needle));
  if (byAlt) return byAlt.url;

  const byUrl = images.find((image) => image.url.toLowerCase().includes(needle));
  if (byUrl) return byUrl.url;

  return images[0]?.url;
}

export function resolveImageIndexForColour(
  images: StorefrontImageRef[],
  colourLabel: string | null | undefined
): number {
  if (images.length === 0) return 0;
  if (!colourLabel?.trim()) return 0;

  const needle = colourLabel.trim().toLowerCase();
  const byAlt = images.findIndex((image) => image.altText?.toLowerCase().includes(needle));
  if (byAlt >= 0) return byAlt;

  const byUrl = images.findIndex((image) => image.url.toLowerCase().includes(needle));
  if (byUrl >= 0) return byUrl;

  return 0;
}

const FULFILMENT_CUSTOMER_LABELS: Record<string, string> = {
  unfulfilled: "Preparing your order",
  partial: "Partially shipped",
  fulfilled: "Delivered",
  cancelled: "Cancelled"
};

export function formatCustomerFulfilmentStatus(status: string): string {
  return FULFILMENT_CUSTOMER_LABELS[status] ?? status.replaceAll("_", " ");
}

export function formatCartItemCount(count: number): string {
  return count === 1 ? "1 item ready for checkout." : `${count} items ready for checkout.`;
}
