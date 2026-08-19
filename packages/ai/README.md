# AI Package

**Status:** Not scaffolded — awaiting architecture approval.

Modular AI agent framework for all AI-powered features.

## Agent Modules (Planned)

```
src/
├── core/
│   ├── agent.ts           # Base agent interface
│   ├── provider.ts        # LLM provider abstraction
│   └── context.ts         # Agent execution context
├── agents/
│   ├── shopping-assistant/
│   ├── product-seo/
│   ├── collection-seo/
│   ├── technical-seo/
│   ├── catalogue-management/
│   ├── product-tagging/
│   ├── collection-assignment/
│   ├── compliance/
│   ├── customer-service/      # Future
│   ├── merchandising/         # Future
│   └── analytics/             # Future
└── prompts/                   # Version-controlled prompt templates
```

## Rules

- Prompts live in `prompts/`, not scattered inline
- All outputs are typed (Zod schemas for structured output)
- Token usage and latency logged per invocation
- AI never auto-publishes; outputs require admin approval
- Graceful degradation when providers are unavailable

## Dependencies (Planned)

- `@sjh/shared` — shared types
- `@sjh/database` — persist job results and drafts
