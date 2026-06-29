# Interview Cheatsheet — что есть в проекте: пути к файлам и как работает

Соответствие пунктов из interview-cheatsheet реальным файлам и механике в репозитории Ignite / Lumina.

---

## Node.js & Core

### Node.js опыт (микросервисы, общий код)

| Путь | Назначение |
|------|------------|
| `nodejs/services/auth/start.js` | Точка входа сервиса auth (порт 3207) |
| `nodejs/services/igniteorders/start.js` | Точка входа igniteorders (3210) |
| `nodejs/services/ignitereports/start.js` | Точка входа ignitereports (3211) |
| `nodejs/services/igniteswagger/start.js` | Точка входа igniteswagger (3209) |
| `nodejs/services/common/` | Общие утилиты (auth, mongo, redis, route, logger, export и т.д.) |
| `nodejs/services/config/` | Конфиги: `config-ignitecrm-mongo.js`, `config-jwt.js`, `config-redis.js`, `config-elastic.js`, `config-s3-*` и др. |

**Как работает:** Каждый сервис поднимает Express-приложение, парсит аргументы через `startupParser`, подключает «сайты» через `dispatcher.boot()`. Общий код подключается через `app-root-path` и `commonPath` (в Docker `common/` и `config/` монтируются в каждый сервис).

---

### Express.js (routing, middleware, error handling)

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/startup/dispatcher.js` | Ищет `siteApp.js` в переданной папке (или в `sites/`) и подключает их к главному app |
| `nodejs/services/common/utils/startup/loadSiteRoutes.js` | Рекурсивно подключает все `*.js` из папки `routes` в siteApp |
| `nodejs/services/igniteorders/sites/orders/siteApp.js` | Пример siteApp: создаёт `express()`, подключает MongoDB/Redis/Elastic, затем `cors()`, таймаут, `cookieParser`, `bodyParser`, в конце `loadSiteRoutes(siteApp, sitePath + "/routes")` |
| `nodejs/services/igniteorders/sites/orders/routes/routesAdvertiserGroups.js` | Пример роутов: `app.post("/advertiser-groups", authenticate, routes.getPagedAdvertiserGroups)` и т.д.; в каждом роуте собирается `options` (dbs, headers, params, user) и вызывается `routeHandler.handleRoute(..., handlerPath, options)` |
| `nodejs/services/common/utils/route/routeHandler.js` | Универсальный обработчик: `require(handlerFile)`, вызов `handler(options)`, установка заголовка `jwt` при наличии токена, отправка результата или 400/404 |
| `nodejs/services/common/utils/route/routeError.js` | Централизованная отправка ошибки: `response.status(statusCode).json({ error })`, сохранение заголовка `jwt` при необходимости |
| `nodejs/services/common/utils/route/lib/extractDbsFromRequest.js` | Достаёт из `request.app.locals` клиенты БД (mongo, redis, elastic и т.д.) для передачи в хендлеры |
| `nodejs/services/auth/start.js` | Глобальные обработчики: `process.on("uncaughtException")`, `process.on("unhandledRejection")`, `app.use(err, req, res, next)` для логирования ошибок |

**Как работает:** Цепочка: Express app → dispatcher подключает siteApp’ы → в каждом siteApp после подключения БД вызывается `loadSiteRoutes` по папке `routes`. Каждый файл в `routes` регистрирует `app.get/post/put/delete(..., authenticate?, handler)`. Хендлер — функция, которая через `routeHandler.handleRoute` загружается по пути и вызывается с `options`; ответ и коды ошибок формируются в `routeHandler` и `routeError`.

---

### NestJS

В проекте не используется. Стек — Express + общие модули в `common/` и `config/`.

---

## API & Интеграции

### REST API (endpoints, методы, коды)

| Путь | Назначение |
|------|------------|
| `nodejs/services/igniteorders/sites/orders/routes/routesAdvertiserGroups.js` | POST/GET/PUT для advertiser-groups, привязка к хендлерам в `handlers/advertiserGroups/` |
| `nodejs/services/igniteorders/sites/orders/routes/routesPacing.js` | Маршруты pacing (Google Ads и др.): post/put/delete для platform advertisers, line items, budget |
| `nodejs/services/igniteorders/sites/orders/routes/routesPlatforms.js` | Маршруты к платформам: Xandr, Google Ads, Madhive, Meta, AdsDirect, LeadMe (search/load/create/update/metrics) |
| `nodejs/services/ignitereports/sites/ignite/routes/routesReportPacing.js` | POST `/pacing/summary`, `/pacing/detail`, `/pacing/l45days` и т.д. |
| `nodejs/services/common/utils/route/routeHandler.js` | Установка `Content-Type`, заголовка `jwt`, редиректов, отправка тела и статусов 200/400/404 |

**Как работает:** REST строится на Express: маршруты объявляются в файлах в `sites/<site>/routes/`. Версионирование/префиксы задаются через mount path при монтировании приложения. Коды и заголовки выставляются в `routeHandler` по результату хендлера (`result.statusCode`, `result.redirect`, `result.accessToken`).

---

### GraphQL

В проекте не используется.

---

### Интеграции (внешние REST API, маппинг, ошибки)

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/stream/downloadFile.js` | Скачивание по URL с повторными попытками при 429; парсинг `x-ratelimit-*`, ожидание и повтор |
| `nodejs/services/common/utils/basis/utils.js` | Вызовы Basis API, обработка rate limit (429), извлечение лимитов из заголовков и повтор после sleep |
| `nodejs/services/common/utils/outlook/axiosGraph.js` | Работа с Microsoft Graph (профиль, продление токенов) |
| `nodejs/services/auth/handlers/login.js` | Логин: Joi-валидация, LDAP, сохранение пользователя в MongoDB, выдача токенов через `generateToken` |
| Интеграции по платформам | В `common/utils/`: googleads, xandr, meta, tiktok, snapchat, simplifi, leadme, callrail и т.д. — вызовы внешних API, маппинг данных |

