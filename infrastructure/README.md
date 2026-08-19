# Infrastructure

**Status:** Not provisioned — no deployment until application MVP is ready.

Infrastructure-as-Code templates for production deployment.

## Planned Components

| Component | Options (TBD) |
|-----------|---------------|
| Web hosting | Vercel, AWS ECS, or similar |
| Worker hosting | AWS ECS, Railway, or similar |
| PostgreSQL | Neon, RDS, Supabase |
| Redis | Upstash, ElastiCache |
| Object storage | AWS S3, Cloudflare R2 |
| CDN | CloudFront, Cloudflare |
| DNS | Route 53, Cloudflare |
| Monitoring | Sentry, hosted APM |

## Planned Structure

```
infrastructure/
├── terraform/           # or pulumi/
│   ├── environments/
│   │   ├── staging/
│   │   └── production/
│   └── modules/
├── docker/
│   ├── web.Dockerfile
│   └── worker.Dockerfile
└── docker-compose.yml   # Local development stack
```

## Local Development Stack (Planned)

`docker-compose.yml` will provide:

- PostgreSQL
- Redis
- PostgreSQL extensions for full-text search and pgvector
- MinIO (S3-compatible, local)

**Not created yet** — will be added during application scaffolding.

## Constraints

- No deployment without explicit approval
- No cloud credentials in repository
- All secrets via environment variables or secret managers
