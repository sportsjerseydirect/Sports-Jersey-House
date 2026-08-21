import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductGallery } from "@/components/product-gallery";
import { ProductGrid } from "@/components/product-grid";
import { PdpPurchasePanel } from "@/components/pdp-purchase-panel";
import { getSearchProvider } from "@/lib/search";
import { breadcrumbJsonLd, createMetadata, productJsonLd } from "@/lib/seo";
import { createDatabaseClient } from "@sjh/database";
import { getRelatedProducts } from "@sjh/search";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

/** Force request-time resolution so missing/draft products return a real HTTP 404. */
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: ProductPageProps) {
  await connection();
  const { slug } = await params;
  const search = getSearchProvider();
  const product = await search.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return createMetadata({
    title: `${product.title} | Sports Jersey House`,
    description: product.description ?? `Shop ${product.title} at Sports Jersey House.`,
    path: `/products/${product.slug}`
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  await connection();
  const { slug } = await params;
  const search = getSearchProvider();
  const product = await search.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Products", path: "/products" },
    { name: product.title, path: `/products/${product.slug}` }
  ]);
  const structuredData = productJsonLd(product);

  let related: Awaited<ReturnType<typeof getRelatedProducts>> = [];
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    try {
      const db = createDatabaseClient(databaseUrl);
      related = await getRelatedProducts(
        db,
        {
          id: product.id,
          team: product.team ?? null,
          league: product.league ?? null,
          sport: product.sport ?? null
        },
        4
      );
    } catch {
      related = [];
    }
  }

  const metaBits = [product.league, product.team, product.playerName].filter(Boolean);

  return (
    <main className="page-shell">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <span>{product.title}</span>
      </nav>

      <article className="product-detail">
        <ProductGallery images={product.images} title={product.title} />

        <div className="product-detail-copy">
          {metaBits.length > 0 ? <p className="eyebrow">{metaBits.join(" · ")}</p> : null}
          <h1>{product.title}</h1>
          {product.description ? <p className="product-detail-description">{product.description}</p> : null}

          <PdpPurchasePanel
            customisationEnabled={product.customisationEnabled}
            {...(product.customisationProfile ? { customisationProfile: product.customisationProfile } : {})}
            productTitle={product.title}
            {...(product.sizeChart ? { sizeChart: product.sizeChart } : {})}
            variants={product.variants}
          />
        </div>
      </article>

      <section className="pdp-info-sections" aria-label="Product information">
        {product.shippingExpectations ? (
          <details className="pdp-info-block" open>
            <summary>Shipping & fulfilment</summary>
            <p>{product.shippingExpectations}</p>
          </details>
        ) : null}
        {product.careInstructions ? (
          <details className="pdp-info-block">
            <summary>Care instructions</summary>
            <p>{product.careInstructions}</p>
          </details>
        ) : null}
        {product.faqs.length > 0 ? (
          <details className="pdp-info-block">
            <summary>FAQs</summary>
            <dl className="pdp-faq-list">
              {product.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt>{faq.question}</dt>
                  <dd>{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </section>

      {related.length > 0 ? (
        <section className="related-products" aria-label="Related products">
          <div className="page-heading compact">
            <p className="eyebrow">You may also like</p>
            <h2>Related jerseys</h2>
          </div>
          <ProductGrid ariaLabel="Related jerseys" products={related} />
        </section>
      ) : null}
    </main>
  );
}
