# План подготовки к Backend — полные ответы и примеры из проекта

Для каждого вопроса: развёрнутый ответ; если используется в проекте — путь к файлам и **примеры кода**; если нет — подробное объяснение и теоретические примеры. Алгоритмы — краткая теория + пример реализации.

---

# 1. Core JavaScript (обязательно для Node)

## Event Loop & Async

### Что такое event loop?

**Ответ:** В Node.js один поток выполняет JavaScript. Event loop — это цикл, который постоянно проверяет: есть ли готовый к выполнению код (синхронный стек пуст). Тогда он берёт задачу из очередей: сначала **microtask** (Promise callbacks, queueMicrotask), затем одну **macrotask** (timer callbacks, I/O, setImmediate). Так I/O не блокирует поток: запрос к БД/сети уходит в систему, callback ставится в очередь и выполнится, когда данные готовы.

**Пример порядка выполнения (для собесе):**

```js
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// Вывод: 1, 4, 3, 2  — синхронный код, затем microtask (3), затем macrotask (2)
```

**В проекте:** Вся асинхронность построена на этом: запросы к Mongo, Redis, HTTP, S3 идут через async/await и Promise. В `nodejs/services/common/utils/route/routeHandler.js` хендлер вызывается асинхронно, не блокируя цикл:

```js
// routeHandler.js (сокращённо)
let handler = require(handlerFile);
try {
  let result = await handler(options); // I/O внутри handler — callback в очередь, цикл свободен
  if (!response.headersSent) {
    response.setHeader("Content-Type", "Application/json");
    if (lodash.get(result, "accessToken")) {
      response.setHeader("jwt", lodash.get(result, "accessToken"));
      lodash.unset(result, "accessToken");
    }
    // ... отправка result клиенту
  }
  next();
} catch (err) {
  routeError(request, response, 400, err);
  next(err);
}
```

Хендлеры вызывают `await mongo...find()`, `await redis.get()` и т.д. — каждая такая операция отдаёт управление event loop, пока ждёт ответа.

---

### Разница между microtask и macrotask?

**Ответ:** **Microtask** — очередь с высшим приоритетом: `.then`/`.catch`/`.finally`, `queueMicrotask()`. Выполняются **все** подряд сразу после текущего синхронного кода, до перехода к следующей macrotask. **Macrotask** — таймеры (setTimeout/setInterval), I/O callbacks, setImmediate. За одну итерацию event loop обрабатывается одна macrotask, между макрозадачами снова опустошается очередь microtask. Поэтому несколько подряд `Promise.then` выполнятся до любого `setTimeout(fn, 0)`.

**В проекте:** Явного разделения в коде нет. Везде async/await и Promise — это microtask; таймеры (request timeout, Redis health) — macrotask.

---

### Чем отличаются setTimeout, setImmediate, process.nextTick?

**Ответ:**

- **process.nextTick(callback)** — callback ставится в **очередь nextTick** (выполняется раньше microtask в старых версиях; в Node сейчас nextTick выполняется как часть «текущей» фазы до перехода к следующей). Выполняется в начале следующей итерации, но до таймеров и I/O.
- **setImmediate(callback)** — в очередь фазы «check»; выполнится после I/O callbacks текущего цикла. Используется для отложенного кода после I/O.
- **setTimeout(fn, 0)** — в очередь таймеров; минимальная задержка ~1–4 ms в зависимости от платформы, выполнится в фазе timers.

Порядок (упрощённо): синхронный код → nextTick → microtask (Promise) → одна macrotask (например timer или setImmediate).

**В проекте:** nextTick/setImmediate в коде почти не используются. Таймауты — в `nodejs/services/igniteorders/sites/orders/siteApp.js`:

1. **Ограничение времени жизни запроса (90 сек):** после `Promise.all(tasks)` регистрируется middleware, который ставит таймер на каждый request; при срабатывании отправляется 400 «request timed out» и вызывается clearTimeout. Таймер очищается в конце обработки запроса и в /health:

```js
siteApp.use(function (request, response, next) {
  request.timeout = setTimeout(function () {
    if (request.timeout && !response.headersSent) {
      logger().error({ error: "request timed out" }, "request timedout");
      response.status(400).json({ error: "request timed out" });
      response.end();
    }
    clearTimeout(request.timeout);
    next(new Error("Request Timedout"));
  }, 90000);
  next();
});
```

2. **Redis health check (кластер):** при обращении к /health для Redis-кластера вызывается setex на каждой ноде; при успехе ставится setTimeout на 60 сек, после которого сбрасывается выбор «мастера», чтобы при следующем /health снова проверить ноды.

---

### Что произойдёт в сложном примере с Promise + nextTick?

**Ответ:** Нужно знать порядок: 1) весь синхронный код; 2) все nextTick подряд; 3) все microtask (then) подряд; 4) одна macrotask (например setTimeout); затем снова 2–4. На собеседовании обычно дают код с console.log и просят назвать порядок вывода — разбирать по шагам.

**В проекте:** Сложных цепочек nextTick нет; для ответа на собесе достаточно разобрать пример на доске/бумаге.

---

### Почему Node считается single-threaded?

**Ответ:** Выполнение **JavaScript-кода** идёт в одном потоке. Один call stack, один event loop. При этом I/O (сеть, диск) и часть тяжёлых операций выполняются вне этого потока (пул потоков libuv, системные вызовы). Поток не «висит» в ожидании ответа от БД — он отдаёт задачу и обрабатывает другие callback’и. Поэтому single-threaded относится к JS, а не к всей системе.

**В проекте:** Каждый сервис (auth, igniteorders, ignitereports) — один процесс на инстанс; параллелизм за счёт async I/O и нескольких подов в Kubernetes.

---

### Что такое libuv?

**Ответ:** Библиотека на C, которую использует Node.js для асинхронного I/O и event loop. Даёт кроссплатформенный API для сетевого и файлового I/O, таймеров; управляет пулом потоков для части операций (например файловая система на Windows). Event loop в Node — по сути цикл libuv плюс интеграция с V8 (выполнение JS при срабатывании callback’ов).

**В проекте:** Не вызывается напрямую. Весь I/O (Mongo, Redis, HTTP, файлы) идёт через драйверы Node, которые под капотом используют libuv.

---

## Promises

### Как работает Promise.all?

**Ответ:** Принимает итерируемое (часто массив) промисов. Возвращает один промис, который:

- **resolve** — когда **все** переданные промисы успешно завершились; значение — массив результатов **в том же порядке**, что и переданные промисы.
- **reject** — при **первом же** reject; причина — эта ошибка; остальные промисы продолжают выполняться, но результат уже не используется.

Подходит, когда нужно запустить несколько независимых операций параллельно и получить все результаты; если одна упадёт — вся операция считается неудачной (fail-fast).

**Пример:**

```js
const [db1, db2, db3] = await Promise.all([
  client1.open("db1"),
  client2.open("db2"),
  client3.open("db3"),
]);
// Все три подключения установлены параллельно; порядок в массиве сохранён.
```

**В проекте:** Параллельный старт подключений к БД при подъёме приложения в `nodejs/services/igniteorders/sites/orders/siteApp.js`:

```js
let tasks = [];

// Каждый клиент — отдельный промис открытия базы
tasks.push(
  mongoIgniteCrmClient.open(configIgniteCrmMongo.mongoIgniteCrm.dbname)
    .then((db) => {
      siteApp.locals.mongoIgniteCrmClient = mongoIgniteCrmClient;
      siteApp.locals.mongoIgniteCrmdb = db;
      return "mongoIgniteCrm";
    })
);
tasks.push(
  mongoIgniteCrmSecondaryClient.open(...).then((db) => { ... })
);
tasks.push(
  mongoIgniteReportClient.open(...).then((db) => { ... })
);
tasks.push(
  mongoIgniteReportSecondaryClient.open(...).then((db) => { ... })
);

Promise.all(tasks).then((result) => {
  // Только после подключения ВСЕХ баз регистрируются middleware и роуты
  siteApp.use(cors());
  siteApp.use(...); // timeout, bodyParser, loadSiteRoutes и т.д.
  mainApp.use("/lumina/orders/api/ignite", siteApp);
});
```

