# Sports Jersey House — Catalogue Data Quality Audit

**Date:** 2026-08-24  
**Scope:** Published Shopify-imported products only (`500` products).  
**Mode:** Audit + safe autofix applied  
**Constraints:** No title rewrites, no invented SKU/size/taxonomy, no catalogue expansion, no Shopify sync.

---

## Summary

| Metric | Count |
| --- | ---: |
| **TOTAL PUBLISHED (Shopify)** | 500 |
| **READY** | 0 |
| **NEEDS_REVIEW** | 450 |
| **BLOCKED** | 50 |

READY means: title, slug, price, variants, images, usable sizes — plus SKU, size chart, customisation, taxonomy, SEO meta, description.

**Honest assessment:** 0/500 products are genuinely customer-ready. The primary blockers are **missing SKUs across all 500 products** (Shopify source has zero SKUs) and **50 single-variant NHL products with Default Title / no size**.

---

## Autofix summary

| Category | Rows changed |
| --- | ---: |
| **AUTOFIXED (this run)** | 49 |
| **FLAGGED (requires human/supplier)** | 550+ |
| **NOT SAFE TO AUTOMATE** | SKU invention, size invention, title rewrites, collection renames |

### Autofixes applied

- **size_label_from_options:** 0
- **sku_from_shopify_raw:** 0
- **sport_filled_null_only:** 0
- **league_filled_null_only:** 49
- **size_charts_linked:** 0
- **customisation_profile_linked:** 0
- **image_alt_from_title:** 0
- **seo_records_created:** 0
- **seo_canonical_repaired:** 0
- **collection_memberships_from_payload:** 0

---

## Issue areas

### SKU
| | Count |
| --- | ---: |
| Variants missing SKU | 1639 |
| Products with any missing SKU (**SKU_REQUIRED**) | 500 |
| Duplicate SKU groups | 0 |
| Shopify raw payload variants with SKU | 0 / 1645 |

**Root cause:** Shopify import stored variants without SKU in `product_variants.sku`. Raw payload (`shopify_import_raw`) also contains **zero SKUs** — no reliable source to populate from.

**Action:** Supplier must assign SKUs in Shopify or provide a SKU mapping file. **Do not invent SKUs.**

### DEFAULT TITLE / SIZE
| | Count |
| --- | ---: |
| Variants titled "Default Title" | 50 |
| Variants **SIZE_REQUIRED** (no size in options) | 50 |
| Products failing size usability (**BLOCKED**) | 50 |

**Root cause:** 50 NHL (and similar) products have a single variant with `Title: Default Title` and no `Size` option in Shopify source.

**Blocked products (50):**

