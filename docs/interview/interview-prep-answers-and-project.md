# Подготовка к собеседованию: ответы + где это в нашем проекте

Для каждого вопроса: краткий ответ и привязка к коду (пути к файлам), чтобы можно было сказать: «В нашем проекте мы это делаем так».

---

## 1. Core JavaScript (обязательно для Node)

### Event Loop & Async

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Что такое event loop?** | Однопоточный цикл: выполняет синхронный код, затем обрабатывает очередь callback'ов (macrotask), между ними — microtask (Promise). Не блокирует поток на I/O. | Вся асинхронность: запросы к Mongo, Redis, HTTP, файлы — через callback/Promise, не блокируя event loop. Пример: `nodejs/services/common/utils/route/routeHandler.js` — `await handler(options)`. |
| **Microtask vs macrotask?** | Microtask: Promise.then/catch/finally, queueMicrotask. Macrotask: setTimeout, setImmediate, I/O. Microtask выполняется до следующей macrotask. | Явного разделения в коде нет; везде async/await и Promise — это microtask. |
| **setTimeout vs setImmediate vs process.nextTick?** | nextTick — в начало очереди microtask (сразу после текущего кода). setImmediate — в очередь «check» (после I/O). setTimeout(fn, 0) — в очередь таймеров. | nextTick/setImmediate редко. Таймауты: `nodejs/services/igniteorders/sites/orders/siteApp.js` — `setTimeout(..., 90000)` для request timeout; `setTimeout` в Redis health check. |
| **Promise + nextTick в сложном примере?** | Сначала весь синхронный код, потом все nextTick, потом microtask (then), потом одна macrotask (setTimeout/setImmediate), снова microtask и т.д. | Для ответа на собесе — разобрать порядок на доске/бумаге. В проекте сложных цепочек nextTick нет. |
| **Почему Node single-threaded?** | Один поток выполняет JS; I/O и тяжёлые операции делегируются пулу потоков (libuv) или системным вызовам, чтобы не блокировать цикл. | Сервисы (auth, orders, reports) — один процесс на инстанс; параллелизм за счёт async I/O и нескольких подов в kube. |
| **Что такое libuv?** | Библиотека под Node: thread pool для части I/O и CPU-задач, абстракция event loop под разные ОС. | Не вызывается напрямую; весь I/O (Mongo, Redis, HTTP, файлы) идёт через драйверы, которые используют libuv. |

---

### Promises

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Как работает Promise.all?** | Принимает итерируемое промисов; возвращает один промис с массивом результатов; при первом reject — сразу reject. | Параллельный старт нескольких операций: например `Promise.all(tasks)` в `nodejs/services/igniteorders/sites/orders/siteApp.js` при подключении нескольких MongoDB. |
| **Promise.all vs allSettled?** | all — «все или первый fail». allSettled — ждёт все, результат массив `{ status, value/reason }` по каждому. | all — когда нужна атомарность (все БД поднялись). allSettled можно предложить для батчей, где часть может падать (у нас в batch чаще циклы с await). |
| **Реализовать Promise.all** | Цикл по массиву, собирать результаты в том же порядке; счётчик выполненных; при reject сразу reject общего промиса; при всех resolve — resolve массива. | На собесе — написать на доске. В коде используем нативный. |
| **Unhandled rejection?** | Промис отклонился, но нет .catch() или try/catch вокруг await. В Node — событие `unhandledRejection`. | Обрабатываем глобально: `nodejs/services/auth/start.js` — `process.on("unhandledRejection", ...)` логирует и делает `process.exit(1)`. |

---

### Async/Await

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Почему async функция всегда возвращает Promise?** | async делает функцию возвращающей промис: return x превращается в Promise.resolve(x), throw — в Promise.reject. | Все хендлеры async: `nodejs/services/igniteorders/sites/orders/handlers/advertiserGroups/getPagedAdvertiserGroups.js` — `module.exports = async (options) => { ... }`. |
| **Как правильно обрабатывать ошибки?** | try/catch вокруг await; или .catch() на промисе; не оставлять необработанные rejection. | Централизованно: `routeHandler.js` — `try { ... await handler(options) } catch (err) { routeError(...) }`. Плюс глобальный unhandledRejection в start.js. |

---

## 2. Node.js Core

