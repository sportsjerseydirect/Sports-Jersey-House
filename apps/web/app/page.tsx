import Link from "next/link";
import { createInitialBrandBrief } from "@sjh/ai";

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

export default function HomePage() {
  const brandBrief = createInitialBrandBrief();

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Sports Jersey House</p>
          <h1>Premium jersey shopping, rebuilt around real catalogue intelligence.</h1>
          <p className="lede">
            A new AI-native commerce platform for product discovery, SEO, search, merchandising, support, and compliant creative workflows.
          </p>
          <div className="actions">
            <Link className="button primary" href="/products">
              Explore products
            </Link>
            <Link className="button secondary" href="/admin">
              View admin foundation
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