Так поднимаются mongoIgniteCrm, mongoIgniteCrmSecondary, mongoIgniteReport, mongoIgniteReportSecondary до того, как приложение начнёт принимать запросы.

---

### Чем отличается Promise.all от allSettled?

**Ответ:**

- **Promise.all** — «всё или ничего»: при первом reject весь результат reject; при успехе — массив значений.
- **Promise.allSettled** — ждёт завершения **всех** промисов (и fulfilled, и rejected). Результат — массив объектов `{ status: 'fulfilled', value }` или `{ status: 'rejected', reason }`. Удобно, когда нужны итоги по каждому вызову (например батч-обработка, где часть может падать).

**В проекте:** Используем `Promise.all` при старте (все БД должны подняться). Для батчей, где часть операций может падать, логично было бы рассмотреть `allSettled`; в коде чаще циклы с await.

---

### Реализовать Promise.all

**Ответ (псевдокод):**

```js
function promiseAll(promises) {
  return new Promise((resolve, reject) => {
    if (!promises || (!Symbol.iterator) in Object(promises)) {
      return reject(new TypeError("iterable expected"));
    }
    const arr = [...promises];
    if (arr.length === 0) return resolve([]);
    const results = new Array(arr.length);
    let done = 0;
    arr.forEach((p, i) => {
      Promise.resolve(p)
        .then((val) => {
          results[i] = val;
          if (++done === arr.length) resolve(results);
        })
        .catch(reject);
    });
  });
}
```

Идея: сохранять результаты по индексу, считать выполненные; при первом reject вызвать reject общего промиса; при всех resolve — resolve(results).

**В проекте:** В коде используется нативный `Promise.all`; на собесе могут попросить написать такую реализацию на доске.

---

### Что такое unhandled rejection?

**Ответ:** Промис перешёл в состояние **rejected**, но ни один код не обработал ошибку: нет `.catch()`, нет `try/catch` вокруг `await`, и до следующего tick не появится обработчик. В Node.js в этом случае генерируется событие **`unhandledRejection`** (аргументы: reason, promise). Если позже к этому промису привяжут .catch(), сработает `rejectionHandled`. Без обработчика unhandledRejection Node выводит предупреждение; в новых версиях может завершить процесс.

**Пример (как возникает):**

```js
async function bad() {
  throw new Error("oops");
}
bad(); // Ни await, ни .catch() — unhandled rejection
```

**В проекте:** Глобальная обработка во всех сервисах (auth, ignitereports, igniteswagger и т.д.). Пример из `nodejs/services/auth/start.js`:

```js
process.on("uncaughtException", function (err) {
  logger().fatal({ error: err }, "logging exception that terminate the process.");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promiseFrom) => {
  logger().fatal(
    { error: reason, promiseFrom: promiseFrom },
    "logging exception that terminate the process.",
  );
  process.exit(1);
});
```

Так любой необработанный rejection (например забытый try/catch в async-хендлере или падение в .then без .catch) логируется и процесс завершается предсказуемо, а не «висит» с необработанной ошибкой.

---

## Async/Await

### Почему async функция всегда возвращает Promise?

**Ответ:** По спецификации: функция, объявленная с `async`, при вызове всегда возвращает **Promise**. Если внутри return x (не Promise), движок оборачивает значение в `Promise.resolve(x)`. Если выбрасывается исключение (или возвращается rejected promise), результат — `Promise.reject(...)`. Поэтому вызов async-функции можно обрабатывать через `.then()/.catch()` или через await в другой async-функции.

**В проекте:** Все хендлеры маршрутов — async: `module.exports = async (options) => { ... }`. Пример: `nodejs/services/igniteorders/sites/orders/handlers/advertiserGroups/getPagedAdvertiserGroups.js`. Возвращаемое значение из handler’а попадает в routeHandler и отправляется клиенту; при ошибке routeHandler ловит исключение в try/catch.

---

### Как правильно обрабатывать ошибки?

**Ответ:**

- В **async/await**: оборачивать вызовы в **try/catch**; в catch — залогировать и либо пробросить дальше, либо вернуть/отправить клиенту понятный ответ.
- При **Promise** — не забывать **.catch()** или второй аргумент в then.
- Не оставлять необработанные rejection — подписаться на **process.on("unhandledRejection")** в Node.
- Централизованный обработчик ошибок в Express: middleware с сигнатурой `(err, req, res, next)` в конце цепочки.

**В проекте:** Централизованно: `nodejs/services/common/utils/route/routeHandler.js` — `try { result = await handler(options); ... } catch (err) { routeError(request, response, 400, err); }`. Ошибки в ответ клиенту формируются в `routeError.js`. Плюс глобальный unhandledRejection в start.js у каждого сервиса.

---

# 2. Node.js Core

## Архитектура

### Что такое non-blocking I/O?

**Ответ:** Операция ввода-вывода (сеть, диск, таймер) **не блокирует** поток выполнения. Запрос отправляется (например в ядро ОС или в пул потоков), текущий код продолжает выполняться; когда результат готов, в очередь ставится callback и выполнится в следующей итерации event loop. Так один поток может обслуживать много одновременных I/O операций.

**В проекте:** Все вызовы к Mongo, Redis, HTTP (axios), S3, Redshift — асинхронные (await). Пример: `nodejs/services/common/utils/auth/checkRedisToken.js` — `await options.dbs.redisIgniteClient.get(...)`.

---

### Blocking vs CPU-bound?

**Ответ:**

- **Blocking I/O** — поток «спит», пока ждёт ответа от диска/сети; в Node при правильном использовании API мы не блокируем поток на I/O.
- **CPU-bound** — поток занят вычислениями (циклы, криптография, парсинг больших данных). Пока выполняется тяжёлый код, event loop не обрабатывает другие запросы, поэтому латентность растёт.

**В проекте:** I/O не блокируем. Тяжёлые расчёты вынесены в batch-скрипты и очередь (ignitequeue), а не в HTTP-обработчики.

---

### Что делать с CPU-heavy задачами?

**Ответ:** Не выполнять долгие вычисления в том же потоке, что и event loop. Варианты: вынести в **worker_threads** (отдельный поток с тем же процессом), **child_process** (отдельный процесс), отдельный **микросервис** или **очередь задач** (обработчик в другом процессе/поде). Так основной сервер остаётся отзывчивым.

**В проекте:** Тяжёлые отчёты и экспорт (например PPT) — в очередь: `nodejs/services/ignitequeue`, обработчики вроде `nodejs/services/ignitequeue/handlers/export/pptExportHandler.js`. Batch-скрипты в `nodejs/services/batch/bin/`, `batch/main/` — отдельные запуски (cron в kube), не в HTTP-потоке.

---

### Что такое worker_threads?

**Ответ:** Модуль Node.js для многопоточности внутри одного процесса. Каждый worker — отдельный поток с собственным изолированным контекстом V8 (отдельная куча). Обмен данными — через **MessageChannel** или **SharedArrayBuffer**. Подходит для CPU-bound задач без раздувания числа процессов. В отличие от child_process, разделяют память процесса только при явном использовании SharedArrayBuffer.

**В проекте:** Не используем; масштабирование — горизонтальное (несколько подов в Kubernetes).

---

### Когда использовать child_process?

