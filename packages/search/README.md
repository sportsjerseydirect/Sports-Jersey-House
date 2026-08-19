# Search Package

PostgreSQL full-text search abstraction for Sports Jersey House.

## Status

**Implemented** — `PostgresSearchProvider` with FTS, facets, filters. `EmptySearchProvider` fallback when no database. pgvector column exists; semantic search not wired yet.

## Usage

```typescript
import { createSearchProvider } from "@sjh/search";

const provider = createSearchProvider({ databaseUrl: process.env.DATABASE_URL });
const results = await provider.search({ query: "bears jersey", limit: 24 });
```
