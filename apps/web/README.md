# Web Application

Next.js 15 storefront and admin shell for Sports Jersey House.

## Status

**Implemented** — catalogue browsing, search, collections, SEO, admin dashboard, health API.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing homepage |
| `/products` | Product listing with facets |
| `/products/[slug]` | Product detail + JSON-LD |
| `/collections` | Collection index |
| `/collections/[slug]` | Collection products |
| `/search` | Full-text search |
| `/admin` | Status dashboard (auth pending) |
| `/api/health` | Health check |

## Development

From repo root: `pnpm dev` (after `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed`).

See [SETUP.md](../../docs/SETUP.md) for full instructions.
