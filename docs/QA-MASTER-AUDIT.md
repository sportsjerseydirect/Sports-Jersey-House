# Sports Jersey House — Master production QA audit

**Date:** 24 Aug 2026  
**Target:** https://sports-jersey-house.vercel.app  
**Mode:** Stripe TEST only. Supplier portal UI frozen (data model inspected, no new supplier UI).  
**Playwright MCP:** Not present in this Cursor session. Official Playwright MCP configured at `.cursor/mcp.json` (`npx @playwright/mcp@latest`). Production was exercised with **Playwright Test + system Chrome** (see QA-020) and live HTTP/API probes.

Permanent suite: `apps/web/e2e/`  
Command: **`pnpm qa:prod`** (uses system Chrome; clears broken `PLAYWRIGHT_BROWSERS_PATH`)  
Optional bundled Chromium: `pnpm qa:prod:install` then `pnpm qa:prod:bundled`

---

## Issue register

### QA-001 — Cart total currency defaulted to USD while items were GBP
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Checkout / pricing |
| URL/API | `POST /api/cart/items` → cart snapshot |
| Reproduction | Add Jason Robertson variant `31469f6b-8568-4f4c-989d-acb8ca263dd7`. Response `items[0].currencyCode=GBP` but `cart.currencyCode=USD`. Cart/checkout subtotal formatted as USD. |
| Expected | Cart currency matches line items. Stripe charges the order currency. |
| Actual | Header/subtotal used carts.currency_code default USD. |
| Root cause | `getCartBySessionId` returned `carts.currencyCode` (default USD) instead of variant currency. `addItemToCart` did not persist variant currency onto the cart. |
| Evidence | Live API 200 body: `subtotalAmount 45.99`, item `GBP`, cart `USD`. |
| Fix | Cart now stores and returns the variant currency; mixed-currency add is rejected. |
| Remaining risk | Historic carts may still show USD until a new add; catalogue still mixed-currency across products. |

### QA-002 — Stripe payment fee could stay 0.00 forever
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Payments / margin |
| URL/API | `POST /api/webhooks/stripe` |
| Reproduction | SJH-10015 paid via TEST Checkout. Webhook marked paid. `payment_fee_amount=0.00` because balance transaction was not ready. Duplicate event id does not retry fee. |
| Expected | Missing fee can be filled when Stripe later reports it, without duplicating payment/PO. |
| Actual | Fee stuck at 0; contribution margin overstated. |
| Root cause | Fulfilment on `checkout.session.completed` only; `already_paid` ignored later fee; no `payment_intent.succeeded` fee backfill. |
| Evidence | Production order SJH-10015 PI present, fee 0.00; local TEST keys cannot read that PI (different account). |
| Fix | Retry fee retrieve; update fee on already-paid if current fee is 0; handle `payment_intent.succeeded` as fee-only. Does not change Checkout Session architecture. |
| Remaining risk | Existing SJH-10015 stays 0.00 until a later TEST event for that PI is delivered after deploy. |

### QA-003 — Policy pages said checkout was not live
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Conversion / trust |
| URL | `/pages/shipping`, `/pages/returns`, `/pages/privacy` |
| Reproduction | Open shipping while Stripe TEST checkout is live. |
| Expected | Policy matches storefront behaviour. |
| Actual | “Checkout and fulfilment are not yet available.” |
| Root cause | Stale launch copy. |
| Evidence | Source `apps/web/app/pages/shipping/page.tsx` pre-fix. |
| Fix | Rewrote shipping/returns/privacy to describe made-to-order checkout without inventing rates or legal waivers. |
| Remaining risk | Still no published carrier table or numeric delivery SLA. |

