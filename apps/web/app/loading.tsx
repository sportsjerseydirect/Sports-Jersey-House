export default function RootLoading() {
  return (
    <main className="page-shell loading-shell" aria-busy="true" aria-live="polite">
      <div className="loading-block">
        <p className="eyebrow">Loading</p>
        <div className="loading-bar" aria-hidden="true" />
        <p className="loading-copy">Preparing your page…</p>
      </div>
    </main>
  );
}