**Как работает:** Внешние API вызываются из хендлеров и общих утилит. При 429 читаются заголовки rate limit, вычисляется задержка, выполняется `sleep`, затем повтор запроса. Ошибки пробрасываются в `routeError` или обрабатываются внутри хендлера.

---

### Swagger (OpenAPI)

| Путь | Назначение |
|------|------------|
| `nodejs/services/igniteswagger/start.js` | Старт приложения, `args.mountpath = "/lumina/swagger/apidocs"`, `dispatcher.boot(app)` |
| `nodejs/services/igniteswagger/sites/auth/dist/auth.yaml` | OpenAPI 3.0.3 для Auth API: paths (`/lumina/auth/api/login`), components/schemas, security (bearerAuth) |
| `nodejs/services/igniteswagger/sites/auth/routes/lib/basicAuthSwagger.js` | Basic Auth для доступа к Swagger UI: проверка `user === "ignitetest" && pass === "ignitetest"`, иначе 401 и WWW-Authenticate |
| `nodejs/services/igniteswagger/sites/orders/`, `sites/reports/` | YAML для orders и reports по платформам (ignite, xandr, googleads, meta, madhive и т.д.) |
| `nodejs/services/igniteswagger/configstart/config-start-defaults.js` | Порт и прочие дефолты для igniteswagger |
| `kube/release2/nodejs/pod-ignitedsp-node-swagger.yaml` | Деплой сервиса Swagger в Kubernetes |

**Как работает:** Отдельный сервис igniteswagger отдаёт документацию по путям вида `/lumina/swagger/apidocs/...`. Спеки лежат в YAML (OpenAPI 3); для доступа к UI используется Basic Auth в middleware. Сборка/дистрибуция спецификаций — через папки `dist/` и привязку к роутам.

---

## Безопасность & Auth

### JWT (access/refresh, хранение, ротация)

| Путь | Назначение |
|------|------------|
| `nodejs/services/config/config-jwt.js` | `secret`, `ttl` (время жизни access в Redis, сек), `refTokenExpInSec` (срок жизни refresh в MongoDB) |
| `nodejs/services/common/utils/auth/generateToken.js` | Подпись JWT: `jsonwebtoken.sign({ username, firstName, lastName, isMsUser, expireAt, principal }, configJwt.secret)` |
| `nodejs/services/common/utils/auth/verifyToken.js` | Проверка: `jsonwebtoken.verify(token, configJwt.secret)` |
| `nodejs/services/common/utils/auth/generateAllTokens.js` | Продление сессии: по истёкшему access и данным из токена запрашивается новый access/refresh (LDAP refresh или MS Graph), сохранение в MongoDB и Redis |
| `nodejs/services/common/utils/auth/saveToken.js` | Обновление refresh-токена в MongoDB: `mongoIgniteToken.findOneAndUpdate` по `accessToken` |
| `nodejs/services/common/utils/auth/checkRedisToken.js` | Проверка access в Redis: ключ `{namespace}~ignite~jwt~{accessToken}`, сравнение username из payload с данными в Redis |
| `nodejs/services/common/utils/route/lib/authenticate.js` | Middleware: из `Authorization: JWT <token>` извлекается токен, вызывается `verifyToken`, загрузка пользователя из MongoDB, проверка suspended, при необходимости обновление lastActivityDate; если токен истёк — `generateAllTokens`; результат (user/token) кладётся в request и передаётся дальше |
| `nodejs/services/common/utils/route/routeHandler.js` | В ответ при успехе выставляется заголовок `jwt` (новый access при refresh) |

