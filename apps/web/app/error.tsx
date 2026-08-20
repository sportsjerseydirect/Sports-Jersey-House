"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page-shell">
      <section className="empty-state">
        <p className="eyebrow">Something went wrong</p>
        <h1>We hit a snag</h1>
        <p className="lede">Please try again. If the problem continues, come back shortly.</p>
        <div className="actions">
          <button type="button" className="button primary" onClick={reset}>
            Try again
          </button>
          <Link className="button secondary" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