### QA-004 — Checkout said shipping would be “calculated later”
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Checkout |
| URL | `/checkout` |
| Reproduction | Add item, open checkout summary. |
| Expected | Honest description of what Stripe will charge. |
| Actual | “Shipping: Calculated later” while Stripe charges `order.totalAmount` with `shipping_revenue_amount=0`. |
| Root cause | Placeholder copy. |
| Evidence | `checkout-form.tsx` pre-fix. |
| Fix | Link to `/pages/shipping` instead of implying a later surcharge. |
| Remaining risk | Customers still lack a shipping rate before pay. |

### QA-005 — Size stored as “Default Title”
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Catalogue / fulfilment |
| URL | PDP + order lines |
| Reproduction | Robertson / many Shopify imports: variant title `Default Title`. Size picker shows “Default Title”. Order `size_label` copied from variant title. |
| Expected | Real size (S–XXL) on PDP and PO. |
| Actual | Fake size; supplier cannot cut the right jersey. |
| Root cause | Shopify single-variant products; `sizeLabel` null; order used `variantTitle`. |
| Evidence | Live cart item `variantTitle: Default Title`; DB `variant_sku` null. |
| Fix | Order `sizeLabel` prefers `product_variants.size_label`. Catalogue SKU/size data still missing — **do not invent sizes**. |
| Remaining risk | Majority of listings still have null size/SKU. Needs catalogue data work, not UI invention. |

### QA-006 — Missing SKUs on published jerseys
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Catalogue / fulfilment |
| URL/API | PO data model |
| Reproduction | Paid order SJH-10015 / PO-5009: order line sku null, mapping supplier_sku null, variant sku null. |
| Expected | Supplier-identifiable SKU. |
| Actual | Empty. |
| Root cause | Import did not populate `product_variants.sku`. |
| Evidence | SQL on SJH-10015. |
| Fix | Cart/order copy SKU when present. No auto-generated SKUs. |
| Remaining risk | Data gap until catalogue enrichment (human/admin). |

### QA-007 — Cart was indexable
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | SEO |
| URL | `/cart` |
| Reproduction | View source robots meta. |
| Expected | noindex (robots.txt already Disallow /cart). |
| Actual | Metadata lacked noIndex. |
| Fix | `noIndex: true` on cart metadata. |
| Remaining risk | None once deployed. |

### QA-008 — robots.txt did not disallow /supplier or /orders
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | SEO |
| URL | `/robots.txt` |
| Reproduction | GET robots.txt (pre-deploy). |
| Expected | Disallow supplier + order confirmation URLs. |
| Actual | Only admin, cart, checkout, api. |
| Fix | Added `/supplier` and `/orders`. Pages already send noindex where applicable. |
| Remaining risk | Sequential `/orders/SJH-n` remains fetchable without auth (by design for guest confirmation). |

### QA-009 — Collection slug `all-products-chatgpt-ai-product-description`
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | SEO / conversion |
| URL | `/collections/all-products-chatgpt-ai-product-description` |
| Reproduction | `/collections` listing. |
| Expected | Customer-facing collection names. |
| Actual | Internal/AI dump slug from Shopify. |
| Root cause | Migrated collection handle. |
| Evidence | Live collections HTML. |
| Fix | Not auto-renamed (would be catalogue publish). |
| Remaining risk | Ugly URL until merchandising rename. |

### QA-010 — Customer AI assistant disabled
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | AI / conversion |
| URL/API | `POST /api/shopping-assistant` |
| Reproduction | POST `{message:"Find Yankees"}` → 503 disabled. |
| Expected | Documented capability. |
| Actual | `ENABLE_AI_SHOPPING_ASSISTANT` is false in production. |
| Fix | None (do not enable without credentials). |
| Remaining risk | No on-site discovery assistant. |

### QA-011 — Size chart often missing
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | Custom product rules |
| URL | PDPs without size guide button |
| Reproduction | Open listings whose `sizeChart` is null. |
| Expected | Size chart on apparel. |
| Actual | Size guide only when chart attached. |
| Evidence | Code: `PdpPurchasePanel` hides guide without `sizeChart`. |
| Fix | None without catalogue data. |
| Remaining risk | Sizing mistakes / chargebacks. |

