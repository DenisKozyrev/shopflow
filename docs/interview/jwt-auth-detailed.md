# JWT и авторизация в проекте — подробный разбор

## 1. Что такое JWT

**JWT (JSON Web Token)** — стандартный способ передавать утверждения (claims) между сторонами в виде подписанного токена. Токен состоит из трёх частей в Base64, разделённых точкой:

- **Header** — алгоритм и тип (например `{"alg":"HS256","typ":"JWT"}`).
- **Payload** — данные (в нашем случае: username, firstName, lastName, isMsUser, expireAt, principal).
- **Signature** — подпись (HMAC с секретом или RSA), чтобы сервер мог проверить, что токен не подделан и не изменён.

Свойства в нашем проекте:

- Токен **подписывается** секретом на сервере; без секрета подделать валидный токен нельзя.
- В payload хранится **expireAt** (срок действия); проверка срока может быть и в Redis (см. ниже).
- Токен **не шифруется** — payload читаем в Base64; не кладём в него пароли и секреты.

---

## 2. Authentication и Authorization — различие

- **Authentication (аутентификация)** — «кто ты?»: проверка личности (логин/пароль, SSO, токен). В проекте это: логин (LDAP / локальный пароль / Microsoft SSO), выдача JWT, проверка JWT в middleware `authenticate`.
- **Authorization (авторизация)** — «что тебе можно?»: проверка прав на действие. В проекте: после аутентификации в хендлерах используется `request.tpjwt` / `getJwtUser(request)` (username, роли из БД); явной отдельной «авторизации по ролям» в одном месте нет — проверки прав делаются в конкретных хендлерах (роли, права на ресурс).

Ниже разобрана именно **аутентификация** (JWT + Redis + MongoDB) и как из неё получается контекст пользователя для авторизации.

---

## 3. Конфигурация JWT

**Файл:** `nodejs/services/config/config-jwt.js`

```js
module.exports = {
  secret: process.env.secretJwt || "starwars", // секрет для подписи/проверки JWT
  ttl: 60 * 60 * 24, // 24 ч — TTL access-токена в Redis (сек)
  refTokenExpInSec: 60 * 60 * 24 * 30, // 30 дней — срок жизни refresh в MongoDB
};
```

- **secret** — общий секрет для `jsonwebtoken.sign` и `verify`; один на все окружения в конфиге (в проде задаётся через env).
- **ttl** — время жизни записи в Redis для access-токена (не путать с полем `expireAt` в payload JWT).
- **refTokenExpInSec** — ориентир срока жизни refresh-токена (хранится в MongoDB).

---

## 4. Схема хранения токенов

| Что                               | Где хранится                                                 | Назначение                                                                                             |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Access token (JWT)**            | Клиент (заголовок `Authorization: JWT <token>`)              | Передаётся с каждым запросом.                                                                          |
| **Запись «токен валиден»**        | **Redis** (ключ `{namespace}~ignite~jwt~{accessToken}`, TTL) | Быстрая проверка «сессия жива»; данные пользователя для ответа.                                        |
| **Refresh token + данные сессии** | **MongoDB** (коллекция `user_tokens`, по `accessToken`)      | Продление сессии: по старому access ищем запись, по refresh получаем новые токены (LDAP или MS Graph). |

Итог: доступ к API даёт **access JWT**; он проверяется по Redis (и при истечении — по MongoDB + refresh). Refresh хранится только на сервере (MongoDB).

---

## 5. Жизненный цикл: от логина до запроса к API

### 5.1. Логин (первая выдача токенов)

**Роут:** `POST /lumina/auth/api/login` (прокси → auth сервис).  
**Файлы:** `nodejs/services/auth/routes/routesAuth.js` → `nodejs/services/auth/handlers/login.js`.

Шаги:

1. **Валидация входа**  
   Joi: `username`, `password` обязательны (`auth/handlers/login.js`, `inputSchema`).

