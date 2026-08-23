import { getAdminOpsStats, getCatalogueHealthStats, getPublishReadinessStats } from "@sjh/database";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { queueNames } from "@sjh/shared";
import { ADMIN_SESSION_COOKIE, isAdminAuthRequired, verifyAdminSessionToken } from "@/lib/auth";
import { featureFlags } from "@/lib/env";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Admin Foundation | Sports Jersey House",
  description:
    "Admin foundation for catalogue migration, SEO approvals, compliance review, search indexing, and creative production.",
  path: "/admin",
  noIndex: true
});

export default async function AdminPage() {
  const [health, ops, readiness] = await Promise.all([
    getCatalogueHealthStats(),
    getAdminOpsStats(),
    getPublishReadinessStats()
  ]);
  const authRequired = isAdminAuthRequired();
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Operating system foundation</h1>
        <p>Catalogue health, AI agent status, and migration controls.</p>
      </div>

      {!authRequired ? (
        <p className="admin-notice">
          Admin auth is open in local development. Set <code>ADMIN_PASSWORD</code> and{" "}
          <code>AUTH_SECRET</code> before production.
        </p>
      ) : null}

      {session ? <AdminLogoutButton /> : null}

      <section className="admin-grid" aria-label="Catalogue health">
        <article className="status-panel">
          <h2>Catalogue overview</h2>
          <dl>
            <div>
              <dt>Total products</dt>
              <dd>{health.products.total}</dd>
            </div>
            <div>
              <dt>Published</dt>
              <dd>{health.products.published}</dd>
            </div>
            <div>
              <dt>Draft</dt>
              <dd>{health.products.draft}</dd>
            </div>
            <div>
              <dt>Review</dt>
              <dd>{health.products.review}</dd>
            </div>
            <div>
              <dt>Shopify imported</dt>
              <dd>{health.products.shopifyImported}</dd>
            </div>
            <div>
              <dt>AI agent mode</dt>
              <dd>{health.agentMode}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Publish readiness (Shopify)</h2>
          <dl>
            <div>
              <dt>Ready</dt>
              <dd>{readiness.ready}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>{readiness.needsReview}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd>{readiness.blocked}</dd>
            </div>
            <div>
              <dt>Draft ready to publish</dt>
              <dd>{readiness.draftReady}</dd>
            </div>
            <div>
              <dt>Missing size chart</dt>
              <dd>{readiness.missingSizeChart}</dd>
            </div>
            <div>
              <dt>Missing customisation</dt>
              <dd>{readiness.missingCustomisation}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Taxonomy coverage (Shopify)</h2>
          <dl>
            <div>
              <dt>Sport</dt>
              <dd>
                {health.taxonomy.withSport}/{health.taxonomy.shopifyTotal}
              </dd>
            </div>
            <div>
              <dt>League</dt>
              <dd>
                {health.taxonomy.withLeague}/{health.taxonomy.shopifyTotal}
              </dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>
                {health.taxonomy.withTeam}/{health.taxonomy.shopifyTotal}
              </dd>
            </div>
            <div>
              <dt>Player</dt>
              <dd>
                {health.taxonomy.withPlayer}/{health.taxonomy.shopifyTotal}
              </dd>
            </div>
            <div>
              <dt>Missing sport</dt>
              <dd>{health.taxonomy.missingSport}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Content &amp; SEO</h2>
          <dl>
            <div>
              <dt>SEO meta (Shopify)</dt>
              <dd>{health.content.withSeoMeta}</dd>
            </div>
            <div>
              <dt>SEO issues</dt>
              <dd>{health.content.seoIssues}</dd>
            </div>
            <div>
              <dt>Missing descriptions</dt>
              <dd>{health.content.missingDescription}</dd>
            </div>
            <div>
              <dt>Missing images</dt>
              <dd>{health.content.missingImages}</dd>
            </div>
            <div>
              <dt>Collection memberships</dt>
              <dd>{health.collections.memberships}</dd>
            </div>
          </dl>
        </article>

        <article className="status-panel">
          <h2>Signals &amp; proposals</h2>
          <dl>
            <div>
              <dt>Healthy</dt>
              <dd>{health.signals.healthy}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>{health.signals.needsReview}</dd>
            </div>
            <div>
              <dt>At risk</dt>
              <dd>{health.signals.atRisk}</dd>
            </div>
            <div>
              <dt>Duplicate suspects</dt>
              <dd>{health.signals.duplicateSuspects}</dd>
            </div>
            <div>
              <dt>Pending human decisions</dt>
              <dd>{health.pendingHumanDecisions}</dd>
            </div>
          </dl>
          {health.proposals.length > 0 ? (
            <ul>
              {health.proposals.map((p) => (
                <li key={p.recommendation}>
                  {p.recommendation}: {p.count}
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>

      <section className="admin-grid" aria-label="Operations">
        <article className="status-panel">
          <h2>Orders</h2>
          <dl>
            <div>
              <dt>Total orders</dt>
              <dd>{ops.orders.total}</dd>
            </div>
            <div>
              <dt>Pending payment</dt>
              <dd>{ops.orders.pendingPayment}</dd>
            </div>
            <div>
              <dt>Paid / unfulfilled</dt>
              <dd>{ops.orders.paidUnfulfilled}</dd>
            </div>
            <div>
              <dt>With suppliers</dt>
              <dd>{ops.orders.submittedToSupplier}</dd>
            </div>
          </dl>
        </article>
        <article className="status-panel">
          <h2>Supplier POs &amp; SLA</h2>
          <dl>
            <div>
              <dt>Purchase orders</dt>
              <dd>{ops.purchaseOrders.total}</dd>
            </div>
            <div>
              <dt>Awaiting acknowledgement</dt>
              <dd>{ops.purchaseOrders.awaitingAcknowledgement}</dd>
            </div>
            <div>
              <dt>Tracking overdue ({ops.sla.trackingOverdueDays}d)</dt>
              <dd>{ops.purchaseOrders.trackingOverdue}</dd>
            </div>
            <div>
              <dt>Delivery overdue ({ops.sla.deliveryOverdueDays}d)</dt>
              <dd>{ops.purchaseOrders.deliveryOverdue}</dd>
            </div>
            <div>
              <dt>Open tracking exceptions</dt>
              <dd>{ops.exceptions.openTrackingExceptions}</dd>
            </div>
          </dl>
        </article>
        <article className="status-panel">
          <h2>Supplier portal</h2>
          <ul>
            <li>
              <Link href={"/supplier/login" as Route}>Supplier login</Link>
            </li>
          </ul>
          <p className="admin-notice">Suppliers see assigned POs only — no selling prices or margins.</p>
        </article>
      </section>

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
            <li>
              <Link href={"/admin/courier-rules" as Route}>Courier rules</Link>
            </li>
            <li>
              <Link href={"/admin/tracking" as Route}>Tracking ingest</Link>
            </li>
            <li>
              <Link href={"/admin/tracking/exceptions" as Route}>Tracking exceptions</Link>
            </li>
            <li>
              <Link href={"/admin/margins" as Route}>Margins</Link>
            </li>
            <li>
              <Link href={"/admin/issues" as Route}>Issue cases</Link>
            </li>
            <li>
              <Link href={"/admin/ai-ops" as Route}>AI ops</Link>
            </li>
            <li>
              <Link href={"/admin/jobs" as Route}>Ops jobs</Link>
            </li>
            <li>
              <Link href={"/admin/catalogue" as Route}>Catalogue intelligence</Link>
            </li>
            <li>
              <Link href={"/admin/catalogue/products" as Route}>Catalogue products / publish</Link>
            </li>
            <li>
              <Link href={"/admin/catalogue/agent" as Route}>AI Catalogue Agent</Link>
            </li>
            <li>
              <Link href={"/admin/migration" as Route}>Migration / Shopify</Link>
            </li>
            <li>
              <Link href={"/admin/marketing" as Route}>Marketing</Link>
            </li>
            <li>
              <Link href={"/admin/notifications" as Route}>Notifications (drafts)</Link>
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
