import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listCourierRules } from "@sjh/database";
import { AdminCourierRuleForm } from "@/components/admin-courier-rule-form";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Courier rules | Admin | Sports Jersey House",
  description: "Configurable courier matching rules.",
  path: "/admin/courier-rules",
  noIndex: true
});

export default async function AdminCourierRulesPage() {
  const rules = await listCourierRules();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Courier rules</h1>
        <p>Match tracking numbers to couriers by prefix, contains, or regex. Priority: lower first.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
        {" · "}
        <Link href={"/admin/tracking" as Route}>Tracking ingest</Link>
      </p>

      <AdminCourierRuleForm />

      {rules.length === 0 ? (
        <section className="empty-state">
          <h2>No rules yet</h2>
          <p>Add rules that match your suppliers’ courier tracking formats.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Name</th>
                <th>Type</th>
                <th>Pattern</th>
                <th>Courier</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.priority}</td>
                  <td>{rule.name}</td>
                  <td>{rule.patternType}</td>
                  <td>
                    <code>{rule.pattern}</code>
                  </td>
                  <td>
                    {rule.courierCode} — {rule.courierName}
                  </td>
                  <td>{rule.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