2. **Определение способа входа** (в `remoteLogin`):
   - **SSO (Microsoft):** если в `options` есть `msUser` — проверяем пользователя в MongoDB по email/principal, домен (townsquare/ventionteams).
   - **Заголовок `luminatest`:** тестовый вход по значению env (без реального пароля).
   - **Логин/пароль:** для домена townsquare — LDAP (`authLogin` из `handlers/ldap/login.js`); иначе — проверка пароля из MongoDB через **bcrypt.compare** (`auth/handlers/login.js`).

3. **Сохранение/обновление пользователя** в MongoDB (`saveUser`), при необходимости синхронизация в Elastic.

4. **Генерация access JWT** (`common/utils/auth/generateToken.js`):
   - Вызов `jsonwebtoken.sign(payload, configJwt.secret)`.
   - В payload: `username`, `firstName`, `lastName`, `isMsUser`, `expireAt`, `principal`.
   - Возвращается строка токена (без префикса `JWT `).

5. **Сохранение в Redis** (в `login.js`, функция `save`):
   - Ключ: `{redisIgniteNamespace}~ignite~jwt~{accessToken}`.
   - Значение: JSON с `username`, `firstName`, `lastName`, `favoriteMarkets`, `accountName`, `isMsUser`, `msUser`, `msTokens`.
   - TTL: 12 часов (для MS пользователей — из `msTokens.msExpiresIn`, минус 5 минут).

6. **Сохранение в MongoDB** (коллекция `user_tokens`, в `login.js` — локальная функция `saveToken`):
   - По ключу `accessToken` сохраняются: `accessToken`, `refreshToken`, `ldapAccessToken`, плюс те же данные пользователя, `expireAt` и т.д.
   - Refresh token приходит из LDAP или из MS OAuth.

7. **Ответ клиенту**  
   В теле возвращаются данные пользователя и `accessToken: "JWT <token>"`. В `routeHandler.js` этот же токен дублируется в заголовке ответа **`jwt`**, чтобы клиент мог сохранить его и подставлять в последующие запросы.

---

### 5.2. Запрос к защищённому API (уже есть access token)

Роуты с middleware **`authenticate`** (например в `igniteorders`: `app.post("/advertiser-groups", authenticate, routes.getPagedAdvertiserGroups)`).

**Файл middleware:** `nodejs/services/common/utils/route/lib/authenticate.js`.

Последовательность:

1. **Извлечение токена из заголовка**  
   `Authorization: JWT <accessToken>`. Если заголовка нет или формат не `JWT <token>`, дальше accessToken пустой.

2. **Верификация подписи JWT** (`verifyToken(accessToken)`):
   - **Файл:** `nodejs/services/common/utils/auth/verifyToken.js`.
   - `jsonwebtoken.verify(token, configJwt.secret)` — проверка подписи и (если есть в payload) срока. Возвращает payload или null при ошибке.

3. **Загрузка пользователя из MongoDB**  
   По `tokens.username` вызывается `mongoIgniteCrmUser.findByUserName`. Нужно для проверки статуса и обновления lastActivityDate.

4. **Проверка статуса**  
   Если `user.status === SUSPEND` — возвращается ошибка `Your account have suspended status`, ответ 401.

5. **Обновление lastActivityDate** (при необходимости)  
   Если дата последней активности не «сегодня» — обновляем в MongoDB.

6. **Спецпользователь noreply@townsquaremedia.com**  
   Для него Redis не проверяется («bypass redis auth»), сразу возвращаем успех с данными из MongoDB.

7. **Проверка в Redis** (`checkRedisToken(options, accessToken, tokens)`):
   - **Файл:** `nodejs/services/common/utils/auth/checkRedisToken.js`.
   - Ключ: `{namespace}~ignite~jwt~{accessToken}`.
   - Если ключ есть и username из Redis совпадает с username из JWT — считаем сессию валидной, возвращаем данные из Redis (username, firstName, lastName, favoriteMarkets, isMsUser, msUser, msTokens, accountName). Ответ клиенту не меняет токен.

