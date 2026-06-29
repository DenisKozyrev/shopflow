# ⚡ Next.js — Глубокий разбор

> Под капотом, вопросы с собеседований, реальные примеры

---

## 📌 Содержание

1. [Зачем Next.js — главная идея](#зачем-nextjs)
2. [App Router vs Pages Router](#app-router-vs-pages-router)
3. [Server Components vs Client Components](#server-vs-client-components)
4. [SSR / SSG / ISR / CSR — стратегии рендеринга](#стратегии-рендеринга)
5. [Routing и Layouts](#routing-и-layouts)
6. [Data Fetching — fetch, cache, revalidate](#data-fetching)
7. [Middleware / Edge Runtime](#middleware--edge-runtime)
8. [API Routes / Route Handlers](#api-routes--route-handlers)
9. [Performance и оптимизация](#performance-и-оптимизация)
10. [Вопросы с собеседований](#вопросы-с-собеседований)

---

## Зачем Next.js

### Проблема чистого React SPA

```
1. Браузер получает пустой HTML:
   <html><body><div id="root"></div></body></html>

2. Загружает JS бандл (может быть 500kb+)

3. React выполняется, рендерит компоненты

4. Пользователь видит контент
```

**Проблемы:**
- **SEO** — поисковики видят пустую страницу (или ждут JS)
- **FCP/LCP** — пользователь долго смотрит на белый экран
- **Медленные устройства** — парсинг и выполнение большого JS бандла

### Что даёт Next.js

```
С SSR/SSG:
1. Сервер рендерит готовый HTML
2. Браузер получает готовый контент → сразу видит страницу (FCP быстрый)
3. JS загружается → React "оживляет" HTML (Hydration)
4. Страница становится интерактивной
```

**Ключевые преимущества:**
- Быстрый FCP/LCP — пользователь видит контент сразу
- SEO — поисковики видят готовый HTML
- File-based routing — не нужен react-router
- API routes — backend прямо в проекте
- Оптимизация изображений, шрифтов, скриптов из коробки
- Server Components — меньше JS на клиенте

---

## App Router vs Pages Router

### Pages Router (до Next.js 13)

```
pages/
  index.tsx          → /
  about.tsx          → /about
  blog/
    [slug].tsx       → /blog/:slug
  api/
    users.ts         → /api/users (API route)
```

Всё — Client Components + специальные функции для данных:
```ts
// getServerSideProps — SSR (каждый запрос)
export async function getServerSideProps(context) {
  const data = await fetchData();
  return { props: { data } };
}

// getStaticProps — SSG (при сборке)
export async function getStaticProps() {
  const data = await fetchData();
  return { props: { data }, revalidate: 60 }; // ISR
}
```

### App Router (Next.js 13+)

```
app/
  layout.tsx         → корневой layout (обязателен)
  page.tsx           → / (Server Component по умолчанию)
  about/
    page.tsx         → /about
  blog/
    [slug]/
      page.tsx       → /blog/:slug
  api/
    users/
      route.ts       → /api/users (Route Handler)
```

**Главное отличие:** компоненты — Server Components по умолчанию. Data fetching прямо в компоненте:
```tsx
// app/blog/page.tsx — Server Component
async function BlogPage() {
  const posts = await db.getPosts(); // прямо здесь, без getServerSideProps
  return <PostList posts={posts} />;
}
```

### Сравнение

| | Pages Router | App Router |
|--|-------------|------------|
| По умолчанию | Client Component | Server Component |
| Data fetching | getServerSideProps / getStaticProps | async/await в компоненте |
| Layouts | _app.tsx (один на всё) | Вложенные layouts |
| Streaming | Нет | Да (Suspense) |
| React версия | React 17+ | React 18+ |
| Стабильность | Стабильный | Стабильный с Next.js 13.4+ |

---

## Server vs Client Components

### Server Components

Рендерятся **только на сервере**. JS код не отправляется клиенту.

```tsx
// app/users/page.tsx
// 'use client' НЕТ → Server Component

async function UsersPage() {
  // Можно делать всё это — код не попадёт в бандл клиента:
  const users = await db.query('SELECT * FROM users'); // прямой доступ к БД
  const secret = process.env.DB_SECRET; // серверные env переменные
  const fs = require('fs'); // Node.js API

  return (
    <ul>
      {users.map(u => <li key={u.id}>{u.name}</li>)}
    </ul>
  );
}
```

**Что НЕ могут Server Components:**
- useState / useEffect / любые хуки
- Обработчики событий (onClick и т.д.)
- Browser API (window, document)

### Client Components

```tsx
'use client'; // директива — этот компонент выполняется на клиенте

import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0); // можно хуки
  return (
    <button onClick={() => setCount(c => c + 1)}> // можно события
      Count: {count}
    </button>
  );
}
```

### Как они взаимодействуют

```tsx
// Server Component — получает данные
async function ProductPage({ params }) {
  const product = await getProduct(params.id); // на сервере

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      {/* Client Component вложен в Server Component — OK */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}

// Client Component — только интерактивность
'use client';
function AddToCartButton({ productId }) {
  const [added, setAdded] = useState(false);
  return (
    <button onClick={() => { addToCart(productId); setAdded(true); }}>
      {added ? 'Added!' : 'Add to Cart'}
    </button>
  );
}
```

### Важное правило — Server Component нельзя импортировать в Client

```tsx
'use client';
import ServerComponent from './ServerComponent'; // ❌ НЕЛЬЗЯ

// Можно передать как children (composition pattern):
// app/layout.tsx (Server):
export default function Layout({ children }) {
  return <ClientShell>{children}</ClientShell>; // children — server rendered
}

// ClientShell.tsx:
'use client';
function ClientShell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>Toggle</button>
      {open && children} {/* children рендерился на сервере */}
    </div>
  );
}
```

### Граница между Server и Client

```
Server Component
  └── Server Component   ✅
  └── Client Component   ✅
        └── Server Component  ❌ (будет рендериться как Client)
        └── Client Component  ✅
        └── Server Component через children ✅ (composition)
```

---

## Стратегии рендеринга

### CSR — Client Side Rendering

```tsx
'use client';
function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/data').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <Spinner />;
  return <DataView data={data} />;
}
// HTML: пустой div → JS загружается → fetch → render
// Когда: приватные страницы (dashboard), real-time данные
```

### SSR — Server Side Rendering

**App Router:**
```tsx
// По умолчанию — динамический рендер если есть cookies/headers/searchParams
async function Page({ searchParams }) {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store' // явный SSR — не кешировать
  });
  return <View data={await data.json()} />;
}
```

**Pages Router:**
```tsx
export async function getServerSideProps(context) {
  const { req, res, params, query } = context;
  const data = await fetchData(params.id);
  return { props: { data } };
}
// Когда: персонализированные страницы, данные меняются при каждом запросе
```

### SSG — Static Site Generation

**App Router:**
```tsx
// fetch без cache: 'no-store' → статически генерируется при сборке
async function BlogPost({ params }) {
  const post = await fetch(`/api/posts/${params.slug}`);
  return <Article post={await post.json()} />;
}

// Генерировать страницы для динамических маршрутов:
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(p => ({ slug: p.slug }));
}
```

**Pages Router:**
```tsx
export async function getStaticProps({ params }) {
  const post = await getPost(params.slug);
  return { props: { post } };
}

export async function getStaticPaths() {
  const posts = await getPosts();
  return {
    paths: posts.map(p => ({ params: { slug: p.slug } })),
    fallback: false, // 404 для несуществующих
    // fallback: 'blocking' — SSR для новых страниц
    // fallback: true — показать loading state, потом SSG
  };
}
// Когда: блог, документация, маркетинговые страницы
```

### ISR — Incremental Static Regeneration

```tsx
// App Router — revalidate в секундах
async function Page() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 } // пересобирать каждые 60 секунд
  });
  return <View data={await data.json()} />;
}

// On-demand revalidation — пересобрать по событию (например webhook):
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request) {
  const { path, tag } = await request.json();
  revalidatePath(path);   // пересобрать конкретный путь
  revalidateTag(tag);     // пересобрать все fetch с этим тегом
  return Response.json({ revalidated: true });
}
```

### Когда что использовать

```
SSG  → контент редко меняется (блог, docs, landing)
ISR  → контент меняется, но не при каждом запросе (каталог, новости)
SSR  → персонализация, auth, реал-тайм данные
CSR  → приватный dashboard, высокая интерактивность
```

---

## Routing и Layouts

### File-based Routing (App Router)

```
app/
  page.tsx              → /
  layout.tsx            → корневой layout (обязателен, оборачивает все страницы)
  loading.tsx           → автоматический Suspense fallback
  error.tsx             → error boundary для маршрута
  not-found.tsx         → 404 страница
  
  dashboard/
    layout.tsx          → layout только для /dashboard/*
    page.tsx            → /dashboard
    settings/
      page.tsx          → /dashboard/settings
  
  blog/
    [slug]/             → динамический сегмент
      page.tsx          → /blog/:slug
    
  shop/
    [...categories]/    → catch-all → /shop/a/b/c
      page.tsx
    
  (marketing)/          → route group — не влияет на URL
    about/page.tsx      → /about
    contact/page.tsx    → /contact
  
  @modal/               → parallel routes — два компонента в одном layout
    page.tsx
```

### Layouts — вложенные и переиспользуемые

```tsx
// app/layout.tsx — корневой, рендерится один раз
export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx — только для dashboard
export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
// /dashboard → RootLayout > DashboardLayout > Page
// Layouts НЕ ре-рендерятся при навигации между дочерними маршрутами
```

### loading.tsx — автоматический Suspense

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashboardSkeleton />;
}
// Next.js автоматически оборачивает page.tsx в <Suspense fallback={<Loading />}>
// Стриминг: layout отправляется сразу, page — когда готов
```

### error.tsx — error boundary

```tsx
'use client'; // error boundary должен быть Client Component

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Что-то пошло не так</h2>
      <button onClick={reset}>Попробовать снова</button>
    </div>
  );
}
```

### Навигация

```tsx
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Декларативная навигация
<Link href="/dashboard" prefetch={false}>Dashboard</Link>
// prefetch — по умолчанию true в production (предзагружает страницу)

// Программная навигация
'use client';
function Component() {
  const router = useRouter();
  
  const handleClick = () => {
    router.push('/dashboard');          // перейти
    router.replace('/login');           // без записи в history
    router.back();                      // назад
    router.refresh();                   // обновить Server Components
  };
}

// Текущий путь
const pathname = usePathname(); // '/dashboard/settings'

// Search params
const searchParams = useSearchParams();
const query = searchParams.get('q');
```

---

## Data Fetching

### fetch с расширенными опциями Next.js

```tsx
// SSG — кешируется навсегда (при сборке)
const data = await fetch('https://api.example.com/posts', {
  cache: 'force-cache' // дефолт в Server Components
});

// SSR — не кешируется, каждый запрос новый
const data = await fetch('https://api.example.com/user', {
  cache: 'no-store'
});

// ISR — кешируется, обновляется каждые N секунд
const data = await fetch('https://api.example.com/products', {
  next: { revalidate: 3600 } // каждый час
});

// С тегом для on-demand revalidation
const data = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] } // revalidateTag('posts') пересоберёт
});
```

### Дедупликация запросов

```tsx
// Несколько компонентов делают одинаковый запрос → Next.js делает его ОДИН раз
// Автоматически, на уровне одного render pass

// UserHeader.tsx (Server Component)
async function UserHeader() {
  const user = await getUser(); // fetch('/api/user')
  return <div>{user.name}</div>;
}

// UserProfile.tsx (Server Component)
async function UserProfile() {
  const user = await getUser(); // fetch('/api/user') — тот же URL
  return <div>{user.email}</div>;
}

// В одном render pass — запрос выполнится ОДИН раз, результат используется дважды
// Это работает через React cache() и встроенную мемоизацию fetch
```

### React cache() — для non-fetch запросов

```tsx
import { cache } from 'react';

// Мемоизирует функцию на время одного render pass (как дедупликация fetch)
const getUser = cache(async (id: string) => {
  return db.users.findById(id); // прямой запрос к БД
});

// Теперь getUser('123') в разных компонентах → один запрос к БД
```

### Параллельный vs последовательный fetching

```tsx
// МЕДЛЕННО — последовательно (waterfall)
async function Page() {
  const user = await getUser();       // ждём
  const posts = await getPosts();     // ждём после user
  // суммарно = user_time + posts_time
}

// БЫСТРО — параллельно
async function Page() {
  const [user, posts] = await Promise.all([
    getUser(),
    getPosts()
  ]);
  // суммарно = max(user_time, posts_time)
}

// Streaming — показать что готово, не ждать всё
async function Page() {
  const user = await getUser(); // быстрый запрос — ждём

  return (
    <div>
      <UserProfile user={user} />
      <Suspense fallback={<Skeleton />}>
        <SlowComponent /> {/* медленный — стримим отдельно */}
      </Suspense>
    </div>
  );
}
```

---

## Middleware / Edge Runtime

### Что такое Middleware

Функция которая выполняется **перед каждым запросом**, до того как отрендерится страница. Работает на **Edge Runtime** — V8 без Node.js API, максимально близко к пользователю.

```ts
// middleware.ts (в корне проекта)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Редирект неавторизованных
  const token = request.cookies.get('token')?.value;
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Добавить заголовок
  const response = NextResponse.next();
  response.headers.set('x-custom-header', 'value');
  return response;
}

// На каких путях запускать middleware:
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
  // или исключить статику:
  // matcher: ['/((?!_next/static|favicon.ico).*)']
};
```

### Примеры использования

```ts
// A/B тестирование
export function middleware(request: NextRequest) {
  const bucket = Math.random() < 0.5 ? 'a' : 'b';
  const response = NextResponse.rewrite(
    new URL(`/experiment-${bucket}${request.nextUrl.pathname}`, request.url)
  );
  response.cookies.set('bucket', bucket); // сохранить для следующих запросов
  return response;
}

// Геолокация
export function middleware(request: NextRequest) {
  const country = request.geo?.country ?? 'US';
  if (country === 'RU') {
    return NextResponse.rewrite(new URL('/ru' + request.nextUrl.pathname, request.url));
  }
}

// Rate limiting (с Redis/Upstash)
export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) return new NextResponse('Too Many Requests', { status: 429 });
  return NextResponse.next();
}
```

### Edge Runtime — ограничения

```ts
// Что НЕЛЬЗЯ в Edge Runtime:
// - Node.js API (fs, path, crypto нативный)
// - Большинство npm пакетов завязанных на Node.js