**Ответ:** Когда нужно: запустить **другую программу** (не Node); **изолировать** задачу в отдельном процессе (сбой не роняет основной процесс); использовать **несколько ядер** (каждый процесс — свой экземпляр Node). Методы: `spawn`, `exec`, `execFile`, `fork` (для дочернего Node-скрипта с каналом IPC).

**В проекте:** Явных вызовов child_process в коде не видно. Batch-задачи запускаются как отдельные джобы (cron в Kubernetes), т.е. по сути «вне» основного процесса сервиса.

---

## Streams

### Какие типы streams существуют?

**Ответ:** В Node.js есть четыре базовых типа:

- **Readable** — источник данных (чтение файла, ответ HTTP, генератор).
- **Writable** — приёмник (запись в файл, отправка ответа).
- **Duplex** — и чтение, и запись (сокет).
- **Transform** — Duplex с преобразованием данных по мере прохождения (например gzip, парсер).

Есть также **PassThrough**. Стримы работают в режиме объекта или в бинарном режиме.

**В проекте:** Readable — ответы API, чтение CSV из S3. Writable — запись в Mongo батчами. Пример **Writable + batch insert** — `nodejs/services/common/utils/stream/streamToMongo.js`:

- Возвращается Writable stream; при вызове `write(chunk)` документы накапливаются в массив `records`.
- Когда `records.length >= config.batchSize` (по умолчанию 10), вызывается `insert()`: `collection.insertMany(records)` или `collection.bulkWrite(updateBulkQuery)` в зависимости от `config.command` (insertMany / updateOne / upsertOne / updateMany).
- После вставки массив очищается; при `_write` снова накапливаются чанки. Так обрабатывается backpressure: данные не держатся бесконечно, а пишутся батчами в Mongo.
- Используется в пайплайнах: Readable (например CSV из S3) → Transform (парсинг) → streamToMongo(options).

Ещё: `nodejs/services/batch/main/converts/assignments/getCampaignAssignmentsStream.js` — Transform, pipeline, Writable.

---

### Что такое backpressure?

**Ответ:** Когда **consuming** (приёмник) не успевает обрабатывать данные, **producing** (источник) не должен продолжать генерировать данные без ограничения, иначе растёт потребление памяти. Backpressure — механизм «напора назад»: приёмник сигнализирует (например через возврат false от `write()` или через событие `drain`), что буфер полон; источник приостанавливает чтение (не вызывает `read()`/не пушит в поток), пока приёмник не освободится. При использовании `pipe()` Node сам управляет backpressure между потоками.

**В проекте:** При `pipe()` и потоковых API (Mongo, HTTP) backpressure обрабатывается драйверами. В streamToMongo накопление идёт в массив с последующим insertMany батчами — тем самым ограничивается объём данных в памяти.

---

### pipe vs manual streaming?

**Ответ:** **pipe()** автоматически подключает Readable к Writable: перекачивает данные, обрабатывает backpressure (pause/resume) и пробрасывает ошибки с одного потока на оба. **Manual** — подписка на события `data`, `end`, `error` у источника и вызов `write()`/`end()` у приёмника; нужно самим обрабатывать паузу при переполнении (drain) и ошибки. Pipe проще и безопаснее; manual даёт больший контроль (например трансформация по чанкам).

**В проекте:** pipe: `nodejs/services/common/utils/s3/s3filesCsv.js` — readStream.pipe(parse(...)). Ручная обработка стримов в getCampaignAssignmentsStream.js.

---

## Buffers

### Что такое Buffer?

**Ответ:** В Node.js **Buffer** — класс для работы с последовательностью байт вне кучи V8. По сути массив байт с методами для чтения/записи (в т.ч. в разных кодировках), создания из строки (например base64), конкатенации, среза. Используется для бинарных протоколов, файлов, кодировок при работе с сетью или криптографией.

**В проекте:** В основном для **Basic Auth** в заголовке Authorization: строка `"user:password"` или `apiKey` кодируется в base64. Пример из `nodejs/services/common/utils/pinterest/pinterestAuth.js`:

```js
const authString = `${configPinterest.clientId}:${configPinterest.clientSecret}`;
const base64AuthString = Buffer.from(authString).toString("base64");
const options = {
  headers: {
    Authorization: `Basic ${base64AuthString}`,
    // ...
  },
};
```

Тот же приём: `nodejs/services/common/utils/basis/basisAuth.js`, `nodejs/services/ignitereports/sites/ignite/handlers/reports/export/generatePptAll.js` (adminAuth), `nodejs/services/igniteorders/sites/orders/handlers/help/create/utils/uploadFileToJira.js` (Jira API token). Для размера контента — `Buffer.byteLength(content)`.

---

### Где используется Buffer?

**Ответ:** Везде, где нужны бинарные данные или кодировки: чтение/запись файлов, сокеты, HTTP body, Base64 для авторизации или вложений, криптография. В нашем проекте — в основном Base64 для заголовка Authorization и проверка размера контента (см. пути выше).

---

## Memory

### Что такое memory leak?

**Ответ:** Утечка памяти — постоянный рост потребления памяти приложением со временем, потому что объекты больше не нужны, но на них остаются ссылки и сборщик мусора их не освобождает. Типичные причины: глобальные или долгоживущие структуры, куда постоянно что-то добавляется; незакрытые таймеры/подписки; замыкания, держащие большие объекты; кэши без ограничения размера.

**В проекте:** Стараемся не копить данные в глобальных переменных; таймаут запроса храним в `request.timeout` и очищаем в end/health (clearTimeout). Подключения к БД — один клиент на приложение, переиспользуются.

---

### Причины memory leak в Node?

**Ответ:** Глобальные объекты (переменные без var/let/const или привязка к global); незакрытые таймеры (setInterval без clearInterval); незакрытые соединения (сокеты, БД); замыкания, сохраняющие большие объекты; утечки в нативных модулях; растущие кэши без вытеснения (например без TTL или LRU).

**В проекте:** Таймауты привязаны к request и очищаются. Клиенты Mongo/Redis создаются один раз при старте и хранятся в app.locals.

---

### Что такое garbage collection в V8?

**Ответ:** V8 использует generational GC: объекты делятся на «молодые» (новые) и «старые». Сборка молодых (Scavenge) быстрая и частая; старые (Mark-Sweep, Mark-Compact) — реже и дольше. Есть инкрементальная разметка, чтобы не блокировать поток надолго. Можно включить флаги (например --expose-gc) и при необходимости вызывать сборку вручную для отладки; в проде обычно не трогают.

**В проекте:** Явно не настраиваем; при проблемах с памятью можно смотреть heap (например через Chrome DevTools или node --inspect) и при необходимости --expose-gc.

---

# 3. HTTP / API / Express

### Как работает HTTP?

**Ответ:** Протокол запрос-ответ: клиент отправляет **request** (метод, URL, заголовки, опционально тело), сервер возвращает **response** (статус, заголовки, тело). Соединение может быть повторно использовано (keep-alive). HTTP сам по себе **stateless** — сервер не хранит состояние между запросами; сессию реализуют поверх (cookie, токены).

**В проекте:** Все сервисы — HTTP API. Прокси на порту 3200 маршрутизирует запросы на auth (3207), orders (3210), reports (3211) и т.д. См. `nodejs/proxy/start.js`, `config-remote.js`.

---

### REST принципы?

**Ответ:** Ресурсы идентифицируются **URL**; действия задаются **HTTP-методами** (GET — получение, POST — создание/действие, PUT — полная замена, PATCH — частичное обновление, DELETE — удаление); **статус-коды** отражают результат (200, 201, 400, 401, 404, 500); представление ресурса — например JSON; по возможности идемпотентность и кэшируемость GET.

