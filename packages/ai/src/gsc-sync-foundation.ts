/**
 * GSC sync architecture — no live credentials required.
 * Persists page insights into gsc_page_insights when credentials are configured later.
 */
import type { GscPageInsight } from "./gsc-seo-foundation";
import { seoRecommendationsFromGsc } from "./gsc-seo-foundation";

export type GscSyncConfig = {
  siteUrl: string;
  credentialsJson?: string | null;
};

export type GscSyncResult = {
  ok: boolean;
  blocked: boolean;
  reason?: string;
  insights: GscPageInsight[];
  recommendations: Array<{ pagePath: string; items: string[] }>;
};

export function isGscConfigured(config: GscSyncConfig): boolean {
  return Boolean(config.credentialsJson?.trim());
}

/**
 * Placeholder sync — returns architecture-ready structure.
 * Live Search Console API integration activates when GSC_SERVICE_ACCOUNT_JSON is set.
 */
export function planGscSync(config: GscSyncConfig, pagePaths: string[]): GscSyncResult {
  if (!isGscConfigured(config)) {
    return {
      ok: false,
      blocked: true,
      reason: "GSC credentials not configured — architecture ready for GSC_SERVICE_ACCOUNT_JSON.",
      insights: [],
      recommendations: pagePaths.map((pagePath) => ({
        pagePath,
        items: [
          "Connect Google Search Console service account to enable indexing and CTR insights.",
          "Technical SEO foundation (canonical, schema, sitemap) can proceed without GSC."
        ]
      }))
    };
  }

  const insights: GscPageInsight[] = pagePaths.map((pagePath) => ({
    pagePath,
    issueCodes: ["weak_visibility"],
    impressions: null,
    clicks: null,
    ctr: null
  }));

  return {
    ok: true,
    blocked: false,
    insights,
    recommendations: insights.map((insight) => ({
      pagePath: insight.pagePath,
      items: seoRecommendationsFromGsc(insight)
    }))
  };
}