// Что МОЖНО:
// - fetch API
// - Web Crypto API
// - TextEncoder / TextDecoder
// - Маленькие JS only пакеты

// Явно указать Edge Runtime:
export const runtime = 'edge';
```

---

## API Routes / Route Handlers

### Route Handlers (App Router)

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '1';

  const users = await db.getUsers({ page: parseInt(page) });
  return NextResponse.json(users);
}

// POST /api/users
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Валидация
  if (!body.name || !body.email) {
    return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
  }

  const user = await db.createUser(body);
  return NextResponse.json(user, { status: 201 });
}
```

### Динамические Route Handlers

```ts
// app/api/users/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await db.getUser(params.id);
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const user = await db.updateUser(params.id, body);
  return NextResponse.json(user);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.deleteUser(params.id);
  return new NextResponse(null, { status: 204 });
}
```

### Middleware для Route Handlers

```ts
// Паттерн — обёртка для auth
function withAuth(handler: Function) {
  return async (request: NextRequest, context: any) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const user = await verifyToken(token);
      // Передаём user дальше через request (расширяем)
      (request as any).user = user;
      return handler(request, context);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  };
}

export const GET = withAuth(async (request: NextRequest) => {
  const user = (request as any).user;
  return NextResponse.json({ profile: user });
});
```

