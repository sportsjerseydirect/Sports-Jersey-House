# Database Package

**Status:** Initial schema and migration scaffold created.

PostgreSQL schema, migrations, and typed client via Drizzle ORM.

## Core Entities (Planned)

- `products`, `product_variants`, `product_images`
- `collections`, `collection_products`
- `product_tags`, `product_seo`, `collection_seo`
- `ai_jobs`, `ai_job_results`
- `compliance_flags`
- `creative_assets`
- `migration_runs`, `migration_checkpoints`
- `redirects`
- `users`, `sessions` (admin auth)

## Conventions

- UUID primary keys for public entities
- `shopify_id` stored for migration mapping (not exposed publicly)
- Content lifecycle: `draft` → `review` → `published` → `archived`
- AI fields separated from human-edited fields
- Audit columns on all mutable tables

## Scripts

```bash
pnpm db:generate   # Generate migrations from schema changes
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Planned: Drizzle Studio for local inspection
pnpm db:seed       # Planned: seed development data (no real Shopify data)
```

## Dependencies (Planned)

- `@sjh/shared` — shared Zod schemas and types

## Initial Migration

The first SQL migration is `drizzle/0000_foundation.sql`. It enables `pgvector`, creates full-text search indexes, and adds commerce, SEO, compliance, creative asset, and migration checkpoint tables.
