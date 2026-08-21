import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { getShopifyConnectionHealth, listImportRuns } from "@sjh/database";
import { AdminMigrationImport } from "@/components/admin-migration-import";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Migration | Admin | Sports Jersey House",
  description: "Shopify connection health and dry-run import staging.",
  path: "/admin/migration",
  noIndex: true
});

export default async function AdminMigrationPage() {
  const health = getShopifyConnectionHealth();
  const runs = await listImportRuns(30);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Migration / Shopify</h1>
        <p>Connection health and dry-run/sample staging. Live Shopify sync remains gated.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminMigrationImport health={health} />

      <h2>Recent import runs</h2>
      {runs.length === 0 ? (
        <section className="empty-state">
          <h2>No import runs</h2>
          <p>Create a dry-run or stage a sample product above.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Dry run</th>
                <th>Sync gate</th>
                <th>Staged</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.createdAt).toLocaleString()}</td>
                  <td>{run.mode}</td>
                  <td>{run.status}</td>
                  <td>{run.dryRun ? "Yes" : "No"}</td>
                  <td>{run.syncGateEnabled ? "On" : "Off"}</td>
                  <td>{run.productsStaged}</td>
                  <td>{run.errorsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
