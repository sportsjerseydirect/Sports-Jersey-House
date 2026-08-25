# SJD Third-Party App Data Map

**Date:** 2026-08-24  
**Status:** Investigation only — **no catalogue or code changes made**  
**Purpose:** Correct the architectural assumption that Shopify native variants are the source of truth for sizing on Sports Jersey Direct (SJD).

---

## Executive summary

SJD does **not** use Shopify product variants for customer **size selection**. Size, customisation, and size-chart UX on the live storefront are driven primarily by **one Shopify app**:

| Capability on SJD | Native Shopify variant? | Actual source |
| --- | --- | --- |
| **Color / style** | Yes — `Color` option (or single `Default Title`) | Shopify variant axis |
| **Size** | **No** | **Aris Product Options** (AvisPlus) — app option `Size` |
| **Customisation (name/number/message)** | **No** | **Aris Product Options** — option set `Custom Jerseys` |
| **Customisation pricing (+£4.99)** | **No** | Aris charge option + bundled “customization” product |
| **Size chart modal** | **No** | **Embedded in Aris** (`chart_title`, `size_modal_size_chart`) |
| **Product gallery** | Partially | **Product Wiz Rio** (variant-linked media) |
| **SKU** | Empty on live SJD too | Neither Shopify SKU nor Aris SKU observed |

The previous catalogue audit incorrectly treated:
- **450 color-only products** as missing sizes → they are **valid**; size lives in Aris, not variants.
- **50 Default Title products** as BLOCKED for size → they are **valid** on SJD; size comes from collection-scoped Aris optionsets (e.g. `hockey-jerseys`).

SJH currently implements a **native variant + internal customisation profile** model. That is **architecturally different** from SJD and does **not** faithfully reproduce the live store without importing/replicating Aris option-set rules.

---

## 1. Size app — Aris Product Options (AvisPlus)

### App identity

