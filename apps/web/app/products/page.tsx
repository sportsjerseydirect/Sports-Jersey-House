import { FacetNav } from "@/components/facet-nav";
import { ProductGrid } from "@/components/product-grid";
import { parseCatalogueFilters } from "@/lib/filters";
import { catalogueSummaryCount, hasCatalogueResults } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

type ProductsPageProps = {
  searchParams: Promise<{ league?: string; sport?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata = createMetadata({
  title: "Products | Sports Jersey House",
  description: "Shop premium sports jerseys across NFL, NBA, NHL, MLB, and world football.",
  path: "/products"
});

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const filterParams = { league: params.league, sport: params.sport };
  const search = getSearchProvider();
  const [response, facets] = await Promise.all([
    search.search({ query: "", filters: parseCatalogueFilters(filterParams), limit: 24 }),
    search.getCatalogueFacets()
  ]);
  const hasDatabaseResults = hasCatalogueResults(response);
  const hasActiveFilters = Boolean(params.league || params.sport);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Catalogue</p>
        <h1>All jerseys</h1>
        <p>Browse the full range, then refine by sport or league.</p>
      </div>

      <FacetNav facets={facets} params={filterParams} path="/products" />

      {hasDatabaseResults ? (
        <>
          <p className="catalogue-summary">{catalogueSummaryCount(response)} jerseys available</p>
          <ProductGrid
            ariaLabel="Product catalogue"
            products={response.results.map((result) => result.product)}
          />
        </>
      ) : (
        <section className="empty-state">
          <h2>{hasActiveFilters ? "No jerseys match these filters" : "Catalogue unavailable"}</h2>
          <p>
            {hasActiveFilters
              ? "Try clearing filters or choose another league or sport."
              : "We couldn’t load products right now. Check your database connection and try again."}
          </p>
        </section>
      )}
    </main>
  );
}
