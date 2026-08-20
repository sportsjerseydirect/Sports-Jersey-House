# Deployment

## GitHub (private)

1. Authenticate once: `gh auth login` (browser flow)
2. From repo root:

```bash
gh repo create Sports-Jersey-House --private --source=. --remote=origin --push
```

If the repo already exists under your account:

```bash
git remote add origin git@github.com:<you>/Sports-Jersey-House.git
git push -u origin main
```

Never commit `.env`.

## Vercel

### Project settings (monorepo)

| Setting | Value |
|---------|-------|
| Root Directory | `apps/web` (uses `apps/web/vercel.json`) |
| Framework | Next.js |
| Install | `cd ../.. && pnpm install --frozen-lockfile` |
| Build | `cd ../.. && pnpm build --filter @sjh/web` |
| Output | `.next` (default) |
| Node | 22.x |

### Environment variables (Production + Preview)

Required:

- `DATABASE_URL` — Supabase **Transaction pooler** URI preferred on Vercel (port `6543`, `prepare:false` already set). Session pooler (`5432`) works but caps concurrent clients (~15) and will 500 under load if the app opens many pools.
- `APP_URL` — production URL, e.g. `https://sports-jersey-house.vercel.app`
- `APP_NAME` — `Sports Jersey House`
- `AUTH_SECRET` — long random string
- `ADMIN_PASSWORD` — required in production; protects `/admin`
- `ENABLE_SHOPIFY_SYNC` — `false`
- `ENABLE_AI_SHOPPING_ASSISTANT` — `false`

Recommended before public traffic:

- `STATIC_PRERENDER_LIMIT` — e.g. `200`

Optional later: `OPENAI_API_KEY`, Shopify client credentials (only when sync is approved).

### Local smoke before deploy

```bash
pnpm --filter @sjh/web smoke
pnpm --filter @sjh/web build
```
