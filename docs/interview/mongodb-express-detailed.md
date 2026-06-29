# MongoDB и Express в проекте — подробный разбор

## 1. Что такое MongoDB

**MongoDB** — документо-ориентированная NoSQL база данных. Данные хранятся в виде **документов** (JSON-подобные объекты) в **коллекциях**; у каждого документа есть уникальный `_id`. Нет фиксированной схемы таблиц и SQL-запросов — обращение идёт через API драйвера (find, insert, update, aggregate).

Кратко:
- **Документ** — BSON-объект (поля и вложенные объекты/массивы).
- **Коллекция** — набор документов (аналог таблицы, но без объявленных колонок).
- **База данных** — набор коллекций.
- Запросы: по полям, по `_id`, с проекцией, сортировкой, пагинацией; агрегации (pipeline из стадий).

---

## 2. MongoDB и PostgreSQL — основные отличия

| Аспект | MongoDB | PostgreSQL |
|--------|---------|------------|
| **Модель данных** | Документы (JSON/BSON), коллекции | Таблицы, строки, строгая схема колонок |
| **Схема** | Гибкая, можно добавлять поля без миграций | Фиксированная, миграции для изменений |
| **Запросы** | API драйвера: find, aggregate, update с операторами $set, $in и т.д. | SQL: SELECT, JOIN, WHERE, GROUP BY |
| **Связи** | Нет JOIN; связи через ссылки (_id, embed документов) или несколько запросов | JOIN между таблицами, foreign keys |
| **Транзакции** | Поддерживаются (multi-document), в коде проекта явно не используются | Классические ACID-транзакции |
| **Масштабирование** | Горизонтальное: шардирование, репликация | Вертикальное + репликация; шардирование сложнее |
| **Когда уместна** | Гибкая схема, иерархические данные, быстрые итерации, большие объёмы документов | Сложные связи, строгая целостность, отчётность с JOIN |

В нашем проекте **MongoDB** — основное хранилище для CRM (пользователи, токены, рекламные сущности, данные платформ). **PostgreSQL** не используется; аналитика и тяжёлые отчёты — в **Redshift** (SQL).

---

## 3. Как подключается MongoDB в проекте

### 3.1. Конфигурация

Каждая база задаётся отдельным конфигом в `nodejs/services/config/`:

- **config-ignitecrm-mongo.js** — CRM (пользователи, токены, рекламодатели и т.д.).
- **config-ignitereport-mongo.js** — отчётные данные.

Пример **config-ignitecrm-mongo.js**:

```js
// Упрощённо
let igniteHosts = process.env.mongo_ignitecrm_hosts_prod || process.env.mongo_ignitecrm_hosts;  // "localhost" или список хостов
let ignitePorts = process.env.mongo_ignitecrm_ports || 27017;
let dbname = process.env.mongo_ignitecrm_db || "ignitecrm-dev";
// Опции: writeConcern, readPreference (primaryPreferred / secondaryPreferred для реплик)
config = {
  mongoIgniteCrm: {
    hosts, ports, options: { serverOptions: { writeConcern: 1, readPreference: "primaryPreferred", directConnection } },
    dbname
  },
  mongoIgniteCrmSecondary: { ... readPreference: "secondaryPreferred" ... }  // чтение с реплик
};
```

Переменные окружения задаются в **docker-compose** (например `mongo_ignitecrm_hosts`, `mongo_ignitecrm_ports`, `mongo_ignitecrm_db`).

### 3.2. Клиент и открытие соединения

**Файл:** `nodejs/services/common/utils/mongo/mongodb50.js`

- Используется нативный драйвер **`mongodb`** (не Mongoose).
- Класс **`MongodbClient`** принимает: `host` (или массив хостов), `port`(ы), `options`, `user`, `pass`.
- Метод **`client.open(dbname)`**:
  - Строит URI (`mongodb://[user:pass@]host:port[/dbname]`) и подключается через `MongoClient.connect(uri, options)`.
  - Кэширует соединение по имени базы (`connected[dbname]`), чтобы не открывать повторно.
  - Возвращает объект **`db`** (интерфейс базы: `db.collection(name)` и т.д.).

Клиент экспортирует методы для работы с коллекциями: **find**, **findOne**, **pagedFind**, **count**, **findOneAndUpdate**, **insertOne**, **insertMany**, **deleteMany**, **updateMany**, **aggregate**, **aggregateStream**, **bulkWrite**, **createIndex** и др. Сигнатура: первый аргумент — **db** (результат `open`), второй — имя коллекции, далее — query, projection, sort и т.д.

### 3.3. Где создаётся подключение (Express app)

