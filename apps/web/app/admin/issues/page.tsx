import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listIssueCases } from "@sjh/database";
import { AdminIssueCreateForm } from "@/components/admin-issue-create-form";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Issue cases | Admin | Sports Jersey House",
  description: "Operational issue and replacement cases.",
  path: "/admin/issues",
  noIndex: true
});

export default async function AdminIssuesPage() {
  const issues = await listIssueCases(100);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Issue cases</h1>
        <p>Replace returns with tracked operational cases, decisions, and replacement links.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminIssueCreateForm />

      {issues.length === 0 ? (
        <section className="empty-state">
          <h2>No cases yet</h2>
          <p>Open a case against an existing order number above.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Order</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Replacement</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <Link href={`/admin/issues/${encodeURIComponent(issue.caseNumber)}` as Route}>
                      {issue.caseNumber}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/orders/${encodeURIComponent(issue.orderNumber)}` as Route}>
                      {issue.orderNumber}
                    </Link>
                  </td>
                  <td>{issue.reason.replaceAll("_", " ")}</td>
                  <td>{issue.status.replaceAll("_", " ")}</td>
                  <td>{issue.replacementOrderNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
