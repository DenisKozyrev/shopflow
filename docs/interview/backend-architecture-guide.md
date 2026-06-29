# Backend Architecture — Полный конспект
> На основе "Architecting ASP.NET Core Applications" (Carl-Hugo Marcotte) — адаптировано под Node.js / TypeScript

---

## Содержание

1. [Архитектурные принципы — SOLID, DRY, KISS, YAGNI](#1-архитектурные-принципы)
2. [Паттерны проектирования — что это и зачем](#2-паттерны-проектирования)
3. [Слоистая архитектура (Layered Architecture)](#3-слоистая-архитектура)
4. [Clean Architecture](#4-clean-architecture)
5. [Repository и Unit of Work паттерны](#5-repository-и-unit-of-work)
6. [Domain Model — Rich vs Anemic](#6-domain-model)
7. [DTO паттерн](#7-dto-паттерн)
8. [Dependency Injection](#8-dependency-injection)
9. [CQRS и Mediator паттерн](#9-cqrs-и-mediator)
10. [Vertical Slice Architecture](#10-vertical-slice-architecture)
11. [Структурные паттерны — Decorator, Composite, Adapter, Facade](#11-структурные-паттерны)
12. [Поведенческие паттерны — Strategy, Observer, Chain of Responsibility](#12-поведенческие-паттерны)
13. [Микросервисная архитектура](#13-микросервисная-архитектура)
14. [Антипаттерны — что не делать](#14-антипаттерны)
15. [Полезные ресурсы](#15-полезные-ресурсы)

---

# 1. Архитектурные принципы

> Это фундамент. Без этого паттерны не имеют смысла.

## SOLID

### S — Single Responsibility Principle (SRP)
**Один класс / модуль — одна причина для изменения.**

```ts
// ❌ Плохо — класс делает всё сразу
class UserService {
  async getUser(id: string) { /* ... */ }
  async sendEmail(user: User) { /* nodemailer ... */ }
  async saveToDb(user: User) { /* mongodb ... */ }
  async generateReport(users: User[]) { /* excel ... */ }
}

// ✅ Хорошо — каждый класс отвечает за своё
class UserRepository {
  async findById(id: string): Promise<User | null> { /* ... */ }
  async save(user: User): Promise<User> { /* ... */ }
}

class EmailService {
  async sendWelcome(user: User): Promise<void> { /* ... */ }
}

class UserReportService {
  async generate(users: User[]): Promise<Buffer> { /* ... */ }
}
```

**Почему важно:** при изменении логики email — не трогаем БД-логику. Легче тестировать, легче понимать.

---

### O — Open/Closed Principle (OCP)
**Открыт для расширения, закрыт для модификации.**

```ts
// ❌ Плохо — добавление нового типа = правка существующего кода
class NotificationService {
  send(type: string, message: string) {
    if (type === 'email') { /* ... */ }
    else if (type === 'sms') { /* ... */ }
    // нужен push? → правим этот метод → риск сломать email/sms
  }
}

// ✅ Хорошо — добавляем новый тип без правки существующего
interface NotificationChannel {
  send(message: string): Promise<void>;
}

class EmailChannel implements NotificationChannel {
  async send(message: string) { /* nodemailer */ }
}

class SmsChannel implements NotificationChannel {
  async send(message: string) { /* twilio */ }
}

class PushChannel implements NotificationChannel {
  async send(message: string) { /* firebase */ }
}

class NotificationService {
  constructor(private channels: NotificationChannel[]) {}

  async notify(message: string) {
    await Promise.all(this.channels.map(ch => ch.send(message)));
  }
}

// Добавляем push — не трогаем NotificationService!
const service = new NotificationService([
  new EmailChannel(),
  new SmsChannel(),
  new PushChannel(), // просто добавили
]);
```

---

### L — Liskov Substitution Principle (LSP)
**Подкласс должен полностью заменять родительский класс.**

```ts
// ❌ Нарушение LSP — квадрат ломает поведение прямоугольника
class Rectangle {
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area() { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number) {
    this.width = w;
    this.height = w; // ← меняет оба! нарушает контракт Rectangle
  }
}

function testArea(rect: Rectangle) {
  rect.setWidth(4);
  rect.setHeight(5);
  // Ожидаем 20, но Square вернёт 25 — поведение сломано
  console.assert(rect.area() === 20);
}

// ✅ Правильно — общий интерфейс, раздельные реализации
interface Shape {
  area(): number;
}

class Rectangle implements Shape {
  constructor(private w: number, private h: number) {}
  area() { return this.w * this.h; }
}

class Square implements Shape {
  constructor(private side: number) {}
  area() { return this.side ** 2; }
}
```

**Правило:** если заменяешь объект подтипом и поведение ломается — нарушен LSP.

---

### I — Interface Segregation Principle (ISP)
**Не заставляй реализовывать ненужные методы.**

```ts
// ❌ Плохо — жирный интерфейс
interface IWorker {
  work(): void;
  eat(): void;
  sleep(): void;
}

class Robot implements IWorker {
  work() { /* OK */ }
  eat() { throw new Error('Robots do not eat!'); } // вынужден реализовать
  sleep() { throw new Error('Robots do not sleep!'); }
}

// ✅ Хорошо — маленькие интерфейсы
interface IWorker { work(): void; }
interface IEater  { eat(): void;  }
interface ISleeper { sleep(): void; }

class Human implements IWorker, IEater, ISleeper {
  work()  { /* ... */ }
  eat()   { /* ... */ }
  sleep() { /* ... */ }
}

class Robot implements IWorker {
  work() { /* ... */ }
  // eat и sleep — не нужны, не реализуем
}
```

---

### D — Dependency Inversion Principle (DIP)
**Зависеть от абстракций, а не от конкретных реализаций.**

```ts
// ❌ Плохо — UserService знает о MongoDB
class UserService {
  private db = new MongoUserRepository(); // конкретная реализация!

  async getUser(id: string) {
    return this.db.findById(id);
  }
}

// ✅ Хорошо — UserService зависит от интерфейса
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

class UserService {
  constructor(private repo: IUserRepository) {} // абстракция!

  async getUser(id: string) {
    return this.repo.findById(id);
  }
}

// В тестах — мок
class MockUserRepository implements IUserRepository {
  async findById(id: string) { return { id, name: 'Test' } as User; }
  async save(user: User) { return user; }
}

// В продакшне — MongoDB
class MongoUserRepository implements IUserRepository { /* ... */ }

const service = new UserService(new MongoUserRepository());
const testService = new UserService(new MockUserRepository()); // легко тестировать
```

---

## DRY — Don't Repeat Yourself

```ts
// ❌ Дублирование
async function getActiveUsers() {
  const users = await db.find({ status: 'active' });
  return users.map(u => ({ id: u._id, name: u.name, email: u.email }));
}

async function getAdminUsers() {
  const users = await db.find({ role: 'admin' });
  return users.map(u => ({ id: u._id, name: u.name, email: u.email })); // дубль!
}

// ✅ Выносим общую логику
function toUserDto(user: DbUser): UserDto {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

async function getActiveUsers() {
  const users = await db.find({ status: 'active' });
  return users.map(toUserDto);
}

async function getAdminUsers() {
  const users = await db.find({ role: 'admin' });
  return users.map(toUserDto);
}
```

## KISS — Keep It Simple, Stupid

Не усложняй без причины. Простой код, который работает, лучше умного кода, который непонятен.

## YAGNI — You Aren't Gonna Need It

Не пиши код "на будущее". Добавляй функциональность когда она нужна, а не когда "вдруг понадобится".

---

# 2. Паттерны проектирования

## Что такое паттерн

Паттерн — **переиспользуемое решение** типичной проблемы проектирования. Не готовый код, а схема решения.

**Три категории (Gang of Four):**
- **Creational** — создание объектов (Factory, Singleton, Builder)
- **Structural** — структура классов (Decorator, Adapter, Facade, Composite)
- **Behavioral** — взаимодействие объектов (Strategy, Observer, Chain of Responsibility, Mediator)

## Антипаттерны — что НЕ делать

### God Class (Класс-бог)
Класс который знает всё и делает всё. Признак — тысячи строк, десятки методов, зависит от всего.

```ts
// ❌ God Class
class AppManager {
  handleUserLogin() { /* ... */ }
  sendEmail() { /* ... */ }
  generateReport() { /* ... */ }
  processPayment() { /* ... */ }
  syncWithThirdPartyApi() { /* ... */ }
  validateFormData() { /* ... */ }
  // ... ещё 50 методов
}
```

**Решение:** разбить по Single Responsibility.

### Control Freak
Класс создаёт все зависимости сам (new внутри методов) вместо получения через DI.

```ts
// ❌ Control Freak
class OrderService {
  processOrder(order: Order) {
    const db = new MongoClient(/* ... */);       // сам создаёт
    const emailer = new NodeMailer(/* ... */);   // сам создаёт
    const logger = new WinstonLogger(/* ... */); // сам создаёт
    // ...
  }
}

// ✅ Зависимости приходят снаружи
class OrderService {
  constructor(
    private db: IOrderRepository,
    private emailer: IEmailService,
    private logger: ILogger,
  ) {}
}
```

---

# 3. Слоистая архитектура

## Классическая модель

```
┌─────────────────────────────┐
│   Presentation Layer        │  HTTP, WebSocket, CLI
│   (Controllers, Routes)     │  Принимает запросы, отдаёт ответы
├─────────────────────────────┤
│   Service / Domain Layer    │  Бизнес-логика
│   (Services, Use Cases)     │  Правила, вычисления, оркестрация
├─────────────────────────────┤
│   Data Access Layer         │  Работа с БД
│   (Repositories)            │  find, save, update, delete
└─────────────────────────────┘
         ↓ только вниз
```

**Правило:** зависимости идут **только сверху вниз**. Presentation знает о Domain, Domain знает о Data. Но не наоборот.

## Реализация на Node.js

```
src/
├── presentation/        ← routes, controllers, middleware
│   ├── routes/
│   └── middleware/
├── domain/              ← бизнес-логика
│   ├── services/
│   ├── entities/
│   └── interfaces/      ← абстракции (IUserRepository и т.д.)
└── infrastructure/      ← работа с БД, внешними сервисами
    ├── repositories/    ← реализации IRepository
    ├── database/
    └── external/        ← HTTP клиенты, S3, Redis
```

```ts
// infrastructure/repositories/MongoUserRepository.ts
export class MongoUserRepository implements IUserRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<User | null> {
    return this.db.collection('users').findOne({ _id: new ObjectId(id) });
  }

  async save(user: User): Promise<User> {
    await this.db.collection('users').insertOne(user);
    return user;
  }
}

// domain/services/UserService.ts
export class UserService {
  constructor(private userRepo: IUserRepository) {} // зависит от абстракции!

  async registerUser(data: RegisterDto): Promise<User> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) throw new Error('Email already taken');

    const user = new User(data);
    return this.userRepo.save(user);
  }
}

// presentation/routes/userRoutes.ts
router.post('/users', async (req, res) => {
  const user = await userService.registerUser(req.body);
  res.status(201).json(toUserDto(user));
});
```

## Rich Domain Model vs Anemic Domain Model

**Anemic (анемичная) модель** — объект только хранит данные, вся логика в Service'ах:

```ts
// Anemic — User это просто данные
interface User {
  id: string;
  email: string;
  status: 'active' | 'banned';
  loginCount: number;
}

// Логика размазана по UserService
class UserService {
  ban(user: User) { user.status = 'banned'; }
  recordLogin(user: User) { user.loginCount++; }
  isActive(user: User) { return user.status === 'active'; }
}
```

**Rich (богатая) модель** — логика внутри объекта:

```ts
// Rich — User сам знает что с собой делать
class User {
  private _status: 'active' | 'banned' = 'active';
  private _loginCount = 0;

  get status() { return this._status; }
  get loginCount() { return this._loginCount; }

  ban(): void {
    if (this._status === 'banned') throw new Error('Already banned');
    this._status = 'banned';
  }

  recordLogin(): void {
    if (this._status === 'banned') throw new Error('Cannot login: banned');
    this._loginCount++;
  }

  isActive(): boolean {
    return this._status === 'active';
  }
}
```

**Когда что:**
- **Anemic** — проще, хорошо для CRUD-приложений
- **Rich** — лучше когда много бизнес-правил и инвариантов

---

# 4. Clean Architecture

> Идея Robert C. Martin (Uncle Bob). Зависимости всегда направлены внутрь — к ядру.

## Схема

```
┌─────────────────────────────────────┐
│  Frameworks & Drivers               │  Express, MongoDB, Redis
│  ┌───────────────────────────────┐  │
│  │  Interface Adapters           │  │  Controllers, Repositories (реализации)
│  │  ┌─────────────────────────┐  │  │
│  │  │  Application / Use Cases│  │  │  Бизнес-логика приложения
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │  Domain / Entities│  │  │  │  Бизнес-правила, модели
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ← зависимости идут внутрь
```

**Главное правило:** внутренние слои **ничего не знают** о внешних. Domain не знает о MongoDB. Use Cases не знают об Express.

## Реализация

```
src/
├── domain/                  ← ядро, никаких зависимостей!
│   ├── entities/
│   │   └── User.ts          ← только бизнес-логика
│   └── repositories/
│       └── IUserRepository.ts ← интерфейс, не реализация
│
├── application/             ← use cases
│   └── usecases/
│       ├── RegisterUser.ts
│       └── GetUserById.ts
│
├── infrastructure/          ← реализации интерфейсов
│   ├── repositories/
│   │   └── MongoUserRepository.ts
│   └── services/
│       └── BcryptHashService.ts
│
└── presentation/            ← Express роуты
    └── routes/
        └── userRoutes.ts
```

```ts
// domain/entities/User.ts — никаких импортов из фреймворков!
export class User {
  constructor(
    public readonly id: string,
    private _email: string,
    private _passwordHash: string,
    private _role: UserRole = 'user',
  ) {}

  get email() { return this._email; }
  get role() { return this._role; }

  promote(): void {
    if (this._role === 'admin') throw new Error('Already admin');
    this._role = 'admin';
  }
}

// domain/repositories/IUserRepository.ts — только интерфейс
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// application/usecases/RegisterUser.ts
export class RegisterUser {
  constructor(
    private userRepo: IUserRepository,
    private hashService: IHashService,
  ) {}

  async execute(dto: RegisterUserDto): Promise<User> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new ConflictError('Email already in use');

    const hash = await this.hashService.hash(dto.password);
    const user = new User(generateId(), dto.email, hash);

    await this.userRepo.save(user);
    return user;
  }
}

// infrastructure/repositories/MongoUserRepository.ts
export class MongoUserRepository implements IUserRepository {
  constructor(private db: Db) {}

  async findByEmail(email: string): Promise<User | null> {
    const doc = await this.db.collection('users').findOne({ email });
    if (!doc) return null;
    return new User(doc._id.toString(), doc.email, doc.passwordHash, doc.role);
  }

  async save(user: User): Promise<void> {
    await this.db.collection('users').insertOne({
      _id: new ObjectId(user.id),
      email: user.email,
      role: user.role,
    });
  }
}
```

---

# 5. Repository и Unit of Work

## Repository Pattern

**Цель:** скрыть детали работы с БД за интерфейсом. Domain не знает что под капотом MongoDB или PostgreSQL.

```ts
// Интерфейс — контракт
interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  delete(id: string): Promise<void>;
}

// Generic базовый репозиторий
interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// Конкретный репозиторий
class MongoOrderRepository implements IOrderRepository {
  private collection: Collection;

  constructor(db: Db) {
    this.collection = db.collection('orders');
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) });
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const docs = await this.collection.find({ userId }).toArray();
    return docs.map(this.toEntity);
  }

  async save(order: Order): Promise<void> {
    await this.collection.insertOne(this.toDocument(order));
  }

  // маппинг из документа в доменный объект
  private toEntity(doc: any): Order {
    return new Order(doc._id.toString(), doc.userId, doc.items, doc.status);
  }

  // маппинг из доменного объекта в документ
  private toDocument(order: Order) {
    return {
      _id: new ObjectId(order.id),
      userId: order.userId,
      items: order.items,
      status: order.status,
    };
  }
}
```

## Unit of Work Pattern

**Цель:** объединить несколько операций в одну транзакцию. Либо всё, либо ничего.

```ts
interface IUnitOfWork {
  users: IUserRepository;
  orders: IOrderRepository;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

class MongoUnitOfWork implements IUnitOfWork {
  private session: ClientSession;
  public users: IUserRepository;
  public orders: IOrderRepository;

  constructor(private client: MongoClient) {}

  async begin(): Promise<void> {
    this.session = this.client.startSession();
    this.session.startTransaction();
    const db = this.client.db();
    this.users = new MongoUserRepository(db, this.session);
    this.orders = new MongoOrderRepository(db, this.session);
  }

  async commit(): Promise<void> {
    await this.session.commitTransaction();
    this.session.endSession();
  }

  async rollback(): Promise<void> {
    await this.session.abortTransaction();
    this.session.endSession();
  }
}

// Использование
class PlaceOrderUseCase {
  constructor(private uow: IUnitOfWork) {}

  async execute(userId: string, items: OrderItem[]): Promise<Order> {
    try {
      const user = await this.uow.users.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const order = new Order(generateId(), userId, items);
      await this.uow.orders.save(order);

      user.recordPurchase(order.total);
      await this.uow.users.update(user);

      await this.uow.commit(); // всё или ничего
      return order;
    } catch (err) {
      await this.uow.rollback();
      throw err;
    }
  }
}
```

---

# 6. Domain Model

## Value Objects — объекты-значения

Объект без идентичности — равен другому если равны его значения. Неизменяем.

```ts
// ❌ Обычная строка — нет валидации, нет смысла
class User {
  email: string; // любая строка, валидация снаружи
}

// ✅ Value Object — инкапсулирует правила
class Email {
  private readonly _value: string;

  constructor(value: string) {
    if (!value.includes('@')) throw new Error('Invalid email');
    if (value.length > 254) throw new Error('Email too long');
    this._value = value.toLowerCase();
  }

  get value(): string { return this._value; }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string { return this._value; }
}

class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {
    if (amount < 0) throw new Error('Amount cannot be negative');
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

// Использование
class User {
  constructor(
    public readonly id: string,
    public readonly email: Email, // не string, а Email!
  ) {}
}

const user = new User('1', new Email('Denis@Example.COM'));
console.log(user.email.value); // "denis@example.com" — нормализовано
```

## Aggregate — агрегат

Группа объектов с единой точкой входа (Aggregate Root). Все изменения только через корень.

```ts
// Order — Aggregate Root
// OrderItem — часть агрегата, нельзя менять напрямую
class OrderItem {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
    public readonly price: Money,
  ) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
  }

  get total(): Money {
    return new Money(this.price.amount * this.quantity, this.price.currency);
  }
}

class Order {
  private _items: OrderItem[] = [];
  private _status: OrderStatus = 'pending';

  constructor(public readonly id: string, public readonly userId: string) {}

  addItem(item: OrderItem): void {
    if (this._status !== 'pending') {
      throw new Error('Cannot modify confirmed order');
    }
    this._items.push(item);
  }

  confirm(): void {
    if (this._items.length === 0) throw new Error('Cannot confirm empty order');
    this._status = 'confirmed';
  }

  get total(): Money {
    return this._items.reduce(
      (sum, item) => sum.add(item.total),
      new Money(0, 'USD'),
    );
  }

  get items(): readonly OrderItem[] { return this._items; }
  get status(): OrderStatus { return this._status; }
}
```

---

# 7. DTO Паттерн

**Data Transfer Object** — объект для передачи данных между слоями. Не содержит логики.

```ts
// ❌ Отдаём внутренний объект напрямую — утечка деталей реализации
router.get('/users/:id', async (req, res) => {
  const user = await userRepo.findById(req.params.id);
  res.json(user); // отдаём пароль, внутренние поля!
});

// ✅ DTO — контракт API
interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface RegisterRequestDto {
  name: string;
  email: string;
  password: string;
}

// Mapper — преобразование между доменом и DTO
function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    // password — не включаем!
  };
}

router.get('/users/:id', async (req, res) => {
  const user = await userRepo.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(toUserResponseDto(user)); // безопасно
});
```

**Зачем DTO:**
- Отделить API контракт от внутренней модели
- Не утекают внутренние поля (пароли, технические поля)
- API может эволюционировать независимо от БД-схемы
- Валидация на входе

---

# 8. Dependency Injection

**DI** — зависимости приходят снаружи, не создаются внутри.

## Ручная DI (Composition Root)

```ts
// Composition Root — место где всё собирается
// src/container.ts

const mongoClient = new MongoClient(process.env.MONGO_URL!);
const db = mongoClient.db();

// Infrastructure
const userRepository = new MongoUserRepository(db);
const hashService = new BcryptHashService();
const emailService = new NodeMailerEmailService();

// Application
const registerUser = new RegisterUser(userRepository, hashService);
const loginUser = new LoginUser(userRepository, hashService);
const getUserProfile = new GetUserProfile(userRepository);

// Presentation
const userController = new UserController(
  registerUser,
  loginUser,
  getUserProfile,
);

export { userController };
```

## DI Container (IoC Container)

Для больших приложений — используют контейнеры. В Node.js популярны: `tsyringe`, `inversify`, `awilix`.

```ts
// С tsyringe
import { container, injectable, inject } from 'tsyringe';

@injectable()
class MongoUserRepository implements IUserRepository {
  constructor(@inject('MongoDb') private db: Db) {}
  // ...
}

@injectable()
class UserService {
  constructor(
    @inject('IUserRepository') private userRepo: IUserRepository,
    @inject('IEmailService') private emailService: IEmailService,
  ) {}
}

// Регистрация
container.register('IUserRepository', { useClass: MongoUserRepository });
container.register('IEmailService', { useClass: NodeMailerEmailService });

// Получение
const userService = container.resolve(UserService);
```

---

# 9. CQRS и Mediator

## CQRS — Command Query Responsibility Segregation

**Разделить операции чтения (Query) и записи (Command).**

```
Команда (Command) → меняет состояние, не возвращает данные (или возвращает только ID)
Запрос (Query)   → читает данные, не меняет состояние
```

```ts
// Commands — меняют состояние
interface ICommand {}
interface ICommandResult {}

class RegisterUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
  ) {}
}

class RegisterUserResult implements ICommandResult {
  constructor(public readonly userId: string) {}
}

// Queries — читают данные
interface IQuery<TResult> {}

class GetUserByIdQuery implements IQuery<UserDto> {
  constructor(public readonly userId: string) {}
}

class GetUsersQuery implements IQuery<UserDto[]> {
  constructor(
    public readonly page: number,
    public readonly pageSize: number,
    public readonly search?: string,
  ) {}
}

// Handlers
class RegisterUserHandler {
  constructor(
    private userRepo: IUserRepository,
    private hashService: IHashService,
  ) {}

  async handle(cmd: RegisterUserCommand): Promise<RegisterUserResult> {
    const hash = await this.hashService.hash(cmd.password);
    const user = new User(generateId(), cmd.email, hash, cmd.name);
    await this.userRepo.save(user);
    return new RegisterUserResult(user.id);
  }
}

class GetUserByIdHandler {
  constructor(private userRepo: IUserRepository) {}

  async handle(query: GetUserByIdQuery): Promise<UserDto | null> {
    const user = await this.userRepo.findById(query.userId);
    return user ? toUserDto(user) : null;
  }
}
```

## Mediator Pattern

**Посредник** — объект через который компоненты общаются, не зная друг о друге.

```ts
// Интерфейс медиатора
interface IMediator {
  send<TResult>(request: ICommand | IQuery<TResult>): Promise<TResult>;
}

// Простая реализация
class Mediator implements IMediator {
  private handlers = new Map<string, any>();

  register<T>(commandClass: new (...args: any[]) => T, handler: any) {
    this.handlers.set(commandClass.name, handler);
  }

  async send<TResult>(request: any): Promise<TResult> {
    const handlerName = request.constructor.name;
    const handler = this.handlers.get(handlerName);
    if (!handler) throw new Error(`No handler for ${handlerName}`);
    return handler.handle(request);
  }
}

// Регистрация
const mediator = new Mediator();
mediator.register(RegisterUserCommand, registerUserHandler);
mediator.register(GetUserByIdQuery, getUserByIdHandler);

// Контроллер — не знает о конкретных хэндлерах!
class UserController {
  constructor(private mediator: IMediator) {}

  async register(req: Request, res: Response) {
    const cmd = new RegisterUserCommand(
      req.body.email,
      req.body.password,
      req.body.name,
    );
    const result = await this.mediator.send<RegisterUserResult>(cmd);
    res.status(201).json({ userId: result.userId });
  }

  async getUser(req: Request, res: Response) {
    const query = new GetUserByIdQuery(req.params.id);
    const user = await this.mediator.send<UserDto | null>(query);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  }
}
```

**Зачем Mediator + CQRS:**
- Контроллер не знает о конкретных сервисах
- Легко добавить cross-cutting concerns (логирование, кэш, валидацию) через pipeline
- Каждый handler — маленький, изолированный, легко тестируемый

---

# 10. Vertical Slice Architecture

> Альтернатива слоистой архитектуре. Код организуется по фичам, а не по слоям.

## Слои vs Слайсы

```
Слоистая:                    Vertical Slice:
src/                         src/
├── controllers/             ├── features/
│   ├── UserController       │   ├── users/
│   └── OrderController      │   │   ├── RegisterUser/
├── services/                │   │   │   ├── RegisterUserCommand.ts
│   ├── UserService          │   │   │   ├── RegisterUserHandler.ts
│   └── OrderService         │   │   │   ├── RegisterUserDto.ts
└── repositories/            │   │   │   └── RegisterUser.test.ts
    ├── UserRepository        │   │   └── GetUser/
    └── OrderRepository       │   │       ├── GetUserQuery.ts
                             │   │       └── GetUserHandler.ts
                             │   └── orders/
                             │       └── PlaceOrder/
                             └── shared/  ← только общий код
```

**Преимущества:**
- Всё что нужно для фичи — в одном месте
- Легко найти, легко удалить
- Изменение фичи не затрагивает другие

**Когда использовать:**
- Большие команды, много фич
- Часто меняющиеся требования
- Когда фичи относительно независимы

---

# 11. Структурные паттерны

## Decorator — добавляет поведение без изменения класса

```ts
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

// Базовая реализация
class MongoUserRepository implements IUserRepository {
  async findById(id: string) { /* mongodb */ }
  async save(user: User) { /* mongodb */ }
}

// Декоратор: добавляем кэширование
class CachedUserRepository implements IUserRepository {
  constructor(
    private inner: IUserRepository, // оборачиваем другой репозиторий
    private cache: Redis,
  ) {}

  async findById(id: string): Promise<User | null> {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    const user = await this.inner.findById(id);
    if (user) await this.cache.setex(`user:${id}`, 300, JSON.stringify(user));
    return user;
  }

  async save(user: User): Promise<void> {
    await this.inner.save(user);
    await this.cache.del(`user:${user.id}`); // инвалидация
  }
}

// Декоратор: добавляем логирование
class LoggedUserRepository implements IUserRepository {
  constructor(
    private inner: IUserRepository,
    private logger: ILogger,
  ) {}

  async findById(id: string): Promise<User | null> {
    this.logger.info(`findById: ${id}`);
    const start = Date.now();
    const result = await this.inner.findById(id);
    this.logger.info(`findById: ${id} took ${Date.now() - start}ms`);
    return result;
  }

  async save(user: User): Promise<void> {
    this.logger.info(`save: ${user.id}`);
    await this.inner.save(user);
  }
}

// Композиция декораторов
const repo = new LoggedUserRepository(
  new CachedUserRepository(
    new MongoUserRepository(db),
    redis,
  ),
  logger,
);
// Запрос: логируется → кэш → если нет в кэше → MongoDB
```

## Facade — упрощает сложную подсистему

```ts
// Сложная подсистема
class AuthService { /* jwt, bcrypt */ }
class UserRepository { /* mongodb */ }
class EmailService { /* nodemailer */ }
class AuditService { /* logs */ }

// Facade — простой интерфейс для сложной логики
class UserFacade {
  constructor(
    private auth: AuthService,
    private users: UserRepository,
    private email: EmailService,
    private audit: AuditService,
  ) {}

  // Один метод скрывает сложную оркестрацию
  async register(dto: RegisterDto): Promise<{ user: UserDto; token: string }> {
    const hash = await this.auth.hashPassword(dto.password);
    const user = await this.users.save(new User(dto.email, hash));
    await this.email.sendWelcome(user);
    await this.audit.log('user_registered', user.id);
    const token = this.auth.generateToken(user);
    return { user: toUserDto(user), token };
  }
}
```

## Adapter — совместимость несовместимых интерфейсов

```ts
// Внешняя библиотека с чужим интерфейсом
class ThirdPartyEmailClient {
  sendMail(opts: { to: string; subject: string; html: string }) { /* ... */ }
}

// Наш интерфейс
interface IEmailService {
  send(to: string, template: string, data: Record<string, unknown>): Promise<void>;
}

// Адаптер — приводит чужой интерфейс к нашему
class EmailAdapter implements IEmailService {
  constructor(private client: ThirdPartyEmailClient) {}

  async send(to: string, template: string, data: Record<string, unknown>): Promise<void> {
    const html = renderTemplate(template, data); // рендеринг шаблона
    this.client.sendMail({
      to,
      subject: data.subject as string,
      html,
    });
  }
}
```

## Strategy — выбор алгоритма в рантайме

```ts
interface ISortStrategy<T> {
  sort(items: T[]): T[];
}

class AlphabeticalSort implements ISortStrategy<string> {
  sort(items: string[]) { return [...items].sort(); }
}

class ReversedSort implements ISortStrategy<string> {
  sort(items: string[]) { return [...items].sort().reverse(); }
}

class LengthSort implements ISortStrategy<string> {
  sort(items: string[]) { return [...items].sort((a, b) => a.length - b.length); }
}

class ItemList {
  private strategy: ISortStrategy<string>;

  constructor(strategy: ISortStrategy<string>) {
    this.strategy = strategy;
  }

  setStrategy(strategy: ISortStrategy<string>) {
    this.strategy = strategy;
  }

  getSorted(items: string[]): string[] {
    return this.strategy.sort(items);
  }
}

// Реальный пример — стратегия оплаты
interface IPaymentStrategy {
  charge(amount: number): Promise<PaymentResult>;
}

class StripePayment implements IPaymentStrategy {
  async charge(amount: number) { /* stripe API */ }
}

class PayPalPayment implements IPaymentStrategy {
  async charge(amount: number) { /* paypal API */ }
}

class OrderService {
  constructor(private payment: IPaymentStrategy) {}

  async checkout(order: Order) {
    return this.payment.charge(order.total);
  }
}
```

---

# 12. Поведенческие паттерны

## Observer — подписка на события

```ts
// Классический Observer
interface IObserver<T> {
  update(event: T): void;
}

interface IObservable<T> {
  subscribe(observer: IObserver<T>): void;
  unsubscribe(observer: IObserver<T>): void;
  notify(event: T): void;
}

// EventEmitter в Node.js — встроенный Observer
import { EventEmitter } from 'events';

class OrderService extends EventEmitter {
  async placeOrder(order: Order): Promise<Order> {
    await this.orderRepo.save(order);
    this.emit('order.placed', order); // уведомляем подписчиков
    return order;
  }
}

// Подписчики
orderService.on('order.placed', async (order: Order) => {
  await emailService.sendOrderConfirmation(order);
});

orderService.on('order.placed', async (order: Order) => {
  await inventoryService.reserveItems(order.items);
});

orderService.on('order.placed', async (order: Order) => {
  await analyticsService.track('order_placed', order);
});
```

## Chain of Responsibility — цепочка обработчиков

```ts
// Middleware в Express — это Chain of Responsibility!
// Каждый handler решает: обработать или передать дальше

abstract class Handler<T> {
  private next: Handler<T> | null = null;

  setNext(handler: Handler<T>): Handler<T> {
    this.next = handler;
    return handler;
  }

  protected passToNext(request: T): void {
    if (this.next) this.next.handle(request);
  }

  abstract handle(request: T): void;
}

// Пример: валидация запроса
class AuthHandler extends Handler<Request> {
  handle(req: Request) {
    if (!req.headers.authorization) {
      throw new UnauthorizedError();
    }
    this.passToNext(req);
  }
}

class RateLimitHandler extends Handler<Request> {
  handle(req: Request) {
    if (isRateLimited(req.ip)) {
      throw new TooManyRequestsError();
    }
    this.passToNext(req);
  }
}

class ValidationHandler extends Handler<Request> {
  handle(req: Request) {
    if (!isValidBody(req.body)) {
      throw new ValidationError();
    }
    this.passToNext(req);
  }
}

// Сборка цепочки
const auth = new AuthHandler();
const rateLimit = new RateLimitHandler();
const validation = new ValidationHandler();

auth.setNext(rateLimit).setNext(validation);
auth.handle(request); // запрос проходит всю цепочку
```

---

# 13. Микросервисная архитектура

## Монолит vs Микросервисы

```
Монолит                          Микросервисы
──────────────────────────────────────────────
+ Просто начать                  + Независимый деплой
+ Легко отлаживать               + Масштабирование по сервисам
+ Одна транзакция                + Разные технологии в сервисах
- Сложно масштабировать части    - Сложность операций
- Деплой всего приложения        - Сетевые вызовы
- Со временем превращается в     - Распределённые транзакции
  Big Ball of Mud                - Сложнее отлаживать
```

## Паттерны коммуникации

### Синхронная (HTTP/gRPC)
```ts
// Service A вызывает Service B и ждёт ответа
const user = await fetch(`http://user-service/users/${userId}`).then(r => r.json());
```

### Асинхронная (Kafka/RabbitMQ)
```ts
// Service A публикует событие и не ждёт
await kafka.producer.send({
  topic: 'order.placed',
  messages: [{ value: JSON.stringify(order) }],
});

// Service B обрабатывает в своём темпе
kafka.consumer.run({
  eachMessage: async ({ message }) => {
    const order = JSON.parse(message.value.toString());
    await notificationService.sendConfirmation(order);
  },
});
```

## API Gateway Pattern

```
Клиент → API Gateway → User Service
                     → Order Service
                     → Payment Service
```

Gateway берёт на себя: аутентификацию, rate limiting, логирование, маршрутизацию.

## Паттерн Strangler Fig

Постепенная миграция монолита на микросервисы:

```
1. Monolith (всё в одном)
2. Gateway + Monolith (новые фичи → сервисы)
3. Gateway + Сервисы + остаток монолита
4. Gateway + Сервисы (монолит "задушен")
```

---

# 14. Антипаттерны

## Big Ball of Mud
Код без архитектуры — всё зависит от всего, никакой структуры.

**Признаки:**
- Нет слоёв и разделения ответственности
- Изменение одного места ломает другое
- Невозможно тестировать без поднятия всего приложения

## Anemic Domain Model (когда это проблема)
Domain объекты — просто структуры данных, вся логика в Service'ах. Для простых CRUD нормально, для сложной доменной логики — антипаттерн.

## Distributed Monolith
"Микросервисы" которые деплоятся вместе и зависят друг от друга синхронно. Худшее из обоих миров.

## N+1 в архитектурном смысле
Сервис А для каждого объекта делает отдельный запрос к Сервису Б. Решение: batch API, GraphQL DataLoader.

---

# 15. Полезные ресурсы

## Книги (must read)
- **"Clean Architecture"** — Robert C. Martin — основа всего
- **"Domain-Driven Design"** — Eric Evans — DDD, агрегаты, value objects
- **"Designing Data-Intensive Applications"** — Martin Kleppmann — распределённые системы
- **"Patterns of Enterprise Application Architecture"** — Martin Fowler — паттерны уровня приложения

## YouTube
- [Clean Architecture с примерами на Node.js — Fireship](https://www.youtube.com/watch?v=SxMnN7xK0Q0)
- [SOLID Principles — Traversy Media](https://www.youtube.com/watch?v=mslyVri5Hmo)
- [Repository Pattern — Web Dev Simplified](https://www.youtube.com/watch?v=rtXpYpZdOzM)
- [CQRS объяснение — CodeOpinion](https://www.youtube.com/watch?v=DQ3D_mplIgY)
- [Domain-Driven Design — Milan Jovanović](https://www.youtube.com/watch?v=8Z5IAkWcnIw)
- [Микросервисы vs Монолит — Fireship](https://www.youtube.com/watch?v=rv4LlmLmVWk)

## Статьи
- [Clean Architecture на Node.js](https://dev.to/bespoyasov/clean-architecture-on-frontend-4311) — с диаграммами
- [Repository Pattern в TypeScript](https://medium.com/engineering-software-development/repository-pattern-in-typescript-62bffa82f6d0)
- [CQRS + Event Sourcing — Martin Fowler](https://martinfowler.com/bliki/CQRS.html)
- [Все паттерны GoF — refactoring.guru](https://refactoring.guru/ru/design-patterns) — лучший визуальный справочник

## Практика
- [refactoring.guru/ru](https://refactoring.guru/ru) — паттерны с диаграммами и примерами кода
- [roadmap.sh/backend](https://roadmap.sh/backend) — roadmap backend разработчика
- [node-typescript-boilerplate](https://github.com/jsynowiec/node-typescript-boilerplate) — стартовый шаблон

---

*Ключевая мысль: паттерны — не цель, а инструмент. Используй только когда они решают реальную проблему. Не усложняй без причины (KISS + YAGNI).*
