import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listSuppliers } from "@sjh/database";
import { AdminSupplierActions } from "@/components/admin-supplier-actions";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Suppliers | Admin | Sports Jersey House",
  description: "Supplier records for Sports Jersey House operations.",
  path: "/admin/suppliers",
  noIndex: true
});

export default async function AdminSuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Suppliers</h1>
        <p>Supplier records and product mappings for purchase-order batching.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminSupplierActions suppliers={suppliers} />

      {suppliers.length === 0 ? (
        <section className="empty-state">
          <h2>No suppliers yet</h2>
          <p>Bootstrap the DEFAULT supplier or create one above.</p>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Slip format</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.code}</td>
                  <td>{supplier.name}</td>
                  <td>{supplier.email ?? "—"}</td>
                  <td>{supplier.packingSlipFormat}</td>
                  <td>{supplier.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
