# Commerce Platform Plan — Sports Jersey House

> Status: **Active**. Extends the live catalogue/cart foundation without replacing Supabase, Vercel, GitHub, or the existing schema. Sports Jersey Direct is a **functional** reference only (customisation, size charts, shipping expectations, issue/replacement posture)—not a visual template.

## Current baseline (inspected)

| Layer | Present today | Gap |
|-------|---------------|-----|
| Catalogue | Products, variants, images, collections, FTS, RLS read policies | No care copy, FAQs, compare-at price, size charts, customisation config |
| Cart | Session carts / cart_items | No size picker UX, no customisation on lines, unique(cart, variant) blocks distinct customisations |
| Checkout | Review shell, Stripe CTA disabled | No orders, payments, addresses |
| Ops | Admin status dashboard | No suppliers, POs, tracking, issues, margins, AI ops tools |
| Live DB | Migrations `0000`–`0004` on Supabase `vergndtgsrqaqvsjtbds` | Commerce domains absent |

## Functional reference (Sports Jersey Direct)

Observed / documented behaviours to **improve upon**, not clone:

1. **Customisation** — name / number personalisation on eligible jerseys; clear that items are made-to-order.
2. **Size charts** — sport-specific guides linked from PDP.
3. **PDP content** — description, care, shipping expectations, quality/assurance, FAQs, multi-image where available.
4. **Fulfilment story** — production lead time + tracked shipping; tracking may lag after dispatch.
5. **Issue posture** — quality/lost-shipment replacement rather than open returns/exchanges.

SJH architecture improvements vs reference:

- First-class customisation model (modes, pricing, validation, line permanence).
- Explicit **Issue & Replacement** case system (not a returns portal).
- Supplier/PO/packing-slip and courier-rule engines designed for AI-assisted ops with confirmations.
- Cost/margin ledger linked from sell-side through supplier invoices.

---

## Phased delivery

### Phase 1 — Data model & backend foundation ✅ Complete

**Goal:** Schema + typed clients + RLS lockdown for commerce domains. No Stripe. Minimal storefront change (cart line shape ready for customisation).

Deliverables:

- Product commerce fields (care, shipping expectations, FAQs, customisation eligibility, compare-at price).
- Size charts + product linkage.
- Customisation profiles/options + pricing rules.
- Cart line customisation payload + fingerprint uniqueness.
- Customers (guest-capable).
- Orders / order_items (status machine, address JSON, money snapshots, customisation snapshot).
- Suppliers + product–supplier mappings (cost/SKU placeholders).
- Purchase orders + lines (PO number sequence).
- Courier rules (configurable pattern → courier).
- Issue cases (replacement framework skeleton).
- Marketing capture tables (leads, subscribers) — schema only.
- Shared Zod types; Drizzle models; verify migration checks; seed size charts + default customisation profile for seed catalogue.

**Exit criteria:** Migrations applied locally + Supabase; `pnpm db:verify` / typecheck green; existing storefront still works; no production email/payment behaviour.

**Done:** `0005_commerce_foundation` applied to live Supabase (`vergndtgsrqaqvsjtbds`). Verify OK — 5 size charts, 1 customisation profile, all 8 seed products linked; commerce tables + cart customisation columns present.

---

### Phase 2 — Product & customisation experience ✅ Complete

**Goal:** Mobile-first PDP that sells customisable jerseys.

- Interactive size selection (required).
- Customisation modes: none / name / number / name+number / message (where enabled).
- Live price (base + customisation; compare-at when set).
- Image gallery; size chart modal; care / shipping / FAQs / related products.
- Sticky ATC with validation (size + required customisation fields).
- Cart lines show customisation summary; distinct lines for distinct customisations.

**Exit criteria:** Local + production PDP flows validated with seed catalogue; no incomplete ATC.

**Done:** Live on https://sports-jersey-house.vercel.app — PDP shows size picker, customisation pricing, size guide, shipping/care/FAQs, related products; health OK.

---

### Phase 3 — Checkout & order management ✅ Complete (Stripe deferred)

**Goal:** Create real orders (Stripe when credentials approved).

- Checkout addresses, tax/shipping placeholders, order creation.
- Order emails (confirmation) when email provider configured.
- Admin order list/detail (read + status updates).
- Abandoned cart/checkout events written for later marketing.

**Gate:** Stripe keys + explicit approval before live charges.

**Done:** Guest checkout places `pending_payment` orders with customisation on lines; `/orders/[orderNumber]` confirmation; `/admin/orders` read-only list/detail; abandoned checkout drafts. No Stripe charges and no outbound email yet.

---

### Phase 4 — Supplier / PO / packing slips ✅

**Goal:** Batch supplier submissions.

