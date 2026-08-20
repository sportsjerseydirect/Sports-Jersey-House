# Architecture Decision Log

Record of significant technical decisions. Most recent first.

---

## ADR-001: Monorepo with pnpm + Turborepo

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Need shared types between storefront, workers, and packages without publish cycles.

**Decision:** Single repo with `apps/*` and `packages/*`, orchestrated by Turborepo.

**Consequences:** Fast local DX, shared TypeScript config, workspace protocol imports (`@sjh/*`).

---

## ADR-002: PostgreSQL as initial search engine

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** ~8,876 products; avoid operational complexity of a dedicated search engine at launch.

**Decision:** PostgreSQL full-text search + pgvector behind `SearchProvider` abstraction in `packages/search`.

**Consequences:** Fewer services; can add Meilisearch/Algolia later without rewriting callers.

---

## ADR-003: Shopify client-credentials auth only

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Modern Shopify apps use temporary tokens via client credentials, not permanent access tokens in env.

**Decision:** Use only `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`. Never introduce `SHOPIFY_ACCESS_TOKEN`.

**Consequences:** Tokens refreshed server-side; no long-lived secrets in env beyond client secret.

---

## ADR-004: ENABLE_SHOPIFY_SYNC safety gate

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Sports Jersey Direct Shopify store is production infrastructure.

**Decision:** All Shopify API calls throw `ShopifySyncDisabledError` unless `ENABLE_SHOPIFY_SYNC=true`.

**Consequences:** Safe local/staging development without accidental API calls.

---

## ADR-005: search_vector as SQL-generated column

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Drizzle ORM does not fully model PostgreSQL `GENERATED ALWAYS AS ... STORED` columns.

**Decision:** Define `products.search_vector` in raw SQL migration (`0000_foundation.sql`) only. Search queries reference it via raw SQL in `PostgresSearchProvider`. Do not add to Drizzle schema to avoid migration drift from `db:generate`.

**Consequences:** Manual coordination when changing search vector definition; documented here.

---

## ADR-006: Web reads via search package, not database directly

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Future search backend swap should not require storefront changes.

**Decision:** `apps/web` depends on `@sjh/search`, not `@sjh/database`.

**Consequences:** Clean boundary; admin write paths will use database directly when implemented.

---

## ADR-007: Plain CSS design tokens (no Tailwind yet)

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** Early scaffold used custom CSS with design tokens. Tailwind was in architecture proposal but not implemented.

**Decision:** Continue with CSS custom properties and semantic class names until design system stabilizes. Revisit Tailwind when component library grows.

**Consequences:** Smaller bundle now; may migrate to Tailwind or CSS modules later.

---

## ADR-008: Supabase for production PostgreSQL

**Date:** 2026-08-19  
**Status:** Accepted (connected — project `vergndtgsrqaqvsjtbds`)

**Context:** User approved stack includes Supabase for PostgreSQL/auth/storage.

**Decision:** Local Docker Postgres for dev; Supabase PostgreSQL for staging/production. Same Drizzle schema/migrations.

**Consequences:** Need Supabase credentials when deploying; pgvector must be enabled on project.

---

## ADR-009: Vercel for web hosting

**Date:** 2026-08-19  
**Status:** Accepted (deployed — https://sports-jersey-house.vercel.app)

**Decision:** Deploy `apps/web` to Vercel. Workers may run as Vercel cron or separate process.

**Consequences:** Environment variables via Vercel dashboard; Next.js 15 native support.

---

## ADR-010: Per-product upsert during Shopify migration

**Date:** 2026-08-19  
**Status:** Accepted

**Context:** ~8,876 products must not load in a single database transaction.

**Decision:** Extract 100 products per API page; upsert each product (with variants/images) in its own transaction. Checkpoint cursor after each page.

**Consequences:** Resumable, idempotent, observable migration; slower but safe.

---

## ADR-011: AI content requires human approval

**Date:** 2026-08-19  
**Status:** Accepted

**Decision:** AI-generated SEO, copy, and compliance-sensitive content uses `approval_status` workflow. Never auto-publish to live catalogue.

**Consequences:** Admin review queue required before Phase 3 outputs go live.

---

## Open Decisions (Require Stakeholder Input)

| Topic | Options | Impact |
|-------|---------|--------|
| Checkout | Stripe custom vs keep Shopify checkout temporarily | High — separate workstream |
| URL slugs | Strict 1:1 with Shopify vs intentional changes | SEO |
| Order history | Migrate vs new platform only | Customer experience |
| Smart collections | Replicate Shopify rules vs simplified taxonomy | Merchandising |
