import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Privacy | Sports Jersey House",
  description: "Privacy policy for Sports Jersey House.",
  path: "/pages/privacy"
});

export default function PrivacyPage() {
  return (
    <main className="page-shell policy-page">
      <div className="page-heading">
        <p className="eyebrow">Policy</p>
        <h1>Privacy</h1>
        <p>How Sports Jersey House handles customer data for browsing, checkout, and order fulfilment.</p>
      </div>
      <article className="policy-content">
        <h2>Data minimisation</h2>
        <p>
          We collect only what is needed to operate the storefront, process orders, and improve the shopping
          experience. AI features will not store customer prompts containing unnecessary personal information.
        </p>
        <h2>Security</h2>
        <ul>
          <li>Secrets and credentials are never exposed to the browser</li>
          <li>Payment processing uses Stripe. We do not collect raw card numbers on this website</li>
          <li>Admin access is authenticated before catalogue write operations in production</li>
        </ul>
        <h2>Contact</h2>
        <p>A dedicated privacy contact will be published before launch at sportsjerseyhouse.com.</p>
      </article>
    </main>
  );
}