### Архитектура

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Non-blocking I/O?** | Операции I/O не блокируют поток: запрос уходит в очередь, по готовности вызывается callback/промис. | Все вызовы к Mongo, Redis, HTTP (axios/fetch), S3, Redshift — асинхронные (await). Пример: `nodejs/services/common/utils/auth/checkRedisToken.js` — await redis.get(). |
| **Blocking vs CPU-bound?** | Blocking — поток ждёт I/O. CPU-bound — поток занят вычислениями (циклы, крипто, парсинг). | I/O — не блокируем. Тяжёлые расчёты — в batch (отдельные процессы/скрипты), не в HTTP-сервере. |
| **Что делать с CPU-heavy?** | Вынести в worker_threads, child_process или отдельный сервис/очередь, чтобы не блокировать event loop. | Тяжёлые отчёты/экспорты — в очередь: `ignitequeue`, обработчики вроде `nodejs/services/ignitequeue/handlers/export/pptExportHandler.js`; batch-скрипты в `batch/bin/`, `batch/main/`. |
| **worker_threads?** | Отдельный поток с отдельным V8, обмен через MessageChannel/SharedArrayBuffer. Для CPU без раздувания процессов. | В проекте не используем; масштабирование — горизонтальное (несколько подов). |
| **Когда child_process?** | Запуск другой программы, изоляция, использование нескольких ядер (каждый процесс — свой Node). | Явно в коде не видно; batch часто запускается как отдельные джобы (cron в kube). |

---

### Streams

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Типы streams?** | Readable, Writable, Transform, Duplex. | Readable: ответы API, CSV из S3. Writable: запись в Mongo. Пример: `nodejs/services/common/utils/stream/streamToMongo.js` — стрим с batch insert. `nodejs/services/batch/main/converts/assignments/getCampaignAssignmentsStream.js` — Transform, pipeline, Writable. |
| **Backpressure?** | Когда потребитель не успевает — поток приостанавливается (не читает пока не drain), чтобы не переполнять память. | pipe() и потоковые API (Mongo, HTTP) сами управляют backpressure. В streamToMongo — накопление в массив records и insertMany батчами. |
| **pipe vs manual?** | pipe автоматически подключает источник к приёмнику и пробрасывает ошибки. Manual — полный контроль, но нужно обрабатывать 'data'/'drain' и ошибки. | pipe: например CSV parse в `nodejs/services/common/utils/s3/s3filesCsv.js` (readStream.pipe(parse(...))). Ручная обработка в getCampaignAssignmentsStream. |

---

### Buffers

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Что такое Buffer?** | Класс для работы с бинарными данными в Node; массив байт вне V8 heap. | Используем для base64 и размеров: `Buffer.from(authString).toString("base64")`, `Buffer.byteLength(content)`. |
| **Где используется?** | Бинарные протоколы, чтение файлов, кодировки, сокеты. | Basic Auth: `nodejs/services/ignitereports/sites/ignite/handlers/reports/export/generatePptAll.js` — `Buffer.from(adminAuth).toString("base64")`. Аналогично в `pinterestAuth.js`, `createJiraTask.js`, `axiosTsqAi.js`. Размер контента: `nodejs/services/ignitequeue/handlers/export/pptExportHandler.js` — `Buffer.byteLength(content)`. |

---

### Memory

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Memory leak?** | Рост потребления памяти со временем из-за неосвобождаемых ссылок (глобальные массивы, незакрытые таймеры/подписки, замыкания). | Избегаем: не копим большие структуры в глобальных переменных; таймауты в request очищаем (clearTimeout в routeHandler/siteApp). |
| **Причины в Node?** | Глобальные объекты, незакрытые соединения, таймеры (setInterval), замыкания, утечки в нативных модулях. | В проекте: таймаут запроса в siteApp — сохраняем в request.timeout и очищаем в end/health. Подключения к БД — переиспользуем (один клиент на app). |
| **Garbage collection в V8?** | Сборка мусора освобождает неиспользуемые объекты; generational (young/old), инкрементальная и полная фазы. | Не настраиваем явно; при проблемах можно смотреть --expose-gc и мониторинг heap. |

---

