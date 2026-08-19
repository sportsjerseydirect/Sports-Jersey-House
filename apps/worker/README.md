# Worker Application

**Status:** Not scaffolded — awaiting architecture approval.

Background job processor powered by BullMQ and Redis.

## Planned Job Queues

| Queue | Purpose |
|-------|---------|
| `ai:product-seo` | Generate product SEO metadata |
| `ai:collection-seo` | Generate collection SEO content |
| `ai:tagging` | Product taxonomy and tagging |
| `ai:collection-assign` | Auto-assign products to collections |
| `ai:compliance` | Trademark/IP risk detection |
| `ai:technical-seo` | Site audit and schema validation |
| `search:index` | Refresh PostgreSQL search vectors and ranking data |
| `search:embed` | Product embedding generation for pgvector |
| `shopify:extract` | Shopify catalog extraction (gated) |
| `media:process` | Image optimization and variants |

## Design

- Stateless workers; scale horizontally on queue depth
- Dead-letter queues for failed jobs
- Idempotent job handlers (safe retries)
- Structured logging with job ID correlation

## Dependencies (Planned)

- `@sjh/database`
- `@sjh/search`
- `@sjh/ai`
- `@sjh/shopify` (when migration enabled)
- `@sjh/shared`
