# Common, микросервисы и Redis — как устроено в проекте

## 1. Common — это не микросервис

**Common** в нашем проекте — это **общая библиотека кода**, а не отдельный сервис. Отдельного процесса «common» нет: один и тот же код подключается внутрь каждого Node.js-сервиса.

### Как устроен common

- **Где лежит код:**  
  `nodejs/services/common/` — одна общая папка (утилиты, хелперы, работа с Mongo/Redis/auth и т.д.).  
  `nodejs/services/config/` — общие конфиги (`config-jwt.js`, `config-redis.js`, `config-*-mongo.js` и т.д.).

- **Как сервисы его видят:**  
  В Docker при запуске контейнера сервиса к этой папке монтируются общие каталоги:
  - `services/common` → внутрь контейнера как `.../auth/common` (для auth), `.../igniteorders/common` (для igniteorders) и т.д.
  - `services/config` → как `.../auth/config`, `.../igniteorders/config` и т.д.

  Пример из **docker-compose** для auth и igniteorders:

  ```yaml
  # auth
  volumes:
    - ./../../nodejs/services/auth:/src/ignite/nodejs/services/auth
    - ./../../nodejs/services/common:/src/ignite/nodejs/services/auth/common
    - ./../../nodejs/services/config:/src/ignite/nodejs/services/auth/config

  # igniteorders
  volumes:
    - ./../../nodejs/services/igniteorders:/src/ignite/nodejs/services/igniteorders
    - ./../../nodejs/services/common:/src/ignite/nodejs/services/igniteorders/common
    - ./../../nodejs/services/config:/src/ignite/nodejs/services/igniteorders/config
  ```

  В результате у каждого сервиса при запуске есть своя копия путей к одному и тому же коду: `common` и `config` физически общие, но в рантайме резолвятся как локальные для сервиса (через `app-root-path`).

- **Как код подключается в коде сервиса:**  
  В каждом сервисе рабочая директория — своя (например `.../auth` или `.../igniteorders`). Используются переменные:
  - `rootpath` = корень текущего сервиса (через `app-root-path`),
  - `commonPath = rootpath + '/common'`,  
    т.е. для контейнера auth это `auth/common`, для igniteorders — `igniteorders/common`, но по факту туда смонтирован один и тот же `services/common`.

  Пример из **auth** (`nodejs/services/auth/siteApp.js`):

  ```js
  const rootpath = require("app-root-path");
  const commonPath = `${rootpath}/common`;
  const logger = require(`${commonPath}/utils/logger/logger`);
  const configIgniteCrmMongo = require(`${rootpath}/config/config-ignitecrm-mongo`);
  const configIgniteRedis = require(`${rootpath}/config/config-redis`);
  const loadSiteRoutes = require(`${commonPath}/utils/startup/loadSiteRoutes`);
  const MongodbClient = require(`${commonPath}/utils/mongo/mongodb50`).MongodbClient;
  ```

  То же самое делают igniteorders, ignitereports и др.: они все тянут один и тот же `common` и `config`, но через свой `rootpath`.

- **Итог:**  
  Общий код не запускается отдельным процессом. Он встроен в каждый микросервис через монтирование и `require(commonPath/...)` / `require(rootpath/config/...)`. Изменения в `services/common/` или `services/config/` влияют на все сервисы, которые их подключают (при перезапуске контейнеров или при следующем деплое).

---

## 2. Микросервисы: кто они и как взаимодействуют

### Какие микросервисы есть

Отдельные процессы (контейнеры/поды), каждый со своим портом:

| Сервис            | Порт | Назначение                                   |
| ----------------- | ---- | -------------------------------------------- |
| **auth**          | 3207 | Логин, JWT, пользователи, OAuth              |
| **igniteorders**  | 3210 | Заказы, креативы, платформы (Xandr и др.)    |
| **ignitereports** | 3211 | Отчёты, экспорт, отчётные данные             |
| **igniteswagger** | 3209 | Документация API (Swagger/OpenAPI)           |
| **ignitequeue**   | —    | Фоновые задачи (очередь, экспорт PPT и т.д.) |
| **proxy**         | 3200 | Единая точка входа для браузера/клиента      |

