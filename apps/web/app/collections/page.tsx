import Link from "next/link";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Collections | Sports Jersey House",
  description: "Shop sports jerseys by league — NFL, NBA, NHL, MLB, and Premier League.",
  path: "/collections"
});

export default async function CollectionsPage() {
  const search = getSearchProvider();
  const collections = await search.listPublishedCollections();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Leagues</p>
        <h1>Shop by league</h1>
        <p>Find your team’s colours across the biggest leagues in sport.</p>
      </div>

      {collections.length > 0 ? (
        <section className="collection-grid" aria-label="Product collections">
          {collections.map((collection) => (
            <Link className="collection-card" href={collectionDetailPath(collection.slug)} key={collection.id}>
              <p className="eyebrow">Collection</p>
              <h2>{collection.title}</h2>
              {collection.description ? <p>{collection.description}</p> : null}
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No collections yet</h2>
          <p>League collections will appear here once the catalogue is connected.</p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Browse products
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
