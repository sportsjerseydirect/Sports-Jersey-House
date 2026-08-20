# Architecture

> **Status:** Phase 1 — Runnable foundation (implemented). This document reflects the **real** codebase, not a proposal.

## Executive Summary

Sports Jersey House is a headless e-commerce platform built as a **pnpm + Turborepo monorepo**. The customer-facing storefront and admin shell live in `apps/web`. Background processing is scaffolded in `apps/worker`. Shared packages provide database access, search, AI contracts, and a gated Shopify extraction client.

PostgreSQL (via Supabase in production, Docker locally) is the system of record and initial search engine (full-text + pgvector). Redis and BullMQ are dependencies for future workers. S3-compatible storage is planned for media.

Shopify (Sports Jersey Direct) remains **read-only** during migration. All API access is gated behind `ENABLE_SHOPIFY_SYNC=false` by default.

---

## System Diagram (Current)

```mermaid
flowchart TB
    subgraph clients [Clients]
        Browser[Browser]
    end

    subgraph apps [Applications]
        Web[apps/web — Next.js 15]
        Worker[apps/worker — job scaffold]
    end

    subgraph packages [Packages]
        Search[packages/search]
        DB[packages/database]
        Shopify[packages/shopify]
        AI[packages/ai]
        Shared[packages/shared]
    end

    subgraph data [Data — Local / Supabase]
        PG[(PostgreSQL + pgvector)]
        Redis[(Redis — not wired)]
    end

    Browser --> Web
    Web --> Search
    Search --> DB
    DB --> PG
    Worker -.-> Shopify
    Worker -.-> DB
    Shopify -.->|when enabled| ShopifyAPI[Shopify Admin API]
```

---

## Monorepo Layout

| Path | Status | Purpose |
|------|--------|---------|
| `apps/web` | **Live** | Storefront, admin dashboard shell, SEO, health API |
| `apps/worker` | **Partial** | BullMQ product/collection extract workers + CLIs |
| `packages/database` | **Live** | Drizzle schema, migrations `0000`+`0001` (carts), seed, verify |
| `packages/search` | **Live** | Postgres FTS provider + empty fallback |
| `packages/shopify` | **Partial** | Client-credentials auth; product + collection extract/load (gated) |
| `packages/ai` | **Partial** | Provider interface, OpenAI provider, disabled fallback, brand brief |
| `packages/shared` | **Live** | Zod schemas, migration checkpoint types |

---

## Web Application (`apps/web`)

**Framework:** Next.js 15 App Router, React 19, plain CSS design tokens (no Tailwind yet).

### Implemented routes

| Route | Rendering | Notes |
|-------|-----------|-------|
| `/` | `force-dynamic` | Homepage with live collections / featured products |
| `/products` | `force-dynamic` | PLP with sport/league facets |
| `/products/[slug]` | ISR (`revalidate=3600`) | PDP + Product/Breadcrumb JSON-LD |
| `/collections` | ISR | Collection index |
| `/collections/[slug]` | ISR (`revalidate=3600`) | Collection PLP |
| `/search` | `force-dynamic` | Full-text search |
| `/cart` | `force-dynamic` | Session cart with qty controls |
| `/admin` | `force-dynamic` | Status dashboard; auth only when `ADMIN_PASSWORD` set |
| `/api/health` | Dynamic | JSON health (pings Postgres) |
| `/api/cart/*` | Dynamic | Guest cart API |
| `/sitemap.xml` | Dynamic | From published slugs |
| `/robots.txt` | Static config | Allows crawl, references sitemap |

### Design system (current)

CSS custom properties in `globals.css`: `--ink`, `--muted`, `--soft`, `--ember`, `--field`, `--gold`, `--radius`. Components: `BrandMark`, `ProductGrid`, `FacetNav`. Premium aesthetic with sticky blurred header and jersey-card hero — original SJH identity, not Apple copy.

### Data access pattern

