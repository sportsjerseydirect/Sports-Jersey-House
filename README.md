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

> Application setup instructions will be added after architecture approval.

1. Copy `.env.example` to `.env` and fill in values when a service is approved.
2. Install dependencies: `corepack pnpm install`
3. Start development: `corepack pnpm --dir apps/web dev`
4. Build production: `corepack pnpm --dir apps/web build`
5. Start the production build: `corepack pnpm --dir apps/web start`

The web app uses polling mode for local development to avoid file-watcher limits in managed environments.

## Important Constraints

- **Do not** commit `.env` or any secrets.
- **Do not** call Shopify APIs until the migration phase is explicitly approved.
- AI-generated content requires human review before publish.

## License

Proprietary — Sports Jersey House. All rights reserved.