---

## Performance и оптимизация

### Image Optimization

```tsx
import Image from 'next/image';

// next/image автоматически:
// - Конвертирует в WebP/AVIF
// - Генерирует srcSet для разных размеров
// - Lazy loading по умолчанию
// - Предотвращает CLS (резервирует место)

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority         // LCP изображение — загрузить сразу (без lazy)
  placeholder="blur" // показать blurred placeholder
  blurDataURL="..." // base64 превью
  sizes="(max-width: 768px) 100vw, 50vw" // подсказка для srcSet
/>

// Внешние изображения — нужно добавить в next.config.js:
// images: { domains: ['images.unsplash.com'] }
```

### Font Optimization

```tsx
// next/font — загружает шрифты в билд, zero layout shift, без запросов к Google
import { Inter, Roboto_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter', // CSS переменная
});

export default function Layout({ children }) {
  return (
    <html className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### Script Optimization

```tsx
import Script from 'next/script';

// strategy:
// beforeInteractive — до гидрации (для критичных скриптов)
// afterInteractive   — после гидрации (дефолт, Google Analytics)
// lazyOnload         — в idle time (чаты, виджеты)
// worker             — в Web Worker (через Partytown)

<Script
  src="https://www.googletagmanager.com/gtag/js"
  strategy="afterInteractive"
