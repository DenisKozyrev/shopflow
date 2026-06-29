# AWS и Swagger в проекте — подробный разбор

Два блока: **AWS** (какие сервисы используем и как) и **Swagger/OpenAPI** (документация API в проекте).

---

# Часть 1. AWS

## 1. Что такое AWS

**Amazon Web Services (AWS)** — облачная платформа: вычислительные мощности, хранилища, БД, аналитика, CI/CD и т.д. В нашем проекте используются в основном:

- **S3** — объектное хранилище (файлы, бэкапы, креативы, CSV для загрузки в Redshift).
- **Redshift** — хранилище данных (Data Warehouse); запросы выполняются через **Redshift Data API** (без постоянного JDBC/ODBC-соединения).
- **ECR (Elastic Container Registry)** — реестр Docker-образов; образы сервисов пушатся в ECR и оттуда подтягиваются в Kubernetes.
- **OpenSearch** (через AWS SDK) — поиск и аналитика (в batch и отчётах).

Учётные данные и параметры (ключи, регион, имена бакетов/кластеров) задаются через **переменные окружения** и выносятся в конфиги в `nodejs/services/config/`.

---

## 2. S3 (Simple Storage Service)

### Назначение

- Хранение **креативов** (изображения, видео) — загрузка из приложения, отдача по ссылкам.
- **Бэкапы** отчётов и сырых данных (например Madhive, Key Accounts, pacing).
- **Промежуточные файлы** для Redshift: CSV выгружаются в S3, затем загружаются в таблицы через `COPY` (в т.ч. через IAM role).
- Скачивание файлов по запросу (отчёты, экспорт).

### Конфигурация

**Файлы:** `nodejs/services/config/config-s3-ignite-creative.js`, `config-s3-ignite-backup.js`.

**Креативы (creative):**

```js
// config-s3-ignite-creative.js
const config = {
  s3IgniteCreativeAccessKeyId: process.env.s3_ignite_creative_access_key_id,
  s3IgniteCreativeSecretAccessKey: process.env.s3_ignite_creative_secret_access_key,
  s3IgniteCreativeRegion: process.env.s3_ignite_creative_region,
  s3IgniteCreativeBucket: process.env.s3_ignite_creative_bucket,
  s3IgniteCreativeFilepathPrefix: process.env.s3_ignite_creative_filepath_prefix,
};
```

**Бэкапы:**

```js
// config-s3-ignite-backup.js
module.exports = {
  s3IgniteBackupAccessKeyId: process.env.s3_ignite_creative_access_key_id,
  s3IgniteBackupSecretAccessKey: process.env.s3_ignite_creative_secret_access_key,
  s3IgniteBackupRegion: process.env.s3_ignite_creative_region,
  s3IgniteBackupBucket: process.env.s3_ignite_backup_bucket
};
```

