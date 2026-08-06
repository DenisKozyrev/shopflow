# Агенты проекта ShopFlow

В проекте настроен AI-тулинг через **Claude Code**: `CLAUDE.md` (всегда в контексте) + **Subagents** (`.claude/agents/`) + **Skills** (`.claude/skills/`) + **MCP** (`.mcp.json` + user scope).

---

## CLAUDE.md vs Subagents vs Skills vs MCP

| Механизм | Что это | Где лежит |
|---|---|---|
| **CLAUDE.md** | Всегда в контексте, грузится целиком в каждой сессии | `CLAUDE.md` (корень репо) |
| **Subagents** | Отдельная роль/персона с своим system prompt, вызывается явно через Agent tool | `.claude/agents/*.md` |
| **Skills** | Пошаговые сценарии, вызов через Skill tool / slash-команду | `.claude/skills/*/SKILL.md` |
| **MCP** | Подключения к Postgres, GitHub, docs, AWS | `.mcp.json` (проект) + user scope (`claude mcp add`) |

**Важное отличие от Cursor Rules:** здесь ничего не активируется автоматически по открытому файлу. `CLAUDE.md` грузится всегда целиком независимо от контекста; `backend-expert`/`frontend-expert` подключаются явно — либо ты сам просишь ("используй backend-expert для ревью"), либо модель сама решает вызвать subagent, если задача явно подпадает под его `description`.

---

## PM / Sprint tracking

Живёт прямо в `CLAUDE.md` — читается автоматически в каждой сессии, отдельно просить не нужно.

**Что покрыто:**

- Формат задачи: Номер (SF-{N}), Заголовок, Описание, Acceptance Criteria, Learning, Оценка (S/M/L)
- Обновление статусов в `PROJECT_CONTEXT.md` ("Sprint план") и `docs/sprint-{N}-tasks.md`
- Sprint retrospective после завершения спринта
- Ветки `feature/SF-{N}-desc`, PR `feat(SF-N): desc`

Просто скажи, что нужно — например: *"какие задачи в Sprint 1, что берём сегодня?"* или *"SF-5 выполнена, PR merged, обнови статус"*.

---

## Backend Expert — NestJS, gRPC, Kafka, AWS, Prisma

**Когда использовать:** глубокая работа с любым сервисом в `apps/*/` (кроме web) или `packages/`, backend code review.

**Файл:** `.claude/agents/backend-expert.md`

**Вызывается явно** — например: *"используй backend-expert, чтобы реализовать register с bcrypt и Kafka event"* или *"backend-expert, сделай review этого PR"*. Нет авто-активации по пути файла, как было в Cursor — но архитектурные инварианты (gRPC/Kafka, никогда HTTP между сервисами) уже есть в `CLAUDE.md`, так что базовые правила соблюдаются даже без явного вызова subagent'а.

**Что умеет:**

- Помогать с реализацией NestJS сервисов
- Объяснять Kafka паттерны (producers, consumers, topics)
- Настраивать gRPC контракты и proto файлы
- Работать с Prisma (схемы, миграции, оптимизация)
- AWS интеграции (S3, SES, ECS)
- Code review backend PR (6-пунктовый чек-лист)
- Мини-уроки по сложным темам

---

## Frontend Expert — Next.js, React, Tailwind, shadcn/ui

**Когда использовать:** глубокая работа с `apps/web/`, frontend code review.

**Файл:** `.claude/agents/frontend-expert.md`

**Вызывается явно** — например: *"используй frontend-expert, создай login форму с React Hook Form + Zod"*.

**Что умеет:**

- Создавать страницы и компоненты (Next.js App Router)
- Настраивать React Query хуки и стейт
- Верстать UI с Tailwind + shadcn/ui
- WebSocket интеграции (Socket.io)
- Форм с React Hook Form + Zod
- Code review frontend PR (6-пунктовый чек-лист)
- Оптимизация производительности

---

## Типичный рабочий день

```
1. Открываешь VSCode / Claude Code в /Users/dzianis/Dev/My Projects/shopflow
   → CLAUDE.md уже в контексте, PM/sprint-правила известны без напоминания

2. "какие задачи в Sprint 1, что берём сегодня?"
   → получаешь задачу SF-5: auth-service

3. "используй backend-expert, помоги реализовать register с bcrypt и Kafka event"
   → backend-expert даёт мини-урок по теме если нужно, затем помогает написать код

4. "используй frontend-expert, создай login форму с React Hook Form + Zod"
   → frontend-expert реализует форму по дизайн-системе проекта

5. Открываешь PR → "backend-expert, сделай code review этого PR: {ссылка}"

6. Конец спринта → "проведи ретроспективу Sprint 1"
```

---

## Обновление задач

После завершения задачи:

```
SF-{N} выполнена, PR merged.
Обнови статус в docs/sprint-1-tasks.md
```

После завершения спринта:

```
Sprint 1 завершён.
1. Обнови статусы в PROJECT_CONTEXT.md
2. Создай файл docs/sprint-2-tasks.md с задачами Sprint 2
3. Проведи ретроспективу
```

---

## Skills (проектные)

Лежат в `.claude/skills/`. Вызов: через Skill tool / `/имя-skill` или естественный запрос («запушь и создай PR»).

| Skill | Зачем |
|---|---|
| **mentor-session** | Старт ментор-сессии: читает `PROJECT_CONTEXT` + sprint tasks, Denis пишет код сам |
| **commit-push-pr** | Commit → push → `gh pr create` по конвенциям ShopFlow; по умолчанию через Agent tool |
| **prisma-db** | Миграции, generate, Studio, Postgres MCP, `DATABASE_URL` |
| **aws-shopflow** | S3 / SES / ECS по спринтам, credentials, AWS MCP |