- `nhl-ales-hemsky-edmonton-oilers-83-jersey`
- `nhl-anson-carter-vancouver-canucks-77-jersey`
- `nhl-anson-carter-vancouver-canucks-77-jersey-1`
- `nhl-bill-guerin-boston-bruins-13-jersey`
- `nhl-bill-guerin-edmonton-oilers-9-jersey`
- `nhl-bill-guerin-new-jersey-devils-12-jersey`
- `nhl-bobby-ryan-ottawa-senators-9-jersey`
- `nhl-brad-boyes-boston-bruins-26-jersey`
- `nhl-brad-boyes-st-louis-blues-22-jersey`
- `nhl-brad-boyes-toronto-maple-leafs-28-jersey`
- `nhl-brian-campbell-buffalo-sabres-51-jersey`
- `nhl-brian-campbell-florida-panthers-51-jersey`
- `nhl-brian-gionta-new-jersey-devils-14-jersey`
- `nhl-cale-makar-western-all-star-8-jersey`
- `nhl-chris-drury-buffalo-sabres-23-jersey`
- `nhl-chris-drury-colorado-avalanche-18-jersey`
- `nhl-clayton-keller-western-all-star-9-jersey`
- `nhl-connor-mcdavid-western-all-star-97-jersey`
- `nhl-dion-phaneuf-calgary-flames-3-jersey`
- `nhl-dion-phaneuf-ottawa-senators-2-jersey`
- `nhl-dion-phaneuf-toronto-maple-leafs-3-jersey`
- `nhl-erik-karlsson-western-all-star-65-jersey`
- `nhl-jason-robertson-western-all-star-21-jersey`
- `nhl-kristian-huselius-florida-panthers-22-jersey`
- `nhl-leon-draisaitl-western-all-star-29-jersey`
- `nhl-loui-eriksson-dallas-stars-21-jersey`
- `nhl-loui-eriksson-vancouver-canucks-21-jersey`
- `nhl-marco-sturm-boston-bruins-16-jersey`
- `nhl-marco-sturm-san-jose-sharks-19-jersey`
- `nhl-martin-erat-nashville-predators-10-jersey`
- `nhl-martin-havlat-chicago-blackhawks-9-jersey`
- `nhl-martin-havlat-ottawa-senators-9-jersey`
- `nhl-matty-benier-western-all-star10-jersey`
- `nhl-michael-ryder-boston-bruins-73-jersey`
- `nhl-michael-ryder-montreal-canadians-73-jersey`
- `nhl-michael-ryder-new-jersey-devils-17-jersey`
- `nhl-mike-cammalleri-new-jersey-devils-13-jersey`
- `nhl-mike-comrie-edmonton-oilers-91-jersey`
- `nhl-mike-green-washington-capitals-52-jersey`
- `nhl-milan-michalek-san-jose-sharks-9-jersey`
- `nhl-ryan-kesler-vancouver-canucks-17-jersey`
- `nhl-scott-walker-nashville-predators-24-jersey`
- `nhl-sheldon-souray-edmonton-oilers-44-jersey`
- `nhl-sidney-crosby-eastern-all-star-87-jersey`
- `nhl-steve-sullivan-chicago-blackhawks-26-jersey`
- `nhl-stuart-skinner-western-all-star-74-jersey`
- `nhl-tony-amonte-chicago-blackhawks-10-jersey`
- `nhl-tony-amonte-philadelphia-flyers-11-jersey`
- `nhl-vaclav-prospal-ottawa-senators-13-jersey`
- `nhl-vaclav-prospal-tampa-bay-lightning-20-jersey`

### VARIANT STRUCTURE (Color vs Size)
| | Count |
| --- | ---: |
| Products with **Color-only** variants (no Size option) | 450 |
| Products with **Size-only** variants | 0 |
| Products with both Color and Size | 0 |

**Note:** 450 MLB/NHL/soccer products use **Color** as the variant axis (e.g. `options: { "Color": "White" }`). Variant title is the color name, not a size. This is valid Shopify structure but means **size selection happens elsewhere** (customisation / made-to-order). Do not map Color → `size_label`.

### SIZE CHART
| | Count |
| --- | ---: |
| Products missing size chart | 0 |

Linked only when `sport` is confidently set (NFL→nfl-adult, NHL→nhl-adult, etc.). All 500 already linked.

### TAXONOMY
| | Count |
| --- | ---: |
| Missing sport | 0 |
| Missing league | 0 |
| Missing team | 0 |
| Missing player | 1 |

**Remaining missing league (0):**

_None — all leagues populated from deterministic evidence._

### CUSTOMISATION
| | Count |
| --- | ---: |
| Missing customisation profile | 0 |

All 500 published products have `jersey-standard` customisation profile linked.

### IMAGES
| | Count |
| --- | ---: |
| Products with no images | 0 |
| Products with missing alt text | 0 |

All products have Shopify CDN images with alt text from product title.

### COLLECTIONS
| | Count |
| --- | ---: |
| Published products with zero collections | 0 |

#### `all-products-chatgpt-ai-product-description`
- **Title:** All Products (ChatGPT-AI Product Description)
- **Status:** published
- **Shopify ID:** gid://shopify/Collection/650101588277
- **Total memberships:** 500
- **Published products in collection:** 500
- **Origin:** Migrated Shopify collection handle — bulk AI description export bucket from SJD Shopify
- **Customer reachable:** Yes via `/collections/all-products-chatgpt-ai-product-description`
- **Indexed:** Public collection page; not disallowed in robots.txt
- **Recommended action:** Merchandising decision — rename/replace/hide when approved. **Not auto-changed.**

