import { AdminLogoutButton } from "@/components/admin-logout-button";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { queueNames } from "@sjh/shared";
import { ADMIN_SESSION_COOKIE, isAdminAuthRequired, verifyAdminSessionToken } from "@/lib/auth";
import { getCatalogueStats } from "@/lib/catalogue";
import { featureFlags } from "@/lib/env";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Admin Foundation | Sports Jersey House",
  description: "Admin foundation for catalogue migration, SEO approvals, compliance review, search indexing, and creative production.",
  path: "/admin",
  noIndex: true
});

export default async function AdminPage() {
  const stats = await getCatalogueStats();
  const authRequired = isAdminAuthRequired();
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Operating system foundation</h1>
        <p>Catalogue operations, AI approvals, and migration controls will live here.</p>
      </div>

      {!authRequired ? (
        <p className="admin-notice">
          Admin auth is open in local development. Set <code>ADMIN_PASSWORD</code> and <code>AUTH_SECRET</code> before production.
        </p>
      ) : null}

      {session ? <AdminLogoutButton /> : null}

      <section className="admin-grid" aria-label="System status">
        <article className="status-panel">
          <h2>Commerce</h2>
          <ul>
            <li>
              <Link href={"/admin/orders" as Route}>Orders</Link>
            </li>
            <li>
              <Link href={"/admin/suppliers" as Route}>Suppliers</Link>
            </li>
            <li>
              <Link href={"/admin/purchase-orders" as Route}>Purchase orders</Link>
            </li>
          </ul>
        </article>

        <article className="status-panel">
          <h2>Safety gates</h2>
          <dl>
            <div>
              <dt>Shopify sync</dt>
              <dd>{featureFlags.enableShopifySync ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt>AI shopping assistant</dt>
              <dd>{featureFlags.enableAiShoppingAssistant ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Local catalogue</h2>
          <dl>
            <div>
              <dt>Published products</dt>
              <dd>{stats.productCount}</dd>
            </div>
            <div>
              <dt>Published collections</dt>
              <dd>{stats.collectionCount}</dd>
            </div>
            <div>
              <dt>Leagues indexed</dt>
              <dd>{stats.leagues.length > 0 ? stats.leagues.join(", ") : "None"}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Queues</h2>
          <ul>
            {queueNames.map((queue) => (
              <li key={queue}>{queue}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
