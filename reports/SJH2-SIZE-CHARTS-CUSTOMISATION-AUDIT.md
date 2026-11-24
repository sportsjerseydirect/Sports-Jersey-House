# SJH2 — Size Charts & Customisation Discovery Audit

**Date:** 2026-11-24 (Europe/London)  
**Mode:** Discovery only — no Shopify writes; no SJH / CJS / PT mutations  
**Store under audit:** SJH2 (`sportsjerseyhouse.shop` / `ewciwr-zg.myshopify.com`)  
**SmartSize MCP available in this agent session:** **No** (tool descriptors cached on disk; server not callable here)

---

## 1. Verified store identity

Re-checked via Shopify MCP `get-shop-info` + Admin GraphQL `shop`.

| Field | Value | Match vs brief |
| --- | --- | --- |
| Brand / shop name | **SJH2** | Yes |
| Primary domain | **sportsjerseyhouse.shop** | Yes |
| myshopify | **ewciwr-zg.myshopify.com** | Yes |
| Currency | **USD** | Yes |
| Plan | Basic | — |
| Timezone | Europe/London (IANA); shop UI also reported GMT | — |
| Country | United Kingdom | — |
| Contact email | info@sportsjerseyhouse.com | — |

**Verdict:** Identity matches the verified SJH2 brief. **Do not confuse with** `sportsjerseyhouse.com` (legacy SJH) or other group stores.

**Local project env (read-only keys/domains only — no secrets):**

| Variable | Observed domain / flag | Relevance to SJH2 |
| --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` | `sportsjerseydirect.myshopify.com` (SJD) | **Not SJH2** — monorepo extract client points at SJD |
| `SJH_SHOPIFY_STORE_DOMAIN` | `s4e5h6-0r.myshopify.com` | **Not SJH2** — legacy SJH Shopify |
| `ENABLE_SHOPIFY_SYNC` | `false` | Correct dormancy for write sync |
| `ENABLE_SHOPIFY_SAMPLE_IMPORT` | `true` | Sample import gate for SJD-path tooling |

This checkout’s `@sjh/shopify` package remains a **read-oriented extract/migration** client gated by feature flags. Live SJH2 Admin access used for this audit was the **Shopify MCP / Grok Connector** connection (installed app on SJH2), not the local `.env` client-credentials pair.

---

## 2. Current theme and Shopify integration

### Theme

| Role | Theme | ID | Notes |
| --- | --- | --- | --- |
| **MAIN (published)** | Horizon | `gid://shopify/OnlineStoreTheme/212229587283` | Created 2026-11-16; updated 2026-11-23 |
| Development / unpublished | **None** | — | Only one theme returned |

Horizon product template is stock Horizon structure (`product-information`, media gallery, disclosures). Theme scan found:

- **No** `*size-chart*` / `*size-guide*` merchant assets beyond Horizon utilities (`size-style.liquid`, image `sizes` attrs).
- **No** CJS-style `cjs-size-charts*` or `cjs-jersey-customisation*` assets.
- `assets/product-custom-property.js` is Horizon’s generic character-count helper for custom property inputs — **not** jersey name/number customisation UX.
- `config/settings_data.json` text scan found **no** `smartsize` / `fitting` / `globo` app-embed markers.

### Installed apps (Admin `appInstallations`)

| App | Handle | Notes |
| --- | --- | --- |
| Messaging | `shopify-messaging` | Shopify |
| **SmartSize** | `fitting-rooms` | Installed on SJH2; chart content not readable without SmartSize MCP |
| Shopify Grok Connector App | `shopify-grok-mcp-app` | Enables this session’s Admin GraphQL |

**Globo Product Options** is **not** listed in `appInstallations`, but a remnant Globo option-set product exists (see §7).

### Channels / publications

Online Store, Point of Sale, and Shop channel publications exist (`autoPublish: false` on each).

### Catalogue / media workflows (project vs store)

