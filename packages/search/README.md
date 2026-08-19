# Search Package

**Status:** Not scaffolded — awaiting architecture approval.

PostgreSQL full-text search and pgvector retrieval for product search and AI shopping assistant grounding.

## Features (Planned)

- Product index with faceted filters (sport, team, league, size, price, tags)
- Weighted full-text search over title, description, vendor, tags, sport, team, and league
- Semantic search using embeddings stored in pgvector
- Hybrid search: keyword candidates + vector similarity + deterministic rerank
- Facets resolved from PostgreSQL catalogue tables
- Query abstraction that can support a dedicated search engine later
- Admin reindex command

## Index Schema (Planned)

```typescript
// Conceptual product search row/view
{
  id: string;
  title: string;
  description: string;
  slug: string;
  price: number;
  tags: string[];
  sport: string;
  team: string;
  league: string;
  image_url: string;
  status: "published" | ...;
  search_vector: unknown; // PostgreSQL tsvector
  embedding?: number[];   // pgvector semantic embedding
}
```

## Dependencies (Planned)

- `@sjh/shared` — types
- `@sjh/database` — source of truth for index sync
