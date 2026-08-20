import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lede">The page you requested is not in our catalogue yet.</p>
      <div className="actions">
        <Link className="button primary" href="/">
          Back to home
        </Link>
        <Link className="button secondary" href="/products">
          Browse products
        </Link>
      </div>
    </main>
  );
}
