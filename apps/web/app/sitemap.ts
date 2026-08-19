import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getSearchProvider } from "@/lib/search";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["/", "/products", "/collections", "/search", "/cart", "/pages/shipping", "/pages/returns", "/pages/privacy"];
  const search = getSearchProvider();
  const [productSlugs, collectionSlugs] = await Promise.all([
    search.listPublishedProductSlugs(),
    search.listPublishedCollectionSlugs()
  ]);

  const staticEntries = staticRoutes.map((route) => ({
    url: new URL(route, env.APP_URL).toString(),
    lastModified: new Date(),
    changeFrequency: route === "/" ? ("daily" as const) : ("weekly" as const),
    priority: route === "/" ? 1 : 0.8
  }));

  const productEntries = productSlugs.map((slug) => ({
    url: new URL(`/products/${slug}`, env.APP_URL).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7
  }));

  const collectionEntries = collectionSlugs.map((slug) => ({
    url: new URL(`/collections/${slug}`, env.APP_URL).toString(),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.75
  }));

  return [...staticEntries, ...productEntries, ...collectionEntries];
}
