import { getAdminCommandCentreStats } from "@sjh/database";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { AdminCommandAiBox } from "@/components/admin-command-ai-box";
import { AdminCommandCard, AdminCommandSection } from "@/components/admin-command-card";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, isAdminAuthRequired, verifyAdminSessionToken } from "@/lib/auth";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Command Centre | Admin | Sports Jersey House",
  description: "Sports Jersey House operations command centre for orders, fulfilment, catalogue, and marketing.",
  path: "/admin",
  noIndex: true
});

const STATS_TIMEOUT_MS = 15_000;

function formatMoney(value: string | null): string | null {
  if (!value) return null;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "USD" }).format(amount);
}

async function loadCommandCentreStats() {
  try {
    return await Promise.race([
      getAdminCommandCentreStats(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Stats timed out")), STATS_TIMEOUT_MS);
      })
    ]);
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const stats = await loadCommandCentreStats();
  const authRequired = isAdminAuthRequired();
  const session = await verifyAdminSessionToken((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  const revenue = stats ? formatMoney(stats.commerce.paidRevenue) : null;

  return (
    <main className="page-shell admin-command-centre-page">
      <header className="admin-command-header">
        <div className="page-heading">
          <p className="eyebrow">Sports Jersey House</p>
          <h1>Command Centre</h1>
          <p>Run the business — orders, fulfilment, catalogue, marketing, and suppliers in one place.</p>
        </div>
        <div className="admin-command-header__actions">
          {session ? <AdminLogoutButton /> : null}
        </div>
      </header>

      {!authRequired ? (
        <p className="admin-notice">
          Admin auth is open in local development. Set <code>ADMIN_PASSWORD</code> and{" "}
          <code>AUTH_SECRET</code> before production.
        </p>
      ) : null}

      {!stats ? (
        <p className="admin-notice">
          Live counts are temporarily unavailable. Navigation below is still active — open any section
          to work.
        </p>
      ) : null}

      <AdminCommandAiBox />

      {stats ? (
        <>
          <AdminCommandSection
            description="Items that need a decision or follow-up today."
            title="Today / action required"
          >
            <AdminCommandCard
              alert
              count={stats.actionRequired.ordersNeedingAttention}
              description="Pending payment, unfulfilled paid orders, and open order issues."
              href={"/admin/orders" as Route}
              title="Orders requiring attention"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.trackingOverdue}
              description="With suppliers more than 7 days without tracking."
              href={"/admin/tracking/exceptions" as Route}
              title="Tracking overdue"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.deliveryOverdue}
              description="Shipped more than 30 days ago and not marked delivered."
              href={"/admin/tracking/exceptions" as Route}
              title="Delivery overdue"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.supplierIssues}
              description="POs awaiting acknowledgement and open tracking exceptions."
              href={"/admin/purchase-orders" as Route}
              title="Supplier issues"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.customerIssues}
              description="Open or in-progress customer issue cases."
              href={"/admin/issues" as Route}
              title="Customer issues"
            />
            <AdminCommandCard
              count={stats.actionRequired.replacementCases}
              description="Cases linked to a replacement order or goodwill replacement."
              href={"/admin/issues" as Route}
              title="Replacement cases"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.chargebackRisk}
              description="Medium/high dispute-risk scores from the advisory risk engine."
              href={"/admin/issues" as Route}
              title="Chargeback-risk cases"
            />
            <AdminCommandCard
              alert
              count={stats.actionRequired.lowMarginOrders}
              countLabel="Low margin orders"
              description="Paid lines with supplier cost logged and margin below 20%."
              href={"/admin/margins" as Route}
              title="Low-margin orders"
            />
          </AdminCommandSection>

          <AdminCommandSection description="Sales, customers, and profitability." title="Commerce">
            <AdminCommandCard
              count={stats.commerce.totalOrders}
              href={"/admin/orders" as Route}
              title="Orders"
            />
            <AdminCommandCard
              count={stats.commerce.distinctCustomers}
              description="Unique customer emails on file."
              href={"/admin/orders" as Route}
              title="Customers"
            />
            <AdminCommandCard
              count={stats.commerce.abandonedCheckouts}
              href={"/admin/marketing" as Route}
              title="Abandoned checkouts"
            />
            <AdminCommandCard
              description="Paid order revenue from fulfilled and in-progress paid orders."
              href={"/admin/orders" as Route}
              metric={revenue}
              title="Revenue"
              unavailable={!revenue}
            />
            <AdminCommandCard
              count={stats.commerce.ordersWithMarginData}
              description="Orders with supplier cost captured for margin reporting."
              href={"/admin/margins" as Route}
              title="Margins"
            />
          </AdminCommandSection>

          <AdminCommandSection description="Supplier POs, tracking, and delivery." title="Fulfilment">
            <AdminCommandCard
              count={stats.fulfilment.purchaseOrders}
              href={"/admin/purchase-orders" as Route}
              title="Purchase orders"
            />
            <AdminCommandCard
              count={stats.fulfilment.activeSuppliers}
              href={"/admin/suppliers" as Route}
              title="Suppliers"
            />
            <AdminCommandCard
              count={stats.actionRequired.trackingOverdue + stats.actionRequired.deliveryOverdue}
              description="Late tracking and delivery based on SLA rules."
              href={"/admin/purchase-orders" as Route}
              title="Supplier performance"
            />
            <AdminCommandCard
              href={"/admin/tracking" as Route}
              title="Tracking ingest"
            />
            <AdminCommandCard
              count={stats.fulfilment.openTrackingExceptions}
              href={"/admin/tracking/exceptions" as Route}
              title="Tracking exceptions"
            />
            <AdminCommandCard
              count={stats.actionRequired.deliveryOverdue}
              href={"/admin/tracking/exceptions" as Route}
              title="Delivery exceptions"
            />
          </AdminCommandSection>

          <AdminCommandSection description="Products, migration, and catalogue quality." title="Catalogue">
            <AdminCommandCard
              count={stats.catalogue.totalProducts}
              href={"/admin/catalogue/products" as Route}
              title="Products"
            />
            <AdminCommandCard
              description="Collection management lives with catalogue intelligence for now."
              href={"/admin/catalogue" as Route}
              title="Collections"
            />
            <AdminCommandCard
              count={stats.catalogue.needsReview + stats.catalogue.blocked}
              href={"/admin/catalogue" as Route}
              title="Catalogue intelligence"
            />
            <AdminCommandCard
              count={stats.ai.pendingHumanDecisions}
              href={"/admin/catalogue/agent" as Route}
              title="AI catalogue agent"
            />
            <AdminCommandCard
              href={"/admin/migration" as Route}
              title="Migration / Shopify"
            />
            <AdminCommandCard
              count={stats.catalogue.createNewListingProposals}
              description="Human review only — nothing is auto-created."
              href={"/admin/catalogue" as Route}
              title="New listing proposals"
            />
            <AdminCommandCard
              count={stats.catalogue.seoIssues}
              description="Products flagged with SEO metadata gaps."
              href={"/admin/catalogue/products" as Route}
              title="SEO"
            />
          </AdminCommandSection>

          <AdminCommandSection description="Post-purchase customer care." title="Customer experience">
            <AdminCommandCard
              description="Conversation history is not available yet."
              href={"/admin/ai-ops" as Route}
              title="Customer AI conversations"
              unavailable
            />
            <AdminCommandCard
              count={stats.actionRequired.customerIssues}
              href={"/admin/issues" as Route}
              title="Customer issues"
            />
            <AdminCommandCard
              count={stats.actionRequired.replacementCases}
              href={"/admin/issues" as Route}
              title="Replacements"
            />
            <AdminCommandCard
              count={stats.actionRequired.chargebackRisk}
              description="Advisory dispute-risk scores — never auto-refuses customers."
              href={"/admin/issues" as Route}
              title="Chargeback-risk cases"
            />
            <AdminCommandCard
              description="Returns and exchange policy cases are tracked as issue cases."
              href={"/admin/issues" as Route}
              title="Returns / exchange cases"
            />
          </AdminCommandSection>

          <AdminCommandSection description="Acquisition, offers, and retention." title="Marketing">
            <AdminCommandCard count={stats.marketing.leads} href={"/admin/marketing" as Route} title="Leads" />
            <AdminCommandCard
              count={stats.marketing.welcome10Leads}
              href={"/admin/marketing" as Route}
              title="WELCOME10"
            />
            <AdminCommandCard
              count={stats.marketing.abandonedCheckouts}
              href={"/admin/marketing" as Route}
              title="Abandoned checkout"
            />
            <AdminCommandCard
              description="Offer management is grouped under Marketing for now."
              href={"/admin/marketing" as Route}
              title="Offers"
            />
            <AdminCommandCard
              description="Campaign orchestration is not available yet."
              href={"/admin/marketing" as Route}
              title="Campaigns"
              unavailable
            />
            <AdminCommandCard
              count={stats.catalogue.seoIssues}
              description={
                process.env.GSC_CLIENT_EMAIL
                  ? "SEO metadata gaps. GSC credentials detected — sync not enabled yet."
                  : "GSC not connected. Showing catalogue SEO metadata gaps only."
              }
              href={"/admin/catalogue/products" as Route}
              title="SEO / GSC"
            />
            <AdminCommandCard href={"/admin/users" as Route} title="Users & access" />
          </AdminCommandSection>

          <AdminCommandSection description="Supplier accounts, costs, and SLAs." title="Suppliers">
            <AdminCommandCard
              count={stats.fulfilment.activeSuppliers}
              href={"/admin/suppliers" as Route}
              title="Supplier management"
            />
            <AdminCommandCard
              count={stats.fulfilment.purchaseOrders}
              href={"/admin/purchase-orders" as Route}
              title="Purchase orders"
            />
            <AdminCommandCard
              count={stats.commerce.ordersWithMarginData}
              href={"/admin/margins" as Route}
              title="Supplier costs"
            />
            <AdminCommandCard href={"/admin/tracking" as Route} title="Supplier tracking" />
            <AdminCommandCard
              count={stats.actionRequired.trackingOverdue}
              href={"/admin/tracking/exceptions" as Route}
              title="Supplier SLA / performance"
            />
            <AdminCommandCard href={"/supplier/login" as Route} title="Supplier portal login" />
          </AdminCommandSection>

          <AdminCommandSection
            description="Operational automation status — no internal queue names on this screen."
            title="Background automation"
          >
            <AdminCommandCard
              count={stats.backgroundAutomation.running}
              description="Imports and scheduled ops jobs currently in progress."
              href={"/admin/jobs" as Route}
              title="Running"
            />
            <AdminCommandCard
              count={stats.backgroundAutomation.completedToday}
              description="Successful runs finished today."
              href={"/admin/jobs" as Route}
              title="Completed today"
            />
            <AdminCommandCard
              alert
              count={stats.backgroundAutomation.failed}
              description="Failed or cancelled runs today."
              href={"/admin/jobs" as Route}
              title="Failed"
            />
            <AdminCommandCard
              alert
              count={stats.backgroundAutomation.needsAttention}
              description="Long-running or failed jobs that may need review."
              href={"/admin/jobs" as Route}
              title="Needs attention"
            />
          </AdminCommandSection>

          <AdminCommandSection description="AI audits and catalogue decisions." title="AI oversight">
            <AdminCommandCard
              count={stats.ai.pendingHumanDecisions}
              href={"/admin/catalogue/agent" as Route}
              title="Pending human decisions"
            />
            <AdminCommandCard
              count={stats.ai.recentAudits}
              description="AI ops actions logged in the last 7 days."
              href={"/admin/ai-ops" as Route}
              title="AI action audit log"
            />
            <AdminCommandCard href={"/admin/notifications" as Route} title="Notification drafts" />
            <AdminCommandCard href={"/admin/courier-rules" as Route} title="Courier rules" />
          </AdminCommandSection>
        </>
      ) : (
        <AdminCommandSection description="Navigation remains available while counts load." title="Quick links">
          <AdminCommandCard href={"/admin/orders" as Route} title="Orders" />
          <AdminCommandCard href={"/admin/purchase-orders" as Route} title="Purchase orders" />
          <AdminCommandCard href={"/admin/suppliers" as Route} title="Suppliers" />
          <AdminCommandCard href={"/admin/margins" as Route} title="Margins" />
          <AdminCommandCard href={"/admin/issues" as Route} title="Issue cases" />
          <AdminCommandCard href={"/admin/catalogue/products" as Route} title="Catalogue products" />
          <AdminCommandCard href={"/admin/catalogue" as Route} title="Catalogue intelligence" />
          <AdminCommandCard href={"/admin/migration" as Route} title="Migration / Shopify" />
          <AdminCommandCard href={"/admin/marketing" as Route} title="Marketing" />
          <AdminCommandCard href={"/admin/ai-ops" as Route} title="AI ops" />
          <AdminCommandCard href={"/admin/jobs" as Route} title="Background jobs (technical detail)" />
        </AdminCommandSection>
      )}

      <p className="admin-command-footer">
        Need technical migration details?{" "}
        <Link href={"/admin/migration" as Route}>Open migration console</Link>
      </p>
    </main>
  );
}
