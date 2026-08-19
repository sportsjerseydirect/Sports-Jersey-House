import type { Metadata } from "next";
import { queueNames } from "@sjh/worker";
import { featureFlags } from "@/lib/env";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Admin Foundation | Sports Jersey House",
  description: "Admin foundation for catalogue migration, SEO approvals, compliance review, search indexing, and creative production.",
  path: "/admin"
});

export default function AdminPage() {
  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Operating system foundation</h1>
        <p>Production admin routes will require authentication and role-based access before real catalogue operations are enabled.</p>
      </div>

      <section className="admin-grid" aria-label="System status">
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
