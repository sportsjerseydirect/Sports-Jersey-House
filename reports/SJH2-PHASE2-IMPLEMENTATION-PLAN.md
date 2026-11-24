# SJH2 — Phase 2: Implementation Preparation & Sizing Reconciliation

**Date:** 2026-11-24 (Europe/London)  
**Mode:** Planning only — no Shopify writes; no product/theme/media/publish changes  
**Target (re-verified this turn):** SJH2 — `sportsjerseyhouse.shop` / `ewciwr-zg.myshopify.com` / USD  
**Source audit:** `reports/SJH2-SIZE-CHARTS-CUSTOMISATION-AUDIT.md`  
**SmartSize MCP this session:** **Not callable** (see §1)

---

## 1. SmartSize MCP diagnosis

### What is registered where

| Layer | Finding |
| --- | --- |
| User Cursor Desktop `~/.cursor/mcp.json` | Entry **`smartsize`** present: remote URL host `https://app.smartsize.io/mcp`, auth via `Authorization` header (value **not** logged) |
| Sports-Jersey-House project `.cursor/mcp.json` | Only **playwright** — no SmartSize entry |
| Project MCP tool cache | `…/mcps/user-smartsize/` exists with 31 tool descriptors + `INSTRUCTIONS.md` (Desktop cache of a prior connection) |
| **This Cloud Agent session** | Dynamic namespaces include Shopify, Slack, Gmail, etc. — **no `smartsize` / `user-smartsize`**. `CallDynamicTool` → “MCP server does not exist” |
| Cloud run events | No `mcp_auth_error` for SmartSize on this worker (server simply never attached) |
| SmartSize product model | **Single-store** per API key — no store-domain argument; whichever store the key was issued for is the only store visible |

### Why it is not callable here

1. **Cloud Agent MCP allowlist ≠ Desktop MCP list.** Desktop has SmartSize; this self-hosted/cloud worker’s available MCP catalog does not include it.  
2. **Cached tool schemas ≠ live connection.** The `user-smartsize` folder under `.cursor/projects/…/mcps/` is a Desktop-side descriptor cache, not a running server for this agent.  
3. **Even if Desktop-connected, store binding is ambiguous for SJH2.** SmartSize is installed on SJH2 (`fitting-rooms`), but the Desktop MCP key historically used for PT extracts (Ritual / Primetime) may bind to **PT**, not SJH2. Live access must be validated with `get_store_overview` before trusting any write path.  
4. **This plan does not claim live SmartSize access.**

### Unblock options (human / Desktop — not done here)

| Option | Purpose | Caution |
| --- | --- | --- |
| A. Attach SmartSize MCP to the **Cloud Agent / Project environment** MCP config | Make tools callable in workers | Still one-store-per-key |
| B. Run discovery from **Cursor Desktop** with SmartSize MCP authenticated | Live `list_size_charts` / `get_chart_details` | Confirm storefront = PT vs SJH2 before edits |
| C. Issue a **second SmartSize API key** for SJH2 store | Inspect SJH2 chart inventory / embed wiring | Do not overwrite PT key; do not print secrets |
| D. Continue on **archived PT Phase 8 extract** for measurement source of truth | Enough for NFL/NCAAF/NHL/MLB mapping | Stale risk; Soccer/NCAAB/WNBA still missing |

**Recommendation:** Use **D** for Phase 2 chart mapping (below). Before Phase 3 implementation, complete **B or C** to (1) re-verify PT charts unchanged and (2) inspect SJH2 SmartSize install (charts present? embed on?).

### Is the archived PT Phase 8 extract sufficient?