| Path | What it is | SJH2 linkage |
| --- | --- | --- |
| `packages/shopify` | Gated GraphQL extract → Postgres | Env domain = SJD, not SJH2 |
| `sjh-shopify-catalogue/` | SJH (legacy) catalogue backups / theme pulls | Not SJH2 |
| `catalogues/{sjd,sjh,pt,cjs,hub}` | Multi-store inbox distribution docs | Hub docs list SJD/SJH/PT/CJS — **SJH2 not named** as a distribute target |
| Shopify MCP on SJH2 | Live Admin read used here | Confirmed SJH2 |

**Media:** Sample of 50 products showed product photography only — **0** media alts containing “size chart”. Store Files search for size-chart assets returned **empty**. No dedicated Size Chart page (only Contact + Privacy Choices pages).

---

## 3. Catalogue counts and sport breakdown

| Metric | Count |
| --- | --- |
| All products | **2714** |
| Active | 2711 |
| Draft | 3 |
| Archived | 0 |
| Orders | **0** |
| Collections | **8** |
| Product types (distinct) | mostly empty string; some `Jerseys` |
| Vendors observed | `SJH`, `Primetime Jersyes` (typo), `Sports Jerseys House` |

### By product tag (primary sport signal)

| Tag | Product count |
| --- | --- |
| MLB | 1057 |
| NFL | 832 |
| NHL | 366 |
| NCAAF | 279 |
| Soccer | 130 |
| Retro Soccer | 96 |
| WNBA | 6 |
| NCAAB | 4 |
| Custom | 2483 |
| New Arrival | 93 |
| Untagged for major sports* | 41 |

\*Query excluded NFL/NHL/MLB/NCAAF/Soccer/NCAAB/WNBA/Retro Soccer. Includes the Globo fee product, some national-team SKUs tagged only `Custom`, and at least one untagged NFL-titled jersey.

**Tag sum exceeds 2714** because products can carry multiple tags (e.g. Soccer + Retro Soccer + Custom). Treat tags as **labels**, not a partition.

### Collection membership (incomplete vs tags)

| Collection | Handle | Products in collection |
| --- | --- | --- |
| Shop all | `shop-all` | 2710 |
| NHL Jerseys | `nhl-jerseys` | 114 |
| NHL Hometown Jerseys | `nhl-hometown-jerseys` | 93 |
| NFL Rivalry Jerseys | `nfl-rivalry-jerseys` | 73 |
| NFL Jerseys | `nfl-team-jerseys` | 56 |
| MLB Jerseys | `mlb-jerseys` | 3 |
| NCAAF Jerseys | `ncaaf-jerseys` | 0 |
| Home page | `frontpage` | 0 |

**Gap:** Sport collections are far thinner than tag reality (e.g. 1057 MLB-tagged vs 3 in MLB collection; 279 NCAAF-tagged vs 0 in NCAAF collection). Merchandising collections are not a reliable sport taxonomy for chart mapping.

Other tags present: rivalry tags, `2026 NFL DRAFT`, `globo-product-options`, `option-set-1701797-buttons-1`.

---

## 4. Existing size architecture

### Native variants (dominant)

Most US-sports jerseys use a native Shopify **Size** option with long labels, e.g.:

- Mens: Small → 3XL  
- Womens: Small → XL  
- Youth: Small → XL  

Approximate coverage from Admin counts:

| Signal | Count |
| --- | --- |
| Products with variant title `Mens Small` | 2555 |
| Products with variant title `Womens Small` | 2176 |
| Products with variant title `Youth Small/Medium` | 366 (NHL youth special editions in sample) |

NHL youth specials often use **Youth Small/Medium** and **Youth Large/XL** only (aligns with PT NHL youth table shape).

### Alternate size systems

| Segment | Size labels observed | Notes |
| --- | --- | --- |
| Soccer / Retro Soccer | `S` `M` `L` `XL` `XXL` | Different label language from Mens/Womens/Youth |
| Some soccer | Extra option **Name** with player presets + `No Name` | Customisation encoded as **variant option**, not line-item properties |
| Occasional | `Color` + `Size` | e.g. some MLB |
| Baby/Toddler (`1T`–`7T`) | **0** products matched | Present on PT charts and Desktop size-label spreadsheet, not on live SJH2 variants sampled |