**В проекте:** Ресурсы: `/advertiser-groups`, `/pacing/...`, `/platforms/xandr/...`. Методы: GET для получения, POST для списков с телом и действий, PUT/DELETE для обновления/удаления. Файлы: `nodejs/services/igniteorders/sites/orders/routes/routesAdvertiserGroups.js`, `routesPlatforms.js`, `routesPacing.js`.

---

### PUT vs PATCH?

**Ответ:** **PUT** — полная замена ресурса по URL; клиент отправляет весь объект; идемпотентен. **PATCH** — частичное обновление; клиент отправляет только изменяемые поля; тоже идемпотентен при повторном применении того же патча. Выбор зависит от контракта API.

**В проекте:** В основном PUT для обновления (например update advertiser group). PATCH можно упомянуть как вариант для частичных обновлений.

---

### Idempotent методы?

**Ответ:** Идемпотентность: повторный **одинаковый** запрос даёт тот же результат и не меняет состояние сверх первого раза. **GET, PUT, DELETE** считаются идемпотентными. **POST** — нет (каждый вызов может создавать новый ресурс). Важно для повторных отправок и кэширования.

**В проекте:** PUT/DELETE на ресурсы (update/archive) — идемпотентны; POST для создания или сложных действий — нет.

---

### Что такое middleware?

**Ответ:** В Express middleware — функция с сигнатурой `(req, res, next)`. Она может читать/менять req и res, вызывать `next()` для передачи управления следующему middleware или завершить ответ (res.send/redirect и не вызывать next). Роуты тоже являются middleware. Порядок регистрации (use/get/post и т.д.) задаёт цепочку выполнения. Если в next передать аргумент (например next(err)), Express ищет error-handling middleware с сигнатурой (err, req, res, next).

**В проекте:** В `nodejs/services/igniteorders/sites/orders/siteApp.js` порядок такой (после подключения БД в Promise.all(tasks).then(...)):

1. **cors()** — разрешение кросс-доменных запросов
2. **Таймаут 90 сек** — request.timeout = setTimeout(..., 90000); при долгом запросе — 400
3. **Роут /health** — siteApp.get("/health", ...)
4. **Роут /robots.txt**
5. **cookieParser()**, **bodyParser.json()**, **bodyParser.urlencoded()** — разбор тела и cookie
6. **Логирование старта** — request.startTime = Date.getTime(), logger, next()
7. **loadSiteRoutes(siteApp, sitePath + "/routes")** — подключение всех роутов (в т.ч. app.post("/advertiser-groups", authenticate, routes.getPagedAdvertiserGroups))
8. **Логирование конца** — responseTime, clearTimeout(request.timeout), logger
9. **Error-handling middleware** — (err, req, res, next) => { logger.error(...); clearTimeout(request.timeout); next(err); }

Перед защищёнными хендлерами в роутах стоит **authenticate** — middleware из `nodejs/services/common/utils/route/lib/authenticate.js`: проверяет JWT, кладёт пользователя в request.tpjwt или отдаёт 401.

---

### Как устроена цепочка middleware?

**Ответ:** Middleware вызываются в порядке регистрации. Каждый вызывает `next()` для перехода к следующему или не вызывает — тогда цепочка обрывается (ответ уже отправлен). Если в next передаётся аргумент (обычно error), Express переходит к error-handling middleware с сигнатурой (err, req, res, next).

**В проекте:** siteApp.use(...) задаёт порядок; в роутах: authenticate → routeHandler.handleRoute (внутри вызывается handler, затем next). Ошибки из handler ловятся в routeHandler try/catch и передаются в routeError.

---

### Centralized error handling?

**Ответ:** Один или несколько middleware обрабатывают ошибки: подписываются на вызов `next(err)` и на необработанные исключения; логируют, формируют единый формат ответа (например `{ error: message }`) и отправляют клиенту с нужным statusCode. Так не дублируется логика обработки ошибок в каждом хендлере. В Express error-handler имеет сигнатуру `(err, req, res, next)` и регистрируется последним.

**В проекте:** Два уровня:

**1 В routeHandler** — любой throw или reject в хендлере ловится и передаётся в единую функцию `routeError`:

```js
// nodejs/services/common/utils/route/routeHandler.js
try {
  let result = await handler(options);
  // ... отправка result, заголовок jwt
  next();
} catch (err) {
  logger().error({ err }, "error response handleRoute");
  routeError(request, response, 400, err);
  next(err);
}
```

**2 routeError** (`nodejs/services/common/utils/route/routeError.js`) — формирует ответ в зависимости от типа ошибки и при необходимости сохраняет заголовок jwt (чтобы клиент не потерял токен при 400):

```js
module.exports = function (request, response, statusCode, error) {
  if (error && error.message) {
    if (!response.headersSent) {
      if (lodash.get(request, "tpjwt.accessToken")) {
        response.setHeader("jwt", lodash.get(request, "tpjwt.accessToken"));
      }
      logger().error({ error: error, request }, "routeError message");
      response.setHeader("Cache-Control", "no-cache, max-age=0");
      response.status(statusCode).json({ error: error.message });
    }
  } else if (error.response) {
    // ответ от axios (внешний API)
    response.status(statusCode).json({ error: errorObj });
  } else {
    response.status(statusCode).json({ error: error });
  }
};
```

**3** В siteApp в конце цепочки — error-handling middleware, который только логирует и очищает request.timeout: `siteApp.use(function (err, request, response, next) { ... })`.

---

### Как валидировать входные данные?

**Ответ:** Проверять тип, формат, границы **до** бизнес-логики. Варианты: схема (Joi, Yup, zod) с validate/validateAsync; проверки вручную; санитизация (escape для вывода, параметризованные запросы для БД). При ошибке возвращать 400 с понятным сообщением (и при необходимости детали по полям — fieldErrors).

**В проекте:** Joi используется в хендлерах. Два примера:

**1 Логин** — `nodejs/services/auth/handlers/login.js`: валидация тела запроса (username, password обязательны). При ошибке Joi возвращается 400 с fieldErrors:

```js
const inputSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});
// ...
const { error } = await inputSchema.validateAsync(options.params.body, { abortEarly: false });
if (error) {
  return Promise.reject(error);
}
// при перехвате в catch: fieldErrors = joiErrors(err), response 400 с schemaViolation/fieldErrors
```

**2 Список advertiser groups** — `nodejs/services/igniteorders/sites/orders/handlers/advertiserGroups/getPagedAdvertiserGroups.js`: валидация body с вложенными полями и enum:

```js
const requestSchema = Joi.object({
  page: Joi.number().integer().options({ convert: false }).required(),
  pageSize: Joi.number().integer().options({ convert: false }).required(),
  sortModel: Joi.array()
    .items(
      Joi.object({
        field: Joi.string().required(),
        sort: Joi.string().valid("asc", "desc").required(),
      }),
    )
    .empty(Joi.array().length(0))
    .optional(),
  search: Joi.string().allow(null),
  advancedSearch: {
    showArchived: Joi.boolean().optional(),
    markets: Joi.array().optional(),
    tab: Joi.string().valid(ADVERTISER_GROUPS_TABS.all, ADVERTISER_GROUPS_TABS.mine).optional(),
  },
});

const { error } = await requestSchema.validateAsync(body, { abortEarly: false });
if (error) {
  return Promise.reject(error); // → routeHandler catch → routeError → 400
}
```

При ошибке валидации handler делает reject → в routeHandler срабатывает catch → routeError отправляет 400 с error.message (или полным error).

---

### Как реализовать rate limiting?

**Ответ:** Ограничить число запросов с одного клиента (по IP или по токену) за окно времени. Варианты: in-memory счётчик (простой, не подходит для нескольких инстансов); Redis с INCR/EXPIRE для распределённого лимита; готовые middleware (express-rate-limit). При превышении — **429 Too Many Requests** и заголовок **Retry-After** (секунды до следующей попытки).