| Need | Sufficient? | Notes |
| --- | --- | --- |
| Full table content for NFL, NCAAF, NHL, MLB | **Yes** | `catalogues/cjs/import/phase8/pt-source/{nfl,ncaaf,nhl,mlb}.json` + IDs in `pt-source-index.json` (extracted 2026-11-20) |
| Men / Women / Youth / Baby-Toddler cohorts | **Yes** for those four sports | See matrix §2 |
| Soccer / Retro Soccer / NCAAB / WNBA | **No** | Explicitly missing on PT; do not invent |
| Confirm SJH2 SmartSize has charts / embed | **No** | Requires live SJH2-bound MCP or Admin UI |
| Fit quizzes | **Out of scope** for Phase 2 mapping | Not required for chart display |

---

## 2. Final chart mapping matrix (PT extract → SJH2)

**Rule:** Prefer `tag:` sport labels (audit). Do **not** map by thin collections. Do **not** merge NFL↔NCAAF. Preserve PT quirks (`LENGHT`, `Babby/Toddler`).

### 2.1 Reusable charts (AVAILABLE)

| SJH2 tag(s) | Approx. products (audit) | PT chart | PT ID | Men | Women | Youth | Baby/Toddler | Reuse decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NFL` (+ rivalry tags) | 832 | Size Chart - NFL | `cmpcl73u3000a0wqmajsglews` | Width/Length cm — S–3XL | Width/Length — S–2XL | Width/Length cm — S–XL | 1T–7T in | **Reuse as-is** |
| `NCAAF` | 279 | Size Chart - NCAAF | `cmpcmjo0a000v0wqmzfidzgnr` | Chest/LENGHT/US SIZE — S–3XL | Chest/Length/Waist — XS–2XL | Matrix S/M & L/XL | 1T–7T in | **Reuse as-is** (college football only) |
| `NHL` (+ hometown) | 366 | Size Chart - NHL | `cmpclvjcs000i0wqmxtibdaxz` | Chest/LENGHT/US SIZE cm — S–3XL | Chest/Length/Waist — XS–2XL | **S/M & L/XL** Width/Length | 1T–7T in | **Reuse as-is** (youth labels align with SJH2 `Youth Small/Medium` / `Youth Large/XL`) |
| `MLB` | 1057 | Size Chart - MLB | `cmpcm118r000m0wqmjre2hdt2` | Chest/LENGHT/US SIZE — S–3XL | **TWO conflicting Women tables** | Chest/Waist — S–XL | 1T–7T in | **Reuse Men/Youth/Baby**; **HOLD Women** until merchant picks one table |

### 2.2 Label bridge (SJH2 variants ↔ PT table sizes)

SJH2 native options use long labels; PT tables use short codes. Bridge by **cohort + ordinal**, not string equality:

| SJH2 variant label | PT table size (typical) |
| --- | --- |
| Mens Small → Mens 3XL | S → 3XL |
| Womens Small → Womens XL | S → XL (NFL Women); XS→2XL where PT has XS |
| Youth Small → Youth XL | S → XL (NFL/MLB youth) |
| Youth Small/Medium, Youth Large/XL | S/M, L/XL (NHL youth) |
| Soccer `S`–`XXL` | **No PT chart** — unresolved |

Baby/Toddler `1T`–`7T` exist on PT charts but **0** SJH2 products matched in audit — chart sections may still display; do not invent product variants.

### 2.3 Missing sizing data (UNRESOLVED — do not invent)

| SJH2 signal | Count (audit) | Status | Required to resolve |
| --- | --- | --- | --- |
| `Soccer` | 130 | **HOLD** | Merchant- or PT-approved soccer measurement chart |
| `Retro Soccer` | 96 | **HOLD** | Same (may overlap Soccer) |
| National-team / soccer-like with only `Custom` | subset of 41 untagged | **HOLD** | Classify + soccer chart |
| `NCAAB` | 4 | **HOLD** | Same gap as CJS basketball — PT has none |
| `WNBA` | 6 | **HOLD** | No PT chart |
| Ambiguous untagged | 41 | **HOLD** | Manual sport classification before chart attach |

**CJS basketball user-screenshot CM charts are not automatically approved for SJH2** — different store/catalogue; only reuse if merchant explicitly authorises the same measurements for SJH2.

### 2.4 Incompatible / ambiguous mappings

| Pairing | Why blocked |
| --- | --- |
| NFL chart → NCAAF products | Different schemas (Width/Length vs Chest/LENGHT/US SIZE); values diverge (e.g. Mens S) |
| NCAAF chart → NFL products | Inverse of above |
| MLB Women table A vs B | Dual PT blocks: (Chest/Waist/Hip/Sleeve S–XL) vs (Chest/Length/Waist XS–2XL) — CJS later standardised for college; SJH2 needs explicit pick |
| Collection-based attach | MLB collection has 3 products vs 1057 `tag:MLB` — would under-cover |
| Soccer “Name” variant option | Customisation-as-variant conflicts with property-based YES/NO model (§4) |
| Legacy `sjh-shopify-catalogue/data/raw/size-charts.json` | Inch adult set — **not** PT SmartSize SoT; do not merge without approval |

### 2.5 Delivery mechanism (decision needed before Phase 3)

| Option | Pros | Cons |
| --- | --- | --- |
| **A. SmartSize on SJH2** (create/copy charts + product rules + enable embed on Horizon) | Native app already installed; fit quizzes later | Needs SJH2-bound MCP/key; embed currently not evidenced in `settings_data` |
| **B. Theme hard-code** (CJS Phase 8 pattern: `*-size-charts-data.js` + modal) | No runtime SmartSize dependency; exact PT JSON | Theme edits; duplicate maintenance vs PT |
| **C. Hybrid** | SmartSize for NFL/NHL/MLB/NCAAF; HOLD others | Still needs MCP for A |

**Phase 2 recommendation:** Prefer **A** once SJH2 SmartSize MCP is available; fall back to **B** if embed/API blocked. Pilot **NHL** first.

---

## 3. SJH2 credential isolation plan

### Current state (domains only — no secrets)

| Variable family | Domain today | Role |
| --- | --- | --- |
| `SHOPIFY_STORE_DOMAIN` (+ client id/secret) | `sportsjerseydirect.myshopify.com` | SJD extract / sample import path in `@sjh/shopify` |
| `SJH_SHOPIFY_*` | `s4e5h6-0r.myshopify.com` | Legacy SJH Shopify |
| Shopify MCP (Grok Connector) | Connected to **SJH2** | Read/admin via Cursor — not the monorepo env client |
| Supplier Portal `SHOPIFY_STORE_1_*` | `b1f5ea-84.myshopify.com` (example) | Unrelated to SJH2 |

### Proposed dedicated SJH2 variables

Add **new** names — do **not** overwrite SJD/SJH:

```bash
# SJH2 only — never reuse SJD/SJH credentials
SJH2_SHOPIFY_STORE_DOMAIN=ewciwr-zg.myshopify.com
SJH2_SHOPIFY_CLIENT_ID=          # Dev Dashboard app for SJH2 only
SJH2_SHOPIFY_CLIENT_SECRET=      # never commit / never print
ENABLE_SJH2_SHOPIFY_READ=false   # default off
ENABLE_SJH2_SHOPIFY_WRITE=false  # default off — hard gate
```

Optional later (Supplier Portal — separate repo):

```bash
SHOPIFY_STORE_SJH2_DOMAIN=ewciwr-zg.myshopify.com
SHOPIFY_STORE_SJH2_CLIENT_ID=
SHOPIFY_STORE_SJH2_CLIENT_SECRET=
```

### Code / config touchpoints (plan only)

| Location | Change |
| --- | --- |
| `.env.example` | Document `SJH2_SHOPIFY_*` + both enable flags (empty values) |
| `packages/shopify` | Add `parseSjh2ShopifyConfig()` (or parallel client) that reads **only** `SJH2_*`; refuse if domain ≠ `ewciwr-zg.myshopify.com` |
| CLIs / scripts under `catalogues/` for SJH2 | Must call SJH2 parser; abort if `ENABLE_SJH2_SHOPIFY_WRITE` not true for mutations |
| Cursor / agent rules | “Before any SJH2 write: GraphQL `shop { myshopifyDomain name }` must equal `ewciwr-zg.myshopify.com` / SJH2” |
| Secrets storage | Local `.env` (gitignored) and/or Cursor Dashboard secrets — never in reports, commits, or chat |

### Pre-write identity gate (mandatory)

Before any write-capable operation:

1. Load credentials from `SJH2_*` only.  
2. Call Admin `shop { name myshopifyDomain primaryDomain { host } currencyCode }`.  
3. Require: name contains/equals SJH2 intent, `myshopifyDomain === ewciwr-zg.myshopify.com`, primary host `sportsjerseyhouse.shop`, currency `USD`.  
4. On mismatch → **abort**; do not fall back to `SHOPIFY_STORE_DOMAIN` or `SJH_SHOPIFY_*`.

**This phase:** plan only — credentials not created, not printed, no Admin writes.

---

## 4. Customisation architecture (SJH2-specific)

**Reference:** CJS Phase 7.1 (`catalogues/cjs/reports/PHASE7.1-CUSTOMISATION.md`) — patterns adapted; **do not modify CJS**.

### 4.1 Customer UX (Horizon MAIN — future implementation)

| Element | Spec |
| --- | --- |
| Control | YES / NO — “Make this jersey yours” |
| Fee disclosure | YES shows **+$4.99 USD** (store currency) |
| Fields when YES | **Custom Name** (required), **Custom Number** (required) |
| Validation | Name max 20; letters/numbers/spaces/`'`.`-`; Number 1–3 digits; block ATC if YES incomplete |
| YES→NO | Clear fields; reset properties to NO / N/A / as-pictured instruction; remove fee line |

