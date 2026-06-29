# ShopFlow — Learning Notes

> Конспект технологий, изученных в процессе разработки проекта.
> Пополняется с каждой сессией. Агент добавляет новые разделы по мере появления вопросов.

---

## Как использовать

Когда начинаешь новую сессию в Cursor, скажи агенту:
```
Прочитай /Users/dzianis/Dev/My Projects/shopflow/docs/LEARNING_NOTES.md
Добавь заметки по теме: {тема}
```

---

## Содержание

- [Turborepo](#turborepo)
- [ESLint Flat Config](#eslint-flat-config)
- [TypeScript в Monorepo](#typescript-в-monorepo)
- [npm Workspaces](#npm-workspaces)
- [Docker](#docker)
- [Kafka](#kafka)
- [gRPC](#grpc)
- [Zookeeper](#zookeeper)
- [Prisma](#prisma)
- [Environment Variables в Monorepo](#environment-variables-в-monorepo)
- [TypeScript rootDir — продвинутые случаи](#typescript-rootdir--продвинутые-случаи)

### Для собеседования — БД / Инфра / Архитектура

**База данных:**
- [CAP Theorem](#cap-theorem)
- [Consistency — Согласованность данных](#consistency--согласованность-данных)
- [Replication — Репликация](#replication--репликация)
- [SQL Optimization](#sql-optimization)
- [Race Conditions — Состояние гонки](#race-conditions--состояние-гонки)

**Инфраструктура:**
- [Queues — Очереди сообщений](#queues--очереди-сообщений)
- [Retries — Повторные попытки](#retries--повторные-попытки)
- [Idempotency — Идемпотентность](#idempotency--идемпотентность)

**Node.js / Runtime:**
- [Event Loop](#event-loop)
- [Memory Leaks — Утечки памяти](#memory-leaks--утечки-памяти)

---

## Turborepo

**Что это:** система сборки для JavaScript/TypeScript monorepo, написана на Rust. Ускоряет задачи через кеширование и параллельное выполнение.

### `turbo.json` — pipeline задач

Конфиг в формате `tasks` (Turborepo v2+, в v1 было `pipeline`):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": ["NODE_ENV", "DATABASE_URL"],
  "globalDependencies": ["tsconfig.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### `dependsOn` — порядок запуска

| Синтаксис | Смысл |
|---|---|
| `"^build"` | Сначала `build` во всех **пакетах-зависимостях** (топологический порядок) |
| `"codegen"` | Сначала `codegen` в **этом же пакете** |
| `"shared#build"` | Сначала `build` в **конкретном пакете** `shared` |

`^` — самое важное: если `auth-service` зависит от `@shopflow/common`, то `^build` гарантирует что `common` соберётся первым.

### Кеширование

- `outputs` — что кешировать (только явно указанные файлы)
- `cache: false` — для `dev` и `db:migrate` (результат не в файлах)
- `persistent: true` — для долгоживущих процессов (watch-режим)
- `globalDependencies` — если файл изменился, весь кеш инвалидируется
- `inputs` — точечный контроль: кеш инвалидируется только при изменении указанных файлов
- `!pattern` в outputs — исключение из glob (`!.next/cache/**`)

### Документация

- https://turbo.build/repo/docs
- [Configuring tasks](https://turbo.build/repo/docs/crafting-your-repository/configuring-tasks)
- [Caching](https://turbo.build/repo/docs/crafting-your-repository/caching)

---

## ESLint Flat Config

### v8 → v9 → v10: ключевые отличия

**v8 → v9 (главное изменение):**
- Старый формат: `.eslintrc.js` — deprecated
- Новый формат: `eslint.config.mjs` (flat config) — дефолт с v9
- `extends`, `plugins` как строки → только импорты объектов
- `env` (browser, node) → пакет `globals`
- `ignorePatterns` → объект `{ ignores: [...] }` в массиве
- `overrides` → несколько объектов в массиве с разными `files`

**v9 → v10:**
- `@eslint/js` стал отдельным пакетом (раньше встроен в eslint)
- Небольшие breaking changes в правилах

### Структура flat config

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // 1. Глобальные ignores
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**"] },

  // 2. Базовые правила для всего проекта
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // 3. Специфичные правила для NestJS
  {
    files: ["apps/auth-service/**/*.ts"],
    rules: { "no-console": "error" }, // используй Logger
  },

  // prettier ВСЕГДА последним — отключает конфликты форматирования
  prettier,
]);
```

### Ключевые пакеты

| Пакет | Зачем |
|---|---|
| `@eslint/js` | Базовые JS правила (раньше встроены в eslint) |
| `typescript-eslint` | TS парсер + правила + готовые конфиги |
| `eslint-config-prettier` | Отключает ESLint правила конфликтующие с Prettier |

### `typescript-eslint` — три уровня строгости

```js
tseslint.configs.recommended  // базовый
tseslint.configs.strict       // строже, ловит больше багов
tseslint.configs.stylistic    // правила стиля
```

### Порядок объектов в массиве

Каждый следующий объект **мёрджится поверх** предыдущего для файлов которые под него попадают. Поэтому `prettier` должен быть последним.

### Конвенция `_` для неиспользуемых переменных

```ts
// ESLint правило: argsIgnorePattern: "^_"
async getUserById(_userId: string) { // OK — намеренно не используется
  throw new Error('Not implemented');
}
```

---

## TypeScript в Monorepo

### Проблема: один корневой tsconfig на всех

Если пакет (`packages/common`) не имеет своего `tsconfig.json`, `tsc` ищет ближайший вверх по дереву — находит корневой. Корневой без `include` подхватывает **все** файлы monorepo. Результат: `packages/common/build` компилирует весь проект включая JSX из Next.js.

### Решение: tsconfig в каждом пакете

```
tsconfig.json                    ← корневой: только базовые опции, без include
packages/common/tsconfig.json    ← extends корневой + include: ["src/**/*"]
apps/auth-service/tsconfig.json  ← extends корневой + include: ["src/**/*"]
apps/web/tsconfig.json           ← отдельный (Next.js другой module system)
```

**Корневой tsconfig** — чистая база, никаких `include`, никаких `baseUrl`:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "module": "commonjs",
    "target": "ES2021",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

**Пакет (common, kafka):**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**NestJS app:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Next.js app** — не extends корневой (другой module system):
```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true
  }
}
```

### `rootDir` и пути к пакетам

Если NestJS tsconfig имеет `rootDir: "./src"` но `paths` указывает на `../../packages/common/src/index.ts` — TypeScript ругается:
```
File 'packages/common/src/index.ts' is not under 'rootDir' 'apps/auth-service/src'
```

**Решение:** не использовать `paths` в app tsconfig. TypeScript резолвит `@shopflow/common` через `node_modules` (npm workspaces создаёт symlink). Пакеты должны иметь `main: "./dist/index.js"` и быть собраны до приложений (Turborepo `dependsOn: ["^build"]` гарантирует это).

### `declarationMap: true`

Генерирует `.d.ts.map` файлы которые позволяют IDE (Cursor, VS Code) переходить из `.d.ts` декларации прямо в исходный `.ts` файл. Полезно для навигации по коду в monorepo.

---

## npm Workspaces

**Документация:** https://docs.npmjs.com/cli/v10/using-npm/workspaces

### Как работает

- Все `node_modules` хоистятся в корень — один `npm install` ставит зависимости всем пакетам
- Пакеты ссылаются друг на друга через symlinks: `@shopflow/common: "*"` → `packages/common/`
- `"*"` в версии = всегда брать локальную версию пакета

### Полезные команды

```bash
# Установить зависимость в конкретный пакет
npm install bcryptjs --workspace=apps/auth-service

# Запустить скрипт только в одном пакете
npm run build --workspace=packages/common

# Запустить во всех пакетах
npm run build --workspaces
```

### Конфликт версий в monorepo

Если разные пакеты требуют разные версии одной зависимости — npm ставит локальную копию в папку пакета. Это может вызвать `ERESOLVE` ошибки. Решение: привести все пакеты к одной мажорной версии.

---

---

## Docker

**Что это:** платформа для запуска приложений в изолированных контейнерах. Контейнер — это изолированный процесс со своей файловой системой, сетью и портами.

### Контейнер vs хост

Контейнер по умолчанию изолирован — снаружи до него не достучаться. Чтобы открыть доступ, нужно пробросить порт.

```yaml
ports:
  - "5432:5432"  # формат HOST:CONTAINER
```

Левая часть — порт на твоей машине. Правая — порт внутри контейнера. После этого `localhost:5432` на хосте → postgres внутри контейнера.

### Docker Compose — оркестрация нескольких контейнеров

Три секции верхнего уровня:

```yaml
version: "3.9"   # версия синтаксиса

services:        # контейнеры
  postgres:
    image: postgres:16-alpine
    ...

volumes:         # именованные тома для хранения данных
  postgres_data:
```

### Сеть между контейнерами

Docker Compose автоматически создаёт сеть и добавляет в неё все сервисы. Контейнеры видят друг друга **по имени сервиса**:

```yaml
# Kafka обращается к Zookeeper по имени сервиса, не по IP
KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
```

### Volumes — персистентность данных

Контейнер эфемерен — удалил, данные пропали. Volume хранит данные на диске хоста:

```yaml
volumes:
  - postgres_data:/var/lib/postgresql/data
  # том postgres_data (хост) ↔ /var/lib/postgresql/data (контейнер)
```

### Healthcheck

Позволяет Docker знать когда сервис **реально готов** (не просто запущен):

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U shopflow"]
  interval: 10s   # как часто проверять
  timeout: 5s     # максимальное время ожидания
  retries: 5      # сколько попыток до статуса unhealthy
```

### `depends_on` — две формы

```yaml
# Простая: ждёт только статус "running" (не значит "готов")
depends_on:
  - zookeeper

# С condition: ждёт успешного healthcheck (правильно)
depends_on:
  zookeeper:
    condition: service_healthy
```

### Profiles — разделение инфра и приложений

```yaml
services:
  auth-service:
    profiles: ["full"]   # запускается только с --profile full
```

Без `--profile full` поднимается только инфраструктура. В dev режиме NestJS сервисы запускаются через `npm run dev` на хосте — это быстрее (горячая перезагрузка, дебаггер, нет пересборки образа).

### Правило

> Сторонние сервисы (postgres, redis, kafka) = Docker.
> Твой код (NestJS, Next.js) = нативно на хосте в dev режиме.

### Полная схема ShopFlow

```
твоя машина (хост)
├── auth-service (npm) ──► localhost:5432 → postgres (Docker)
├── api-gateway (npm) ───► localhost:6379 → redis (Docker)
│                    ────► localhost:9092 → kafka (Docker)
│
└── Docker сеть (shopflow_default)
    ├── postgres    (5432 → 5432)
    ├── redis       (6379 → 6379)
    ├── zookeeper   (2181, только для kafka внутри)
    ├── kafka       (29092 внутри Docker, 9092 наружу)
    └── kafka-ui    (8080 → 8080, браузер)
```

---

## Kafka

**Что это:** распределённая платформа для обмена сообщениями через события. Producer публикует событие — один или несколько Consumers реагируют асинхронно.

### Зачем нужна

Без Kafka при оформлении заказа order-service должен сам вызывать payment-service, product-service, notification-service. Это жёсткая связанность — добавил новый сервис, меняй order-service.

С Kafka order-service публикует `order.created` и забывает. Кто хочет — подписывается:

```
order-service → Kafka: "order.created"
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        payment     product    notification
```

### Основные концепции

| Понятие | Смысл |
|---|---|
| **Topic** | Канал/тема. `order.created`, `payment.failed` — разные топики |
| **Producer** | Сервис который публикует сообщения в топик |
| **Consumer** | Сервис который читает и обрабатывает сообщения из топика |
| **Consumer Group** | Группа consumers которые вместе читают один топик (для масштабирования) |
| **Broker** | Один сервер Kafka |
| **Partition** | Топик делится на партиции для параллельной обработки |
| **Offset** | Порядковый номер сообщения. Kafka помнит где каждый consumer остановился |

### Kafka vs HTTP

| | HTTP / gRPC | Kafka |
|---|---|---|
| Тип | Синхронный | Асинхронный |
| Producer | Ждёт ответа | Не ждёт |
| Receiver упал | Ошибка | Сообщение ждёт в очереди |
| Хранение | Нет | До 7 дней на диске |

### Ключевое свойство

Kafka **хранит** сообщения на диске. Если notification-service лежал ночью — утром поднялся и обработал все пропущенные события. С HTTP это невозможно.

### Топики в ShopFlow

| Topic | Producer | Consumers |
|---|---|---|
| `user.registered` | auth-service | notification-service |
| `order.created` | order-service | payment-service, notification-service |
| `order.paid` | payment-service | order-service, notification-service |
| `order.cancelled` | order-service | notification-service, payment-service |
| `payment.failed` | payment-service | notification-service |
| `inventory.low` | product-service | notification-service |
| `order.shipped` | order-service | notification-service |

### Имена топиков — всегда константы

```typescript
// packages/kafka/src/index.ts
import { KAFKA_TOPICS } from '@shopflow/kafka'

// Правильно
producer.send({ topic: KAFKA_TOPICS.ORDER_CREATED, ... })

// Неправильно — опечатка не поймается до рантайма
producer.send({ topic: 'order.craeted', ... })
```

### NestJS паттерн

```typescript
// Producer
@Injectable()
export class OrderService {
  constructor(@Inject(KAFKA_CLIENT) private kafka: ClientKafka) {}

  async createOrder(dto: CreateOrderDto) {
    this.kafka.emit(KAFKA_TOPICS.ORDER_CREATED, { orderId, userId, items })
  }
}

// Consumer
@Controller()
export class PaymentController {
  @EventPattern(KAFKA_TOPICS.ORDER_CREATED)
  async handleOrderCreated(data: OrderCreatedEvent) {
    // обработка — всегда в try/catch, не бросать ошибки
  }
}
```

---

## gRPC

**Что это:** Google Remote Procedure Call — протокол для вызова функций на удалённом сервере как будто они локальные. Использует HTTP/2 и бинарный формат Protocol Buffers.

### Зачем в ShopFlow

Браузер не знает про gRPC — он общается с api-gateway по обычному REST/HTTP. Но внутри, между сервисами, api-gateway вызывает auth-service, product-service, order-service через gRPC.

```
Браузер → HTTP/REST → api-gateway → gRPC → auth-service
                                   → gRPC → order-service
```

### gRPC vs REST

| | REST | gRPC |
|---|---|---|
| Протокол | HTTP/1.1 | HTTP/2 |
| Формат данных | JSON (текст) | Protocol Buffers (бинарный, 5-10x меньше) |
| Контракт | документация / OpenAPI | `.proto` файл (source of truth) |
| Типизация | ручная | автогенерация TypeScript кода |
| Используется для | браузер ↔ api-gateway | сервис ↔ сервис |

### Proto файл — контракт

```protobuf
// packages/proto/proto/auth.proto
service AuthService {
  rpc ValidateToken (ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc GetUserById   (GetUserByIdRequest)   returns (UserResponse);
}

message ValidateTokenRequest {
  string token = 1;  // порядковый номер поля (важен для бинарного формата)
}

message ValidateTokenResponse {
  string user_id = 1;
  string email   = 2;
  string role    = 3;
}
```

Из этого файла генерируется TypeScript код для сервера и клиента:
```bash
npm run proto:generate
```

### NestJS паттерн

```typescript
// auth-service: сервер
@Controller()
export class AuthController {
  @GrpcMethod('AuthService', 'ValidateToken')
  validateToken(data: ValidateTokenRequest): ValidateTokenResponse {
    return this.authService.validate(data.token)
  }
}

// api-gateway: клиент
@Injectable()
export class AuthGrpcClient {
  constructor(
    @Inject(AUTH_SERVICE) private client: ClientGrpc
  ) {}

  validateToken(token: string) {
    return this.authService.validateToken({ token })
  }
}
```

### Правило проекта (ADR-002)

> **gRPC** — для request/response: нужен ответ прямо сейчас.
> **Kafka** — для событий: важно что обработается, но не обязательно сразу.
> **Никогда** не вызывать другой сервис через HTTP — только gRPC или Kafka.

---

## Zookeeper

**Что это:** централизованный координатор для распределённых систем. В контексте ShopFlow — необходим для работы Kafka.

### Зачем Kafka нужен Zookeeper

Kafka — это кластер брокеров. Кто-то должен знать:
- Кто из брокеров сейчас leader?
- На каком брокере какие партиции топиков?
- Какие consumer groups существуют?

Это и есть Zookeeper — хранит метаданные кластера и координирует брокеры.

Аналогия: Kafka — склад с кладовщиками. Zookeeper — директор склада, который знает кто за что отвечает.

### KRaft — Kafka без Zookeeper

С версии Kafka 2.8+ появился **KRaft mode** — брокеры сами выбирают лидера без внешнего координатора (Raft алгоритм консенсуса). В ShopFlow используется Zookeeper потому что он проще в настройке для учебного проекта.

### Healthcheck для Zookeeper

Zookeeper понимает специальную команду `ruok` ("are you ok?"). Если отвечает `imok` — готов:

```yaml
healthcheck:
  test: ["CMD-SHELL", "echo ruok | nc localhost 2181"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

---

## Prisma

**Что это:** ORM для TypeScript/Node.js. Схема пишется в `schema.prisma`, из неё генерируется типизированный клиент. Prisma CLI управляет миграциями БД.

### Три компонента

| Компонент | Что делает |
|---|---|
| **Prisma Schema** | Описывает модели данных (таблицы, поля, связи) |
| **Prisma Migrate** | Генерирует и применяет SQL миграции из изменений схемы |
| **Prisma Client** | Типизированный ORM-клиент для запросов |

### schema.prisma — структура файла

```prisma
// 1. Конфигурация генератора клиента
generator client {
  provider = "prisma-client"      // Prisma 7
  output   = "../generated/client"
}

// 2. Источник данных (в Prisma 7 URL убран отсюда в prisma.config.ts!)
datasource db {
  provider = "postgresql"
}

// 3. Модели
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders    Order[]  // relation — один ко многим
}
```

### Типы ID

```prisma
id Int    @id @default(autoincrement())  // числовой, простой
id String @id @default(cuid())           // строковый, безопасен для URL, случайный
id String @id @default(uuid())           // UUID формат
```

`cuid()` — предпочтительный выбор для публичных API: нет числовой предсказуемости, короче UUID.

### Связи (Relations)

```prisma
model User {
  id     String  @id @default(cuid())
  orders Order[] // "один ко многим": у User много Orders
}

model Order {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  //                       ↑ внешний ключ  ↑ на что ссылается  ↑ удалить связанные при удалении user
}
```

**`onDelete: Cascade`** — если удалить `User`, все его `Order` тоже удалятся автоматически.

### Именование: `@map` и `@@map`

По конвенции TypeScript использует `camelCase`, PostgreSQL — `snake_case`. Prisma позволяет маппить:

```prisma
model User {
  createdAt DateTime @default(now()) @map("created_at")  // поле → колонка
}

model RefreshToken {
  @@map("refresh_tokens")  // модель → таблица
}
```

### Prisma v5 vs v7 — ключевые отличия

| | Prisma v5 | Prisma v7 |
|---|---|---|
| **URL в schema** | `datasource db { url = env("DATABASE_URL") }` | Убран! Переехал в `prisma.config.ts` |
| **Generator** | `provider = "prisma-client-js"` | `provider = "prisma-client"` |
| **PrismaClient** | `new PrismaClient()` — сам открывает соединение | Требует явный `adapter` (driver adapter) |
| **Конфиг** | Всё в schema | `prisma.config.ts` для datasource URL |

### prisma.config.ts (Prisma 7)

Новый файл, живёт в **корне пакета** (`packages/prisma/prisma.config.ts`). Prisma CLI ищет его при запуске.

```typescript
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL! },
});
```

`process.env.DATABASE_URL` — берётся из окружения. В monorepo env переменные грузит `dotenv-cli` через npm scripts (см. раздел [Environment Variables](#environment-variables-в-monorepo)).

**Важно:** не нужно вызывать `config()` из `dotenv` внутри `prisma.config.ts` — Prisma 7 сама управляет загрузкой и это вызовет ошибку `call config.load() before reading values`.

### Driver Adapters (Prisma 7)

В Prisma 7 клиент не создаёт соединение сам — нужен адаптер который передаёт реальный pool соединений:

```typescript
import { PrismaClient } from '../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

Пакеты: `@prisma/adapter-pg` + `pg` (для PostgreSQL).

### PrismaService в NestJS

Стандартный паттерн — `PrismaService` расширяет `PrismaClient` и использует lifecycle hooks NestJS:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/client/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); await this.pool.end(); }
}
```

- `OnModuleInit` — срабатывает при старте NestJS модуля (подключаемся к БД)
- `OnModuleDestroy` — при завершении (закрываем соединения, освобождаем pool)

### PrismaModule — глобальный модуль

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // делает PrismaService доступным везде без повторного импорта
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` — один раз импортируй `PrismaModule` в `AppModule`, и `PrismaService` доступен во всех других модулях приложения через DI без повторного импорта.

### Migrations — как работает

```
schema.prisma изменился
        ↓
prisma migrate dev --name add_orders
        ↓
Prisma сравнивает schema ↔ БД
        ↓
Генерирует SQL: packages/prisma/prisma/migrations/20241215_add_orders/migration.sql
        ↓
Применяет SQL к БД
        ↓
Обновляет _prisma_migrations таблицу (журнал)
```

Папка `migrations/` коммитится в git — это история изменений схемы БД. `generated/` — нет, добавляется в `.gitignore`.

### Команды (всегда через npm scripts!)

```bash
npm run db:migrate -- --name init   # создать и применить миграцию
npm run db:generate                 # перегенерировать клиент без миграции
npm run db:status                   # статус миграций
npm run db:studio                   # GUI для БД (Prisma Studio)
```

**Никогда не запускать `npx prisma ...` напрямую в monorepo** — переменные окружения не загрузятся (см. раздел про dotenv-cli).

### Advisory Lock — что делать если зависло

```
P1002: The database server at `localhost:5433` was reached but timed out.
```

Это Prisma держит advisory lock (блокировку БД) от прошлой незавершённой миграции. Решение:

```bash
# Найти и убить зависшие процессы
pkill -f "prisma migrate"

# Затем повторить команду
npm run db:migrate -- --name init
```

### Документация

- https://www.prisma.io/docs/orm/prisma-schema
- https://www.prisma.io/docs/orm/prisma-migrate
- [Prisma 7 migration guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)

---

## Environment Variables в Monorepo

### Проблема: три разных инструмента, три разных способа

В monorepo с NestJS и Prisma CLI есть несколько инструментов, и каждый грузит env по-своему:

| Инструмент | Как грузит `.env` |
|---|---|
| **Node.js** (plain) | Никак — только `process.env` системного окружения |
| **NestJS `ConfigModule`** | Автоматически читает `.env` в корне **приложения** |
| **Prisma CLI (v5)** | Автоматически читает `.env` в корне **пакета** |
| **Prisma CLI (v7)** | Читает `process.env` на момент выполнения `prisma.config.ts` |

Проблема: root `.env` лежит в `/shopflow/.env`, а Prisma CLI запускается из `/shopflow/packages/prisma/` — файл не найден автоматически.

### dotenv-cli — решение для CLI инструментов

`dotenv-cli` — утилита командной строки которая загружает `.env` файл и прокидывает переменные в дочерний процесс.

```bash
# Синтаксис
dotenv -e путь/к/.env -- команда

# Пример
dotenv -e ../../.env -- prisma migrate dev
```

Установка в пакет:
```bash
npm install dotenv-cli --save-dev --workspace=packages/prisma
```

В `packages/prisma/package.json`:
```json
{
  "scripts": {
    "db:migrate":  "dotenv -e ../../.env -- prisma migrate dev",
    "db:generate": "dotenv -e ../../.env -- prisma generate",
    "db:status":   "dotenv -e ../../.env -- prisma migrate status",
    "db:studio":   "dotenv -e ../../.env -- prisma studio"
  }
}
```

Теперь `npm run db:migrate` → `dotenv` читает `../../.env` → прокидывает `DATABASE_URL` → запускает `prisma migrate dev` с уже загруженными переменными.

### NestJS ConfigModule — envFilePath антипаттерн

`ConfigModule` умеет читать `.env` из кастомного пути:

```typescript
// ❌ АНТИПАТТЕРН — хардкод относительного пути
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '../../.env', // ломается при изменении структуры проекта
})

// ✅ ПРАВИЛЬНО — просто isGlobal: true
ConfigModule.forRoot({ isGlobal: true })
```

Почему без `envFilePath` работает? В dev режиме NestJS приложения запускаются через `turbo dev` из корня monorepo. Node.js наследует системное окружение, а если `.env` не загружен заранее — NestJS `ConfigModule` автоматически ищет `.env` в **текущей рабочей директории**, которая при запуске через turbo — корень monorepo.

Хардкод `../../.env` — это "костыль": путь считается относительно `process.cwd()`, который зависит от **откуда** запускается процесс. Если структура папок изменится, путь сломается.

### Схема загрузки env в ShopFlow

```
/.env (корень monorepo)
  │
  ├─ NestJS apps (api-gateway, auth-service)
  │    └─ ConfigModule.forRoot({ isGlobal: true })
  │       NestJS читает .env из cwd (= корень) при запуске через turbo
  │
  └─ packages/prisma
       └─ npm scripts: "dotenv -e ../../.env -- prisma migrate dev"
          dotenv-cli явно указывает путь до корневого .env
```

### DATABASE_URL формат

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE

postgresql://shopflow:shopflow_dev@localhost:5433/shopflow
             ↑       ↑             ↑         ↑    ↑
             user    password      host      port  db name
```

Порт `5433` (не стандартный `5432`) — чтобы избежать конфликта с локально установленным PostgreSQL (Homebrew, системным).

### Конфликт портов — как решить

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5433:5432"  # ← левая часть = порт на хосте (меняем с 5432 на 5433)
```

```
# .env
DATABASE_URL=postgresql://shopflow:shopflow_dev@localhost:5433/shopflow
#                                                          ↑
#                                                      обновить порт
```

После изменения `docker-compose.yml` нужно пересоздать контейнер:

```bash
docker compose down
docker compose up -d
```

---

## TypeScript rootDir — продвинутые случаи

### Проблема: generated файлы вне src/

Стандартная конфигурация пакета:
```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  }
}
```

Проблема возникает когда код в `src/` импортирует файлы **вне** `src/`:

```typescript
// packages/prisma/src/prisma.service.ts
import { PrismaClient } from '../generated/client/client';
//                           ↑ файл находится в packages/prisma/generated/
//                             это за пределами rootDir: "./src"
```

Ошибка TypeScript:
```
error TS6059: File 'packages/prisma/generated/client/client.ts' is not under 'rootDir' 'src'.
```

### Решение: расширить rootDir до "."

```json
// packages/prisma/tsconfig.json
{
  "compilerOptions": {
    "rootDir": ".",        // ← весь пакет, не только src/
    "outDir": "./dist"
  },
  "include": ["src/**/*", "generated/**/*"]
}
```

Это означает: TypeScript компилирует всё начиная с корня пакета. Структура `dist/` зеркалит структуру исходников:

```
src/index.ts          → dist/src/index.js
generated/client.ts   → dist/generated/client.js
```

Поэтому нужно обновить `main` и `types` в `package.json`:

```json
{
  "main":  "./dist/src/index.js",   // ← было ./dist/index.js
  "types": "./dist/src/index.d.ts"  // ← было ./dist/index.d.ts
}
```

### Когда это нужно

| Ситуация | rootDir |
|---|---|
| Весь код в `src/`, нет внешних импортов | `"./src"` |
| Код в `src/` импортирует generated-файлы вне `src/` | `"."` |
| Несколько корневых директорий (`src/`, `test/`) | `rootDirs: ["src", "test"]` |

---

---

# Для собеседования — БД / Инфра / Архитектура

---

## CAP Theorem

### Простым языком

Представь что у тебя два сервера с одними и теми же данными. Пользователь написал на сервер 1. Сервер 2 ещё не знает об этом. В этот момент кто-то читает с сервера 2 — что вернуть?

CAP говорит: в распределённой системе одновременно можно гарантировать только **два из трёх** свойств:

- **C — Consistency (Согласованность):** все узлы видят одни и те же данные в один момент времени
- **A — Availability (Доступность):** система всегда отвечает на запрос (пусть и устаревшими данными)
- **P — Partition Tolerance (Устойчивость к разделению):** система продолжает работать даже если связь между узлами прервана

### Важное уточнение

**P (Partition Tolerance) в реальности не опциональна.** Сеть всегда может разорваться. Поэтому настоящий выбор всегда между **CP** и **AP**:

- **CP** — при разрыве сети: запрещаем запись/чтение до восстановления связи. Данные всегда консистентны, но система недоступна.
- **AP** — при разрыве сети: разрешаем читать/писать на любой узел. Система доступна, но данные на разных узлах могут расходиться.

### PostgreSQL vs MongoDB

| | PostgreSQL | MongoDB |
|---|---|---|
| Модель | **CP** (по умолчанию) | **AP** (по умолчанию) |
| При разрыве сети | Отклоняет записи на реплику | Принимает записи, потом синхронизирует |
| Консистентность | Строгая (ACID) | Eventual (настраиваемая) |
| Доступность | Ниже при сбоях | Выше при сбоях |

**PostgreSQL (CP):** пишешь всегда на primary. Если primary недоступен — запись падает с ошибкой. Зато данные никогда не расходятся.

**MongoDB (AP):** в режиме replica set с `writeConcern: { w: 1 }` — пишешь на primary, но читать можно с реплики которая могла не получить последнее обновление.

### Пример из ShopFlow

**Почему мы выбрали PostgreSQL:**

Платёж — это деньги. Если списание прошло на одном узле а заказ не обновился на другом — бизнес потерял деньги или клиент получил двойной заказ. Строгая консистентность (CP) здесь важнее доступности.

```
Сценарий с MongoDB (AP) при разрыве сети:
  Узел A: Payment { status: "PAID", orderId: "123" }
  Узел B: Payment { status: "PENDING", orderId: "123" }  ← клиент читает с B
  Результат: клиент видит "оплата не прошла" и платит снова 💸

Сценарий с PostgreSQL (CP) при разрыве сети:
  Primary недоступен → запрос на чтение/запись падает с ошибкой
  Результат: клиент видит "сервис временно недоступен" → retry
```

### Когда MongoDB лучше

MongoDB (AP) подходит когда доступность важнее консистентности:
- Аналитика, счётчики просмотров (небольшое расхождение нестрашно)
- Каталог товаров — цена устарела на секунду, не критично
- Логи, события — eventual consistency приемлема

### На собеседовании скажи

> "CAP — это теоретическая модель, а не жёсткий выбор. На практике выбираешь между CP и AP, потому что P всегда присутствует. PostgreSQL — CP база с ACID гарантиями, подходит для финансовых операций. MongoDB — AP по умолчанию, но можно настроить writeConcern и readConcern для более строгой консистентности. В ShopFlow я выбрал PostgreSQL для платёжных данных именно из-за CP гарантий."

---

## Consistency — Согласованность данных

### Простым языком

Ты записал данные. Когда другой человек их прочитает — он увидит именно то что ты записал? Или возможно увидит старое?

### Уровни консистентности

**Strong Consistency (Строгая):** читаешь — всегда видишь последнее записанное значение. Любой запрос к любому узлу вернёт актуальные данные.

**Eventual Consistency (Итоговая):** данные в конечном счёте станут одинаковыми на всех узлах, но не мгновенно. Пока идёт синхронизация — разные узлы могут отдавать разные данные.

**Read-your-writes:** ты всегда видишь свои собственные записи. Другие пользователи могут видеть старое — ты нет.

**Causal Consistency:** если A произошло до B, все узлы видят А до B. Причинно-следственный порядок сохранён.

### PostgreSQL — ACID и уровни изоляции

PostgreSQL даёт строгую консистентность через **ACID** и **уровни изоляции транзакций**: **Уровни изоляции** (read committed, repeatable read, serializable,read uncommitted,)

```sql
-- READ COMMITTED (дефолт): видишь только закоммиченные данные
-- Проблема: non-repeatable read — два SELECT в одной транзакции могут вернуть разное
BEGIN;
SELECT balance FROM wallets WHERE id = 1; -- вернул 100
-- другая транзакция списала 50 и закоммитила
SELECT balance FROM wallets WHERE id = 1; -- вернул 50 ← разные результаты!
COMMIT;

-- REPEATABLE READ: снимок данных на момент начала транзакции
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM wallets WHERE id = 1; -- вернул 100
-- другая транзакция списала 50 и закоммитила
SELECT balance FROM wallets WHERE id = 1; -- вернул 100 ← стабильно
COMMIT;

-- SERIALIZABLE: максимальная изоляция, транзакции как будто выполняются последовательно
-- Самый безопасный, но и самый медленный
```

### MongoDB — настройка консистентности

По умолчанию MongoDB eventual consistent, но можно настроить:

```javascript
// writeConcern: сколько реплик должны подтвердить запись
db.orders.insertOne(
  { orderId: '123', status: 'PAID' },
  { writeConcern: { w: 'majority', j: true } }
  // w: 'majority' — большинство реплик подтвердили
  // j: true — запись на диск (журнал), не только в память
)

// readConcern: какие данные читать
db.orders.findOne(
  { orderId: '123' },
  { readConcern: { level: 'majority' } }
  // читаем только то что подтверждено большинством реплик
)
```

### Пример из ShopFlow: Payment idempotency

```typescript
// payment-service: создание платежа
// Нужна строгая консистентность — нельзя списать дважды

// PostgreSQL с транзакцией
await prisma.$transaction(async (tx) => {
  // Проверяем — платёж с таким ключом уже есть?
  const existing = await tx.payment.findUnique({
    where: { idempotencyKey: dto.idempotencyKey }
  })
  if (existing) return existing  // вернуть существующий, не создавать новый

  // Создаём платёж
  const payment = await tx.payment.create({
    data: { orderId: dto.orderId, amount: dto.amount, idempotencyKey: dto.idempotencyKey }
  })

  return payment
})
// Транзакция гарантирует: если два одинаковых запроса пришли одновременно —
// только один создаст платёж, второй получит existing
```

### На собеседовании скажи

> "Consistency — это гарантия что все узлы системы видят одни и те же данные. PostgreSQL даёт строгую консистентность через ACID и уровни изоляции транзакций. По умолчанию READ COMMITTED, но для критичных операций (платежи, инвентарь) нужен REPEATABLE READ или SERIALIZABLE. MongoDB по умолчанию eventual consistent, но `writeConcern: majority` и `readConcern: majority` дают близкий к строгому уровень. Для платёжных операций я всегда выбираю PostgreSQL."

---

## Replication — Репликация

### Простым языком

Репликация — это когда одни и те же данные хранятся на нескольких серверах одновременно. Зачем?

1. **Отказоустойчивость:** упал один сервер — читаем с другого
2. **Масштабирование чтения:** много запросов на чтение — распределяем между репликами
3. **Бэкапы:** реплика = живой бэкап

### PostgreSQL Replication

**Streaming Replication (физическая):**
```
Primary (читаем + пишем)
    │
    │ WAL stream (Write-Ahead Log — лог всех изменений в бинарном виде)
    │
    ├── Replica 1 (только чтение)
    └── Replica 2 (только чтение)
```

Primary пишет все изменения в WAL лог, реплики получают этот лог и применяют у себя. Это **физическая** репликация — копируется весь блок данных побайтово.

**Logical Replication:**
Копируются только отдельные таблицы или строки, в виде SQL-операций. Нужна когда реплики разной версии PostgreSQL или нужно реплицировать не весь кластер.

```sql
-- На primary: создать publication
CREATE PUBLICATION shopflow_pub FOR TABLE orders, payments;

-- На replica: подписаться
CREATE SUBSCRIPTION shopflow_sub
  CONNECTION 'host=primary dbname=shopflow'
  PUBLICATION shopflow_pub;
```

**Failover:** если primary упал, одна из реплик повышается до primary. В managed решениях (AWS RDS, Supabase) это автоматически. Вручную — через pg_promote().

### MongoDB Replication — Replica Set

```
Primary (читаем + пишем)
    │
    │ Oplog (операционный журнал)
    │
    ├── Secondary 1 (можно читать)
    ├── Secondary 2 (можно читать)
    └── Arbiter    (только голосует в выборах, данных нет)
```

MongoDB replica set — минимум 3 узла (или 2 + arbiter). При падении primary — secondaries голосуют и выбирают нового primary автоматически (Raft-подобный алгоритм).

**Чтение с реплик в MongoDB:**
```javascript
// По умолчанию: читаем только с primary
const client = new MongoClient(uri, {
  readPreference: 'primary'  // дефолт
})

// Читаем с ближайшего узла (может быть устаревшим)
const client = new MongoClient(uri, {
  readPreference: 'nearest'
})

// Читаем с secondary (снижаем нагрузку на primary)
const client = new MongoClient(uri, {
  readPreference: 'secondaryPreferred'
})
```

### PostgreSQL vs MongoDB Replication

| | PostgreSQL | MongoDB |
|---|---|---|
| Тип репликации | Streaming WAL (физическая) | Oplog (логическая) |
| Минимум узлов | 2 (primary + replica) | 3 (primary + 2 secondary) |
| Автофailover | Нет (нужен Patroni/pg_auto_failover) | Да, встроен |
| Чтение с реплик | Ручная настройка (pgBouncer) | Встроенный readPreference |
| Задержка репликации | Миллисекунды | Миллисекунды |

### Пример из ShopFlow (продакшн — Sprint 7)

```
AWS RDS PostgreSQL Multi-AZ:
  Primary (us-east-1a) ← пишем и читаем
       │  синхронная репликация
  Standby (us-east-1b) ← failover за ~30сек при падении primary

  Read Replica (us-east-1c) ← аналитические запросы (тяжёлые SELECT)
```

```typescript
// В ShopFlow: тяжёлые аналитические запросы — на read replica
// Платёжные операции — только primary

// prisma.config.ts
datasource db {
  url = env("DATABASE_URL")           // primary — для записи
  // в реальном проекте добавить:
  // relationMode = "prisma"
}

// Для read replica — отдельный PrismaClient или connection pool
const analyticsDb = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_REPLICA_URL } }
})
```

### На собеседовании скажи

> "Репликация — копирование данных на несколько узлов для отказоустойчивости и масштабирования чтения. PostgreSQL использует WAL streaming — физическую репликацию, быструю и надёжную, но автофailover требует внешних инструментов типа Patroni. MongoDB replica set имеет встроенный автофailover через Raft-подобные выборы. В продакшн ShopFlow я бы использовал AWS RDS Multi-AZ для PostgreSQL — managed сервис берёт failover на себя."

---

## SQL Optimization

### Простым языком

Запрос работает медленно. Нужно понять почему и исправить. Главный инструмент — `EXPLAIN ANALYZE`.

### EXPLAIN ANALYZE — читаем план запроса

```sql
-- Медленный запрос: найти все заказы пользователя
EXPLAIN ANALYZE
SELECT o.*, oi.* FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = 'usr_123'
ORDER BY o.created_at DESC;
```

Вывод:
```
Seq Scan on orders (cost=0.00..1234.56 rows=5000) (actual time=0.1..45.3 rows=5000)
  Filter: (user_id = 'usr_123')
Rows Removed by Filter: 95000
Planning Time: 0.5 ms
Execution Time: 46.2 ms
```

**Seq Scan** — PostgreSQL читает ВСЮ таблицу и фильтрует. Это плохо при большой таблице.

После добавления индекса:
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

```
Index Scan using idx_orders_user_id on orders (cost=0.43..8.45 rows=3)
  Index Cond: (user_id = 'usr_123')
Planning Time: 0.3 ms
Execution Time: 0.4 ms   ← в 100 раз быстрее!
```

### Индексы — главный инструмент оптимизации

**Когда создавать индекс:**
- Поля в `WHERE` условиях
- Поля в `JOIN ON`
- Поля в `ORDER BY`
- Поля в `GROUP BY`

**Типы индексов PostgreSQL:**

```sql
-- B-tree (дефолт): для =, <, >, BETWEEN, LIKE 'prefix%'
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Composite (составной): для запросов по нескольким полям
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- Порядок важен: запрос WHERE user_id = X AND status = Y использует индекс
-- Запрос WHERE status = Y (без user_id) — НЕ использует этот индекс

-- Partial (частичный): индекс только по подмножеству строк
CREATE INDEX idx_orders_pending ON orders(created_at)
  WHERE status = 'PENDING';
-- Меньше размер индекса, быстрее для конкретного запроса

-- GIN: для полнотекстового поиска, массивов, JSONB
CREATE INDEX idx_products_tags ON products USING GIN(tags);
```

**Когда индекс НЕ помогает:**
- Маленькие таблицы (Seq Scan быстрее)
- Поля с низкой кардинальностью (например `status` с 3 значениями — индекс бесполезен)
- `LIKE '%suffix'` — не использует B-tree индекс
- Функции над полем: `WHERE LOWER(email) = 'test@test.com'` — не использует индекс на `email`

```sql
-- Правильно: function-based index
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
WHERE LOWER(email) = 'test@test.com';  -- теперь использует индекс
```

### N+1 проблема — самая частая ошибка

```typescript
// ПЛОХО: N+1 запросов
const orders = await prisma.order.findMany() // 1 запрос
for (const order of orders) {
  const items = await prisma.orderItem.findMany({  // N запросов
    where: { orderId: order.id }
  })
}
// 1 + N запросов к БД = катастрофа при большом N

// ХОРОШО: один запрос с JOIN
const orders = await prisma.order.findMany({
  include: { items: true }  // Prisma делает JOIN автоматически
})

// Или явный JOIN в SQL:
SELECT o.*, json_agg(oi.*) as items
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;
```

### Оптимизация в ShopFlow

```typescript
// product-service: поиск товаров с фильтрами
// Медленно:
await prisma.product.findMany({
  where: { categoryId, isActive: true },
  orderBy: { createdAt: 'desc' }
})

// Индексы для этого запроса:
// @@index([categoryId, isActive, createdAt])  ← composite index в schema.prisma
```

```prisma
// packages/prisma/schema.prisma
model Product {
  id         String   @id @default(cuid())
  categoryId String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@index([categoryId, isActive, createdAt(sort: Desc)])
  @@index([name])  // для поиска по названию
}
```

### Pagination — LIMIT/OFFSET vs Cursor

```sql
-- OFFSET pagination: медленно на больших данных
-- При OFFSET 10000 PostgreSQL читает 10000 строк и выбрасывает
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 10000;

-- Cursor pagination: всегда быстро
-- Берём id последнего элемента предыдущей страницы
SELECT * FROM products
WHERE created_at < '2024-01-15T12:00:00Z'  -- курсор
ORDER BY created_at DESC
LIMIT 20;
-- Использует индекс по created_at, не читает лишних строк
```

### MongoDB: explain() и индексы

```javascript
// MongoDB аналог EXPLAIN ANALYZE
db.orders.find({ userId: 'usr_123' }).explain('executionStats')

// Результат без индекса:
// totalDocsExamined: 100000  ← плохо, читает все документы
// totalKeysExamined: 0

// После создания индекса:
db.orders.createIndex({ userId: 1, createdAt: -1 })
// totalDocsExamined: 5  ← отлично
// totalKeysExamined: 5

// Compound index в MongoDB: порядок полей важен так же как в PostgreSQL
// ESR rule: Equality → Sort → Range
db.orders.createIndex({
  userId: 1,    // Equality (точное совпадение)
  status: 1,    // Sort (сортировка)
  createdAt: -1 // Range (диапазон)
})
```

### На собеседовании скажи

> "Первый шаг оптимизации — EXPLAIN ANALYZE, смотрю на Seq Scan и стоимость. Главные инструменты: индексы (composite для запросов с несколькими условиями, partial для подмножеств данных), устранение N+1 через JOIN или include, cursor-based pagination вместо OFFSET. В MongoDB аналогичный подход — explain() и createIndex(). Важно не переиндексировать — каждый индекс замедляет INSERT/UPDATE, поэтому добавляю только под реальные медленные запросы."

---

## Race Conditions — Состояние гонки

### Простым языком

Два процесса одновременно читают одно значение, оба решают его изменить, оба пишут — один затирает другого. В итоге данные неконсистентны.

Классический пример: два пользователя покупают последний товар одновременно.

```
Время →
User A: читает stock=1 → решает купить → пишет stock=0 ✓
User B: читает stock=1 → решает купить → пишет stock=0 ✓
Результат: оба купили, но товар был один. stock=-1 в реальности 💥
```

### Решение 1: Pessimistic Locking (пессимистическая блокировка)

"Блокирую строку пока работаю с ней — никто другой не может читать/писать"

```sql
-- PostgreSQL: SELECT FOR UPDATE
BEGIN;
SELECT stock FROM products WHERE id = 'prod_123' FOR UPDATE;
-- Строка заблокирована. Другие транзакции ждут.

-- Если stock > 0 — делаем покупку
UPDATE products SET stock = stock - 1 WHERE id = 'prod_123';
COMMIT;
-- Блокировка снята
```

```typescript
// Prisma: pessimistic locking
await prisma.$transaction(async (tx) => {
  const product = await tx.$queryRaw`
    SELECT * FROM products WHERE id = ${productId} FOR UPDATE
  `
  if (product.stock <= 0) throw new Error('Out of stock')
  await tx.product.update({
    where: { id: productId },
    data: { stock: { decrement: 1 } }
  })
})
```

**Минус:** при высокой конкурентности — очередь из ожидающих транзакций, deadlock риск.

### Решение 2: Optimistic Locking (оптимистическая блокировка)

"Предполагаю что конфликтов нет. Но при записи проверяю — не изменил ли кто-то данные пока я работал?"

```sql
-- PostgreSQL: version field
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 'prod_123' AND version = 5;  -- ← проверяем версию

-- Если rowsAffected = 0 → кто-то изменил данные → retry
```

```typescript
// Prisma: optimistic locking через version
model Product {
  id      String @id
  stock   Int
  version Int    @default(0)
}

async function decrementStock(productId: string, currentVersion: number) {
  const result = await prisma.product.updateMany({
    where: { id: productId, version: currentVersion },
    data: { stock: { decrement: 1 }, version: { increment: 1 } }
  })

  if (result.count === 0) {
    throw new ConflictException('Data was modified, please retry')
  }
}
```

**Плюс:** нет блокировок, высокая конкурентность. **Минус:** нужно обрабатывать retry.

### Решение 3: Atomic операции

```sql
-- PostgreSQL: атомарное условное обновление
UPDATE products
SET stock = stock - 1
WHERE id = 'prod_123' AND stock > 0;
-- Если stock уже 0 — rowsAffected = 0, ничего не изменилось

-- Проверяем результат
-- rowsAffected = 1 → успех
-- rowsAffected = 0 → товар закончился
```

```javascript
// MongoDB: findOneAndUpdate атомарный
const result = await db.products.findOneAndUpdate(
  { _id: productId, stock: { $gt: 0 } },  // условие
  { $inc: { stock: -1 } },                 // атомарное уменьшение
  { returnDocument: 'after' }
)

if (!result.value) {
  throw new Error('Out of stock')
}
```

### Решение 4: Redis для высоконагруженных операций

```typescript
// Distributed lock через Redis
// Используется когда несколько инстансов сервиса конкурируют

import { Inject } from '@nestjs/common'
import { Redis } from 'ioredis'

async function purchaseWithLock(productId: string, userId: string) {
  const lockKey = `lock:product:${productId}`
  const lockValue = `${userId}:${Date.now()}`

  // Взять lock (SET NX EX = set if not exists, expire 5s)
  const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', 5)

  if (!acquired) {
    throw new Error('Product is being purchased, try again')
  }

  try {
    // Только один процесс здесь в любой момент времени
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (product.stock <= 0) throw new Error('Out of stock')
    await prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: 1 } }
    })
  } finally {
    // Освободить lock (только если мы его держим)
    const current = await redis.get(lockKey)
    if (current === lockValue) await redis.del(lockKey)
  }
}
```

### Race condition в Kafka

```typescript
// Проблема: два инстанса order-service обрабатывают одно событие
// Kafka гарантирует: одно сообщение = один consumer в группе
// Но при ребалансировке — возможно дублирование

// Решение: idempotent обработка (см. раздел Idempotency)
@EventPattern(KAFKA_TOPICS.ORDER_PAID)
async handleOrderPaid(event: OrderPaidEvent) {
  // Используем orderId как idempotency key
  await prisma.order.updateMany({
    where: { id: event.orderId, status: 'PENDING' },  // только если PENDING
    data: { status: 'PAID' }
  })
  // Если статус уже PAID — updateMany вернёт count=0, ничего не сломается
}
```

### На собеседовании скажи

> "Race condition — когда два процесса одновременно читают и изменяют одни данные, один перезаписывает другого. Решения: pessimistic locking (SELECT FOR UPDATE) — надёжно но медленно при конкурентности; optimistic locking (version field) — быстро но нужен retry механизм; atomic operations (UPDATE WHERE stock > 0) — лучший вариант для простых случаев; distributed lock через Redis — когда несколько инстансов сервиса. В ShopFlow для декремента склада я использую atomic UPDATE с проверкой stock > 0 — минимум блокировок, максимум производительности."

---

## Queues — Очереди сообщений

### Простым языком

Очередь — это буфер между тем кто создаёт работу (producer) и тем кто её выполняет (consumer). Producer не ждёт пока consumer обработает — просто кладёт задачу в очередь и идёт дальше.

### Зачем нужны очереди

**1. Развязка (Decoupling):** order-service не знает и не зависит от того, сколько сервисов слушают его события.

**2. Надёжность:** если notification-service упал — письма не потеряются, они ждут в очереди.

**3. Выравнивание нагрузки:** в Black Friday заказов в 100x больше. Очередь принимает все, payment-service обрабатывает по возможностям.

```
Без очереди:                    С очередью (Kafka):
order-service пишет 1000 rps    order-service пишет 1000 rps в Kafka
    ↓ напрямую                      ↓ асинхронно
payment-service умирает         payment-service читает 100 rps
от нагрузки 💥                  Kafka хранит остальное, всё ок ✓
```

### Kafka vs BullMQ (Redis Queue)

| | Kafka | BullMQ (Redis) |
|---|---|---|
| Хранение | Диск (дни/недели) | Память Redis (TTL) |
| Throughput | Миллионы сообщений/сек | Тысячи сообщений/сек |
| Replay | Да (можно перечитать старые) | Нет (после обработки удаляется) |
| Несколько consumer groups | Да | Ограниченно |
| Сложность | Высокая (ZooKeeper/KRaft) | Низкая |
| Подходит для | Микросервисы, высокая нагрузка | Фоновые задачи в монолите |

**В ShopFlow мы выбрали Kafka** (ADR-004) — потому что цель учебного проекта изучить именно Kafka. В реальном проекте с одним сервисом BullMQ проще.

### Паттерны очередей

**Fan-out (один producer → много consumers):**
```
order.created → payment-service
             → product-service (уменьшить склад)
             → notification-service
```
В Kafka: один топик, несколько consumer groups — каждая получает все сообщения.

**Work Queue (балансировка нагрузки):**
```
order.created → [consumer 1, consumer 2, consumer 3]
                ↑ Kafka распределяет между партициями
```
Один consumer group, несколько инстансов — каждое сообщение обрабатывается только одним.

**Dead Letter Queue (DLQ):**
```typescript
// Сообщение не удалось обработать 3 раза → отправить в DLQ
@EventPattern(KAFKA_TOPICS.ORDER_CREATED)
async handleOrderCreated(event: OrderCreatedEvent) {
  try {
    await this.processOrder(event)
  } catch (error) {
    this.logger.error(`Failed to process order ${event.orderId}`, error)
    // Не бросаем ошибку! Consumer продолжает работать.
    // В продакшн: отправить в топик order.created.dlq для анализа
    await this.kafka.emit('order.created.dlq', { ...event, error: error.message })
  }
}
```

### Гарантии доставки

| Гарантия | Описание | Риск |
|---|---|---|
| **At most once** | Максимум один раз (может потеряться) | Потеря сообщения |
| **At least once** | Минимум один раз (может дублироваться) | Дублирование обработки |
| **Exactly once** | Ровно один раз | Сложно, требует идемпотентности |

Kafka по умолчанию — **at least once**. Именно поэтому consumer должен быть идемпотентным.

### На собеседовании скажи

> "Очереди решают три проблемы: decoupling (сервисы не знают друг о друге), reliability (сообщения не теряются при падении consumer), load leveling (буфер при пиковой нагрузке). Kafka — правильный выбор для межсервисной коммуникации в высоконагруженных системах. BullMQ подходит для простых фоновых задач в рамках одного сервиса. Важно помнить: Kafka гарантирует at-least-once delivery, поэтому consumers должны быть идемпотентными."

---

## Retries — Повторные попытки

### Простым языком

Запрос упал с ошибкой. Когда стоит попробовать ещё раз, а когда нет смысла?

**Retriable ошибки (стоит retry):**
- Сеть временно недоступна (timeout, connection reset)
- Сервис временно перегружен (503 Service Unavailable)
- БД deadlock
- Kafka consumer lag (временная недоступность брокера)

**Non-retriable ошибки (retry бесполезен):**
- Невалидные данные (400 Bad Request) — данные не изменятся
- Не авторизован (401/403) — токен не станет валидным сам по себе
- Не найдено (404) — запись не появится
- Бизнес-ошибки — "товар закончился"

### Exponential Backoff — правильная стратегия retry

Не нужно долбить сервис каждую секунду — это усугубит проблему. Правильно — увеличивать задержку экспоненциально:

```
Попытка 1: сразу
Попытка 2: через 1 секунду
Попытка 3: через 2 секунды
Попытка 4: через 4 секунды
Попытка 5: через 8 секунд
...до max delay
```

```typescript
// Реализация exponential backoff с jitter
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options = { maxRetries: 5, baseDelay: 1000, maxDelay: 30000 }
): Promise<T> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === options.maxRetries) throw error
      if (!isRetriable(error)) throw error  // не retry для 400, 401, 404

      const delay = Math.min(
        options.baseDelay * Math.pow(2, attempt),  // exponential
        options.maxDelay
      )
      // Jitter: случайность ±25% чтобы избежать thundering herd
      const jitter = delay * 0.25 * (Math.random() * 2 - 1)
      await sleep(delay + jitter)
    }
  }
}

// Пример использования в gRPC клиенте
async validateToken(token: string) {
  return retryWithBackoff(
    () => this.authGrpcClient.validateToken({ token }),
    { maxRetries: 3, baseDelay: 100, maxDelay: 2000 }
  )
}
```

### Jitter — зачем добавлять случайность

Без jitter: 1000 инстансов одновременно ждут 1 секунду и одновременно долбят сервис — **thundering herd**.

С jitter: каждый инстанс ждёт разное время — нагрузка распределяется равномерно.

### Retry в Kafka Consumer

```typescript
// NestJS Kafka consumer с retry
@EventPattern(KAFKA_TOPICS.ORDER_CREATED)
async handleOrderCreated(@Payload() event: OrderCreatedEvent) {
  try {
    await this.paymentService.processPayment(event)
  } catch (error) {
    this.logger.error('Payment processing failed', {
      orderId: event.orderId,
      error: error.message
    })
    // ВАЖНО: не бросать ошибку наружу
    // Kafka consumer при необработанной ошибке — останавливается
    // Вместо этого: отправить в DLQ или логировать для ручного разбора
  }
}
```

### Circuit Breaker — дополнение к retry

Если сервис падает 50% запросов — не нужно продолжать его долбить. Circuit Breaker "открывается" и быстро возвращает ошибку без реального запроса:

```
Closed (нормальная работа)
  → много ошибок → Open (быстрый fail, без запросов)
  → через timeout → Half-Open (пробный запрос)
  → успех → Closed
  → ошибка → Open снова
```

```typescript
// Упрощённая реализация
class CircuitBreaker {
  private failures = 0
  private lastFailureTime: number | null = null
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime! > 30000) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure() {
    this.failures++
    this.lastFailureTime = Date.now()
    if (this.failures >= 5) this.state = 'open'
  }
}
```

### На собеседовании скажи

> "Retry нужен только для transient ошибок — сеть, таймауты, временная перегрузка. Для бизнес-ошибок и 4xx retry бессмысленен. Правильная стратегия — exponential backoff с jitter: задержка растёт экспоненциально, случайность предотвращает thundering herd. Circuit Breaker дополняет retry — при массовых ошибках быстро возвращает fail без реального запроса. В Kafka consumers важно не бросать ошибки наружу — consumer остановится."

---

## Idempotency — Идемпотентность

### Простым языком

Идемпотентная операция — это операция, которую можно выполнить много раз, и результат будет таким же как если бы выполнил один раз.

```
GET /api/products/123  — идемпотентна (можно повторить, данные те же)
DELETE /api/orders/123 — идемпотентна (повторное удаление = уже удалён = ok)
POST /api/payments     — НЕ идемпотентна по умолчанию (повторный запрос = двойное списание 💸)
```

### Зачем нужна идемпотентность

При retry — запрос может дойти до сервера, обработаться, но ответ потеряться в сети. Клиент не знает: обработан запрос или нет? И делает повторный.

```
Client → POST /payments → Server (списал деньги) → ответ потерялся ✗
Client → POST /payments → Server (опять списал?) → нельзя!
```

### Idempotency Key — стандартное решение

Клиент генерирует уникальный ключ для каждой операции и передаёт в заголовке. Сервер сохраняет ключ + результат. При повторном запросе — возвращает кешированный результат, не выполняя операцию снова.

```typescript
// Клиент (api-gateway): генерируем ключ
const idempotencyKey = `payment-${orderId}-${userId}-${Date.now()}`

await axios.post('/payments', paymentData, {
  headers: { 'Idempotency-Key': idempotencyKey }
})

// Сервер (payment-service): проверяем ключ
@Post('payments')
async createPayment(
  @Body() dto: CreatePaymentDto,
  @Headers('idempotency-key') idempotencyKey: string
) {
  return await prisma.$transaction(async (tx) => {
    // Ищем существующий платёж с таким ключом
    const existing = await tx.payment.findUnique({
      where: { idempotencyKey }
    })

    if (existing) {
      // Запрос уже обрабатывался — возвращаем тот же результат
      return existing
    }

    // Новый запрос — создаём платёж
    const payment = await tx.payment.create({
      data: {
        orderId: dto.orderId,
        amount: dto.amount,
        idempotencyKey,  // ← сохраняем ключ
        status: 'PENDING'
      }
    })

    // Stripe: используем idempotencyKey
    const stripePayment = await stripe.paymentIntents.create(
      { amount: dto.amount, currency: 'usd' },
      { idempotencyKey }  // Stripe сам поддерживает idempotency keys
    )

    return await tx.payment.update({
      where: { id: payment.id },
      data: { stripePaymentIntentId: stripePayment.id, status: 'PROCESSING' }
    })
  })
}
```

### Idempotency в Kafka Consumers

Kafka at-least-once означает что одно сообщение может прийти дважды при ребалансировке. Consumer должен быть идемпотентным:

```typescript
// order-service: обрабатываем order.paid
@EventPattern(KAFKA_TOPICS.ORDER_PAID)
async handleOrderPaid(event: OrderPaidEvent) {
  // Идемпотентно: updateMany с WHERE status = 'PENDING'
  // Если статус уже PAID — updateMany ничего не делает (count=0)
  const result = await prisma.order.updateMany({
    where: {
      id: event.orderId,
      status: 'PENDING'  // ← идемпотентное условие
    },
    data: { status: 'PAID' }
  })

  if (result.count === 0) {
    this.logger.log(`Order ${event.orderId} already processed, skipping`)
    return  // Не ошибка — просто дубликат
  }
}
```

### Идемпотентность HTTP методов по спецификации

| Метод | Идемпотентен | Safe (только чтение) |
|---|---|---|
| GET | ✅ | ✅ |
| HEAD | ✅ | ✅ |
| PUT | ✅ | ❌ |
| DELETE | ✅ | ❌ |
| POST | ❌ | ❌ |
| PATCH | ❌ | ❌ |

PUT идемпотентен: `PUT /orders/123 { status: 'PAID' }` — хоть 10 раз, результат одинаков.
PATCH не идемпотентен: `PATCH /orders/123 { amount: +10 }` — каждый раз прибавляет 10.

### Схема из ShopFlow (Payment model)

```prisma
model Payment {
  id              String   @id @default(cuid())
  orderId         String
  amount          Decimal
  idempotencyKey  String   @unique  // ← гарантия уникальности на уровне БД
  status          PaymentStatus
  createdAt       DateTime @default(now())
}
```

`@unique` на `idempotencyKey` — даже если два запроса дойдут одновременно, PostgreSQL гарантирует что только один INSERT пройдёт успешно. Второй получит ошибку unique constraint.

### На собеседовании скажи

> "Идемпотентность — это когда повторное выполнение операции даёт тот же результат. Критически важна для платёжных операций и Kafka consumers (at-least-once delivery). Стандартное решение — Idempotency Key в заголовке запроса: сервер сохраняет ключ + результат, при повторном запросе возвращает кешированный ответ. В базе — уникальный индекс на idempotency_key гарантирует консистентность даже при конкурентных запросах. Stripe, Stripe Payment Intents и большинство платёжных API поддерживают idempotency keys нативно."

---

## Event Loop

### Простым языком

JavaScript однопоточный — одновременно выполняется только один кусок кода. Но Node.js обрабатывает тысячи запросов одновременно. Как?

Ответ: **Event Loop** — механизм который переключается между задачами пока одни ждут (I/O, таймеры, сеть).

### Как работает Event Loop

```
┌─────────────────────────────────────────────────────┐
│                    Event Loop                        │
│                                                      │
│  1. timers          setTimeout, setInterval          │
│  2. pending I/O     колбэки от предыдущего цикла     │
│  3. idle, prepare   внутреннее                       │
│  4. poll            ждёт новые I/O события           │
│  5. check           setImmediate                     │
│  6. close callbacks socket.on('close', ...)          │
│                                                      │
│  между фазами: process.nextTick + Promise callbacks  │
└─────────────────────────────────────────────────────┘
```

### Микрозадачи vs Макрозадачи

```typescript
console.log('1')                           // синхронно

setTimeout(() => console.log('2'), 0)      // macrotask (timers фаза)

Promise.resolve().then(() => console.log('3'))  // microtask

process.nextTick(() => console.log('4'))   // microtask (приоритет выше Promise)

console.log('5')                           // синхронно

// Вывод: 1, 5, 4, 3, 2
// Сначала весь синхронный код
// Затем nextTick (приоритет 1)
// Затем Promise.then (приоритет 2)
// Затем setTimeout (макрозадача, следующая итерация)
```

### Блокировка Event Loop — главная проблема

```typescript
// ПЛОХО: блокирует Event Loop на ~2 секунды
// Все остальные запросы к серверу ждут!
app.get('/process', (req, res) => {
  let result = 0
  for (let i = 0; i < 5_000_000_000; i++) {  // тяжёлые вычисления
    result += i
  }
  res.json({ result })
})

// ХОРОШО: вынести тяжёлые вычисления в Worker Thread
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

app.get('/process', async (req, res) => {
  const result = await runInWorker('./heavy-computation.js', { iterations: 5_000_000_000 })
  res.json({ result })
})
// Event Loop свободен, обрабатывает другие запросы пока Worker считает
```

### Что НЕ блокирует Event Loop

```typescript
// I/O операции: асинхронны, не блокируют
await prisma.order.findMany()         // БД запрос — Event Loop свободен
await axios.get('https://api.com')    // HTTP — свободен
await new Promise(r => setTimeout(r, 1000))  // таймер — свободен

// Блокирует:
JSON.parse(hugeString)          // синхронный CPU-bound
crypto.pbkdf2Sync(...)          // синхронный хеш
fs.readFileSync(bigFile)        // синхронный I/O
```

### Практика в NestJS / ShopFlow

```typescript
// auth-service: bcrypt хеширование пароля
// bcrypt.hashSync — БЛОКИРУЕТ Event Loop!
// bcrypt.hash — асинхронный, использует libuv thread pool

// ПЛОХО:
const hash = bcrypt.hashSync(password, 12)  // блокирует ~200ms

// ХОРОШО:
const hash = await bcrypt.hash(password, 12)  // async, Event Loop свободен
```

```typescript
// Визуализация: как NestJS обрабатывает 1000 одновременных запросов
//
// Request 1: await prisma.findMany() → отдаёт управление
// Request 2: await bcrypt.hash()    → отдаёт управление
// Request 3: await kafka.emit()     → отдаёт управление
// ...
// I/O завершился? → Event Loop возобновляет нужный request
//
// Один поток, но тысячи "одновременных" запросов через кооперативную многозадачность
```

### setImmediate vs setTimeout(fn, 0) vs process.nextTick

```typescript
// process.nextTick — выполнится ДО следующей фазы Event Loop
// Опасно: рекурсивный nextTick = бесконечный цикл, Event Loop заблокирован

// setImmediate — выполнится в check фазе (после poll)
// setTimeout(fn, 0) — выполнится в timers фазе (следующая итерация)

// Их порядок в разных контекстах может отличаться, но:
// process.nextTick ВСЕГДА раньше обоих
```

### На собеседовании скажи

> "Event Loop — механизм однопоточного Node.js для асинхронной обработки задач. I/O операции (сеть, БД, файлы) не блокируют поток — Event Loop переключается на другие задачи пока ждёт ответа. Блокируют CPU-bound операции: тяжёлые вычисления, синхронные методы. Решение — Worker Threads для CPU-bound, async/await для I/O. В NestJS важно никогда не использовать sync варианты bcrypt, fs, crypto в production коде."

---

## Memory Leaks — Утечки памяти

### Простым языком

Память выделена — но программа забыла её освободить. Heap растёт, в итоге процесс падает с `ENOMEM` или `JavaScript heap out of memory`.

### Основные причины в Node.js

**1. Глобальные переменные — не чистятся сборщиком мусора:**

```typescript
// ПЛОХО: данные накапливаются в глобальном объекте
const cache = {}  // глобальная переменная

app.get('/user/:id', async (req, res) => {
  cache[req.params.id] = await fetchUser(req.params.id)  // никогда не удаляется
  res.json(cache[req.params.id])
})
// После 1 миллиона уникальных запросов — 1 миллион записей в памяти

// ХОРОШО: LRU кеш с ограниченным размером
import LRU from 'lru-cache'
const cache = new LRU({ max: 1000, ttl: 1000 * 60 * 5 })  // max 1000 элементов, TTL 5 минут
```

**2. Event Listeners — не удаляются:**

```typescript
// ПЛОХО: добавляем слушатель на каждый запрос, не удаляем
app.get('/stream', (req, res) => {
  emitter.on('data', (data) => res.write(data))  // listener не удаляется после завершения
})
// После 1000 запросов — 1000 listeners на одном emitter

// ХОРОШО: cleanup при завершении
app.get('/stream', (req, res) => {
  const handler = (data) => res.write(data)
  emitter.on('data', handler)

  req.on('close', () => {
    emitter.off('data', handler)  // cleanup при закрытии соединения
  })
})
```

**3. Setinterval/setTimeout — не очищаются:**

```typescript
// ПЛОХО: в NestJS сервисе
@Injectable()
export class MetricsService {
  onModuleInit() {
    setInterval(() => this.collectMetrics(), 5000)  // interval не сохранён, не очистить
  }
}

// ХОРОШО: cleanup при уничтожении модуля
@Injectable()
export class MetricsService implements OnModuleDestroy {
  private interval: NodeJS.Timeout

  onModuleInit() {
    this.interval = setInterval(() => this.collectMetrics(), 5000)
  }

  onModuleDestroy() {
    clearInterval(this.interval)  // очистка при graceful shutdown
  }
}
```

**4. Closures удерживают большие объекты:**

```typescript
// ПЛОХО: closure удерживает весь largeData в памяти
function processLargeData(data: LargeObject[]) {
  const summary = data.length  // нужно только это

  return function() {
    console.log(summary, data)  // data удерживается в памяти через closure!
  }
}

// ХОРОШО: извлекаем только нужное
function processLargeData(data: LargeObject[]) {
  const summary = data.length
  // data выходит из scope и будет собрана GC

  return function() {
    console.log(summary)  // только summary в closure
  }
}
```

**5. Prisma / DB connections — не закрываются:**

```typescript
// ПЛОХО: новый PrismaClient на каждый запрос
app.get('/users', async (req, res) => {
  const prisma = new PrismaClient()  // создаём connection pool каждый раз!
  const users = await prisma.user.findMany()
  // prisma.$disconnect() не вызван → connections накапливаются
  res.json(users)
})

// ХОРОШО: singleton PrismaClient
// packages/prisma/src/client.ts
let prisma: PrismaClient

export function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}
```

### Диагностика утечек

```bash
# 1. Мониторинг heap через Node.js --inspect
node --inspect dist/main.js

# 2. Chrome DevTools: Memory → Take Heap Snapshot
# Сравниваешь два снимка — что выросло?

# 3. process.memoryUsage() в коде
setInterval(() => {
  const { heapUsed, heapTotal } = process.memoryUsage()
  console.log(`Heap: ${Math.round(heapUsed / 1024 / 1024)}MB / ${Math.round(heapTotal / 1024 / 1024)}MB`)
}, 10000)

# 4. clinic.js — профилирование Node.js приложений
npx clinic doctor -- node dist/main.js
```

### WeakMap / WeakSet — для кеша без утечек

```typescript
// WeakMap: ключи — слабые ссылки
// Если объект-ключ больше нигде не используется — GC его удалит вместе с записью в WeakMap
const cache = new WeakMap<Request, UserData>()

app.use((req, res, next) => {
  // Данные привязаны к объекту req
  // Когда req завершится и GC соберёт его — запись в cache исчезнет автоматически
  cache.set(req, { userId: req.user.id })
  next()
})
```

### Пример из ShopFlow: Kafka Consumer leak

```typescript
// ПЛОХО: создаём новый consumer на каждый запрос
@Controller()
export class OrderController {
  @Get(':id/status')
  async getStatus(@Param('id') orderId: string) {
    const consumer = kafka.consumer({ groupId: 'order-status' })
    await consumer.connect()  // открываем соединение
    // ... читаем данные
    // consumer.disconnect() забыли вызвать → connection leak
  }
}

// ХОРОШО: consumer как инжектируемый singleton через NestJS DI
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private consumer: Consumer

  async onModuleInit() {
    this.consumer = kafka.consumer({ groupId: 'order-status' })
    await this.consumer.connect()
    await this.consumer.subscribe({ topic: KAFKA_TOPICS.ORDER_PAID })
  }

  async onModuleDestroy() {
    await this.consumer.disconnect()  // graceful shutdown
  }
}
```

### На собеседовании скажи

> "Memory leak в Node.js — чаще всего это: глобальные кеши без TTL/размера, забытые event listeners, setInterval без clearInterval, closures удерживающие большие объекты. Диагностируется через heap snapshot в Chrome DevTools или clinic.js. В NestJS помогает правильный DI: сервисы — синглтоны, ресурсы освобождаются в OnModuleDestroy. Для кешей использую LRU-cache с TTL, для привязки данных к объектам — WeakMap."

---

---

## Быстрые ответы на типичные вопросы собеседования

---

### Kafka — углублённые вопросы

**Что происходит при ребалансировке consumer group и почему там дублирование?**

Когда в consumer group добавляется или падает один из consumers — Kafka перераспределяет партиции между оставшимися. В момент ребалансировки consumer может не успеть закоммитить offset последнего обработанного сообщения. После ребалансировки новый consumer начнёт читать с последнего закоммиченного offset — то есть повторно прочитает уже обработанные сообщения. Именно поэтому Kafka гарантирует at-least-once, а не exactly-once по умолчанию.

**Как реализовывал идемпотентность?**

Два способа. Первый — условное обновление: `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PAID' } })` — если статус уже PAID, ничего не произойдёт. Второй — idempotency key: сохраняем уникальный ключ события в БД с `@unique` индексом, при повторной обработке находим существующую запись и возвращаем её без повторного выполнения логики.

**At-least-once vs exactly-once — разница и когда нужен exactly-once?**

- **At-least-once:** сообщение гарантированно будет доставлено, но возможны дубликаты. Consumer должен быть идемпотентным. Это дефолт Kafka и достаточно для большинства случаев.
- **Exactly-once:** каждое сообщение обрабатывается ровно один раз. Требует Kafka Transactions + идемпотентного producer (`enable.idempotence: true`). Высокая цена — снижает throughput. Нужен только когда дублирование абсолютно недопустимо и нельзя сделать обработчик идемпотентным (например, внешний API без idempotency key).

На практике: проще и дешевле сделать обработчик идемпотентным, чем включать exactly-once.

---

### MongoDB — углублённые вопросы

**Как в replica set выбирается новый primary при падении?**

Через алгоритм выборов на основе Raft. Каждый secondary отправляет heartbeat на primary каждые 2 секунды. Если за 10 секунд нет ответа — secondary объявляет выборы. Узлы голосуют за кандидата с самым свежим oplog. Побеждает тот кто получил большинство голосов (majority). Именно поэтому минимум 3 узла — при 2 узлах majority невозможна. Обычно failover занимает 10–30 секунд.

**writeConcern и readConcern — зачем менять дефолты?**

- `writeConcern: { w: 1 }` (дефолт) — подтверждение только от primary. Если primary упадёт сразу после записи до репликации — данные потеряются.
- `writeConcern: { w: 'majority' }` — большинство реплик подтвердили. Данные не потеряются при failover. Чуть медленнее.
- `readConcern: 'local'` (дефолт) — читаем с текущего узла, данные могут быть не реплицированы.
- `readConcern: 'majority'` — читаем только то, что подтверждено большинством. Гарантия что данные не откатятся при failover.

Для платёжных операций — всегда `w: majority`. Для аналитики/счётчиков — дефолты ок.

**Что ищешь в выводе explain() в первую очередь?**

Три вещи:
1. `stage` — ищу `COLLSCAN` (Seq Scan, плохо) vs `IXSCAN` (индекс, хорошо)
2. `totalDocsExamined` vs `nReturned` — если examine 100 000 а вернули 5 — индекс не работает или плохой
3. `executionTimeMillis` — общее время, сравниваю до и после добавления индекса

**Eventual consistency — конкретный пример проблемы?**

Пользователь обновил email, прочитал профиль с secondary реплики — увидел старый email. Решение: после критичных write операций читать с primary (`readPreference: 'primary'`), или использовать `readConcern: 'majority'`.

---

### Race Conditions — углублённые вопросы

**Pessimistic vs Optimistic locking — когда что выбрать?**

| | Pessimistic | Optimistic |
|---|---|---|
| Как работает | Блокирует строку (`SELECT FOR UPDATE`) | Версия/timestamp, проверяет при записи |
| Когда выбрать | Высокая вероятность конфликта, критичные данные | Низкая вероятность конфликта, высокая конкурентность |
| Плюс | Гарантия, нет retry логики | Нет блокировок, высокий throughput |
| Минус | Deadlock риск, очередь ожидания | Нужен retry при конфликте |
| Пример | Списание баланса, резервирование товара | Обновление профиля, настроек |

**Конкретный запрос для race condition:**

```sql
-- Атомарное уменьшение склада с проверкой
UPDATE products
SET stock = stock - 1
WHERE id = 'prod_123' AND stock > 0;
-- rowsAffected = 0 → товар закончился, не нужны блокировки
```

**MongoDB транзакции — когда появились и цена?**

Multi-document транзакции появились в MongoDB 4.0 (2018) для replica sets, в 4.2 — для sharded clusters. До этого атомарность только на уровне одного документа. Цена: снижают throughput на 30–60%, увеличивают latency. Использовать только когда реально нужна атомарность между несколькими коллекциями. В большинстве случаев правильная схема данных (embed вместо reference) позволяет обойтись без транзакций.

---

### Event Loop — углублённые вопросы

**process.nextTick vs setImmediate — разница?**

- `process.nextTick` — выполняется **до** следующей фазы Event Loop, после текущей операции. Приоритет выше чем у Promise.then. Рекурсивный nextTick может заблокировать Event Loop.
- `setImmediate` — выполняется в **check фазе** текущей итерации Event Loop, после poll фазы (I/O). Безопаснее для рекурсивного вызова — не блокирует I/O.

```
Текущий код → nextTick queue → Promise microtasks → [следующая фаза: timers/poll/check]
                                                                          ↑ setImmediate здесь
```

Правило: `nextTick` для критичных callbacks которые должны выполниться перед любым I/O. `setImmediate` для всего остального асинхронного.

---

### Memory Leaks — углублённые вопросы

**Конкретный кейс: была утечка, как диагностировал?**

Классический сценарий: heap растёт со временем, сервис каждые несколько часов падает с OOM.

1. Запустил с `--inspect` флагом
2. Подключился в Chrome DevTools → Memory → взял heap snapshot
3. Подождал 30 минут под нагрузкой → второй snapshot
4. Comparison view — смотрю что выросло по количеству объектов
5. Нашёл: массив EventEmitter listeners рос бесконечно — в route handler добавлялся listener, при завершении запроса не удалялся
6. Фикс: `req.on('close', () => emitter.off('data', handler))`

**Инструменты профилирования:**

- `node --inspect` + Chrome DevTools — heap snapshot, CPU profile
- `clinic doctor` — автоматически находит Event Loop lag, memory, I/O проблемы
- `clinic flame` — flame graph для CPU bottleneck
- `process.memoryUsage()` — быстрая проверка в коде
- `--max-old-space-size` — временный workaround пока ищешь утечку

---

*Последнее обновление: Sprint 1 — SF-3 Prisma Setup + Interview Prep*