8. **Если в Redis записи нет** (токен истёк или вышел из системы):
   - Вызывается **`generateAllTokens(options, accessToken, tokens, url)`** — попытка продления сессии по refresh.
   - Если продление удалось — в ответе возвращается новый access token (и в `routeHandler` он уйдёт в заголовок `jwt`).

9. **Результат middleware**  
   При успехе в `request.tpjwt` кладётся объект с `accessToken` (строка `JWT ...`), `username`, `firstName`, `lastName` и т.д. Дальше в хендлере пользователь доступен через **`getJwtUser(request)`** (`nodejs/services/common/utils/route/lib/getJwtUser.js`) — это и есть контекст для авторизации (кто и с какими полями).

10. **Если токена не было или верификация не прошла**  
    Ответ 401, `{ unauthorized: true }`, вызов хендлера не выполняется.

---

## 6. Продление сессии (refresh): generateAllTokens

**Файл:** `nodejs/services/common/utils/auth/generateAllTokens.js`.

Вызывается из `authenticate.js`, когда access token уже не найден в Redis, но подпись JWT ещё валидна (т.е. токен «просрочен по Redis», но не обязательно по времени).

Последовательность:

1. **Поиск записи в MongoDB** по текущему `accessToken` (коллекция `user_tokens`). Если записи нет — продлить нельзя, возвращается null.

2. **Проверка username**  
   username из MongoDB должен совпадать с username из payload JWT.

3. **Опция jwtNoRenew**  
   Если в options передано «не продлевать» — возвращаем тот же access token без обновления.

4. **Блокировка «двойного продления»** (конкурентные запросы):
   - Текущую запись в MongoDB обновляют: `accessToken` заменяется на `lock-{accessToken}`, короткий `expireAt` (30 сек).
   - Другие запросы с тем же старым accessToken увидят запись с `lock-...` и будут ждать появления поля `newAccessToken` (см. ниже).

5. **Запрос новых токенов** (`requestNewToken`):
   - **MS пользователь:** обновление через Microsoft Graph (`axiosGraph.getProfileRenew`), получение новых msUser/msTokens.
   - **Пользователь townsquare:** вызов LDAP refresh (`authRefresh(refreshToken, "ignite")`), получение нового access/refresh от LDAP.
   - **Остальные:** проверка статуса пользователя в MongoDB (active); при успехе — переиспользование старых refresh/ldap токенов.

6. **Генерация нового access JWT**  
   `generateToken(username, firstName, lastName, expireAt, principal, isMsUser)` — новый токен на 5 дней (для MS — до 30 дней).

7. **Сохранение в MongoDB**  
   `saveToken(options, newAccessToken, tokenData)` — запись/обновление в `user_tokens` по ключу `newAccessToken`. Для старого accessToken в той же записи сохраняют `newAccessToken`, чтобы конкурирующие запросы могли взять новый токен.

8. **Сохранение в Redis**  
   `redisIgniteClient.setex(..., expiresIn, JSON.stringify(newTokenData))` — тот же формат ключа, TTL 12 часов (для MS — из msExpiresIn).

9. **Очистка блокировки**  
   Удаление записи с `lockAccessToken` из MongoDB (`mongoIgniteToken.deleteByAccessToken`).

10. **Возврат**  
    Новый access token и данные пользователя возвращаются в `authenticate`, затем в `request.tpjwt` и при необходимости в заголовок `jwt` ответа.

---

## 7. Ключевые методы и файлы (краткий справочник)

