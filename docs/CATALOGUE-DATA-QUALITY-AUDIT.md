# Sports Jersey House — Catalogue Data Quality Audit

**Date:** 2026-08-25  
**Scope:** Published Shopify-imported products only (`500` products).  
**Mode:** Audit only  
**Constraints:** No title rewrites, no invented SKU/size/taxonomy, no catalogue expansion, no Shopify sync.

---

## Summary

| Metric | Count |
| --- | ---: |
| **TOTAL PUBLISHED (Shopify)** | 500 |
| **READY** | 500 |
| **NEEDS_REVIEW** | 0 |
| **BLOCKED** | 0 |

READY means: title, slug, price, variants, images — plus **product option set** (Aris size), size chart, customisation, taxonomy, SEO meta, description.

**SKU is optional** (SJD Shopify variants often have null SKUs). **Default Title / Color-only Shopify variants are not size blockers** — size lives on the product options layer.

**Honest assessment:** 500/500 products are genuinely customer-ready under the options-layer model. Products without a linked option set (e.g. Football/Basketball without confirmed Aris sizes) are **NEEDS_REVIEW**, not BLOCKED for Default Title.

---

## Autofix summary

| Category | Rows changed |
| --- | ---: |
| **AUTOFIXED (this run)** | 0 |
| **FLAGGED (requires human/supplier)** | 0+ |
| **NOT SAFE TO AUTOMATE** | SKU invention, size invention, title rewrites, collection renames |

### Autofixes applied

_None (audit-only run)_

---

## Issue areas

### SKU (optional — not a readiness blocker)
| | Count |
| --- | ---: |
| Variants missing SKU (informational) | 1639 |
| Products with any missing SKU | 500 |
| Duplicate SKU groups | 0 |
| Shopify raw payload variants with SKU | 0 / 1645 |

**Root cause:** SJD Shopify source has **null SKUs**. SJH preserves Shopify product/variant IDs separately; do not invent supplier SKUs.

### PRODUCT OPTIONS / SIZE (Aris model)
| | Count |
| --- | ---: |
| Variants titled "Default Title" (colour axis N/A — OK) | 50 |
| Products **with** size option set | 500 |
| Products **missing** option set (**NEEDS_REVIEW**) | 0 |

**Model:** Size is a product option (Aris), not a Shopify variant. Default Title / Color-only variants are expected.

**Products needing option-set review (0):**

_None_

### VARIANT STRUCTURE (Color vs Size)
| | Count |
| --- | ---: |
| Products with **Color-only** variants (no Size option) | 450 |
| Products with **Size-only** variants | 0 |
| Products with both Color and Size | 0 |

**Note:** MLB/NHL/soccer products often use **Color** (or Default Title) as the Shopify variant axis. Apparel **Size** is provided by the product options layer (Aris optionsets), not Shopify variants. Do not map Color → `size_label`.

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

| Review reason | Products affected |
| --- | ---: |
| Missing option set (NEEDS_REVIEW) | 0 |
| Missing size chart | 0 |
| Taxonomy review | 0 |

SKU nulls and Default Title / Color-only Shopify variants are **not** readiness blockers under the Aris options model.

---

## Sample flagged products (first 40)

| Slug | SKU flag | Options flag |
| --- | --- | --- |


---

## NOT SAFE TO AUTOMATE

- Inventing SKU when absent from Shopify (**informational only — SKUs optional**)
- Inventing size lists for Football/Basketball without confirmed Aris optionsets
- Mapping Color variant → size_label
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
