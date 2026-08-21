/**
 * Google Search Console foundation types.
 * No live GSC sync yet — catalogue SEO recommendations can consume these later.
 */
export type GscIssueCode =
  | "not_indexed"
  | "crawled_not_indexed"
  | "soft_404"
  | "missing_schema"
  | "missing_meta"
  | "poor_ctr"
  | "weak_visibility"
  | "technical_seo";

export type GscPageInsight = {
  pagePath: string;
  productId?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  averagePosition?: number | null;
  issueCodes: GscIssueCode[];
  notes?: string | null;
};

/**
 * Map GSC-style observations into non-destructive SEO recommendations.
 * Never suggests rewriting product titles.
 */
export function seoRecommendationsFromGsc(insight: GscPageInsight): string[] {
  const recommendations: string[] = [];

  if (insight.issueCodes.includes("missing_meta")) {
    recommendations.push("Add or improve meta description while keeping the existing product title.");
  }
  if (insight.issueCodes.includes("missing_schema")) {
    recommendations.push("Add Product/Offer structured data using the existing title and taxonomy.");
  }
  if (insight.issueCodes.includes("poor_ctr")) {
    recommendations.push(
      "Improve meta description and internal links; do not rewrite the product title for CTR experiments."
    );
  }
  if (insight.issueCodes.includes("weak_visibility")) {
    recommendations.push(
      "Strengthen taxonomy, breadcrumbs, and collection links using legitimate team/player/league terms."
    );
  }
  if (insight.issueCodes.includes("not_indexed") || insight.issueCodes.includes("crawled_not_indexed")) {
    recommendations.push("Review indexing/canonical/sitemap inclusion — technical SEO only.");
  }
  if (insight.issueCodes.includes("technical_seo") || insight.issueCodes.includes("soft_404")) {
    recommendations.push("Investigate technical SEO / availability signals without deleting source records.");
  }

  return recommendations;
}
