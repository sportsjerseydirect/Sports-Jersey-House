# Shopify Package

**Status:** Dormant — no API connectivity until migration Phase 1 is approved.

Read-only Shopify extraction for catalog migration via the **"Sports Jersey House Extract"** app.

## Important

- **Do not call Shopify APIs** until explicitly approved
- Gated behind `ENABLE_SHOPIFY_SYNC=true` environment variable
- **Read-only scopes only** — no write operations
- Never invent or hardcode credentials

## Planned Structure

```
src/
├── auth/
│   └── client-credentials.ts # Temporary server-side token exchange
├── client.ts              # Admin API client
├── extractors/
│   ├── products.ts
│   ├── collections.ts
│   ├── redirects.ts
│   └── metafields.ts
├── mappers/
│   └── shopify-to-internal.ts
└── sync/
    ├── full-import.ts     # One-time bulk extract
    └── delta-sync.ts      # Incremental updates (future)
```

## Environment Variables

See root `.env.example`:

- `SHOPIFY_STORE_DOMAIN`
- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `ENABLE_SHOPIFY_SYNC` (default: `false`)

The package must use Shopify's supported client-credentials authentication flow to obtain temporary server-side tokens. Do not require a manually supplied permanent Shopify token, and never expose Shopify credentials or temporary tokens to browser code.
The Shopify Admin API version should be managed as package configuration, not as part of the secret environment contract.

## Migration Flow

See [docs/migration-plan.md](../../docs/migration-plan.md).

```
Shopify API → extract → transform → validate → PostgreSQL (draft)
```

## Dependencies (Planned)

- `@sjh/shared` — types and mappers
- `@sjh/database` — load target
