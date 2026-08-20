import Link from "next/link";
import type { ProductSummary } from "@sjh/shared";
import { formatProductPrice, productDetailPath } from "@/lib/products";

type ProductGridProps = {
  products: ProductSummary[];
  ariaLabel: string;
};

export function ProductGrid({ products, ariaLabel }: ProductGridProps) {
  return (
    <section className="product-grid" aria-label={ariaLabel}>
      {products.map((product) => (
        <Link className="product-card" href={productDetailPath(product.slug)} key={product.id}>
          <div className="product-card-media">
            {product.primaryImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={product.title}
                decoding="async"
                height={800}
                loading="lazy"
                src={product.primaryImageUrl}
                width={600}
              />
            ) : (
              <div className="product-card-fallback" aria-hidden="true">
                SJH
              </div>
            )}
          </div>
          <div className="product-card-body">
            <p className="product-card-meta">
              {[product.league, product.team].filter(Boolean).join(" · ")}
            </p>
            <h2>{product.title}</h2>
            {product.price ? (
              <p className="product-card-price">
                {formatProductPrice(product.price.amount, product.price.currencyCode)}
              </p>
            ) : null}
          </div>
        </Link>
      ))}
    </section>
  );
}
