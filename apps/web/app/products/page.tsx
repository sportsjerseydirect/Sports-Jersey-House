import type { Metadata } from "next";
import { EmptySearchProvider } from "@sjh/search";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Products | Sports Jersey House",
  description: "Browse the Sports Jersey House catalogue foundation. Live products will appear after the approved read-only Shopify migration.",
  path: "/products"
});

export default async function ProductsPage() {
  const search = new EmptySearchProvider();
  const response = await search.search({ query: "", limit: 24 });

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Catalogue</p>
        <h1>Products</h1>
        <p>
          The product grid is wired to the search provider abstraction. It will use PostgreSQL full-text search and pgvector after the
          approved migration loads catalogue data.
        </p>
      </div>
      <section className="empty-state">
        <h2>{response.results.length} products indexed</h2>
        <p>Shopify extraction is disabled until credentials and migration approval are provided.</p>
      </section>
    </main>
  );
}