### 4.2 Pricing / fee calculation

| Rule | Behaviour |
| --- | --- |
| Mechanism | Dedicated **fee variant** (real money line item) — not properties-alone for charge |
| Unit price | **$4.99 USD** per customised jersey unit |
| Qty sync | Fee line quantity = sum of quantities of linked YES jersey lines |
| Multi-line | Each jersey line has `_sjh2_line_key`; fee lines carry `_sjh2_fee=customisation` + `_sjh2_for_line_key` |
| Remove jersey | Remove orphan fee lines |
| Cart total | Jerseys + (4.99 × customised unit count) + shipping/tax |

**Globo remnant:** Product `Do you need any Customization ?` / handle `option-set-1701797-buttons-1`, Yes @ $4.99, tags `globo-product-options`. Globo app **not** installed. SEO residue “Primetime Jerseys”.

| Decision | Guidance |
| --- | --- |
| Assume suitable? | **No** — orphaned option-set product without app/UI/property contract |
| Remove now? | **No** (brief: investigate only) |
| Phase 3 | Prefer **new** fee product e.g. handle `sjh2-jersey-customisation-fee`, tags `sjh2-internal-addon`, `hidden`; leave Globo remnant unpublished/orphaned until cleanup ticket |

### 4.3 Line-item properties (jersey)

