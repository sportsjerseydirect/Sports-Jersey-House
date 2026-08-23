"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const nextPath = searchParams.get("next") ?? "/admin";
  const error = searchParams.get("error");

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        <p>Enter the admin password configured in your environment.</p>
      </div>

      <form
        className="admin-login-form"
        action="/api/admin/login"
        method="POST"
        onSubmit={() => setSubmitting(true)}
      >
        <input type="hidden" name="next" value={nextPath} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
