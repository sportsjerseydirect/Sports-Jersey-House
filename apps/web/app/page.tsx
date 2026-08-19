import Link from "next/link";
import { createInitialBrandBrief } from "@sjh/ai";
import { ProductGrid } from "@/components/product-grid";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";

export const dynamic = "force-dynamic";

const pillars = [
  {
    title: "Catalogue intelligence",
    body: "Products, variants, collections, SEO, compliance, media, and AI approvals share one clean data model."
  },
  {
    title: "Premium storefront",
    body: "Fast, restrained, mobile-first shopping pages with server-rendered SEO and structured data from the start."
  },
  {
    title: "Creative pipeline",
    body: "Brand concepts, campaign assets, alt text, provenance, and approval states are treated as product infrastructure."
  }
];

const trustPoints = [
  "Server-rendered pages built for search and speed",
  "Structured product data — never invented by AI",
  "Migration-safe Shopify extraction behind explicit approval gates"
];

export default async function HomePage() {
  const brandBrief = createInitialBrandBrief();
  const search = getSearchProvider();
  const [collections, featured] = await Promise.all([
    search.listPublishedCollections(),
    search.search({ query: "", limit: 4 })
  ]);

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sports Jersey House</p>
          <h1>Premium jersey shopping, rebuilt around real catalogue intelligence.</h1>
          <p className="lede">
            A new commerce platform for product discovery, SEO, search, merchandising, and compliant creative workflows.
          </p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Explore products
            </Link>
            <Link className="button secondary" href="/collections">
              Shop by league
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="jersey-card jersey-card-primary">
            <span className="team-line">SJH</span>
            <strong>HOUSE</strong>
            <span>00</span>
          </div>
          <div className="jersey-card jersey-card-secondary">
            <span className="team-line">SPORTS</span>
            <strong>PREMIUM</strong>
            <span>88</span>
          </div>
        </div>
      </section>

      {collections.length > 0 ? (
        <section className="home-collections" aria-label="Featured collections">
          <div className="section-heading">
            <p className="eyebrow">Collections</p>
            <h2>Shop by league</h2>
          </div>
          <div className="collection-grid">
            {collections.slice(0, 4).map((collection) => (
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
            <p className="eyebrow">Featured</p>
            <h2>Popular in the catalogue</h2>
          </div>
          <ProductGrid ariaLabel="Featured products" products={featured.results.map((result) => result.product)} />
        </section>
      ) : null}

      <section className="trust-strip" aria-label="Platform principles">
        <ul>
          {trustPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <section className="section-grid" aria-label="Platform pillars">
        {pillars.map((pillar) => (
          <article className="pillar" key={pillar.title}>
            <h2>{pillar.title}</h2>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="operating-system">
        <div>
          <p className="eyebrow">First creative brief</p>
          <h2>{brandBrief.objective}</h2>
        </div>
        <ul>
          {brandBrief.constraints.map((constraint) => (
            <li key={constraint}>{constraint}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
