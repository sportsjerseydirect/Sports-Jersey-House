import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listOpsJobRuns } from "@sjh/database";
import { AdminJobsRunner } from "@/components/admin-jobs-runner";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Ops jobs | Admin | Sports Jersey House",
  description: "Ops job runs and dry-run controls.",
  path: "/admin/jobs",
  noIndex: true
});

export default async function AdminJobsPage() {
  const runs = await listOpsJobRuns(40);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Ops jobs</h1>
        <p>Scheduled-style ops jobs with dry-run default. External send remains disabled.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminJobsRunner />

      {runs.length === 0 ? (
        <section className="empty-state">
          <h2>No job runs yet</h2>
          <p>Trigger a dry-run above to create the first run record.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Job</th>
                <th>Status</th>
                <th>Dry run</th>
                <th>External send</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.createdAt).toLocaleString()}</td>
                  <td>{run.jobType}</td>
                  <td>{run.status}</td>
                  <td>{run.dryRun ? "Yes" : "No"}</td>
                  <td>{run.allowExternalSend ? "Yes" : "No"}</td>
                  <td>{run.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