### Apps vs metafields vs charts

| Mechanism | On SJH2? | Evidence |
| --- | --- | --- |
| Native Size variants | **Yes** | Nearly all products |
| Product metafield definitions (PRODUCT owner) | **None** | Empty `metafieldDefinitions` |
| Per-product metafields in sample | SEO `global.title_tag` / `description_tag` only | No size-chart metafields |
| Size chart media on products | **Not found** | Sample + Files search |
| Size Chart page | **No** | Pages list |
| SmartSize app installed | **Yes** | `fitting-rooms` |
| SmartSize theme wiring / charts live | **Unknown / likely not wired** | No embed markers in settings; MCP unavailable to confirm chart inventory on SJH2 |
| Globo option-set remnant | Fee product only | App not in installations |

**Desktop reference (labels only, not measurements):** `/Users/akshay/Desktop/Size Chart - Jersey House.xlsx` lists Man/Youth(/Women/Baby) **size label** matrices for Hockey, Football, Baseball, Basketball collections — useful for option taxonomy, **not** measurement charts.

**Legacy SJH catalogue charts** in `sjh-shopify-catalogue/data/raw/size-charts.json` are a separate inch-based adult set — **not** verified as PT SmartSize source of truth; do not merge into SJH2 without explicit approval.

---

## 5. PT SmartSize chart inventory

### SmartSize MCP status (this session)

| Check | Result |
| --- | --- |
| Dynamic MCP namespace callable | **Missing** (`smartsize` / `user-smartsize` not in available servers) |
| Tool descriptors on disk | Present under Sports-Jersey-House + Primetime project MCP caches (`list_size_charts`, `get_chart_details`, `get_store_overview`, … — 31 tools) |
| Live PT chart pull this run | **Not possible** |

### Authoritative local PT extract (read-only)

Source used: `catalogues/cjs/import/phase8/pt-source/` + `pt-source-index.json`  
Extracted **2026-11-20** via SmartSize MCP against PT (Ritual theme `195095789895`) during CJS Phase 8 — **read-only copy; not re-fetched live today**.

| Chart | SmartSize ID | Tag | Cohorts / tables | Units / notes |
| --- | --- | --- | --- | --- |
| Size Chart - NFL | `cmpcl73u3000a0wqmajsglews` | NFL | Mens (Width/Length); Youth (Width/Length); Baby/Toddler; Women (Width/Length) | Mens marked **cm**; different schema than NCAAF |
| Size Chart - NCAAF | `cmpcmjo0a000v0wqmzfidzgnr` | NCAAF | Mans Chest/LENGHT/US SIZE; Youth S/M & L/XL matrix; Baby/Toddler; Women | Preserve quirks (`LENGHT`, `Babby/Toddler`) |
| Size Chart - NHL | `cmpclvjcs000i0wqmxtibdaxz` | NHL | Man Chest/LENGHT/US SIZE; Youth S/M & L/XL Width/Length; Baby/Toddler; Women | Youth matches SJH2 NHL youth variant labels |
| Size Chart - MLB | `cmpcm118r000m0wqmjre2hdt2` | MLB | Man; Youth; Baby/Toddler; **two** Women tables (conflicting schemas historically) | CJS later corrected Women for college store — SJH2 must not silently merge |

**Missing on PT (confirmed in Phase 8 index):** basketball / NBA / NCAAB — no SmartSize chart.  
**Also missing for SJH2 needs:** Soccer / Retro Soccer / WNBA-specific charts — not present in the PT extract set above.

Spot checks (from archived PT JSON, not invented):

- NHL Man S → Chest 58, LENGHT 78, US SIZE 36 (cm on Chest/LENGHT)  
- NCAAF Man S → Chest 41, LENGHT 30.3, US SIZE 36  
- NFL Mens S → Width 55, Length 76 (cm) — **incompatible** with NCAAF Chest/LENGHT table  
- MLB Man S → Chest 55, LENGHT 76, US SIZE 36  

---

## 6. Proposed sport-to-chart mapping (PT → SJH2)

Planning only — **do not implement**. Do not merge NFL↔NCAAF or invent basketball/soccer.

