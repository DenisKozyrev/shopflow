# ShopFlow — Project Context (AI Agent Reference)

> **Читай этот файл в начале каждой сессии.** Здесь полный контекст проекта, архитектура, соглашения и текущее состояние.

---

## Проект

**Название:** ShopFlow  
**Тип:** E-commerce SaaS платформа  
**Цель:** Pet-проект для прокачки Senior fullstack навыков и подготовки к собеседованиям  
**Путь:** `/Users/dzianis/Dev/My Projects/shopflow`  
**GitHub:** https://github.com/DenisKozyrev/shopflow  
**Временной план:** 14 недель, 7 спринтов по 2 недели

### Разработчик

- **Имя:** Denis Kozyrev
- **Уровень:** Senior Fullstack JavaScript Developer (6 лет)
- **Сильные стороны:** React, Next.js, Node.js, Express, GraphQL, тестирование
- **Изучает через проект:** NestJS microservices, Prisma, Kafka, AWS (S3/SES/ECS), gRPC, WebSockets, Docker/CI-CD

---

## Архитектура

### Тип: NestJS Microservices Monorepo (Turborepo)

```
Client (Next.js 15, port 3001)
    │
    ▼  HTTP + WebSocket (Socket.io)
┌───────────────────────────┐
│       api-gateway          │  port 3000
│  JWT validation            │
│  Rate limiting (Throttler) │
│  gRPC proxy → сервисы     │
│  WebSocket gateway         │
└──────┬────────────────────┘
       │  gRPC (Protocol Buffers)
  ┌────┼────────────────┬──────────────────┐
  ▼    ▼                ▼                  ▼
auth  product         order            payment
:5001  :5002           :5003             :5004
  │     │               │                 │
  │     │ Kafka         │ Kafka           │ Kafka
  │     └───────────────┴─────────────────┘
  │                     │
  │              ┌──────▼──────────────┐
  └─────────────►│ notification-service │
                 │  Kafka Consumer      │
                 │  AWS SES emails      │
                 └─────────────────────┘
```

### Синхронная коммуникация: gRPC

- API Gateway → все сервисы через gRPC
- Proto файлы: `packages/proto/proto/*.proto`
- Порты: auth=5001, product=5002, order=5003, payment=5004

### Асинхронная коммуникация: Kafka

- Kafka UI: http://localhost:8080 (локально)
- Топики определены в `packages/kafka/src/index.ts`

---

## Tech Stack

| Слой              | Технология                         | Версия |
| ----------------- | ---------------------------------- | ------ |
| Frontend          | Next.js (App Router)               | 15.x   |
| UI                | Tailwind CSS + shadcn/ui           | latest |
| State             | Zustand + React Query (TanStack)   | v4/v5  |
| Backend framework | NestJS                             | 10.x   |
| ORM               | Prisma                             | 5.x    |
| Database          | PostgreSQL                         | 16     |
| Cache / Cart      | Redis                              | 7      |
| Message queue     | Kafka (KafkaJS)                    | 2.x    |
| Sync IPC          | gRPC (@grpc/grpc-js)               | 1.x    |
| Storage           | AWS S3                             | —      |
| Email             | AWS SES + React Email              | —      |
| Payments          | Stripe                             | latest |
| Containerisation  | Docker + Docker Compose            | —      |
| Deploy            | AWS ECS Fargate                    | —      |
| Monorepo          | Turborepo                          | 2.x    |
| CI/CD             | GitHub Actions                     | —      |
| Observability     | OpenTelemetry + AWS CloudWatch     | —      |
| Testing           | Jest + Supertest + Testing Library | 29.x   |
| Forms             | React Hook Form + Zod              | v7/v3  |

---

## Структура репозитория