### QA-012 — Shipping policy lacked rates; delivery evidence gaps
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | Chargeback / ops |
| Reproduction | Inspect order + PO schema vs dispute needs. |
| Expected | Shipping option, carrier, tracking, delivery timestamp, customer comms. |
| Actual | Schema has tracking, courier, shipped/delivered timestamps, issues, customisation, Stripe IDs. Missing: chosen shipping option, signature, customer email send log (outbound email OFF), delivery photo. |
| Fix | Not inventing legal/shipping products. |
| Remaining risk | Weak dispute pack until tracking + comms exist. |

### QA-013 — Admin unauthenticated access
| Field | Detail |
| --- | --- |
| Severity | P2 (control working) |
| Area | Security |
| URL | `/admin`, `POST /api/admin/jobs/run` |
| Reproduction | Open `/admin` → login. POST jobs without cookie → 401. |
| Expected | No dashboard/API without session. |
| Actual | Redirect/401. **Pass.** |
| Fix | None. |
| Remaining risk | Shared ADMIN_PASSWORD still a single secret (users page exists). |

### QA-014 — Supplier API IDOR surface
| Field | Detail |
| --- | --- |
| Severity | P2 (control working) |
| Area | Supplier security |
| URL/API | `POST /api/supplier/orders/PO-5009/cost` |
| Reproduction | No cookie → 401. Handler uses `session.supplierId` + `assertSupplierOwnsPo`. |
| Expected | Cannot cost another supplier’s PO. |
| Actual | Unauth blocked. Cross-supplier needs a second supplier session (not used; UI frozen). |
| Evidence | `supplier-portal.ts` `assertSupplierOwnsPo`. |
| Remaining risk | UI frozen; APIs still live — keep them auth-gated. |

### QA-015 — Playwright MCP not wired in session
| Field | Detail |
| --- | --- |
| Severity | P3 |
| Area | QA tooling |
| Reproduction | Dynamic MCP catalog had no Playwright tools. |
| Expected | Cursor-controlled browser. |
| Actual | Official config added; suite uses Playwright Test against production. |
| Fix | `.cursor/mcp.json`. Reload Cursor MCP to activate. |

### QA-016 — Client price fields ignored (control)
| Field | Detail |
| --- | --- |
| Severity | P2 (control working) |
| Area | Payments |
| URL/API | `POST /api/cart/items` with `unitPriceAmount: "0.01"` |
| Expected | Server price. |
| Actual | Line stayed `45.99`. Invalid name+number customisation → 400. |
| Evidence | Live probe 24 Aug 2026. |

### QA-017 — WELCOME10 server-side (control)
| Field | Detail |
| --- | --- |
| Severity | P3 (control working) |
| Area | Offers |
| URL | `/api/offers/welcome10?email=nobody@example.com` |
| Actual | `eligible: false`, lead capture required. |

### QA-018 — Admin Command Centre revenue shown in USD
| Field | Detail |
| --- | --- |
| Severity | P2 |
| Area | Admin / commerce |
| URL | `/admin` revenue card |
| Reproduction | Open Command Centre with paid orders in GBP. |
| Expected | Revenue formatted in catalogue/order currency (mostly GBP). |
| Actual | `formatMoney` hard-coded `currency: "USD"`. |
| Fix | Changed to `GBP` in `admin/page.tsx`. |
| Remaining risk | Mixed-currency catalogue still possible; no per-order currency roll-up yet. |