### DESCRIPTIONS
| | Count |
| --- | ---: |
| Empty description | 0 |

All 500 have descriptions. No placeholder-only or broken HTML detected at bulk scan level.

### SEO
| | Count |
| --- | ---: |
| Missing meta description (≥40 chars) | 0 |
| Missing canonical | 0 |

All products have SEO records with meta description and canonical `/products/{slug}`.

### DUPLICATES

| Confidence | Count | Notes |
| --- | ---: | --- |
| Duplicate Shopify product IDs | 0 | None |
| Duplicate slugs | 0 | None |
| Duplicate SKU groups | 0 | N/A (no SKUs) |
| **HIGH** — identical normalized title | 1 | Same title, different Shopify IDs |
| **MEDIUM** — slug suffix pairs | 5 | e.g. `-1` suffix duplicates |
| **LOW** — near-title pairs | 0 | Similar titles, different products |

#### HIGH confidence
- **"anson carter vancouver canucks 77 jersey"** (2 products): nhl-anson-carter-vancouver-canucks-77-jersey, nhl-anson-carter-vancouver-canucks-77-jersey-1

#### MEDIUM confidence (slug suffix)
- `mlb-ethan-roberts-chicago-cubs-39-jersey`: mlb-ethan-roberts-chicago-cubs-39-jersey, mlb-ethan-roberts-chicago-cubs-39-jersey-1
- `mlb-jonathan-cannon-chicago-white-sox-48-jersey`: mlb-jonathan-cannon-chicago-white-sox-48-jersey, mlb-jonathan-cannon-chicago-white-sox-48-jersey-1
- `nhl-anson-carter-vancouver-canucks-77-jersey`: nhl-anson-carter-vancouver-canucks-77-jersey, nhl-anson-carter-vancouver-canucks-77-jersey-1
- `nhl-jesper-boqvist-boston-bruins-70-jersey`: nhl-jesper-boqvist-boston-bruins-70-jersey, nhl-jesper-boqvist-boston-bruins-70-jersey-1
- `nhl-niko-mikkola-florida-panthers-77-jersey`: nhl-niko-mikkola-florida-panthers-77-jersey, nhl-niko-mikkola-florida-panthers-77-jersey-1

#### LOW confidence (review manually)
_None — note: Alvaro Morata Spain has two listings with different titles/slugs (7 vs no number). Review for merge._

**Do not auto-delete or archive.** Review list only.

---

## Readiness breakdown

| Blocker | Products affected |
| --- | ---: |
| SKU_REQUIRED | 500 |
| SIZE_REQUIRED (BLOCKED) | 50 |
| Missing size chart | 0 |
| Taxonomy review | 0 |

Every product with usable PDP (images, price, description, customisation) still fails READY because **SKU is mandatory for fulfilment**.

---

## Sample flagged products (first 40)