```
shopflow/
├── apps/
│   ├── api-gateway/           # NestJS HTTP сервер + gRPC клиенты + WebSocket
│   │   └── src/
│   │       ├── main.ts
│   │       └── app.module.ts  # gRPC clients registered here
│   │
│   ├── auth-service/          # NestJS gRPC сервер (порт 5001)
│   │   └── src/
│   │       ├── main.ts        # gRPC bootstrap
│   │       ├── app.module.ts
│   │       ├── auth.controller.ts  # @GrpcMethod handlers
│   │       └── auth.service.ts
│   │
│   ├── product-service/       # gRPC порт 5002, Kafka producer
│   ├── order-service/         # gRPC порт 5003, Redis cart, Kafka producer
│   ├── payment-service/       # Kafka consumer/producer, Stripe
│   ├── notification-service/  # Kafka consumer, AWS SES
│   │
│   └── web/                   # Next.js 15 фронтенд (порт 3001)
│       └── src/app/
│           ├── layout.tsx
│           ├── page.tsx
│           └── providers.tsx  # React Query + другие провайдеры
│
├── packages/
│   ├── proto/                 # gRPC контракты (source of truth)
│   │   └── proto/
│   │       ├── auth.proto     # AuthService: ValidateToken, GetUserById
│   │       ├── product.proto  # ProductService: CRUD + DecrementStock
│   │       └── order.proto    # OrderService: CRUD + UpdateStatus
│   │
│   ├── prisma/                # Prisma schema + migrations
│   │   └── prisma/
│   │       └── schema.prisma  # Все модели: User, Product, Order, Payment...
│   │
│   ├── kafka/                 # Kafka конфиг + топики
│   │   └── src/
│   │       ├── index.ts       # KAFKA_TOPICS enum + event payload types
│   │       └── kafka.config.ts
│   │
│   └── common/                # Shared типы и константы
│       └── src/
│           └── index.ts       # UserRole, OrderStatus, PaymentStatus, enums
│
├── infra/docker/              # Dockerfiles (создать в Sprint 7)
├── docs/
│   ├── PROJECT_CONTEXT.md     # этот файл
│   └── sprint-1-tasks.md      # задачи Sprint 1 с Acceptance Criteria
│
├── .github/workflows/
│   └── ci.yml                 # lint → test → build → docker push (main only)
│
├── docker-compose.yml         # PostgreSQL, Redis, Kafka, Zookeeper, Kafka UI
├── .env.example               # все env переменные с описанием
├── .env                       # локальные значения (в .gitignore)
├── package.json               # npm workspaces root
├── turbo.json                 # Turborepo pipeline
└── tsconfig.json              # root tsconfig с path aliases
```

---

## Kafka Topics

| Topic             | Producer        | Consumers                             | Описание              |
| ----------------- | --------------- | ------------------------------------- | --------------------- |
| `order.created`   | order-service   | payment-service, notification-service | Заказ оформлен        |
| `order.paid`      | payment-service | order-service, notification-service   | Платёж подтверждён    |
| `order.shipped`   | order-service   | notification-service                  | Заказ отправлен       |
| `order.cancelled` | order-service   | notification-service, payment-service | Заказ отменён         |
| `payment.failed`  | payment-service | notification-service                  | Ошибка оплаты         |
| `inventory.low`   | product-service | notification-service                  | Мало товара на складе |
| `user.registered` | auth-service    | notification-service                  | Новый пользователь    |

Все топики и TypeScript типы событий: `packages/kafka/src/index.ts`

---

## База данных (Prisma Schema)

Схема: `packages/prisma/prisma/schema.prisma`  
Shared PostgreSQL, логически разделена по доменам сервисов.

**Auth domain:** `User`, `OAuthAccount`, `RefreshToken`  
**Product domain:** `Category`, `Product`, `ProductImage`, `ProductVariant`  
**Order domain:** `Order`, `OrderItem`, `Address`  
**Payment domain:** `Payment`

**Важные паттерны:**

- Все PK через `@id @default(cuid())`
- snake_case в БД (`@map`), camelCase в TypeScript
- Soft delete через `isActive` (не через `deletedAt` в MVP)
- `idempotencyKey` на `Payment` для защиты от дублей Stripe

---

## gRPC Контракты

Proto файлы — единственный источник правды для inter-service коммуникации.

