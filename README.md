# Sports Jersey House

A modern, AI-powered e-commerce platform replacing the existing Shopify storefront.

## Status

**Phase 1 — Runnable foundation.** The monorepo now includes a Next.js storefront/admin shell, typed package boundaries, initial database/search/AI/Shopify abstractions, and safety gates. No Shopify connectivity, no production deployment.

## Documentation

- [Architecture](./docs/architecture.md) — system design, tech stack, and data flow
- [Migration Plan](./docs/migration-plan.md) — Shopify extraction and cutover strategy
- [Agent Guidelines](./AGENTS.md) — rules for AI agents working in this repo

## Repository Structure

```
apps/
  web/          Next.js storefront + admin
  worker/       Background jobs (AI, search, sync)
packages/
  ai/           AI agent modules
  database/     PostgreSQL schema & client
  search/       PostgreSQL full-text search + pgvector abstraction
  shopify/      Shopify extraction (dormant)
  shared/       Shared types & utilities
docs/           Architecture & migration docs
infrastructure/ IaC (future)
```

## Getting Started

1. Copy `.env.example` to `.env` and adjust values for local services.
2. Install dependencies: `pnpm install`
3. Start local infrastructure: `pnpm infra:up`
4. Apply migrations: `pnpm db:migrate`
5. Seed fake dev catalogue data: `pnpm db:seed`
6. Verify pgvector migration: `pnpm db:verify`
7. Start development: `pnpm dev`

The `/products` page reads from PostgreSQL through `packages/search`. Shopify sync remains disabled (`ENABLE_SHOPIFY_SYNC=false`).

### Local routes (after seed)

| Route | Purpose |
|-------|---------|
| `/products` | Full catalogue with sport/league facet filters |
| `/products/[slug]` | Product detail with JSON-LD |
| `/collections` | League collections index (NFL, NBA, NHL) |
| `/collections/[slug]` | Collection product grid |
| `/search?q=` | Full-text search with facet filters |

Re-run `pnpm db:seed` after pulling collection seed changes if products were seeded before collections support was added.

## Important Constraints

- **Do not** commit `.env` or any secrets.
- **Do not** call Shopify APIs until the migration phase is explicitly approved.
- AI-generated content requires human review before publish.

## License

Proprietary — Sports Jersey House. All rights reserved.
