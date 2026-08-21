import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { AdminTrackingIngestForm } from "@/components/admin-tracking-ingest-form";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Tracking ingest | Admin | Sports Jersey House",
  description: "Paste tracking numbers onto order lines.",
  path: "/admin/tracking",
  noIndex: true
});

export default function AdminTrackingPage() {
  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Tracking ingest</h1>
        <p>Paste supplier tracking updates. Unmatched lines become exceptions. No customer emails are sent yet.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
        {" · "}
        <Link href={"/admin/courier-rules" as Route}>Courier rules</Link>
      </p>

      <AdminTrackingIngestForm />
    </main>
  );
}
