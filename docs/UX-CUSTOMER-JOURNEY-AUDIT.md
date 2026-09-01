# Sports Jersey House — Customer Journey & Storefront UX Audit

**Date:** 1 Sep 2026  
**Target:** https://sports-jersey-house.vercel.app  
**Auditor mode:** Red-team customer journey + Playwright screenshots + Stripe TEST payment  
**Constraints observed:** No catalogue publish/classification changes, no payment/supplier architecture changes, no production code deploys during audit.

**Machine-readable register:** [`UX-CUSTOMER-JOURNEY-ISSUES.json`](./UX-CUSTOMER-JOURNEY-ISSUES.json)  
**Screenshots:** [`ux-audit-screenshots/`](./ux-audit-screenshots/) (includes `audit-*` captures from this session)

---

## Executive summary

A real customer **can complete a customised purchase** end-to-end in Stripe TEST mode: Aris-style sizes work, customisation survives cart → checkout → Stripe → order confirmation, and currency is consistently **GBP** on the tested path.

The storefront **fails discovery** for the leagues it advertises. NFL, NBA, NHL, MLB, and NCAA **collection pages are empty** while soccer has 276 products. Homepage and collections surfaces expose **internal/AI collection naming** and **broken product images**, which will erode trust before checkout.

**Payment architecture is sound** for TEST checkout. Primary conversion risk is **finding the right jersey**, not paying for it.

---

## Methodology

| Layer | What ran |
| --- | --- |
| Automated regression | `pnpm qa:prod` equivalent — **83 passed**, 3 skipped (desktop + mobile Chromium vs production) |
| Customer journey probe | `e2e/tests/10-customer-journey-audit.spec.ts` |
| Collection emptiness | `e2e/tests/12-collection-audit.spec.ts` |
| Stripe TEST payment | `e2e/tests/11-payment-audit.spec.ts` — order **SJH-10052** |
| API probes | Cart, checkout session, health, robots, policies |
| Visual review | Full-page Playwright screenshots desktop + mobile (390px) |

Stripe **live** credentials were not used. Failed/declined card UI was not re-run in this session (previously verified in QA-MASTER-AUDIT; cancel path verified via API pattern).

---

## Journey scorecard

| # | Journey | Result | Notes |
| --- | --- | --- | --- |
| 1 | Homepage | ⚠️ | Hero/CTAs clear; ChatGPT collection tile; 4/8 fan images broken |
| 2 | Header/navigation | ✅ | Products, Collections, Search, Cart; mobile hamburger works |
| 3 | Search | ✅ | NHL, team names return products; better than empty collections |
| 4 | Collections | ❌ | Index usable; **NFL/NBA/NHL/MLB/NCAA collections empty**; soccer 276 |
| 5 | Product listing (`/products`, `/collections/all`) | ✅ | Large catalogue reachable; `/collections/all` ~5.8MB HTML |
| 6 | Product detail page | ✅ | Canonical, JSON-LD, made-to-order copy, options panel |
| 7 | Colour selection | ⚠️ | Picker works; **label/image mismatch** on soccer sample |
| 8 | Aris-style size selection | ✅ | Full grid (XS–2XL, youth, toddler); not Default Title |
| 9 | Size guide | ✅ | Modal opens on NHL sample; missing when no chart data |
| 10 | Customisation | ✅ | Yes/No + £4.99; fields validate; preserved downstream |
| 11 | Cart | ⚠️ | Data preserved; button overlap; colour mismatch display |
| 12 | Checkout | ✅ | Server totals; policy-linked shipping row; form complete |
| 13 | Stripe TEST checkout | ✅ | Redirect to `checkout.stripe.com`; TEST keys confirmed |
| 14 | Successful payment | ✅ | SJH-10052 paid; webhook endpoint 5 events enabled |
| 15 | Failed payment | ⏸️ | Not re-run UI this session (historically stays `pending_payment`) |
| 16 | Cancelled payment | ⏸️ | Not re-run UI this session (historically no PO) |
| 17 | Order confirmation | ✅ | Customisation visible; status paid; refresh stable |
| 18 | Mobile journey | ⚠️ | Same flows; long checkout scroll; nav OK |
| 19 | Back/forward | ✅ | Checkout → back → cart works |
| 20 | Refresh/re-entry | ✅ | Checkout and success page survive refresh |

