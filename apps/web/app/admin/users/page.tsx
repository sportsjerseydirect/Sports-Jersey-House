import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listAdminUsers, listSuppliers } from "@sjh/database";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Users & access | Admin | Sports Jersey House",
  description: "Manage admin users and review supplier portal accounts.",
  path: "/admin/users",
  noIndex: true
});

export default async function AdminUsersPage() {
  const [admins, suppliers] = await Promise.all([listAdminUsers(), listSuppliers()]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Users &amp; access</h1>
        <p>
          Named admin accounts use hashed passwords. The shared environment password remains a
          bootstrap fallback until you migrate fully. Supplier accounts stay separate.
        </p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Command Centre</Link>
      </p>

      <AdminUsersManager initialUsers={admins} />

      <section className="status-panel" aria-label="Supplier accounts">
        <h2>Supplier portal accounts</h2>
        <p className="admin-notice">
          Supplier logins are managed per supplier (see Suppliers). They never see selling prices or
          margins.
        </p>
        {suppliers.length === 0 ? (
          <p>No suppliers configured.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.code}</td>
                    <td>{supplier.name}</td>
                    <td>{supplier.email ?? "—"}</td>
                    <td>{supplier.isActive ? "Yes" : "No"}</td>
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
