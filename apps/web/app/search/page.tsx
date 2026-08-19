import Link from "next/link";
import {
  catalogueSummaryCount,
  formatProductPrice,
  hasCatalogueResults,
  productDetailPath
} from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata = createMetadata({
  title: "Search | Sports Jersey House",
  description: "Search the Sports Jersey House development catalogue by team, league, or product name.",
  path: "/search"
});

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const search = getSearchProvider();
  const response = await search.search({ query: q, limit: 24 });
  const hasResults = hasCatalogueResults(response);
  const trimmedQuery = q.trim();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Search</p>
        <h1>{trimmedQuery ? `Results for “${trimmedQuery}”` : "Search catalogue"}</h1>
        <p>Full-text search runs through the PostgreSQL search provider abstraction.</p>
      </div>

      <form action="/search" className="search-form" method="get" role="search">
        <label className="sr-only" htmlFor="catalogue-search">
          Search products
        </label>
        <input
          defaultValue={trimmedQuery}
          id="catalogue-search"
          name="q"
          placeholder="Search by team, league, or product"
          type="search"
        />
        <button className="button primary search-submit" type="submit">
          Search
        </button>
      </form>

      {hasResults ? (
        <>
          <p className="catalogue-summary">{catalogueSummaryCount(response)} products found</p>
          <section className="product-grid" aria-label="Search results">
            {response.results.map(({ product }) => (
              <Link className="product-card" href={productDetailPath(product.slug)} key={product.id}>
                <div className="product-card-media">
                  {product.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={product.title} height={800} src={product.primaryImageUrl} width={600} />
                  ) : (
                    <div className="product-card-fallback" aria-hidden="true">
                      SJH
                    </div>
                  )}
                </div>
                <div className="product-card-body">
                  <p className="product-card-meta">
                    {[product.league, product.team].filter(Boolean).join(" · ")}
                  </p>
                  <h2>{product.title}</h2>
                  {product.price ? (
                    <p className="product-card-price">
                      {formatProductPrice(product.price.amount, product.price.currencyCode)}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : (
        <section className="empty-state">
          <h2>{trimmedQuery ? "No matching products" : "Enter a search term"}</h2>
          <p>
            {trimmedQuery
              ? "Try another team, league, or product keyword from the seeded dev catalogue."
              : "Search the local development catalogue once Postgres is running and seeded."}
          </p>
        </section>
      )}
    </main>
  );
}