## 3. HTTP / API / Express

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Как работает HTTP?** | Request (метод, URL, заголовки, тело) → сервер → Response (статус, заголовки, тело). Без состояния. | Все сервисы — HTTP API. Прокси на 3200 маршрутизирует на auth/orders/reports и т.д. |
| **REST принципы?** | Ресурсы по URL, HTTP-методы как действия, статус-коды, представления (JSON). | Ресурсы: `/advertiser-groups`, `/pacing/...`, `/platforms/xandr/...`. Методы: GET для получения, POST для сложных запросов с телом, PUT/DELETE для обновления/удаления. `nodejs/services/igniteorders/sites/orders/routes/routesAdvertiserGroups.js`, `routesPlatforms.js`. |
| **PUT vs PATCH?** | PUT — полная замена ресурса. PATCH — частичное обновление. | В проекте в основном PUT для обновления (например update advertiser group). PATCH можно упомянуть как вариант для частичных обновлений. |
| **Idempotent методы?** | GET, PUT, DELETE — повторный одинаковый запрос даёт тот же эффект. POST — не идемпотентен. | PUT/DELETE на ресурсы (update/archive) — идемпотентны; POST для создания/действий — нет. |
| **Что такое middleware?** | Функция (req, res, next); может изменять req/res, вызывать next() или завершать ответ. | Порядок в siteApp: cors, таймаут, cookieParser, bodyParser, логирование, loadSiteRoutes (роуты). `authenticate` — middleware перед хендлерами. `nodejs/services/igniteorders/sites/orders/siteApp.js`, `route/lib/authenticate.js`. |
| **Цепочка middleware?** | Вызов next() передаёт управление следующему; без next() цепочка обрывается. | siteApp.use(...) по порядку; в роутах: authenticate → routeHandler.handleRoute (внутри вызывается handler, потом next). |
| **Centralized error handling?** | Один обработчик ошибок (err, req, res, next) в конце цепочки и в routeHandler catch. | `nodejs/services/common/utils/route/routeError.js` — единая отправка ошибки (statusCode, json). Вызов из routeHandler в catch. В start.js — app.use(err, req, res, next) для логирования. |
| **Валидация входных данных?** | Проверка типов, форматов, границ до бизнес-логики. | Joi в хендлерах: `nodejs/services/auth/handlers/login.js` — Joi.object({ username, password }). `getPagedAdvertiserGroups.js` — Joi для body (page, pageSize, sortModel, advancedSearch). При ошибке — reject в handler → routeError. |
| **Rate limiting?** | Ограничение числа запросов с клиента по времени. | На входящие: express-rate-limit в ignitemcp/lumina-mcp (в package.json). При вызовах внешних API — обработка 429: `nodejs/services/common/utils/stream/downloadFile.js`, `nodejs/services/common/utils/basis/utils.js` — извлечение лимитов из заголовков, sleep, повтор. |
| **Защита от SQL injection?** | Параметризованные запросы, никогда не подставлять пользовательский ввод в строку SQL. | Redshift — запросы через параметры/клиент API. В проекте SQL в основном в Redshift-модулях и отчётах; данные подставляются через параметры, не конкатенацией. |

---

## 4. Databases

### SQL (индексы, JOIN, GROUP BY, N+1)

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Индекс?** | Структура для быстрого поиска по полю(ям); ускоряет WHERE, JOIN, ORDER BY; замедляет INSERT/UPDATE. | В Mongo: `nodejs/services/common/utils/mongo/ignite/userLog.js` — createIndex({ username: 1, userDate: 1 }). В Redshift — таблицы под отчёты, индексы через DDL. |
| **B-tree?** | Дерево поиска; данные отсортированы; логарифмический поиск, хорош для диапазонов и сортировки. | Объяснять теорией. В проекте индексы создаются в Mongo (createIndex), в Redshift — стандартные механизмы. |
| **Когда индекс не используется?** | Функция от поля (WHERE lower(name)=...), неселективные поля, маленькие таблицы, неверный порядок в composite. | На собесе — теория. В коде следим за запросами к Mongo/Redshift в отчётах. |
| **Уникальный индекс?** | Обеспечивает уникальность значения(й); одна запись на ключ. | В Mongo можно unique: true в createIndex. В проекте уникальность часто через _id и бизнес-поля. |
| **Composite index?** | Индекс по нескольким полям; порядок полей важен (правило «слева направо»). | `userLog.js` — { username: 1, userDate: 1 } и { username: 1, lastAuth: -1 }. `report/pulse/geo.js` — (platform, subProduct, reportDate). |
| **Порядок в composite?** | Запрос может использовать индекс только если условия идут слева направо (equality → range → sort). | При создании индексов в проекте учитываем частые фильтры (platform, reportDate и т.д.). |
| **GROUP BY?** | Группировка строк по полям; агрегаты (SUM, COUNT) по группам. | В Redshift-отчётах и SQL-хендлерах: `nodejs/services/ignitereports/sites/ignite/handlers/reports/sql/` — агрегации по измерениям. |
| **HAVING vs WHERE?** | WHERE — фильтр до группировки. HAVING — фильтр по результатам агрегации после GROUP BY. | В сложных отчётах можно показать разницу на примере запросов в sql/. |
| **ORDER BY оптимизация?** | Индекс с тем же порядком полей уменьшает сортировку; иначе filesort. | В проекте сортировка в API (Mongo/Elastic) и в Redshift-запросах. |
| **JOIN типы?** | INNER, LEFT, RIGHT, FULL. INNER — только совпадения. LEFT — все из левой + совпадения справа. | В Redshift-отчётах используются JOIN между таблицами (campaign, device, demographic и т.д.). |
| **LEFT vs INNER?** | INNER — только строки с совпадением в обеих таблицах. LEFT — все из левой, справа NULL при отсутствии совпадения. | В запросах отчётов выбираем по смыслу (нужны ли «пустые» правые стороны). |
| **N+1 проблема?** | Один запрос на список + по запросу на каждый элемент (например детали) → много запросов. Решение: batch load, JOIN, подзапрос. | Избегаем: пагинация и агрегации в Mongo; загрузка связанных данных батчами или через aggregate/lookup где нужно. |