Используется **AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`).

### Общий клиент и операции

**Файл:** `nodejs/services/common/utils/s3/s3files.js`

Клиент создаётся один раз из конфига креативов (для этого модуля; в других местах клиент может создаваться локально из своего конфига):

```js
const configS3Ignite = require(`${rootpath}/config/config-s3-ignite-creative`);
const {
  S3Client,
  GetObjectCommand,
  ListObjectsCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const credentials = {
  region: configS3Ignite.s3IgniteCreativeRegion,
  credentials: {
    accessKeyId: configS3Ignite.s3IgniteCreativeAccessKeyId,
    secretAccessKey: configS3Ignite.s3IgniteCreativeSecretAccessKey,
  },
};
const client = new S3Client(credentials);
```

Основные операции:

| Метод | Назначение |
|-------|------------|
| **uploadStream** / **upload** | Загрузка файла (stream или body); для больших файлов — `Upload` из `@aws-sdk/lib-storage`, с повторными попытками при ошибках и проверкой размера. |
| **downloadFile** | Скачивание объекта: `GetObjectCommand` с `Bucket`, `Key`; возвращает `{ result, filepath }`. |
| **listObjectsInBucket** | Список объектов: `ListObjectsCommand` с опциональными `Prefix`, фильтром по дате изменения, `Delimiter`. |
| **deleteObject** | Удаление одного объекта по ключу. |
| **deleteObjectsByPrefix** | Список по префиксу и пакетное удаление через `DeleteObjectsCommand`. |
| **getFileMeta** | Метаданные объекта через `HeadObjectCommand` (в т.ч. `ContentLength`). |

Пример загрузки (используется в batch и при экспорте):

```js
const result = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: filepath }));
// result.Body — stream для чтения
```

Пример листинга (например, WideOrbit файлы в бакете):

```js
// nodejs/services/igniteorders/sites/orders/handlers/wideorbit/utils.js
const { listObjectsInBucket } = require(`${commonPath}/utils/s3/s3files`);
const s3Objects = await listObjectsInBucket(BUCKET_NAME, PREFIX);
```

Загрузка креативов в orders — отдельный клиент: `nodejs/services/igniteorders/sites/orders/services/s3CreativesClient.js` (создаёт `S3Client` из `config-s3-ignite-creative`, хранит `bucketName`). Бэкапы отчётов (Madhive, Key Accounts, Reach/Freq и т.д.) используют `config-s3-ignite-backup` и те же утилиты `s3files` (upload, list, download).

---

## 3. Redshift и Redshift Data API

### Назначение

**Amazon Redshift** — колоночное хранилище данных для аналитики. Мы не держим постоянное соединение из Node; запросы выполняются через **Redshift Data API**: отправка SQL и получение результатов асинхронно (по Id запроса), без драйвера JDBC/ODBC в приложении.

Используется для:

- Агрегированных отчётов (Pulse и др.), секций отчётов (geo, device, demographic и т.д.).
- Синхронизации данных из CRM (advertiser group, lineitem, task, creative и т.д.) в таблицы Redshift.
- Загрузки данных из S3 в Redshift (`COPY` с IAM role).

### Конфигурация

**Файл:** `nodejs/services/config/config-redshift.js`

```js
const config = {
  accessKeyId: process.env.redshift_access_key_id,
  secretAccessKey: process.env.redshift_secret_access_key,
  regionName: process.env.redshift_region_name,
  clusterId: process.env.redshift_cluster_id,
  clusterId2: process.env.redshift_cluster_id2,
  database: process.env.redshift_database,
  secretArn: process.env.redshift_secret_arn,
  secretArn2: process.env.redshift_secret_arn2,
  iamRole: process.env.redshift_iam_role,
};
```

`secretArn` — ARN секрета в AWS Secrets Manager для доступа к БД; при использовании Data API аутентификация может идти через IAM и этот секрет.

### Подключение и очередь запросов

**Подключение (клиент Data API):** `nodejs/services/common/utils/redshift/redshiftDataConnect.js`

```js
const { RedshiftDataClient, ExecuteStatementCommand, DescribeStatementCommand, GetStatementResultCommand } = require("@aws-sdk/client-redshift-data");