**В проекте:**

- **Входящие запросы:** зависимость `express-rate-limit` в ignitemcp и lumina-mcp (package.json).
- **Исходящие вызовы внешних API:** при 429 делаем паузу по Retry-After и повтор запроса. Пример из `nodejs/services/common/utils/tradedesk/pullReport.js`:

```js
} else if (lodash.get(response, "status") === 429 || errorMessage == "Too Many Requests") {
  const waitSeconds = Number(lodash.get(response, "headers.retry-after")) || waitForPending * 10 / 1000;
  console.log(`Tradedesk exceeded request limit, waiting ${waitSeconds} seconds`);
  await sleep(waitSeconds * 1000);
  return await generateSchedule(reportDates, reportScheduleOptions);  // рекурсивный повтор
}
```

Аналогичная обработка 429 с чтением `retry-after` и повторной попыткой есть в xandr/pullReport.js, snapchat/pullReport.js, meta/pullReport.js, dv360/pullDv360.js и др.

---

### Как защититься от SQL injection?

**Ответ:** Никогда не подставлять пользовательский ввод в строку SQL через конкатенацию. Использовать **параметризованные запросы** (prepared statements, плейсхолдеры), чтобы драйвер сам экранировал значения. Плюс принцип наименьших привилегий для пользователя БД.

**В проекте:** Redshift и отчёты — запросы через клиент/API с параметрами. В коде нет конкатенации пользовательского ввода в SQL; данные подставляются через параметры. См. `nodejs/services/common/utils/redshift/`, `ignitereports/.../handlers/reports/sql/`.

---

# 4. Databases

## SQL

### Что такое индекс?

**Ответ:** Индекс — структура данных (часто B-tree), которая ускоряет поиск по полю(ям). Вместо полного скана таблицы движок обращается к индексу и получает указатели на строки. Ускоряет WHERE, JOIN по ключам, ORDER BY по индексированным полям. Замедляет INSERT/UPDATE/DELETE (нужно обновлять индекс). Выбор полей для индекса — по частым фильтрам и сортировкам.

**В проекте:** В Mongo индексы задаются в комментариях или при инициализации. Пример из `nodejs/services/common/utils/mongo/ignite/userLog.js`:

```js
/**
  db.user_logs.createIndex({username: 1, userDate: 1}, {background: true})
  db.user_logs.createIndex({username: 1, lastAuth: -1}, {background: true})
**/
module.exports.pagedFindByCustomQuery = async function (
  mongodb,
  db,
  query,
  fields,
  limit,
  sort,
  skip,
) {
  return mongodb.pagedFind(db, COLLECTION, query, fields, limit, sort, skip);
};
```

Индексы по (username, userDate) и (username, lastAuth) ускоряют типичные запросы по пользователю и дате/времени входа. В Redshift — таблицы под отчёты, индексы через DDL. В `mongodb50.js` — методы createIndex, indexes.

### Как работает B-tree?

**Ответ:** B-tree — сбалансированное дерево поиска: узлы содержат несколько ключей, потомки — диапазоны значений. Высота логарифмическая от числа записей, поэтому поиск и вставка — O(log n). Хорош для диапазонных запросов (BETWEEN, >, <) и сортировки. В PostgreSQL и многих БД индексы по умолчанию B-tree.

**В проекте:** Теория для ответа; в коде индексы создаём через API (createIndex), внутренняя структура — на совести движка.

### Когда индекс не используется?

**Ответ:** Когда условие применяется к выражению от поля (например WHERE lower(name) = 'x'), индекс по name не подходит. Неселективные поля (мало уникальных значений), очень маленькие таблицы (полный скан дешевле). Неверный порядок полей в composite index — условие должно идти «слева направо». Явное отключение (hints) или неверная статистика тоже могут привести к полному скану.

**В проекте:** При написании запросов в Redshift и Mongo учитываем фильтры; индексы в Mongo по полям, по которым часто ищем (username, reportDate, platform и т.д.).

### Уникальный индекс?

**Ответ:** Индекс с ограничением уникальности: в таблице/коллекции не может быть двух записей с одинаковым значением(ями) ключа. Используется для первичных ключей и бизнес-уникальности (email, slug). В Mongo: createIndex(..., { unique: true }).

**В проекте:** Уникальность обеспечиваем через \_id и бизнес-поля; при необходимости в Mongo можно создать unique index.

### Composite index? В каком порядке работают composite индексы?

**Ответ:** Индекс по нескольким полям. Порядок полей важен: индекс (A, B, C) может использоваться для запросов по A; по A и B; по A, B и C (слева направо), но не для запроса только по B или C. Сначала идут equality-условия, затем range, затем sort. Правило: наиболее селективные и часто используемые в WHERE — в начало.

**В проекте:** `nodejs/services/common/utils/mongo/ignite/userLog.js` — createIndex({ username: 1, userDate: 1 }), createIndex({ username: 1, lastAuth: -1 }). В report/pulse/geo — (platform, subProduct, reportDate). При создании индексов учитываем частые фильтры в отчётах.

### GROUP BY как работает? HAVING vs WHERE?

**Ответ:** GROUP BY группирует строки по одинаковым значениям указанных столбцов; агрегатные функции (SUM, COUNT, AVG) считаются по каждой группе. **WHERE** фильтрует строки **до** группировки. **HAVING** фильтрует **после** группировки по результатам агрегации (например HAVING COUNT(\*) > 1).

**В проекте:** В Redshift-отчётах и SQL-хендлерах: `nodejs/services/ignitereports/sites/ignite/handlers/reports/sql/` — агрегации по измерениям (campaign, device, demographic и т.д.). WHERE и HAVING используются по смыслу запроса.

### ORDER BY оптимизация?

**Ответ:** Если ORDER BY по полям индекса в том же порядке, БД может отдать данные уже отсортированными (index scan). Иначе выполняется отдельная сортировка (filesort), что дорого на больших объёмах. Ограничение LIMIT после сортировки уменьшает объём данных для сортировки только если оптимизатор это учитывает.

**В проекте:** Сортировка в API (Mongo/Elastic) через sort в запросах; в Redshift — ORDER BY в SQL; при необходимости индексы под частые сортировки.

### JOIN типы? LEFT JOIN vs INNER JOIN?

**Ответ:** **INNER JOIN** — только строки, где есть совпадение в обеих таблицах. **LEFT JOIN** — все строки левой таблицы; справа подставляется NULL при отсутствии совпадения. RIGHT JOIN и FULL OUTER — аналогично с другой стороны. Выбор зависит от того, нужны ли «несовпадающие» строки одной из сторон.

**В проекте:** В Redshift-отчётах JOIN между таблицами (campaign, device, demographic, geo и т.д.). LEFT vs INNER выбираем по смыслу: нужны ли строки без соответствия в правой таблице.

### Что такое N+1 проблема?

**Ответ:** Один запрос получает список сущностей (например заказов), затем в цикле для каждой — отдельный запрос за связанными данными (клиент, товары). Итого 1 + N запросов. Решение: batch load (один запрос по списку id), JOIN/подзапрос, или агрегация (aggregate/lookup в Mongo), чтобы получить связанные данные за один или несколько запросов.

**В проекте:** Избегаем N+1: пагинация и агрегации в Mongo; загрузка связанных данных батчами или через aggregate/lookup. В хендлерах (например getPagedAdvertiserGroups) сначала пользователь, затем один/несколько запросов по данным с пагинацией.

## Transactions

### Что такое ACID? Isolation levels? Dirty read?
**Ответ:** **ACID** — Atomicity (всё или ничего), Consistency (ограничения целостности), Isolation (параллельные транзакции не мешают друг другу «неправильно»), Durability (после commit данные сохранены). **Уровни изоляции** (read uncommitted, read committed, repeatable read, serializable) задают, видит ли транзакция незакоммиченные или повторно прочитанные изменения других. **Dirty read** — чтение незакоммиченных данных другой транзакции (допускается только при read uncommitted).