Подключение делается при старте **siteApp** (не в каждом запросе). Пример: **igniteorders** — `nodejs/services/igniteorders/sites/orders/siteApp.js`.

Шаги:

1. Подключают конфиги:
   - `configIgniteCrmMongo`, `configIgniteReportMongo`.
2. Для каждой базы создают экземпляр **MongodbClient** и вызывают **`client.open(dbname)`** в рамках `Promise.all(tasks)`.
3. Клиент и базу сохраняют в **`siteApp.locals`**:
   - `siteApp.locals.mongoIgniteCrmClient`, `siteApp.locals.mongoIgniteCrmdb`;
   - `siteApp.locals.mongoIgniteCrmSecondaryClient`, `siteApp.locals.mongoIgniteCrmSecondarydb`;
   - то же для ignitereport (и secondary).

После этого все запросы в рамках этого приложения используют одни и те же соединения. В **docker-compose** для сервисов (auth, igniteorders, ignitereports) задаются переменные для хоста/порта/имени БД (часто общий MongoDB на хосте).

### 3.4. Как хендлер получает доступ к БД

**Файл:** `nodejs/services/common/utils/route/lib/extractDbsFromRequest.js`

Функция **`getDbs(request)`** возвращает объект с полями:

- `mongoIgniteCrmClient`, `mongoIgniteCrmdb`;
- `mongoIgniteCrmSecondaryClient`, `mongoIgniteCrmSecondarydb`;
- `mongoIgniteReportClient`, `mongoIgniteReportdb`;
- `mongoIgniteReportSecondaryClient`, `mongoIgniteReportSecondarydb`;
- плюс Redis, Elastic, Redshift и т.д.

Значения берутся из **`request.app.locals`** (то, что положили при старте siteApp). В роутах в **options** передаётся `dbs: getDbs(request)`, и хендлер вызывает модули работы с Mongo, передавая им `options.dbs.mongoIgniteCrmClient` и `options.dbs.mongoIgniteCrmdb` (или report/secondary).

Итог: подключение к MongoDB одно на приложение (по одной базе — один клиент и один db), создаётся при подъёме Express (siteApp), доступ в хендлерах — через **request → app.locals → getDbs(request)**.

---

## 4. Как устроены коллекции и модули доступа

### 4.1. Нет единой «схемы» в коде

Коллекции не объявляются отдельным миграционным слоем. Имя коллекции задаётся константой в модуле, который с ней работает (например `const COLLECTION = "ignite_users"`). Структура документа определяется тем, что пишут и читают в коде; для валидации при записи/обновлении используется **Joi** в этих же модулях.

### 4.2. Модуль на коллекцию (паттерн «репозиторий»)

В `nodejs/services/common/utils/mongo/` для каждой сущности обычно есть свой файл (или папка), который:

- Объявляет **COLLECTION** (имя коллекции).
- Опционально задаёт **Joi-схемы** для query и для полей при update.
- Экспортирует функции: **findByCustomQuery**, **findOne**, **findById**, **findOneAndUpdate**, **pagedFindByCustomQuery**, **aggregateByCustomQuery**, **insertOne**, **deleteMany** и т.д.

Все эти функции принимают первым аргументом **клиент Mongo** (экземпляр MongodbClient), вторым — **db** (результат `open`). Внутри вызывают методы клиента, передавая `db`, `COLLECTION` и остальные параметры (query, projection, sort, update и т.д.).

Примеры коллекций и файлов:

| Коллекция | Путь к модулю |
|-----------|----------------|
| `ignite_users` | `common/utils/mongo/ignite/crm/user.js` |
| `user_tokens` | `common/utils/mongo/ignite/auth/usertoken.js` |
| `user_logs` | `common/utils/mongo/ignite/userLog.js` |
| По платформам (xandr, googleads, dv360 и т.д.) | `common/utils/mongo/ignite/` по домену |

### 4.3. Пример модуля: user.js

**Файл:** `nodejs/services/common/utils/mongo/ignite/crm/user.js`

- **COLLECTION** = `"ignite_users"`.
- **Joi**: описание полей для update (`updateDocSchema`), для query по username и т.д.
- Методы:
  - **findByUserName(mongodb, db, username)** — `mongodb.findOne(db, COLLECTION, { username })`.
  - **findByCustomQuery(mongodb, db, query, fields, limit, sort)** — `mongodb.find(db, COLLECTION, query, ...)`.
  - **pagedFindByCustomQuery(..., skip)** — пагинация через `mongodb.pagedFind`.
  - **findOneAndUpdate(mongodb, db, query, updateDoc, fields, upsert, sort)** — валидация через Joi, затем `mongodb.findOneAndUpdate`, при необходимости diff-логирование.
  - **aggregateByCustomQuery(mongodb, db, query)** — `mongodb.aggregate(db, COLLECTION, query)`.
  - Аналогично: findById, deleteByUsername, bulkWrite и т.д.