/>
```

### Bundle Analysis

```bash
# Анализировать размер бандла:
npm install @next/bundle-analyzer

# next.config.js:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({});

# Запустить:
ANALYZE=true npm run build
# Откроется визуальная карта бандла
```

### Streaming и Suspense

```tsx
// Стримить части страницы — пользователь видит контент постепенно
async function ProductPage({ params }) {
  const product = await getProduct(params.id); // быстрый запрос

  return (
    <div>
      <ProductInfo product={product} /> {/* сразу */}

      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={params.id} /> {/* когда загрузится */}
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations /> {/* когда загрузится */}
      </Suspense>
    </div>
  );
}

// Reviews и Recommendations загружаются параллельно и стримятся по готовности
// Без Suspense — страница ждала бы самого медленного
```

### Оптимизация производительности — чеклист

```
✅ Использовать Server Components везде где нет интерактивности
✅ 'use client' только для интерактивных частей
✅ next/image для всех изображений
✅ next/font вместо @import в CSS
✅ Динамические импорты для тяжёлых Client Components
✅ Suspense + loading.tsx для стриминга
✅ revalidate вместо cache: 'no-store' где возможно
✅ generateStaticParams для динамических SSG страниц
✅ Parallel data fetching через Promise.all
```

```tsx
// Динамический импорт Client Component
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // не рендерить на сервере (если нужен только window/browser API)
});
```

---

## Вопросы с собеседований

---

### ❓ В чём главное отличие App Router от Pages Router?

**Ответ:**
App Router использует React Server Components по умолчанию — компоненты рендерятся на сервере и не отправляют JS на клиент. Это уменьшает размер бандла и убирает необходимость в специальных функциях типа `getServerSideProps` — данные fetching'аются прямо в async компоненте.

Также App Router поддерживает вложенные layouts (каждый route может иметь свой layout без ре-рендера), streaming через Suspense, и более гранулярный контроль над кешированием.

Pages Router — всё клиент, data fetching через специальные экспортированные функции, один глобальный `_app.tsx`.

---

### ❓ Что такое гидрация (Hydration) и что такое Hydration Mismatch?

**Ответ:**

**Hydration** — процесс когда React на клиенте "оживляет" серверный HTML: добавляет обработчики событий, устанавливает состояние, делает DOM интерактивным. React не перерисовывает DOM, а "присоединяется" к существующему HTML.

```
Сервер → HTML строка → Клиент получает → React hydrates → Интерактивно
```

**Hydration Mismatch** — когда HTML от сервера и то что React рендерит на клиенте **не совпадают**. React бросает предупреждение и перерендеривает с нуля (дорого).

```tsx
// ОШИБКА — Math.random() даёт разные значения на сервере и клиенте
function Component() {
  return <div>{Math.random()}</div>; // ❌ Hydration mismatch!
}

