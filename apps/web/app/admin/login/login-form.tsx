"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Invalid password.");
      return;
    }

    const nextPath = (searchParams.get("next") ?? "/admin") as Route;
    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        <p>Enter the admin password configured in your environment.</p>
      </div>

      <form className="admin-login-form" onSubmit={handleSubmit}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