| Property | YES | NO |
| --- | --- | --- |
| `Customisation` | `YES` | `NO` |
| `Custom Name` | entered | `N/A` |
| `Custom Number` | entered | `N/A` |
| `Supplier Production Instruction` | `CUSTOMISE WITH NAME: … / NUMBER: …` | `SUPPLY AS PICTURED. IF THE IMAGE SHOWS A SAMPLE NAME OR NUMBER 00, SUPPLY A BLANK JERSEY.` |
| `_sjh2_line_key` | UUID | empty / ignored |

Fee line properties: `_sjh2_fee=customisation`, `_sjh2_for_line_key=<uuid>` — **never** show $4.99 on supplier docs.

### 4.4 Persistence path

PDP form → Cart (Ajax Cart / Horizon cart) → Checkout → Order `line_items[].properties` / `customAttributes`.

**HOLD FOR REVIEW:** If after implementation a paid test order lacks the property set on jersey lines (or fee linkage broken), **stop** supplier rollout and flag for review.

### 4.5 Soccer conflict

Some soccer products use a **Name** option (player presets). Phase 3 must either:

- Exclude those SKUs from YES/NO customisation until redesigned, or  
- Migrate Name option → property model (catalogue change — separate approval).

Do not run both models on the same PDP without an explicit product policy.

