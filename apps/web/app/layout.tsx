import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { WelcomeLeadCapture } from "@/components/welcome-lead-capture";
import { createMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  ...createMetadata({
    title: "Sports Jersey House | Premium Sports Jerseys",
    description:
      "A premium destination for sports jerseys, built for fast discovery, trustworthy product data, and AI-assisted shopping."
  }),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()])
          }}
        />
        <SiteHeaderShell />
        {children}
        <SiteFooter />
        <WelcomeLeadCapture />
      </body>
    </html>
  );
}