**Добавление нового RPC:**

1. Обновить `.proto` файл в `packages/proto/proto/`
2. Регенерировать типы: `npm run proto:generate`
3. Добавить `@GrpcMethod` handler в контроллер сервиса
4. Добавить метод в клиент в `api-gateway`

**Никогда не** вызывать другой сервис через HTTP — только через gRPC или Kafka.

---

## Соглашения кода

### Naming

- Ветки: `feature/SF-{номер}-короткое-описание` (пример: `feature/SF-5-auth-service-grpc`)
- Коммиты: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- Файлы NestJS: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.guard.ts`
- Next.js: App Router, Server Components по умолчанию, `'use client'` только там где нужно

### NestJS Microservices

- Каждый сервис запускается через `NestFactory.createMicroservice` с Transport.GRPC
- Контроллеры используют `@GrpcMethod('ServiceName', 'MethodName')`
- Kafka consumers используют `@EventPattern(KAFKA_TOPICS.ORDER_CREATED)`
- Все gRPC токены сервисов: `GRPC_SERVICE_TOKENS` из `@shopflow/common`

### Error Handling

- gRPC ошибки: `throw new RpcException({ code: status.NOT_FOUND, message: '...' })`
- HTTP ошибки в gateway: стандартные NestJS exceptions (`NotFoundException`, etc.)
- Kafka consumers: обязательный try/catch + логирование, не бросать ошибки (иначе consumer останавливается)

### Testing

- Unit tests: рядом с файлом (`auth.service.spec.ts`)
- E2E tests: папка `test/` в каждом приложении
- Цель покрытия: >80% для сервисов, >60% для gateway
- Мокать gRPC клиенты через `jest.mock`, БД через `@prisma/client` mock

---

## Sprint план

| #   | Название                   | Статус         | Ветка      | Что строим                                              |
| --- | -------------------------- | -------------- | ---------- | ------------------------------------------------------- |
| 1   | Foundation & Auth          | 🚧 In Progress | `sprint-1` | Turborepo, Docker, Auth service, API Gateway, gRPC, JWT |
| 2   | Product Service + S3       | ⏳ Pending     | —          | Products CRUD, AWS S3, Kafka Producer                   |
| 3   | Order Service + Cart       | ⏳ Pending     | —          | Redis cart, Orders, Checkout flow                       |
| 4   | Payment Service + Stripe   | ⏳ Pending     | —          | Stripe, Webhooks, idempotency, Saga                     |
| 5   | Notifications + WebSockets | ⏳ Pending     | —          | AWS SES, Socket.io, real-time status                    |
| 6   | Admin Dashboard + RBAC     | ⏳ Pending     | —          | Analytics, RBAC, admin UI                               |
| 7   | Deploy + Observability     | ⏳ Pending     | —          | AWS ECS, GitHub Actions, OpenTelemetry                  |

Детальные задачи Sprint 1: `docs/sprint-1-tasks.md`

---

## Как запустить локально

```bash
# 1. Инфраструктура (PostgreSQL, Redis, Kafka)
docker compose up -d postgres redis zookeeper kafka kafka-ui

# 2. Установить зависимости
npm install

# 3. Миграции БД
npm run db:migrate

# 4. Генерация Prisma client
npm run db:generate

# 5. Запуск всех сервисов в dev режиме
npm run dev

# 6. Только инфраструктура + конкретный сервис
npm run dev --filter=@shopflow/auth-service
npm run dev --filter=@shopflow/api-gateway