Документы в `ignite_users` содержат поля вроде username, firstName, lastName, email, role, status, favoriteMarkets и т.д. — как в `updateDocSchema`.

### 4.4. Индексы

Индексы не создаются автоматически при старте приложения. В коде оставлены комментарии с командами для ручного создания (или скриптов миграций нет в приведённых файлах). Пример из **userLog.js**:

```js
/**
  db.user_logs.createIndex({ username: 1, userDate: 1 }, { background: true })
  db.user_logs.createIndex({ username: 1, lastAuth: -1 }, { background: true })
*/
```

В **mongodb50.js** у клиента есть методы **indexes(db, collectionName)** и **createIndex(db, collectionName, keyspec, options)** — при необходимости индексы можно создавать из кода или скриптов.

---

## 5. Как пишутся роуты и связь с MongoDB

### 5.1. Цепочка: Express → роут → handler → Mongo

1. **Express app** (главный app в `start.js`) поднимается, затем **dispatcher** подключает **siteApp** (например для orders: `sites/orders/siteApp.js`).
2. В **siteApp** после подключения MongoDB и других ресурсов вызывается **loadSiteRoutes(siteApp, sitePath + "/routes")** — подключаются все файлы из папки **routes**.
3. В каждом файле роутов (например **routesAdvertiserGroups.js**) регистрируются маршруты Express:
   - `app.post("/advertiser-groups", authenticate, routes.getPagedAdvertiserGroups)` и т.д.
4. Обработчик роута (например **getPagedAdvertiserGroups**) формирует **options**: `dbs: getDbs(request)`, `headers`, `params` (body, user из getJwtUser(request) и т.д.), и вызывает **routeHandler.handleRoute(request, response, next, pathToHandler, options)**.
5. **routeHandler** делает `require(handlerFile)` и вызывает **handler(options)**. Внутри хендлера используются модули Mongo: передаётся `options.dbs.mongoIgniteCrmClient` и `options.dbs.mongoIgniteCrmdb`, вызываются функции вроде `mongoIgniteCrmUser.findByCustomQuery(...)`, `mongoIgniteCrmAdvertiserGroup.pagedFindByCustomQuery(...)` и т.д.
6. Результат handler возвращается в routeHandler и уходит клиенту (JSON, статусы, при необходимости заголовок jwt).

То есть **роуты** только собирают `options` и передают управление в **handler**; сами запросы к MongoDB выполняются в **хендлерах** через модули из **common/utils/mongo/...**.

### 5.2. Пример хендлера с MongoDB

**Файл:** `nodejs/services/igniteorders/sites/orders/handlers/advertiserGroups/getPagedAdvertiserGroups.js`

- Валидация тела запроса через **Joi** (page, pageSize, sortModel, search, advancedSearch).
- Из **options.dbs** достаются `mongoIgniteCrmClient`, `mongoIgniteCrmdb`.
- Загрузка пользователя: **mongoIgniteCrmUser.findByCustomQuery(client, db, { username })**.
- Построение **query** для списка (например по search, status, ролям).
- Вызов **mongoIgniteCrmAdvertiserGroup** (и при необходимости **mongoIgniteCrmAdvertiser**) с **pagedFindByCustomQuery** или **findByCustomQuery** (limit, skip, sort).
- Формирование ответа (массив, пагинация) и возврат из handler.

Роут для этого хендлера в **routesAdvertiserGroups.js** передаёт в options `body`, `user: getJwtUser(request)` и вызывает **routeHandler.handleRoute(..., handlerDir + "/advertiserGroups/getPagedAdvertiserGroups", options)**.

---

## 6. Express в связке с Node.js и MongoDB

### 6.1. Роль Express

**Express** — фреймворк для HTTP-сервера в Node.js: маршрутизация (get/post/put/delete), middleware (body parser, cors, auth, логирование), отправка ответов. В проекте на Express построены все Node.js бэкенд-сервисы (auth, igniteorders, ignitereports и т.д.). MongoDB подключается не «в» Express, а к приложению Node.js; Express только даёт точку входа (запрос/ответ) и передаёт в хендлеры объект **request**, из которого через **app.locals** достаются клиенты и базы.

### 6.2. Как Express и Mongo стыкуются в приложении

