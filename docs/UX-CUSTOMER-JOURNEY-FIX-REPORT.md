# Sports Jersey House — Customer Journey UX Fix Report

**Date:** 1 Sep 2026  
**Audit source:** `docs/UX-CUSTOMER-JOURNEY-AUDIT.md`  
**Production target:** https://sports-jersey-house.vercel.app  

---

## Implementation plan (executed)

| Priority | Issue IDs | Approach |
| --- | --- | --- |
| P1 | CJA-001, CJA-006 | League slug aliases (`/collections/nfl` etc.) resolve to `products.league` when no Shopify collection row exists — no fake `collection_products` rows |
| P1 | CJA-002, CJA-009 | Colour-aware cart images; PDP gallery syncs with colour selection |
| P1 | CJA-003, CJA-005 | Filter internal collections; sanitize dev/AI descriptions on index |
| P1 | CJA-004 | Homepage fan favourites exclude products without `primaryImageUrl` |
| P2 | CJA-007, CJA-010, CJA-011, CJA-014, CJA-015, CJA-017 | Cart CTA layout, fulfilment copy, Stripe messaging, collections layout, welcome delay, footer copy |
| P3 | CJA-020 | Cart item count grammar |

---

## Issues fixed

| ID | Fix |
| --- | --- |
| CJA-001 | `getCollectionBySlug` falls back to `products.league` for `nfl`, `nba`, `nhl`, `mlb`, `ncaa`, `soccer` |
| CJA-002 | Cart resolves line image via `resolveImageUrlForColour()` |
| CJA-003 | Internal collections hidden from homepage; league browse cards replace random first-six |
| CJA-004 | Fan favourites filter to products with images |
| CJA-005 | `sanitizeCollectionDescription()` strips development/AI copy |
| CJA-006 | Curated league cards link to working `/collections/{league}` routes |
| CJA-007 | `.cart-summary-actions` flex stack for checkout CTAs |
| CJA-009 | `ProductDetailInteractive` syncs gallery index with colour chip |
| CJA-010 | `formatCustomerFulfilmentStatus()` — e.g. unfulfilled → “Preparing your order” |
| CJA-011 | Removed “TEST MODE” from cart/checkout customer copy |
| CJA-014 | Collections index: league section + “More collections” with trimmed descriptions |
| CJA-015 | Welcome offer delay 1.8s → 4.5s |
| CJA-017 | Footer no longer claims “AI-assisted discovery” |
| CJA-020 | `formatCartItemCount()` pluralisation |

---

## Issues intentionally not fixed

| ID | Reason |
| --- | --- |
| CJA-008 | Broken related-product images need catalogue media URLs (data gap) |
| CJA-012 | React hydration #418 — needs dedicated repro in dev; not introduced by this pass |
| CJA-016 | No invented delivery SLAs; PDP production window unchanged |
| CJA-018 | Size charts require catalogue enrichment |
| CJA-019 | SKU / Default Title variant metadata — catalogue phase |
| CJA-013 | Collection title typos in DB — merchandising rename, not auto-edit |
| CJA-021–024 | Low-priority polish (copyright already dynamic in footer; US default country — only US/CA supported) |
| `/collections/all` ~5.8MB | See performance section — no product removal |

---

## Before / after behaviour

| Journey | Before | After |
| --- | --- | --- |
| `/collections/nfl` | 404 / empty-state, 0 products | 200, products where `league = NFL` (capped at 500 per page) |
| Homepage leagues | Random collections incl. ChatGPT slug | NFL, NBA, NHL, MLB, Soccer, NCAA cards |
| Colour → cart image | Primary image only (often wrong kit) | Image matched to colour label when gallery allows |
| PDP colour picker | Hero image static | Gallery updates when colour changes |
| Cart CTAs | Overlapping buttons | Stacked full-width actions |
| Order confirmation | “unfulfilled” | “Preparing your order” |

---

## Performance findings

| Route | Observation | Action |
| --- | --- | --- |
| `/collections/all` | ~5.8MB HTML — large `collection_products` membership rendered server-side | **Documented only.** Added `COLLECTION_PAGE_PRODUCT_LIMIT = 500` on all collection queries to cap SSR payload without removing catalogue from `/products` or search |
| League collections | NCAA/NHL could load 1500+ rows | Same 500 cap with alphabetical ordering |

---

## Tests

| Suite | Result |
| --- | --- |
| `@sjh/shared` vitest | 32 passed |
| `apps/web` `tsc --noEmit` | Pass |
| `apps/web` `next build` | Pass |
| Playwright (local :3102) | Collection audit 6/6 leagues with products; product-options 3/3; journey heading updated |
| Playwright production | Collection audit 6/6 + journey pass (desktop) after manual `vercel deploy --prod` (`dpl_BzpntCGYZ1nWPXF6qZJaZ1qfBvS2`) |
| Post-deploy smoke (1 Sep) | `/collections/nfl` returned 404 on auto-push — Vercel **Ignored Build Step** skipped CI deploy; manual prod deploy fixed. Root cause: `optimizePackageImports` stripped `LEAGUE_COLLECTION_SLUGS` from `@sjh/search` server bundle. |

---

## Files changed (summary)

- `packages/shared/src/storefront.ts` — league aliases, merchandising filters, image/colour helpers
- `packages/search/src/get-collection.ts` — league fallback + 500 product cap
- `packages/database/src/cart.ts` — colour-aware cart images
- `apps/web` — homepage, collections, cart, orders, PDP interactive, CSS, checkout copy, footer, welcome modal
- `apps/web/e2e` — collection audit expectations, journey heading

---

## Remaining P1/P2/P3 (post-fix)

| Severity | Count | Examples |
| --- | --- | --- |
| P1 | 0 | League routes restored |
| P2 | 5 | Broken image URLs (CJA-008), hydration (CJA-012), shipping estimate (CJA-016), size charts (CJA-018), collection typos (CJA-013) |
| P3 | 3 | Quantity button styling, PLP label truncation, checkout country default |

---

## Overall UX status

**Improved from 72/100 → estimated ~82/100** — discovery and colour/cart trust fixed; payment path unchanged; catalogue media gaps remain.