Плюс Python (`ignite-python-dev`, 3205), batch-скрипты, view (фронты) и т.д.

### Как они взаимодействуют

- **Клиент (браузер) → бэкенд**  
  Запросы идут на один хост и порт **3200 (proxy)**. Прокси смотрит на путь и перенаправляет запрос на нужный бэкенд по URL.

- **Настройка прокси (куда слать запросы)**  
  В **nodejs/proxy/config/config-remote.js** заданы базовые URL сервисов через переменные окружения:

  ```js
  expressauth: process.env.tp_auth_host || "http://localhost:3207";
  igniteorders: process.env.ignite_orders_host || "http://localhost:3210";
  ignitereports: process.env.ignite_reports_host || "http://localhost:3211";
  igniteswagger: process.env.ignite_swagger || "http://localhost:3209";
  ```

  В **docker-compose** для каждого контейнера эти переменные заданы так, чтобы они указывали на другие контейнеры по одному хосту (например `http://${my_local_ip}:3207` для auth). То есть маршрутизация между сервисами настроена через **env** и один общий хост в dev.

- **Логика маршрутизации в прокси**  
  В **nodejs/proxy/start.js** по префиксу URL решается, на какой бэкенд отправить запрос:

  | Путь запроса              | Куда идёт запрос (target)    |
  | ------------------------- | ---------------------------- |
  | `/lumina/auth/api`        | auth (tp_auth_host, 3207)    |
  | `/lumina/auth/view/auth`  | auth view (tp_authview_host) |
  | `/lumina/swagger/apidocs` | igniteswagger (3209)         |
  | `/lumina/orders/api`      | igniteorders (3210)          |
  | `/lumina/reports/api`     | ignitereports (3211)         |

  Прокси создаётся через `http-proxy`: для каждого такого пути вызывается `proxy.web(request, response, { target: "http://host:port" })`. Заголовки и тело запроса пересылаются на выбранный сервис.

- **Сервис → сервис (backend-to-backend)**  
  Взаимодействие идёт по HTTP: один сервис знает URL другого из env и делает запрос (axios/fetch и т.д.).  
  Примеры:
  - **igniteorders** вызывает сам себя по другому пути (другой «внутренний» API): в коде используется `process.env.ignite_orders_host` и путь вида `/lumina/orders/api/xandr/...` (например в `createXandr.js`, `getXandrById.js`, `getPagedXandr.js`).
  - Вызовы **ignitereports** из других мест задаются через `process.env.ignite_reports_host` (например в campaign remapping, getCampaignNameHistory, validateCampaignNames).

  То есть взаимодействие между микросервисами настроено так:
  - в **docker-compose** (или в k8s) задаются переменные вида `tp_auth_host`, `ignite_orders_host`, `ignite_reports_host`;
  - код читает их и собирает URL для HTTP-вызовов;
  - ни общей шины сообщений, ни отдельного service discovery в этом описании нет — используется явная конфигурация хостов/портов через env.

---

## 3. Redis — что это и как используется у нас

### Что такое Redis

**Redis** — это хранилище «ключ–значение» в оперативной памяти с поддержкой TTL (время жизни ключа). Очень быстрые чтение/запись, подходит для кэша, сессий, временных токенов, rate limiting и т.п.

### Как подключен в проекте

- **Конфиг:**  
  **nodejs/services/config/config-redis.js**
  - Хост/порт: `process.env.redis_domains` (по умолчанию `localhost`), `process.env.redis_ports` (по умолчанию `6379`).
  - Режим: один инстанс или кластер (`process.env.redis_cluster === "true"`).
  - **Namespace:** `process.env.redis_namespace` (например `ignitecrm`) — префикс для ключей, чтобы разные окружения/приложения не пересекались.

  В docker-compose для auth и igniteorders задано, например:
  `redis_domains: "${my_local_ip}"`, `redis_ports: "6379"`, `redis_namespace: ignitecrm`.