### 4.6 Theme / asset sketch (files to change later)

Horizon MAIN `212229587283` — **not edited in Phase 2**:

- New: `snippets/sjh2-jersey-customisation.liquid`, `assets/sjh2-jersey-customisation.js`, `assets/sjh2-jersey-customisation.css`  
- Wire into `blocks/buy-buttons.liquid` (or equivalent product form)  
- Load from `layout/theme.liquid`  
- Prefer **unpublished development theme** first (create one; audit found none today)

---

## 5. Supplier workflow design

### 5.1 Actual SJH2 state today

| Fact | Implication |
| --- | --- |
| **0 orders** on SJH2 | No live PO / packing-slip trail to reverse-engineer |
| No packing-slip customisation snippet on store | Admin packing slips would not show name/number yet |
| Supplier Portal Store 1 ≠ `ewciwr-zg` | Portal does **not** ingest SJH2 webhooks today |
| CJS used a **manual batch consolidator** script + rejected multi-order Shopify packing slips for fee suppression | Do not assume CJS PO generator is SJH2’s architecture |

### 5.2 Recommended SJH2 integration points (choose by ops model)

**Path A — Shopify packing slip (single-order admin)**  
- Paste SJH2-adapted Liquid (from CJS packing-slip snippet pattern) into **Admin → Shipping → Packing slip template**.  
- Skip fee lines via `_sjh2_fee`.  
- Print Customisation / Name / Number / Supplier Production Instruction.  
- **Limitation:** per-fulfilment; fee-only fulfilments can still produce empty docs — same CJS finding.

**Path B — Operational consolidator (CJS-like script, SJH2-branded)**  
- Read-only Admin GraphQL against **SJH2 credentials only**.  
- Merchant selects order names for a supplier batch.  
- Output HTML/PDF/CSV: jersey lines only; **exclude** fee lines; **no prices**; show size + customisation instruction.  
- Do **not** copy `generate-cjs-supplier-po.mjs` verbatim — fork as `generate-sjh2-supplier-po.mjs` with SJH2 property names and identity gate.

**Path C — Supplier Portal multi-store**  
- Add SJH2 as a second store record + `SHOPIFY_STORE_SJH2_*`.  
- Webhook HMAC with SJH2 app secret; map `properties` → `customisation` string (existing mapper already concatenates properties).  
- Filter fee lines on ingest (`_sjh2_fee`).  
- Requires portal engineering in the **Supplier Portal** repo — out of band from SJH2 theme work.

**Phase 2 recommendation:** Implement **PDP→order properties first** (Path-agnostic). For v1 supplier docs, use **Path A + Path B**; schedule **Path C** only if ops commits to Portal as system of record for SJH2.

### 5.3 Fee suppression rules

- Never print `$4.99` / fee title on supplier-facing HTML/PDF/CSV/packing slips.  
- Drop lines where `_sjh2_fee == customisation` or handle/SKU matches fee product.  
- Customer receipts/checkout may show the fee normally.

---

## 6. Files and components to change (future phases)

### 6.1 This repo (Sports-Jersey-House)

