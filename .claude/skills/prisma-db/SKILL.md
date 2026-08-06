---
name: prisma-db
description: ShopFlow Prisma and PostgreSQL workflow — migrations, generate, Studio, and Postgres MCP. Use when working with schema, migrations, DATABASE_URL, PrismaService, or inspecting the local database.
---

# Prisma + Postgres (ShopFlow)

## Local DB

- Docker service: `postgres` (see `docker-compose.yml`)
- Typical URL: `postgresql://shopflow:shopflow_dev@localhost:5433/shopflow`
- Env: root `.env` → `DATABASE_URL` (never commit `.env`)

Ensure Postgres is up:

```bash
docker compose up -d postgres
docker compose ps
```

## Common commands (from repo root)

```bash
npm run db:migrate      # apply migrations
npm run db:generate     # regenerate Prisma client
cd packages/prisma && npx prisma studio   # GUI
```

Package: `@shopflow/prisma` → `PrismaService` / `PrismaModule`.

## Postgres MCP

Project MCP: `.mcp.json` → server `postgres`.

Requires `DATABASE_URL` in the environment when Claude Code starts:

```bash
# ~/.zshrc (example)
export DATABASE_URL="postgresql://shopflow:shopflow_dev@localhost:5433/shopflow"
```

Then reconnect the MCP server (`/mcp` inside Claude Code, or restart the session if it doesn't pick it up). Use MCP to inspect schema/tables; prefer read-only exploration in mentor mode.

## Schema conventions

- Shared DB, domain models in `packages/prisma/prisma/schema.prisma`
- `@map` snake_case in DB, camelCase in TS
- PK: `cuid()`
- Soft delete MVP: `isActive` where applicable

## Mentor note

Explain migrations and relations; Denis runs commands and edits schema himself unless he asks you to write code.
