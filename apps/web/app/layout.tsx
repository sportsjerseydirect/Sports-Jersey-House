import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { createMetadata, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = createMetadata({
  title: "Sports Jersey House | Premium Sports Jerseys",
  description: "A premium destination for sports jerseys, built for fast discovery, trustworthy product data, and AI-assisted shopping."
});

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
        <header className="site-header">
          <Link href="/" className="brand-link" aria-label="Sports Jersey House home">
            <BrandMark />
            <span>Sports Jersey House</span>
          </Link>
          <nav className="site-nav" aria-label="Primary navigation">
            <Link href="/products">Products</Link>
            <Link href="/search">Search</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
