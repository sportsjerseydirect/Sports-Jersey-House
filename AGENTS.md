# Sports Jersey House — Agent Guidelines

This document defines rules for AI agents (Cursor, CI bots, and internal AI services) working on this repository.

## Project Overview

Sports Jersey House is a **new e-commerce platform** replacing an existing Shopify storefront. The catalog contains **8,876+ products**. Shopify is the current source of truth and will be migrated from later via the read-only extraction app **"Sports Jersey House Extract"**.

## Core Principles

1. **Do not connect to external systems without explicit approval** — especially Shopify. No API calls, webhooks, or credential usage until the migration phase is approved and credentials are configured.
2. **Never invent or hardcode secrets** — use environment variables. Never commit `.env`, keys, tokens, or credentials.
3. **SEO is first-class** — every storefront page, product, and collection must be designed for crawlability, structured data, performance, and indexability.
4. **AI features are modular** — each AI capability (search assistant, SEO agents, tagging, compliance) lives in `packages/ai` with clear interfaces; agents must not leak prompts or provider details into the storefront.
5. **Production-ready from day one** — type safety, error handling, observability hooks, and scalable patterns even in early code.
6. **Minimal scope** — change only what the task requires. Match existing conventions.

## Architecture

Monorepo layout (pnpm + Turborepo):

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js storefront + admin (App Router, RSC, ISR) |
| `apps/worker` | Background jobs: AI pipelines, search indexing, sync |
| `packages/database` | PostgreSQL schema, migrations, typed client |
| `packages/ai` | AI agents: shopping, SEO, tagging, compliance, CS |
| `packages/shopify` | Shopify extraction client (**dormant until migration**) |
| `packages/search` | PostgreSQL full-text search + pgvector query layer |
| `packages/shared` | Shared types, constants, utilities |
| `docs/` | Architecture, migration, and runbooks |
| `infrastructure/` | IaC templates (not deployed yet) |

## Tech Stack

- **Runtime:** Node.js 22 LTS, TypeScript (strict)
- **Storefront:** Next.js 15 (App Router), React 19, Tailwind CSS
- **Database:** PostgreSQL via Drizzle ORM
- **Cache / Queues:** Redis, BullMQ
- **Search:** PostgreSQL full-text search + pgvector, behind an abstraction that can support a dedicated search engine later
- **Storage:** S3-compatible object storage for media
- **AI:** Provider-agnostic layer (OpenAI, Anthropic) with structured outputs

## Design System

- **Aesthetic:** Premium, Apple-inspired — generous whitespace, restrained palette, crisp typography, subtle motion, product-first photography.
- **Typography:** System font stack with Inter fallback; avoid decorative fonts.
- **Accessibility:** WCAG 2.2 AA minimum; semantic HTML; keyboard navigation.
- **Performance:** Core Web Vitals targets — LCP < 2.5s, CLS < 0.1, INP < 200ms.

## SEO Requirements

- Server-rendered or ISR pages for all public routes.
- Unique `<title>`, meta description, canonical URL, and Open Graph tags per page.
- JSON-LD structured data: `Product`, `Offer`, `BreadcrumbList`, `Organization`, `WebSite` (+ `SearchAction`).
- XML sitemaps (products, collections, pages) generated at build or on schedule.
- Clean URL slugs; no duplicate content; hreflang ready for future locales.
- AI-generated SEO metadata must be human-reviewable before publish (draft → review → live workflow).

## AI Agent Modules

Each module in `packages/ai` must expose a typed interface and live in its own subdirectory:

| Agent | Responsibility |
|-------|----------------|
| `shopping-assistant` | Conversational product discovery and recommendations |
| `product-seo` | Titles, descriptions, meta, structured data suggestions |
| `collection-seo` | Collection page copy, meta, internal linking |
| `technical-seo` | Crawl audits, redirect maps, schema validation |
| `catalogue-management` | Bulk edits, enrichment, data quality |
| `product-tagging` | Taxonomy, attributes, sport/team/league tags |
| `collection-assignment` | Auto-assign products to collections |
| `compliance` | Trademark and IP risk flagging |
| `customer-service` | Order/help queries (future: order lookup) |
| `merchandising` | Rankings, bundles, cross-sell (future) |
| `analytics` | Insights and reporting (future) |

Rules for AI code:
- Prompts live in version-controlled template files, not inline strings scattered across apps.
- All AI outputs that affect published content require an approval state in the database.
- Log token usage and latency; never log PII or full prompts containing customer data.
- Graceful degradation: storefront works fully if AI services are unavailable.

## Shopify / Migration Rules

- **Current status:** Shopify is source-only. The extraction app exists but is **not connected**.
- Do **not** call Shopify Admin API, Storefront API, or webhooks until explicitly instructed.
- Do **not** create or guess Shopify credentials.
- Shopify integration must use only `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, and `SHOPIFY_CLIENT_SECRET` to obtain temporary server-side tokens through Shopify's supported client-credentials authentication flow.
- Do **not** require or use a manually supplied permanent Shopify access token.
- All Shopify-related code belongs in `packages/shopify` and must be gated behind `ENABLE_SHOPIFY_SYNC` (default: `false`).
- Migration is **extract → transform → validate → load** into PostgreSQL; never write back to Shopify.

## Database Conventions

- Use UUID primary keys for public-facing entities.
- Soft-delete with `deleted_at` where appropriate; hard-delete only for GDPR requests.
- All product/collection content supports `status`: `draft` | `review` | `published` | `archived`.
- Audit columns: `created_at`, `updated_at`, `created_by`, `updated_by`.
- AI-generated fields stored separately from human-edited fields (e.g., `seo_title_ai` vs `seo_title`).

## Code Standards

- TypeScript strict mode; no `any` without a documented exception.
- Prefer server components; client components only when interactivity requires it.
- Use Zod for runtime validation at API boundaries.
- Error types over string throws; structured logging (pino).
- Tests for business logic and AI output parsers; E2E for critical storefront flows.

## Git & Security

- Never commit: `.env`, credentials, `.pem`, database dumps with real data.
- Dependabot / npm audit for dependency hygiene.
- Rate-limit public AI and search endpoints.
- Admin routes require authentication; role-based access for catalogue and AI approval.

## When in Doubt

1. Check `docs/architecture.md` and `docs/migration-plan.md`.
2. Prefer extending existing packages over creating new ones.
3. Ask before connecting to any external service.
4. Keep the storefront functional without AI or Shopify connectivity.