// ОШИБКА — new Date() разная на сервере и клиенте
function Component() {
  return <div>{new Date().toLocaleString()}</div>; // ❌
}

// Решение 1 — useState с useEffect
function Component() {
  const [random, setRandom] = useState(0);
  useEffect(() => setRandom(Math.random()), []); // только на клиенте
  return <div>{random}</div>;
}

// Решение 2 — suppressHydrationWarning (если знаешь что делаешь)
<div suppressHydrationWarning>{new Date().toLocaleString()}</div>

// Решение 3 — динамический импорт с ssr: false
const ClientOnlyComponent = dynamic(() => import('./Component'), { ssr: false });
```

---

### ❓ Как работает кеширование в Next.js App Router?

**Ответ:**

Next.js имеет **4 слоя кеширования**:

```
1. Request Memoization (React cache)
   — Дедупликация одинаковых fetch в рамках одного render pass
   — Автоматически для fetch, вручную для остального через cache()

2. Data Cache
   — Результаты fetch хранятся на сервере между запросами
   — cache: 'force-cache' (дефолт), next: { revalidate: N }
   — Инвалидация: revalidatePath(), revalidateTag()

3. Full Route Cache
   — Статически рендеренные страницы хранятся на сервере
   — Только для статических маршрутов (без cookies/headers в рендере)

