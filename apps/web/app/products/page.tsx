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
  description:
    "Browse the Sports Jersey House development catalogue seeded locally for storefront and search testing.",
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

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Catalogue</p>
        <h1>Products</h1>
        <p>
          Live listings are loaded through the search provider abstraction backed by PostgreSQL full-text search and
          pgvector-ready schema. Shopify extraction remains disabled.
        </p>
      </div>

      <FacetNav facets={facets} params={filterParams} path="/products" />

      {hasDatabaseResults ? (
        <>
          <p className="catalogue-summary">{catalogueSummaryCount(response)} products available</p>
          <ProductGrid
            ariaLabel="Product catalogue"
            products={response.results.map((result) => result.product)}
          />
        </>
      ) : (
        <section className="empty-state">
          <h2>{params.league || params.sport ? "No products match these filters" : "No products indexed yet"}</h2>
          <p>
            {params.league || params.sport
              ? "Try clearing filters or choose another league or sport."
              : "Start local infrastructure, run migrations, then seed development catalogue data. Shopify sync stays off until explicitly approved."}
          </p>
          {!params.league && !params.sport ? (
            <ol>
              <li>
                <code>pnpm infra:up</code>
              </li>
              <li>
                <code>pnpm db:migrate</code>
              </li>
              <li>
                <code>pnpm db:seed</code>
              </li>
            </ol>
          ) : null}
        </section>
      )}
    </main>
  );
}
