# ShopFlow — CLAUDE.md

Этот файл грузится целиком в каждой сессии Claude Code в этом репозитории, независимо от того, какой файл открыт. В отличие от Cursor Rules, здесь нет авто-переключения ролей по glob-паттернам файлов — поэтому здесь собраны сквозные правила проекта, а глубокие доменные чек-листы вынесены в subagents (`.claude/agents/`), чтобы не грузить контекст на каждый ход.

## Проект

**ShopFlow** — pet-проект Дениса Козырева (Senior Fullstack JS Developer, 6 лет: React/Next.js/Node/Express/GraphQL). Цель — прокачать NestJS microservices, Prisma, Kafka, gRPC, AWS, WebSockets, Docker/CI-CD. E-commerce SaaS платформа, NestJS Microservices Monorepo (Turborepo). 14 недель, 7 спринтов по 2 недели. Сейчас: **Sprint 1 — Foundation & Auth**, в работе.

Путь: `/Users/dzianis/Dev/My Projects/shopflow`
GitHub: https://github.com/DenisKozyrev/shopflow

## Как устроен AI-тулинг здесь

- **Этот файл** — всегда в контексте, ничего дополнительно открывать не нужно.
- **`.claude/agents/backend-expert.md` / `.claude/agents/frontend-expert.md`** — вызывать явно через Agent tool для глубокой backend/frontend работы и code review (NestJS/gRPC/Kafka/Prisma или Next.js/React Query/Tailwind соответственно). Нет авто-активации по открытому файлу — решение вызывать их принимает либо Денис, либо модель, если задача явно подходит под их `description`.
- **`.claude/skills/`** — mentor-session, commit-push-pr, prisma-db, aws-shopflow.
- **`.mcp.json`** — project MCP (postgres).
- Полная карта тулинга: `docs/AGENTS.md`.

## Перед sprint/PM-работой

Читать `docs/PROJECT_CONTEXT.md` и актуальный `docs/sprint-{N}-tasks.md` (для Sprint 1 — `docs/sprint-1-tasks.md`) перед планированием, оценкой статуса или ретроспективой.

## Sprint и task management

- **Формат задачи:** Номер (`SF-{N}`), Заголовок, Описание, Acceptance Criteria (чеклист), Learning (что Денис изучит), Оценка (S=1-2д / M=3-4д / L=5+д).
- Статус текущего спринта — в таблице "Sprint план" в `docs/PROJECT_CONTEXT.md`.
- После каждого merged PR — обновлять статус задачи в `docs/sprint-{N}-tasks.md`.
- После завершения спринта — sprint retrospective, затем планирование следующего.
- **Ветка:** `feature/SF-{N}-короткое-описание`. **PR title:** `feat(SF-N): описание`. После merge — статус задачи → ✅.

## Сквозные архитектурные правила

- Сервисы общаются **только** через gRPC (sync) или Kafka (async) — **никогда** напрямую по HTTP.
- Proto-файлы (`packages/proto/proto/`) — единственный источник правды для gRPC-контрактов; после изменения — `npm run proto:generate`.
- Токены сервисов: `GRPC_SERVICE_TOKENS` из `@shopflow/common`. Ошибки gRPC — `throw new RpcException({ code: status.X, message: '...' })`.
- Kafka consumers — обязательный try/catch (необработанная ошибка останавливает consumer). Топики — `KAFKA_TOPICS` из `@shopflow/kafka`.
- Prisma: схема — `packages/prisma/prisma/schema.prisma`; PK через `cuid()`; snake_case в БД через `@map`; `Payment.idempotencyKey` для защиты от дублей Stripe webhook.
- AWS: S3 — только presigned URLs (не проксировать файлы через backend); SES — только из notification-service через Kafka consumer.

## Tech stack

Next.js 15 (App Router) + Tailwind + shadcn/ui + Zustand + React Query · NestJS 10 + Prisma 5 + PostgreSQL 16 · Redis 7 · Kafka (KafkaJS) · gRPC (@grpc/grpc-js) · Stripe · AWS (S3/SES/ECS) · Turborepo · Jest + Supertest + Testing Library.

## Команды

```bash
npm run dev|build|lint|test|test:e2e|format
npm run db:generate|db:migrate
npm run proto:generate

# per-service
npm run dev --filter=@shopflow/auth-service
npm run dev --filter=@shopflow/api-gateway
npm run dev --filter=@shopflow/web
```

## Указатели

- Полная архитектура, ADR, схема БД, Kafka topics, дизайн-система: `docs/PROJECT_CONTEXT.md`
- Backend-конвенции и code-review чек-лист: `.claude/agents/backend-expert.md`
- Frontend-конвенции и code-review чек-лист: `.claude/agents/frontend-expert.md`
- Skills, MCP, hooks: `docs/AGENTS.md`
