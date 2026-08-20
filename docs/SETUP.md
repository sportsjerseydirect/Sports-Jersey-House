# Setup

Local development guide for Sports Jersey House.

## Prerequisites

- **Node.js** 22 LTS
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** (for local Postgres, Redis, MinIO)

## Quick Start

```bash
# 1. Clone and install
pnpm install

# 2. Environment
cp .env.example .env
# DATABASE_URL defaults to local Docker Postgres — adjust if needed

# 3. Start infrastructure
pnpm infra:up

# 4. Database
pnpm db:migrate
pnpm db:seed
pnpm db:verify

# 5. Development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local routes (after seed)

| Route | Purpose |
|-------|---------|
| `/` | Homepage |
| `/products` | Full catalogue with facets |
| `/products/[slug]` | Product detail |
| `/collections` | Collection index |
| `/collections/[slug]` | Collection products |
| `/search?q=` | Full-text search |
| `/admin` | Status dashboard |
| `/api/health` | Health JSON |

---

## Environment Variables

Copy `.env.example` to `.env`. **Never commit `.env`.**

### Required for local catalogue

| Variable | Default (local) | Purpose |
|----------|-----------------|---------|
| `DATABASE_URL` | `postgresql://sjh:sjh@localhost:5432/sports_jersey_house` | PostgreSQL connection |
| `APP_URL` | `http://localhost:3000` | Canonical URL for SEO/images |
| `APP_NAME` | `Sports Jersey House` | Site name |

### Feature flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENABLE_SHOPIFY_SYNC` | `false` | **Must stay false** until migration approved |
| `ENABLE_AI_SHOPPING_ASSISTANT` | `false` | AI chat (not implemented) |
| `ADMIN_PASSWORD` | unset | Set to require admin login |
| `AUTH_SECRET` | unset | Session signing secret (required in production) |

### Shopify (migration only — do not set until approved)

| Variable | Purpose |
|----------|---------|
| `SHOPIFY_STORE_DOMAIN` | e.g. `sports-jersey-direct.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | From "Sports Jersey House Extract" app |
| `SHOPIFY_CLIENT_SECRET` | From same app |

When approved, set `ENABLE_SHOPIFY_SYNC=true` and run extraction via worker CLI (see below).

### Supabase (staging/production DB)

Project **Sports Jersey House** exists (`vergndtgsrqaqvsjtbds`, region `us-west-2`). Schema migrations `0000_foundation` + `0001_carts` have been applied via MCP (empty catalogue).

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase **Session pooler** URI from Project Settings → Database |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional; only needed when Supabase Auth/client SDK is added |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional; publishable/anon key for client SDK later |

**Important:** Replace any `[YOUR-PASSWORD]` / placeholder in the URI with the real database password (URL-encode special characters). Host should look like `aws-0-<region>.pooler.supabase.com` and username like `postgres.<project-ref>`.

App runtime today uses **direct Postgres** via Drizzle (`DATABASE_URL`), not the Supabase JS client. Keep `ENABLE_SHOPIFY_SYNC=false` until migration is approved.

### Vercel

| Service | Variables |
|---------|-----------|
| Vercel | Project linked to repo; env vars mirrored from Supabase + feature flags |
| OpenAI | `OPENAI_API_KEY` (when AI agents are enabled) |

Credentials will be requested only when a feature actually needs them.

---

## Docker Services

`pnpm infra:up` starts:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL (pgvector) | 5432 | Primary database |
| Redis | 6379 | Job queues (future) |
| MinIO | 9000 | S3-compatible storage (future) |

Stop: `pnpm infra:down`

---

## Database Commands

```bash
pnpm db:migrate    # Apply Drizzle migrations
pnpm db:seed       # Insert dev catalogue (idempotent)
pnpm db:verify     # Confirm pgvector + search_vector + seed
pnpm db:generate   # Generate new migration from schema changes
```

Re-run `pnpm db:seed` after pulling collection seed changes if products were seeded before collections existed.

---

## Shopify Extraction (When Approved)

**Safety:** Requires `ENABLE_SHOPIFY_SYNC=true` and valid Shopify credentials. Read-only — no writes to Shopify.

Extract one page (~100 products) into PostgreSQL as `draft`:

```bash
pnpm --filter @sjh/worker extract:products
```

The runner is resumable via `migration_runs` / `migration_checkpoints`. Re-run to continue from the last cursor.

### Background worker (Redis)

With Redis running (`pnpm infra:up`):

```bash
pnpm --filter @sjh/worker dev
```

Processes `shopify:extract` jobs from the BullMQ queue. Requires `REDIS_URL` and `DATABASE_URL`.

---

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

---

## Troubleshooting

### `/products` shows empty state

1. Confirm Docker Postgres is running: `pnpm infra:up`
2. Run migrations and seed: `pnpm db:migrate && pnpm db:seed`
3. Confirm `DATABASE_URL` in `.env` matches Docker default

### Integration tests skipped

Search integration tests require `DATABASE_URL`. CI runs them with a Postgres service; locally they run when Docker is up.

### Shopify sync disabled error

Expected. Set `ENABLE_SHOPIFY_SYNC=true` only after explicit migration approval.