| Метод/файл                             | Назначение                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **config-jwt.js**                      | Секрет, TTL в Redis, срок жизни refresh.                                                                                    |
| **generateToken.js**                   | Подпись JWT (payload: username, firstName, lastName, isMsUser, expireAt, principal).                                        |
| **verifyToken.js**                     | Проверка подписи JWT, возврат payload или null.                                                                             |
| **checkRedisToken.js**                 | Чтение из Redis по ключу `{namespace}~ignite~jwt~{accessToken}`, сравнение username.                                        |
| **generateAllTokens.js**               | Продление сессии: MongoDB → requestNewToken (LDAP/MS) → новый JWT → saveToken (Mongo) + setex (Redis).                      |
| **saveToken.js** (common)              | Обновление документа в `user_tokens` по accessToken (findOneAndUpdate с $set).                                              |
| **authenticate.js**                    | Middleware: извлечь JWT → verifyToken → user в Mongo → checkRedis или generateAllTokens → request.tpjwt.                    |
| **getJwtUser.js**                      | Достаёт из request.tpjwt поля пользователя для хендлеров (авторизация).                                                     |
| **routeHandler.js**                    | Ставит заголовок `jwt` в ответе, если в result или request.tpjwt есть accessToken.                                          |
| **auth/handlers/login.js**             | Логин: remoteLogin (LDAP/bcrypt/SSO) → save user → generateToken → setex (Redis) → saveToken (Mongo) → ответ с accessToken. |
| **auth/handlers/login.js (saveToken)** | Локальная функция сохранения в `user_tokens` при логине (accessToken, refreshToken, ldapAccessToken, tokenData).            |
| **mongo/ignite/auth/usertoken.js**     | Работа с коллекцией `user_tokens`: findByCustomQuery, findOneAndUpdate, deleteByAccessToken.                                |
| **auth/refresh.js**                    | Запрос к внешнему auth-серверу с Bearer refreshToken для получения новой пары токенов (LDAP).                               |

---

## 8. Поток данных (диаграмма)

```
Клиент                          Proxy (3200)                    Auth / Orders / Reports
   |                                  |                                      |
   |  POST /lumina/auth/api/login    |                                      |
   |  body: { username, password }   |------------------------------------->| login.js
   |                                 |                                      |  -> remoteLogin (LDAP/bcrypt/SSO)
   |                                 |                                      |  -> generateToken() -> JWT
   |                                 |                                      |  -> Redis setex( key, TTL, userData )
   |                                 |                                      |  -> MongoDB user_tokens (accessToken, refreshToken, ...)
   |<--------------------------------|--------------------------------------| 200 + body.accessToken + header jwt
   |  сохраняем JWT                  |                                      |
   |                                 |                                      |
   |  GET/POST /lumina/orders/api/... |                                     |
   |  Authorization: JWT <token>     |------------------------------------->| authenticate.js
   |                                 |                                      |  -> verifyToken(token) -> payload
   |                                 |                                      |  -> Mongo user (status, lastActivity)
   |                                 |                                      |  -> checkRedisToken() -> есть ключ?
   |                                 |         да -> request.tpjwt = { ... } -> next()
   |                                 |         нет -> generateAllTokens() -> Mongo user_tokens, refresh (LDAP/MS)
   |                                 |              -> новый JWT, Redis setex, saveToken(Mongo)
   |                                 |              -> request.tpjwt = { accessToken: "JWT ...", ... }
   |                                 |  -> routeHandler: если новый token -> response.setHeader("jwt", ...)
   |<--------------------------------|--------------------------------------| 200 + [header jwt при refresh]
```

---

## 9. Важные детали

- **Формат заголовка:** именно `Authorization: JWT <token>` (не Bearer). В коде проверяется `jwtStr[0] === "JWT"`.
- **Клиент** должен при каждом запросе к защищённым роутам отправлять этот заголовок; при ответе с новым токеном (refresh) — обновить сохранённый токен (по заголовку `jwt`).
- **Redis** даёт быструю проверку «сессия жива» и данные для ответа без лишних запросов к MongoDB.
- **Refresh** хранится только на сервере (MongoDB); по нему получают новую пару через LDAP или Microsoft Graph.
- **Авторизация** (права на действия) реализована в хендлерах через `getJwtUser(request)` и при необходимости доп. запросы к БД (роли, права на рекламодателя и т.д.).

Если нужно, можно добавить в этот документ раздел «как добавить новый защищённый роут» или «как изменить TTL/формат токена».