- Supplier CRUD; product mappings; costs.
- Daily batch job: previous day’s unsent lines → unique PO per supplier.
- Packing slip document generation (supplier format templates).
- Supplier email **preview**; send only after confirmation (or approved automation flag).

**Repo status:** Admin supplier bootstrap + CRUD, PO batch (pending_payment|paid → PO), default_html packing slip + email draft preview (no send).

---

### Phase 5 — Tracking automation ✅

**Goal:** Configurable courier matching + AI-assisted paste ingest.

- Admin courier rules (regex/prefix → courier) — **no hard-coded permanent examples in code**.
- Tracking ingest API; order matching; exception list.
- Shipping/tracking customer emails when configured.

**Repo status:** Courier rule CRUD, paste ingest (`ORDER TRACKING` / `ORDER|TRACKING`), order/customer tracking display, shipping email **draft** only (no send).

---

### Phase 6 — Costs & margins ✅

**Goal:** Line-level P&L.

- Sell / discount / shipping revenue / fees / supplier / fulfilment / customisation / other costs.
- Gross profit + margin %.
- Link PO/invoice costs to order lines.

**Repo status:** Margin report + detail, admin cost editor, apply mapped supplier unit costs from product mappings.

---

### Phase 7 — Issue & replacement ✅

**Goal:** Replace “returns” with operational cases.

- Case types: wrong item, defect, damaged, lost, missing, supplier error, customer issue, goodwill.
- Evidence, notes, decision, replacement order link, cost, supplier responsibility, resolution.

**Repo status:** Admin issue create/list/detail, status workflow, replacement order link + cost, source order marked `issue`.

---

### Phase 8 — AI operations assistant ✅

**Goal:** Natural-language ops with permissions.

- Tool contracts for: tracking paste, PO create, ageing queries, supplier chase email **draft**, replacement create, margin reports.
- Preview + confirmation for high-risk actions; audit log; never blind destructive execution.

**Repo status:** Deterministic intent parser in `@sjh/ai`, audited preview/confirm/reject in `ai_action_audits`, admin `/admin/ai-ops` console (emails never auto-sent).

---

### Phase 9 — Marketing & lifecycle ✅

**Goal:** Capture and nurture tied to customer/order data.

- First-visit 10% email capture (configurable).
- Abandoned cart/checkout workflows.
- Segmentation + campaigns; order/shipping/replacement/supplier email templates.
- Integrated with customers/orders—not a silo.

**Repo status:** Welcome popup → `marketing_leads` + `email_subscribers`, admin marketing desk (leads/subscribers/abandoned + draft abandoned emails). Outbound send still gated.

---

### Ops hardening & catalogue intelligence foundation

**Goal:** Harden day-to-day ops and add a human-gated catalogue intelligence layer without enabling Stripe, outbound email, or live Shopify sync.

- Tracking exceptions queue (resolve/ignore); issue case evidence URLs/notes.
- Ops job runs with dry-run default (`OPS_JOBS_DRY_RUN`); worker queues for PO batch, tracking request/check, exception detection, margin refresh — **external send remains disabled**.
- Catalogue signals + proposals + review queue (approve/reject only; never auto-publish/delete).
- Shopify connection health + dry-run/sample import staging (sync still gated behind `ENABLE_SHOPIFY_SYNC`).
- AI ops V2 tool definitions (`parseOpsIntentV2`); prepare_* tools stay preview-only.

**Repo status:** Migration `0006_ops_catalogue_intelligence`; admin surfaces under `/admin/jobs`, `/admin/catalogue`, `/admin/migration`, `/admin/tracking/exceptions`.

---

## Cross-cutting rules

1. **Do not** reset Supabase/Vercel/GitHub or invent Shopify/Stripe secrets.
2. AI content that affects published catalogue still requires approval states.
3. Production deploys, outbound email, financial mutations, and live payment require **explicit confirmation**.
4. After each phase: local tests → migrate Supabase → smoke production → then next phase.
5. Prefer extending `packages/database`, `packages/shared`, `apps/web`, `apps/worker`, `packages/ai`.

## Migration numbering

| ID | Scope |
|----|--------|
| `0000`–`0004` | Existing foundation (live) |
| `0005_commerce_foundation` | Phase 1 schema (this plan) |
| `0006_ops_catalogue_intelligence` | Ops jobs, tracking exceptions, catalogue proposals, Shopify import staging |
| Later | Phase-specific additive migrations only |

## Open decisions (do not block Phase 1)

- Stripe vs alternative checkout processor (Phase 3).
- Default production SLA copy (days) for shipping expectations.
- Primary supplier regions / packing-slip PDF vs HTML.
- Email provider (Resend/Postmark/etc.).