---

## Payment verification (Stripe TEST)

| Check | Result |
| --- | --- |
| Health `readyForTestCheckout` | ✅ `sk_test_` / `pk_test_` |
| Cart currency | ✅ GBP (cart + line items aligned) |
| Checkout session creation | ✅ POST `/api/checkout` → order number + URL |
| Amount tested | £50.98 ( £45.99 + £4.99 customisation ) |
| Customisation on order | ✅ Name PAY-AUDIT, Number 07, Message AUDIT |
| Stripe redirect | ✅ Hosted Checkout |
| Paid status | ✅ ORDER PAID on confirmation |
| Success URL refresh | ✅ No duplicate order message |
| Webhook config | ✅ 5 enabled events; 3 recent checkout.completed |
| PO before payment | Not DB-verified this session (architecture unchanged) |
| PO after payment | Not DB-verified this session — prior E2E proven |

Evidence: `audit-13-order-success.png`, `e2e/test-results/payment-audit.json`

---

## Representative products tested

| Category | Sample URL | Status |
| --- | --- | --- |
| NHL | `/products/nhl-connor-mcdavid-western-all-star-97-jersey` | ✅ PDP + sizes |
| NHL Default Title variant | `/products/nhl-jason-robertson-western-all-star-21-jersey` | ✅ Aris size M/Men's on order |
| MLB colour variants | `/products/mlb-edouard-julien-minnesota-twins-47-jersey` | ✅ Colour + size grid |
| Soccer | `/products/alexander-isak-newcastle-united-fc-14-jersey` | ⚠️ Colour/image mismatch in cart |
| NCAA basketball | `/products/1-army-black-knights-team-basketball-jersey-gold-ncaa` | ✅ PDP |
| NCAA football | `/products/5-arkansas-razorbacks-untouchable-football-jersey-white-ncaa` | ✅ PDP |
| International (soccer) | `/products/aaron-hickey-brentford-2-jersey` | ✅ PDP |
| NFL (browse) | `/collections/nfl` | ❌ Empty collection |
| NBA (browse) | `/collections/nba` | ❌ Empty collection |
| Customised order | SJH-10052 | ✅ |

---

## Visual / UX observations

### Strengths
- Clean Apple-inspired layout: generous whitespace, clear typography hierarchy on PDP and checkout.
- Purchase panel structure is logical: made-to-order notice → colour → size → customisation → price → CTA.
- Checkout two-column desktop layout keeps order summary visible; mobile stacks predictably.
- Policy pages updated — shipping no longer says checkout unavailable.
- Cart `noindex` and robots disallow `/orders`, `/supplier` deployed.

### Weaknesses
- **Collection index** mixes fan-facing leagues with internal buckets, typos, and dev descriptions.
- **Homepage fan favourites** half broken images — looks unfinished.
- **Cart order summary** button stacking bug on desktop.
- **TEST MODE** strings visible to customers on cart/checkout.
- Footer **copyright year** inconsistent across pages.

---

## Technical checks

| Check | Result |
| --- | --- |
| Console errors | React #418 hydration warning; 404s on bad product slugs |
| Network 5xx | None on crawled routes |
| Broken images | Multiple PLP/homepage/related cards |
| Broken links | No systemic 404s on nav |
| 404 unknown slug | ✅ Correct empty state |
| Admin/supplier unauth | ✅ Login redirect / 401 |
| Sitemap | ~5060 URLs |
| AI assistant | Disabled (503) — footer still mentions AI discovery |

