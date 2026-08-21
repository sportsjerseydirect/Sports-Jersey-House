import type { ShopifyMetafieldNode, ShopifyProductNode } from "../index";

export type InternalProductDraft = {
  shopifyId: string;
  slug: string;
  title: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  sport: string | null;
  league: string | null;
  team: string | null;
  status: "draft" | "review" | "published" | "archived";
  sourcePayload: Record<string, unknown>;
  variants: InternalVariantDraft[];
  images: InternalImageDraft[];
};

export type InternalVariantDraft = {
  shopifyId: string;
  sku: string | null;
  title: string;
  priceAmount: string;
  compareAtAmount: string | null;
  currencyCode: string;
  inventoryQuantity: number | null;
  isAvailable: boolean;
  options: Record<string, string>;
};

export type InternalImageDraft = {
  shopifyId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  sourceUrl: string;
  width: number | null;
  height: number | null;
};

const LEAGUE_TAG_PATTERNS: Array<{ pattern: RegExp; league: string; sport: string }> = [
  { pattern: /\bnfl\b/i, league: "NFL", sport: "Football" },
  { pattern: /\bnba\b/i, league: "NBA", sport: "Basketball" },
  { pattern: /\bnhl\b/i, league: "NHL", sport: "Hockey" },
  { pattern: /\bmlb\b/i, league: "MLB", sport: "Baseball" },
  { pattern: /\bpremier league\b/i, league: "Premier League", sport: "Soccer" },
  { pattern: /\bla liga\b/i, league: "La Liga", sport: "Soccer" },
  { pattern: /\bserie a\b/i, league: "Serie A", sport: "Soccer" },
  { pattern: /\bbundesliga\b/i, league: "Bundesliga", sport: "Soccer" },
  { pattern: /\bligue 1\b/i, league: "Ligue 1", sport: "Soccer" },
  { pattern: /\bmls\b/i, league: "MLS", sport: "Soccer" }
];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTaxonomy(tags: string[], productType: string): Pick<InternalProductDraft, "sport" | "league" | "team"> {
  const joined = [...tags, productType].join(" ");

  for (const entry of LEAGUE_TAG_PATTERNS) {
    if (entry.pattern.test(joined)) {
      const teamTag = tags.find((tag) => !entry.pattern.test(tag) && tag.length > 2);
      return {
        sport: entry.sport,
        league: entry.league,
        team: teamTag ?? null
      };
    }
  }

  const sportFromType = productType.toLowerCase();
  if (sportFromType.includes("jersey") || sportFromType.includes("kit")) {
    return { sport: null, league: null, team: tags[0] ?? null };
  }

  return { sport: null, league: null, team: null };
}

function mapShopifyStatus(status: string): InternalProductDraft["status"] {
  if (status === "ACTIVE") {
    return "draft";
  }

  if (status === "ARCHIVED") {
    return "archived";
  }

  return "draft";
}

function normalizePriceAmount(amount: string): string {
  const parsed = Number.parseFloat(amount);

  if (Number.isNaN(parsed)) {
    return "0.00";
  }

  return parsed.toFixed(2);
}

function mapVariants(node: ShopifyProductNode): InternalVariantDraft[] {
  return node.variants.edges.map(({ node: variant }) => ({
    shopifyId: variant.id,
    sku: variant.sku,
    title: variant.title,
    priceAmount: normalizePriceAmount(variant.price.amount),
    compareAtAmount: variant.compareAtPrice?.amount
      ? normalizePriceAmount(variant.compareAtPrice.amount)
      : null,
    currencyCode: variant.price.currencyCode,
    inventoryQuantity: variant.inventoryQuantity,
    isAvailable: variant.availableForSale,
    options: Object.fromEntries(variant.selectedOptions.map((option) => [option.name, option.value]))
  }));
}

function mapImages(node: ShopifyProductNode): InternalImageDraft[] {
  return node.images.edges.map(({ node: image }, index) => ({
    shopifyId: image.id,
    url: image.url,
    altText: image.altText,
    sortOrder: index,
    sourceUrl: image.url,
    width: image.width,
    height: image.height
  }));
}

function metafieldNodes(node: ShopifyProductNode): ShopifyMetafieldNode[] {
  return (node.metafields?.edges ?? []).map((edge) => edge.node);
}

function extractCustomizationHints(
  tags: string[],
  metafields: ShopifyMetafieldNode[]
): Record<string, unknown> {
  const tagText = tags.join(" ").toLowerCase();
  const metafieldText = metafields
    .map((field) => `${field.namespace}.${field.key}=${field.value}`)
    .join(" ")
    .toLowerCase();
  const haystack = `${tagText} ${metafieldText}`;

  const nameHint = /\b(name|personalise|personalize|custom.?name)\b/i.test(haystack);
  const numberHint = /\b(number|numeral|custom.?number|#)\b/i.test(haystack);
  const personaliseHint = /\b(personalise|personalize|customis|customiz)\b/i.test(haystack);

  const matchingMetafields = metafields.filter((field) =>
    /\b(name|number|personalise|personalize|custom)\b/i.test(`${field.key} ${field.value}`)
  );

  return {
    namePersonalization: nameHint,
    numberPersonalization: numberHint,
    personalizationLikely: personaliseHint || nameHint || numberHint,
    matchingMetafieldKeys: matchingMetafields.map((field) => `${field.namespace}.${field.key}`)
  };
}

/**
 * Full extract mapper (legacy path). May strip HTML into description for non-sample flows.
 */
export function mapShopifyProductToInternal(node: ShopifyProductNode): InternalProductDraft {
  const taxonomy = inferTaxonomy(node.tags, node.productType);

  return {
    shopifyId: node.id,
    slug: node.handle,
    title: node.title,
    description: node.descriptionHtml ? stripHtml(node.descriptionHtml) : null,
    vendor: node.vendor || null,
    productType: node.productType || null,
    sport: taxonomy.sport,
    league: taxonomy.league,
    team: taxonomy.team,
    status: mapShopifyStatus(node.status),
    sourcePayload: {
      origin: "shopify-extract",
      shopifyUpdatedAt: node.updatedAt,
      tags: node.tags,
      rawStatus: node.status
    },
    variants: mapVariants(node),
    images: mapImages(node)
  };
}

/**
 * Controlled sample/migration import mapper.
 * Never copies SJD descriptionHtml into products.description as canonical content.
 */
export function mapShopifyProductForSampleImport(node: ShopifyProductNode): InternalProductDraft {
  const taxonomy = inferTaxonomy(node.tags, node.productType);
  const metafields = metafieldNodes(node);
  const collections = (node.collections?.edges ?? []).map((edge) => ({
    id: edge.node.id,
    handle: edge.node.handle,
    title: edge.node.title
  }));

  return {
    shopifyId: node.id,
    slug: node.handle,
    title: node.title,
    description: `${node.title} (imported draft — content pending review)`,
    vendor: node.vendor || null,
    productType: node.productType || null,
    sport: taxonomy.sport,
    league: taxonomy.league,
    team: taxonomy.team,
    status: mapShopifyStatus(node.status),
    sourcePayload: {
      origin: "shopify-sample-import",
      shopifyUpdatedAt: node.updatedAt,
      tags: node.tags,
      rawStatus: node.status,
      descriptionHtml: node.descriptionHtml,
      seo: node.seo ?? null,
      metafields: metafields.map((field) => ({
        id: field.id,
        namespace: field.namespace,
        key: field.key,
        value: field.value,
        type: field.type
      })),
      collections,
      customizationHints: extractCustomizationHints(node.tags, metafields)
    },
    variants: mapVariants(node),
    images: mapImages(node)
  };
}