| Area | Candidates |
| --- | --- |
| Docs / reports | ✅ This file; discovery audit already exists |
| Env templates | `.env.example` — `SJH2_SHOPIFY_*` |
| Shopify package | `packages/shopify/src` — SJH2 config parser + identity gate |
| Catalogue scripts | `catalogues/sjh2/` (new) — chart deploy / PO generator / theme assets mirrors |
| Theme payload (when approved) | Horizon snippets/assets listed in §4.6 |
| Hub distribution | Optional later: add `sjh2` channel to multi-store docs — not required for sizing/customisation |

### 6.2 Outside this repo

| Area | Candidates |
| --- | --- |
| Cursor MCP / Cloud Agent env | Attach SmartSize (PT and/or SJH2 keys) for live chart ops |
| Shopify Admin SJH2 | Fee product, SmartSize charts/rules/embed, packing slip template, (optional) dev theme |
| Supplier Portal | Multi-store SJH2 credentials + webhook — only if Path C chosen |

### 6.3 Explicit non-touch

SJH (`sportsjerseyhouse.com` / `s4e5h6-0r`), SJD, PT, CJS stores and their credentials — **no changes**.

---

## 7. Testing and rollout sequence

1. **Unblock SmartSize (human):** Desktop or Cloud MCP with known store binding; `get_store_overview` on PT then SJH2.  
2. **Freeze mapping approvals:** Merchant signs off §2 matrix + MLB Women table choice; Soccer/NCAAB/WNBA remain HOLD.  
3. **Credential isolation:** Add `SJH2_*` to local env; implement identity gate; dry-run `shop` query only.  
4. **Development theme:** Create unpublished Horizon copy on SJH2; implement customisation snippet + fee product (leave Globo remnant).  
5. **Test order #1:** YES + qty 2 → fee qty 2, properties present; YES→NO clears fee; multi-line keys correct.  
6. **HOLD FOR REVIEW gate:** If properties missing on order → stop.  
7. **Supplier doc dry-run:** Packing slip snippet and/or consolidator PDF — fee suppressed; instructions visible.  
8. **Size charts pilot:** NHL only (SmartSize or theme hard-code); QA Men/Women/Youth.  
9. **Expand charts:** NFL, NCAAF, MLB (after Women decision).  
10. **Publish gates:** Dev theme → MAIN only after PDP/cart/checkout/order/supplier QA sign-off; Soccer/NCAAB/WNBA still HOLD until measurements exist.

---

## 8. Blockers summary

| Blocker | Owner | Blocks |
| --- | --- | --- |
| SmartSize MCP not on Cloud Agent | Platform / human MCP config | Live PT re-pull; SJH2 chart inventory |
| Soccer / NCAAB / WNBA measurements absent | Merchant / PT | Chart coverage for those tags |
| MLB Women dual tables | Merchant pick | Correct Women’s MLB guidance |
| SJH2-dedicated Admin API credentials not provisioned in monorepo | Merchant / eng | Scripted theme/chart/fee work outside Shopify MCP |
| Supplier process for SJH2 undefined (0 orders) | Ops | Path A vs B vs C choice |
| Soccer Name-as-variant conflict | Catalogue policy | Uniform customisation UX |

---

## Appendix — Sources

- `reports/SJH2-SIZE-CHARTS-CUSTOMISATION-AUDIT.md`  
- `catalogues/cjs/import/phase8/pt-source/*`, `pt-source-index.json`  
- `catalogues/cjs/reports/PHASE7.1-CUSTOMISATION.md`, `PHASE7.1-CONSOLIDATED-SUPPLIER-PO.md`, packing-slip snippet  
- Desktop `~/.cursor/mcp.json` structure (SmartSize URL host only)  
- Cloud Agent dynamic MCP catalog (SmartSize absent)  
- Shopify MCP `get-shop-info` re-check this turn  
- Supplier Portal README / Store 1 env pattern (sibling repo, read-only)

## Appendix — Explicit non-actions this phase

No Shopify writes. No product, variant, price, inventory, collection, media, theme, or publish changes. No credential values printed. No CI/`anon` migration fixes. No modifications to SJH, CJS, PT, or SJD.