### QA-019 — Mission fixes not yet on production
| Field | Detail |
| --- | --- |
| Severity | P1 |
| Area | Deploy / release |
| Reproduction | Compare production vs local `main` + uncommitted QA branch work (24 Aug 2026). |
| Expected | Cart currency, policy copy, checkout shipping row, robots.txt, cart noindex, Stripe fee backfill event live. |
| Actual | Production `/pages/shipping` still contains “not yet available”; `/robots.txt` lacks `/supplier` and `/orders`; health webhook `enabledEventCount: 4` (no `payment_intent.succeeded` yet). |
| Fix | **Code fixed locally — deploy required.** |
| Remaining risk | Customers still see stale trust copy; SEO/cart currency bugs persist until Vercel deploy. |

### QA-020 — Playwright bundled browser install blocked by stale lock/path
| Field | Detail |
| --- | --- |
| Severity | P3 |
| Area | QA tooling |
| Reproduction | `pnpm qa:prod:install` with `PLAYWRIGHT_BROWSERS_PATH` pointing at repo `.playwright-browsers`. |
| Expected | One-command browser install. |
| Actual | Download completes then hangs; `__dirlock` left behind; incomplete `chromium_headless_shell`. Cursor shell also exports `PLAYWRIGHT_BROWSERS_PATH` globally. |
| Fix | `pnpm qa:prod` now runs `env -u PLAYWRIGHT_BROWSERS_PATH PW_USE_SYSTEM_CHROME=1` against system Google Chrome. Video capture disabled to avoid ffmpeg dependency. |
| Remaining risk | CI must either install browsers cleanly or set `PW_USE_SYSTEM_CHROME=1`. |

---

## Production crawl (24 Aug 2026)

Read-only GET crawl + Playwright against https://sports-jersey-house.vercel.app:

| Route | Status | Notes |
| --- | --- | --- |
| `/`, `/products`, `/search`, `/collections`, `/checkout`, `/cart` | 200 | ~0.3–3.4s |
| Sport searches NHL/MLB/soccer/NBA/NFL | 200 | Results render |
| `/pages/shipping` | 200 | **Still stale** — “not yet available” on production |
| `/pages/returns`, `/pages/privacy` | 200 | |
| `/robots.txt` | 200 | Missing `/supplier`, `/orders` on production |
| `/sitemap.xml` | 200 | ~117KB, 508 product URLs, 31 collections, no `/admin/` |
| `/admin/*`, `/supplier/*` (unauth) | 200 → login | Middleware redirect working |
| Unknown product slug | 404 | Correct |
| `/api/health` | 200 | TEST Stripe, payments enabled, Shopify sync off, AI assistant off |

**Sample PDPs (6):** all 200, canonical + JSON-LD present, made-to-order + customisation + size guide visible on sampled soccer/MLB listings. No `Default Title` on alphabetical sample (Robertson NHL listing still known bad from prior session).

**Collections:** includes slug `all-products-chatgpt-ai-product-description` (QA-009). `/collections/all` lists 500 products.

**Security probes (unauthenticated):** `POST /api/admin/jobs/run` → 401; `GET /api/admin/catalogue/products` → 401; `POST /api/supplier/orders/PO-5009/cost` → 401. WELCOME10 ineligible without lead capture. Shopping assistant → disabled (503 JSON).

## Stripe TEST (architecture unchanged)

Verified previously and by API health this session:

- Successful TEST pay: SJH-10015 → webhook `checkout.session.completed` → `paid` → PO-5009  
- Failed/decline path: SJH-10017 `pending_payment`, no PO  
- Cancel: SJH-10016 `pending_payment`, no PO  
- Duplicate event: `duplicateEvent: true`, one order  
- Success page refresh: one order  
- Health: `sk_test_` / `pk_test_`, webhook endpoint matched, Shopify sync false  
- No Connect / Transfers in code paths  

Fee backfill (QA-002) is the only Stripe-adjacent code change.

---

## Admin Command Centre

Unauthenticated: all sampled `/admin/*` redirect to login. Cards/links in `admin/page.tsx` point at real routes (orders, POs, catalogue, jobs, marketing, AI ops). Full authenticated click-through of every button was **not** completed in this pass because it requires the production admin secret in an interactive session. Treat remaining admin UX as **partial**.

