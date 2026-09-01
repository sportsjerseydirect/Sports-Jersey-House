import Link from "next/link";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { createMetadata } from "@/lib/seo";
import {
  filterCustomerCollections,
  getLeagueBrowseCards,
  sanitizeCollectionDescription
} from "@sjh/shared";

export const revalidate = 3600;

export const metadata = createMetadata({
  title: "Collections | Sports Jersey House",
  description: "Shop sports jerseys by league — NFL, NBA, NHL, MLB, and Premier League.",
  path: "/collections"
});

export default async function CollectionsPage() {
  const search = getSearchProvider();
  const collections = filterCustomerCollections(await search.listPublishedCollections());
  const leagueCards = getLeagueBrowseCards(collections);
  const leagueSlugs = new Set(leagueCards.map((card) => card.slug));
  const additionalCollections = collections.filter((collection) => !leagueSlugs.has(collection.slug));

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Leagues</p>
        <h1>Shop by league</h1>
        <p>Find your team’s colours across the biggest leagues in sport.</p>
      </div>

      {leagueCards.length > 0 ? (
        <section className="collection-grid" aria-label="Major leagues">
          {leagueCards.map((collection) => (
            <Link
              className="collection-card"
              href={collectionDetailPath(collection.slug)}
              key={collection.slug}
            >
              <p className="eyebrow">League</p>
              <h2>{collection.title}</h2>
              {collection.description ? <p>{collection.description}</p> : null}
            </Link>
          ))}
        </section>
      ) : null}

      {additionalCollections.length > 0 ? (
        <section className="collections-more" aria-label="More collections">
          <div className="section-heading compact">
            <h2>More collections</h2>
          </div>
          <div className="collection-grid">
            {additionalCollections.map((collection) => {
              const description = sanitizeCollectionDescription(collection.description);
              return (
                <Link
                  className="collection-card"
                  href={collectionDetailPath(collection.slug)}
                  key={collection.id}
                >
                  <p className="eyebrow">Collection</p>
                  <h2>{collection.title}</h2>
                  {description ? <p>{description}</p> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {leagueCards.length === 0 && additionalCollections.length === 0 ? (
        <section className="empty-state">
          <h2>No collections yet</h2>
          <p>Browse the full catalogue or search for your team.</p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Browse products
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
