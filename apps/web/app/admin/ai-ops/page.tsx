import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listAiActionAudits } from "@sjh/database";
import { AdminAiOpsConsole } from "@/components/admin-ai-ops-console";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "AI ops | Admin | Sports Jersey House",
  description: "AI operations assistant with preview and confirmation.",
  path: "/admin/ai-ops",
  noIndex: true
});

export default async function AdminAiOpsPage() {
  const audits = await listAiActionAudits(30);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>AI operations</h1>
        <p>Tool contracts for PO, tracking, ageing, margins, supplier chase drafts, and issues — always audited.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminAiOpsConsole />

      <section className="status-panel" aria-label="Recent AI action audits">
        <h2>Recent audits</h2>
        {audits.length === 0 ? (
          <p>No audits yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Confirm?</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id}>
                    <td>{new Date(audit.createdAt).toLocaleString()}</td>
                    <td>{audit.actionType}</td>
                    <td>{audit.status.replaceAll("_", " ")}</td>
                    <td>{audit.requiresConfirmation ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