---

### Transactions (ACID, isolation, ORM)

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **ACID?** | Atomicity, Consistency, Isolation, Durability — свойства транзакций. | В проекте MongoDB без явных транзакций в коде (транзакции есть в Mongo 4+, но мы их не вызываем). Redshift — batch COPY и запросы. |
| **Isolation levels?** | Read uncommitted, read committed, repeatable read, serializable — уровень видимости изменений других транзакций. | Объяснять теорией. В нашем коде уровень изоляции не настраиваем явно. |
| **Dirty read?** | Чтение незакоммиченных данных другой транзакции. | Теория. |
| **Транзакции в ORM?** | Обычно begin/commit/rollback или withTransaction(callback). | ORM не используем; Mongo/Redshift вызываем напрямую. |
| **Когда транзакции вредны?** | Долгие транзакции, большие блокировки, deadlock-риск; иногда лучше идемпотентные операции и компенсации. | Тяжёлые пайплайны вынесены в batch/queue; в API короткие операции. |

---

### Performance (slow query, EXPLAIN)

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Анализ slow query?** | Логирование долгих запросов, EXPLAIN/EXPLAIN ANALYZE, профилирование БД. | Логирование запросов в middleware (startTime/endTime в siteApp). Для Mongo/Redshift — при необходимости смотреть планы. |
| **EXPLAIN?** | План выполнения запроса: индексы, тип доступа, оценка строк. | В Redshift/Mongo можно использовать explain для отладочных запросов. |

---

## 5. NoSQL (Mongo)

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **SQL vs NoSQL?** | SQL — схема, ACID, JOIN. NoSQL — гибкая схема, масштабирование, часто eventual consistency. | Мы используем и то и другое: Mongo — основной store (пользователи, заказы, данные платформ); Redshift — аналитика и отчёты. |
| **Когда выбрать Mongo?** | Гибкая схема, документная модель, горизонтальное масштабирование, не нужны сложные JOIN. | CRM, токены, данные по платформам (Xandr, Google Ads и т.д.) — документы в коллекциях. `nodejs/services/common/utils/mongo/ignite/`, `config-ignitecrm-mongo.js`. |
| **Eventual consistency?** | Реплики могут кратко расходиться; в итоге все приходят к одному состоянию. | При репликах Mongo (mongoIgniteCrmSecondary) читаем с реплик для части запросов; понимаем возможную задержку. |
| **Индекс в Mongo?** | createIndex; B-tree по умолчанию; compound, unique, TTL. | `userLog.js` — createIndex. `queue/campaignRemapStatus.js` — TTL индекс (expireAfterSeconds). |

---

