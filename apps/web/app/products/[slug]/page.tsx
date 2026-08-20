import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { safeStaticSlugs } from "@/lib/isr";
import { formatProductPrice } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { breadcrumbJsonLd, createMetadata, productJsonLd } from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const search = getSearchProvider();
  return safeStaticSlugs((limit) => search.listPublishedProductSlugs(limit));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const search = getSearchProvider();
  const product = await search.getProductBySlug(slug);

  if (!product) {
    return createMetadata({
      title: "Product not found | Sports Jersey House",
      description: "The requested product could not be found in the local catalogue.",
      path: `/products/${slug}`
    });
  }

  return createMetadata({
    title: `${product.title} | Sports Jersey House`,
    description: product.description ?? `Shop ${product.title} at Sports Jersey House.`,
    path: `/products/${product.slug}`
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
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
  const primaryVariant = product.variants.find((variant) => variant.isAvailable) ?? product.variants[0];
  const heroImage = product.images[0];

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
        <div className="product-detail-media">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={heroImage.altText ?? product.title}
              height={800}
              src={heroImage.url}
              width={600}
            />
          ) : (
            <div className="product-card-fallback" aria-hidden="true">
              SJH
            </div>
          )}
        </div>

        <div className="product-detail-copy">
          <p className="eyebrow">{[product.league, product.team].filter(Boolean).join(" · ")}</p>
          <h1>{product.title}</h1>
          {product.description ? <p className="product-detail-description">{product.description}</p> : null}
          {primaryVariant ? (
            <>
              <p className="product-detail-price">
                {formatProductPrice(primaryVariant.price.amount, primaryVariant.price.currencyCode)}
              </p>
              <AddToCartButton disabled={!primaryVariant.isAvailable} variantId={primaryVariant.id} />
            </>
          ) : null}
          {product.variants.length > 0 ? (
            <div className="product-detail-variants">
              <h2>Available sizes</h2>
              <ul>
                {product.variants.map((variant) => (
                  <li key={variant.id}>
                    <span>{variant.title}</span>
                    {variant.sku ? <span className="product-detail-sku">{variant.sku}</span> : null}
                    <span>
                      {formatProductPrice(variant.price.amount, variant.price.currencyCode)}
                      {variant.isAvailable ? "" : " · Out of stock"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </article>
    </main>
  );
}