| SJH2 sport signal | Proposed PT chart | Confidence | Action |
| --- | --- | --- | --- |
| `tag:NFL` (+ rivalry NFL collections) | **Size Chart - NFL** | High | Map 1:1; keep NFL measurements |
| `tag:NCAAF` | **Size Chart - NCAAF** | High | Map 1:1; do **not** use NFL chart |
| `tag:NHL` (+ hometown) | **Size Chart - NHL** | High | Map 1:1; youth S/M & L/XL aligns |
| `tag:MLB` | **Size Chart - MLB** | High | Map 1:1; **HOLD** on which Women table until merchant confirms (PT has dual Women blocks) |
| `tag:Soccer` / `Retro Soccer` / national-team untagged | **None on PT** | Blocked | HOLD — need merchant/PT soccer chart or explicit alternate source |
| `tag:NCAAB` / `WNBA` | **None on PT** | Blocked | HOLD — same gap as CJS basketball; do not invent |
| Untagged / ambiguous (41) | Unknown | Low | Classify before chart attach |
| Fee / internal Globo product | N/A | — | Exclude from chart mapping |

**Label alignment risk:** SJH2 uses `Mens Small` etc.; PT tables use `S`/`M`/`L`. Mapping is by **cohort + ordinal**, not string equality — document the label bridge before storefront UX.

**Collection-based mapping is unsafe** until collections are rebuilt to match tags.

---

## 7. Existing customisation setup

### Desired planning target (context only)

- Optional customisation **$4.99 USD** per jersey once confirmed  
- Name + number fields  
- Line-item properties into orders; supplier instructions  
- **HOLD FOR REVIEW** if properties missing  

### What SJH2 has today

| Capability | Present? | Detail |
| --- | --- | --- |
| Yes/No customisation UX on Horizon | **Not evidenced** | No CJS-style snippet; buy-buttons has no jersey properties |
| Fee product at $4.99 | **Partial remnant** | Product `Do you need any Customization ?` (`option-set-1701797-buttons-1`), variant **Yes @ $4.99 USD**, tags `globo-product-options` |
| Globo app installed | **No** (not in appInstallations) | Remnant product SEO title/description still say “Primetime Jerseys” |
| `Custom` tag | **Yes** (2483) | Marketing/taxonomy signal; does not prove working PDP customisation |
| Name/number as line-item properties | **Not evidenced** | Zero orders to inspect; theme lacks property inputs |
| Name as variant option | **Some soccer** | Player name presets as option values — different model |
| Customer-facing fee disclosure on PDP | **Unconfirmed / likely absent** | No live customisation UI found on MAIN theme |
| Orders with customisation | **None** | `ordersCount = 0` |

### CJS reference only (do not change CJS)

College Jersey Store Phase 7.1 pattern (for comparison):

- YES (+$4.99) / NO  
- Properties: `Customisation`, `Custom Name`, `Custom Number`, `Supplier Production Instruction`, `_cjs_line_key`  
- Separate hidden fee product + line linkage  
- Documented in `catalogues/cjs/reports/PHASE7.1-CUSTOMISATION.md`

SJH2 does **not** currently mirror that theme implementation.

---

## 8. Supplier fulfilment workflow

| Layer | Finding |
| --- | --- |
| SJH2 orders | **0** — no production customisation → PO trail on this store yet |
| Packing slip / supplier snippets on Horizon | **Not found** (no packing-slip customisation assets) |
| Supplier Portal (sibling repo) | Reads Shopify line-item `properties` into `customisation` strings for POs/units |
| Supplier Portal Shopify Store 1 domain | `b1f5ea-84.myshopify.com` (example/env) — **not** `ewciwr-zg.myshopify.com` |
| Outbound Shopify from Supplier Portal | Gated (`SHOPIFY_OUTBOUND_ENABLED` false in examples) |

**Implication:** Even if SJH2 later collects name/number properties, **Supplier Portal is not wired to SJH2** today. Until webhooks/domain mapping exist, customisation will not automatically flow into supplier POs for this store.

