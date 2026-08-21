import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { listTrackingExceptions } from "@sjh/database";
import { AdminTrackingExceptionQueue } from "@/components/admin-tracking-exception-queue";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "Tracking exceptions | Admin | Sports Jersey House",
  description: "Open tracking ingest exceptions queue.",
  path: "/admin/tracking/exceptions",
  noIndex: true
});

export default async function AdminTrackingExceptionsPage() {
  const exceptions = await listTrackingExceptions("open");

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Tracking exceptions</h1>
        <p>Resolve or ignore unmatched tracking paste lines. No customer emails are sent.</p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
        {" · "}
        <Link href={"/admin/tracking" as Route}>Tracking ingest</Link>
      </p>

      <AdminTrackingExceptionQueue exceptions={exceptions} />
    </main>
  );
}