## 6. Архитектура Backend

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Monolith vs Microservices?** | Monolith — одно приложение. Microservices — отдельные сервисы по доменам, независимый деплой. | Микросервисы: auth, igniteorders, ignitereports, ignitequeue, igniteswagger, batch. Общий код в common/, конфиги в config/. `nodejs/services/`, docker-compose, kube. |
| **Layered architecture?** | Слои: API → Service → Repository/Data. | Роуты → routeHandler → handler (бизнес-логика) → mongo/redis/elastic. Handlers в `handlers/`, доступ к данным в `common/utils/mongo/`, `common/utils/redis/`. |
| **Clean architecture?** | Зависимости внутрь (ядро не зависит от фреймворка/БД). | Частично: общий слой (common) не зависит от конкретного сервиса; сервисы зависят от common. |
| **Dependency Injection?** | Зависимости передаются снаружи (конструктор/параметры), не создаются внутри. | В проекте зависимости передаём через options (dbs, params) в хендлеры; БД из request.app.locals. Явного DI-контейнера нет. |
| **SOLID в backend?** | Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion. | Один хендлер — одна задача; общие утилиты переиспользуются; зависимости (dbs) инжектятся в options. |
| **Repository pattern?** | Абстракция доступа к данным: методы find/save вместо прямых запросов. | Модули в `common/utils/mongo/ignite/` по сути репозитории: user.js, usertoken.js, коллекции по платформам — find*, findOneAndUpdate, aggregate. |
| **Service layer?** | Бизнес-логика между API и данными. | Хендлеры в `handlers/` — сервисный слой: вызывают несколько репозиториев (mongo), elastic, внешние API, потом возвращают результат. |
| **DTO зачем?** | Объекты для переноса данных между слоями; фиксированная форма, валидация. | Joi-схемы задают форму входа (request body). Ответы — объекты из хендлера; отдельные DTO-классов нет. |

---

## 7. Security

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **JWT как работает?** | Подпись (HMAC или RSA): header.payload.signature; сервер проверяет подпись и exp. | Подпись: `nodejs/services/common/utils/auth/generateToken.js` (jsonwebtoken.sign). Проверка: `verifyToken.js` (verify). Конфиг: `nodejs/services/config/config-jwt.js`. |
| **Access vs Refresh token?** | Access — короткий срок, в заголовке. Refresh — длинный срок, хранится безопасно, для получения новой пары. | Access в Redis с TTL; refresh в MongoDB. Ротация: `generateAllTokens.js`, `saveToken.js`. `config-jwt.js` — ttl (access), refTokenExpInSec (refresh). |
| **Как хранить токены?** | Access — память или short-lived cookie. Refresh — httpOnly cookie или хранилище на клиенте; на сервере — в БД. | Access в Redis (namespace~ignite~jwt~token). Refresh в MongoDB (usertoken). Клиенту отдаём access в заголовке jwt. |
| **CORS?** | Механизм браузера: сервер заголовками разрешает запросы с других origin. | `nodejs/services/igniteorders/sites/orders/siteApp.js` — require('cors'), siteApp.use(cors()). |
| **CSRF?** | Подделка запроса с другого сайта. Защита: токены, SameSite cookie, проверка Origin/Referer. | Сейчас JWT в заголовке (не cookie) снижает классический CSRF; для форм можно добавить CSRF-токен. |
| **XSS?** | Внедрение скрипта в страницу. Защита: экранирование вывода, Content-Security-Policy, httpOnly cookie. | Бэкенд отдаёт JSON; фронт (view/) должен экранировать. На бэке не рендерим HTML из пользовательского ввода. |
| **Hashing паролей?** | Односторонняя функция (bcrypt, argon2); соль; нельзя восстановить пароль. | `nodejs/services/auth/handlers/login.js` — bcrypt (для сравнения при логине). `nodejs/services/igniteorders/sites/orders/handlers/users/updateUser.js` — bcrypt.hash(password, 12). |
| **bcrypt vs plain hashing?** | bcrypt — адаптивный, соль встроена, медленный (защита от перебора). Plain hash (MD5/SHA без соли) — неприемлемо. | Используем bcryptjs в login и updateUser; rounds 12. |

---

