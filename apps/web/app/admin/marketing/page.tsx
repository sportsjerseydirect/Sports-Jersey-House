import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import {
  buildAbandonedCheckoutEmailDraft,
  listAbandonedCheckouts,
  listEmailSubscribers,
  listMarketingLeads
} from "@sjh/database";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Marketing | Admin | Sports Jersey House",
  description: "Leads, subscribers, and abandoned checkouts.",
  path: "/admin/marketing",
  noIndex: true
});

export default async function AdminMarketingPage() {
  const [leads, subscribers, abandoned] = await Promise.all([
    listMarketingLeads(50),
    listEmailSubscribers(50),
    listAbandonedCheckouts(50)
  ]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Marketing</h1>
        <p>Lead capture, subscribers, and abandoned checkouts. Lifecycle emails are draft-only.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <section className="status-panel">
        <h2>Leads</h2>
        {leads.length === 0 ? (
          <p>No leads yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Offer</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.email ?? lead.phone ?? "—"}</td>
                    <td>{lead.source}</td>
                    <td>{lead.offerCode ?? "—"}</td>
                    <td>{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="status-panel">
        <h2>Active subscribers</h2>
        {subscribers.length === 0 ? (
          <p>No subscribers yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Source</th>
                  <th>Segments</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id}>
                    <td>{sub.email}</td>
                    <td>{sub.source}</td>
                    <td>{sub.segments.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="status-panel">
        <h2>Abandoned checkouts</h2>
        {abandoned.length === 0 ? (
          <p>No abandoned checkouts recorded.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Items</th>
                  <th>Subtotal</th>
                  <th>Recovered</th>
                  <th>Email draft</th>
                </tr>
              </thead>
              <tbody>
                {abandoned.map((row) => {
                  const draft = buildAbandonedCheckoutEmailDraft({
                    email: row.email,
                    offerCode: "WELCOME10"
                  });
                  return (
                    <tr key={row.id}>
                      <td>{row.email ?? row.phone ?? "—"}</td>
                      <td>{row.itemCount ?? "—"}</td>
                      <td>{row.subtotalAmount ?? "—"}</td>
                      <td>{row.recoveredAt ? "Yes" : "No"}</td>
                      <td>
                        <details>
                          <summary>Draft</summary>
                          <pre className="email-draft">{`${draft.subject}\n\n${draft.bodyText}`}</pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