**В проекте:** Явных транзакций в коде нет. MongoDB 4+ и Redshift поддерживают транзакции; мы делаем короткие операции (find, findOneAndUpdate, COPY в Redshift) без обёртки в транзакцию.

### Как работают транзакции в ORM? Когда транзакции вредны?

**Ответ:** В ORM обычно: begin/startTransaction → запросы → commit или при ошибке rollback; либо withTransaction(callback). Когда вредны: долгие транзакции держат блокировки; большие объёмы изменений в одной транзакции увеличивают риск конфликтов и откатов. Лучше короткие идемпотентные операции и компенсирующие действия при сбоях.

**В проекте:** ORM не используем (Mongo и Redshift напрямую). Тяжёлые пайплайны вынесены в batch/queue; в API — короткие запросы.

## Performance

### Как анализировать slow query? Что такое EXPLAIN?

**Ответ:** Логировать время выполнения запросов; включить slow query log в БД; использовать EXPLAIN (и EXPLAIN ANALYZE где есть) — выводится план выполнения: какие индексы используются, тип доступа (index scan vs full scan), оценка строк, сортировки. По плану видно узкие места.

**В проекте:** В middleware логируем время запроса (request.startTime, endTime в siteApp). Для отладки можно вызывать explain в Mongo/Redshift по конкретному запросу.

---

# 5. NoSQL (Mongo)

### SQL vs NoSQL?

**Ответ:** SQL (реляционные БД) — фиксированная схема таблиц, строгие связи (foreign key), ACID-транзакции, запросы на SQL, масштабирование в основном вертикальное. NoSQL — разнородное семейство: документные (Mongo), ключ-значение, колоночные, графовые; гибкая или отсутствующая схема, горизонтальное масштабирование, часто eventual consistency. Выбор зависит от модели данных, требований к связям и консистентности.

**В проекте:** Используем и то и другое: **MongoDB** — основной store (пользователи, токены, рекламные сущности, данные платформ); **Redshift** — аналитика и тяжёлые отчёты (SQL). Конфиги: config-ignitecrm-mongo.js, config-ignitereport-mongo.js; модули в common/utils/mongo/ignite/.

### Когда выбрать Mongo?

**Ответ:** Когда нужна гибкая схема, документная модель (вложенные объекты, массивы), быстрые итерации без миграций схемы; горизонтальное масштабирование (шардирование, реплики); не нужны сложные JOIN между сущностями или их можно заменить вложенными документами/несколькими запросами.

**В проекте:** CRM, токены, данные по платформам (Xandr, Google Ads, DV360 и т.д.) — документы в коллекциях. Файлы: `nodejs/services/common/utils/mongo/ignite/crm/user.js`, `ignite/auth/usertoken.js`, по платформам в ignite/.

### Что такое eventual consistency?

**Ответ:** В распределённых системах реплики могут кратко расходиться: запись попала на одну реплику, а чтение ушло с другой, где обновления ещё нет. В итоге при отсутствии новых записей все реплики сходятся к одному состоянию (eventual). Противопоставляется strong consistency (всегда читаем последнее записанное).

**В проекте:** При использовании реплик Mongo (mongoIgniteCrmSecondary, mongoIgniteReportSecondary) читаем с readPreference secondaryPreferred — возможна небольшая задержка; для критичных к консистентности операций используем primary.

### Index в Mongo?

**Ответ:** Индексы в MongoDB ускоряют find, sort, aggregate по полям. По умолчанию есть индекс по \_id. Создание: createIndex({ field: 1 }) или ({ a: 1, b: -1 }) для составного. Опции: unique, TTL (expireAfterSeconds), partialFilterExpression. B-tree по умолчанию; есть также text, geospatial.

**В проекте:** createIndex в комментариях и при необходимости в коде: `nodejs/services/common/utils/mongo/ignite/userLog.js` — (username, userDate), (username, lastAuth); `nodejs/services/common/utils/mongo/ignite/queue/campaignRemapStatus.js` — TTL индекс по endDate. Методы indexes/createIndex в mongodb50.js.

---

# 6. Архитектура Backend

### Monolith vs Microservices?

**Ответ:** Монолит — одно приложение, одна кодовая база, один деплой; проще разработка и отладка, но масштабирование и независимые релизы затруднены. Микросервисы — отдельные сервисы по доменам, свои репозитории и деплой; можно масштабировать и менять части независимо, но появляются сложности с согласованностью, сетевыми вызовами и операционкой.

