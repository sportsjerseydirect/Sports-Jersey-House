import Link from "next/link";
import { ProductGrid } from "@/components/product-grid";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";

export const revalidate = 300;

const trustPoints = [
  "Authentic-style jerseys from top leagues worldwide",
  "Fast, mobile-first shopping built for search",
  "Secure checkout and order tracking — coming soon"
];

export default async function HomePage() {
  const search = getSearchProvider();
  const [collections, featured] = await Promise.all([
    search.listPublishedCollections(),
    search.search({ query: "", limit: 8 })
  ]);

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sports Jersey House</p>
          <h1>Wear your team.</h1>
          <p className="lede">
            Premium sports jerseys across NFL, NBA, NHL, MLB, and world football — curated for fans who
            expect quality, speed, and a polished mobile experience.
          </p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Shop all jerseys
            </Link>
            <Link className="button secondary" href="/collections">
              Browse by league
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="jersey-card jersey-card-primary">
            <span className="team-line">SJH</span>
            <strong>HOME</strong>
            <span>01</span>
          </div>
          <div className="jersey-card jersey-card-secondary">
            <span className="team-line">AWAY</span>
            <strong>ELITE</strong>
            <span>23</span>
          </div>
        </div>
      </section>

      {collections.length > 0 ? (
        <section className="home-collections" aria-label="Featured collections">
          <div className="section-heading">
            <p className="eyebrow">Leagues</p>
            <h2>Shop by league</h2>
          </div>
          <div className="collection-grid">
            {collections.slice(0, 6).map((collection) => (
              <Link className="collection-card" href={collectionDetailPath(collection.slug)} key={collection.id}>
                <p className="eyebrow">Collection</p>
                <h3>{collection.title}</h3>
                {collection.description ? <p>{collection.description}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featured.results.length > 0 ? (
        <section className="home-featured" aria-label="Featured products">
          <div className="section-heading">
            <p className="eyebrow">Trending</p>
            <h2>Fan favourites</h2>
          </div>
          <ProductGrid ariaLabel="Featured products" products={featured.results.map((result) => result.product)} />
          <div className="section-actions">
            <Link className="button secondary" href="/products">
              View full catalogue
            </Link>
          </div>
        </section>
      ) : null}

      <section className="trust-strip" aria-label="Why Sports Jersey House">
        <ul>
          {trustPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