| Slug | SKU flag | Size flag |
| --- | --- | --- |
| aaron-cresswell-west-ham-3-jersey | SKU_REQUIRED | — |
| abdoulaye-doucoure-everton-16-jersey | SKU_REQUIRED | — |
| ac-milan-blank-custom-jersey | SKU_REQUIRED | — |
| ac-monza-blank-custom-jersey | SKU_REQUIRED | — |
| adam-wharton-england-25-fifa-euro-cup-jersey | SKU_REQUIRED | — |
| adriana-leon-canada-19-fifa-world-cup-jersey | SKU_REQUIRED | — |
| alaves-blank-custom-jersey | SKU_REQUIRED | — |
| alejandro-pozuelo-toronto-fc-mls-10-jersey | SKU_REQUIRED | — |
| alexander-isak-newcastle-united-fc-14-jersey | SKU_REQUIRED | — |
| almeria-blank-custom-jersey | SKU_REQUIRED | — |
| alvaro-morata-spain-7-fifa-world-cup-jersey | SKU_REQUIRED | — |
| alvaro-morata-spain-fifa-world-cup-jersey | SKU_REQUIRED | — |
| amadov-onana-evertn-jersey-8-jersey | SKU_REQUIRED | — |
| andre-gomes-everton-21-jersey | SKU_REQUIRED | — |
| arnaut-danjuma-everton-10-jersey | SKU_REQUIRED | — |
| as-roma-blank-custom-jersey | SKU_REQUIRED | — |
| ashley-young-everton-18-jersey | SKU_REQUIRED | — |
| aston-villa-blank-custom-jersey | SKU_REQUIRED | — |
| atalanta-blank-custom-jersey | SKU_REQUIRED | — |
| athletic-bilbao-blank-custom-jersey | SKU_REQUIRED | — |
| atletico-madrid-blank-custom-jersey | SKU_REQUIRED | — |
| aurelien-tchouameni-france-8-fifa-world-cup-jersey-1 | SKU_REQUIRED | — |
| aymeric-laporte-spain-14-euro-cup-jersey | SKU_REQUIRED | — |
| ayo-akinola-toronto-fc-mls-20-jersey | SKU_REQUIRED | — |
| barcola-29-paris-saint-germain-jersey | SKU_REQUIRED | — |
| ben-godfrey-everton-22-jersey | SKU_REQUIRED | — |
| benjamin-cremaschi-inter-miami-mls-30-jersey | SKU_REQUIRED | — |
| beto-everton-14-jersey | SKU_REQUIRED | — |
| blake-wheeler-new-york-rangers-17-jersey | SKU_REQUIRED | — |
| bologna-blank-custom-jersey | SKU_REQUIRED | — |
| bournemouth-blank-custom-jersey | SKU_REQUIRED | — |
| bradley-barcola-france-25-fifa-world-cup-jersey | SKU_REQUIRED | — |
| brentford-blank-custom-jersey | SKU_REQUIRED | — |
| brighton-hove-albion-blank-custom-jersey | SKU_REQUIRED | — |
| bukayo-saka-england-7-fifa-euro-cup-jersey | SKU_REQUIRED | — |
| burnley-blank-custom-jersey | SKU_REQUIRED | — |
| cadiz-blank-custom-jersey | SKU_REQUIRED | — |
| cagliari-blank-custom-jersey | SKU_REQUIRED | — |
| carles-gil-new-england-revoltuion-mls-10-jersey | SKU_REQUIRED | — |
| celta-vigo-blank-custom-jersey | SKU_REQUIRED | — |

---

## NOT SAFE TO AUTOMATE

- Inventing SKU when absent from Shopify variant + raw payload (**500 products**)
- Inventing size when not in variant options/title (**50 products**)
- Mapping Color variant → size_label (**450 products** — would invent size)
- Guessing sport/league/team/player without evidence
- Renaming collections (including chatgpt slug)
- Rewriting product titles or descriptions
- CREATE_NEW_LISTING proposals — human review only
- Deleting/archiving duplicate listings

---

## Decisions required (human)

1. **SKU assignment strategy** — 100% of published variants lack Shopify SKUs. Need supplier SKU file or Shopify-side population before READY.
2. **50 Default Title NHL products** — restructure variants in Shopify or define made-to-order sizing workflow.
3. **450 Color-only variants** — confirm PDP/cart fulfilment model (color selection vs size).
4. **Duplicate listings** — Anson Carter Canucks (HIGH), Alvaro Morata Spain (LOW — different slugs/titles).
5. **`all-products-chatgpt-ai-product-description`** — rename/hide from navigation when approved.
6. **Remaining missing league** — manual review if any remain after club-name inference.

---

## Commands

```bash
# Audit only
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts

# Apply safe autofixes
cd packages/database && corepack pnpm exec tsx --env-file=../../.env src/cli/run-catalogue-data-quality-audit.ts --apply
```
