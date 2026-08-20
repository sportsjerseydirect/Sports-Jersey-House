"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { BrandMark } from "@/components/brand-mark";

const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/collections", label: "Collections" },
  { href: "/search", label: "Search" }
] as const;

type CartState = {
  label: string;
  count: number;
};

function useCartState(): CartState {
  const pathname = usePathname();
  const [cart, setCart] = useState<CartState>({ label: "Cart", count: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadCartLabel() {
      try {
        const response = await fetch("/api/cart", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { cart?: { itemCount?: number } };
        const count = body.cart?.itemCount ?? 0;

        if (!cancelled) {
          setCart({
            count,
            label: count > 0 ? `Cart (${count})` : "Cart"
          });
        }
      } catch {
        if (!cancelled) {
          setCart({ label: "Cart", count: 0 });
        }
      }
    }

    void loadCartLabel();

    function onCartUpdated() {
      void loadCartLabel();
    }

    window.addEventListener("sjh:cart-updated", onCartUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("sjh:cart-updated", onCartUpdated);
    };
  }, [pathname]);

  return cart;
}

export function SiteHeader() {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const cart = useCartState();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="site-header">
      <Link href="/" className="brand-link" aria-label="Sports Jersey House home">
        <BrandMark />
        <span>Sports Jersey House</span>
      </Link>

      <nav className="site-nav site-nav-desktop" aria-label="Primary navigation">
        {navLinks.map((link) => (
          <Link href={link.href} key={link.href} className={pathname === link.href ? "is-active" : undefined}>
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
        <Link className="cart-link" href="/cart" aria-label={cart.label}>
          Cart
          {cart.count > 0 ? <span className="cart-badge">{cart.count}</span> : null}
        </Link>
      </nav>

      <div className="site-header-actions">
        <Link className="header-icon-link" href="/search" aria-label="Search">
          Search
        </Link>
        <Link className="header-cart-mobile cart-link" href="/cart" aria-label={cart.label}>
          Cart
          {cart.count > 0 ? <span className="cart-badge">{cart.count}</span> : null}
        </Link>
        <button
          type="button"
          className={`nav-toggle${menuOpen ? " is-open" : ""}`}
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
        aria-hidden={!menuOpen}
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
            <Link
              className={`mobile-nav-link${pathname === link.href ? " is-active" : ""}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
          <Link className="mobile-nav-link mobile-nav-cart" href="/cart">
            {cart.label}
          </Link>
        </div>
      </nav>
    </header>
  );
}
