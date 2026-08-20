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
| Root Directory | repository root (use root `vercel.json`) |
| Framework | Next.js |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build --filter @sjh/web` |
| Output | `apps/web/.next` |
| Node | 22.x |

### Environment variables (Production + Preview)

Required:

- `DATABASE_URL` — Supabase **Session pooler** URI (same as local, password URL-encoded if needed)
- `APP_URL` — production URL, e.g. `https://your-app.vercel.app`
- `APP_NAME` — `Sports Jersey House`
- `AUTH_SECRET` — long random string
- `ENABLE_SHOPIFY_SYNC` — `false`
- `ENABLE_AI_SHOPPING_ASSISTANT` — `false`

Recommended before public traffic:

- `ADMIN_PASSWORD` — protects `/admin`
- `STATIC_PRERENDER_LIMIT` — e.g. `200`

Optional later: `OPENAI_API_KEY`, Shopify client credentials (only when sync is approved).

### Local smoke before deploy

```bash
pnpm --filter @sjh/web smoke
pnpm --filter @sjh/web build
```
