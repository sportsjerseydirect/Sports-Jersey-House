# Roadmap

> Living roadmap aligned with the **current** codebase. Updated as phases complete.

## Phase 0 — Foundation ✅ Complete

- [x] Monorepo scaffold (pnpm, Turborepo, TypeScript strict)
- [x] Package boundaries (`web`, `worker`, `database`, `search`, `shopify`, `ai`, `shared`)
- [x] Docker Compose (Postgres + pgvector, Redis, MinIO)
- [x] Foundation migration + dev seed
- [x] CI (lint, test, build)
- [x] Documentation audit

## Phase 1 — Runnable Catalogue ✅ In Progress

**Goal:** Browse a real local catalogue with search, collections, SEO, and admin visibility.

- [x] Postgres search provider + empty fallback
- [x] Storefront: home, products, PDP, collections, search
- [x] SEO: metadata, JSON-LD, sitemap, robots
- [x] Admin status dashboard
- [x] Health API
- [x] Shopify client-credentials auth (gated)
- [x] Shopify product extract + upsert pipeline (one page at a time)
- [x] Worker CLI for extraction
- [x] CI Postgres service + integration tests
- [x] Admin auth scaffold (optional — open in dev when `ADMIN_PASSWORD` unset)
- [x] ISR for product/collection detail pages (`revalidate = 3600`)
- [x] Session cart (PostgreSQL + API routes + header count)

## Phase 2 — Shopify Migration (Extract & Load)

**Goal:** Load ~8,876 products from Sports Jersey Direct into PostgreSQL as `draft`.

**Prerequisites:** Shopify credentials + explicit `ENABLE_SHOPIFY_SYNC=true` approval.

- [x] Resumable checkpoint model (`migration_runs`, `migration_checkpoints`)
- [x] Product page extraction (100 products/page, individual upserts)
- [x] Full bulk extract runner (all pages, rate-limit aware)
- [x] Collections extract + membership (CLI + BullMQ worker; gated)
- [ ] Redirects extract
- [x] Redirects table + 301/302 serving on 404 (`0004_redirects`)
- [ ] Media download to object storage (not hotlink Shopify CDN)
- [ ] Migration verification reports (counts, sample audit)
- [x] Staging deploy on Vercel + Supabase (project linked; schema applied; production URL live)

## Phase 3 — AI Enrichment

**Goal:** AI-assisted catalogue quality with human approval gates.

- [x] OpenAI provider in `packages/ai`
- [ ] Product SEO agent (draft titles, meta, alt text)
- [ ] Collection SEO agent
- [ ] Product tagging / taxonomy agent
- [ ] Compliance risk scanner
- [ ] AI job framework in worker (async, retryable, auditable)
- [ ] Admin review queue for AI outputs

## Phase 4 — Customer Experience

**Goal:** Premium shopping experience with AI assistance.

- [x] Design system foundation (tokens, logo concepts, footer, favicon)
- [x] Guest cart (session cookie) — Stripe checkout still deferred
- [ ] Checkout (Stripe)
- [ ] Customer accounts (Supabase Auth)
- [ ] AI shopping assistant (grounded in catalogue data)
- [ ] Semantic search (pgvector embeddings)
- [ ] Natural-language search ("orange NFL jerseys under £50")

## Phase 5 — Production Cutover

**Goal:** Replace Shopify storefront at sportsjerseyhouse.com.

- [ ] Parallel run on staging
- [ ] Redirect map (301s)
- [ ] Performance / Lighthouse audit
- [ ] DNS cutover
- [ ] Post-cutover monitoring
- [ ] Shopify decommission (separate checkout decision)

---

## Current Focus

**Staging is live** (Vercel + Supabase seed catalogue). Next:

1. Keep deploy config and docs in sync with GitHub (`main`)
2. Harden production ops (admin password, rate limits) — in progress
3. Shopify client-credentials extract only when approved + `ENABLE_SHOPIFY_SYNC=true`
4. Redirects schema + 301 middleware before full catalogue load
5. AI enrichment agents behind approval queues

Supabase schema + RLS + 8-product/5-collection seed are applied. Production health: `/api/health`.

---

## Explicitly Deferred

- Payment processing (Stripe) — after catalogue load
- Order migration — business decision required
- Dedicated search engine (Meilisearch/Algolia) — only if PostgreSQL limits hit
- Multi-locale — single locale first
