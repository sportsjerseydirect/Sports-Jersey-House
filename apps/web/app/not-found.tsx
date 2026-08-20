import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";
import { permanentRedirect, redirect } from "next/navigation";
import { findActiveRedirect } from "@sjh/database";

export default async function NotFoundPage() {
  const pathname = (await headers()).get("x-sjh-pathname");

  if (pathname) {
    try {
      const match = await findActiveRedirect(pathname);

      if (match) {
        const target = match.toPath as Route;

        if (match.statusCode === 301 || match.statusCode === 308) {
          permanentRedirect(target);
        }

        redirect(target);
      }
    } catch (error) {
      console.warn(
        "[not-found] redirect lookup failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

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
