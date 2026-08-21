import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listCatalogueProposals, listReviewQueue } from "@sjh/database";
import { AdminCatalogueReview } from "@/components/admin-catalogue-review";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Catalogue intelligence | Admin | Sports Jersey House",
  description: "Catalogue proposals and human review queue.",
  path: "/admin/catalogue",
  noIndex: true
});

export default async function AdminCataloguePage() {
  const [proposals, reviewQueue] = await Promise.all([
    listCatalogueProposals(50),
    listReviewQueue(50)
  ]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Catalogue intelligence</h1>
        <p>Signals and proposals for human review. Approve/reject only — never auto-publish.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
      </p>

      <AdminCatalogueReview proposals={proposals} reviewQueue={reviewQueue} />
    </main>
  );
}
