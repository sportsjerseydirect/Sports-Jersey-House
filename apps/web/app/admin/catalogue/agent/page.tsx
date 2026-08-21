import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import {
  getAiAgentStatus,
  listPendingAiChanges,
  listRecentAiChanges
} from "@sjh/database";
import { AdminCatalogueAgentPanel } from "@/components/admin-catalogue-agent-panel";
import { createMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createMetadata({
  title: "AI Catalogue Agent | Admin | Sports Jersey House",
  description: "Learning → autonomous catalogue intelligence controls.",
  path: "/admin/catalogue/agent",
  noIndex: true
});

export default async function AdminCatalogueAgentPage() {
  const [status, pending, recent] = await Promise.all([
    getAiAgentStatus(),
    listPendingAiChanges(50),
    listRecentAiChanges(50)
  ]);

  return (
    <main className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>AI Catalogue Agent</h1>
        <p>
          Simple discovery + SEO learning model. Keep original titles. Approve 3 consecutive changes
          in a category to unlock AUTONOMOUS for that category.
        </p>
      </div>

      <p>
        <Link href={"/admin" as Route}>← Admin home</Link>
        {" · "}
        <Link href={"/admin/catalogue" as Route}>Catalogue intelligence</Link>
        {" · "}
        <Link href={"/admin/catalogue/products" as Route}>Catalogue products</Link>
      </p>

      <AdminCatalogueAgentPanel
        initialStatus={status}
        pending={pending}
        recent={recent}
      />
    </main>
  );
}
