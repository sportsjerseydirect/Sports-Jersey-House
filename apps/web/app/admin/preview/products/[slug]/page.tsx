import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDatabaseClient, evaluateProductReadiness } from "@sjh/database";
import { getProductBySlug } from "@sjh/search";
import { ProductGallery } from "@/components/product-gallery";
import { PdpPurchasePanel } from "@/components/pdp-purchase-panel";
import { AdminProductWorkflowPanel } from "@/components/admin-product-workflow-panel";
import { createMetadata, productJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PreviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  return createMetadata({
    title: `DRAFT / ADMIN PREVIEW | ${slug} | Sports Jersey House`,
    description: "Authenticated admin catalogue preview. Not for public indexing.",
    path: `/admin/preview/products/${slug}`,
    noIndex: true
  });
}

export default async function AdminProductPreviewPage({ params }: PreviewPageProps) {
  const { slug } = await params;
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    notFound();
  }

  const db = createDatabaseClient(databaseUrl);
  const product = await getProductBySlug(db, slug, {
    allowedStatuses: ["draft", "review", "approved", "published", "archived"]
  });

  if (!product) {
    notFound();
  }

  if (product.status === "published") {
    // Still allow admin preview of published items, but banner differs.
  } else if (product.status !== "draft" && product.status !== "review" && product.status !== "approved" && product.status !== "archived") {
    notFound();
  }

  // Preview is for draft/review primarily; approved/archived/published also useful for admins.
  const readiness = await evaluateProductReadiness(product.id, databaseUrl);
  const payloadMeta = [
    product.sport,
    product.league,
    product.team,
    product.playerName
  ].filter(Boolean);
  const structuredPreview = productJsonLd(product);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">DRAFT / ADMIN PREVIEW</p>
        <h1>{product.title}</h1>
        <p>
          Status: <strong>{product.status.toUpperCase()}</strong>. This page is admin-only,{" "}
          <code>noindex</code>, and never uses the public published-only product loader.
        </p>
        <p>
          <Link href={"/admin/catalogue/products" as Route}>← Catalogue products</Link>
          {" · "}
          <Link href={`/products/${product.slug}` as Route}>Public PDP (published only)</Link>
        </p>
      </div>

      <AdminProductWorkflowPanel
        productId={product.id}
        slug={product.slug}
        status={product.status}
        readiness={readiness}
      />

      <article className="product-detail" style={{ marginTop: "2rem" }}>
        <ProductGallery images={product.images} title={product.title} />
        <div className="product-detail-copy">
          {payloadMeta.length > 0 ? <p className="eyebrow">{payloadMeta.join(" · ")}</p> : null}
          <h2>{product.title}</h2>
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

      <section className="pdp-info-sections" aria-label="Preview metadata">
        <h2>SEO / schema preview</h2>
        <p>
          Canonical path: <code>/products/{product.slug}</code>
        </p>
        <p>Readiness: {readiness.overall}</p>
        <pre className="email-draft">{JSON.stringify(structuredPreview, null, 2)}</pre>
        <h3>Variants</h3>
        <ul>
          {product.variants.map((variant) => (
            <li key={variant.id}>
              {variant.title} — {variant.price.amount} {variant.price.currencyCode}
              {variant.compareAtPrice
                ? ` (compare ${variant.compareAtPrice.amount})`
                : ""}
            </li>
          ))}
        </ul>
        <h3>Images</h3>
        <ul>
          {product.images.map((image) => (
            <li key={image.url}>
              <a href={image.url} rel="noreferrer" target="_blank">
                {image.url}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
