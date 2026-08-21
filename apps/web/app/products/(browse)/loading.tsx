export default function ProductsLoading() {
  return (
    <main className="page-shell loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-block">
        <p className="eyebrow">Products</p>
        <div className="loading-bar" aria-hidden="true" />
        <p className="loading-copy">Loading catalogue…</p>
      </div>
    </main>
  );
}