const redshiftDataConnect = (awsKey, awsSecret, region, clusterId, database, secretArn) => {
  let clientKey = `${region}-${clusterId}-${database}`;
  let newClient = new RedshiftDataClient({
    region,
    credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret },
  });
  let input = { Sql: null, ClusterIdentifier: clusterId, SecretArn: secretArn, Database: database };
  // возвращает { getClient, getInput, name } для последующих запросов
};
```

Клиенты кэшируются по `clientKey`, чтобы не создавать новый на каждый запрос.

**Очередь запросов:** `nodejs/services/common/utils/redshift/redshiftEnqueue.js`

Чтобы не превышать лимиты Redshift Data API, запросы ставятся в очередь (p-queue):

```js
const MAX_CONCURRENT_REDSHIFT_DATA_API_STATEMENTS = 50;
const queue = new PQueue({ concurrency: MAX_CONCURRENT_REDSHIFT_DATA_API_STATEMENTS });
const redshiftEnqueue = async (task) => queue.add(task);
```

Все вызовы `ExecuteStatementCommand` идут через `redshiftEnqueue`, чтобы ограничить параллелизм.

### Выполнение SQL

**Файл:** `nodejs/services/common/utils/redshift/redshiftDataQuery.js`

1. Формируется `ExecuteStatementCommand` с `Sql`, `Parameters` (если есть), `ClusterIdentifier`, `Database`, `SecretArn`.
2. Запрос отправляется в API, возвращается `Id`.
3. В цикле вызывается `DescribeStatementCommand(Id)` с паузами (polling), пока `Status` не станет `FINISHED` или `FAILED`.
4. При `FINISHED` и `HasResultSet` вызывается `GetStatementResultCommand(Id)`; результат обрабатывается в `redshiftDataResult.js` и возвращается вызывающему коду.

Параметры передаются в SQL через плейсхолдеры (например `:id`), чтобы избежать конкатенации пользовательского ввода. Для загрузки из S3 в SQL используется `COPY ... FROM 's3://...' IAM_ROLE '...'` (IAM role из конфига).

Использование в коде: `nodejs/services/batch/main/utils/dbConnections.js` — функции вида `getRedshiftPulse()`, `getRedshiftPulse2()` возвращают объект, полученный из `redshiftDataConnect` с подставленным конфигом. В ignitereports и batch затем вызываются `redshiftDataQuery(redshiftClient, sql, parameters, waitSeconds)`.

---

## 4. ECR (Elastic Container Registry)

**Назначение:** хранение Docker-образов. CI/CD (GitLab) собирает образы и пушит их в ECR; Kubernetes (EKS или другой кластер) подтягивает образы из ECR при деплое.

**В проекте:**

- Регистрация: `513822311637.dkr.ecr.us-west-2.amazonaws.com` (пример из скриптов).
- Логин: `docker login https://513822311637.dkr.ecr.us-west-2.amazonaws.com --username AWS --password-stdin` (токен из `aws ecr get-login-password`).
- Образы пушатся с тегами вида `ignite/dsp-nodejs:1.0.0.001.b-trafficpusher`.
- В Kubernetes создаётся secret для доступа к ECR: `kube/ecr/cron-aws-ecr.yaml` — создание `docker-registry` secret по аккаунту и региону.

Файлы: `docker/dev/dockerLogin.sh`, `deploy/kube/aws/deploy-kube-aws-nodejs.yaml`, `kube/ecr/cron-aws-ecr.yaml`.

---

## 5. OpenSearch (через AWS SDK)

В batch используется **@aws-sdk/client-opensearch** (и при необходимости credential providers). Конфигурация и вызовы — в `nodejs/services/batch/main/utils/dbConnections.js` и в модулях, которые работают с OpenSearch для поиска/аналитики. Отдельно в этом документе не разбирается; суть — доступ к OpenSearch как к сервису AWS из Node без своего HTTP-клиента к кластеру.

---

## 6. Сводка по AWS в проекте