Fee visibility to suppliers: with no orders and no packing-slip customisation template on SJH2, **customer fee is not exposed via fulfilment docs on this store** (fee would only appear as a separate line item if Globo/cart add-on were working — currently orphaned).

---

## 9. Risks and gaps

1. **SmartSize MCP unavailable here** — cannot confirm whether SJH2’s installed SmartSize app has charts, drafts, or storefront wiring; PT inventory taken from **archived** Phase 8 extract.  
2. **No customer-facing size charts** on MAIN Horizon (no page, no media, no metafields, no theme hard-code).  
3. **NFL vs NCAAF measurement incompatibility** — must not share one chart.  
4. **Soccer / NCAAB / WNBA** lack PT charts — HOLD.  
5. **MLB dual Women tables** on PT — risk of wrong Women’s guidance if copied blindly.  
6. **Size label mismatch** (`Mens Small` vs `S`) and soccer’s short labels.  
7. **Collections ≠ tags** — chart automation by collection would under-cover MLB/NCAAF badly.  
8. **Customisation gap:** $4.99 Globo remnant without Globo app / without line-item properties / without supplier wiring → **HOLD FOR REVIEW**.  
9. **Some soccer “Name” variants** are a conflicting customisation model vs property-based YES/NO.  
10. **Local monorepo `.env` targets SJD/SJH**, not SJH2 — future automation must not assume this checkout’s Shopify client is SJH2.  
11. **Baby/Toddler** exists on PT charts and Desktop label sheet but not on SJH2 variants counted.  
12. **Vendor typo** `Primetime Jersyes` and PT SEO residue on fee product — data-hygiene noise.

---

## 10. Recommended implementation sequence

Planning sequence only — **no implementation in this pass**.

1. **Re-enable/read SmartSize MCP against PT** (or re-export charts) and, separately, run `get_store_overview` / `list_size_charts` on **SJH2’s** SmartSize install to see if any charts already exist there.  
2. **Freeze sport taxonomy** on SJH2: prefer `tag:` sport labels; rebuild collections to match; quarantine the 41 ambiguous products.  
3. **Approve PT→SJH2 chart map** (§6), including MLB Women table choice and explicit HOLDs for Soccer/NCAAB/WNBA.  
4. **Choose chart delivery mechanism** for SJH2 (SmartSize live on Horizon **or** CJS-style theme hard-code + optional media). Confirm app embed on MAIN before relying on SmartSize.  
5. **Define size-label bridge** (Mens Small ↔ S, Youth Small/Medium ↔ S/M, soccer S–XXL policy). Do not rewrite variants until approved.  
6. **Customisation design decision:** adopt CJS property + fee-line pattern vs revive Globo vs Horizon native custom properties — require **YES/NO, name, number, supplier instruction, $4.99**, and cart/order proof.  
7. **If properties missing after PDP change → HOLD FOR REVIEW** (per brief); do not push supplier fulfilment.  
8. **Wire Supplier Portal** (or equivalent) to `ewciwr-zg.myshopify.com` only after properties are proven on a test order.  
9. **Pilot one sport** (recommend NHL: chart + youth labels already aligned) before rolling NFL/NCAAF/MLB.  
10. **Human QA** on desktop/mobile PDP: size guide accuracy, customisation fee disclosure, order properties, packing slip / PO — then expand.

---

## Appendix A — Sources consulted

- Shopify MCP: `get-shop-info`, read-only `graphql_query` / `graphql_schema`  
- Local: `catalogues/cjs/import/phase8/pt-source/*`, `pt-source-index.json`, CJS Phase 7.1 / 8 reports (reference)  
- Local: Desktop `Size Chart - Jersey House.xlsx` (labels)  
- Local: Sports-Jersey-House `.env.example` + domain flags in `.env` (secrets not reproduced)  
- Local: Supplier Portal Shopify mapper / `.env.example` domains  
- SmartSize tool schemas on disk (not executed)

## Appendix B — Explicit non-actions

No product, theme, media, price, inventory, collection, variant, option, or publish changes were made. SJH, CJS, and PT stores were not written to. No full catalogue sync was run.
