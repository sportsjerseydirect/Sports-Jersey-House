import { getSearchProvider } from "@/lib/search";

export type CatalogueStats = {
  productCount: number;
  collectionCount: number;
  leagues: string[];
};

export async function getCatalogueStats(): Promise<CatalogueStats> {
  const search = getSearchProvider();
  const [productSlugs, collectionSlugs, facets] = await Promise.all([
    search.listPublishedProductSlugs(),
    search.listPublishedCollectionSlugs(),
    search.getCatalogueFacets()
  ]);

  return {
    productCount: productSlugs.length,
    collectionCount: collectionSlugs.length,
    leagues: facets.filter((facet) => facet.field === "league").map((facet) => facet.value)
  };
}