| Field | Value |
| --- | --- |
| **Shopify app block** | `shopify://apps/aris-product-options/blocks/avisplus-product-options/...` |
| **Storefront assets** | `cdn.shopify.com/extensions/.../aris-options-v1.1.733/` |
| **JS globals** | `window.ap_front_settings`, `apo-product-options-v3.js` |
| **Documentation** | [AvisPlus / Aris Product Options docs](https://options-docs.avisplus.io/) |
| **Plan on SJD** | `appPlan: "PRO"` (observed in storefront config) |

This is the **size selection app**. There is no separate Kiwi/Infinite Options/Bold size app on the inspected PDPs.

### How size works on SJD

1. **Shopify variant** selects **color** (MLB/soccer) or is a single **Default Title** variant (many NHL listings).
2. **Aris renders a separate `Size` dropdown** on the PDP via automated **option sets** scoped by **collection** (and/or vendor).
3. Customer selections become **line item properties** using Aris **Label on Cart** text (documented as unique per option).

### Observed option sets (live storefront HTML, Aug 2026)

| Option set name | Applies when | Size values (sample) |
| --- | --- | --- |
| `baseball-jerseys` | Collection **Baseball Jerseys** | XS/Men's … 3XL/Men's, S/Women's … XL/Women's, Youth S–XL, 1T–6T |
| `hockey-jerseys` | Collection **Hockey Jerseys** | S/Men's … 3XL/Men's, Youth/S … Youth/XL |
| `soccer-jerseys` | Collection **Soccer Jerseys** | S/Men's … 2XL/Men's, Youth/XS … Youth/XL |
| `Custom Jerseys` | Vendor **Sports Jersey Direct** (all jerseys) | Customisation fields (see §3) |

Example product evidence:
- MLB (color variants): `mlb-edouard-julien-minnesota-twins-47-jersey` — Shopify `options: ["Color"]`, Aris `baseball-jerseys` Size select.
- NHL (Default Title): `nhl-connor-mcdavid-western-all-star-97-jersey` — Shopify single variant, Aris `hockey-jerseys` Size select.
- Soccer (color variants): `alexander-isak-newcastle-united-fc-14-jersey` — Shopify `options: ["Color"]`, Aris `soccer-jerseys` Size select.

### Where Aris stores configuration

| Layer | Available to SJH today? | Notes |
| --- | --- | --- |
| **Aris app backend** (option sets, rules, pricing) | **No** | Injected at page render as `window.ap_front_settings.config["optionset"]` |
| **Shopify product metafields** | Partially | GraphQL import fetches `metafields(first: 30)` into `sourcePayload.metafields[]`; **does not contain full Aris option-set JSON** on inspected products |
| **Shopify variant fields** | Yes | Color/title/price only — **not size** |
| **`shopify_import_raw.payload`** | Sample path only (~860 products) | Full GraphQL node; same metafield limit; **no Aris optionset payload** observed |

Aris rules use **collection**, **vendor**, **product type**, **tags**, and **URL/handle** matchers (per app docs). SJD uses **collection-based** automated sets heavily.

### Cart → checkout → order on SJD

Per AvisPlus documentation and observed `label_cart` values:

| Label on Cart (property key) | Example value | Appears on |
| --- | --- | --- |
| `Size` | `M/Men's` | Cart, checkout, order detail, emails |
| `Customization` | `Yes` / `No` | Cart, checkout, order |
| `Name` | Customer text | When Customization = Yes |
| `Number` | Customer text | When Customization = Yes |
| `Any Message?` | Customer text | When Customization = Yes |

Properties are attached to the **main line item** (SJD config: merge with main product is default). Customization “Yes” adds **£4.99** via Aris `chargeorbundle` referencing a hidden Shopify product (`handle: customization`).

**Shopify variant ID** still identifies color/price tier. **Operational fulfilment** relies on line item properties + variant ID, not variant SKU.

### Does SJH reproduce this?

| SJD behaviour | SJH today | Gap |
| --- | --- | --- |
| Separate Size dropdown (Aris) | Single “Size” radiogroup over **variants** | **Mislabels Color/Default Title as size** |
| Required size before ATC | Implicit via variant pick only | **No apparel size field** on cart API |
| Size on order | Line item property `Size` | `order_items.size_label` falls back to **variant title** (e.g. “White”, “Default Title”) |
| Collection-scoped size lists | Not modelled | **No optionset / collection rule engine** |

---

## 2. Size chart app — same app (Aris), not a separate app

### Finding

SJD does **not** use a standalone size-chart app (e.g. Kiwi Size Chart) on inspected PDPs. Size guides are **built into Aris Product Options**.

Evidence from `Custom Jerseys` optionset config embedded on PDP:
- `chart_title: "Size chart"`
- `chart_header: "Size guides"`
- `size_modal_size_chart: "1000"` (modal width)
- `size_modal: "620"`

Charts are shown in-app alongside customisation fields, not as native Shopify metafield HTML.

### Mapping logic on SJD

| Rule type | Example |
| --- | --- |
| Sport/size list | Defined **inside each sport optionset** (`baseball-jerseys`, `hockey-jerseys`, …) — same option that captures Size |
| Product mapping | **Collection membership** (e.g. “Baseball Jerseys” → baseball size list) |
| Per-product metafield chart | **Not observed** as primary mechanism |

### SJH size charts today

| Aspect | SJH |
| --- | --- |
| Storage | Internal `size_charts` table (seeded: `nfl-adult`, `mlb-adult`, `nhl-adult`, `nba-adult`, `soccer-adult`) |
| Linking | Post-import enrichment: `products.sport` → generic chart slug |
| Content | Simplified chest/length tables — **not exported from Aris** |
| PDP | Modal from linked chart (`PdpPurchasePanel` → `SizeChartDialog`) |

**Assessment:** All 500 published products have **an** SJH size chart linked, but charts are **SJH-authored approximations**, not a faithful import of SJD/Aris size-guide content or per-optionset tables (which include youth/toddler tiers on SJD).

---

## 3. Customisation app — Aris Product Options (`Custom Jerseys`)

### Option set: `Custom Jerseys`

Applied to **vendor = Sports Jersey Direct** (effectively all jerseys).

| Field | Label on Product | Label on Cart | Type | Pricing |
| --- | --- | --- | --- | --- |
| Customization | Customization | Customization | button_single (Yes/No) | Yes = **+4.99** (charge/bundle) |
| Name | Name | Name | text | Shown if Customization = Yes |
| Number | Number | Number | text | Shown if Customization = Yes |
| Any Message? | Any Message? | Any Message? | text | Shown if Customization = Yes |

Conditional logic: Name/Number/Message only visible when **Customization = Yes**.

### SJD vs SJH customisation model

| Aspect | SJD (Aris) | SJH (native) |
| --- | --- | --- |
| Enable/disable | Yes/No toggle (+fee) | Mode radio: none / name / number / name_number / message |
| Pricing | Flat **£4.99** when “Yes” | Profile-based: seeded `jersey-standard` (name/number/name_number/message prices in DB; currency may differ from SJD) |
| Message field | Separate “Any Message?” | `message` mode only |
| Validation | Aris app rules | `cartCustomisationSchema` + profile max lengths |
| Cart storage | Shopify **line item properties** | `cart_items.customisation` JSONB |
| Order storage | Shopify order properties | `order_items.customisation` JSONB |
| Supplier PO | Shopify admin export | **Preserved** through SJH supplier portal |

**Chain survival in SJH:** Customisation **does** survive PDP → cart → checkout → order → supplier PO **for SJH-native customisation**. It does **not** match SJD’s Yes/No + £4.99 bundle semantics.

---

## 4. Auxiliary apps (not sizing — for context)

| App | Role | Relevant to sizing/customisation? |
| --- | --- | --- |
| **Product Wiz Rio** | Variant-linked media gallery (`__productWizRioProduct`) | No — images only |
| **EX Show Variants on Collection** | Collection display | No |
| **EasyLocation** | Geo/location | No |
| Loox, Tapita SEO, Shine Trust, etc. | Reviews, SEO, badges | No |

---

## 5. Where each stores data

### SJD runtime data flow

```
Shopify Admin
  ├── Product (title, description, tags, collections)
  ├── Variants → Color OR Default Title (+ price, images)
  └── Metafields (limited; e.g. custom.name_number hints — not full Aris config)

Aris Product Options (app backend)
  ├── Option sets (baseball-jerseys, hockey-jerseys, soccer-jerseys, Custom Jerseys)
  ├── Collection/vendor rules
  ├── Size values + size-chart modal config
  └── Pricing rules (+£4.99 customisation bundle)

Storefront (customer)
  ├── Native variant picker → Color
  ├── Aris widget → Size, Customization, Name, Number, Message
  └── Add to cart → line item properties + variant_id

Shopify Cart / Order
  ├── variant_id, variant title, price
  └── properties: { Size, Customization, Name, Number, "Any Message?" }
```

### SJH imported data (what we actually have)

| Source | Contents | Gap vs SJD |
| --- | --- | --- |
| `products` + `product_variants` | Title, slug, Color options, prices, images | **No Aris size** |
| `products.source_payload` (sample import) | tags, collections, descriptionHtml, seo, metafields[], customizationHints | **No optionsets** |
| `shopify_import_raw.payload` | Full GraphQL product node (sample ~860 rows) | Same — **no Aris config** |
| `size_charts` | Internal sport charts | **Not from Aris** |
| `customisation_profiles` | `jersey-standard` on all 500 products | **Different UX/pricing model** |
| `cart_items` / `order_items` | JSONB customisation; size_label column | **size_label not populated from customer size pick** |

---

## 6. How SJD sends data into Shopify orders

On order creation (Shopify):

1. **Line item:** product title, **variant ID** (color tier), quantity, unit price.
2. **Line item properties** (from Aris):
   - `Size: M/Men's`
   - `Customization: Yes`
   - `Name: SMITH` (optional)
   - `Number: 10` (optional)
   - `Any Message?: ...` (optional)
3. **Optional add-on line** if Aris displays customization as separate product (SJD default merges into main line).
4. **SKU field:** empty on inspected live variants (`sku: null` in JSON-LD / product JSON).

Suppliers fulfil from **order line properties + product/variant identity**, not from Shopify SKU.

---

## 7. How SJH currently receives / stores it

| Stage | What SJH captures |
| --- | --- |
| **Import** | Variants (Color/Default Title), images, basic taxonomy, metafields blob, tags, collections |
| **PDP** | Variant picker (labeled “Size”), internal size chart modal, internal customisation UI |
| **Add to cart** | `{ variantId, customisation }` — **no size property** |
| **Cart** | `cart_items`: variantId, customisation JSONB, customisation price |
| **Checkout** | Re-validates customisation; creates `order_items` |
| **Order line** | `variantTitle`, `sizeLabel` ← **defaults to variant title**, `sku`, `customisation` JSONB |
| **Supplier PO** | Product title, variant title, size label, customisation fields |

**Critical gap:** Customer-selected **apparel size** (Aris `Size`) has **no first-class field** in SJH cart/order schema today.

---

## 8. What SJH is missing (SJD parity)

### P0 — Fulfilment correctness

1. **Apparel size selection** independent of Shopify variant (Aris-equivalent field on cart/order/PO).
2. **Color vs size separation** on PDP (Color = variant; Size = app option).
3. **Collection/sport-scoped size lists** matching SJD optionsets (including youth/toddler where applicable).

### P1 — Commercial parity

4. **Customisation pricing model** — SJD £4.99 “Customization: Yes” vs SJH per-field profile pricing.
5. **Customisation Yes/No gate** before name/number/message fields.
6. **Size chart content** imported or authored to match Aris modal tables per sport.

### P2 — Migration / ops

7. **Aris optionset export** path (app API, manual export, or Shopify Admin app data) — **not in current GraphQL import**.
8. **Line item property mapping** for any future Shopify order sync / reconciliation.
9. **Identifier strategy** (see §10) — SKU absent on both sides.

### What SJH already has (partial parity)

- Customisation text fields flow to supplier PO.
- Size guide modal exists (different content source).
- Color variants imported correctly in `product_variants.options`.
- Images, prices, descriptions, SEO largely present.

---

## 9. Validity of previously flagged “issues”

### 450 color-only products — **VALID on SJD**

| Audit assumption | Correction |
| --- | --- |
| “450 products missing Size variant” | **Expected.** Shopify `Color` is the variant axis. Size is **Aris app option**. |
| “Map Color → size_label” | **Wrong.** Would corrupt data. Color should remain color. |
| “BLOCKED for readiness due to no Size in options” | **Incorrect rule** for SJD-shaped catalogues. |

### 50 Default Title products — **VALID on SJD**

| Audit assumption | Correction |
| --- | --- |
| “Default Title = missing size” | **Wrong.** SJD uses single variant + Aris `hockey-jerseys` Size dropdown. |
| “SIZE_REQUIRED / BLOCKED” | **Incorrect** under SJD model. Product is sellable on live store. |

Example: `nhl-connor-mcdavid-western-all-star-97-jersey` — Shopify `options: ["Title"]` / `Default Title`; Aris injects full men's/youth size list via Hockey Jerseys collection rule.

### SKU_REQUIRED (500/500) — **partially valid concern, wrong root cause**

| Fact | Detail |
| --- | --- |
| SJD live variants | **`sku: null`** on inspected MLB/NHL products |
| SJH import | 0 SKUs in variants and raw payload |
| Operational ID on SJD | **Shopify product ID + variant ID + line item properties** |

Missing SKU is a **SJH internal readiness choice**, not evidence that SJD cannot fulfil. Any SJH SKU strategy must be **designed**, not inferred from Shopify.

---

## 10. SKU investigation (no implementation)

### What SJD uses operationally

| Identifier | Present on SJD? | Used for |
| --- | --- | --- |
| Shopify Product GID | Yes | Product identity |
| Shopify Variant GID | Yes | Color/price tier |
| Line item properties | Yes | **Size, customisation** |
| Variant SKU | **No** (null on live sample) | — |
| Barcode | **No** (null) | — |

### Options for SJH (decision required — not implemented)

| Strategy | Pros | Cons |
| --- | --- | --- |
| **Shopify variant ID** (internal) | Already imported; stable | Does not encode size; one variant per color |
| **Shopify product ID + properties hash** | Mirrors SJD order shape | Not a traditional SKU |
| **Internal SJH line fingerprint** | Works for cart dedup today | Supplier-facing unfamiliar |
| **Supplier/manufacturer SKU** | Best for factory systems | **Not in Shopify source** — needs supplier file |
| **Synthetic SKU** (slug-color-size) | Dashboard-friendly | **Must not invent** without supplier agreement |

**Recommendation for future design:** Treat **order line snapshot** (product + variant + **selected size** + customisation properties) as the fulfilment unit of truth; SKU is optional enrichment when supplier data exists.

---

## 11. SJH implementation comparison (PDP → PO)

| Step | SJD | SJH | Parity? |
| --- | --- | --- | --- |
| **PDP — color** | Shopify variant swatches | Variant “Size” picker showing color names | ❌ Mislabeled |
| **PDP — size** | Aris dropdown | Not present as separate field | ❌ |
| **PDP — size chart** | Aris modal (sport-specific tables) | Linked `size_charts` by sport | ⚠️ Partial |
| **PDP — customisation** | Aris Yes/No + fields | Native profile modes | ⚠️ Different UX/price |
| **Cart** | Properties on line item | variantId + customisation JSONB | ⚠️ |
| **Checkout** | Shopify checkout | Stripe TEST checkout | ✓ (different stack; by design) |
| **Order** | Shopify order + properties | `order_items` + customisation JSONB | ⚠️ Size gap |
| **Supplier PO** | From Shopify order export | SJH supplier portal reads order_items | ✓ for customisation; ❌ for real size |

---

## 12. Correct definition of SJH catalogue readiness

Readiness must reflect **SJD-shaped commerce**, not raw Shopify variant completeness.

### Proposed readiness dimensions (for future audit revision)

| Check | READY when | NOT when |
| --- | --- | --- |
| **Sellable PDP** | Title, slug, price, images, color variant(s), description | Missing price/images |
| **Size pathway** | Product mapped to a **size optionset rule** (sport/collection) OR explicit made-to-order size policy documented | Inferring size must exist on variant |
| **Size chart** | Chart appropriate to sport/optionset linked or embedded | Missing chart where SJD shows one |
| **Customisation** | Profile/rules match SJD intent for product type | Wrong modes/pricing vs source |
| **Fulfilment ID** | Stable product + variant + **size + customisation** on order line | Requiring nonexistent Shopify SKU |
| **Taxonomy** | Sport/league/team evidence-based | Guessed taxonomy |

### What should **not** block readiness (SJD model)

- Shopify variant titled `Default Title` when Aris size optionset applies.
- Shopify variant axis = `Color` only.
- Empty Shopify `sku` when fulfilment uses properties + Shopify IDs.

### What **should** still block or flag review

- No size optionset mapping AND no documented size policy.
- Customisation enabled but pricing/validation differs materially from SJD.
- Missing supplier mapping for factory routing.
- Duplicate listings (unchanged).

---

## 13. Recommended architecture (future central supplier platform)

### Principle

**Separate three axes** that SJD currently splits across Shopify + Aris:

1. **Catalog identity** — product, slug, taxonomy, media (PostgreSQL catalogue).
2. **Merchandising variant** — color/style/price tier (Shopify variant equivalent).
3. **Purchase options** — size, customisation, add-on pricing (Aris-equivalent **options engine**).

### Suggested model

```
products
  └── merchandising_variants (color, price, shopify_variant_id)
  └── option_set_assignments (collection/sport/vendor rules)
        └── option_sets (hockey-jerseys, Custom Jerseys, …)
              └── options (Size, Customization, Name, …)
                    └── values + pricing

cart_lines / order_lines
  ├── merchandising_variant_id
  ├── selected_options: { size: "M/Men's", customization: "Yes", name: "…" }
  ├── options_price_amount
  └── fulfilment_snapshot (immutable)
```

### Migration phases (when approved)

1. **Extract** — Export Aris option sets from SJD (app admin or API); do not rely on `metafields(first: 30)` alone.
2. **Map** — Collection → optionset rules mirroring SJD (`Hockey Jerseys` → `hockey-jerseys`, etc.).
3. **Implement** — PDP options layer decoupled from variant picker; persist `selected_options` on cart/order.
4. **Validate** — Side-by-side order snapshots: SJD Shopify order properties vs SJH order line JSON.
5. **SKU** — Introduce supplier SKUs only when source file exists; use Shopify IDs until then.

### Do not repeat

- Using Shopify variant title as apparel size.
- Treating missing variant SKU as BLOCKED when SJD itself has null SKUs.
- Linking generic internal size charts without verifying against Aris sport tables.

---

## 14. SJH data already imported — metafields & hints

From codebase and prior audit (sample-import path):

| Field | Example | Used today? |
| --- | --- | --- |
| `sourcePayload.metafields[]` | `custom.name_number = true` (test fixture) | Stored; drives `customizationHints` heuristics only |
| `sourcePayload.customizationHints` | `personalizationLikely`, `matchingMetafieldKeys` | Readiness hints only |
| `sourcePayload.collections[]` | Collection handles | Collection membership sync |
| `product_variants.options` | `{ "Color": "White" }` | PDP variant picker (mislabeled) |

**GraphQL import limit:** `metafields(first: 30)` — may miss app metafields if paginated. **Variant metafields not fetched.**

**Full-import path** does not write `shopify_import_raw` — bulk catalogue lacks raw archive.

---

## 15. Investigation methods used

| Method | Scope |
| --- | --- |
| Live SJD PDP HTML/JS inspection | `sportsjerseydirect.com` — MLB, NHL, soccer samples |
| AvisPlus public documentation | Line item property / label-on-cart behaviour |
| SJH codebase review | Import mappers, PDP, cart, orders, supplier portal, audit CLI |
| Prior DB audit findings | Cross-reference only; **no DB writes** in this investigation |

**Not performed (per project rules):** Shopify Admin API calls, Aris admin export, catalogue mutations, readiness rule changes.

---

## 16. Immediate actions required before any catalogue fixes

1. **Stop** autofixes that map Color → `size_label` or flag Default Title as SIZE_REQUIRED.
2. **Revise** `run-catalogue-data-quality-audit.ts` readiness rules (separate task — not done here).
3. **Obtain** Aris option-set export from SJD app admin (business/ops task).
4. **Design** SJH `selected_options` schema on cart/order lines.
5. **Decide** SKU policy independently of Shopify variant SKU field.

---

## Appendix A — SJD store references

| Item | Value |
| --- | --- |
| Primary domain | `sportsjerseydirect.com` |
| Shopify domain | `sports-jersey-direct.myshopify.com` |
| Shop ID (storefront) | `90789773621` |
| Sample products inspected | See §1 |

## Appendix B — Key SJH files (for future work)

| Area | Path |
| --- | --- |
| Shopify import mapper | `packages/shopify/src/mappers/shopify-to-internal.ts` |
| GraphQL product query | `packages/shopify/src/index.ts` (`SHOPIFY_PRODUCTS_QUERY`) |
| PDP purchase UI | `apps/web/src/components/pdp-purchase-panel.tsx` |
| Cart API | `apps/web/app/api/cart/items/route.ts` |
| Orders | `packages/database/src/orders.ts` |
| Supplier PO | `packages/database/src/supplier-portal.ts` |
| Prior audit (needs revision) | `packages/database/src/cli/run-catalogue-data-quality-audit.ts`, `docs/CATALOGUE-DATA-QUALITY-AUDIT.md` |

---

*End of investigation document. No product, variant, checkout, Stripe, or deployment changes were made.*
