import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Product not found</h1>
      <p className="lede">This product is not available in the public catalogue.</p>
      <div className="actions">
        <Link className="button primary" href="/products">
          Browse products
        </Link>
        <Link className="button secondary" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
