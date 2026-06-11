# Агенты проекта ShopFlow

В проекте настроены **3 специализированных агента** через Cursor Rules.
Каждый автоматически активируется при работе с нужными файлами,
либо можно запустить вручную через стартовый промпт.

---

## Как это работает

Cursor Rules автоматически применяются:

- **PM Agent** — активен всегда в этом проекте
- **Backend Agent** — активируется при открытии файлов в `apps/*/` (кроме web) и `packages/`
- **Frontend Agent** — активируется при открытии файлов в `apps/web/`

Просто открой нужный файл — агент уже в контексте.

---

## PM Agent — Управление спринтами и задачами

**Когда использовать:** планирование, статус спринта, новые задачи, ретроспектива

**Стартовый промпт для новой сессии:**

```
Ты PM проекта ShopFlow.

Прочитай контекст:
- /Users/dzianis/Dev/My Projects/shopflow/docs/PROJECT_CONTEXT.md
- /Users/dzianis/Dev/My Projects/shopflow/docs/sprint-1-tasks.md

[Далее опиши что нужно:]
Текущий спринт: Sprint 1
Нужно: {создать задачи / посмотреть статус / спланировать Sprint 2 / провести ретро}
```

**Что умеет:**

- Создавать задачи с Acceptance Criteria и Learning Notes
- Обновлять статусы задач в markdown файлах
- Планировать следующий спринт
- Проводить sprint retrospective
- Оценивать задачи (S/M/L)

---

## Backend Agent — NestJS, gRPC, Kafka, AWS, Prisma

**Когда использовать:** работа с любым сервисом в `apps/*/` или `packages/`

**Стартовый промпт для новой сессии:**

```
Ты Senior Backend Engineer на проекте ShopFlow (NestJS Microservices).

Прочитай контекст:
- /Users/dzianis/Dev/My Projects/shopflow/docs/PROJECT_CONTEXT.md

Сейчас работаю над: SF-{N} — {название задачи}
Файл/сервис: {apps/auth-service/src/...}

[Опиши задачу или проблему]
```

**Что умеет:**

- Помогать с реализацией NestJS сервисов
- Объяснять Kafka паттерны (producers, consumers, topics)
- Настраивать gRPC контракты и proto файлы
- Работать с Prisma (схемы, миграции, оптимизация)
- AWS интеграции (S3, SES, ECS)
- Code review backend PR
- Мини-уроки по сложным темам

**Активируется автоматически при открытии:**

- `apps/auth-service/**`
- `apps/product-service/**`
- `apps/order-service/**`
- `apps/payment-service/**`
- `apps/notification-service/**`
- `apps/api-gateway/**`
- `packages/**`

---

## Frontend Agent — Next.js, React, Tailwind, shadcn/ui

**Когда использовать:** работа с `apps/web/`

**Стартовый промпт для новой сессии:**

```
Ты Senior Frontend Engineer на проекте ShopFlow (Next.js 15).

Прочитай контекст:
- /Users/dzianis/Dev/My Projects/shopflow/docs/PROJECT_CONTEXT.md

Сейчас работаю над: SF-{N} — {название задачи}
Файл: {apps/web/src/app/...}

[Опиши задачу или проблему]
```

**Что умеет:**

- Создавать страницы и компоненты (Next.js App Router)
- Настраивать React Query хуки и стейт
- Верстать UI с Tailwind + shadcn/ui
- WebSocket интеграции (Socket.io)
- Форм с React Hook Form + Zod
- Code review frontend PR
- Оптимизация производительности

**Активируется автоматически при открытии:**

- `apps/web/**`

---

## Типичный рабочий день

```
1. Открываешь Cursor в /Users/dzianis/Dev/My Projects/shopflow

2. Новый чат → PM промпт → "какие задачи в Sprint 1, что берём сегодня?"
   PM выдаёт задачу SF-5: auth-service

3. Открываешь apps/auth-service/src/auth.service.ts
   → Backend Agent автоматически активируется
   → Говоришь: "SF-5, помоги реализовать register с bcrypt и Kafka event"

4. Backend Agent даёт мини-урок по теме если нужно,
   затем помогает написать код

5. Открываешь apps/web/src/app/(auth)/login/page.tsx
   → Frontend Agent автоматически активируется
   → Говоришь: "SF-7, создай login форму с React Hook Form + Zod"

6. Открываешь PR → новый чат с Backend/Frontend агентом
   → "Сделай code review этого PR: {ссылка}"

7. Конец спринта → PM промпт → "проведи ретроспективу Sprint 1"
```

---

## Обновление задач

После завершения задачи попроси PM агента обновить статус:

```
PM, задача SF-{N} выполнена, PR merged.
Обнови статус в docs/sprint-1-tasks.md
```

После завершения спринта:

```
PM, Sprint 1 завершён.
1. Обнови статусы в PROJECT_CONTEXT.md
2. Создай файл docs/sprint-2-tasks.md с задачами Sprint 2
3. Проведи ретроспективу
```