| Сервис AWS | Конфиг | Основные файлы | Назначение |
|------------|--------|----------------|------------|
| **S3** | config-s3-ignite-creative, config-s3-ignite-backup | common/utils/s3/s3files.js, igniteorders/.../s3CreativesClient.js, batch/.../backup/*.js | Креативы, бэкапы, CSV для Redshift |
| **Redshift Data API** | config-redshift | common/utils/redshift/redshiftDataConnect.js, redshiftDataQuery.js, redshiftEnqueue.js, batch/main/utils/dbConnections.js | Выполнение SQL, синхронизация, отчёты |
| **ECR** | Переменные/скрипты деплоя | docker/dev/dockerLogin.sh, kube/ecr/*.yaml, deploy/kube/*.yaml | Реестр Docker-образов для K8s |
| **OpenSearch** | Через dbConnections / env | batch/main/utils/dbConnections.js | Поиск и аналитика в batch |

Все секреты (ключи, ARN секретов) задаются через **environment variables**, не хардкодятся в репозитории.

---

# Часть 2. Swagger / OpenAPI

## 1. Что такое Swagger и OpenAPI

**OpenAPI** (ранее Swagger Specification) — стандарт описания REST API: эндпоинты, методы, тела запросов/ответов, схемы, безопасность. Файлы описания — YAML или JSON.

**Swagger UI** — интерактивный веб-интерфейс: по OpenAPI-документу показывает список операций и позволяет вызывать API прямо из браузера (Try it out).

В проекте: описание API хранится в **YAML (OpenAPI 3.0.3)**; сервис **igniteswagger** отдаёт эти документы и подключает **Swagger UI** для их отображения и тестирования.

---

## 2. Сервис igniteswagger

**Порт:** 3209 (в docker-compose; снаружи доступ через proxy 3200).  
**Mount path:** `/lumina/swagger/apidocs`.

**Старт:** `nodejs/services/igniteswagger/start.js`

- Устанавливается `args.mountpath = "/lumina/swagger/apidocs"`.
- Подключается `dispatcher.boot(app)` — загрузка всех «сайтов» из `igniteswagger/sites` (orders, reports, auth).
- Каждый сайт — свой `siteApp.js`, который регистрирует роуты Swagger для своей области (Orders API, Reports API, Auth API).

**Прокси:** в `nodejs/proxy/start.js` запросы с путём `/lumina/swagger/apidocs` проксируются на `configRemote.igniteswagger` (хост:порт сервиса igniteswagger). Таким образом, с точки зрения клиента документация доступна по `http://localhost:3200/lumina/swagger/apidocs/...`.

---

## 3. Структура сайтов и роутов

**Диспетчер:** `nodejs/services/igniteswagger/dispatcher.js`

Обходит папку `sites/` и для каждой подпапки, где есть `siteApp.js`, вызывает этот модуль: `require(sitePath + "/siteApp.js")(mainApp, sitePath)`. Каждый siteApp регистрирует свои роуты на общем `mainApp` с тем же `mountpath`.

**Пример siteApp (Orders):** `nodejs/services/igniteswagger/sites/orders/siteApp.js`

Подключаются модули роутов по платформам:

- `igniteRoutesSwagger` — Ignite Orders (advertiser, order, lineitem, creative, task, comment и т.д.).
- `xandrRoutesSwagger`, `googleadsRoutesSwagger`, `googleadmanagerRoutesSwagger`, `madhiveRoutesSwagger`, `metaRoutesSwagger` — соответствующие Orders/Reports API.

Каждый такой модуль вызывает `mainApp.use(mainApp.args.mountpath, siteApp)`, т.е. все роуты висят под `/lumina/swagger/apidocs`.

---

## 4. Как отдаётся Swagger UI по одному документу

**Файл:** `nodejs/services/igniteswagger/sites/orders/ignite/routes/routesSwagger.js`

Для каждого YAML-файла из папки `sites/orders/ignite/dist/` (например `comment.yaml`, `advertiser.yaml`):

1. Загружается корневой YAML: `yamljs.load(path)`.
2. Разрешаются `$ref` между файлами (multi-file spec): `resolveRefs(root, options)` с папкой `sites/orders/ignite/yaml/` и парсером YAML. Получается один объединённый документ в памяти.
3. Роут регистрируется так:
   - Путь: `${igniteMountPath}/${filename}` — например `/orders/ignite/comment`, `/orders/ignite/advertiser`.
   - Middleware: `basicAuthSwagger` (защита Basic Auth), затем `swagger-ui-express`: `serveFiles(yamlFiles, {})`, `setup(yamlFiles)`.
4. Итоговый URL документа в браузере:  
   `http://<host>:3200/lumina/swagger/apidocs/orders/ignite/comment` и т.д.

**Basic Auth для доступа к документации:** `nodejs/services/igniteswagger/sites/orders/ignite/routes/lib/basicAuthSwagger.js` — проверка Basic Auth (логин/пароль `ignitetest` / `ignitetest`); при неверных данных — 401 и заголовок `WWW-Authenticate: Basic realm="crm"`.

---

## 5. Содержимое YAML (OpenAPI 3.0.3)

**Пример:** `nodejs/services/igniteswagger/sites/reports/ignite/dist/pullReports.yaml`

- `openapi: 3.0.3`
- `info.title`, `info.version`, `info.description` — в description вставлены ссылки на другие разделы документации (Auth, Orders, Reports по платформам).
- `security: [ { bearerAuth: [] } ]` — ожидается JWT (bearer).
- `paths` — эндпоинты, например:
  - `POST /lumina/reports/api/ignite/reports/pull/start` — тело `#/components/schemas/pullReportsStart.post`, ответы 200/400.
  - `POST /lumina/reports/api/ignite/reports/campaigns` — и т.д.
- `components.schemas` — схемы запросов и ответов (для документации и валидации в UI).

Аналогично устроены документы в `sites/orders/ignite/dist/*.yaml` (advertiser, order, lineitem, creative, comment и т.д.) и в других сайтах (reports, auth). Ссылки в описании ведут на соседние разделы, чтобы можно было переходить между Auth API, Orders API и Reports API вручную.

---

## 6. Список разделов документации (по YAML и роутам)

Из описаний в YAML видно такие группы (все под базой `/lumina/swagger/apidocs`):

- **Auth API** — `auth/auth`.
- **Orders:** Ignite (sample, advertiser, advertiserGroup, order, lineitem, task, creative, comment, lookup, platform, campaignAssignment и т.д.), Xandr, Google Ads, Google Ad Manager, MadHive, Meta.
- **Reports:** Ignite (sample, pullReports), Xandr, Google Ads, Google Ad Manager, MadHive, LeadMe, ADS Direct, Meta — по платформам и типам (metrics, sample).

Фактический список эндпоинтов и имён файлов можно увидеть в папках `igniteswagger/sites/*/.../dist/*.yaml` и в роутах соответствующих `routesSwagger.js`.

---

## 7. Зависимости и сборка

- **swagger-ui-express** — подключение Swagger UI к Express и подстановка OpenAPI-документа.
- **yamljs** — парсинг YAML.
- **json-refs** — разрешение `$ref` в многофайловых спецификациях.

YAML в `dist/` могут собираться из исходников в `yaml/` (например, склейка нескольких файлов); в `routesSwagger.js` для Ignite Orders используется папка `yaml/` для `resolveRefs`, а точка входа — файлы из `dist/`.

---

## 8. Сводка по Swagger в проекте

| Элемент | Где | Назначение |
|--------|-----|------------|
| **Сервис** | igniteswagger (порт 3209) | Отдача Swagger UI и OpenAPI-документов |
| **Базовый путь** | /lumina/swagger/apidocs | Прокси с 3200 → igniteswagger |
| **Документы** | sites/*/.../dist/*.yaml, yaml/*.yaml | OpenAPI 3.0.3, разбиение по доменам (orders, reports, auth) |
| **Роуты** | sites/*/.../routes/routesSwagger.js | Регистрация UI по одному YAML на роут, multi-file через resolveRefs |
| **Защита** | basicAuthSwagger | Basic Auth (ignitetest/ignitetest) для доступа к документации |
| **Ссылки между разделами** | В description в YAML | Навигация между Auth, Orders, Reports по платформам |

Документация в основном **описательная и для ручного тестирования** (Try it out в Swagger UI); актуальность эндпоинтов и схем поддерживается вручную при изменении API в auth, igniteorders, ignitereports.

---

## Связанные документы

- **JWT и авторизация:** `docs/jwt-auth-detailed.md` — как защищаются реальные API, которые описаны в Swagger (bearerAuth).
- **Общая архитектура и прокси:** `CLAUDE.md`, `docs/common-microservices-redis-explained.md` — порты сервисов, proxy 3200, общий код common/config.
- **Backend-интервью:** `docs/backend-interview-full.md` — разделы про REST, middleware, деплой (в т.ч. ECR, K8s).
