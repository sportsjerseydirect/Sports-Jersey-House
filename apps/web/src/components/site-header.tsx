"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { BrandMark } from "@/components/brand-mark";

type SiteHeaderProps = {
  cartLabel: string;
};

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" },
  { href: "/admin", label: "Admin" }
] as const;

export function SiteHeader({ cartLabel }: SiteHeaderProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link href="/" className="brand-link" aria-label="Sports Jersey House home">
        <BrandMark />
        <span>Sports Jersey House</span>
      </Link>

      <nav className="site-nav site-nav-desktop" aria-label="Primary navigation">
        {navLinks.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
        <form action="/search" className="header-search" method="get" role="search">
          <label className="visually-hidden" htmlFor="header-search-q">
            Search jerseys
          </label>
          <input
            autoComplete="off"
            enterKeyHint="search"
            id="header-search-q"
            inputMode="search"
            name="q"
            placeholder="Search teams…"
            type="search"
          />
        </form>
        <Link href="/cart">{cartLabel}</Link>
      </nav>

      <div className="site-header-actions">
        <Link className="header-icon-link" href="/search" aria-label="Search">
          Search
        </Link>
        <Link className="header-cart-mobile" href="/cart" aria-label={cartLabel}>
          {cartLabel}
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bar" aria-hidden="true" />
          <span className="nav-toggle-bar" aria-hidden="true" />
          <span className="nav-toggle-bar" aria-hidden="true" />
        </button>
      </div>

      <div
        className={`mobile-nav-backdrop${menuOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />

      <nav
        className={`mobile-nav${menuOpen ? " is-open" : ""}`}
        id={menuId}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <div className="mobile-nav-inner">
          <form action="/search" className="mobile-search" method="get" role="search">
            <label className="visually-hidden" htmlFor="mobile-search-q">
              Search jerseys
            </label>
            <input
              autoComplete="off"
              enterKeyHint="search"
              id="mobile-search-q"
              inputMode="search"
              name="q"
              placeholder="Search teams or leagues"
              type="search"
            />
            <button className="button primary compact" type="submit">
              Search
            </button>
          </form>
          {navLinks.map((link) => (
            <Link className="mobile-nav-link" href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <Link className="mobile-nav-link mobile-nav-cart" href="/cart">
            {cartLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}
