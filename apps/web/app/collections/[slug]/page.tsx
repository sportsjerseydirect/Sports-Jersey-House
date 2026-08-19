import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-grid";
import { collectionDetailPath } from "@/lib/products";
import { getSearchProvider } from "@/lib/search";
import { breadcrumbJsonLd, createMetadata } from "@/lib/seo";

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CollectionPageProps) {
  const { slug } = await params;
  const search = getSearchProvider();
  const collection = await search.getCollectionBySlug(slug);

  if (!collection) {
    return createMetadata({
      title: "Collection not found | Sports Jersey House",
      description: "The requested collection could not be found in the local catalogue.",
      path: `/collections/${slug}`
    });
  }

  return createMetadata({
    title: `${collection.title} | Sports Jersey House`,
    description: collection.description ?? `Browse ${collection.title} at Sports Jersey House.`,
    path: `/collections/${collection.slug}`
  });
}

export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const search = getSearchProvider();
  const collection = await search.getCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Collections", path: "/collections" },
    { name: collection.title, path: collectionDetailPath(collection.slug) }
  ]);

  return (
    <main className="page-shell">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
        type="application/ld+json"
      />

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/collections">Collections</Link>
        <span aria-hidden="true">/</span>
        <span>{collection.title}</span>
      </nav>

      <div className="page-heading">
        <p className="eyebrow">Collection</p>
        <h1>{collection.title}</h1>
        {collection.description ? <p>{collection.description}</p> : null}
      </div>

      {collection.products.length > 0 ? (
        <>
          <p className="catalogue-summary">{collection.products.length} products in this collection</p>
          <ProductGrid ariaLabel={`${collection.title} products`} products={collection.products} />
        </>
      ) : (
        <section className="empty-state">
          <h2>No products in this collection</h2>
          <p>Seed development catalogue data to populate league collections locally.</p>
        </section>
      )}
    </main>
  );
}