# Kafka UI
open http://localhost:8080
```

### Порты

| Сервис                 | Порт |
| ---------------------- | ---- |
| api-gateway (HTTP)     | 3000 |
| web (Next.js)          | 3001 |
| auth-service (gRPC)    | 5001 |
| product-service (gRPC) | 5002 |
| order-service (gRPC)   | 5003 |
| payment-service (gRPC) | 5004 |
| PostgreSQL             | 5432 |
| Redis                  | 6379 |
| Kafka                  | 9092 |
| Kafka UI               | 8080 |

---

## Workflow для разработки

1. **Получить задачу** — из GitHub Projects (Sprint board)
2. **Создать ветку** — `git checkout -b feature/SF-{N}-описание`
3. **Реализовать** — следовать Acceptance Criteria из задачи
4. **Написать тесты** — unit tests обязательны
5. **Открыть PR** — заголовок: `feat(SF-N): короткое описание`
6. **Code review** — AI reviewer проверяет архитектуру, паттерны, безопасность
7. **Merge** — squash merge в `main`

### Как запросить помощь у AI

Перед каждой новой сессией в Cursor — прочитай этот файл и укажи агенту:

```
Прочитай /Users/dzianis/Dev/My Projects/shopflow/docs/PROJECT_CONTEXT.md

Сейчас работаю над: SF-{N} — {название задачи}
Текущая проблема: {описание}
```

### Роли AI в проекте

- **PM** — планирование спринтов, уточнение требований, acceptance criteria
- **Architect** — системный дизайн, tech decisions, ADR
- **Backend Expert** — NestJS, Prisma, Kafka, AWS паттерны, gRPC
- **Frontend Expert** — Next.js, React паттерны, производительность
- **Code Reviewer** — review PR, объяснение паттернов, обучение

---

## AWS ресурсы (настроить в Sprint 2-7)

| Сервис            | Использование                             | Sprint |
| ----------------- | ----------------------------------------- | ------ |
| S3                | Изображения товаров (presigned URLs)      | 2      |
| SES               | Транзакционные email (через Kafka)        | 5      |
| ECR               | Docker registry для образов сервисов      | 7      |
| ECS Fargate       | Деплой каждого сервиса как отдельный task | 7      |
| RDS PostgreSQL    | Продакшн база данных                      | 7      |
| ElastiCache Redis | Продакшн Redis                            | 7      |
| MSK (Kafka)       | Продакшн Kafka                            | 7      |
| CloudWatch        | Логи и метрики всех сервисов              | 7      |
| IAM               | Роли для сервисов (least privilege)       | 7      |

---

## Дизайн

**Стиль:** Темная тема, минимализм (Vercel/Linear aesthetic)  
**Цвет фона:** `#0f172a` (Tailwind `slate-900`)  
**Акцентный:** Indigo/Violet  
**Компоненты:** shadcn/ui

**Макеты** (сгенерированы, использовать как референс):

- Homepage: каталог с категориями + featured products
- Order Tracking: статус-таймлайн + WebSocket live-статус
- Admin Dashboard: метрики + графики + таблица заказов

---

## Известные технические решения (ADR)

### ADR-001: Shared DB vs DB-per-service

**Решение:** Shared PostgreSQL, отдельные Prisma схемы на сервис  
**Причина:** Проще для старта pet-проекта. Каждый сервис работает только со своими моделями. При необходимости можно мигрировать на отдельные БД.

### ADR-002: gRPC для sync, Kafka для async

**Решение:** gRPC для request/response паттернов, Kafka для событий  
**Причина:** gRPC даёт типизацию (proto), streaming, и производительность. Kafka даёт decoupling, retry, и audit log событий.

### ADR-003: API Gateway как единственная точка входа

**Решение:** Клиент никогда не обращается напрямую к микросервисам  
**Причина:** Централизованная аутентификация, rate limiting, CORS, logging.

### ADR-004: BullMQ не используется

**Решение:** Kafka с первого спринта  
**Причина:** Цель — изучить Kafka. BullMQ — это упрощение которое убирает learning value.

---

## Полезные команды

```bash
# Просмотр Kafka топиков
docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Мониторинг Kafka consumer group
docker compose exec kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group shopflow-group

# Prisma Studio (UI для БД)
cd packages/prisma && npx prisma studio

# Запустить тесты конкретного сервиса
npm run test --filter=@shopflow/auth-service

# Сборка только изменённых пакетов (Turborepo)
npm run build -- --filter=[HEAD^1]
```