## 8. Performance & Scaling

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Horizontal vs Vertical scaling?** | Horizontal — больше инстансов. Vertical — больше ресурсов на инстанс. | Горизонтально: несколько подов в kube (release1, release2, prod). Манифесты в kube/*. |
| **Stateless service?** | Сервер не хранит сессию между запросами; масштабирование и балансировка проще. | Сессия в JWT + Redis; сервисы не хранят состояние запроса. Можно поднимать любое количество подов. |
| **Load balancer?** | Распределение запросов по инстансам (Kubernetes Service, Ingress). | В kube — svc-* (Service), трафик на поды. |
| **Cache где использовать?** | Часто читаемые, редко меняющиеся данные; тяжёлые вычисления; снижение нагрузки на БД. | Redis: JWT (access token), кэш (mongoLongCache в common/utils/redis/). |
| **Redis зачем?** | In-memory store: кэш, сессии, rate limit, очереди, pub/sub. | JWT access token (TTL), возможно кэш для долгих запросов. Конфиг: `nodejs/services/config/config-redis.js`. Клиент: ioredis в siteApp. |
| **CDN?** | Доставка статики/медиа с края сети; разгрузка origin. | Теория. В проекте статика фронта; CDN может стоять перед view. |
| **Clustering в Node?** | cluster module — несколько воркеров на ядра; один мастер раздаёт запросы. | Не используем; масштабирование через Kubernetes (несколько подов). |
| **PM2?** | Process manager: запуск нескольких инстансов, перезапуск, логи. | В продакшене не PM2, а Kubernetes (поды, рестарты). Локально можно без PM2 (node start.js). |

---

## 9. Cloud & DevOps

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **CI/CD?** | Непрерывная интеграция (сборка, тесты) и доставка (деплой) при пуше/мерже. | GitLab CI: `.gitlab-ci.yml`, стадии gate, deploy-source, deploy. Включены mr-approval, mr-review, build-source-nodejs, deploy-kube-nodejs. |
| **Docker зачем?** | Изолированная среда, одинаковый образ на dev/stage/prod, удобный деплой. | `docker/dev/Dockerfile`, `docker/dockercompose/docker-compose.yaml` — сервисы, volumes, env. |
| **Контейнер?** | Изолированный процесс с своим FS и сетью; ядро общее. | Каждый сервис в своём контейнере в docker-compose и в kube. |
| **Image?** | Неизменяемый образ с ОС, runtime и приложением. | Сборка в CI; образы в ECR (513822311637.dkr.ecr...). |
| **Как задеплоить Node app?** | Собрать образ, запушить в registry, в kube обновить образ пода и перезапустить. | `deploy/kube/build-source-nodejs.yaml` — сборка; deploy-kube-nodejs — деплой. Манифесты в kube/release*, kube/prod. |
| **AWS базовые сервисы?** | EC2, S3, RDS, Lambda, ECR, EKS и т.д. | S3 (файлы, CSV для Redshift), Redshift (аналитика), ECR (образы), OpenSearch. Упоминаются в config и common/utils. |
| **Health check?** | Эндпоинт для проверки живости сервиса (K8s liveness/readiness). | `nodejs/services/igniteorders/sites/orders/siteApp.js` — siteApp.get("/health", ...) ответ 200 "OK". Аналогично в других siteApp (snapchat, pinterest, googleadmanager, dv360). lumina-mcp: GET /health. |
| **Zero downtime deployment?** | Новые инстансы поднимаются, трафик переключается, старые останавливаются без разрыва. | Rolling update в Kubernetes: новые поды поднимаются, старые завершаются после перенаправления трафика. |

---

## 10. Testing

| Вопрос | Ответ | В проекте |
|--------|--------|-----------|
| **Unit vs Integration?** | Unit — изолированно, с моками. Integration — с реальной БД/API. | Unit-тестов в Jest/Mocha по проекту мало. Интеграционные: `nodejs/services/batch/tests/verifyXandrDateFields.js` — Mocha, реальная Mongo, проверка полей. |
| **Что мокать?** | Внешние зависимости: БД, HTTP, файловая система. | В тестах verifyXandrDateFields подключаем реальную Mongo (интеграция). Для unit логично мокать dbs и внешние вызовы. |
| **Что не мокать?** | Тестируемый модуль, простые утилиты без I/O. | — |
| **Тестировать async код?** | Возвращать промис из теста или использовать async/await в it(). | В verifyXandrDateFields — async тесты: it("...", async () => { await ... }). |
| **Supertest зачем?** | HTTP-запросы к Express app без поднятия сервера; проверка статусов и тела. | В проекте Supertest не подключён; можно предложить для тестов API (POST /advertiser-groups и т.д.). |

---

## 11. Алгоритмы (кратко + где в проекте)

| Задача | В проекте |
|--------|-----------|
| **Перевернуть linked list** | Нет в коде; готовить отдельно. |
| **DFS/BFS** | Нет явных графовых обходов; при необходимости — обход деревьев (например конфиги/деревья настроек). |
| **Найти дубликаты** | В данных часто через агрегации Mongo или уникальные ключи; дедупликация в batch. |
| **Debounce** | На фронте (React) возможен; на бэке реже. Можно упомянуть ограничение частоты вызовов (rate limit). |
| **Throttle** | Ограничение частоты: rate limit при вызовах API. `downloadFile.js`, `basis/utils.js` — при 429 ждём и повторяем (обратный throttle со стороны API). |
| **LRU cache** | В коде не реализован свой LRU; Redis по сути кэш с TTL. Для собесе — реализовать на Map + порядок или готовый пакет. |
| **Promise.all** | Используется при старте (Promise.all(tasks) для подключения БД). Реализацию на собесе — написать вручную. |

---

## 12. Поведенческие вопросы — как отвечать, опираясь на проект

| Вопрос | Что сказать, опираясь на проект |
|--------|----------------------------------|
| **Как дебажите продакшен?** | Логирование в middleware (request/response, время); логи при ошибках в routeError и unhandledRejection. При необходимости смотреть логи подов в kube, повторять запрос с теми же параметрами. |
| **Как решали performance проблему?** | Тяжёлые операции (экспорт PPT, отчёты) вынесли в очередь (ignitequeue), чтобы не блокировать API. Rate limit при вызовах внешних API — повтор после паузы вместо падения. Стримы для больших данных (streamToMongo, getCampaignAssignmentsStream). |
| **Как работали с legacy?** | Общий код в common/ и config/; при изменениях проверяем зависимости всех сервисов (mr-review — кросс-чек package.json при изменении common). Постепенная валидация (Joi) в новых хендлерах. |
| **Как принимали архитектурное решение?** | Микросервисы по доменам (auth, orders, reports, queue). Единая точка входа запроса: routeHandler + options (dbs, params). Выбор Mongo для документов и Redshift для аналитики. |
| **Как работали в Scrum?** | Отвечать по своему опыту; можно упомянуть code review (mr-approval), gate в CI, общие стандарты (общий код, конфиги). |

---

## Middle-level expectation — как показать уровень

- **Trade-offs:** Объяснять, почему JWT в Redis (быстро, TTL) и refresh в MongoDB (дольше храним, реже инвалидируем). Почему POST для сложных запросов с телом, а не GET с длинным query. Почему batch и queue отдельно от HTTP-сервисов.
- **«Почему»:** Зачем middleware в таком порядке (cors → timeout → body → routes). Зачем отдельный сервис Swagger. Зачем несколько MongoDB (crm, report, secondary).
- **Performance:** Где могут быть узкие места (N+1, большие выборки без пагинации, блокировка event loop). Что делаем: пагинация, стримы, вынос в очередь, rate limit при 429.
- **Архитектура:** Схема: клиент → proxy → сервисы (auth, orders, reports) → common + config; БД (Mongo, Redis, Redshift, Elastic); batch и queue для тяжёлых задач.
- **Базы глубже CRUD:** Индексы в Mongo (userLog, campaignRemapStatus), составные индексы. Redshift для аналитики и ETL (copyS3CsvToRedshift). Понимание транзакций и когда они не нужны.

---

## Шпаргалка: куда смотреть перед собеседованием

1. **Event loop, Promise, async** — любой хендлер с await (getPagedAdvertiserGroups.js) и routeHandler.
2. **Express, middleware, ошибки** — siteApp.js (orders), routeHandler.js, routeError.js, authenticate.js.
3. **REST, валидация** — routesAdvertiserGroups.js, getPagedAdvertiserGroups.js (Joi).
4. **JWT, безопасность** — config-jwt.js, generateToken.js, verifyToken.js, generateAllTokens.js, checkRedisToken.js, authenticate.js; login.js, updateUser.js (bcrypt).
5. **Mongo, Redis** — mongodb50.js, config-*-mongo.js, config-redis.js; user.js, usertoken.js, streamToMongo.js.
6. **Streams, Buffer** — streamToMongo.js, getCampaignAssignmentsStream.js; Buffer в generatePptAll.js, pinterestAuth.js.
7. **Интеграции, rate limit** — downloadFile.js, basis/utils.js.
8. **CI/CD, Docker, health** — .gitlab-ci.yml, deploy/gate/, deploy/kube/; docker-compose.yaml; siteApp.js get("/health").
9. **Тесты** — batch/tests/verifyXandrDateFields.js.

Удачи на собеседовании.
