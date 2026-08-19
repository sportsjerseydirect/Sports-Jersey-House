# Shopify Package

Read-only Shopify extraction client for Sports Jersey House.

## Status

**Partial** — client-credentials auth, paginated product extract, mapper, per-product upsert loader, resumable checkpoints. Gated behind `ENABLE_SHOPIFY_SYNC=false`.

## Auth

Uses only:
- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`

Never uses a permanent access token env var.

## Extraction

```typescript
import { extractProductsPage } from "@sjh/shopify";

const result = await extractProductsPage({ databaseUrl, pageSize: 100 });
```

Or via worker CLI: `pnpm --filter @sjh/worker extract:products`

Each call fetches one API page (~100 products), upserts individually, and saves checkpoint state to `migration_runs` / `migration_checkpoints`.

## Not Yet Implemented

- Collections extract
- Redirects extract
- Media download to object storage
- Delta sync / webhooks