- **Клиент:**  
  В сервисах используется **ioredis**. Подключение делается при старте приложения (например в **siteApp.js**): создаётся клиент Redis (или массив клиентов для кластера), сохраняется в `siteApp.locals.redisIgniteClient` и `siteApp.locals.redisIgniteNamespace`. Дальше этот клиент и namespace передаются в хендлеры через `options.dbs.redisIgniteClient` и `options.dbs.redisIgniteNamespace`.

### Где и зачем используется Redis

**1 JWT access-токены (валидные сессии)**

- **Запись:**  
  После логина или обновления токена в **nodejs/services/common/utils/auth/generateAllTokens.js** новый access-токен кладётся в Redis с TTL:

  ```js
  await options.dbs.redisIgniteClient.setex(
    `${options.dbs.redisIgniteNamespace}~ignite~jwt~${newAccessToken}`,
    expiresIn, // время жизни в секундах (например 12 часов)
    JSON.stringify(newTokenData), // данные пользователя: username, firstName, lastName и т.д.
  );
  ```

  Ключ имеет вид: `{namespace}~ignite~jwt~{accessToken}`.

- **Чтение (проверка токена):**  
  В **nodejs/services/common/utils/auth/checkRedisToken.js** по пришедшему access-токену из заголовка делается:

  ```js
  let redisTokenDataStr = await options.dbs.redisIgniteClient.get(
    `${options.dbs.redisIgniteNamespace}~ignite~jwt~${accessToken}`,
  );
  ```

  Если ключ есть и не истёк — пользователь считается авторизованным, данные берутся из Redis (не нужно каждый раз ходить в БД). Если ключа нет (истёк TTL или вышел из системы) — токен считаем невалидным и при необходимости делаем refresh через MongoDB/LDAP в `generateAllTokens`.

  То есть Redis здесь — быстрый кэш «активных» access-токенов с автоудалением по TTL.

**2 Кэш для тяжёлых отчётов (long cache)**

- В отчётах (например в **ignitereports**, SQL-агрегации по разным срезам) используются модули:
  - **nodejs/services/common/utils/redis/redisLongCache.js** — кэш только в Redis (get/set с TTL, опционально «длинный» TTL с метаданными в отдельном ключе `~luminalongexpire`).
  - **nodejs/services/common/utils/redis/mongoLongCache.js** — кэш с участием MongoDB (данные кэша могут храниться и в Redis, и в Mongo с разными TTL).

  Смысл: результат тяжёлого запроса (например отчёт по датам/платформам) один раз считаем, кладём в Redis (и при необходимости в Mongo) с TTL; следующие запросы с теми же параметрами берут готовый результат из кэша и не нагружают БД.

**3 Health check**

- В **siteApp.js** (например в igniteorders) при обращении к `/health` делается пробная запись в Redis (`setex('test', 60, 'test')`) и при кластерной конфигурации по ответу выбирается «мастер» для последующих запросов. Так проверяется, что сервис не только жив, но и может достучаться до Redis.

### Кратко

- **Common** — общая библиотека и конфиги, не микросервис; подключается в каждый сервис через volume mount и `rootpath`/`commonPath`.
- **Микросервисы** — отдельные процессы (auth, igniteorders, ignitereports, swagger, proxy и т.д.); взаимодействуют по HTTP через прокси (клиент → бэкенд) и по env-настроенным URL (бэкенд → бэкенд).
- **Redis** — in-memory store; у нас используется для: хранения активных JWT access-токенов с TTL (проверка в `checkRedisToken`, запись в `generateAllTokens`), кэша для отчётов (redisLongCache, mongoLongCache) и проверки доступности в health check.

Если нужно, можно вынести это в один короткий раздел в `CLAUDE.md` или оставить отдельным файлом `docs/common-microservices-redis-explained.md`.
