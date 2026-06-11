#!/bin/bash
# Run from project root: bash docs/create-sprint-1-issues.sh

set -e
echo "Creating Sprint 1 issues..."

gh issue create \
  --title "SF-1: Setup Turborepo + ESLint + Prettier" \
  --label "infra,sprint-1" \
  --body "## Описание
Настроить корневую конфигурацию monorepo.

## Задачи
- Configure Turborepo pipeline в \`turbo.json\`
- Настроить npm workspaces (\`apps/*\`, \`packages/*\`)
- Добавить ESLint + Prettier конфигурацию
- Проверить path aliases (\`@shopflow/common\`, \`@shopflow/kafka\` и т.д.)

## Acceptance Criteria
- [ ] \`npm run build\` запускается из корня без ошибок
- [ ] \`npm run lint\` проходит на всех пакетах
- [ ] Path aliases резолвятся корректно
- [ ] Prettier форматирует код единообразно

## Learning
Turborepo pipeline, dependency graph, кэширование сборки

## Оценка: S (1-2 дня)"

gh issue create \
  --title "SF-2: Docker Compose — local infrastructure" \
  --label "infra,sprint-1" \
  --body "## Описание
Поднять локальную инфраструктуру через Docker Compose.

## Задачи
- PostgreSQL 16 с healthcheck
- Redis 7 с healthcheck
- Kafka + Zookeeper (Confluent 7.6)
- Kafka UI на порту 8080

## Acceptance Criteria
- [ ] \`docker compose up -d postgres redis zookeeper kafka kafka-ui\` без ошибок
- [ ] PostgreSQL доступен на \`localhost:5432\`
- [ ] Redis доступен на \`localhost:6379\`
- [ ] Kafka UI доступен на \`http://localhost:8080\`
- [ ] Все контейнеры проходят healthcheck

## Learning
Docker Compose, healthchecks, Kafka + Zookeeper архитектура

## Оценка: S (1 день)"

gh issue create \
  --title "SF-3: packages/prisma — схема и миграции" \
  --label "backend,sprint-1" \
  --body "## Описание
Настроить Prisma ORM в \`packages/prisma\`.

## Задачи
- Проверить \`schema.prisma\` (модели уже созданы в скаффолде)
- Создать первую миграцию
- Добавить \`PrismaService\` для инжекции в NestJS
- Экспортировать из \`@shopflow/prisma\`
- Добавить seed скрипт с тестовыми данными

## Acceptance Criteria
- [ ] \`npm run db:migrate\` создаёт все таблицы
- [ ] \`npm run db:generate\` генерирует Prisma client
- [ ] \`PrismaService\` экспортируется из \`@shopflow/prisma\`
- [ ] Seed скрипт создаёт тестовые категории и продукты

## Learning
Prisma schema design, relations, migrations workflow, PrismaService в NestJS

## Оценка: M (2-3 дня)"

gh issue create \
  --title "SF-4: packages/proto — gRPC proto файлы и типы" \
  --label "backend,sprint-1" \
  --body "## Описание
Настроить gRPC контракты через Protocol Buffers.

## Задачи
- Проверить \`auth.proto\`, \`product.proto\`, \`order.proto\` (уже созданы)
- Настроить \`grpc_tools_node_protoc\` для TypeScript генерации
- Написать npm script \`proto:generate\`
- Экспортировать сгенерированные типы из \`@shopflow/proto\`

## Acceptance Criteria
- [ ] \`npm run proto:generate\` генерирует TypeScript типы без ошибок
- [ ] Типы импортируются в других сервисах
- [ ] \`auth.proto\` описывает ValidateToken и GetUserById RPC

## Learning
Protocol Buffers синтаксис, gRPC service definitions, code generation

## Оценка: S (1-2 дня)"

gh issue create \
  --title "SF-5: auth-service — NestJS gRPC микросервис" \
  --label "backend,sprint-1,learning" \
  --body "## Описание
Реализовать auth-service как NestJS gRPC микросервис.

## Задачи
- gRPC сервер на порту 5001
- \`AuthController\` с \`@GrpcMethod\` декораторами
- \`AuthService\` — register/login с bcrypt
- \`TokenService\` — JWT access (15m) + refresh (7d) токены
- Prisma интеграция (\`PrismaService\` из \`@shopflow/prisma\`)
- Kafka Producer: публиковать \`user.registered\` при регистрации
- Unit тесты для \`AuthService\`

## Acceptance Criteria
- [ ] gRPC сервер стартует на порту 5001
- [ ] \`ValidateToken\` RPC валидирует JWT и возвращает данные пользователя
- [ ] \`register\` создаёт пользователя с hashed паролем
- [ ] \`login\` возвращает access + refresh токены
- [ ] \`user.registered\` Kafka event публикуется при регистрации
- [ ] Unit тесты AuthService покрывают >80%

## Learning
NestJS microservices, \`@GrpcMethod\`, JWT implementation, bcrypt, Kafka Producer

## Оценка: L (4-5 дней)"

gh issue create \
  --title "SF-6: api-gateway — HTTP сервер + gRPC proxy" \
  --label "backend,sprint-1" \
  --body "## Описание
Реализовать api-gateway как NestJS HTTP сервер с проксированием в микросервисы.

## Задачи
- HTTP сервер на порту 3000
- gRPC клиенты для всех сервисов
- \`AuthGuard\` — валидация JWT через gRPC вызов в auth-service
- \`POST /api/v1/auth/register\` → auth-service
- \`POST /api/v1/auth/login\` → auth-service
- \`GET /api/v1/auth/me\` → защищённый endpoint

## Acceptance Criteria
- [ ] HTTP сервер стартует на порту 3000
- [ ] \`/auth/register\` и \`/auth/login\` работают end-to-end
- [ ] \`AuthGuard\` блокирует запросы без валидного JWT (401)
- [ ] gRPC клиент успешно коннектится к auth-service

## Learning
NestJS ClientProxy, RxJS observables, gRPC client setup, Guards

## Оценка: M (3 дня)"

gh issue create \
  --title "SF-7: web — Login и Register страницы" \
  --label "frontend,sprint-1" \
  --body "## Описание
Создать auth UI в Next.js (App Router).

## Задачи
- \`app/(auth)/login/page.tsx\`
- \`app/(auth)/register/page.tsx\`
- React Hook Form + Zod валидация
- API интеграция через axios + React Query
- JWT в httpOnly cookie через Next.js API route
- \`useAuthStore\` (Zustand) для клиентского auth state
- Редирект на главную после успешного входа

## Acceptance Criteria
- [ ] Login/Register формы с валидацией полей
- [ ] Успешный login сохраняет токен и редиректит
- [ ] Ошибки API отображаются в форме
- [ ] \`useAuthStore\` хранит данные пользователя

## Learning
Next.js App Router, React Hook Form + Zod, auth flow с cookies, Zustand

## Оценка: M (2-3 дня)"

gh issue create \
  --title "SF-8: Integration test — полный auth flow" \
  --label "backend,frontend,sprint-1" \
  --body "## Описание
Проверить полный end-to-end flow регистрации и входа.

## Сценарий
1. \`docker compose up\` — инфраструктура
2. Запустить auth-service + api-gateway
3. Зарегистрировать нового пользователя через UI
4. Войти и получить токены
5. Зайти на защищённый endpoint \`/auth/me\`
6. Проверить \`user.registered\` event в Kafka UI

## Acceptance Criteria
- [ ] Полный flow работает без ошибок
- [ ] Kafka UI показывает \`user.registered\` event
- [ ] JWT auth работает через gateway → auth-service
- [ ] Refresh token обновляет access token

## Оценка: S (1 день)"

echo ""
echo "✅ All 8 Sprint 1 issues created!"
echo "View at: https://github.com/DenisKozyrev/shopflow/issues"
