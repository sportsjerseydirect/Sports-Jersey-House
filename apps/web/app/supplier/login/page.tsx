import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supplier login | Sports Jersey House",
  robots: { index: false, follow: false }
};

export default async function SupplierLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page-shell narrow">
      <div className="page-heading">
        <p className="eyebrow">Supplier portal</p>
        <h1>Sign in</h1>
        <p>Access orders assigned to your supplier account only.</p>
      </div>
      <form action="/api/supplier/login" className="admin-form" method="post">
        <input name="next" type="hidden" value={params.next ?? "/supplier"} />
        <label className="field">
          <span>Email</span>
          <input autoComplete="username" name="email" required type="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        {params.error ? (
          <p className="admin-notice" role="alert">
            {params.error}
          </p>
        ) : null}
        <button className="button primary" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
