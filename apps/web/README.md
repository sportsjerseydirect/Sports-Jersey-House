# Web Application

**Status:** Not scaffolded — awaiting architecture approval.

Next.js 15 storefront and admin panel.

## Planned Responsibilities

- Public storefront: home, product pages, collections, search, cart
- Admin panel: catalogue management, AI review queue, SEO dashboard
- API routes: search, AI shopping assistant (streaming), health checks
- SEO: metadata, JSON-LD, sitemaps, ISR/SSG rendering

## Route Structure (Planned)

```
app/
├── (storefront)/
│   ├── page.tsx                 # Home
│   ├── products/[slug]/         # PDP
│   ├── collections/[slug]/      # PLP
│   ├── search/                  # Search results
│   └── ...
├── (admin)/
│   ├── products/
│   ├── collections/
│   ├── ai-review/
│   └── seo/
└── api/
    ├── search/
    ├── ai/chat/
    └── health/
```

## Dependencies (Planned)

- `@sjh/database` — data access
- `@sjh/search` — PostgreSQL full-text/vector search queries
- `@sjh/ai` — AI agent invocations
- `@sjh/shared` — types and utilities