---

## Catalogue / custom product rules

Live `/products` spans MLB, soccer, NHL, NBA, NFL collections. Sampled PDPs show made-to-order, customisation, and size guide. Many Shopify imports still have `Default Title` / null SKU / null size chart (QA-005/006/011) — **catalogue data work, not auto-fix**. `/collections/all` caps at 500 products per page (pagination/scale P2).

---

## Performance (observed)

| Page | Approx TTFB+HTML |
| --- | --- |
| Homepage | ~2.0s |
| `/products` | ~1.1s |
| `/search?q=nhl` | ~1.4s |
| PDP (sample) | ~2–3.4s |
| `/sitemap.xml` | ~1.6s (116KB, 508 URLs) |
| `/collections/all` | ~2.7s (500 product links) |

Sitemap is fully dynamic — scale risk as catalogue grows (P2). No production APM in this audit.

---

## Database (non-destructive)

- Sequential public order numbers.  
- Stripe session/PI unique indexes exist.  
- `stripe_runtime_config` table added for webhook signing fallback.  
- Orphan/duplicate cleanup **not** performed.

---

## Totals

| | Count |
| --- | --- |
| TOTAL ISSUES | 20 |
| P0 | 0 |
| P1 | 7 (QA-001–006, QA-019 deploy gap) |
| P2 | 10 |
| P3 | 3 |
| FIXED in code (local, not all deployed) | QA-001–004, QA-005 path, QA-007, QA-008, QA-015, QA-018, QA-020 |
| REMAINING | QA-005/006 catalogue data, QA-009 slug, QA-010 AI off, QA-011 charts, QA-012 evidence, QA-019 deploy, authenticated admin click-through, sitemap/collection scale |
| SECURITY | Admin/supplier APIs 401 without session; price tamper ignored; middleware login walls |
| PAYMENTS | TEST E2E proven (SJH-10015); fee backfill coded, webhook 5th event pending deploy |
| CHECKOUT | Server totals; shipping copy fixed locally; production still stale policy |
| FULFILMENT | Paid-only PO batch; size/SKU data often empty |
| SUPPLIER | UI frozen; APIs auth-gated; DTO excludes sell price/margin |
| ADMIN | Login wall works; revenue currency fixed locally; deep click audit remaining |
| CATALOGUE | Default Title / missing SKU on many imports; sampled alpha listings OK |
| SEO | robots/supplier/orders + cart noindex fixed locally; production robots still old |
| PERFORMANCE | PDP ~3s; sitemap/collection-all heavy |
| CONVERSION | Stale shipping policy on production hurts trust until deploy |

## Permanent QA suite

- Location: `apps/web/e2e/`  
- Run: **`pnpm qa:prod`** (from repo root)  
- Install bundled Chromium (optional): `pnpm qa:prod:install`  
- Bundled run (no system Chrome): `pnpm qa:prod:bundled`  
- Artifacts: `apps/web/e2e/test-results/`, `apps/web/e2e/playwright-report/`  
- Covers: crawl, discovery→cart, auth boundaries (14 admin routes + 9 APIs), SEO, checkout session metadata, AI disabled honesty, Stripe TEST health  

### Production regression result (24 Aug 2026, pre-deploy)

| Project | Passed | Failed | Skipped | Notes |
| --- | --- | --- | --- | --- |
| desktop-chromium | **36** | **1** | 1 | Fail: robots.txt missing `/supplier` + `/orders` on **production** (QA-008/019) |
| mobile-chromium | **35** | **1** | 2 | Same robots failure; crawl skipped on mobile by design |

Stripe hosted Checkout pay test excluded from automated run (creates real TEST orders); proven manually via SJH-10015 E2E in prior session.

**Build:** `pnpm --filter @sjh/web build` succeeded (24 Aug 2026). Root `turbo build` failed in this environment (package manager binary path); web typecheck + unit tests pass.