Catalogue reads go through `packages/search` → `PostgresSearchProvider` or `EmptySearchProvider`. **Exception:** guest cart uses `@sjh/database` directly (`apps/web/src/lib/cart.ts`).

---

## Database (`packages/database`)

### Migration: `0000_foundation.sql`

**Extensions:** `uuid-ossp`, `vector`

**Tables (12+):** `products`, `product_variants`, `product_images`, `collections`, `collection_products`, `seo_records`, `compliance_flags`, `creative_assets`, `migration_runs`, `migration_checkpoints`, `carts`, `cart_items`, `redirects`

**Generated column:** `products.search_vector` (tsvector) exists in SQL only — not in Drizzle schema (see `docs/DECISIONS.md`).

**Dev seed:** 8 products, 4 collections (NFL, NBA, NHL, Soccer, MLB) via `pnpm db:seed`.

### Planned tables (not migrated yet)

`product_tags`, `orders`, `order_items`, `customers`, `ai_jobs`, `users/sessions`

---

## Search (`packages/search`)

| Feature | Status |
|---------|--------|
| Provider abstraction (`SearchProvider`) | Done |
| PostgreSQL full-text search | Done |
| Facets (sport, league) | Done |
| Filters (team, price, availableOnly) | Done |
| pgvector / semantic | Column exists; no embedding jobs |
| Hybrid reranking | Not started |
| Pagination cursor | Type exists; not populated |

---

## Shopify (`packages/shopify`)

| Component | Status |
|-----------|--------|
| Client-credentials token exchange | Done |
| `ENABLE_SHOPIFY_SYNC` safety gate | Done |
| Paginated products GraphQL query | Done (variants + images) |
| Shopify → internal mapper | Done |
| Per-product upsert loader | Done |
| Resumable page extraction | Done |
| Collections / redirects extract | Not started |

Auth uses **only** `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`. No permanent access token env var.

---

## AI (`packages/ai`)

Contracts only: `AiProvider`, `DisabledAiProvider`, `SeoAgent` interface, `createComplianceResult()`, `createInitialBrandBrief()`. No OpenAI/Anthropic providers, no prompt templates, no streaming chat API.

Feature flag `ENABLE_AI_SHOPPING_ASSISTANT` is parsed in web env and shown on admin page.

---

## Worker (`apps/worker`)

Queue names defined. CLI runner for one-page Shopify product extraction. BullMQ processor wiring is scaffolded but requires `REDIS_URL` to run continuously.

---

## Security (Current)

- Secrets via environment variables only
- Shopify credentials server-side only
- Admin routes gated by middleware; `ADMIN_PASSWORD` required in production
- Session cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production
- Best-effort rate limits on cart writes and admin login
- `/admin`, `/cart`, `/checkout`, `/api/` disallowed in `robots.txt`
---

## Deployment Target

| Layer | Target |
|-------|--------|
| Web | Vercel — production at [sports-jersey-house.vercel.app](https://sports-jersey-house.vercel.app) |
| Database / Auth / Storage | Supabase (`vergndtgsrqaqvsjtbds`, `us-west-2`) |
| Source | Private GitHub `sportsjerseydirect/Sports-Jersey-House` |
| Workers | Vercel cron or separate Node process (TBD) |
| CDN | Vercel Edge / Supabase storage CDN |

See `docs/DEPLOY.md` and `docs/SETUP.md`.

---

## Performance Notes

Catalogue index routes use `force-dynamic` where freshness matters. Product and collection detail pages use ISR (`revalidate = 3600`). Sitemap and builds degrade gracefully when the database is unreachable.

---

## Related Documents

- [ROADMAP.md](./ROADMAP.md) — phased delivery plan
- [SETUP.md](./SETUP.md) — local development
- [DEPLOY.md](./DEPLOY.md) — GitHub + Vercel
- [DECISIONS.md](./DECISIONS.md) — architecture decision log
- [migration-plan.md](./migration-plan.md) — Shopify cutover strategy