1. **Точка входа сервиса** (например **igniteorders/start.js**): создаётся `app = express()`, вызывается **dispatcher.boot(app, __dirname)** — подключаются siteApp’ы.
2. **siteApp** (например **orders/siteApp.js**):
   - Создаётся `siteApp = express()`.
   - Поднимаются подключения к MongoDB (и Redis, Elastic и т.д.), результаты кладутся в **siteApp.locals**.
   - Подключаются middleware: **cors()**, таймаут запроса, **cookieParser()**, **bodyParser.json()**, **bodyParser.urlencoded()**, логирование.
   - Вызывается **loadSiteRoutes(siteApp, .../routes)** — регистрируются роуты на этом **siteApp**.
   - **siteApp** монтируется на главный app: **mainApp.use("/lumina/orders/api/ignite", siteApp)**.
3. При запросе клиента:
   - Express направляет запрос в нужный route по пути.
   - В роуте вызывается **getDbs(request)** → из **request.app.locals** берутся mongoIgniteCrmClient, mongoIgniteCrmdb и т.д.
   - Хендлер получает **options** с **dbs** и вызывает модули из **common/utils/mongo/...**, передавая им client и db. Те же клиенты и базы используются для всех запросов к этому siteApp (общий пул соединений).

Таким образом, **связка Express + Node.js + Mongo** выглядит так: Node.js запускает процесс, Express обрабатывает HTTP и передаёт запрос в handler, handler использует переданные в options клиент и db MongoDB (из app.locals) и через общие модули выполняет find/update/aggregate и возвращает результат обратно в Express для ответа клиенту.

### 6.3. Важные файлы Express в проекте

| Файл | Назначение |
|------|------------|
| **igniteorders/start.js** | Создание app, dispatcher.boot, app.listen. |
| **igniteorders/sites/orders/siteApp.js** | express(), подключение Mongo/Redis/Elastic, middleware, loadSiteRoutes, mount на /lumina/orders/api/ignite. |
| **common/utils/startup/loadSiteRoutes.js** | Подключение всех *.js из папки routes в siteApp. |
| **common/utils/route/routeHandler.js** | Вызов handler(options), отправка ответа, заголовок jwt. |
| **common/utils/route/lib/extractDbsFromRequest.js** | Доступ к БД (Mongo, Redis и др.) из request.app.locals. |

---

## 7. Краткий справочник: от запроса к документу Mongo

1. Запрос приходит на URL вида `/lumina/orders/api/ignite/advertiser-groups` (proxy направляет на сервис orders).
2. Express (siteApp) обрабатывает путь `/advertiser-groups` (префикс /lumina/orders/api/ignite уже отрезан при mount).
3. Роут **app.post("/advertiser-groups", authenticate, routes.getPagedAdvertiserGroups)** срабатывает; **authenticate** проверяет JWT и кладёт пользователя в request.
4. В роуте формируется **options** с **dbs: getDbs(request)** (в т.ч. mongoIgniteCrmClient, mongoIgniteCrmdb).
5. **routeHandler.handleRoute(..., "handlers/.../getPagedAdvertiserGroups", options)** загружает handler и вызывает **handler(options)**.
6. Handler вызывает, например, **mongoIgniteCrmUser.findByCustomQuery(client, db, { username })** и **mongoIgniteCrmAdvertiserGroup.pagedFindByCustomQuery(client, db, query, fields, limit, sort, skip)**.
7. В **mongodb50.js** это превращается в **db.collection(COLLECTION).find(query).projection(...).sort(...).skip(...).limit(...).toArray()**.
8. Результат возвращается из handler в routeHandler и уходит клиенту как JSON.

---

## 8. Итог

- **MongoDB** в проекте — основная NoSQL БД для CRM и отчётных данных; используется нативный драйвер, без Mongoose.
- **Подключение**: конфиги в `config/config-*-mongo.js`, клиент **MongodbClient** в **common/utils/mongo/mongodb50.js**, открытие баз при старте **siteApp** и сохранение в **app.locals**; в хендлерах доступ через **getDbs(request)**.
- **Коллекции**: одна коллекция — один (или несколько) модулей в **common/utils/mongo/...** с константой COLLECTION и методами find/findOne/findOneAndUpdate/aggregate и т.д.; схема документа задаётся кодом и Joi при необходимости.
- **Роуты**: в **routes** регистрируются маршруты Express; они собирают **options** (dbs, params, user) и вызывают **routeHandler.handleRoute** с путём к handler; запросы к Mongo выполняются внутри handler через эти модули.
- **Express** обеспечивает HTTP-слой и передачу request в роуты и хендлеры; доступ к Mongo — через app.locals и getDbs(request), без создания соединений на каждый запрос.

Если нужно, можно добавить раздел с примерами агрегаций или создания нового модуля под новую коллекцию.