**В проекте:** Микросервисы: **auth** (3207), **igniteorders** (3210), **ignitereports** (3211), **ignitequeue**, **igniteswagger** (3209), **proxy** (3200). Общий код в **common/**, конфиги в **config/**; в Docker они монтируются в каждый сервис. См. `docs/common-microservices-redis-explained.md`, docker-compose.yaml.

### Layered architecture?

**Ответ:** Разделение на слои: представление/API (роуты, контроллеры) → бизнес-логика (сервисы) → слой доступа к данным (репозитории, клиенты БД). Зависимости направлены внутрь (к ядру), не наоборот. Упрощает тестирование и замену слоёв.

**В проекте:** Роуты → routeHandler → handler (бизнес-логика) → модули mongo/redis/elastic. Handlers в `sites/*/handlers/`, доступ к данным в `common/utils/mongo/`, `common/utils/redis/`. extractDbsFromRequest отдаёт dbs в options.

### Clean architecture? Dependency Injection? SOLID?

**Ответ:** Clean architecture — ядро (entities, use cases) не зависит от фреймворков и БД; зависимости инжектятся извне. **DI** — зависимости передаются в конструктор или параметры, а не создаются внутри. **SOLID** — Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion. В бэкенде: один модуль/класс — одна зона ответственности; расширение через новые реализации, а не правки ядра; зависимости от абстракций.

**В проекте:** Зависимости (dbs, params) передаём через **options** в хендлеры; БД из request.app.locals. Явного DI-контейнера нет. Один хендлер — одна задача; общие утилиты переиспользуются. См. routeHandler.js, getDbs, handlers.

### Что такое Repository pattern? Service layer зачем? DTO зачем?

**Ответ:** **Repository** — абстракция доступа к данным: методы findById, save, delete вместо прямых SQL/запросов к коллекции. **Service layer** — слой бизнес-логики между API и данными: оркестрация репозиториев, валидация, транзакции. **DTO** (Data Transfer Object) — объекты для передачи данных между слоями; фиксированная форма, часто с валидацией; отделяет контракт API от внутренней модели.

**В проекте:** Модули в **common/utils/mongo/ignite/** по сути репозитории: user.js, usertoken.js, advertiserGroup и т.д. — find\*, findOneAndUpdate, aggregate. **Service layer** — хендлеры: вызывают несколько репозиториев, elastic, внешние API. **DTO** — Joi-схемы задают форму входа; ответы — объекты из handler; отдельных DTO-классов нет. См. getPagedAdvertiserGroups.js, routesAdvertiserGroups.js.

---

# 7. Security

### JWT как работает? Access vs Refresh token? Как хранить токены?

**Ответ:** **JWT** — подписанный токен (header.payload.signature); сервер проверяет подпись и при необходимости срок (exp). **Access token** — короткоживущий, передаётся с каждым запросом (заголовок Authorization). **Refresh token** — длинноживущий, хранится безопасно (httpOnly cookie или хранилище на клиенте), используется только для получения новой пары токенов. Access не хранить в localStorage при риске XSS; refresh — в защищённом хранилище или на сервере.

**В проекте:** Полный разбор в `docs/jwt-auth-detailed.md`. Access в **Redis** с TTL; refresh в **MongoDB** (user_tokens). Генерация: generateToken.js; проверка: verifyToken.js, checkRedisToken.js; продление: generateAllTokens.js. Клиенту отдаём access в заголовке jwt.

**Хранение паролей:** хэшируем через **bcrypt** (никогда не храним в открытом виде). Пример из `nodejs/services/auth/handlers/login.js` — проверка пароля при логине:

```js
const isMatch = await bcrypt.compare(password, userInfoLocal?.password || "");
if (isMatch) {
  return { user: userInfoLocal, remoteLogin: false };
}
```

При смене пароля (`nodejs/services/auth/handlers/resetPassword.js`): `const bcryptedPassword = await bcrypt.hash(password, 12);` — соль и раунды задаются внутри bcrypt.

### CORS что такое? CSRF? XSS?

**Ответ:** **CORS** — механизм браузера: сервер заголовками (Access-Control-Allow-Origin и др.) разрешает запросы с других origin. **CSRF** — запрос с чужого сайта от имени пользователя (например по cookie); защита: токены в форме, SameSite cookie, проверка Origin/Referer. **XSS** — внедрение скрипта в страницу; защита: экранирование вывода, Content-Security-Policy, не хранить чувствительное в localStorage.

**В проекте:** CORS включён: `nodejs/services/igniteorders/sites/orders/siteApp.js` — require('cors'), siteApp.use(cors()). JWT в заголовке (не cookie) снижает классический CSRF. Бэкенд отдаёт JSON; экранирование на фронте; пароли не рендерим в HTML.

### Hashing паролей? bcrypt vs plain hashing?

**Ответ:** Пароли хранить только в виде **хеша** с **солью**. **bcrypt** (или argon2) — адаптивная функция: можно увеличивать сложность (rounds), соль встроена; устойчив к перебору. **Plain hashing** (MD5, SHA без соли) — неприемлемо: предсказуемо и уязвимо к радужным таблицам.

**В проекте:** **bcryptjs**: при логине по паролю из MongoDB — `bcrypt.compare(password, user.password)` в `nodejs/services/auth/handlers/login.js`; при смене пароля — `bcrypt.hash(password, 12)` в `nodejs/services/igniteorders/sites/orders/handlers/users/updateUser.js`.

---

# 8. Performance & Scaling

### Horizontal vs Vertical scaling? Stateless service? Load balancer?

**Ответ:** **Vertical** — больше CPU/RAM у одной машины; ограничено железом. **Horizontal** — больше инстансов за балансировщиком; лучше для отказоустойчивости и пиков. **Stateless** — сервер не хранит сессию между запросами; масштабирование и балансировка проще; сессию выносят в Redis/БД. **Load balancer** — распределяет запросы по инстансам (round-robin, least connections и т.д.).

**В проекте:** Горизонтальное масштабирование: несколько подов в Kubernetes (release1, release2, prod). Сервисы stateless — сессия в JWT + Redis. Балансировка — Kubernetes Service, Ingress. Манифесты в kube/\*.

### Cache где использовать? Redis зачем? Что такое CDN?

**Ответ:** Кэш — для часто читаемых и редко меняющихся данных; тяжёлых вычислений; снижения нагрузки на БД. **Redis** — in-memory store: кэш, сессии, rate limit, очереди, pub/sub; очень быстрый доступ. **CDN** — доставка статики/медиа с края сети; разгружает origin, уменьшает задержку для пользователей.

**В проекте:** **Redis**: JWT access token (TTL), long cache для отчётов (redisLongCache, mongoLongCache в common/utils/redis/). Конфиг: config-redis.js; подключение в siteApp, ключи с namespace. CDN в коде не настраиваем; статика фронта может отдаваться через CDN.

### Как работает clustering в Node? Что такое PM2?

**Ответ:** Модуль **cluster** в Node — один мастер-процесс и несколько воркеров (по числу ядер); мастер раздаёт входящие соединения воркерам. Так один экземпляр приложения использует несколько ядер. **PM2** — process manager: запуск и перезапуск приложений, логи, мониторинг, кластер-режим (несколько инстансов под PM2).

**В проекте:** cluster не используем; масштабирование — несколько подов в Kubernetes. В проде управление через kube, не PM2; локально можно запускать node start.js без PM2.

---

# 9. Cloud & DevOps

### Что такое CI/CD?

**Ответ:** **CI (Continuous Integration)** — при каждом коммите/пуше собирается проект, прогоняются тесты, проверяется код (линтеры, ревью). **CD (Continuous Delivery/Deployment)** — автоматическая доставка артефактов в среду (сборка образа, деплой в kube). Цель — быстрая обратная связь и предсказуемый деплой.

**В проекте:** **GitLab CI** — `.gitlab-ci.yml`. Стадии пайплайна:

```yaml
stages:
  - setup-git-gate
  - gate
  - notify-start
  - setup-git
  - setup-kube
  - prebuild-kube
  - deploy-source
  - deploy
  - notify-end
```

Подключаются: `deploy/gate/mr-approval.yaml` (обязательные апрувы для MR), `deploy/gate/mr-review.yaml` (AI diff review + проверка зависимостей common); `deploy/kube/query-current-service.yaml`, `build-source-nodejs.yaml`, `deploy-kube-nodejs.yaml` (сборка и деплой в Kubernetes). Уведомления — deploy/notify/notifyStart.yaml, notifyEnd.yaml.

### Docker зачем? Что такое контейнер? Что такое image?

**Ответ:** **Docker** — платформа для контейнеризации: единая среда «везде», изоляция зависимостей, удобный деплой. **Контейнер** — изолированный процесс с собственным файловым пространством и сетью; ядро ОС общее. **Image** — неизменяемый слой: ОС, runtime, приложение; из образа создаются контейнеры.

**В проекте:** Dockerfile в docker/dev/; docker-compose в docker/dockercompose/ — сервисы (auth, orders, reports, batch, queue, swagger, proxy), volumes для кода (common, config монтируются в каждый сервис), env. Образы хранятся в ECR (513822311637.dkr.ecr...).

### Как задеплоить Node app? AWS базовые сервисы?

**Ответ:** Деплой: собрать артефакты (npm run build при необходимости), собрать Docker-образ, запушить в registry, в Kubernetes обновить манифесты (образ пода) и применить — новые поды поднимаются, старые снимаются (rolling update). **AWS**: EC2 (виртуалки), S3 (хранилище), RDS (БД), Lambda (функции), ECR (образы), EKS (Kubernetes) и др.

**В проекте:** Деплой: deploy/kube/build-source-nodejs.yaml (сборка фронта, подготовка артефактов), deploy-kube-nodejs.yaml (деплой в kube). Используем **S3** (файлы, CSV для Redshift), **Redshift** (аналитика), **ECR** (образы), **OpenSearch** (поиск); конфиги и common/utils (s3, redshift, opensearch) ссылаются на них.

### Что такое health check? Zero downtime deployment?

**Ответ:** **Health check** — эндпоинт или команда, по которой оркестратор (Kubernetes) проверяет, жив ли сервис (liveness) и готов ли принимать трафик (readiness). При падении проверки под перезапускается или исключается из балансировки. **Zero downtime** — деплой без прерывания обслуживания: новые инстансы поднимаются, на них переключается трафик, старые корректно завершаются (rolling update, blue-green и т.д.).

**В проекте:** Health: `nodejs/services/igniteorders/sites/orders/siteApp.js` — siteApp.get("/health", ...) возвращает 200; в части сервисов дополнительно проверяется Redis (setex test). В kube эти эндпоинты можно использовать для liveness/readiness. Zero downtime — rolling update в Kubernetes при деплое.

---

# 10. Testing

### Unit vs Integration?

**Ответ:** **Unit-тесты** — проверяют один модуль/функцию в изоляции; внешние зависимости (БД, HTTP, файлы) подменяются моками; быстрые, много мелких тестов. **Integration-тесты** — проверяют взаимодействие частей (приложение + реальная БД или тестовый API); медленнее, но дают уверенность в связках.

**В проекте:** Unit-тесты на **Mocha + Chai**. Пример из `nodejs/services/batch/test/locality/utils.test.js` — тестируется утилита `getWoNumber` из common/utils/locality/utils:

```js
const expect = require("chai").expect;
const { getWoNumber } = require(`${rootpath}/common/utils/locality/utils`);