**Как работает:** Клиент шлёт `Authorization: JWT <accessToken>`. `authenticate` верифицирует JWT, проверяет наличие в Redis; при истечении — по refresh в MongoDB/ LDAP или MS Graph выдаёт новую пару и кладёт access в Redis с TTL. Refresh хранится в MongoDB. В ответах при логине/refresh в заголовке `jwt` отдаётся актуальный access.

---

### Passport.js

Не используется. Авторизация реализована своим слоем: JWT + Redis + MongoDB + LDAP и Microsoft Graph (см. выше).

---

### Security (CORS, rate limit, валидация)

| Путь | Назначение |
|------|------------|
| `nodejs/services/igniteorders/sites/orders/siteApp.js` | Подключение CORS: `const cors = require("cors");` и `siteApp.use(cors());` после инициализации БД |
| `nodejs/services/ignitemcp/package.json`, `nodejs/services/lumina-mcp/package.json` | Зависимость `express-rate-limit` (в коде вызов не найден — возможно используется в сервере MCP) |
| `nodejs/services/common/utils/stream/downloadFile.js` | Обработка 429 от внешнего API: `extractRateLimitParams(response)`, sleep, повтор запроса |
| `nodejs/services/common/utils/basis/utils.js` | Аналогично: при 429 извлечение лимитов из заголовков, ожидание, повтор |
| `nodejs/services/auth/handlers/login.js` | Валидация входа: `Joi.object({ username, password }).required()` |
| `nodejs/services/igniteorders/sites/orders/handlers/advertiserGroups/getPagedAdvertiserGroups.js` | Валидация тела: `Joi.object({ page, pageSize, sortModel, search, advancedSearch })`, `requestSchema.validateAsync(body)` |
| `nodejs/services/igniteorders/sites/orders/routes/routesQlik.js` | Закомментированный helmet: `// const helmet = require('helmet');` — не используется |

**Как работает:** CORS включён на уровне siteApp. Rate limiting: для внешних API — обработка 429 и повтор; для входящих запросов — зависимость express-rate-limit есть в ignitemcp/lumina-mcp. Вход и тело запросов проверяются через Joi в хендлерах.

---

## Базы данных

### SQL (Redshift)

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/redshift/redshiftDataConnect.js` | Создание клиента Redshift Data API: `@aws-sdk/client-redshift-data`, кэш по `region-clusterId-database` |
| `nodejs/services/common/utils/redshift/redshiftDataQuery.js` | Выполнение SQL через Redshift Data API (ExecuteStatement, GetStatementResult и т.д.) |
| `nodejs/services/common/utils/redshift/report/` | Модули отчётов: campaign, device, demographic, geo, pixel, site, staging, creativeAsset и др. — определение колонок и таблиц |
| `nodejs/services/batch/main/redshift/util/copyS3CsvToRedshift.js` | ETL: чтение заголовков CSV из S3, создание/alter таблиц в Redshift, копирование данных из S3 в Redshift |
| `nodejs/services/ignitereports/sites/ignite/handlers/reports/sql/` | SQL-запросы для отчётов: addressableVideo, netflix, programmaticAudio, section data (adGroupSectionData и т.д.) |

**Как работает:** Redshift используется через AWS Redshift Data API. Подключение и пул клиентов — в `redshiftDataConnect`; запросы — в `redshiftDataQuery`. ETL: CSV в S3 → создание/обновление таблиц → COPY в Redshift. Отчёты в ignitereports строятся на SQL-модулях в `reports/sql/`.

---

### NoSQL (MongoDB)

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/mongo/mongodb50.js` | Обёртка над нативным драйвером: класс `MongodbClient`, формирование URI, пулы соединений, методы доступа к коллекциям |
| `nodejs/services/config/config-ignitecrm-mongo.js` | Конфиг MongoDB для CRM: hosts, ports, dbname, user, replica set; переменные окружения `mongo_ignitecrm_*` |
| `nodejs/services/config/config-ignitereport-mongo.js` | Конфиг MongoDB для отчётов |
| `nodejs/services/igniteorders/sites/orders/siteApp.js` | Подключение нескольких БД: mongoIgniteCrm, mongoIgniteCrmSecondary, mongoIgniteReport, mongoIgniteReportSecondary через `MongodbClient` и сохранение в `siteApp.locals` |
| `nodejs/services/common/utils/mongo/ignite/crm/user.js` | Работа с коллекцией пользователей: Joi-схемы, `findByUserName`, `findOneAndUpdate`, `findByCustomQuery` и т.д. |
| `nodejs/services/common/utils/mongo/ignite/auth/usertoken.js` | Хранение refresh-токенов (findOneAndUpdate по accessToken) |
| Другие коллекции | `common/utils/mongo/ignite/` — по платформам (googleads, xandr, dv360, tiktok и т.д.) и по доменам (crm, report) |

