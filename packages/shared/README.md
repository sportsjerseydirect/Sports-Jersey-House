# Shared Package

**Status:** Not scaffolded — awaiting architecture approval.

Shared types, constants, Zod schemas, and utilities used across all packages.

## Planned Contents

```
src/
├── types/
│   ├── product.ts
│   ├── collection.ts
│   ├── seo.ts
│   ├── ai.ts
│   └── shopify.ts          # Shopify DTO types (for migration)
├── schemas/                 # Zod validation schemas
├── constants/
│   ├── taxonomy.ts          # Sport, team, league enums
│   └── statuses.ts          # Content lifecycle statuses
└── utils/
    ├── slug.ts
    └── currency.ts
```

## Rules

- No business logic — types, schemas, and pure utilities only
- No dependencies on other `@sjh/*` packages (this is the leaf package)
- All public entity types exported from a single entry point