describe("getWoNumber", () => {
  it("returns woNumber directly for a numeric string", () => {
    const result = getWoNumber({}, "12345", "12345_SomeAdvertiser_Tactic");
    expect(result).to.equal("12345");
  });
  it("uses clientIo when woNumber is null", () => {
    const result = getWoNumber({ clientIo: "6154887" }, null, "campaign");
    expect(result).to.equal("6154887");
  });
  // ... другие кейсы: пустая строка, невалидные символы и т.д.
});
```

Запуск: `node_modules/.bin/mocha test/locality/utils.test.js`. Другие unit-тесты: `batch/test/addProductTacticFields/googleAds.test.js`, `callrail.test.js`, `campaignRemapping/replaceAdvertiserNameInCampaignName.test.js`. **Интеграционные:** `nodejs/services/batch/tests/verifyXandrDateFields.js` — Mocha, реальное подключение к Mongo, проверка полей дат в документах Xandr.

### Что мокать? Что не мокать?

**Ответ:** **Мокать:** внешние зависимости — БД (клиент, результаты запросов), HTTP-клиент (ответы API), файловая система, время (для детерминированных тестов). **Не мокать:** тестируемый модуль, чистые утилиты без I/O, простые хелперы. Цель — изолировать тестируемую логику и сделать тесты быстрыми и стабильными.

**В проекте:** В verifyXandrDateFields подключаем реальную Mongo (интеграция). Для unit-тестов хендлеров логично мокать getDbs и возвращаемые данные из mongo/redis.

### Как тестировать async код?

**Ответ:** В тестах async-функцию можно вызывать через **await** внутри it(): `it('...', async () => { const r = await handler(options); expect(r).toEqual(...); })`. Либо возвращать промис из it(): `return handler(options).then(r => expect(r)...)`. Не забывать обрабатывать reject (try/catch или .catch), иначе тест может «зеленеть» при падении.

**В проекте:** В verifyXandrDateFields тесты объявлены async: `it("...", async () => { await ... })`. Ошибки обрабатываются через Mocha (необработанный reject провалит тест).

### Supertest зачем?

**Ответ:** **Supertest** — библиотека для тестирования HTTP-серверов в Node: передаётся Express app, вызываются request.get/post(...), проверяются status, body, headers. Сервер не поднимается на порт (или поднимается на временный) — тесты быстрые и подходят для проверки роутов и middleware.

**В проекте:** Supertest не подключён. Можно предложить добавить для тестов API (например POST /advertiser-groups с моками dbs и authenticate).

---

# 11. Алгоритмы (обязательно спросят)

### Перевернуть linked list

**Идея:** Итеративно: три указателя — prev, curr, next. На каждом шаге curr.next = prev, сдвиг prev = curr, curr = next. В конце вернуть prev (новая голова). Рекурсия: развернуть хвост, затем текущий узел привязать к предыдущему.

```js
function reverseList(head) {
  let prev = null,
    curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
```

**В проекте:** Не используется.

---

### DFS / BFS

**Ответ:** **DFS** (глубина) — стек или рекурсия; обход «вглубь». **BFS** (ширина) — очередь; обход по уровням. Применение: обход графов/деревьев, поиск путей, проверка связности.

**В проекте:** Явных обходов графов нет; при необходимости — обход деревьев (например конфиги).

---

### Найти дубликаты

**Ответ:** Зависит от формата. В массиве: Set для O(n); или сортировка + сравнение соседей. В потоке данных — хеш-таблица с счётчиками. В БД — GROUP BY ... HAVING COUNT(\*) > 1 или уникальный индекс с обработкой конфликтов.

**В проекте:** В данных — дедупликация и агрегации в Mongo; уникальность по полям и \_id.

---

### Реализовать debounce

**Ответ:** Вызов функции не чаще одного раза за заданный интервал после последнего триггера; таймер сбрасывается при каждом новом вызове.

```js
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

**В проекте:** На бэке редко; на фронте — для поиска/полей ввода.

---

### Реализовать throttle

**Ответ:** Вызов функции не чаще одного раза за интервал (первый вызов сразу или по таймеру, остальные игнорируются до истечения окна).

```js
function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
```

**В проекте:** Ограничение частоты при вызовах внешних API (429 и повтор) — по смыслу обратный throttle со стороны API; см. downloadFile.js, basis/utils.js.

---

### Реализовать LRU cache

**Ответ:** Cache с ограничением по размеру; при переполнении вытесняется наименее недавно использованный элемент. Реализация: Map (сохраняет порядок вставки в современных JS) или связный список + хеш-таблица. При get — переместить в «свежий» конец; при set — добавить/обновить, при переполнении удалить самый старый.

**В проекте:** Свой LRU не реализован; кэш с TTL в Redis (JWT, long cache). На собесе можно написать простой LRU на Map с ограничением размера и удалением первого элемента при переполнении.

---

### Реализовать Promise.all

См. раздел «Реализовать Promise.all» в блоке Promises выше — там псевдокод и идея. В проекте используем нативный Promise.all.

---

# 12. Поведенческие вопросы

- **Как дебажите продакшен?** Логи (middleware, routeError, unhandledRejection), логи подов в kube, повтор запроса с теми же параметрами, при необходимости профилирование.
- **Как решали performance проблему?** Вынос тяжёлых операций в очередь (ignitequeue), стримы для больших данных, обработка 429 при вызовах API, пагинация и индексы.
- **Как работали с legacy?** Общий код в common/config; при изменениях — проверка зависимостей сервисов (mr-review); постепенная валидация (Joi) в новых хендлерах.
- **Как принимали архитектурное решение?** Микросервисы по доменам, единая точка входа запроса (routeHandler + options), Mongo для документов, Redshift для аналитики.
- **Как работали в Scrum?** Отвечать по своему опыту; можно упомянуть code review (mr-approval), gate в CI, общие стандарты.

---

# 13. Middle-level expectation

- **Trade-offs:** Объяснять, почему JWT в Redis (скорость, TTL) и refresh в MongoDB; почему POST для сложных запросов с телом; почему batch и queue отдельно от HTTP.
- **«Почему»:** Порядок middleware, отдельный сервис Swagger, несколько баз Mongo (crm, report, secondary).
- **Performance:** Где узкие места (N+1, большие выборки без пагинации, блокировка event loop); что делаем: пагинация, стримы, очередь, обработка 429.
- **Архитектура:** Схема: клиент → proxy → сервисы → common/config; БД (Mongo, Redis, Redshift, Elastic); batch и queue для тяжёлых задач.
- **Базы глубже CRUD:** Индексы в Mongo (userLog, campaignRemapStatus), составные индексы; Redshift для аналитики и ETL; когда транзакции не нужны или вредны.

---

_Полные разборы по темам: JWT — `docs/jwt-auth-detailed.md`; MongoDB и Express — `docs/mongodb-express-detailed.md`; common, микросервисы, Redis — `docs/common-microservices-redis-explained.md`; AWS и Swagger — `docs/aws-swagger-detailed.md`; краткая шпаргалка с путями — `docs/interview-prep-answers-and-project.md`._