**Как работает:** Mongoose не используется. Нативный драйвер `mongodb` и обёртка `MongodbClient` в `mongodb50.js`. Конфиги читаются из `config-*-mongo.js`; при старте siteApp открываются соединения и кладутся в `app.locals`. Модули в `common/utils/mongo/` инкапсулируют запросы к коллекциям (find, findOneAndUpdate, агрегации).

---

### ORM/ODM

TypeORM и Mongoose в проекте не используются. Доступ к данным — через собственные модули в `common/utils/mongo/` и нативный драйвер MongoDB.

---

## OOP & Паттерны

Явных декораторов и DI-фреймворка нет. Используются:

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/startup/dispatcher.js` | Единая точка подключения «сайтов» (поиск siteApp.js) |
| `nodejs/services/common/utils/route/routeHandler.js` | Единая точка вызова хендлера по пути к файлу и формирования ответа |
| `nodejs/services/igniteorders/sites/orders/routes/routesAdvertiserGroups.js` | Роуты как объект с методами; каждый метод собирает `options` и вызывает `routeHandler.handleRoute` с путём к хендлеру |

**Как работает:** Модульность за счёт разбиения на сервисы, sites и routes; общая логика в `common/`. Паттерн «маршрут → хендлер-файл» и единый `routeHandler` дают предсказуемую цепочку запрос → options → handler(options) → response.

---

## DevOps & Инфраструктура

### Docker

| Путь | Назначение |
|------|------------|
| `docker/dev/Dockerfile` | Образ на Ubuntu 22.04: установка Python, supervisord, пользователь docker; CMD — supervisord |
| `docker/dockercompose/docker-compose.yaml` | Сервисы (ignite-python-dev, nodejs view, auth, orders, reports, batch, queue, swagger, proxy), volumes для кода (nodejs/view, nodejs/proxy, и т.д.), порты 3200, 3205–3211, переменные окружения (mongo, redis, хосты сервисов) |

**Как работает:** Dockerfile собирает базовый образ для dev. docker-compose поднимает все сервисы, монтирует исходники, задаёт env (в т.ч. ссылки друг на друга и на MongoDB/Redis). Прокси на 3200 маршрутизирует запросы на нужный порт сервиса.

---

### AWS

| Путь | Назначение |
|------|------------|
| `nodejs/services/common/utils/s3/s3filesCsv.js` | Чтение CSV из S3: `@aws-sdk/client-s3`, GetObjectCommand, парсинг заголовков через csv-parse |
| `nodejs/services/common/utils/redshift/redshiftDataConnect.js` | Redshift Data API с AWS credentials (accessKeyId, secretAccessKey) |
| `nodejs/services/batch/main/redshift/util/copyS3CsvToRedshift.js` | Цепочка: S3 CSV → создание/alter таблиц Redshift → COPY из S3 |
| `nodejs/services/igniteorders/sites/orders/siteApp.js` | Подключение OpenSearch: при `configElastic.type === "aws"` используется AWS-конфиг; `@aws-sdk/client-opensearch`, `@aws-sdk/credential-providers` (fromIni и др.) |
| ECR в CI | Образы в `513822311637.dkr.ecr.us-west-2.amazonaws.com/` (python, nodejs, gitlab-runner) |

**Как работает:** S3 — через AWS SDK v3 (S3Client, GetObjectCommand). Redshift — через Redshift Data API с теми же credentials. OpenSearch в AWS — через client-opensearch и credential-providers. Образы пушатся в ECR и используются в GitLab CI и kube.

---

### CI/CD

| Путь | Назначение |
|------|------------|
| `.gitlab-ci.yml` | Стадии: setup-git-gate, gate, notify-start, setup-git, setup-kube, prebuild-kube, deploy-source, deploy, notify-end; include из deploy/ |
| `deploy/gate/mr-approval.yaml` | MR gate: требование «qa approved» и «code approved» |
| `deploy/gate/mr-review.yaml` | Проверка при MR: кросс-чек зависимостей common (если в common добавлен require нового пакета — он должен быть в package.json каждого сервиса, который использует этот файл); опционально AI-ревью диффа |
| `deploy/kube/build-source-nodejs.yaml` | Сборка: npm ci и npm run build для view (например igniteorders), копирование артефактов в целевой каталог для деплоя |
| `deploy/kube/deploy-kube-nodejs.yaml` | Деплой nodejs-сервисов в Kubernetes |
| `deploy/kube/aws134/` | Специфичные шаги для AWS (query-current, build-source, deploy) |
| `deploy/notify/notifyStart.yaml`, `deploy/notify/notifyEnd.yaml` | Уведомления о старте и завершении пайплайна |

**Как работает:** При пуше/мерже GitLab CI запускает стадии. Gate проверяет одобрения и зависимости common. Build собирает фронт и подготавливает исходники; deploy разворачивает образы в kube по манифестам из `kube/`.

---

## Тестирование

| Путь | Назначение |
|------|------------|
| `nodejs/services/batch/main/redshift/util/copyS3CsvToRedshift.js` | Использование `expect` из Chai (проверки в скрипте) |
| `nodejs/services/batch/main/callrail/callrailTest.js`, `nodejs/services/batch/main/snapchat/snapchatTest.js` и др. | Файлы с суффиксом Test.js — ручные/интеграционные проверки вызовов API (CallRail, Snapchat и т.д.) |
| `nodejs/services/batch/package.json`, `nodejs/services/ignitequeue/package.json` | Зависимость `puppeteer` — используется для экспорта PPT и сценариев с браузером |
| `nodejs/services/ignitequeue/handlers/export/pptExportHandler.js` | Обработчик экспорта PPT в очередь; использует общие модули export (generatePulsePpt, svgGenerator и т.д.), при необходимости с headless-браузером |

**Как работает:** Отдельного Jest/Mocha/Supertest-раннера в корне или в сервисах не видно. Есть точечные проверки через Chai и скрипты *Test.js. E2E-подобная автоматизация — через Puppeteer в batch и ignitequeue (например экспорт в PDF/PPT).

---

## Краткая сводка

| Тема | Есть в проекте | Ключевые пути |
|------|-----------------|----------------|
| Node.js / микросервисы | Да | `nodejs/services/*/start.js`, `common/`, `config/` |
| Express (routing, middleware, errors) | Да | `common/utils/startup/dispatcher.js`, `loadSiteRoutes.js`, `sites/*/siteApp.js`, `route/routeHandler.js`, `routeError.js` |
| NestJS | Нет | — |
| REST API | Да | `sites/*/routes/routes*.js`, `routeHandler.js` |
| GraphQL | Нет | — |
| Интеграции | Да | `common/utils/stream/downloadFile.js`, `basis/utils.js`, `auth/handlers/login.js`, интеграции по платформам в common |
| Swagger | Да | `igniteswagger/start.js`, `sites/auth/dist/auth.yaml`, `sites/auth/routes/lib/basicAuthSwagger.js` |
| JWT | Да | `config-jwt.js`, `auth/generateToken.js`, `verifyToken.js`, `generateAllTokens.js`, `checkRedisToken.js`, `authenticate.js` |
| Passport | Нет | — |
| CORS, rate limit, Joi, helmet | CORS и Joi — да; rate limit — при вызовах API и в MCP; helmet закомментирован | `siteApp.js` (cors), `login.js` и хендлеры (Joi), `downloadFile.js`, `basis/utils.js`, `routesQlik.js` (helmet) |
| SQL (Redshift) | Да | `common/utils/redshift/redshiftDataConnect.js`, `redshiftDataQuery.js`, `batch/main/redshift/`, `ignitereports/.../reports/sql/` |
| NoSQL (MongoDB) | Да | `common/utils/mongo/mongodb50.js`, `config-*-mongo.js`, `mongo/ignite/crm/user.js`, `mongo/ignite/auth/usertoken.js` |
| ORM/ODM | Нет | — |
| Docker, AWS, CI/CD | Да | `docker/dev/Dockerfile`, `docker-compose.yaml`, `common/utils/s3/`, `redshift*`, `.gitlab-ci.yml`, `deploy/gate/`, `deploy/kube/` |
| Unit/Integration (Jest, Supertest) | Не настроены | Chai и *Test.js в batch |
| E2E (Puppeteer) | Да | `batch/package.json`, `ignitequeue/package.json`, `ignitequeue/handlers/export/pptExportHandler.js` |
