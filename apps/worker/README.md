# Worker

Background job processor for Sports Jersey House.

## Status

**Scaffold + CLI** — queue names defined; Shopify product extraction CLI implemented. BullMQ workers require Redis (not wired yet).

## Queues

Defined in `src/index.ts`: `shopify:extract`, `shopify:transform`, AI/SEO/search queues.

## CLI

Extract one page of Shopify products (requires `ENABLE_SHOPIFY_SYNC=true` and credentials):

```bash
pnpm --filter @sjh/worker extract:products
```

Resumable via `migration_runs` / `migration_checkpoints` in PostgreSQL.
