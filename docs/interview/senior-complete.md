# 🧠 Senior Frontend — Полная шпаргалка

> JS (YDKJS-уровень) + React под капотом + TypeScript + Architecture + Browser + CSS + Testing + Next.js + Algorithms

---

## 📌 Содержание

### JS Core
1. [Event Loop (micro/macro)](#event-loop)
2. [Промисы под капотом](#промисы)
3. [Реализация своего Promise](#свой-promise)
4. [Promise / async-await](#promise--async-await)
5. [this / context](#this--context)
6. [bind / call / apply](#bind--call--apply)
7. [Closures (замыкания)](#closures)
8. [Garbage Collection](#garbage-collection)
9. [Recursion](#recursion)
10. [Big O / Сложность](#big-o)
11. [Arrays, Map, Set](#arrays-map-set)
12. [Two Sum / Frequency Map](#two-sum--frequency-map)
13. [Concurrency Limit](#concurrency-limit)
14. [Arrow vs Function](#arrow-vs-function)
15. [Прототипы](#прототипы)
16. [DOM События](#dom-события)

### React Core
17. [Virtual DOM](#virtual-dom)
18. [Reconciliation](#reconciliation)
19. [Keys](#keys)
20. [Причины ре-рендера](#причины-ре-рендера)
21. [useEffect / useLayoutEffect](#useeffect--uselayouteffect)
22. [Refs](#refs)
23. [Fragment](#fragment)
24. [Controlled / Uncontrolled](#controlled--uncontrolled)
25. [useState](#usestate)
26. [useMemo / useCallback](#usememo--usecallback)
27. [React.memo](#reactmemo)
28. [Полный цикл ре-рендера](#полный-цикл-ре-рендера)
29. [Debounce / Throttle](#debounce--throttle)

### TypeScript
30. [Generics](#generics)
31. [Utility Types](#utility-types)
32. [extends / infer](#extends--infer)
33. [keyof / typeof](#keyof--typeof)
34. [Mapped Types](#mapped-types)
35. [Template Literal Types](#template-literal-types)
36. [Discriminated Unions](#discriminated-unions)
37. [Type Guards](#type-guards)
38. [Branded Types](#branded-types)
39. [const assertions](#const-assertions)
40. [strict mode / tsconfig](#tsconfig)

### Browser / Web
41. [Как работает браузер](#как-работает-браузер)
42. [Browser APIs](#browser-apis)
43. [Storage](#storage)
44. [CORS](#cors)
45. [HTTP / HTTPS](#http--https)
46. [Cookies](#cookies)
47. [fetch](#fetch)
48. [Layout / Reflow / Repaint](#layout--reflow--repaint)

### React Advanced
49. [Redux vs Context](#redux-vs-context)
50. [RTK / RTK Query](#rtk--rtk-query)
51. [React Query](#react-query)
52. [Redux Thunk](#redux-thunk)
53. [Forms (react-hook-form)](#forms)
54. [Virtualization](#virtualization)
55. [Lazy Loading](#lazy-loading)
56. [Performance Metrics](#performance-metrics)
57. [Lighthouse / DevTools](#lighthouse--devtools)
58. [React 19](#react-19)

### Design / Architecture
59. [SOLID](#solid)
60. [DI — Dependency Injection](#dependency-injection)
61. [KISS / DRY / YAGNI](#kiss--dry--yagni)
62. [Паттерны: Strategy / Factory / Decorator / Observer](#паттерны)
63. [HOC vs Hooks](#hoc-vs-hooks)
64. [Custom Hooks](#custom-hooks)

### CSS / Верстка
65. [Box Model](#box-model)
66. [Specificity (специфичность)](#specificity)
67. [Cascade & Inheritance](#cascade--inheritance)
68. [Positioning](#positioning)
69. [Stacking Context (z-index)](#stacking-context)
70. [Flex / Grid](#flex--grid)
71. [Responsive Design](#responsive-design)
72. [CSS Variables (Custom Properties)](#css-variables)
73. [Animations & Transitions](#animations--transitions)
74. [BEM / CSS Modules / CSS-in-JS](#bem--css-modules--css-in-js)
75. [Pixel Perfect / Layout Bugs](#pixel-perfect)
76. [Modern CSS](#modern-css)

### Testing / Tooling
77. [Test Pyramid](#test-pyramid)
78. [Jest basics](#jest-basics)
79. [ESLint](#eslint)
80. [Chrome DevTools](#chrome-devtools)

### Next.js
81. [Next.js — главная идея](#nextjs)

### CI/CD / Cloud
82. [CI/CD](#cicd)
83. [Cloud](#cloud)

### Algorithms / Tasks
84. [Алгоритмы — Big O](#алгоритмы)
85. [Задачи: BFS/DFS, DOM-дерево, связный список](#задачи)

### Security
86. [XSS / CSRF / SQL Injection](#security)

---

# JS CORE

---

## Event Loop

### Однопоточный JS

JavaScript выполняет **один кусок кода** в момент времени. Браузер/Node.js предоставляют **Web APIs** (таймеры, сеть, DOM-события), которые работают параллельно.

### Очереди

```
┌──────────────────────────────────────┐
│            Call Stack                 │  ← LIFO стек вызовов
└──────────────────┬───────────────────┘
                   │ пусто?
                   ▼
┌──────────────────────────────────────┐
│         Microtask Queue               │
│  Promise.then, queueMicrotask,        │
│  MutationObserver                     │
│  (опустошается ПОЛНОСТЬЮ!)            │
└──────────────────┬───────────────────┘
                   │ пуста?
                   ▼
┌──────────────────────────────────────┐
│         Macrotask Queue               │
│  setTimeout, setInterval, I/O,        │
│  MessageChannel, postMessage          │
│  (одна задача за итерацию)            │
└──────────────────────────────────────┘
```

**Правило:** после каждой macrotask Event Loop **полностью опустошает** microtask queue.
После microtasks, перед следующей macrotask → `requestAnimationFrame` → render.

### Пример

```js
console.log('1');                              // sync
setTimeout(() => console.log('2'), 0);        // macrotask
Promise.resolve().then(() => console.log('3')); // microtask
queueMicrotask(() => console.log('4'));        // microtask
console.log('5');                              // sync

// Вывод: 1, 5, 3, 4, 2
// sync (1,5) → microtasks (3,4) → macrotask (2)
```

### Сложный пример

```js
Promise.resolve()
  .then(() => {
    console.log('micro 1');
    setTimeout(() => console.log('macro inside micro'), 0);
  })
  .then(() => console.log('micro 2'));

setTimeout(() => console.log('macro 1'), 0);

// Вывод: micro 1, micro 2, macro 1, macro inside micro

// 2 task
console.log(1);

setTimeout(function () {
    console.log(2);
});

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);
// 1, 4, 6, 3, 2, 5

// если добавить
const foo1 = () => {
    console.log('foo1');
    return Promise.resolve().then(foo1)
}

foo1();

// вызов foo1 приведет к блокировке очереди микротасок,
// перед этим будет вызов синхронного кода 1, 4, 6, console.log('foo1'), 
// далее мы в очередь микротаскок положим  Promise.resolve().then(foo1) и
// потом положим Promise.resolve(3).then(console.log); поэтому 3 тоже отработает
// потом заблокируется и пойдет по кругу 1, 4, 6,'foo1', 3, 'foo1'(пойдет отрисовываться)

// 1, 4, 6,'foo1', 3, 'foo1...'

// если добавить 

console.log(1);

setTimeout(function () {
    console.log(2);
});

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);

const foo2 = () => {
    console.log('foo2');
    setTimeout(foo2);
}

foo2()

// когда доходим до foo2 мы вызваем console, потом ставим в очередь макротаску,
// потом микротаску, потом остальные макротаски, а потом замыкаемся на foo2 рекурсии.

// 1, 4, 6, 'foo2', 3, 2, 5, 'foo2...'

// добавляем 
console.log(1);

setTimeout(function () {
    console.log(2);
});

setTimeout(() =>
    Promise.resolve().then(() => console.log(7))
)

Promise.resolve(3).then(console.log);

console.log(4);

setTimeout(function () {
    console.log(5);
}, 0);

console.log(6);

// тут показана очередность макро и микро тасок 2, 7, 5, одна макро, потом все микро, потом опять макро

// 1, 4, 6, 3, 2, 7, 5
```

---

## Промисы

### Что такое Promise под капотом

Promise — объект с внутренним состоянием:
- `[[PromiseState]]`: `pending | fulfilled | rejected`
- `[[PromiseResult]]`: значение или ошибка
- `[[PromiseFulfillReactions]]` и `[[PromiseRejectReactions]]` — списки колбэков

Когда вызываешь `.then(fn)` — `fn` **не вызывается сразу**. Она добавляется в microtask queue после resolve.

### Promise chain

```js
Promise.resolve(1)
  .then(x => x + 1)      // Promise(2)
  .then(x => {
    throw new Error('!'); // переходит в catch
  })
  .catch(e => 0)          // Promise(0)
  .then(x => x * 10)     // Promise(0)
  .then(console.log);    // 0
```

Каждый `.then` возвращает **новый промис**. Если внутри `.then` вернуть промис — следующий `.then` ждёт его resolve.

### Комбинаторы

```js
// all — ждёт все; если один reject → весь reject
const [user, posts] = await Promise.all([getUser(), getPosts()]);

// allSettled — ждёт все, не падает при reject
const results = await Promise.allSettled([p1, p2, p3]);
results.forEach(r => {
  if (r.status === 'fulfilled') console.log(r.value);
  else console.log(r.reason);
});

// race — первый resolved или rejected
const fast = await Promise.race([fetch('/api/1'), fetch('/api/2')]);

// any — первый fulfilled; если все reject → AggregateError
const first = await Promise.any([p1, p2, p3]);
```

---

## Свой Promise

```js
class MyPromise {
  #state = 'pending';
  #value = undefined;
  #handlers = [];

  constructor(executor) {
    const resolve = (value) => {
      if (this.#state !== 'pending') return;
      this.#state = 'fulfilled';
      this.#value = value;
      this.#handlers.forEach(h => h.onFulfilled && queueMicrotask(() => h.onFulfilled(value)));
    };

    const reject = (reason) => {
      if (this.#state !== 'pending') return;
      this.#state = 'rejected';
      this.#value = reason;
      this.#handlers.forEach(h => h.onRejected && queueMicrotask(() => h.onRejected(reason)));
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handler = {
        onFulfilled: onFulfilled
          ? (value) => { try { resolve(onFulfilled(value)); } catch (e) { reject(e); } }
          : resolve,
        onRejected: onRejected
          ? (reason) => { try { resolve(onRejected(reason)); } catch (e) { reject(e); } }
          : reject,
      };

      if (this.#state === 'fulfilled') {
        queueMicrotask(() => handler.onFulfilled(this.#value));
      } else if (this.#state === 'rejected') {
        queueMicrotask(() => handler.onRejected(this.#value));
      } else {
        this.#handlers.push(handler);
      }
    });
  }

  catch(onRejected) { return this.then(null, onRejected); }

  static resolve(value) { return new MyPromise(res => res(value)); }
  static reject(reason) { return new MyPromise((_, rej) => rej(reason)); }
}

MyPromise.resolve(42).then(x => x * 2).then(console.log); // 84
```

---

## Promise / async-await

### async/await — сахар над промисами

```js
async function getData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(e);
  }
}

// await приостанавливает функцию, но не блокирует поток
// Под капотом — генератор + промис
```

### Параллельные запросы

```js
// ПЛОХО — последовательно (медленно)
const user = await getUser();
const posts = await getPosts();

// ХОРОШО — параллельно
const [user, posts] = await Promise.all([getUser(), getPosts()]);
```

---

## this / context

### 4 правила определения this (по приоритету)

**1. new binding**
```js
function Foo() { this.x = 1; }
const obj = new Foo(); // this = новый объект
```

**2. Explicit binding**
```js
foo.call(ctx, arg1);      // this = ctx
foo.apply(ctx, [arg1]);   // this = ctx
const bound = foo.bind(ctx); // this = ctx навсегда
```

**3. Implicit binding**
```js
obj.foo(); // this = obj
// НО! Потеря при присваивании:
const fn = obj.foo;
fn(); // this = undefined (strict) или window
```

**4. Default binding**
```js
foo(); // strict mode → undefined, non-strict → window/global
```

### Arrow function — нет своего this

Arrow function берёт `this` из **лексического окружения** — места, где написана.

```js
const obj = {
  name: 'Alice',
  greet: function() {
    setTimeout(() => {
      console.log(this.name); // 'Alice' — this из greet
    }, 100);
  }
};

// VS — потеря this:
const obj2 = {
  name: 'Alice',
  greet: () => console.log(this.name) // undefined — this из модуля
};
```

### Потеря this при передаче колбэка

```js
const obj = {
  name: 'Alice',
  greet() { console.log(this.name); }
};

const fn = obj.greet;
fn(); // undefined — нет implicit binding

// Решения:
fn.bind(obj)(); // явная привязка
(() => obj.greet())(); // стрелка сохраняет контекст
```

---

## bind / call / apply

```js
function greet(greeting, punctuation) {
  return `${greeting}, ${this.name}${punctuation}`;
}

const user = { name: 'Alice' };

// call — args через запятую, вызывает сразу
greet.call(user, 'Hello', '!'); // "Hello, Alice!"

// apply — args как массив, вызывает сразу
greet.apply(user, ['Hi', '?']); // "Hi, Alice?"

// bind — возвращает новую функцию с привязанным this
const boundGreet = greet.bind(user, 'Hey');
boundGreet('...'); // "Hey, Alice..." — partial application
```

### Реализация bind вручную

```js
Function.prototype.myBind = function(ctx, ...partialArgs) {
  const fn = this;
  return function(...args) {
    return fn.apply(ctx, [...partialArgs, ...args]);
  };
};
```

---

## Closures

### Что такое замыкание (YDKJS)

Замыкание — функция **помнит свою лексическую область видимости** даже когда выполняется вне неё.

```js
function makeCounter(initial = 0) {
  let count = initial; // приватная переменная

  return {
    increment: () => ++count,
    decrement: () => --count,
    get: () => count
  };
}

const counter = makeCounter(10);
counter.increment(); // 11
counter.get();       // 11
// count недоступен снаружи напрямую
```

### Module pattern

```js
const UserStore = (() => {
  let users = []; // приватное

  return {
    add: (user) => users.push(user),
    getAll: () => [...users],
    find: (id) => users.find(u => u.id === id)
  };
})();
```

### Классическая ловушка с var в цикле

```js
// var — одна переменная на все итерации
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 3, 3, 3
}

// let — своя переменная на каждую итерацию
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0); // 0, 1, 2
}
```

### Stale closure в React

```js
function Component() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1); // count = 0 — замыкание на начальное значение!
      // count никогда не вырастет выше 1
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Решение — функциональный update:
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => c + 1); // c — актуальное значение из очереди
    }, 1000);
    return () => clearInterval(id);
  }, []);
}
```

---

## Garbage Collection

### Mark and Sweep

V8 использует алгоритм **mark and sweep**:
1. **Mark** — начиная с GC roots (window, глобальные объекты, стек) обходит все достижимые объекты
2. **Sweep** — удаляет все непомеченные (недостижимые) объекты

### Поколения (Generational GC)

- **Young generation (Nursery)** — новые объекты. GC частый и быстрый
- **Old generation** — объекты, пережившие несколько GC. Очищается реже

### Утечки памяти

```js
// 1. Глобальные переменные
function leak() {
  oops = 'global variable'; // без let/const → window.oops
}

// 2. Забытые таймеры
const data = fetchHugeData();
setInterval(() => processData(data), 1000); // data никогда не освободится
// Решение: clearInterval при cleanup

// 3. Removed DOM nodes
let element = document.getElementById('btn');
document.body.removeChild(element);
// element всё ещё держит ссылку на DOM узел → утечка
element = null; // Решение

// 4. Event listeners
const handler = () => {};
element.addEventListener('click', handler);
element.removeEventListener('click', handler); // Решение
```

### WeakMap / WeakSet

```js
// WeakMap — слабые ссылки, не мешают GC
const cache = new WeakMap();
cache.set(domElement, { data: '...' });
// Когда domElement удалён → запись автоматически удалится
```

---

## Recursion

### Основа — base case + recursive case

```js
function factorial(n) {
  if (n <= 1) return 1;      // base case
  return n * factorial(n - 1); // recursive case
}
```

### Обход дерева — рекурсия идеальна

```js
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, deepClone(v)])
  );
}
```

### Stack overflow / trampolining

```js
// Решение — trampolining (для сложных случаев)
function trampoline(fn) {
  return function(...args) {
    let result = fn(...args);
    while (typeof result === 'function') result = result();
    return result;
  };
}
```

---

## Big O

| Сложность | Название | Пример | n=1000 |
|-----------|----------|--------|--------|
| O(1) | Константная | Доступ к массиву по индексу | 1 оп. |
| O(log n) | Логарифмическая | Бинарный поиск | ~10 |
| O(n) | Линейная | Обход массива | 1 000 |
| O(n log n) | Линейно-лог | Merge sort | ~10 000 |
| O(n²) | Квадратичная | Вложенные циклы | 1 000 000 |
| O(2ⁿ) | Экспоненциальная | Fibonacci рекурсия | огромно |

```js
// O(log n) — бинарный поиск
let low = 0, high = arr.length - 1;
while (low <= high) {
  const mid = Math.floor((low + high) / 2);
  if (arr[mid] === target) return mid;
  else if (arr[mid] < target) low = mid + 1;
  else high = mid - 1;
}
```

---

## Arrays, Map, Set

```js
// O(1): push, pop, arr[i]
// O(n): shift, unshift, splice, indexOf, find, filter, map, reduce

arr.flat(Infinity)       // вложенные → плоский
arr.flatMap(fn)          // map + flat(1)
arr.at(-1)               // последний элемент (ES2022)
Object.groupBy(arr, fn)  // группировка (ES2024)
```

### Map vs Object

```js
const map = new Map();
map.set(42, 'number key');    // Map поддерживает любые ключи
map.set(obj, 'object key');   // включая объекты
map.get('key');    // O(1)
map.size;          // количество элементов
// Map сохраняет порядок вставки; Object — строковые/Symbol ключи только
```

### Set

```js
const set = new Set([1, 2, 3, 2, 1]); // {1, 2, 3}
set.has(3); // O(1)

const unique = [...new Set(arr)];
const intersection = a.filter(x => setB.has(x)); // O(n) вместо O(n²)
```

---

## Two Sum / Frequency Map

```js
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}

// Frequency Map
function isAnagram(s, t) {
  if (s.length !== t.length) return false;
  const freq = {};
  for (const c of s) freq[c] = (freq[c] || 0) + 1;
  for (const c of t) {
    if (!freq[c]) return false;
    freq[c]--;
  }
  return true;
}
```

---

## Concurrency Limit

```js
async function fetchWithConcurrencyLimit(urls, limit) {
  const results = [];
  const executing = new Set();

  for (const url of urls) {
    const promise = fetch(url).then(r => r.json());
    results.push(promise);
    executing.add(promise);
    promise.finally(() => executing.delete(promise));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

const data = await fetchWithConcurrencyLimit(urls, 3); // не более 3 одновременно
```

---

## Arrow vs Function

| | function | arrow |
|--|---------|-------|
| `this` | Динамический (по вызову) | Лексический (из внешнего scope) |
| `arguments` | Есть | Нет |
| `new` | Можно | Нельзя |
| `prototype` | Есть | Нет |
| Hoisting | Да (declaration) | Нет |

```js
class Timer {
  ticks = 0;
  start() {
    setInterval(() => {
      this.ticks++; // this = экземпляр Timer ✅
    }, 1000);
  }
}
```

---

## Прототипы

### Прототипная цепочка

```js
const arr = [1, 2, 3];
// arr.__proto__ === Array.prototype
// Array.prototype.__proto__ === Object.prototype
// Object.prototype.__proto__ === null

arr.push(4);        // найдено в Array.prototype
arr.hasOwnProperty // найдено в Object.prototype
```

### new под капотом

```js
function Person(name) { this.name = name; }
Person.prototype.greet = function() { return `Hi, ${this.name}`; };

const alice = new Person('Alice');
// 1. Создаётся {}
// 2. {}.__proto__ = Person.prototype
// 3. Person.call({}, 'Alice') → {name: 'Alice'}
// 4. Возвращается объект
```

### class — синтаксический сахар

```js
class Animal {
  constructor(name) { this.name = name; }
  speak() { return this.name; }
  static create(name) { return new Animal(name); }
}

class Dog extends Animal {
  speak() { return `${super.speak()} barks`; }
}
// Под капотом: функции + прототипы + Object.setPrototypeOf
```

---

## DOM События

### Модель событий браузера

Когда происходит событие (клик, ввод, etc.) — браузер проходит три фазы:

```
1. Capturing phase (погружение) — от window вниз до target
2. Target phase    — сам целевой элемент
3. Bubbling phase  (всплытие)  — от target вверх до window
```

```html
<div id="outer">
  <div id="inner">
    <button id="btn">Click</button>
  </div>
</div>
```

```js
// addEventListener(type, handler, useCapture)
// useCapture = false (по умолчанию) — bubbling фаза
// useCapture = true  — capturing фаза

document.getElementById('outer').addEventListener('click', () => {
  console.log('outer bubbling');
}, false);

document.getElementById('inner').addEventListener('click', () => {
  console.log('inner bubbling');
}, false);

document.getElementById('btn').addEventListener('click', () => {
  console.log('btn');
}, false);

// При клике на кнопку: btn → inner bubbling → outer bubbling
```

### event.target vs event.currentTarget

```js
document.getElementById('outer').addEventListener('click', (e) => {
  console.log(e.target);        // элемент, на котором кликнули (кнопка)
  console.log(e.currentTarget); // элемент, к которому привязан handler (outer)
});
```

### stopPropagation / stopImmediatePropagation

```js
btn.addEventListener('click', (e) => {
  e.stopPropagation(); // остановить всплытие — outer не получит событие
});

// stopImmediatePropagation — остановить всплытие И другие handlers на том же элементе
btn.addEventListener('click', (e) => {
  e.stopImmediatePropagation();
});
btn.addEventListener('click', () => {
  console.log('Это не выполнится');
});
```

### preventDefault

```js
// Отменяет действие браузера по умолчанию (не всплытие!)
link.addEventListener('click', (e) => {
  e.preventDefault(); // браузер не перейдёт по ссылке
});

form.addEventListener('submit', (e) => {
  e.preventDefault(); // форма не отправится на сервер
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') e.preventDefault(); // не отправить форму по Enter
});

// Проверить что действие отменено:
if (e.defaultPrevented) { /* ... */ }
```

---

### Event Delegation (делегирование событий)

**Идея:** вместо обработчика на каждом элементе — один обработчик на родителе. Использует всплытие.

```js
// ПЛОХО — 1000 listeners для 1000 пунктов списка
document.querySelectorAll('.list-item').forEach(item => {
  item.addEventListener('click', handleItemClick);
});

// ХОРОШО — один listener на родителе
document.getElementById('list').addEventListener('click', (e) => {
  const item = e.target.closest('.list-item'); // ищем ближайшего предка
  if (!item) return; // кликнули не на элемент списка

  const id = item.dataset.id;
  handleItemClick(id);
});
```

```js
// closest() — ищет ближайшего предка (включая сам элемент), совпадающего с селектором
// Незаменим при делегировании — кликнуть можно на потомка внутри .list-item

// Пример с динамически добавляемыми элементами:
const ul = document.querySelector('ul');

ul.addEventListener('click', (e) => {
  if (e.target.matches('li')) {
    e.target.classList.toggle('selected');
  }
});

// Теперь работает даже для li, которые добавятся ПОСЛЕ установки listener!
ul.innerHTML += '<li>Новый элемент</li>'; // обрабатывается автоматически
```

---

### Создание и диспетчеризация событий

```js
// Встроенные события:
const clickEvent = new MouseEvent('click', {
  bubbles: true,
  cancelable: true,
  clientX: 100,
  clientY: 200,
});
element.dispatchEvent(clickEvent);

// Кастомные события:
const customEvent = new CustomEvent('user:login', {
  bubbles: true,
  cancelable: true,
  detail: { userId: 42, name: 'Alice' }, // передаём данные
});
document.dispatchEvent(customEvent);

// Подписка:
document.addEventListener('user:login', (e) => {
  console.log(e.detail.name); // Alice
});

// Паттерн: pub/sub через кастомные события (без сторонних библиотек)
class EventBus {
  emit(event, detail) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }
  on(event, handler) {
    window.addEventListener(event, e => handler(e.detail));
    return () => window.removeEventListener(event, handler); // unsubscribe
  }
}
```

---

### Типы событий — шпаргалка

```js
// Мышь:
element.addEventListener('click', handler);      // клик (mousedown + mouseup)
element.addEventListener('dblclick', handler);   // двойной клик
element.addEventListener('mousedown', handler);  // кнопка мыши нажата
element.addEventListener('mouseup', handler);    // кнопка отпущена
element.addEventListener('mousemove', handler);  // движение мыши
element.addEventListener('mouseenter', handler); // курсор вошёл (не всплывает!)
element.addEventListener('mouseleave', handler); // курсор вышел (не всплывает!)
element.addEventListener('mouseover', handler);  // вошёл (всплывает — от потомков тоже)
element.addEventListener('mouseout', handler);   // вышел (всплывает)
element.addEventListener('contextmenu', handler); // правый клик

// mouseenter vs mouseover:
// mouseenter — срабатывает только при входе на сам элемент
// mouseover  — срабатывает ещё и при входе на любой потомок (всплывает)

// Клавиатура:
element.addEventListener('keydown', (e) => {
  console.log(e.key);       // 'Enter', 'a', 'ArrowUp', 'Shift'
  console.log(e.code);      // 'KeyA', 'Enter', 'Space' — физическая клавиша
  console.log(e.ctrlKey);   // true если зажат Ctrl
  console.log(e.shiftKey);  // true если зажат Shift
  console.log(e.altKey);    // true если зажат Alt
  console.log(e.metaKey);   // true если зажат Cmd/Win
  
  // Комбо:
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault(); // Ctrl+S
    saveDocument();
  }
});
element.addEventListener('keyup', handler);
element.addEventListener('keypress', handler); // устаревший, не использовать

// e.key vs e.code:
// 'a' нажата: key='a', code='KeyA'
// Shift+'a':  key='A', code='KeyA'
// Стрелки:    key='ArrowUp', code='ArrowUp'
// Пробел:     key=' ', code='Space'

// Фокус (не всплывают!):
element.addEventListener('focus', handler);
element.addEventListener('blur', handler);
// Всплывающие аналоги:
element.addEventListener('focusin', handler);
element.addEventListener('focusout', handler);

// Input / Change:
input.addEventListener('input', handler);  // каждый символ, любой тип изменения
input.addEventListener('change', handler); // после потери фокуса (для select/checkbox — сразу)
input.addEventListener('paste', handler);  // вставка

// Форма:
form.addEventListener('submit', handler);
form.addEventListener('reset', handler);

// Drag & Drop:
element.addEventListener('dragstart', handler);
element.addEventListener('drag', handler);
element.addEventListener('dragend', handler);
dropzone.addEventListener('dragenter', handler);
dropzone.addEventListener('dragleave', handler);
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault(); // ОБЯЗАТЕЛЬНО для разрешения drop!
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  const text = e.dataTransfer.getData('text/plain');
});

// Touch (мобильный):
element.addEventListener('touchstart', handler);
element.addEventListener('touchmove', handler);
element.addEventListener('touchend', handler);
element.addEventListener('touchcancel', handler);

// Pointer Events (унифицированные — мышь + touch + стилус):
element.addEventListener('pointerdown', handler);
element.addEventListener('pointermove', handler);
element.addEventListener('pointerup', handler);
element.addEventListener('pointercancel', handler);

// Scroll:
window.addEventListener('scroll', handler);
element.addEventListener('scroll', handler);
// Passive listeners для scroll — улучшает производительность:
window.addEventListener('scroll', handler, { passive: true });
// passive: true означает что мы НЕ будем вызывать preventDefault()
// Браузер может начать скролл немедленно, не ожидая завершения handler

// Resize:
window.addEventListener('resize', handler);

// Страница/документ:
document.addEventListener('DOMContentLoaded', handler); // DOM готов (без картинок)
window.addEventListener('load', handler);               // всё загружено (с картинками)
window.addEventListener('beforeunload', (e) => {        // попытка закрыть вкладку
  e.preventDefault();
  e.returnValue = ''; // показать диалог подтверждения
});
window.addEventListener('unload', handler);             // страница закрывается
window.addEventListener('visibilitychange', () => {     // вкладка скрыта/показана
  if (document.hidden) pauseVideo();
  else playVideo();
});

// Online/Offline:
window.addEventListener('online', () => syncData());
window.addEventListener('offline', () => showOfflineBanner());

// Clipboard:
document.addEventListener('copy', (e) => {
  e.clipboardData.setData('text/plain', 'Перехваченный текст');
  e.preventDefault();
});
document.addEventListener('paste', (e) => {
  const text = e.clipboardData.getData('text/plain');
});
```

---

### Управление подписками

```js
// addEventListener options:
element.addEventListener('click', handler, {
  capture: true,  // capturing фаза
  once: true,     // сработает один раз и автоматически удалится
  passive: true,  // не будет вызван preventDefault() (оптимизация scroll/touch)
  signal: controller.signal, // AbortController для отмены
});

// Удаление listener — функция должна быть та же самая ссылка!
const handler = () => console.log('clicked');
element.addEventListener('click', handler);
element.removeEventListener('click', handler); // ✅

// НЕПРАВИЛЬНО — анонимная функция, нельзя удалить:
element.addEventListener('click', () => console.log('clicked'));
element.removeEventListener('click', () => console.log('clicked')); // ❌ не сработает

// AbortController — удалить несколько listeners разом:
const controller = new AbortController();
const { signal } = controller;

element.addEventListener('click', handler1, { signal });
element.addEventListener('mousemove', handler2, { signal });
window.addEventListener('resize', handler3, { signal });

// Отписаться от всех трёх разом:
controller.abort();

// Паттерн в React-like компонентах:
function mount(element) {
  const controller = new AbortController();
  const { signal } = controller;

  element.addEventListener('click', onClick, { signal });
  element.addEventListener('focus', onFocus, { signal });

  return () => controller.abort(); // cleanup функция
}
```

---

### Производительность событий

```js
// 1. Debounce для resize/scroll/input:
window.addEventListener('resize', debounce(handleResize, 150));

// 2. Throttle для mousemove/scroll:
window.addEventListener('scroll', throttle(updateScroll, 16)); // ~60fps

// 3. Passive listeners для scroll/touch (ВАЖНО для мобильного):
window.addEventListener('touchstart', handler, { passive: true });
window.addEventListener('wheel', handler, { passive: true });

// 4. Delegation вместо множества listeners (см. выше)

// 5. Очищать listeners при unmount (утечки памяти!):
function Component() {
  useEffect(() => {
    const handler = () => { /* ... */ };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler); // cleanup!
  }, []);
}

// 6. requestAnimationFrame для обработки scroll/resize:
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      updatePosition();
      ticking = false;
    });
    ticking = true;
  }
});
```

---

### Порядок обработки событий — примеры для собеседования

```js
// Вопрос: в каком порядке сработают handlers?
<div id="a">
  <div id="b">
    <div id="c">click me</div>
  </div>
</div>

a.addEventListener('click', () => console.log('a bubble'), false);
b.addEventListener('click', () => console.log('b bubble'), false);
c.addEventListener('click', () => console.log('c bubble'), false);
a.addEventListener('click', () => console.log('a capture'), true);
b.addEventListener('click', () => console.log('b capture'), true);
c.addEventListener('click', () => console.log('c capture'), true);

// При клике на c:
// a capture → b capture → c capture → c bubble → b bubble → a bubble
// (capturing сверху вниз, потом bubbling снизу вверх)
// На target-элементе (c) — порядок определяется порядком вызова addEventListener

// stopPropagation на b capture:
b.addEventListener('click', (e) => {
  console.log('b capture — стоп!');
  e.stopPropagation();
}, true);
// Результат: a capture → b capture — стоп!
// Дальше ничего не дойдёт
```

---

# REACT CORE

---

## Virtual DOM

### Что такое Virtual DOM

Virtual DOM — **JS-объект**, лёгкое представление реального DOM.

```js
{
  type: 'div',
  props: { className: 'card', onClick: fn },
  children: [
    { type: 'h1', props: {}, children: ['Hello'] },
    { type: 'p', props: {}, children: ['World'] }
  ]
}
```

### Что происходит при ре-рендере

```
1. React вызывает функцию компонента → получает новый JSX
2. JSX → новое VDOM дерево
3. Diff нового vs старого VDOM (Reconciliation)
4. Вычисляет минимальный набор изменений
5. Применяет только эти изменения к реальному DOM
```

VDOM — не магия скорости. Его ценность — в **предсказуемости и разработческом опыте**: ты описываешь что должно быть, React разбирается как.

---

## Reconciliation

### Эвристики O(n) алгоритма

**Эвристика 1 — разные типы = полная замена**
```jsx
// div → span: React УДАЛИТ весь div со всеми потомками
// Counter будет unmount + mount заново (состояние потеряется!)
```

**Эвристика 2 — одинаковые типы = обновление props**
```jsx
// React обновит только изменившиеся атрибуты, не пересоздаст элемент
```

**Эвристика 3 — списки используют key**
```jsx
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>
```

### Fiber — современный движок Reconciliation

```
Render phase  — прерываемая, никаких side effects
               строит "work in progress" Fiber дерево
Commit phase  — синхронная, нельзя прерывать
               применяет изменения к DOM
               вызывает эффекты
```

---

## Keys

```jsx
// С уникальным стабильным key:
items.map(item => <Item key={item.id} data={item} />)

// Почему key={index} — плохо:
// Добавление в начало → React думает все элементы изменились → state сбросится

// Трюк: смена key = принудительный unmount + mount
<Form key={userId} userId={userId} />
// При смене userId → Form пересоздаётся, state сброшен
```

---

## Причины ре-рендера

**1. Изменился state компонента** — `setState` вызван
**2. Изменились props (родитель ре-рендерился)** — даже если значение то же!
**3. Изменился context** — любое изменение `Context.value`
**4. forceUpdate** — классовые компоненты

```jsx
// Что НЕ вызывает ре-рендер:
const countRef = useRef(0);
countRef.current = 5; // нет ре-рендера

// Ре-рендер ≠ DOM обновление
// DOM обновляется только если Reconciliation нашёл реальные отличия
```

---

## useEffect / useLayoutEffect

```jsx
useEffect(() => {
  document.title = `Count: ${count}`;
  return () => { document.title = 'App'; }; // cleanup
}, [count]);

useLayoutEffect(() => {
  // Синхронно после DOM мутаций, до paint — без мигания
  const { height } = ref.current.getBoundingClientRect();
  setHeight(height);
}, []);
```

| | useEffect | useLayoutEffect |
|--|-----------|-----------------|
| Timing | После paint | До paint (после DOM мутаций) |
| Блокирует UI | Нет | Да |
| Использовать для | API calls, subscriptions | Измерение DOM, синхронный UI update |

### Порядок выполнения

```
Mount:   Render → DOM update → useLayoutEffect → PAINT → useEffect
Update:  Render → DOM update → useLayoutEffect cleanup → useLayoutEffect → PAINT → useEffect cleanup → useEffect
Unmount: useLayoutEffect cleanup → useEffect cleanup
```

### Частые ошибки

```jsx
// Бесконечный цикл — объект новая ссылка каждый рендер
useEffect(() => {
  fetchData(options);
}, [options]); // options = {} — ❌

// Решение — переместить внутрь:
useEffect(() => {
  const options = { page: 1 };
  fetchData(options);
}, []);
```

---

## Refs

```jsx
// DOM доступ:
const inputRef = useRef(null);
inputRef.current.focus();

// Хранение значений между рендерами (без ре-рендера):
const intervalRef = useRef(null);
intervalRef.current = setInterval(fn, 1000);

// Актуальное значение в замыканиях:
function Component() {
  const [count, setCount] = useState(0);
  const countRef = useRef(count);
  countRef.current = count; // всегда актуальное значение

  useEffect(() => {
    const id = setInterval(() => {
      console.log(countRef.current); // не stale closure
    }, 1000);
    return () => clearInterval(id);
  }, []);
}

// React 19 — forwardRef не нужен:
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```

---

## Fragment

```jsx
// Возврат нескольких элементов без лишнего DOM узла:
function Columns() {
  return (
    <>
      <td>Name</td>
      <td>Age</td>
    </>
  );
}

// Fragment с key (короткий синтаксис не поддерживает key):
items.map(item => (
  <Fragment key={item.id}>
    <dt>{item.term}</dt>
    <dd>{item.description}</dd>
  </Fragment>
))
```

---

## Controlled / Uncontrolled

```jsx
// Controlled — state в React, DOM отражает его
function ControlledInput() {
  const [value, setValue] = useState('');
  return (
    <input value={value} onChange={e => setValue(e.target.value)} />
  );
}

// Uncontrolled — state в DOM, читается через ref
function UncontrolledInput() {
  const inputRef = useRef(null);
  const handleSubmit = () => console.log(inputRef.current.value);
  return <input ref={inputRef} defaultValue="initial" />;
}
```

| Controlled | Uncontrolled |
|-----------|--------------|
| Динамическая валидация | Простые формы |
| Зависимые поля | File inputs (всегда uncontrolled) |
| Форматирование ввода | Интеграция с non-React кодом |

---

## useState

### Как работает под капотом

React хранит state в Fiber узле как **связный список** (один слот на каждый хук). Именно поэтому нельзя вызывать хуки условно — порядок должен быть одинаковым.

### State — snapshot

```jsx
const [count, setCount] = useState(0);

const handleClick = () => {
  setCount(count + 1); // count = 0
  setCount(count + 1); // count = 0 (snapshot!)
  setCount(count + 1); // count = 0
  // Итого: count = 1
};

// Правильно — функциональный update:
const handleClick = () => {
  setCount(c => c + 1); // c — из очереди
  setCount(c => c + 1);
  setCount(c => c + 1);
  // Итого: count = 3
};
```

### Batching в React 18

```jsx
// React 18 — автобатчинг везде включая setTimeout, Promise
setTimeout(() => {
  setA(1); // не рендерит
  setB(2); // один ре-рендер после обоих
});

// Отключить:
import { flushSync } from 'react-dom';
flushSync(() => setA(1)); // немедленный ре-рендер
```

---

## useMemo / useCallback

```jsx
// useMemo — мемоизация вычислений
const sortedItems = useMemo(
  () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// useCallback — стабильная ссылка на функцию
const handleSubmit = useCallback((data) => {
  submitForm(data);
}, [submitForm]);

// Зачем стабильная ссылка:
const Child = React.memo(({ onClick }) => <button onClick={onClick}>Click</button>);

function Parent() {
  const handleClick = useCallback(() => { /* ... */ }, []);
  return <Child onClick={handleClick} />;
  // Child не ре-рендерится когда Parent ре-рендерится по другой причине
}

// Когда НЕ нужны:
const doubled = useMemo(() => count * 2, [count]); // ИЗБЫТОЧНО — дешёвое вычисление
```

---

## React.memo

```jsx
const ExpensiveList = React.memo(({ items, onSelect }) => {
  return items.map(item => <Item key={item.id} data={item} onSelect={onSelect} />);
});

// Shallow compare:
// Примитивы — по значению ✅
// Объекты/функции — по ссылке → новая ссылка каждый рендер → memo не помогает ❌

// Кастомное сравнение:
const User = React.memo(
  ({ user }) => <div>{user.name}</div>,
  (prev, next) => prev.user.id === next.user.id
);
```

---

## Полный цикл ре-рендера

```
1. Trigger         — setState, dispatch, context change
2. Render phase    — React вызывает функцию компонента → JSX
                     создаёт новое Fiber дерево ("work in progress")
3. Reconciliation  — diff старого и нового Fiber
                     помечает узлы: Update / Placement / Deletion
4. Commit phase:
   a. Before mutation — getSnapshotBeforeUpdate (классовые)
   b. Mutation        — применяет изменения к реальному DOM
   c. Layout          — вызывает useLayoutEffect (синхронно)
5. Paint           — браузер рисует изменения
6. Passive effects — вызывает useEffect (асинхронно, после paint)
```

---

## Debounce / Throttle

### Debounce — выполнить после паузы

```js
function debounce(fn, delay) {
  let timerId;
  return function(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

const search = debounce((query) => fetchResults(query), 300);
// Используется: поиск при вводе, resize handler, автосохранение
```

### Throttle — не чаще чем раз в N мс

```js
function throttle(fn, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

const onScroll = throttle(() => updateScrollPosition(), 100);
// Используется: scroll, mousemove, rate limiting
```

### useDebounce хук

```ts
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) fetchResults(debouncedQuery);
  }, [debouncedQuery]);

  return <input value={query} onChange={e => setQuery(e.target.value)} />;
}
```

---

# TYPESCRIPT

---

## Generics

### Зачем Generics

```ts
// Без generics — теряем типы
function identity(arg: any): any { return arg; }

// С generics — сохраняем тип
function identity<T>(arg: T): T { return arg; }

const num = identity(42);     // T = number
const str = identity('hello'); // T = string
```

### Generic компоненты и функции

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }

interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map((item, i) => <li key={i}>{renderItem(item)}</li>)}</ul>;
}
```

### Constraints (ограничения)

```ts
function getLength<T extends { length: number }>(arg: T): number {
  return arg.length;
}

getLength('hello');  // 5
getLength([1, 2, 3]); // 3
getLength(42);        // ❌ Error: number не имеет length

// Default type parameter:
function createArray<T = string>(length: number): T[] {
  return new Array(length);
}
```

### Multiple type parameters

```ts
function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  return arr1.map((item, i) => [item, arr2[i]]);
}

const result = zip([1, 2], ['a', 'b']); // [number, string][]
```

---

## Utility Types

```ts
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// Partial — все поля необязательные
type UpdateUser = Partial<User>;
// { id?: number; name?: string; ... }

// Required — все поля обязательные
type FullUser = Required<Partial<User>>;

// Pick — выбрать поля
type UserPreview = Pick<User, 'id' | 'name'>;

// Omit — исключить поля
type CreateUser = Omit<User, 'id'>;

// Record — словарь
type RoleMap = Record<string, User[]>;

// Readonly — запрет изменений
type ImmutableUser = Readonly<User>;

// ReturnType — тип возвращаемого значения
function createUser(): User { /* ... */ return {} as User; }
type UserType = ReturnType<typeof createUser>; // User

// Parameters — типы аргументов
type CreateParams = Parameters<typeof createUser>; // []

// NonNullable — убирает null и undefined
type SafeId = NonNullable<number | null | undefined>; // number

// Awaited — разворачивает тип Promise
type Result = Awaited<Promise<string>>; // string

// ConstructorParameters — параметры конструктора
class Service { constructor(url: string, timeout: number) {} }
type ServiceArgs = ConstructorParameters<typeof Service>; // [string, number]
```

---

## extends / infer

### Conditional Types

```ts
// T extends U ? TypeIfTrue : TypeIfFalse
type IsString<T> = T extends string ? true : false;

type A = IsString<string>; // true
type B = IsString<number>; // false

// Дистрибутивность — работает поэлементно с union:
type ToArray<T> = T extends any ? T[] : never;
type StrOrNumArr = ToArray<string | number>; // string[] | number[]

// Отключить дистрибутивность — обернуть в tuple:
type NoDistribute<T> = [T] extends [any] ? T[] : never;
type Result = NoDistribute<string | number>; // (string | number)[]
```

### infer — вывод типа внутри conditional

```ts
// Вытащить тип элемента массива
type ArrayElement<T> = T extends (infer U)[] ? U : never;
type Nums = ArrayElement<number[]>; // number

// Вытащить тип промиса
type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
type Str = UnwrapPromise<Promise<string>>; // string

// Вытащить возвращаемый тип функции (как ReturnType)
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// Вытащить параметры функции
type FirstParam<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;
type N = FirstParam<(x: number, y: string) => void>; // number

// Рекурсивный infer:
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

---

## keyof / typeof

```ts
interface User { id: number; name: string; age: number; }

// keyof — union тип всех ключей
type UserKeys = keyof User; // 'id' | 'name' | 'age'

// Безопасный доступ к полям объекта
function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]; // T[K] — именно тот тип что под ключом K
}

const name = getField(user, 'name'); // string
const id = getField(user, 'id');     // number

// typeof — получить тип значения в runtime
const config = { host: 'localhost', port: 3000 };
type Config = typeof config; // { host: string; port: number }

// Комбо: keyof typeof
type ConfigKeys = keyof typeof config; // 'host' | 'port'

// Enum через typeof + keyof:
const Direction = { Up: 'UP', Down: 'DOWN', Left: 'LEFT' } as const;
type DirectionKey = keyof typeof Direction; // 'Up' | 'Down' | 'Left'
type DirectionValue = (typeof Direction)[DirectionKey]; // 'UP' | 'DOWN' | 'LEFT'
```

---

## Mapped Types

Позволяют создавать новые типы, трансформируя ключи существующих.

```ts
// Базовый синтаксис:
type Mapped<T> = { [K in keyof T]: ... };

// Readonly — все поля только для чтения
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };

// Partial — все поля необязательные
type MyPartial<T> = { [K in keyof T]?: T[K] };

// Required — убрать optional
type MyRequired<T> = { [K in keyof T]-?: T[K] };

// Убрать readonly:
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Изменить тип всех значений:
type Stringify<T> = { [K in keyof T]: string };

// Фильтрация ключей по типу:
type PickByValue<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K]
};

interface Mixed { id: number; name: string; age: number; active: boolean; }
type OnlyNumbers = PickByValue<Mixed, number>; // { id: number; age: number }

// Переименование ключей через as:
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
};

type UserGetters = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }
```

---

## Template Literal Types

```ts
// Конкатенация строковых типов
type EventName = 'click' | 'focus' | 'blur';
type HandlerName = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'

// Генерация CSS свойств:
type Direction = 'top' | 'right' | 'bottom' | 'left';
type Padding = `padding-${Direction}`;
// 'padding-top' | 'padding-right' | 'padding-bottom' | 'padding-left'

// Typed event emitter:
type Events = {
  userCreated: { id: number; name: string };
  userDeleted: { id: number };
};

type EventHandler<T extends Record<string, any>> = {
  [K in keyof T as `on${Capitalize<string & K>}`]: (payload: T[K]) => void;
};

type Handlers = EventHandler<Events>;
// { onUserCreated: (payload: { id: number; name: string }) => void;
//   onUserDeleted: (payload: { id: number }) => void; }

// Parsing path types (advanced):
type PathValue<T, P extends string> =
  P extends `${infer K}.${infer Rest}`
    ? K extends keyof T ? PathValue<T[K], Rest> : never
    : P extends keyof T ? T[P] : never;

type User = { address: { city: string; zip: number } };
type CityType = PathValue<User, 'address.city'>; // string
```

---

## Discriminated Unions

Тип с общим полем-дискриминантом — позволяет TypeScript сужать тип.

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rectangle'; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':    return Math.PI * shape.radius ** 2;
    case 'square':    return shape.side ** 2;
    case 'rectangle': return shape.width * shape.height;
  }
}

// Exhaustiveness checking:
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${x}`);
}

function describe(shape: Shape): string {
  switch (shape.kind) {
    case 'circle':    return `Circle r=${shape.radius}`;
    case 'square':    return `Square ${shape.side}`;
    case 'rectangle': return `Rect ${shape.width}x${shape.height}`;
    default: return assertNever(shape); // TS ошибка если забыть кейс
  }
}

// Result type — паттерн из Rust:
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: 'Division by zero' };
  return { ok: true, value: a / b };
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value); // number — TS знает тип
} else {
  console.log(result.error); // string
}
```

---

## Type Guards

### Встроенные narrowing

```ts
// typeof
function process(x: string | number) {
  if (typeof x === 'string') {
    x.toUpperCase(); // x: string
  } else {
    x.toFixed(2); // x: number
  }
}

// instanceof
function handle(error: unknown) {
  if (error instanceof TypeError) {
    error.message; // TypeError
  }
}

// in operator
type Dog = { bark(): void };
type Cat = { meow(): void };
function makeSound(pet: Dog | Cat) {
  if ('bark' in pet) {
    pet.bark(); // Dog
  } else {
    pet.meow(); // Cat
  }
}
```

### Custom Type Guards (type predicates)

```ts
// Функция возвращает `arg is Type` вместо boolean
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}

const data: unknown = fetchData();
if (isUser(data)) {
  console.log(data.name); // TS знает что это User
}

// Assertion function:
function assertIsString(val: unknown): asserts val is string {
  if (typeof val !== 'string') throw new TypeError('Not a string');
}

assertIsString(value);
value.toUpperCase(); // TS знает что string после assertion
```

---

## Branded Types

Создание номинальных типов — когда нужно различать одинаковые структурно типы.

```ts
// Проблема: UserId и OrderId — оба number, но не взаимозаменяемы
type UserId = number;
type OrderId = number;

function getUser(id: UserId) { /* ... */ }
const orderId: OrderId = 42;
getUser(orderId); // ❌ TypeScript не поймает ошибку!

// Решение — брендированные типы:
type Brand<T, B> = T & { readonly _brand: B };
type UserId = Brand<number, 'UserId'>;
type OrderId = Brand<number, 'OrderId'>;

function createUserId(id: number): UserId {
  return id as UserId;
}

function getUser(id: UserId) { /* ... */ }

const orderId = 42 as OrderId;
getUser(orderId); // ✅ Error: 'OrderId' is not assignable to 'UserId'

// Практический пример — валидированный email:
type ValidatedEmail = Brand<string, 'ValidatedEmail'>;

function validateEmail(email: string): ValidatedEmail | null {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email as ValidatedEmail;
  }
  return null;
}

function sendEmail(to: ValidatedEmail, subject: string) { /* ... */ }

const raw = 'user@example.com';
sendEmail(raw, 'Hello'); // ❌ Error: string не ValidatedEmail

const validated = validateEmail(raw);
if (validated) {
  sendEmail(validated, 'Hello'); // ✅ OK
}
```

---

## const assertions

```ts
// Без as const — широкий тип
const config = { host: 'localhost', port: 3000 };
// { host: string; port: number }

// С as const — точные литеральные типы, readonly
const config = { host: 'localhost', port: 3000 } as const;
// { readonly host: 'localhost'; readonly port: 3000 }

// Union из значений объекта:
const Status = { Active: 'active', Inactive: 'inactive', Pending: 'pending' } as const;
type StatusValue = (typeof Status)[keyof typeof Status]; // 'active' | 'inactive' | 'pending'

// Tuple вместо массива:
function route(path: string, methods: readonly string[]) { /* ... */ }

const GET_POST = ['GET', 'POST'] as const; // readonly ['GET', 'POST']
route('/api', GET_POST);

// satisfies оператор (TS 4.9+) — проверяет тип, сохраняет точный:
const palette = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Record<string, string | number[]>;

palette.red.map(x => x); // ✅ number[] — точный тип сохранён
palette.green.toUpperCase(); // ✅ string — точный тип сохранён
```

---

## tsconfig

```json
{
  "compilerOptions": {
    "strict": true,           // включает все strict проверки
    "noImplicitAny": true,    // нельзя использовать implicit any
    "strictNullChecks": true, // null/undefined — отдельные типы
    "strictFunctionTypes": true, // контравариантная проверка параметров
    "noUncheckedIndexedAccess": true, // T[i] → T | undefined

    "module": "ESNext",
    "moduleResolution": "bundler", // для Vite/webpack
    "esModuleInterop": true,       // import React from 'react'

    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },

    "target": "ES2020",
    "jsx": "react-jsx",
    "outDir": "./dist",

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true // ?prop ≠ prop: T | undefined
  }
}
```

---

# BROWSER / WEB

---

## Как работает браузер

### Многопроцессная архитектура (Chrome)

- **Browser process** — UI браузера, управление вкладками
- **Renderer process** — один на вкладку, там живёт V8 + Blink (HTML/CSS)
- **GPU process** — отрисовка
- **Network process** — сетевые запросы

### Путь от URL до пикселей

```
1. DNS lookup — IP адрес домена
2. TCP handshake (+ TLS для HTTPS)
3. HTTP запрос → ответ (HTML)
4. Parsing HTML → DOM tree
5. Parsing CSS → CSSOM tree
6. DOM + CSSOM → Render Tree (только видимые элементы)
7. Layout (Reflow) — вычисление позиций и размеров
8. Paint — создание списков отрисовки
9. Composite — GPU склеивает слои → пиксели на экране
```

### V8 — как работает JS движок

```
JS код → Parser → AST (Abstract Syntax Tree)
                → Ignition (интерпретатор) → bytecode
                → TurboFan (JIT компилятор) → машинный код
```

**JIT компиляция** — V8 профилирует "горячий" код (часто вызываемый) и компилирует его в машинный код для скорости.

---

## Browser APIs

```js
// IntersectionObserver — элемент попал в viewport
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) console.log('visible!');
  });
}, { threshold: 0.5, rootMargin: '200px' });
observer.observe(element);

// ResizeObserver — изменение размера элемента
const ro = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
});

// MutationObserver — изменения в DOM
const mo = new MutationObserver(mutations => {
  mutations.forEach(m => console.log(m.type));
});
mo.observe(document.body, { childList: true, subtree: true });

// requestAnimationFrame — анимации
function animate() {
  requestAnimationFrame(animate); // ~60fps
}
requestAnimationFrame(animate);

// requestIdleCallback — задачи в свободное время браузера
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length) {
    processTask(tasks.shift());
  }
});
```

---

## Storage

| | localStorage | sessionStorage | Cookie | IndexedDB |
|--|------------|----------------|--------|-----------|
| Объём | ~5MB | ~5MB | ~4KB | Сотни MB |
| Срок | Бессрочно | До закрытия вкладки | Настраиваемый | Бессрочно |
| Сервер | Нет | Нет | Да (в headers) | Нет |
| Async | Нет | Нет | Нет | Да |

```js
localStorage.setItem('key', JSON.stringify(value));
const val = JSON.parse(localStorage.getItem('key') ?? 'null');

// Кастомный хук для localStorage:
function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  const set = useCallback((newValue: T) => {
    setValue(newValue);
    localStorage.setItem(key, JSON.stringify(newValue));
  }, [key]);

  return [value, set] as const;
}
```

---

## CORS

```
Cross-Origin Resource Sharing — механизм блокировки запросов к другому origin.

https://app.com → https://api.app.com   ← разный домен → CORS
https://app.com → https://app.com/api  ← тот же origin → OK
http://app.com  → https://app.com      ← разный протокол → CORS

Simple request (GET/POST с простыми headers):
  Браузер → Сервер (Origin: https://app.com)
  Сервер → Браузер (Access-Control-Allow-Origin: *)

Preflight (PUT/DELETE/custom headers):
  Браузер → OPTIONS /api → Сервер
  Сервер → 200 OK (Allow-Methods, Allow-Headers)
  Браузер → Реальный запрос
```

**Заголовки сервера:**
```
Access-Control-Allow-Origin: https://app.com
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true  // для cookies
Access-Control-Max-Age: 86400           // кешировать preflight
```

---

## HTTP / HTTPS

```
GET    — получить ресурс (idempotent, безопасный)
POST   — создать ресурс
PUT    — заменить ресурс полностью (idempotent)
PATCH  — частично обновить
DELETE — удалить (idempotent)
OPTIONS — описание доступных методов (preflight)

2xx — Успех:   200 OK, 201 Created, 204 No Content
3xx — Редирект: 301 Moved Permanently, 304 Not Modified
4xx — Ошибка клиента: 400 Bad Request, 401 Unauthorized,
                       403 Forbidden, 404 Not Found, 429 Too Many Requests
5xx — Ошибка сервера: 500 Internal Server Error, 503 Service Unavailable
```

| | HTTP/1.1 | HTTP/2 |
|--|----------|--------|
| Мультиплексирование | Нет (6 параллельных) | Да (неограниченно) |
| Сжатие заголовков | Нет | HPACK |
| Server Push | Нет | Да |
| Формат | Текстовый | Бинарный |

---

## Cookies

```js
document.cookie = 'name=Alice; max-age=3600; path=/; SameSite=Strict; Secure';

// HttpOnly  — недоступен из JS (защита от XSS)
// Secure    — только HTTPS
// SameSite  — Strict/Lax/None (защита от CSRF)
// Max-Age   — время жизни в секундах

// SameSite:
// Strict — только same-site (не отправится по внешней ссылке)
// Lax    — при top-level navigation, но не при POST с других сайтов
// None   — всегда (требует Secure)
```

---

## fetch

```js
const response = await fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Alice' }),
  credentials: 'include',
  signal: AbortController.signal
});

if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();

// Отмена запроса:
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const res = await fetch('/api/slow', { signal: controller.signal });
} catch (e) {
  if (e.name === 'AbortError') console.log('Request cancelled');
}
```

---

## Layout / Reflow / Repaint

### Три стадии рендеринга

**Layout (Reflow)** — вычисление геометрии (размер, позиция).
- Дорогая, может затронуть весь документ
- Триггеры: `width/height/margin/padding/font-size`, добавление/удаление элементов

**Paint (Repaint)** — заполнение пикселей (цвет, тень, border-radius).
- Дешевле layout

**Composite** — склейка слоёв на GPU.
- Самая дешёвая: только `transform` и `opacity`

### Layout Thrashing

```js
// ПЛОХО — read/write/read/write → reflow на каждой итерации
elements.forEach(el => {
  const h = el.offsetHeight; // READ  → браузер делает reflow
  el.style.height = h + 'px'; // WRITE → инвалидирует layout
});

// ХОРОШО — batch reads, then batch writes
const heights = elements.map(el => el.offsetHeight);
elements.forEach((el, i) => el.style.height = heights[i] + 'px');

// Свойства, форсирующие reflow при чтении:
// offsetTop/Left/Width/Height, scrollTop/Left/Width/Height
// clientTop/Left/Width/Height, getBoundingClientRect(), getComputedStyle()
```

### will-change

```css
.animated {
  will-change: transform; /* создаёт отдельный compositor layer */
  /* transform/opacity меняются без reflow и repaint */
}
/* Не злоупотреблять — каждый слой потребляет GPU память */
```

---

# REACT ADVANCED

---

## Redux vs Context

| | Context | Redux |
|--|---------|-------|
| Для | Статичные/редко меняющиеся данные | Часто обновляемые данные |
| Производительность | Ре-рендерит всех потребителей | Только нужные подписчики |
| DevTools | Нет | Да (time-travel, action log) |
| Middleware | Нет | Да (thunk, saga, logger) |

```jsx
// Проблема Context — лишние ре-рендеры:
// При любом изменении value — ВСЕ потребители ре-рендерятся

// Решение — разделить контексты:
<ThemeContext.Provider value={theme}>
  <UserContext.Provider value={{ user, setUser }}>
    ...
  </UserContext.Provider>
</ThemeContext.Provider>
```

---

## RTK / RTK Query

```ts
// createSlice — объединяет actions + reducer
const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1; }, // Immer под капотом
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
  },
});

// RTK Query
const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getUser: builder.query<User, string>({
      query: (id) => `/users/${id}`,
    }),
    updateUser: builder.mutation<User, Partial<User>>({
      query: (user) => ({ url: `/users/${user.id}`, method: 'PATCH', body: user }),
    }),
  }),
});

export const { useGetUserQuery, useUpdateUserMutation } = api;

function UserProfile({ id }) {
  const { data, isLoading, error } = useGetUserQuery(id);
  // Кеширование, дедупликация, автоматическая инвалидация — из коробки
}
```

---

## React Query

```ts
function Posts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['posts'],
    queryFn: () => fetchPosts(),
    staleTime: 60_000,  // свежие 1 мин
    gcTime: 300_000,    // хранить в кеше 5 мин
  });
}

function CreatePost() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (post) => createPost(post),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  return <button onClick={() => mutation.mutate({ title: 'New' })}>Create</button>;
}
```

| | React Query | RTK Query |
|--|------------|-----------|
| Интеграция | Любой стейт менеджер | Redux |
| Бойлерплейт | Меньше | Больше |
| Offline support | Встроен | Нет |

---

## Redux Thunk

```ts
// createAsyncThunk — стандартный способ:
const fetchUser = createAsyncThunk('users/fetch', async (id: string) => {
  const response = await api.getUser(id);
  return response.data; // → action.payload
});

// В slice:
extraReducers: (builder) => {
  builder
    .addCase(fetchUser.pending, (state) => { state.loading = true; })
    .addCase(fetchUser.fulfilled, (state, action) => {
      state.user = action.payload;
      state.loading = false;
    })
    .addCase(fetchUser.rejected, (state, action) => {
      state.error = action.error.message;
      state.loading = false;
    });
}
```

---

## Forms

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 chars'),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(async (data) => { await loginUser(data); })}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      <button type="submit" disabled={isSubmitting}>Login</button>
    </form>
  );
}

// RHF быстрее controlled форм: uncontrolled inputs под капотом
// нет ре-рендера при каждом нажатии клавиши
```

---

## Virtualization

```jsx
// Рендерим только видимые элементы в viewport
import { FixedSizeList } from 'react-window';

function VirtualList({ items }) {
  return (
    <FixedSizeList
      height={500}
      width="100%"
      itemCount={items.length}
      itemSize={60}
      overscanCount={3}
    >
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  );
}
// Библиотеки: react-window (легче), @tanstack/virtual
```

---

## Lazy Loading

```jsx
// React.lazy + Suspense — загрузка по требованию
const HeavyChart = React.lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyChart />
    </Suspense>
  );
}

// IntersectionObserver — загрузка при скролле
function useLazyLoad(ref) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return isVisible;
}

// Комбо: lazy load JS только когда видно
function LazySection() {
  const ref = useRef(null);
  const isVisible = useLazyLoad(ref);

  return (
    <div ref={ref}>
      {isVisible ? (
        <Suspense fallback={<Spinner />}>
          <HeavyChart />
        </Suspense>
      ) : (
        <Skeleton />
      )}
    </div>
  );
}
```

---

## Performance Metrics

| Метрика | Что | Хорошо | Нужно улучшить |
|---------|-----|--------|---------------|
| **LCP** | Largest Contentful Paint | < 2.5s | > 4s |
| **CLS** | Cumulative Layout Shift | < 0.1 | > 0.25 |
| **INP** | Interaction to Next Paint | < 200ms | > 500ms |
| **FCP** | First Contentful Paint | < 1.8s | > 3s |
| **TTFB** | Time to First Byte | < 800ms | > 1.8s |

**LCP:** preload главного изображения, SSR/SSG, CDN
**CLS:** задавать size для images/videos, не вставлять контент выше существующего
**INP:** code splitting, Web Workers для тяжёлых задач

---

## Lighthouse / DevTools

```
Chrome DevTools → Performance tab:
1. Record → выполнить действие → Stop
2. Main thread timeline — долгие задачи (красные > 50ms)
3. Flame chart — вложенность вызовов
4. Bottom-up / Call tree — самые дорогие функции

React DevTools Profiler:
1. "Highlight updates when components render"
2. Flamegraph — время рендера каждого компонента
3. Ranked chart — самые медленные компоненты
4. "Why did this render?" — причина ре-рендера

Memory tab:
- Heap Snapshot → сравнить снимки
- Allocation Timeline — утечки (растущий граф)
- Detached DOM nodes — элементы удалены из DOM но в памяти
```

---

## React 19

```js
// 1. Actions — упрощение async операций
function UpdateName() {
  const [error, submitAction, isPending] = useActionState(
    async (prevState, formData) => {
      const error = await updateName(formData.get('name'));
      if (error) return error;
      redirect('/profile');
      return null;
    },
    null
  );

  return (
    <form action={submitAction}>
      <input name="name" />
      <button disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </form>
  );
}

// 2. useOptimistic — оптимистичные обновления
function LikeButton({ postId, initialLikes }) {
  const [likes, setOptimisticLikes] = useOptimistic(initialLikes);

  async function handleLike() {
    setOptimisticLikes(l => l + 1); // сразу показываем +1
    await likePost(postId);          // ждём сервер
    // если упадёт — откатится автоматически
  }
}

// 3. use() хук — читает промисы и контекст
function UserProfile({ userPromise }) {
  const user = use(userPromise); // Suspense ждёт промис
  return <div>{user.name}</div>;
}
// use() можно вызывать внутри условий!

// 4. ref как prop — больше не нужен forwardRef:
function MyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// 5. Context без .Provider:
<ThemeContext value="dark">
  <App />
</ThemeContext>

// 6. Server Components — рендерятся на сервере, не входят в JS бандл клиента
```

---

# DESIGN / ARCHITECTURE

---

## SOLID

### S — Single Responsibility
```ts
// ХОРОШО — разделяем ответственности
function useUsers() { /* fetching logic */ }
function UserTable({ users, onDelete }) { /* rendering */ }
function UserDashboard() {
  const { users, deleteUser } = useUsers();
  return <UserTable users={users} onDelete={deleteUser} />;
}
```

### O — Open/Closed
```ts
// ХОРОШО — расширяем через props, не меняем компонент
function Button({ variant = 'primary', size = 'md', ...props }) {
  return <button className={`btn btn-${variant} btn-${size}`} {...props} />;
}
```

### L — Liskov Substitution
```ts
// Дочерний компонент должен работать везде где ожидается базовый
function PhoneInput({ value, onChange, disabled, ...rest }: InputProps) {
  const formatted = formatPhone(value);
  return <Input value={formatted} onChange={onChange} disabled={disabled} />;
}
```

### I — Interface Segregation
```ts
// Маленькие специфичные интерфейсы
interface Renderable { render(): void; }
interface Validatable { validate(): boolean; }
interface DataFetcher { fetchData(): Promise<void>; }
```

### D — Dependency Inversion
```ts
// Зависим от абстракции — можно передать fetch, axios или mock
interface HttpClient { get<T>(url: string): Promise<T>; }

class UserService {
  constructor(private http: HttpClient) {}
  async getUser(id: string) {
    return this.http.get<User>(`/api/users/${id}`);
  }
}
```

---

## Dependency Injection

```ts
class Container {
  private bindings = new Map<string, any>();

  bind<T>(key: string, factory: () => T) {
    this.bindings.set(key, factory);
  }

  get<T>(key: string): T {
    const factory = this.bindings.get(key);
    if (!factory) throw new Error(`No binding for ${key}`);
    return factory();
  }
}

const container = new Container();
container.bind('httpClient', () => new AxiosHttpClient());
container.bind('userService', () => new UserService(container.get('httpClient')));
```

---

## KISS / DRY / YAGNI

**KISS** — Keep It Simple. Простое решение лучше умного.
```ts
const getUserName = (u) => u.name ?? ''; // vs Object.entries.filter...
```

**DRY** — Don't Repeat Yourself.
```ts
const formatDate = (date: Date) => date.toLocaleDateString('ru-RU');
```

**YAGNI** — You Aren't Gonna Need It. Не добавляй то, что не нужно сейчас.

---

## Паттерны

### Strategy
```ts
const strategies: Record<string, SortStrategy> = {
  byName: (a, b) => a.name.localeCompare(b.name),
  byAge:  (a, b) => a.age - b.age,
};
function sortUsers(users: User[], strategy: keyof typeof strategies) {
  return [...users].sort(strategies[strategy]);
}
```

### Observer / EventEmitter
```ts
class EventEmitter<Events extends Record<string, any>> {
  private listeners = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(event: K, cb: (data: Events[K]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.off(event, cb); // unsubscribe
  }

  off<K extends keyof Events>(event: K, cb: Function) {
    this.listeners.get(event)?.delete(cb);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}
```

### Factory
```ts
function createLogger(env: 'production' | 'development' | 'test'): Logger {
  if (env === 'test') return new SilentLogger();
  return new ConsoleLogger();
}
```

### Decorator (HOC в React)
```tsx
function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthWrapper(props: P) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" />;
    return <Component {...props} />;
  };
}
```

---

## HOC vs Hooks

| | HOC | Custom Hook |
|--|-----|-------------|
| Переиспользование | Компонентов | Логики |
| Доступ к JSX | Да | Нет |
| Вложенность | Wrapper hell | Чистый код |
| TypeScript | Сложнее | Проще |

---

## Custom Hooks

```ts
// useFetch — запрос с loading/error/cancel
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// usePrevious
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });
  return ref.current;
}

// useMediaQuery
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

// useClickOutside
function useClickOutside(ref: RefObject<HTMLElement>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
```

---

# CSS / ВЕРСТКА

---

## Box Model

### Что такое box model

Каждый элемент — прямоугольник из 4 зон (снаружи внутрь): `margin → border → padding → content`.

```css
.box {
  width: 200px;      /* ширина content area */
  padding: 20px;     /* внутренний отступ */
  border: 2px solid; /* граница */
  margin: 10px;      /* внешний отступ */
}

/* По умолчанию box-sizing: content-box
   Итоговая ширина = 200 + 20*2 + 2*2 = 244px — неожиданно! */

/* box-sizing: border-box — padding и border ВКЛЮЧЕНЫ в width/height */
*, *::before, *::after {
  box-sizing: border-box; /* глобальный сброс — всегда ставить */
}
/* Теперь итоговая ширина = 200px, как задано */
```

### Margin collapse (схлопывание margin)

```css
/* Вертикальные margin у соседних элементов схлопываются
   в наибольший из них — только вертикально, не горизонтально */

.first  { margin-bottom: 20px; }
.second { margin-top: 30px; }
/* Итоговый отступ между ними: 30px (не 50px!) */

/* Решения для отмены collapse:
   - overflow: hidden на родителе
   - padding/border на родителе
   - display: flex / grid на родителе
   - Использовать только один margin (только bottom или только top) */
```

### Отрицательные margin

```css
/* Отрицательный margin сдвигает элемент в сторону отступа
   и при этом сдвигает следующие элементы */
.overlap { margin-top: -20px; } /* перекрывает предыдущий элемент */
```

---

## Specificity

### Как вычисляется специфичность

```
[inline] [id] [class/attr/pseudo-class] [tag/pseudo-element]
  1000    100         10                      1
```

```css
#nav .item:hover     → (0, 1, 1, 1) = 111
.container > p       → (0, 0, 1, 1) = 011
div p                → (0, 0, 0, 2) = 002
* { }                → (0, 0, 0, 0) = 000

/* :is() — берёт специфичность наиболее специфичного аргумента */
:is(#nav, .item) p   → (1, 0, 0, 1) — из-за #nav

/* :where() — всегда специфичность 0 */
:where(#nav, .item) p → (0, 0, 0, 1)

/* :not() — специфичность аргумента */
p:not(.active)        → (0, 0, 1, 1)

/* !important — переопределяет всё (избегать) */
/* layer @layer — новый способ управления каскадом */
```

---

## Cascade & Inheritance

### Порядок каскада (от низшего к высшему)

```
1. User-agent stylesheet (браузерные стили по умолчанию)
2. @layer объявления (нижние слои)
3. Стили автора без @layer
4. Inline styles
5. !important (в обратном порядке)
```

### @layer — управляемый каскад

```css
/* Слои имеют порядок — последний побеждает при равной специфичности */
@layer base, components, utilities;

@layer base {
  a { color: blue; }
}

@layer utilities {
  .text-red { color: red; } /* переопределит base, даже с меньшей специфичностью */
}
```

### Наследование

```css
/* Наследуемые свойства (автоматически передаются потомкам): */
/* color, font-*, line-height, text-align, visibility, cursor... */

/* НЕ наследуются: */
/* border, margin, padding, background, width, height... */

/* Управление: */
.child {
  color: inherit;  /* явно унаследовать */
  color: initial;  /* значение по умолчанию из UA stylesheet */
  color: unset;    /* inherit если наследуемое, иначе initial */
  color: revert;   /* UA stylesheet value */
}
```

---

## Positioning

### Значения position

```css
/* static — нормальный поток, top/left/z-index не работают */
.default { position: static; }

/* relative — в нормальном потоке + можно смещать через top/left
              создаёт новый containing block для absolute потомков */
.shifted { position: relative; top: 10px; left: 20px; }

/* absolute — выбывает из потока
              позиционируется относительно ближайшего предка
              с position != static (или относительно viewport) */
.modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* fixed — выбывает из потока
           позиционируется относительно viewport
           остаётся на месте при скролле
           НО: transform на предке "ломает" fixed! */
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
}

/* sticky — гибрид relative + fixed
            relative пока не достиг threshold, потом fixed внутри родителя */
.table-header {
  position: sticky;
  top: 0; /* прилипает когда скролл доходит до верха */
}
```

### Containing block

```css
/* Containing block определяет from чего отсчитываются % и absolute */
/* Для absolute — ближайший предок с position != static */
/* Для fixed — viewport (или предок с transform/filter/perspective) */
/* Для % width — содержащий блок по ширине */

.parent {
  position: relative; /* делает себя containing block */
}
.child {
  position: absolute;
  width: 50%;  /* 50% от .parent */
  top: 0;      /* относительно .parent */
}
```

---

## Stacking Context

### Что создаёт новый stacking context

```css
/* Элемент создаёт новый stacking context если: */
- position: relative/absolute/fixed/sticky + z-index != auto
- opacity < 1
- transform, filter, perspective, clip-path != none
- isolation: isolate  /* явно создать stacking context */
- will-change: transform (и другие)
- display: flex/grid + z-index на потомке
```

### z-index работает ТОЛЬКО внутри своего контекста

```html
<!-- Проблема: z-index: 9999 не помогает если родитель имеет z-index: 1 -->
<div style="position: relative; z-index: 1">
  <div style="position: absolute; z-index: 9999">
    <!-- Этот элемент НИКОГДА не будет выше следующего братского элемента -->
  </div>
</div>
<div style="position: relative; z-index: 2">
  <!-- Этот элемент выше, даже без z-index на потомках -->
</div>
```

```css
/* Решение через isolation: isolate — явный stacking context без z-index */
.component {
  isolation: isolate; /* z-index внутри не "вытекут" наружу */
}
```

---

## Flex / Grid

### Flexbox — одномерный layout

```css
.container {
  display: flex;
  flex-direction: row | column | row-reverse | column-reverse;
  justify-content: flex-start | center | space-between | space-around | space-evenly;
  align-items: stretch | center | flex-start | flex-end | baseline;
  align-content: flex-start | center | space-between; /* для многострочного */
  flex-wrap: nowrap | wrap | wrap-reverse;
  gap: 16px;          /* row-gap и column-gap */
  gap: 16px 24px;     /* row-gap col-gap */
}

.item {
  flex: 1;            /* flex-grow: 1, flex-shrink: 1, flex-basis: 0% */
  flex: 0 0 200px;    /* не растёт, не сжимается, ширина 200px */
  flex: 1 1 auto;     /* растёт и сжимается от своего содержимого */
  
  align-self: center; /* переопределяет align-items */
  order: -1;          /* визуальный порядок (не меняет DOM) */
  
  min-width: 0;       /* важно! flex item не может быть уже своего содержимого */
}

/* Центрирование — классика */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

### Grid — двумерный layout

```css
.container {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;    /* 3 колонки */
  grid-template-columns: repeat(3, 1fr); /* то же самое */
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* адаптивный */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); /* + пустые колонки */
  
  grid-template-rows: auto 1fr auto;
  grid-auto-rows: minmax(100px, auto); /* для неявных строк */
  
  gap: 16px 24px; /* row-gap col-gap */
  
  /* Выравнивание всей сетки: */
  justify-content: center;  /* по горизонтали */
  align-content: center;    /* по вертикали */
  
  /* Выравнивание ячеек по умолчанию: */
  justify-items: start;
  align-items: center;
}

.item {
  grid-column: 1 / 3;    /* от линии 1 до линии 3 (занимает 2 колонки) */
  grid-column: span 2;   /* занять 2 колонки */
  grid-column: 1 / -1;   /* от первой до последней */
  grid-row: 2 / 4;
  
  /* Выравнивание конкретной ячейки: */
  justify-self: end;
  align-self: start;
}

/* Grid areas — семантичный layout */
.container {
  grid-template-areas:
    "header header header"
    "sidebar main   main"
    "footer footer  footer";
}
.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; }
.footer  { grid-area: footer; }

/* auto-placement алгоритм — dense для плотного заполнения: */
.masonry { grid-auto-flow: dense; }
```

### Когда Flex, когда Grid

```
Flex:  Компоненты в одном ряду/столбце, nav-bar, кнопки, строки карточек
Grid:  Двумерные layouts, страничная структура, card grids, masonry
```

---

## Responsive Design

### Mobile-first vs Desktop-first

```css
/* Mobile-first — рекомендуется */
.card {
  width: 100%;        /* мобильный по умолчанию */
}

@media (min-width: 768px) {  /* планшет */
  .card { width: 50%; }
}

@media (min-width: 1200px) { /* десктоп */
  .card { width: 33%; }
}

/* Desktop-first */
.card { width: 33%; }
@media (max-width: 1199px) { .card { width: 50%; } }
@media (max-width: 767px)  { .card { width: 100%; } }
```

### Breakpoints

```css
/* Стандартные точки (Tailwind-подобные): */
/* xs: 0-639px (мобильный) */
/* sm: 640px   (большой телефон) */
/* md: 768px   (планшет) */
/* lg: 1024px  (небольшой ноутбук) */
/* xl: 1280px  (десктоп) */
/* 2xl: 1536px (широкий экран) */
```

### Гибкие единицы

```css
/* rem — относительно root font-size (обычно 16px) */
/* Лучше чем px для доступности: уважает настройки шрифта пользователя */
h1 { font-size: 2rem; }  /* 32px */

/* em — относительно font-size родителя */
/* Удобно для компонентов: padding: 1em масштабируется с font-size */
button { padding: 0.5em 1em; }

/* vw/vh — процент от viewport */
.hero { height: 100vh; }
.full-width { width: 100vw; }

/* dvh — dynamic viewport height (учитывает мобильный браузер toolbar) */
.mobile-full { height: 100dvh; }

/* clamp() — fluid typography без media queries */
/* clamp(min, preferred, max) */
h1 { font-size: clamp(1.5rem, 4vw, 3rem); }
.container { width: clamp(300px, 90%, 1200px); }

/* min() и max() */
img { width: min(100%, 600px); }
```

### Container Queries (CSS 2023)

```css
/* Реагировать на размер контейнера, а не viewport */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card { flex-direction: row; }
}

@container (max-width: 300px) {
  .card-title { font-size: 0.875rem; }
}
```

---

## CSS Variables

### Custom Properties

```css
/* Объявление — обычно в :root (глобально) */
:root {
  --color-primary: #3b82f6;
  --color-text: #1f2937;
  --spacing-unit: 8px;
  --border-radius: 4px;
  --font-size-base: 1rem;
  --shadow: 0 1px 3px rgba(0,0,0,0.12);
}

/* Использование с fallback */
.button {
  background-color: var(--color-primary, blue);
  padding: calc(var(--spacing-unit) * 2);
  border-radius: var(--border-radius);
}
```

### Переопределение — темизация

```css
/* Светлая тема по умолчанию */
:root {
  --bg: #ffffff;
  --text: #1f2937;
  --accent: #3b82f6;
}

/* Тёмная тема */
[data-theme="dark"] {
  --bg: #111827;
  --text: #f9fafb;
  --accent: #60a5fa;
}

/* Системная предпочтительная тема */
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111827;
    --text: #f9fafb;
  }
}

body {
  background: var(--bg);
  color: var(--text);
}
```

### CSS Variables + JS

```js
// Читать переменную:
getComputedStyle(document.documentElement)
  .getPropertyValue('--color-primary').trim();

// Установить переменную:
document.documentElement.style.setProperty('--color-primary', '#ef4444');

// На элементе:
element.style.setProperty('--delay', `${index * 100}ms`);
```

### Наследование переменных

```css
/* CSS variables наследуются! */
.parent { --color: red; }
.child  { color: var(--color); } /* red */

/* Можно переопределить на уровне компонента: */
.button-danger { --color-primary: #ef4444; }
/* Все var(--color-primary) внутри .button-danger будут красными */
```

---

## Animations & Transitions

### Transitions — плавные переходы

```css
.button {
  background: blue;
  transform: scale(1);
  /* transition: property duration timing-function delay */
  transition: background 0.2s ease, transform 0.15s ease-out;
}

.button:hover {
  background: darkblue;
  transform: scale(1.05);
}

/* Переходить только нужные свойства — не transition: all!
   all — дорого: браузер проверяет каждое свойство */

/* Timing functions: */
/* ease — медленно-быстро-медленно (по умолчанию) */
/* ease-in — разгон */
/* ease-out — торможение */
/* ease-in-out — разгон и торможение */
/* linear — равномерно */
/* cubic-bezier(x1, y1, x2, y2) — произвольная кривая */
/* steps(4) — пошаговая (для спрайтов) */
```

### Animations — @keyframes

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

.loader {
  animation: spin 1s linear infinite;
}

.modal {
  /* animation: name duration timing delay iteration direction fill-mode */
  animation: fadeIn 0.3s ease-out both;
}

/* forwards — сохранить конечное состояние */
/* backwards — применить начальное состояние сразу */
/* both — оба */

/* Паузировать анимацию: */
.paused { animation-play-state: paused; }
```

### Performance анимаций

```css
/* Анимировать только transform и opacity — только Composite, без reflow/repaint */
/* ХОРОШО: */
.box { transition: transform 0.3s, opacity 0.3s; }

/* ПЛОХО — вызывает reflow на каждом кадре: */
.box { transition: width 0.3s, height 0.3s, top 0.3s; }

/* Для сложных анимаций — создать отдельный layer: */
.animated {
  will-change: transform;
  /* Использовать только если реально нужна оптимизация */
  /* Слишком много will-change — перерасход GPU памяти */
}
```

### Reduced motion — доступность

```css
/* Уважаем настройку пользователя "уменьшить движение" */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## BEM / CSS Modules / CSS-in-JS

### BEM (Block Element Modifier)

```css
/* Block — независимый компонент */
.card { }

/* Element — часть блока, неотделима */
.card__title { }
.card__image { }
.card__footer { }

/* Modifier — состояние или вариация */
.card--featured { }        /* модификатор блока */
.card__title--large { }    /* модификатор элемента */

/* Реальный пример: */
.btn { }
.btn--primary { background: blue; }
.btn--danger { background: red; }
.btn--disabled { opacity: 0.5; }
.btn__icon { margin-right: 4px; }
```

### CSS Modules

```css
/* Button.module.css */
.button { padding: 8px 16px; }
.primary { background: blue; }
.danger { background: red; }
```

```tsx
import styles from './Button.module.css';
import clsx from 'clsx'; // утилита для объединения классов

function Button({ variant = 'primary', disabled, children }) {
  return (
    <button
      className={clsx(
        styles.button,
        styles[variant],
        disabled && styles.disabled
      )}
    >
      {children}
    </button>
  );
}
// Классы автоматически уникальны — нет конфликтов!
// Button.module.css → .Button_button__a1b2c
```

### Tailwind CSS

```tsx
// Utility-first — классы прямо в JSX
function Button({ variant = 'primary' }) {
  const base = 'px-4 py-2 rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    danger:  'bg-red-500 hover:bg-red-600 text-white',
    ghost:   'border border-gray-300 hover:bg-gray-50',
  };
  return <button className={`${base} ${variants[variant]}`}>{children}</button>;
}

// + Нет CSS файлов, автоматическая оптимизация (PurgeCSS)
// - Длинные className строки, нужен prettier-plugin-tailwindcss
```

### CSS-in-JS (styled-components, emotion)

```tsx
import styled from 'styled-components';

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 8px 16px;
  border-radius: 4px;
  background: ${({ variant }) => variant === 'danger' ? 'red' : 'blue'};
  
  &:hover { opacity: 0.9; }
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

// + Динамические стили через props, scoped, co-location
// - Runtime overhead, больший bundle size, проблемы с SSR (без Server Components)
```

---

## Pixel Perfect

### Типичные проблемы и решения

```css
/* 1. Сброс: */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }

/* 2. Субпиксельный рендеринг шрифтов */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 3. Прыжок layout при появлении скроллбара */
html { scrollbar-gutter: stable; }

/* 4. Изображения без пустого пространства снизу */
img { display: block; }

/* 5. Текст не выходит за пределы */
.truncate {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Многострочный truncate: */
.clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 6. Overflow hidden не работает с position: sticky потомком — используй clip: */
.parent { overflow: clip; } /* vs overflow: hidden — clip не создаёт scroll */

/* 7. Коллапс margin решение: */
.parent { display: flow-root; } /* создаёт BFC — block formatting context */
```

### Инструменты

```
Browser DevTools → Elements → Box Model — точный box model
DevTools → Computed — итоговые стили
"PerfectPixel" extension — наложить макет поверх страницы
Storybook — изолированная разработка компонентов
```

---

## Modern CSS

### :has() — "родительский" селектор (CSS 2023)

```css
/* Выбрать .card если внутри есть img */
.card:has(img) { padding: 0; }

/* Форма с заполненным input — убрать label */
.form-field:has(input:not(:placeholder-shown)) label { top: -10px; }

/* Выбрать li у которого НЕТ ul потомка */
li:not(:has(ul)) { font-weight: bold; }

/* Родитель при hover на потомке */
.table tr:has(td:hover) { background: #f0f9ff; }
```

### Logical Properties

```css
/* Вместо left/right — inline: горизонталь, block: вертикаль */
/* Поддержка RTL и разных writing-modes без медиазапросов */
.element {
  margin-inline: auto;        /* margin-left + margin-right: auto */
  padding-block: 16px;        /* padding-top + padding-bottom */
  border-inline-start: 2px solid; /* border-left (или right в RTL) */
  inset-inline-start: 0;      /* left (или right в RTL) */
}
```

### aspect-ratio

```css
/* Сохранить соотношение сторон */
.video-container { aspect-ratio: 16 / 9; }
.avatar { aspect-ratio: 1; width: 48px; } /* квадрат */
.card-image { aspect-ratio: 4 / 3; object-fit: cover; }
```

### CSS Nesting (Chrome 112+, Firefox 117+)

```css
.card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;

  & .card-title {    /* то же что .card .card-title */
    font-size: 1.25rem;
  }

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  @media (min-width: 768px) {
    display: flex;
  }
}
```

### scroll-behavior и scroll-snap

```css
/* Плавный скролл */
html { scroll-behavior: smooth; }

/* scroll-snap — карусель без JS */
.carousel {
  display: flex;
  overflow-x: scroll;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.slide {
  scroll-snap-align: start;
  flex: 0 0 100%;
}
```

---

# TESTING / TOOLING

---

## Test Pyramid

```
         /\
        /  \     E2E (Playwright, Cypress)
       /    \    ← медленные, дорогие, проверяют user flow
      /──────\
     /        \  Integration Tests
    /          \ ← компоненты + API + БД
   /────────────\
  /              \ Unit Tests (Jest)
 /________________\ ← быстрые, изолированные, много

Соотношение: ~70% unit, ~20% integration, ~10% E2E
```

---

## Jest basics

```ts
// Матчеры:
expect(value).toBe(42);              // ===
expect(value).toEqual({ a: 1 });     // глубокое равенство
expect(arr).toContain(3);
expect(fn).toThrow('error message');
expect(fn).toHaveBeenCalledWith(42);
expect(value).toMatchSnapshot();

// Моки:
const mockFn = jest.fn().mockReturnValue(42);
const mockFn = jest.fn().mockResolvedValue({ data: [] }); // async
jest.spyOn(module, 'method').mockImplementation(() => 'mocked');

// Таймеры:
jest.useFakeTimers();
jest.runAllTimers();
jest.advanceTimersByTime(1000);

// React Testing Library:
render(<Component />);
const button = screen.getByRole('button', { name: /submit/i });
await userEvent.click(button);
expect(screen.getByText('Success')).toBeInTheDocument();

// Async:
await waitFor(() => expect(screen.getByText('Loaded')).toBeInTheDocument());
```

---

## ESLint

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "react-hooks/exhaustive-deps": "error",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

---

## Chrome DevTools

```
Performance:
1. Record → действие → Stop
2. Long Tasks (> 50ms) — красные отметки
3. Flame chart — вложенность вызовов
4. Frames — FPS, jank

Memory:
- Heap Snapshot → сравнить снимки до/после
- Allocation Timeline — утечки (растущий граф)
- Detached DOM nodes — элементы удалены но в памяти

Network:
- Waterfall — порядок загрузки
- Throttling — медленный интернет
- Block resource — заблокировать URL
- Preserve log — не очищать при навигации
```

---

# NEXT.JS

---

## Next.js

### Стратегии рендеринга

**SSR** — HTML генерируется на сервере при каждом запросе:
```
Запрос → Сервер рендерит React → Готовый HTML → Клиент получает контент
→ Hydration (React "оживляет" HTML)
```

**SSG** — HTML генерируется один раз при сборке:
```
npm run build → HTML файлы → CDN → молниеносно
```

**ISR** — SSG с обновлением по таймеру:
```js
export async function getStaticProps() {
  return { props: { data }, revalidate: 60 }; // пересобирать каждые 60 сек
}
```

**React Server Components** — компонент на сервере, не входит в JS бандл:
```tsx
// app/page.tsx — Server Component по умолчанию
async function Page() {
  const data = await db.query('SELECT * FROM posts'); // прямо в компоненте!
  return <PostList posts={data} />;
}
```

### App Router (Next.js 13+)

```
app/
├── layout.tsx      — root layout (обёртка для всех страниц)
├── page.tsx        — страница /
├── loading.tsx     — Suspense fallback
├── error.tsx       — error boundary
├── not-found.tsx   — 404
└── posts/
    ├── page.tsx    — страница /posts
    └── [id]/
        └── page.tsx — страница /posts/:id
```

```tsx
// 'use client' — клиентский компонент (может использовать хуки, события)
// По умолчанию все компоненты Server Components

'use client';
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

---

# CI/CD / CLOUD

---

## CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint       # ESLint
      - run: npm run type-check # tsc --noEmit
      - run: npm run test       # Jest
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: npm run deploy
```

**Стратегии деплоя:**
- **Blue/Green** — две идентичные среды, переключаем трафик мгновенно
- **Canary** — новая версия для % пользователей
- **Rolling** — постепенная замена инстансов

---

## Cloud

```
CDN — статические файлы на серверах по всему миру (JS, CSS, images)

S3 + CloudFront (AWS) — типичный хостинг SPA:
- S3 — хранилище файлов
- CloudFront — CDN поверх S3

Serverless Functions — запускаются по запросу:
- AWS Lambda, Vercel Functions, Cloudflare Workers

Edge Computing — код на CDN узлах, максимально близко к пользователю:
- Next.js Middleware, Cloudflare Workers

Типичная архитектура SPA:
User → CloudFront CDN → S3 (HTML, JS, CSS)
                      → API Gateway → Lambda → DynamoDB/RDS
```

---

# ALGORITHMS / TASKS

---

## Алгоритмы

```js
// Two Sum — O(n)
function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}

// Frequency Map
function findDuplicates(arr) {
  const freq = {};
  const result = [];
  for (const item of arr) freq[item] = (freq[item] || 0) + 1;
  for (const [val, count] of Object.entries(freq)) {
    if (count > 1) result.push(val);
  }
  return result;
}
```

---

## Задачи

### BFS / DFS бинарного дерева

```js
// BFS (в ширину) — уровень за уровнем
function bfs(root) {
  if (!root) return [];
  const result = [];
  const queue = [root];

  while (queue.length) {
    const node = queue.shift();
    result.push(node.val);
    if (node.left)  queue.push(node.left);
    if (node.right) queue.push(node.right);
  }
  return result;
}

// DFS In-order: left → root → right
function inOrder(node, result = []) {
  if (!node) return result;
  inOrder(node.left, result);
  result.push(node.val);
  inOrder(node.right, result);
  return result;
}
```

### Обход DOM дерева

```js
function findAllNodes(root, predicate) {
  const result = [];
  const queue = [root];

  while (queue.length) {
    const node = queue.shift();
    if (predicate(node)) result.push(node);
    queue.push(...node.children);
  }
  return result;
}

// Найти все кнопки:
findAllNodes(document.body, node => node.tagName === 'BUTTON');
```

### Связный список — реверс

```js
// Итеративно — O(n) time, O(1) space
function reverseList(head) {
  let prev = null;
  let curr = head;

  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev; // новая голова
}

// Обнаружение цикла (Floyd's algorithm)
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

---

# SECURITY

---

## Security

### XSS (Cross-Site Scripting)

```js
// УЯЗВИМО:
element.innerHTML = userInput;

// БЕЗОПАСНО:
element.textContent = userInput; // экранирует HTML
// React по умолчанию экранирует JSX

// ОПАСНО в React — только с санацией:
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />

// CSP:
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.example.com
```

### CSRF (Cross-Site Request Forgery)

```
1. Пользователь залогинен на bank.com (сессия в cookie)
2. Заходит на evil.com
3. evil.com отправляет POST bank.com/transfer
4. Браузер автоматически отправляет cookies → запрос выполнится!

Защита:
- CSRF Token — уникальный токен в форме
- SameSite=Strict/Lax на cookie
- Origin/Referer проверка на сервере
```

### SQL Injection

```js
// УЯЗВИМО:
const query = `SELECT * FROM users WHERE id = ${userId}`;

// БЕЗОПАСНО — параметризованные запросы:
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Дополнительно

```
HTTPS everywhere           — шифрование трафика
Secure + HttpOnly cookies  — защита от XSS и перехвата
Rate limiting              — защита от brute force
Input validation           — только на сервере (клиент не доверяем)
CORS настройка             — не * в production
Dependency scanning        — npm audit, Snyk
```

---

*Senior Frontend — полная шпаргалка. Акцент: глубокое понимание, не поверхностные определения.*