4. Router Cache (Client-side)
   — Уже посещённые страницы кешируются в памяти браузера
   — Быстрая навигация без повторных запросов к серверу
   — router.refresh() или Link с prefetch очищает кеш
```

---

### ❓ Когда использовать Server Actions?

**Ответ:**

Server Actions — async функции которые выполняются на сервере, вызываются с клиента. Основной use case — мутации данных (формы, кнопки).

```tsx
// Без Server Actions нужен API route + fetch в Client Component
// С Server Actions:

// actions.ts
'use server';
export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  await db.posts.create({ title });
  revalidatePath('/blog'); // инвалидировать кеш
  redirect('/blog');
}

// Page.tsx (Server Component)
export default function NewPost() {
  return (
    <form action={createPost}> {/* нативный HTML form action */}
      <input name="title" />
      <button type="submit">Create</button>
    </form>
  );
}
// Работает даже без JS на клиенте (progressive enhancement)
```

---

### ❓ В чём разница между redirect и rewrite в Middleware?

**Ответ:**

```ts
// redirect — меняет URL в браузере (пользователь видит новый URL)
return NextResponse.redirect(new URL('/login', request.url));
// URL в браузере: /login

// rewrite — URL в браузере НЕ меняется, но контент другой страницы
return NextResponse.rewrite(new URL('/actual-page', request.url));
// URL в браузере: /original-url, контент: /actual-page

// Применение rewrite:
// - A/B тестирование (показать /variant-a не меняя URL)
// - Геолокация (показать /ru/page для русских пользователей)
// - Legacy URL поддержка
```

---

### ❓ Что произойдёт если добавить 'use client' в layout.tsx?

**Ответ:**

Весь layout и все его дочерние компоненты станут Client Components — они будут включены в JS бандл. Это уничтожает преимущество Server Components для всего поддерева.

Правильный паттерн — держать layout как Server Component, а интерактивные части вынести в отдельные Client Components:

```tsx
// app/dashboard/layout.tsx — Server Component
import { Sidebar } from './Sidebar'; // Client Component
import { getUser } from '@/lib/auth'; // серверный код

export default async function Layout({ children }) {
  const user = await getUser(); // можно — мы на сервере
  return (
    <div>
      <Sidebar user={user} /> {/* Client Component получает данные через props */}
      <main>{children}</main>
    </div>
  );
}
```

---

### ❓ Как реализовать защищённые маршруты?

**Ответ:**

Есть несколько уровней защиты — лучше комбинировать:

```ts
// 1. Middleware — самый ранний уровень, до рендера страницы
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// 2. Server Component — проверка на уровне страницы
// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login'); // server-side redirect
  return <Dashboard user={session.user} />;
}

// 3. Route Handler — для API
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ...
}
```

---

### ❓ Что такое Partial Prerendering (PPR)?

**Ответ:**

PPR (Next.js 14+, экспериментальный) — гибридный подход: **статическая оболочка страницы** генерируется при сборке, **динамические части** стримятся при запросе.

```tsx
// next.config.js
experimental: { ppr: true }

// page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <div>
      <StaticHeader />      {/* генерируется при сборке → мгновенно */}
      <StaticSidebar />     {/* генерируется при сборке → мгновенно */}

      <Suspense fallback={<Skeleton />}>
        <DynamicFeed />     {/* стримится при запросе */}
      </Suspense>
    </div>
  );
}
```

```
Без PPR: или всё статично или всё динамично
С PPR:   статическая оболочка сразу + динамический контент стримится
```

---

*Next.js Cheatsheet — для Senior Frontend собеседований*
*Версия: Next.js 14 / App Router*