Конвенции git/PR (ветка `feature/SF-N-...`, Conventional Commits) зашиты в `commit-push-pr`.

**Cursor Canvas не портирован** — это IDE-специфичная фича Cursor (`.canvas.tsx` + собственный SDK), у Claude Code прямого аналога нет. Ближайший встроенный механизм — **Artifacts** (не требует настройки, работает из коробки).

---

## MCP servers

### Project — `.mcp.json` (корень репо)

| Server | Пакет | Зачем |
|---|---|---|
| **postgres** | `@henkey/postgres-mcp-server` | Схема и запросы к локальной БД ShopFlow (`DATABASE_URL` из env) |

⚠ Старый reference-пакет `@modelcontextprotocol/server-postgres` (был в Cursor-конфиге) помечен **deprecated** — заменён на поддерживаемый `@henkey/postgres-mcp-server`. У него нет read-only режима: среди 17 инструментов есть изменяющие данные и схему (`pg_execute_mutation`, `pg_execute_sql`, `pg_manage_users`). В менторском режиме — только чтение, это поведенческое правило, а не техническое ограничение.

Проектный `.mcp.json` требует **однократного подтверждения доверия** при первом запуске Claude Code в репозитории (статус `⏸ Pending approval` до этого).

### Global (user scope) — зарегистрированы

Межпроектные серверы, живут в `~/.claude.json`, а не в репозитории. Команды, которыми они добавлены:

```bash
claude mcp add -s user -t http context7 https://mcp.context7.com/mcp
claude mcp add -s user -t http exa https://mcp.exa.ai/mcp
claude mcp add -s user -t http github https://api.githubcopilot.com/mcp/ \
  -H 'Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}'
claude mcp add -s user aws \
  -e AWS_REGION=us-east-1 -e AWS_PROFILE=default -e FASTMCP_LOG_LEVEL=ERROR \
  -- uvx awslabs.aws-api-mcp-server@latest
```

| Server | Зачем |
|---|---|
| **context7** | Актуальная документация библиотек (NestJS, Prisma, Kafka…) |
| **exa** | Web search / fetch страниц |
| **github** | Issues, PR, репозиторий — официальный remote-сервер GitHub (нужен `GITHUB_PERSONAL_ACCESS_TOKEN`) |
| **aws** | AWS API через `uvx awslabs.aws-api-mcp-server` (нужен `uv`; ключи с Sprint 2+) |

**GitHub:** старый npm-пакет `@modelcontextprotocol/server-github` тоже deprecated — используется официальный remote-эндпоинт GitHub. Токен в конфиге записан **плейсхолдером** `${GITHUB_PERSONAL_ACCESS_TOKEN}` в одинарных кавычках, чтобы PAT не лежал открытым текстом в `~/.claude.json` — раскрывается в рантайме из окружения.

**Гоча с AWS:** при первом запуске `uvx` скачивает пакет дольше, чем 30-секундный таймаут health-check → `✘ Failed to connect`. Лечится прогревом кэша: `uvx awslabs.aws-api-mcp-server@latest` один раз вручную, дальше подключается штатно.

**Не переносим `ref-context`** из старого `~/.cursor/mcp.json` — там placeholder API-ключ (`YOUR_API_KEY`), похоже на неоконченную настройку. Почисти отдельно в Cursor-конфиге, если он больше не нужен — вне scope этой миграции.

Не используем Slack / Sentry / Datadog — нет прод-систем, лишний шум в контексте.

### Env для MCP (один раз)

В `~/.zshrc` (через `nano ~/.zshrc`, затем `source ~/.zshrc`):

```bash
export DATABASE_URL="postgresql://shopflow:shopflow_dev@localhost:5433/shopflow"
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."   # https://github.com/settings/tokens
```

ℹ **Про порт 5433:** в `docker-compose.yml` маппинг `"5433:5432"` — на хосте **5433**, внутри контейнера 5432 (сделано, чтобы не конфликтовать с локально установленным Postgres). В `DATABASE_URL` всегда 5433. Таблица портов в `PROJECT_CONTEXT.md` и AC задачи SF-2 приведены в соответствие.

AWS MCP: установить `uv` (`brew install uv` или install script с astral.sh), затем `aws configure` когда дойдёшь до S3.

Проверка состояния серверов: `claude mcp list` в терминале (с health-check) или `/mcp` внутри Claude Code.

---

## Claude Code Hooks

Project hooks: `.claude/settings.json` + `.claude/hooks/`.

| Hook | Event | Зачем |
|---|---|---|
| `block-dangerous-git.sh` | `PreToolUse` (matcher: `Bash`) | Блокирует `reset --hard`, `clean -f`, force-push в main; ask на другие force-push |
| `block-env-commit.sh` | `PreToolUse` (matcher: `Bash`) | Не даёт stage/commit `.env`, ключей, credentials |
| `session-start-hint.sh` | `SessionStart` | Лёгкий hint с напоминанием про mentor-режим, текущую ветку, sprint-файлы |

После добавления/изменения хуков — открыть `/hooks` один раз (Claude Code перечитывает конфиг) либо перезапустить сессию.

---

## Рекомендуемый старт сессии

```
/mentor-session

Сейчас работаю над: SF-{N} — {название}
```

Или вручную:

```
Ты мой ментор на проекте ShopFlow.
Прочитай docs/PROJECT_CONTEXT.md
Правила: я пишу код сам; ты объясняешь; code review на PR.
Сейчас начинаю SF-{N}.
```

(`CLAUDE.md` уже подключён автоматически — этот шаблон нужен только для явного включения ментор-режима через skill `mentor-session`.)
