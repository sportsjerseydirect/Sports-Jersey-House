export default function CollectionsLoading() {
  return (
    <main className="page-shell loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-block">
        <p className="eyebrow">Collections</p>
        <div className="loading-bar" aria-hidden="true" />
        <p className="loading-copy">Loading leagues…</p>
      </div>
    </main>
  );
}
