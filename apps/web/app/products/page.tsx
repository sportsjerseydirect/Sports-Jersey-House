import Link from "next/link";
import {
  catalogueSummaryCount,
  formatProductPrice,
  hasCatalogueResults,
  productDetailPath
} from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = createMetadata({
  title: "Products | Sports Jersey House",
  description:
    "Browse the Sports Jersey House development catalogue seeded locally for storefront and search testing.",
  path: "/products"
});

export default async function ProductsPage() {
  const search = getSearchProvider();
  const response = await search.search({ query: "", limit: 24 });
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

      {hasDatabaseResults ? (
        <>
          <p className="catalogue-summary">{catalogueSummaryCount(response)} products available</p>
          <section className="product-grid" aria-label="Product catalogue">
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
          <h2>No products indexed yet</h2>
          <p>
            Start local infrastructure, run migrations, then seed development catalogue data. Shopify sync stays off until
            explicitly approved.
          </p>
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
        </section>
      )}
    </main>
  );
}
