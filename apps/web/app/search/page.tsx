import { FacetNav } from "@/components/facet-nav";
import { ProductGrid } from "@/components/product-grid";
import { parseCatalogueFilters } from "@/lib/filters";
import { catalogueSummaryCount, hasCatalogueResults } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

type SearchPageProps = {
  searchParams: Promise<{ q?: string; league?: string; sport?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata = createMetadata({
  title: "Search | Sports Jersey House",
  description: "Search jerseys by team, league, or product name across the Sports Jersey House catalogue.",
  path: "/search"
});

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { q = "" } = params;
  const filterParams = { q, league: params.league, sport: params.sport };
  const trimmedQuery = q.trim();
  const search = getSearchProvider();
  const [response, facets] = await Promise.all([
    search.search({
      query: trimmedQuery,
      filters: parseCatalogueFilters(filterParams),
      limit: 24
    }),
    search.getCatalogueFacets()
  ]);
  const hasResults = hasCatalogueResults(response);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Search</p>
        <h1>{trimmedQuery ? `Results for “${trimmedQuery}”` : "Find your jersey"}</h1>
        <p>Search by team, league, sport, or product name.</p>
      </div>

      <form action="/search" className="search-form" method="get" role="search">
        <label className="visually-hidden" htmlFor="catalogue-search">
          Search products
        </label>
        <input
          autoComplete="off"
          defaultValue={trimmedQuery}
          enterKeyHint="search"
          id="catalogue-search"
          inputMode="search"
          name="q"
          placeholder="e.g. Bears, Lakers, Premier League"
          type="search"
        />
        {params.league ? <input name="league" type="hidden" value={params.league} /> : null}
        {params.sport ? <input name="sport" type="hidden" value={params.sport} /> : null}
        <button className="button primary search-submit" type="submit">
          Search
        </button>
      </form>

      <FacetNav facets={facets} params={filterParams} path="/search" />

      {hasResults ? (
        <>
          <p className="catalogue-summary">{catalogueSummaryCount(response)} jerseys found</p>
          <ProductGrid
            ariaLabel="Search results"
            products={response.results.map((result) => result.product)}
          />
        </>
      ) : (
        <section className="empty-state">
          <h2>{trimmedQuery || params.league || params.sport ? "No matching jerseys" : "Start typing to search"}</h2>
          <p>
            {trimmedQuery || params.league || params.sport
              ? "Try another team, league, or keyword — or browse collections by league."
              : "Search across NFL, NBA, NHL, MLB, and football kits."}
          </p>
        </section>
      )}
    </main>
  );
}
