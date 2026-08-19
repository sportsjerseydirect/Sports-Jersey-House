import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Returns | Sports Jersey House",
  description: "Returns and exchange policy for Sports Jersey House.",
  path: "/pages/returns"
});

export default function ReturnsPage() {
  return (
    <main className="page-shell policy-page">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>Returns &amp; exchanges</h1>
        <p>Fair, clear return policies will be published before the storefront accepts orders.</p>
      </div>
      <article className="policy-content">
        <h2>Current status</h2>
        <p>Returns processing is not active while the platform remains in development.</p>
        <h2>Planned policy principles</h2>
        <ul>
          <li>Eligible unworn items returnable within a published window</li>
          <li>Clear guidance for sizing exchanges on jerseys and kits</li>
          <li>Transparent exceptions for personalised or final-sale items</li>
        </ul>
      </article>
    </main>
  );
}
