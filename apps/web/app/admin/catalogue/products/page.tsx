import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listCatalogueProductsForAdmin } from "@sjh/database";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Catalogue products | Admin | Sports Jersey House",
  description: "Draft preview and approval/publish workflow for catalogue products.",
  path: "/admin/catalogue/products",
  noIndex: true
});

export default async function AdminCatalogueProductsPage() {
  const [imported, published] = await Promise.all([
    listCatalogueProductsForAdmin({ shopifyOnly: true, limit: 100 }),
    listCatalogueProductsForAdmin({ status: ["published"], limit: 20 })
  ]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Catalogue products</h1>
        <p>
          Draft → Review → Approved → Published. Preview is admin-only. Publishing is explicit —
          never automatic for Shopify imports.
        </p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
        {" · "}
        <Link href={"/admin/catalogue" as Route}>Catalogue intelligence</Link>
      </p>

      <section aria-label="Imported Shopify products">
        <h2>Imported Shopify products ({imported.length})</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Team</th>
              <th>Variants</th>
              <th>Images</th>
              <th>Preview</th>
            </tr>
          </thead>
          <tbody>
            {imported.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.status}</td>
                <td>{product.team ?? "—"}</td>
                <td>{product.variantCount}</td>
                <td>{product.imageCount}</td>
                <td>
                  <Link href={`/admin/preview/products/${product.slug}` as Route}>
                    Open preview
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-label="Currently published" style={{ marginTop: "2rem" }}>
        <h2>Published on storefront ({published.length})</h2>
        <ul>
          {published.map((product) => (
            <li key={product.id}>
              {product.title}{" "}
              {product.isSeed ? "(seed)" : "(imported)"} —{" "}
              <Link href={`/products/${product.slug}` as Route}>Public PDP</Link>
              {" · "}
              <Link href={`/admin/preview/products/${product.slug}` as Route}>Admin preview</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
