import type { Route } from "next";
import Link from "next/link";

const footerLinks = {
  shop: [
    { href: "/products", label: "All products" },
    { href: "/collections", label: "Collections" },
    { href: "/search", label: "Search" }
  ],
  company: [
    { href: "/pages/shipping", label: "Shipping" },
    { href: "/pages/returns", label: "Returns" },
    { href: "/pages/privacy", label: "Privacy" }
  ]
} as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <p className="eyebrow">Sports Jersey House</p>
          <p>Premium jersey shopping built on real catalogue data, search, and AI-assisted discovery.</p>
        </div>

        <div className="site-footer-columns">
          <div>
            <h2>Shop</h2>
            <ul>
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link href={link.href as Route}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Policies</h2>
            <ul>
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link href={link.href as Route}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="site-footer-meta">© {new Date().getFullYear()} Sports Jersey House. All rights reserved.</p>
    </footer>
  );
}