---

## Issue register (summary)

Full detail in JSON. Severity definitions:

- **P0** — Broken purchase, security, or payment
- **P1** — Serious conversion or journey break
- **P2** — Meaningful UX/UI issue
- **P3** — Polish

### P0 (0)

None identified. Payment path and auth boundaries pass.

### P1 (6)

| ID | Problem |
| --- | --- |
| CJA-001 | NFL/NBA/NHL/MLB/NCAA collection pages empty |
| CJA-002 | Colour label vs product image mismatch (cart/checkout) |
| CJA-003 | ChatGPT-AI collection title on homepage/collections |
| CJA-004 | Broken images on homepage fan favourites |
| CJA-005 | “Development collection…” text on league cards |
| CJA-006 | Browse-by-league CTA leads to empty major-league collections |

### P2 (14)

CJA-007 through CJA-019 — cart button overlap, related broken images, colour/hero sync, “unfulfilled” label, TEST MODE copy, hydration errors, collection typos, inconsistent cards, welcome modal timing, shipping estimate gap, AI assistant off, size charts missing, SKU/Default Title data gap.

### P3 (5)

CJA-020 through CJA-024 — grammar, copyright year, quantity UX, label truncation, US default country on GBP checkout.

---

## Screenshots reference

| File | Journey |
| --- | --- |
| `01-homepage-desktop.png` | Homepage desktop (regression capture) |
| `02-homepage-mobile-390.png` | Homepage mobile |
| `audit-03-collections.png` | Collections index |
| `audit-04-products-plp.png` | Product listing |
| `audit-05-search-nhl.png` | Search |
| `audit-06-mlb-colour-pdp.png` | MLB colour PDP |
| `audit-07-nhl-default-title-pdp.png` | NHL Default Title variant |
| `audit-08-size-guide-modal.png` | Size guide |
| `audit-09-customisation.png` | Customisation panel |
| `audit-10-cart-desktop.png` | Cart |
| `audit-11-checkout-desktop.png` | Checkout desktop |
| `audit-12-checkout-mobile.png` | Checkout mobile |
| `audit-13-order-success.png` | Paid order confirmation |
| `03-pdp-nhl-desktop.png` etc. | Regression PDP/search/cart set |

---

## Recommended fix priority (awaiting approval)

**Do not implement without approval.**

1. **Collection assignment / empty league pages** — highest conversion impact; merchandising mapping only.
2. **Remove/hide internal collection titles** from homepage featured set.
3. **Colour ↔ image sync** on PDP and cart line display.
4. **Homepage image QA** — fix or remove broken fan favourite cards.
5. **Cart summary button layout** — quick CSS fix.
6. **Customer-facing fulfilment language** on order confirmation.
7. Polish: typos, copyright, TEST MODE banner policy, welcome modal timing.

---

## Regression suite

Re-run after fixes:

```bash
cd apps/web
env -u PLAYWRIGHT_BROWSERS_PATH PW_USE_SYSTEM_CHROME=1 npx playwright test --config e2e/playwright.config.ts
```

Audit-specific specs added this session: `10-customer-journey-audit`, `11-payment-audit`, `12-collection-audit`.

---

## Overall assessment

| Metric | Value |
| --- | --- |
| **OVERALL SCORE** | **72 / 100** |
| **P0** | 0 |
| **P1** | 6 |
| **P2** | 14 |
| **P3** | 5 |
| **PAYMENT STATUS** | **PASS** (Stripe TEST E2E) |
| **MOBILE STATUS** | **FUNCTIONAL** (same catalogue gaps) |
| **DESKTOP STATUS** | **FUNCTIONAL** (purchase OK; discovery weak) |

The storefront is **transaction-ready in TEST mode** but **not discovery-ready** for the leagues it promotes. Fixing empty league collections and customer-facing merchandising copy should be the first approved UI/merchandising pass before scaling traffic.
