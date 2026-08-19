import Link from "next/link";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Collections | Sports Jersey House",
  description: "Browse development collections grouped by league in the local Sports Jersey House catalogue.",
  path: "/collections"
});

export default async function CollectionsPage() {
  const search = getSearchProvider();
  const collections = await search.listPublishedCollections();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Collections</p>
        <h1>Shop by league</h1>
        <p>Development collections seeded locally and linked to catalogue products by league metadata.</p>
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
          <h2>No collections indexed yet</h2>
          <p>Run migrations and seed development data to create NFL, NBA, and NHL collections locally.</p>
        </section>
      )}
    </main>
  );
}
