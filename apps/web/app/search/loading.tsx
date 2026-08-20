export default function SearchLoading() {
  return (
    <main className="page-shell loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-block">
        <p className="eyebrow">Search</p>
        <div className="loading-bar" aria-hidden="true" />
        <p className="loading-copy">Searching jerseys…</p>
      </div>
    </main>
  );
}
