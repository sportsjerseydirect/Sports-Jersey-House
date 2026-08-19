# Database Package

**Status:** Not scaffolded — awaiting architecture approval.

PostgreSQL schema, migrations, and typed client via Drizzle ORM.

## Core Entities (Planned)

- `products`, `product_variants`, `product_images`
- `collections`, `collection_products`
- `product_tags`, `product_seo`, `collection_seo`
- `ai_jobs`, `ai_job_results`
- `compliance_flags`
- `redirects`
- `users`, `sessions` (admin auth)

## Conventions

- UUID primary keys for public entities
- `shopify_id` stored for migration mapping (not exposed publicly)
- Content lifecycle: `draft` → `review` → `published` → `archived`
- AI fields separated from human-edited fields
- Audit columns on all mutable tables

## Scripts (Planned)

```bash
pnpm db:generate   # Generate migrations from schema changes
pnpm db:migrate    # Apply migrations
pnpm db:studio     # Drizzle Studio for local inspection
pnpm db:seed       # Seed development data (no real Shopify data)
```

## Dependencies (Planned)

- `@sjh/shared` — shared Zod schemas and types
