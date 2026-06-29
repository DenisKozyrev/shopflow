# Itexus Fintech Fullstack Interview Preparation
## Middle → Senior Level | Backend-Heavy Focus

---

## СОДЕРЖАНИЕ

1. [Node.js / NestJS — Deep Dive](#nodejs--nestjs)
2. [TypeScript — Продвинутые концепции](#typescript)
3. [PostgreSQL — Запросы, индексы, оптимизация](#postgresql)
4. [MongoDB — Схемы, агрегации, индексы](#mongodb)
5. [Redis — Паттерны, кэширование, очереди](#redis)
6. [REST API / GraphQL / WebSocket](#api-layer)
7. [Security — OAuth2, JWT, OWASP, KYC/AML](#security)
8. [Fintech Domain — IBKR, Bloomberg, Trading](#fintech-domain)
9. [Real-Time — Market Data, Order Status](#realtime)
10. [Docker / CI/CD](#devops)
11. [React / Next.js — Фронтенд вопросы](#frontend)
12. [System Design — Fintech Architecture](#system-design)
13. [Live Coding Tasks с решениями](#live-coding)
14. [Поведенческие вопросы](#behavioral)

---

## 1. Node.js / NestJS — Deep Dive {#nodejs--nestjs}

### Фундаментальные вопросы

---

**Q: Как работает Event Loop в Node.js? Объясни порядок фаз.**

**A:**
```
Event Loop фазы (порядок):
1. timers          — выполняет setTimeout, setInterval callbacks
2. pending I/O     — системные I/O callbacks (TCP errors и т.д.)
3. idle/prepare    — внутреннее использование
4. poll            — получение новых I/O events; блокируется если нет таймеров
5. check           — setImmediate callbacks
6. close           — close events (socket.on('close'))

Между каждой фазой: microtasks queue
  - process.nextTick() — выполняется ПЕРВЫМ из microtasks
  - Promise callbacks (.then) — выполняются после nextTick
```

```javascript
// Пример — предскажи порядок вывода:
console.log('1');

setTimeout(() => console.log('2'), 0);
setImmediate(() => console.log('3'));

Promise.resolve().then(() => console.log('4'));
process.nextTick(() => console.log('5'));

console.log('6');

// Вывод: 1, 6, 5, 4, 2, 3
// (в poll phase: setImmediate перед setTimeout в некоторых случаях может меняться)
```

**Почему это важно в fintech:** При обработке рыночных данных неправильное понимание Event Loop приводит к "голоданию" критичных callbacks (ордера могут обрабатываться с задержкой).

---

**Q: Что такое Worker Threads и когда их использовать?**

**A:**
```javascript
// Node.js однопоточный, но Worker Threads дают реальный параллелизм для CPU-bound задач

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Пример: вычисление риск-метрик портфеля (CPU-intensive)
if (isMainThread) {
  function calculatePortfolioRisk(positions) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { positions }
      });
      worker.on('message', resolve);
      worker.on('error', reject);
    });
  }
} else {
  // Worker context
  const { positions } = workerData;
  const risk = positions.reduce((acc, pos) => {
    // тяжелые вычисления: Value at Risk, Sharpe Ratio и т.д.
    return acc + Math.pow(pos.volatility * pos.size, 2);
  }, 0);
  parentPort.postMessage({ var: Math.sqrt(risk) });
}
```

**Когда НЕ использовать:** I/O операции — там Event Loop справляется отлично. Worker Threads нужны только для реально CPU-тяжелых задач: шифрование больших данных, расчёт сложных финансовых моделей, парсинг.

---

**Q: Объясни разницу между cluster module и Worker Threads.**

**A:**
| | Cluster | Worker Threads |
|---|---|---|
| Модель | Несколько процессов (fork) | Нити внутри одного процесса |
| Память | Изолированная (IPC для коммуникации) | Разделяемая (SharedArrayBuffer) |
| Use case | Масштабирование HTTP серверов | CPU-intensive задачи |
| Overhead | Высокий (полный процесс) | Низкий |
| Crash | Один не убивает другой | Краш нити может убить процесс |

```javascript
// Cluster для fintech API — используй все CPU ядра
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`Starting ${numCPUs} workers`);
  
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork(); // автоматический рестарт
  });
} else {
  require('./app'); // запускаем NestJS/Express приложение
}
```

---

### NestJS Архитектура

---

**Q: Объясни жизненный цикл request в NestJS.**

**A:**
```
Incoming Request
      ↓
Middleware (глобальный → модульный)
      ↓
Guards (isAuthenticated, hasRole)
      ↓
Interceptors (before) — логирование, transform
      ↓
Pipes (валидация, трансформация данных)
      ↓
Controller Handler
      ↓
Interceptors (after) — response transform
      ↓
Exception Filters (если ошибка)
      ↓
Response
```

```typescript
// Пример: Order Execution Pipeline

// 1. Guard — проверка JWT + KYC статуса
@Injectable()
export class TradingGuard implements CanActivate {
  constructor(private kycService: KycService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // из JWT middleware
    
    // Проверяем KYC верификацию перед торговлей
    const kycStatus = await this.kycService.getStatus(user.id);
    if (kycStatus !== 'APPROVED') {
      throw new ForbiddenException('KYC verification required');
    }
    return true;
  }
}

// 2. Pipe — валидация ордера
@Injectable()
export class OrderValidationPipe implements PipeTransform {
  transform(value: CreateOrderDto) {
    if (value.quantity <= 0) throw new BadRequestException('Quantity must be positive');
    if (value.price && value.price <= 0) throw new BadRequestException('Invalid price');
    return value;
  }
}

// 3. Controller
@Controller('orders')
@UseGuards(JwtAuthGuard, TradingGuard)
export class OrdersController {
  @Post()
  @UsePipes(OrderValidationPipe)
  async createOrder(@Body() dto: CreateOrderDto, @User() user: JwtPayload) {
    return this.ordersService.create(dto, user.id);
  }
}
```

---

**Q: Dependency Injection в NestJS — как работает, провайдеры, scopes.**

**A:**
```typescript
// Scopes:
// DEFAULT (Singleton) — один экземпляр на всё приложение
// REQUEST — новый экземпляр на каждый запрос
// TRANSIENT — новый экземпляр каждый раз при inject

// Пример — REQUEST scope для user-specific context
@Injectable({ scope: Scope.REQUEST })
export class TradingSessionService {
  private session: TradingSession;
  
  constructor(@Inject(REQUEST) private request: Request) {
    // Создаётся новый экземпляр на каждый запрос
    this.session = new TradingSession(request.user.accountId);
  }
}

// Custom Provider — для интеграции с IBKR API
@Module({
  providers: [
    {
      provide: 'IBKR_CLIENT',
      useFactory: async (configService: ConfigService) => {
        const client = new IBKRClient({
          host: configService.get('IBKR_HOST'),
          port: configService.get('IBKR_PORT'),
        });
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    // Value provider для feature flags
    {
      provide: 'FEATURE_FLAGS',
      useValue: {
        realtimeQuotes: true,
        marginTrading: false,
      },
    },
    // Alias provider
    {
      provide: 'PRIMARY_BROKER',
      useExisting: IBKRService,
    },
  ],
})
export class TradingModule {}

// Inject custom provider
@Injectable()
export class OrderService {
  constructor(
    @Inject('IBKR_CLIENT') private ibkrClient: IBKRClient,
    @Inject('FEATURE_FLAGS') private flags: FeatureFlags,
  ) {}
}
```

---

**Q: Как реализовать глобальный exception filter с логированием в fintech приложении?**

**A:**
```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly sentryService: SentryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any).message;
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Обработка DB ошибок
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        code = 'DUPLICATE_ENTRY';
      }
    }

    const correlationId = request.headers['x-correlation-id'] || uuidv4();
    const userId = (request as any).user?.id;

    // Логируем критичные ошибки в Sentry
    if (status >= 500) {
      this.sentryService.captureException(exception, {
        extra: { correlationId, userId, path: request.url },
      });
    }

    // Audit log для финансовых операций
    if (request.url.includes('/orders') || request.url.includes('/payments')) {
      await this.auditLogService.log({
        action: 'REQUEST_FAILED',
        userId,
        resource: request.url,
        error: message,
        correlationId,
      });
    }

    this.logger.error({
      correlationId,
      method: request.method,
      url: request.url,
      statusCode: status,
      error: message,
      userId,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    response.status(status).json({
      statusCode: status,
      code,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

**Q: Как реализовать Circuit Breaker паттерн для интеграции с брокерскими API?**

**A:**
```typescript
// Circuit Breaker states: CLOSED → OPEN → HALF_OPEN → CLOSED
enum CircuitState {
  CLOSED = 'CLOSED',     // Нормальная работа
  OPEN = 'OPEN',         // Отключен, быстрый fail
  HALF_OPEN = 'HALF_OPEN', // Проверяем восстановление
}

@Injectable()
export class CircuitBreakerService {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number;
  private readonly FAILURE_THRESHOLD = 5;
  private readonly TIMEOUT_MS = 60_000; // 1 минута

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.TIMEOUT_MS) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new ServiceUnavailableException('Circuit breaker is OPEN — broker API unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.state = CircuitState.OPEN;
    }
  }
}

// Использование в IBKR Service
@Injectable()
export class IBKRService {
  constructor(private readonly circuitBreaker: CircuitBreakerService) {}

  async submitOrder(order: Order): Promise<OrderConfirmation> {
    return this.circuitBreaker.execute(async () => {
      return this.ibkrClient.placeOrder({
        symbol: order.symbol,
        action: order.side,
        totalQuantity: order.quantity,
        orderType: order.type,
        lmtPrice: order.limitPrice,
      });
    });
  }
}
```

---

**Q: Как реализовать rate limiting для trading API?**

**A:**
```typescript
// Используем throttler + Redis для distributed rate limiting
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 5 },     // 5 req/sec
          { name: 'medium', ttl: 60_000, limit: 100 }, // 100 req/min
          { name: 'long', ttl: 3_600_000, limit: 1000 }, // 1000 req/hour
        ],
        storage: new ThrottlerStorageRedisService(
          config.get('REDIS_URL')
        ),
        skipIf: (context) => {
          // Не лимитируем внутренние сервисы
          const req = context.switchToHttp().getRequest();
          return req.headers['x-internal-service'] === 'true';
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}

// Кастомный throttler для торговых ордеров (жёстче лимиты)
@Injectable()
export class OrderThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Rate limit по аккаунту, а не по IP
    return `order:${(req as any).user.accountId}`;
  }
  
  protected errorMessage = 'Too many orders. Please slow down.';
}

@Controller('orders')
@UseGuards(OrderThrottlerGuard)
@Throttle({ short: { limit: 2, ttl: 1000 } }) // Max 2 ордера в секунду
export class OrdersController {}
```

---

### Продвинутые паттерны NestJS

---

**Q: Как реализовать Event-Driven Architecture с NestJS и Bull/BullMQ?**

**A:**
```typescript
// Очереди для асинхронной обработки ордеров
import { BullModule, InjectQueue, Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Queue, Job } from 'bull';

// Модуль
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'order-execution', defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } } },
      { name: 'notifications' },
      { name: 'risk-check' },
    ),
  ],
})
export class OrderModule {}

// Producer
@Injectable()
export class OrderService {
  constructor(
    @InjectQueue('order-execution') private orderQueue: Queue,
    @InjectQueue('risk-check') private riskQueue: Queue,
  ) {}

  async createOrder(dto: CreateOrderDto, userId: string) {
    // Сначала проверяем риски, потом исполняем
    const riskJob = await this.riskQueue.add('evaluate', {
      userId,
      order: dto,
    }, { priority: 1 }); // высокий приоритет

    return {
      orderId: uuidv4(),
      status: 'PENDING_RISK_CHECK',
      jobId: riskJob.id,
    };
  }
}

// Consumer — Risk Check
@Processor('risk-check')
export class RiskCheckProcessor {
  constructor(
    @InjectQueue('order-execution') private orderQueue: Queue,
    private riskService: RiskService,
  ) {}

  @Process('evaluate')
  async handleRiskCheck(job: Job<{ userId: string; order: CreateOrderDto }>) {
    const { userId, order } = job.data;
    
    const riskResult = await this.riskService.evaluate(userId, order);
    
    if (riskResult.approved) {
      await this.orderQueue.add('execute', { userId, order, riskScore: riskResult.score });
    } else {
      // Отклоняем ордер
      await this.notifyOrderRejected(userId, riskResult.reason);
    }
  }

  @OnQueueFailed()
  async handleFailed(job: Job, error: Error) {
    this.logger.error(`Risk check failed for job ${job.id}: ${error.message}`);
    // Алертим команду риск-менеджмента
    await this.alertService.sendCriticalAlert({
      type: 'RISK_CHECK_FAILURE',
      jobData: job.data,
      error: error.message,
    });
  }
}

// Consumer — Order Execution
@Processor('order-execution')
export class OrderExecutionProcessor {
  @Process('execute')
  async handleOrderExecution(job: Job) {
    const { userId, order } = job.data;
    
    // Обновляем прогресс для мониторинга
    await job.progress(10);
    
    const confirmation = await this.ibkrService.submitOrder(order);
    await job.progress(70);
    
    await this.orderRepository.update(order.id, { 
      status: 'SUBMITTED', 
      brokerOrderId: confirmation.orderId 
    });
    await job.progress(100);
    
    return confirmation;
  }
}
```

---

## 2. TypeScript — Продвинутые концепции {#typescript}

---

**Q: Объясни Conditional Types, Template Literal Types, Mapped Types с финансовыми примерами.**

**A:**
```typescript
// ===== CONDITIONAL TYPES =====
// Выводим тип ответа на основе типа запроса
type BrokerResponse<T> = T extends 'STOCK' 
  ? { symbol: string; exchange: string; shares: number }
  : T extends 'CRYPTO'
  ? { symbol: string; network: string; amount: bigint }
  : T extends 'FOREX'
  ? { pair: string; lotSize: number }
  : never;

type StockResponse = BrokerResponse<'STOCK'>; // { symbol, exchange, shares }

// infer — извлекаем тип из структуры
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type UnwrapArray<T> = T extends (infer U)[] ? U : T;

// Для API ответов брокеров
type APIResult<T> = T extends { data: infer D } ? D : never;

// ===== MAPPED TYPES =====
// Все поля портфолио опциональными с readonly
type PortfolioSnapshot = {
  cash: number;
  positions: Position[];
  totalValue: number;
  pnl: number;
};

// Делаем все поля readonly для иммутабельного state
type Immutable<T> = {
  readonly [K in keyof T]: T[K] extends object ? Immutable<T[K]> : T[K];
};

// Nullable версия для API ответов где данные могут отсутствовать
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

// Только определённые ключи с трансформацией
type PickAndRequire<T, K extends keyof T> = Required<Pick<T, K>>;
type OrderSummary = PickAndRequire<Order, 'id' | 'symbol' | 'quantity' | 'status'>;

// ===== TEMPLATE LITERAL TYPES =====
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type APIEndpoint = '/orders' | '/positions' | '/quotes';
type APIRoute = `${HttpMethod} ${APIEndpoint}`;
// "GET /orders" | "POST /orders" | "GET /positions" | ...

// Event names для типобезопасных event emitters
type OrderEvent = `order:${'created' | 'filled' | 'cancelled' | 'rejected'}`;
type PortfolioEvent = `portfolio:${'updated' | 'rebalanced'}`;
type MarketEvent = `market:${'open' | 'close' | 'halt'}`;

// ===== UTILITY TYPES =====
// DeepPartial для патч-операций
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Exclude nullable — убираем null/undefined из типов
type NonNullableDeep<T> = {
  [K in keyof T]-?: NonNullable<T[K]>;
};
```

---

**Q: Как типизировать сложные API ответы от брокеров (discriminated unions)?**

**A:**
```typescript
// Discriminated Union для разных типов ордеров
type MarketOrder = {
  type: 'MARKET';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  // Нет price — исполняется по рыночной цене
};

type LimitOrder = {
  type: 'LIMIT';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  limitPrice: number;
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
};

type StopOrder = {
  type: 'STOP';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  stopPrice: number;
};

type StopLimitOrder = {
  type: 'STOP_LIMIT';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  stopPrice: number;
  limitPrice: number;
  timeInForce: 'DAY' | 'GTC';
};

type Order = MarketOrder | LimitOrder | StopOrder | StopLimitOrder;

// Type guard функция
function isLimitOrder(order: Order): order is LimitOrder {
  return order.type === 'LIMIT';
}

// Exhaustive check — компилятор поймает если добавим новый тип ордера
function processOrder(order: Order): string {
  switch (order.type) {
    case 'MARKET': return `Market order for ${order.quantity} shares`;
    case 'LIMIT': return `Limit order at $${order.limitPrice}`;
    case 'STOP': return `Stop order at $${order.stopPrice}`;
    case 'STOP_LIMIT': return `Stop-limit: stop $${order.stopPrice}, limit $${order.limitPrice}`;
    default:
      const _exhaustive: never = order; // TS ошибка если забыли кейс
      throw new Error(`Unknown order type: ${_exhaustive}`);
  }
}
```

---

**Q: Generics с constraints — практический пример для репозитория.**

**A:**
```typescript
// Generic Repository с строгой типизацией
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Repository<T extends BaseEntity, CreateDto, UpdateDto> {
  findById(id: string): Promise<T | null>;
  findMany(filter: Partial<T>): Promise<T[]>;
  create(dto: CreateDto): Promise<T>;
  update(id: string, dto: UpdateDto): Promise<T>;
  delete(id: string): Promise<void>;
}

// Конкретная реализация
interface Order extends BaseEntity {
  symbol: string;
  quantity: number;
  price: number;
  status: OrderStatus;
  userId: string;
}

class OrderRepository implements Repository<Order, CreateOrderDto, UpdateOrderDto> {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Order | null> {
    return this.db.order.findUnique({ where: { id } });
  }

  async findMany(filter: Partial<Order>): Promise<Order[]> {
    return this.db.order.findMany({ where: filter });
  }

  async create(dto: CreateOrderDto): Promise<Order> {
    return this.db.order.create({ data: dto });
  }

  async update(id: string, dto: UpdateOrderDto): Promise<Order> {
    return this.db.order.update({ where: { id }, data: dto });
  }

  async delete(id: string): Promise<void> {
    await this.db.order.delete({ where: { id } });
  }
}

// Decorators с типизацией
function Retry(maxAttempts: number, delay: number) {
  return function <T extends (...args: any[]) => Promise<any>>(
    _target: object,
    _key: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const original = descriptor.value!;
    descriptor.value = async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await original.apply(this, args);
        } catch (error) {
          if (attempt === maxAttempts) throw error;
          await new Promise(r => setTimeout(r, delay * attempt));
        }
      }
    } as T;
    return descriptor;
  };
}
```

---

## 3. PostgreSQL — Запросы, индексы, оптимизация {#postgresql}

---

**Q: Объясни типы индексов PostgreSQL и когда использовать каждый.**

**A:**
```sql
-- B-Tree (по умолчанию) — для = < > BETWEEN ORDER BY
-- Хорош для: большинство запросов
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Composite index — порядок столбцов ВАЖЕН (selectivity)
-- Правило: сначала наиболее selective поля или поля из WHERE с =
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
-- Этот индекс покроет:
-- WHERE user_id = $1
-- WHERE user_id = $1 AND status = $2
-- НО НЕ: WHERE status = $2 (без user_id первым)

-- Partial index — для частичных данных (экономит место, быстрее)
CREATE INDEX idx_open_orders ON orders(user_id, created_at) 
WHERE status IN ('PENDING', 'OPEN');

-- GIN index — для JSONB, массивы, полнотекстовый поиск
CREATE INDEX idx_order_metadata ON orders USING GIN(metadata);
-- Запрос:
SELECT * FROM orders WHERE metadata @> '{"broker": "IBKR"}';

-- BRIN index — для очень больших таблиц с физически упорядоченными данными
-- (напр. time-series: market_data по timestamp)
CREATE INDEX idx_market_data_time ON market_data USING BRIN(timestamp);

-- Покрывающий (covering) index — include дополнительные столбцы
-- Запрос не идёт в heap, данные берутся прямо из индекса
CREATE INDEX idx_orders_covering ON orders(user_id, status) 
INCLUDE (symbol, quantity, price, created_at);
-- SELECT symbol, quantity, price, created_at 
-- FROM orders WHERE user_id = $1 AND status = 'FILLED'
-- → Index Only Scan (нет доступа к heap!)
```

---

**Q: Как оптимизировать запрос? Объясни EXPLAIN ANALYZE.**

**A:**
```sql
-- Медленный запрос — получить P&L по всем позициям пользователя
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 
  p.symbol,
  p.quantity,
  p.avg_cost,
  q.last_price,
  (q.last_price - p.avg_cost) * p.quantity AS unrealized_pnl
FROM positions p
LEFT JOIN quotes q ON q.symbol = p.symbol AND q.is_latest = true
WHERE p.user_id = '123'
ORDER BY unrealized_pnl DESC;

-- Что смотреть в EXPLAIN ANALYZE:
-- 1. Seq Scan vs Index Scan (Seq Scan на большой таблице = проблема)
-- 2. rows= vs actual rows (большое расхождение = устаревшая статистика)
-- 3. cost= (условные единицы), actual time= (реальное время)
-- 4. Buffers: shared hit/read (hit=кэш, read=диск)
-- 5. loops= (сколько раз выполнен узел)

-- Признаки проблем:
-- Seq Scan на большой таблице → нужен индекс
-- Hash Join → много памяти, возможно nestedloop + индекс быстрее для малых наборов
-- Sort → нет индекса для ORDER BY
-- rows=1000 actual rows=50000 → ANALYZE нужен (обновить статистику)

-- Обновление статистики
ANALYZE positions;
ANALYZE quotes;

-- Принудительное обновление (если auto-analyze не успевает для hot tables)
ALTER TABLE quotes SET (autovacuum_analyze_scale_factor = 0.01);
```

---

**Q: Оконные функции — объясни и напиши запрос для анализа портфеля.**

**A:**
```sql
-- Оконные функции работают над "окном" строк, не схлопывая как GROUP BY

-- 1. Текущий P&L vs предыдущий день (LAG)
SELECT 
  date,
  portfolio_value,
  LAG(portfolio_value) OVER (PARTITION BY user_id ORDER BY date) AS prev_value,
  portfolio_value - LAG(portfolio_value) OVER (PARTITION BY user_id ORDER BY date) AS daily_pnl,
  ROUND(
    (portfolio_value - LAG(portfolio_value) OVER (PARTITION BY user_id ORDER BY date)) 
    / LAG(portfolio_value) OVER (PARTITION BY user_id ORDER BY date) * 100, 
    2
  ) AS daily_return_pct
FROM portfolio_snapshots
WHERE user_id = $1
ORDER BY date;

-- 2. Running total (накопленный PnL)
SELECT 
  date,
  daily_pnl,
  SUM(daily_pnl) OVER (PARTITION BY user_id ORDER BY date 
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_pnl
FROM daily_pnl_records;

-- 3. Ранжирование позиций по доходности
SELECT 
  symbol,
  unrealized_pnl,
  RANK() OVER (ORDER BY unrealized_pnl DESC) AS pnl_rank,
  PERCENT_RANK() OVER (ORDER BY unrealized_pnl DESC) AS percentile,
  NTILE(4) OVER (ORDER BY unrealized_pnl DESC) AS quartile -- 1=top 25%
FROM positions
WHERE user_id = $1;

-- 4. Moving Average (скользящая средняя) цены за 20 дней
SELECT 
  symbol,
  date,
  close_price,
  AVG(close_price) OVER (
    PARTITION BY symbol 
    ORDER BY date 
    ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
  ) AS ma_20,
  AVG(close_price) OVER (
    PARTITION BY symbol 
    ORDER BY date 
    ROWS BETWEEN 49 PRECEDING AND CURRENT ROW
  ) AS ma_50
FROM price_history;

-- 5. Топ 3 trade по прибыли для каждого пользователя
SELECT * FROM (
  SELECT 
    user_id,
    symbol,
    realized_pnl,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY realized_pnl DESC) AS rn
  FROM trades
  WHERE closed_at >= NOW() - INTERVAL '30 days'
) ranked
WHERE rn <= 3;
```

---

**Q: Транзакции, уровни изоляции — объясни для финансовых операций.**

**A:**
```sql
-- READ UNCOMMITTED — читает незакоммиченные данные (dirty read) — никогда в fintech
-- READ COMMITTED — по умолчанию в PG — только закоммиченные данные
-- REPEATABLE READ — одинаковый snapshot на время транзакции (нет non-repeatable read)
-- SERIALIZABLE — полная изоляция (самый медленный, нет phantom reads)

-- Для финансовых операций — SERIALIZABLE или REPEATABLE READ с пессимистичной блокировкой

-- Пример: Transfer между счетами (конкурентное обновление)
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Блокируем обе записи в одном порядке (предотвращаем deadlock)
SELECT * FROM accounts 
WHERE id IN ($1, $2) 
ORDER BY id  -- ВАЖНО: всегда один порядок блокировок!
FOR UPDATE;

-- Проверяем баланс
DO $$
DECLARE
  sender_balance NUMERIC;
BEGIN
  SELECT balance INTO sender_balance FROM accounts WHERE id = $1;
  IF sender_balance < $amount THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
END $$;

UPDATE accounts SET balance = balance - $amount WHERE id = $sender_id;
UPDATE accounts SET balance = balance + $amount WHERE id = $receiver_id;

INSERT INTO transactions (from_account, to_account, amount, status)
VALUES ($1, $2, $amount, 'COMPLETED');

COMMIT;

-- Оптимистичная блокировка через версионирование (меньше блокировок)
UPDATE positions 
SET quantity = quantity + $qty, version = version + 1
WHERE id = $id AND version = $expected_version; -- если version изменилась → 0 строк → retry

-- Проверяем количество обновлённых строк
-- rowCount === 0 → конкурентное изменение, повторяем
```

---

**Q: Партиционирование таблицы market_data (time-series).**

**A:**
```sql
-- Таблица котировок может иметь миллиарды записей — партиционируем по времени
CREATE TABLE market_data (
  id          BIGSERIAL,
  symbol      VARCHAR(20) NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL,
  open        NUMERIC(18,6),
  high        NUMERIC(18,6),
  low         NUMERIC(18,6),
  close       NUMERIC(18,6),
  volume      BIGINT,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Создаём партиции по месяцам
CREATE TABLE market_data_2024_01 PARTITION OF market_data
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE market_data_2024_02 PARTITION OF market_data
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Индекс на каждой партиции (автоматически, если создать на родительской)
CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, timestamp DESC);

-- Запрос автоматически идёт только в нужные партиции (partition pruning)
SELECT * FROM market_data 
WHERE symbol = 'AAPL' 
  AND timestamp BETWEEN '2024-01-15' AND '2024-01-20';

-- Автоматическое создание партиций (pg_partman extension)
SELECT partman.create_parent(
  p_parent_table := 'public.market_data',
  p_control := 'timestamp',
  p_type := 'range',
  p_interval := 'monthly',
  p_premake := 3
);
```

---

## 4. MongoDB — Схемы, агрегации, индексы {#mongodb}

---

**Q: Агрегационный pipeline — напиши сложный запрос для анализа торговых данных.**

**A:**
```javascript
// Анализ: топ символы по объёму торгов за последние 30 дней
// сгруппированные по пользователю с процентилями P&L

db.trades.aggregate([
  // Stage 1: Фильтр за период
  {
    $match: {
      userId: ObjectId("..."),
      closedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      status: "CLOSED"
    }
  },
  
  // Stage 2: Вычисляем поля
  {
    $addFields: {
      pnl: { $subtract: ["$sellPrice", "$buyPrice"] },
      pnlPct: {
        $multiply: [
          { $divide: [{ $subtract: ["$sellPrice", "$buyPrice"] }, "$buyPrice"] },
          100
        ]
      },
      holdingDays: {
        $divide: [
          { $subtract: ["$closedAt", "$openedAt"] },
          1000 * 60 * 60 * 24
        ]
      }
    }
  },
  
  // Stage 3: Группировка по символу
  {
    $group: {
      _id: "$symbol",
      totalTrades: { $sum: 1 },
      totalVolume: { $sum: { $multiply: ["$quantity", "$buyPrice"] } },
      totalPnl: { $sum: "$pnl" },
      avgPnlPct: { $avg: "$pnlPct" },
      winningTrades: {
        $sum: { $cond: [{ $gt: ["$pnl", 0] }, 1, 0] }
      },
      maxPnl: { $max: "$pnl" },
      minPnl: { $min: "$pnl" },
      avgHoldingDays: { $avg: "$holdingDays" },
      pnlValues: { $push: "$pnl" }  // для percentile
    }
  },
  
  // Stage 4: Вычисляем win rate
  {
    $addFields: {
      winRate: {
        $multiply: [
          { $divide: ["$winningTrades", "$totalTrades"] },
          100
        ]
      }
    }
  },
  
  // Stage 5: Сортировка
  { $sort: { totalPnl: -1 } },
  
  // Stage 6: Топ 10
  { $limit: 10 },
  
  // Stage 7: Убираем массив pnlValues из ответа (только для вычислений)
  {
    $project: {
      pnlValues: 0
    }
  }
]);

// --- Сложный pipeline: Portfolio performance by day ---
db.portfolio_snapshots.aggregate([
  { $match: { userId: ObjectId("...") } },
  
  // Добавляем date без времени
  {
    $addFields: {
      date: { $dateToString: { format: "%Y-%m-%d", date: "$snapshotAt" } }
    }
  },
  
  // Последний snapshot за каждый день
  { $sort: { snapshotAt: -1 } },
  {
    $group: {
      _id: "$date",
      totalValue: { $first: "$totalValue" },
      cashBalance: { $first: "$cashBalance" },
      investedValue: { $first: "$investedValue" }
    }
  },
  { $sort: { _id: 1 } },
  
  // $setWindowFields — как оконные функции в SQL (MongoDB 5.0+)
  {
    $setWindowFields: {
      sortBy: { _id: 1 },
      output: {
        prevDayValue: {
          $shift: { output: "$totalValue", by: -1 }
        },
        cumulativeReturn: {
          $avg: "$totalValue",
          window: { documents: ["unbounded", "current"] }
        }
      }
    }
  },
  
  // Вычисляем дневную доходность
  {
    $addFields: {
      dailyReturnPct: {
        $cond: {
          if: { $gt: ["$prevDayValue", 0] },
          then: {
            $multiply: [
              { $divide: [{ $subtract: ["$totalValue", "$prevDayValue"] }, "$prevDayValue"] },
              100
            ]
          },
          else: 0
        }
      }
    }
  }
]);
```

---

**Q: Как правильно проектировать схемы MongoDB для fintech (embed vs reference)?**

**A:**
```javascript
// ПРАВИЛО: Embed если данные всегда читаются вместе и размер документа ≤ 16MB
// ПРАВИЛО: Reference если данные большие, часто обновляются независимо, N:M отношения

// ❌ ПЛОХО: Embed неограниченные массивы (Anti-pattern)
{
  _id: ObjectId("..."),
  userId: "user123",
  trades: [/* 10000 trades — достигнем лимит 16MB */]
}

// ✅ ХОРОШО: Reference для trades (1:N с потенциально большим N)
// User document
{
  _id: ObjectId("..."),
  email: "trader@example.com",
  profile: {
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890"
  },
  preferences: {
    currency: "USD",
    timezone: "America/New_York",
    notifications: { email: true, sms: false }
  },
  kycStatus: "APPROVED",
  createdAt: ISODate("2024-01-15")
}

// Trade document (отдельная коллекция)
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),   // reference
  accountId: ObjectId("..."), // reference
  symbol: "AAPL",
  side: "BUY",
  quantity: 100,
  price: 185.50,
  fees: { broker: 0.50, exchange: 0.10, total: 0.60 },
  status: "FILLED",
  openedAt: ISODate("2024-01-15T14:30:00Z"),
  closedAt: null,
  metadata: {
    orderId: "ORD-12345",
    brokerTradeId: "IBKR-789",
    executionVenue: "NASDAQ"
  }
}

// ✅ Embed для данных которые читаются вместе (position snapshot)
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  symbol: "AAPL",
  quantity: 150,
  avgCostBasis: 183.20,
  currentData: {            // embed — всегда нужны вместе
    lastPrice: 189.50,
    marketValue: 28425.00,
    unrealizedPnl: 945.00,
    unrealizedPnlPct: 3.43
  },
  lots: [                   // Bounded array — max ~1000 lots, embed ok
    { acquiredAt: ISODate("..."), quantity: 50, price: 180.00 },
    { acquiredAt: ISODate("..."), quantity: 100, price: 185.00 }
  ],
  updatedAt: ISODate("2024-01-15T16:00:00Z")
}

// Паттерн Bucket — для time-series данных (market_data)
{
  _id: ObjectId("..."),
  symbol: "AAPL",
  date: ISODate("2024-01-15"),
  count: 1440,  // данные за каждую минуту = 1440 записей
  measurements: [
    { t: ISODate("2024-01-15T09:30:00Z"), o: 183.5, h: 184.0, l: 183.2, c: 183.8, v: 125000 },
    // ...
  ]
  // Вместо 1440 отдельных документов — один bucket document
}
```

---

**Q: Как работают индексы в MongoDB? Типы индексов.**

**A:**
```javascript
// 1. Single field index
db.trades.createIndex({ userId: 1 });
db.trades.createIndex({ createdAt: -1 }); // -1 = descending

// 2. Compound index (порядок и направление важны!)
db.trades.createIndex({ userId: 1, status: 1, createdAt: -1 });
// Покрывает запросы:
// { userId } 
// { userId, status }
// { userId, status, createdAt }
// НЕ покрывает: { status } или { status, createdAt }

// 3. Partial index — индексируем только нужные документы
db.orders.createIndex(
  { userId: 1, createdAt: -1 },
  { partialFilterExpression: { status: { $in: ['PENDING', 'OPEN'] } } }
);

// 4. Sparse index — только документы с полем (null/missing пропускаются)
db.users.createIndex({ googleId: 1 }, { sparse: true });

// 5. Unique index
db.users.createIndex({ email: 1 }, { unique: true });
db.accounts.createIndex({ accountNumber: 1 }, { unique: true });

// 6. TTL index — автоудаление устаревших документов
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// expiresAt = конкретная дата/время → документ удалится после неё

// 7. Text index — полнотекстовый поиск
db.news.createIndex({ title: 'text', content: 'text' }, { weights: { title: 10, content: 1 } });
db.news.find({ $text: { $search: "earnings report AAPL" } });

// 8. Wildcard index — для динамических полей (JSONB-подобное)
db.orders.createIndex({ "metadata.$**": 1 });

// Explain для анализа запросов
db.trades.find({ userId: ObjectId("..."), status: "OPEN" })
  .explain("executionStats");
// Смотрим:
// winningPlan.stage: "IXSCAN" (хорошо) vs "COLLSCAN" (плохо)
// executionStats.totalKeysExamined vs totalDocsExamined
// executionStats.executionTimeMillis

// Hint — принудительно выбираем индекс
db.trades.find({ userId: ObjectId("...") })
  .hint({ userId: 1, status: 1, createdAt: -1 });
```

---

## 5. Redis — Паттерны, кэширование, очереди {#redis}

---

**Q: Объясни основные структуры данных Redis и их применение в fintech.**

**A:**
```typescript
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// ===== STRING =====
// Кэш котировок (с TTL)
await redis.setex(`quote:${symbol}`, 5, JSON.stringify(quoteData)); // TTL 5 сек
const quote = await redis.get(`quote:${symbol}`);

// Distributed lock (для предотвращения двойного списания)
const lockKey = `lock:order:${userId}`;
const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10); // NX=if not exists, EX=10s
if (!acquired) throw new Error('Concurrent order detected');
try {
  await processOrder();
} finally {
  await redis.del(lockKey); // обязательно освобождаем
}

// ===== HASH =====
// Хранение портфолио (поля обновляются независимо)
await redis.hset(`portfolio:${userId}`,
  'cash', 50000,
  'totalValue', 125000,
  'dayPnl', 1250,
  'lastUpdated', Date.now()
);
const totalValue = await redis.hget(`portfolio:${userId}`, 'totalValue');
const portfolio = await redis.hgetall(`portfolio:${userId}`);

// Атомарный инкремент (счётчик ордеров, rate limiting)
await redis.hincrby(`stats:${userId}`, 'ordersToday', 1);

// ===== LIST =====
// Очередь уведомлений (FIFO)
await redis.rpush(`notifications:${userId}`, JSON.stringify(notification));
const notif = await redis.lpop(`notifications:${userId}`);

// ===== SORTED SET =====
// Leaderboard трейдеров по P&L
await redis.zadd('leaderboard:daily', pnlValue, userId);
const top10 = await redis.zrevrange('leaderboard:daily', 0, 9, 'WITHSCORES');
const myRank = await redis.zrevrank('leaderboard:daily', userId);

// Очередь с приоритетами (score = priority + timestamp)
const priority = 1; // высокий
const score = priority * 1e13 + Date.now();
await redis.zadd('order:queue', score, JSON.stringify(orderData));
// Обработчик берёт с самым высоким score:
const next = await redis.zpopmax('order:queue');

// ===== SET =====
// Online пользователи (быстрая проверка is member)
await redis.sadd('online:users', userId);
await redis.srem('online:users', userId);
const isOnline = await redis.sismember('online:users', userId);

// Символы в watchlist пользователя
await redis.sadd(`watchlist:${userId}`, ...symbols);
const watching = await redis.smembers(`watchlist:${userId}`);
```

---

**Q: Как реализовать Session Token + Refresh Token с Redis?**

**A:**
```typescript
@Injectable()
export class TokenService {
  private readonly ACCESS_TTL = 15 * 60;        // 15 минут
  private readonly REFRESH_TTL = 7 * 24 * 3600; // 7 дней

  constructor(
    private readonly redis: Redis,
    private readonly jwtService: JwtService,
  ) {}

  async createTokenPair(userId: string, deviceId: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, type: 'access' },
      { expiresIn: '15m' }
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh', jti: uuidv4() },
      { expiresIn: '7d' }
    );

    const { jti } = this.jwtService.decode(refreshToken) as any;

    // Храним refresh token в Redis (для инвалидации)
    await this.redis.setex(
      `refresh:${userId}:${deviceId}`,
      this.REFRESH_TTL,
      jti
    );

    // Blacklist для logout (храним jti отозванных токенов)
    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string, deviceId: string) {
    const payload = this.jwtService.verify(refreshToken);
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    // Проверяем что токен не отозван
    const storedJti = await this.redis.get(`refresh:${payload.sub}:${deviceId}`);
    if (storedJti !== payload.jti) {
      // Возможная атака — инвалидируем все сессии пользователя
      await this.logoutAllDevices(payload.sub);
      throw new UnauthorizedException('Token reuse detected');
    }

    // Ротация refresh token (одноразовый)
    return this.createTokenPair(payload.sub, deviceId);
  }

  async logout(userId: string, deviceId: string, jti: string) {
    await this.redis.del(`refresh:${userId}:${deviceId}`);
    // Блокируем текущий access token до истечения
    await this.redis.setex(`blacklist:${jti}`, this.ACCESS_TTL, '1');
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return (await this.redis.exists(`blacklist:${jti}`)) === 1;
  }

  async logoutAllDevices(userId: string) {
    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length) await this.redis.del(...keys);
  }
}
```

---

**Q: Redis Pub/Sub vs Redis Streams — в чём разница? Когда что использовать?**

**A:**
```typescript
// ===== PUB/SUB =====
// Fire-and-forget, нет персистентности, нет consumer groups
// Использовать для: real-time уведомления, WebSocket broadcast

// Publisher (при изменении котировки)
await redis.publish(`quote:${symbol}`, JSON.stringify({ 
  symbol, price, timestamp: Date.now() 
}));

// Subscriber (в WebSocket gateway)
const subscriber = redis.duplicate();
await subscriber.subscribe(`quote:${symbol}`);
subscriber.on('message', (channel, message) => {
  const quote = JSON.parse(message);
  this.wsGateway.broadcastToSymbol(symbol, quote);
});

// ===== REDIS STREAMS =====
// Персистентные, consumer groups, acknowledgement, replay
// Использовать для: audit log, event sourcing, надёжные очереди

// Producer — добавляем событие в stream
await redis.xadd(
  'order:events',
  '*',  // auto-generate ID
  'orderId', orderId,
  'userId', userId,
  'action', 'ORDER_PLACED',
  'data', JSON.stringify(orderData)
);

// Consumer Group — несколько воркеров обрабатывают параллельно
await redis.xgroup('CREATE', 'order:events', 'order-processors', '$', 'MKSTREAM');

// Consumer
while (true) {
  const results = await redis.xreadgroup(
    'GROUP', 'order-processors', `worker-${process.pid}`,
    'COUNT', 10,
    'BLOCK', 2000,  // ждём 2 сек если нет сообщений
    'STREAMS', 'order:events', '>'  // '>' = только новые
  );
  
  if (!results) continue;
  
  for (const [stream, messages] of results) {
    for (const [id, fields] of messages) {
      try {
        await processOrderEvent(fields);
        await redis.xack('order:events', 'order-processors', id);
      } catch (error) {
        // Сообщение остаётся в Pending Entry List (PEL)
        // другой воркер подхватит через XAUTOCLAIM
      }
    }
  }
}

// Reclaim застрявших сообщений (через 30 сек)
const claimed = await redis.xautoclaim(
  'order:events', 'order-processors', `worker-${process.pid}`,
  30_000, '0-0', 'COUNT', 10
);
```

---

## 6. REST API / GraphQL / WebSocket {#api-layer}

---

**Q: Как реализовать WebSocket для real-time market data в NestJS?**

**A:**
```typescript
import { 
  WebSocketGateway, SubscribeMessage, 
  WebSocketServer, OnGatewayConnection, OnGatewayDisconnect 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ['websocket'],
  pingTimeout: 30000,
  pingInterval: 10000,
})
export class MarketDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  private userSockets = new Map<string, Set<string>>(); // userId → socketIds
  private symbolSubscriptions = new Map<string, Set<string>>(); // symbol → socketIds

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth.token;
      const user = await this.jwtService.verifyAsync(token);
      
      socket.data.userId = user.sub;
      socket.join(`user:${user.sub}`); // room для персональных уведомлений
      
      if (!this.userSockets.has(user.sub)) {
        this.userSockets.set(user.sub, new Set());
      }
      this.userSockets.get(user.sub).add(socket.id);
      
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data.userId;
    if (userId) {
      this.userSockets.get(userId)?.delete(socket.id);
      // Отписываем от всех символов
      this.symbolSubscriptions.forEach((sockets, symbol) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          // Никто не подписан — останавливаем feed от брокера
          this.marketDataService.unsubscribeFromFeed(symbol);
          this.symbolSubscriptions.delete(symbol);
        }
      });
    }
  }

  @SubscribeMessage('subscribe:quote')
  async handleSubscribeQuote(socket: Socket, payload: { symbols: string[] }) {
    for (const symbol of payload.symbols) {
      socket.join(`quote:${symbol}`);
      
      if (!this.symbolSubscriptions.has(symbol)) {
        this.symbolSubscriptions.set(symbol, new Set());
        // Начинаем получать данные от брокера
        await this.marketDataService.subscribeToFeed(symbol, (quote) => {
          this.server.to(`quote:${symbol}`).emit('quote', quote);
        });
      }
      this.symbolSubscriptions.get(symbol).add(socket.id);
    }
    
    // Отправляем последнюю котировку сразу
    const latestQuotes = await Promise.all(
      payload.symbols.map(s => this.marketDataService.getLatestQuote(s))
    );
    socket.emit('quote:snapshot', latestQuotes);
  }

  @SubscribeMessage('unsubscribe:quote')
  handleUnsubscribeQuote(socket: Socket, payload: { symbols: string[] }) {
    for (const symbol of payload.symbols) {
      socket.leave(`quote:${symbol}`);
      this.symbolSubscriptions.get(symbol)?.delete(socket.id);
    }
  }

  // Отправить персональное уведомление (ордер исполнен)
  async notifyOrderFilled(userId: string, order: Order) {
    this.server.to(`user:${userId}`).emit('order:filled', order);
  }
}
```

---

**Q: GraphQL в NestJS — subscriptions для real-time данных.**

**A:**
```typescript
import { Resolver, Query, Mutation, Subscription, Args } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';

const pubSub = new PubSub(); // В prod использовать Redis PubSub

@Resolver(() => Order)
export class OrderResolver {
  constructor(private ordersService: OrdersService) {}

  @Query(() => [Order])
  @UseGuards(GqlAuthGuard)
  async myOrders(@CurrentUser() user: User) {
    return this.ordersService.findByUser(user.id);
  }

  @Mutation(() => Order)
  @UseGuards(GqlAuthGuard)
  async createOrder(
    @Args('input') input: CreateOrderInput,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.create(input, user.id);
    pubSub.publish('orderCreated', { orderCreated: order, userId: user.id });
    return order;
  }

  @Subscription(() => Order, {
    filter: (payload, variables, context) => {
      // Пользователь получает только свои ордера
      return payload.userId === context.req.user.id &&
             payload.orderCreated.symbol === variables.symbol;
    },
    resolve: (payload) => payload.orderCreated,
  })
  orderCreated(@Args('symbol') symbol: string) {
    return pubSub.asyncIterator('orderCreated');
  }
}

// Schema first пример для Quote
@ObjectType()
class Quote {
  @Field()
  symbol: string;
  
  @Field(() => Float)
  price: number;
  
  @Field(() => Float)
  change: number;
  
  @Field(() => Float)
  changePercent: number;
  
  @Field()
  timestamp: Date;
}
```

---

## 7. Security — OAuth2, JWT, OWASP, KYC/AML {#security}

---

**Q: Объясни полный OAuth2 Authorization Code Flow с PKCE.**

**A:**
```typescript
// PKCE (Proof Key for Code Exchange) — защита от перехвата authorization code

// Шаг 1: Frontend генерирует code_verifier и code_challenge
// code_verifier = случайная строка 43-128 символов
// code_challenge = BASE64URL(SHA256(code_verifier))

function generatePKCE() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

// Шаг 2: Редирект на Authorization Server
const authUrl = new URL('https://auth.provider.com/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', 'openid profile email trading:read');
authUrl.searchParams.set('state', state); // CSRF protection
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// Шаг 3: Backend обменивает code на tokens
@Post('auth/callback')
async handleCallback(@Body() dto: AuthCallbackDto) {
  const { code, state } = dto;
  
  // Верифицируем state (CSRF защита)
  const storedState = await this.redis.get(`oauth:state:${dto.sessionId}`);
  if (state !== storedState) throw new UnauthorizedException('Invalid state');
  
  // Получаем codeVerifier из сессии
  const codeVerifier = await this.redis.get(`oauth:verifier:${dto.sessionId}`);
  
  const tokenResponse = await fetch('https://auth.provider.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET, // Только на backend!
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier, // Подтверждаем что мы тот кто начал flow
    }),
  });
  
  const { access_token, refresh_token, id_token, expires_in } = await tokenResponse.json();
  
  // Верифицируем id_token (JWT от OIDC provider)
  const userInfo = await this.jwtService.verifyIdToken(id_token);
  
  // Создаём или обновляем пользователя
  const user = await this.userService.upsert({
    externalId: userInfo.sub,
    email: userInfo.email,
    provider: 'google',
  });
  
  return this.tokenService.createTokenPair(user.id, dto.deviceId);
}
```

---

**Q: Основные OWASP уязвимости и защита в fintech API.**

**A:**
```typescript
// ===== A01: Broken Access Control =====

// Всегда используем userId из JWT, НЕ из body/params
// ❌ ПЛОХО
@Get('orders/:userId')
getOrders(@Param('userId') userId: string) {
  return this.ordersService.findByUser(userId); // Любой может запросить чужие ордера!
}

// ✅ ХОРОШО
@Get('orders')
@UseGuards(JwtAuthGuard)
getOrders(@CurrentUser() user: JwtPayload) {
  return this.ordersService.findByUser(user.sub); // Только свои ордера
}

// ===== A02: Cryptographic Failures =====
// Правильное хранение паролей
import * as argon2 from 'argon2';
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64MB
  timeCost: 3,
  parallelism: 4,
});
const valid = await argon2.verify(hash, password);

// Шифрование чувствительных данных (PAN, IBAN)
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ===== A03: Injection =====
// SQL Injection — используем parameterized queries (Prisma/TypeORM это делают)
// ❌ ПЛОХО
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ ХОРОШО (Prisma)
await prisma.user.findUnique({ where: { email } });

// ✅ ХОРОШО (raw query с параметрами)
await prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`;

// ===== A07: Identification and Authentication Failures =====
// Защита от brute force
@Post('auth/login')
async login(@Body() dto: LoginDto, @Ip() ip: string) {
  const key = `login:attempts:${ip}`;
  const attempts = await this.redis.incr(key);
  await this.redis.expire(key, 900); // 15 минут
  
  if (attempts > 10) {
    throw new TooManyRequestsException('Too many login attempts. Try again in 15 minutes.');
  }
  
  const user = await this.authService.validateUser(dto.email, dto.password);
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }
  
  // Успешный вход — сбрасываем счётчик
  await this.redis.del(key);
  return this.tokenService.createTokenPair(user.id, dto.deviceId);
}

// ===== Security Headers =====
// В main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'wss://api.myapp.com'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

---

**Q: Как работает KYC/AML flow? Как интегрировать сервис верификации?**

**A:**
```typescript
// KYC (Know Your Customer) — верификация личности
// AML (Anti-Money Laundering) — мониторинг подозрительной активности

enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  DOCUMENTS_UPLOADED = 'DOCUMENTS_UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ADDITIONAL_DOCS_REQUIRED = 'ADDITIONAL_DOCS_REQUIRED',
}

@Injectable()
export class KYCService {
  constructor(
    private readonly sumsub: SumSubService, // или Jumio, Onfido
    private readonly userRepo: UserRepository,
    private readonly amlService: AMLService,
  ) {}

  async initiateVerification(userId: string): Promise<KYCSession> {
    const user = await this.userRepo.findById(userId);
    
    // Создаём applicant в провайдере
    const applicant = await this.sumsub.createApplicant({
      externalUserId: userId,
      email: user.email,
      country: user.country,
      levelName: 'basic-kyc-level', // уровень верификации
    });

    await this.userRepo.update(userId, {
      kycApplicantId: applicant.id,
      kycStatus: KYCStatus.PENDING,
    });

    // Генерируем SDK token для frontend (пользователь загружает документы)
    const sdkToken = await this.sumsub.generateSDKToken(applicant.id);
    return { sdkToken, applicantId: applicant.id };
  }

  // Webhook от KYC провайдера
  async handleWebhook(payload: KYCWebhookPayload, signature: string) {
    // Верификация подписи вебхука
    const expectedSig = crypto
      .createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSig) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const { type, applicantId, reviewResult } = payload;

    if (type === 'applicantReviewed') {
      const user = await this.userRepo.findByKYCApplicantId(applicantId);
      
      if (reviewResult.reviewAnswer === 'GREEN') {
        // KYC прошёл — запускаем AML проверку
        await this.userRepo.update(user.id, { kycStatus: KYCStatus.APPROVED });
        await this.amlService.screenUser(user);
      } else {
        const rejectLabels = reviewResult.rejectLabels; // ['FORGERY', 'DOCUMENT_PAGE_MISSING']
        await this.userRepo.update(user.id, {
          kycStatus: KYCStatus.REJECTED,
          kycRejectReason: rejectLabels.join(', '),
        });
      }
    }
  }
}

// AML Transaction Monitoring
@Injectable()
export class AMLService {
  // Правила мониторинга транзакций
  async checkTransaction(transaction: Transaction): Promise<AMLResult> {
    const rules = [
      this.checkLargeTransaction(transaction),       // > $10,000 → CTR в США
      this.checkRapidMovements(transaction),          // Много маленьких транзакций
      this.checkSanctionsList(transaction),           // OFAC, UN sanctions
      this.checkUnusualActivity(transaction),         // Отличается от паттерна
    ];

    const results = await Promise.all(rules);
    const flags = results.filter(r => r.flagged);
    
    if (flags.length > 0) {
      await this.createSuspiciousActivityReport({
        transactionId: transaction.id,
        userId: transaction.userId,
        flags: flags.map(f => f.reason),
        riskScore: this.calculateRiskScore(flags),
      });
    }

    return { approved: flags.length === 0, flags };
  }

  private async checkLargeTransaction(tx: Transaction): Promise<RuleResult> {
    const THRESHOLD = 10_000; // $10K — CTR reporting threshold
    return {
      flagged: tx.amount >= THRESHOLD,
      reason: tx.amount >= THRESHOLD ? 'LARGE_TRANSACTION_CTR_REQUIRED' : null,
    };
  }
  
  private async checkSanctionsList(tx: Transaction): Promise<RuleResult> {
    // Интеграция с OFAC API или собственная БД санкций
    const isSanctioned = await this.sanctionsDb.check(tx.counterpartyId);
    return { flagged: isSanctioned, reason: isSanctioned ? 'SANCTIONED_ENTITY' : null };
  }
}
```

---

## 8. Fintech Domain — IBKR, Bloomberg, Trading {#fintech-domain}

---

**Q: Как интегрировать Interactive Brokers API? Опиши архитектуру.**

**A:**
```typescript
// IBKR предлагает несколько API:
// 1. TWS API (FIX/TCP) — для прямого подключения к TWS
// 2. Client Portal Web API (REST) — через браузерную сессию
// 3. IBKR Gateway — headless версия TWS

// Архитектура интеграции:
// [NestJS App] → [IBKR Adapter Service] → [IBKR Gateway] → [IBKR Servers]

@Injectable()
export class IBKRAdapterService implements BrokerAdapter {
  private client: IBApi;
  private readonly eventBus = new EventEmitter();

  async connect(): Promise<void> {
    this.client = new IBApi({
      host: this.config.get('IBKR_HOST'), // 127.0.0.1
      port: this.config.get('IBKR_PORT'), // 4002 (paper) / 4001 (live)
      clientId: this.config.get('IBKR_CLIENT_ID'), // уникальный ID
    });

    await this.client.connect();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Обновления статуса ордеров
    this.client.on('orderStatus', (orderId, status, filled, remaining, avgFillPrice) => {
      this.eventBus.emit('orderUpdate', {
        brokerOrderId: orderId,
        status: this.mapStatus(status), // 'Filled' → 'FILLED'
        filledQty: filled,
        remainingQty: remaining,
        avgPrice: avgFillPrice,
      });
    });

    // Рыночные данные
    this.client.on('tickPrice', (tickerId, tickType, price) => {
      if (tickType === TickType.LAST) {
        this.eventBus.emit('priceUpdate', {
          symbol: this.tickerSymbolMap.get(tickerId),
          price,
          timestamp: Date.now(),
        });
      }
    });

    // Ошибки
    this.client.on('error', (err, code, reqId) => {
      this.logger.error({ error: err.message, code, reqId });
      // Специфические коды ошибок IBKR
      if (code === 1100) { // Connectivity lost
        this.reconnect();
      }
    });
  }

  async placeOrder(order: OrderRequest): Promise<string> {
    const contract = this.buildContract(order.symbol, order.assetClass);
    const ibkrOrder = this.buildOrder(order);
    
    const orderId = await this.client.placeOrder(contract, ibkrOrder);
    
    // Ждём подтверждения
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Order timeout')), 30_000);
      
      this.eventBus.once(`order:${orderId}:submitted`, (confirmation) => {
        clearTimeout(timeout);
        resolve(confirmation.brokerOrderId);
      });
    });
  }

  private buildContract(symbol: string, assetClass: string): Contract {
    return {
      symbol,
      secType: assetClass === 'STOCK' ? 'STK' : 'FUT',
      exchange: 'SMART', // Smart routing
      currency: 'USD',
    };
  }

  private buildOrder(order: OrderRequest): Order {
    const ibkrOrder: Order = {
      action: order.side === 'BUY' ? 'BUY' : 'SELL',
      totalQuantity: order.quantity,
      orderType: order.type === 'MARKET' ? 'MKT' : 'LMT',
    };
    if (order.limitPrice) ibkrOrder.lmtPrice = order.limitPrice;
    return ibkrOrder;
  }

  // Подписка на котировки
  async subscribeToQuotes(symbol: string): Promise<() => void> {
    const contract = this.buildContract(symbol, 'STOCK');
    const tickerId = this.nextTickerId++;
    this.tickerSymbolMap.set(tickerId, symbol);
    
    this.client.reqMktData(tickerId, contract, '', false, false);
    
    // Возвращаем функцию отписки
    return () => {
      this.client.cancelMktData(tickerId);
      this.tickerSymbolMap.delete(tickerId);
    };
  }
}

// Broker Adapter Interface для поддержки нескольких брокеров
interface BrokerAdapter {
  connect(): Promise<void>;
  placeOrder(order: OrderRequest): Promise<string>;
  cancelOrder(brokerOrderId: string): Promise<void>;
  subscribeToQuotes(symbol: string): Promise<() => void>;
  getPositions(accountId: string): Promise<Position[]>;
  getAccountInfo(accountId: string): Promise<AccountInfo>;
}
```

---

**Q: Объясни типы ордеров и их логику исполнения.**

**A:**
```typescript
// Market Order — исполняется немедленно по лучшей доступной цене
// Риск: slippage при низкой ликвидности

// Limit Order — исполняется только по указанной цене или лучше
// BUY Limit → исполняется если рыночная цена ≤ limitPrice
// SELL Limit → исполняется если рыночная цена ≥ limitPrice

// Stop Order (Stop Market) — становится Market Order когда цена достигает stopPrice
// Используется для: stop-loss (защита от убытков)

// Stop-Limit Order — становится Limit Order когда цена достигает stopPrice
// Защищает от плохого fill, но может не исполниться

// Time in Force:
// DAY — активен только в текущей торговой сессии
// GTC (Good Till Cancelled) — активен до исполнения или отмены
// IOC (Immediate or Cancel) — исполнить немедленно, остаток отменить
// FOK (Fill or Kill) — исполнить полностью немедленно или отменить

// Пример логики Stop-Loss автоматизации
@Injectable()
export class StopLossService {
  private stopOrders = new Map<string, StopOrderConfig>(); // symbol → stop configs

  constructor(
    private readonly wsGateway: MarketDataGateway,
    private readonly orderService: OrderService,
  ) {
    // Подписываемся на обновления цен
    this.wsGateway.onPriceUpdate(this.checkStopLoss.bind(this));
  }

  async setStopLoss(userId: string, symbol: string, stopPrice: number, quantity: number) {
    const config = { userId, symbol, stopPrice, quantity, type: 'STOP_LOSS' };
    const key = `${userId}:${symbol}`;
    this.stopOrders.set(key, config);
    
    // Персистируем в Redis
    await this.redis.setex(`stop_loss:${key}`, 86400, JSON.stringify(config));
  }

  private async checkStopLoss({ symbol, price }: PriceUpdate) {
    const entries = [...this.stopOrders.entries()];
    
    for (const [key, config] of entries) {
      if (config.symbol !== symbol) continue;
      
      // Проверяем условие срабатывания
      const triggered = config.type === 'STOP_LOSS' 
        ? price <= config.stopPrice  // Long position stop loss
        : price >= config.stopPrice; // Short position stop loss
      
      if (triggered) {
        this.stopOrders.delete(key);
        await this.redis.del(`stop_loss:${key}`);
        
        // Создаём Market Order
        await this.orderService.create({
          userId: config.userId,
          symbol: config.symbol,
          side: 'SELL',
          quantity: config.quantity,
          type: 'MARKET',
          reason: 'STOP_LOSS_TRIGGERED',
        });
      }
    }
  }
}
```

---

## 9. Real-Time — Market Data, Order Status {#realtime}

---

**Q: Архитектура системы real-time котировок для 10,000 одновременных пользователей.**

**A:**
```
Архитектура:

[IBKR/Bloomberg Feed] 
        ↓
[Market Data Ingestion Service]  ← единая точка получения данных от брокера
        ↓
[Redis Pub/Sub]
        ↓           ↓           ↓
[WS Server 1]  [WS Server 2]  [WS Server N]  ← горизонтальное масштабирование
        ↓           ↓           ↓
    [Clients]   [Clients]   [Clients]

Ключевые решения:
1. Один инстанс получает данные от брокера (IBKR ограничивает подключения)
2. Redis Pub/Sub распределяет между WS серверами
3. Socket.io с Redis Adapter для sticky sessions
4. Throttling: не шлём котировку чаще чем раз в 100ms на клиента
```

```typescript
// Market Data Ingestion Service
@Injectable()
export class MarketDataIngestionService {
  private activeSymbols = new Set<string>();
  private lastPublished = new Map<string, number>(); // symbol → timestamp
  private readonly THROTTLE_MS = 100; // max 10 updates/sec per symbol

  async onPriceUpdate(symbol: string, data: QuoteData) {
    const now = Date.now();
    const lastTime = this.lastPublished.get(symbol) ?? 0;
    
    // Throttling — не перегружаем Redis
    if (now - lastTime < this.THROTTLE_MS) return;
    
    this.lastPublished.set(symbol, now);
    
    // Кэшируем последнюю котировку
    await this.redis.setex(
      `quote:latest:${symbol}`,
      60,
      JSON.stringify({ ...data, timestamp: now })
    );
    
    // Публикуем в Pub/Sub
    await this.redis.publish(`market:${symbol}`, JSON.stringify(data));
    
    // Проверяем alert условия асинхронно (не блокируем pipeline)
    this.checkPriceAlerts(symbol, data.price).catch(err => 
      this.logger.error(`Alert check failed: ${err.message}`)
    );
  }
}

// Socket.io с Redis Adapter для multi-server setup
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

async function setupSocketIO(app: INestApplication) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  await Promise.all([pubClient.connect(), subClient.connect()]);
  
  const io = app.get(Server); // socket.io server
  io.adapter(createAdapter(pubClient, subClient));
}
```

---

## 10. Docker / CI/CD {#devops}

---

**Q: Напиши production-ready Dockerfile для NestJS приложения.**

**A:**
```dockerfile
# Multi-stage build

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# CI=true предотвращает интерактивные prompts
RUN npm ci --only=production && cp -r node_modules /tmp/prod_modules
RUN npm ci  # устанавливаем ВСЕ зависимости для build

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Security: не запускаем от root
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Только production зависимости
COPY --from=deps /tmp/prod_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Prisma schema для generate
COPY prisma ./prisma

USER nestjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml для разработки
version: '3.9'

services:
  api:
    build:
      context: .
      target: builder  # используем builder stage для hot reload
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run start:dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/fintech
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: fintech
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass redispassword
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

volumes:
  postgres_data:
  redis_data:
```

---

**Q: Напиши GitHub Actions pipeline для NestJS с тестами и деплоем.**

**A:**
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ===== TEST =====
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: fintech_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/fintech_test
      
      - name: Run unit tests
        run: npm run test:cov
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/fintech_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test_secret
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test_password@localhost:5432/fintech_test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  # ===== SECURITY SCAN =====
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run npm audit
        run: npm audit --audit-level=high
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  # ===== BUILD & DEPLOY =====
  deploy:
    needs: [test, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/fintech-api:$IMAGE_TAG .
          docker push $ECR_REGISTRY/fintech-api:$IMAGE_TAG
          # Тегируем как latest для rollback
          docker tag $ECR_REGISTRY/fintech-api:$IMAGE_TAG $ECR_REGISTRY/fintech-api:latest
          docker push $ECR_REGISTRY/fintech-api:latest
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster fintech-cluster \
            --service fintech-api \
            --force-new-deployment
      
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster fintech-cluster \
            --services fintech-api
      
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 11. React / Next.js — Фронтенд вопросы {#frontend}

---

**Q: Объясни React rendering оптимизации для trading dashboard с частыми обновлениями.**

**A:**
```tsx
// Проблема: котировки обновляются каждые 100ms → перерендер всего дерева

// ❌ ПЛОХО: Один большой state
function TradingDashboard() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  // Любое обновление котировки → перерендер всего Dashboard
}

// ✅ ХОРОШО: Разбиваем на атомарные состояния + мемоизация
import { create } from 'zustand'; // или Redux Toolkit

interface QuoteStore {
  quotes: Record<string, Quote>;
  updateQuote: (symbol: string, quote: Quote) => void;
}

const useQuoteStore = create<QuoteStore>((set) => ({
  quotes: {},
  updateQuote: (symbol, quote) =>
    set((state) => ({
      quotes: { ...state.quotes, [symbol]: quote },
    })),
}));

// Компонент подписан только на конкретный символ
const QuoteCell = memo(({ symbol }: { symbol: string }) => {
  const quote = useQuoteStore((state) => state.quotes[symbol]); // selector
  const prevPrice = useRef<number>();
  
  const priceDirection = useMemo(() => {
    if (!prevPrice.current || !quote) return 'neutral';
    const dir = quote.price > prevPrice.current ? 'up' : 'down';
    prevPrice.current = quote.price;
    return dir;
  }, [quote?.price]);

  return (
    <span className={`price ${priceDirection}`}>
      {quote?.price.toFixed(2) ?? '—'}
    </span>
  );
});

// React Query для серверного состояния
function usePortfolio(userId: string) {
  return useQuery({
    queryKey: ['portfolio', userId],
    queryFn: () => api.getPortfolio(userId),
    staleTime: 30_000,       // 30 сек до refetch
    gcTime: 5 * 60_000,     // 5 мин в кэше
    refetchOnWindowFocus: true,
    select: (data) => ({     // трансформация для производительности
      totalValue: data.positions.reduce((sum, p) => sum + p.marketValue, 0),
      positions: data.positions.sort((a, b) => b.marketValue - a.marketValue),
    }),
  });
}

// Виртуализация для большого списка позиций
import { FixedSizeList as List } from 'react-window';

function PositionsList({ positions }: { positions: Position[] }) {
  const Row = useCallback(({ index, style }: { index: number; style: CSSProperties }) => (
    <div style={style}>
      <PositionRow position={positions[index]} />
    </div>
  ), [positions]);

  return (
    <List
      height={600}
      itemCount={positions.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

---

**Q: Как реализовать optimistic updates для создания ордера с React Query?**

**A:**
```tsx
function useCreateOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (order: CreateOrderDto) => api.createOrder(order),
    
    // Optimistic update — показываем результат ДО ответа сервера
    onMutate: async (newOrder) => {
      // Отменяем исходящие запросы (чтобы не перезаписали)
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      
      // Сохраняем предыдущие данные для rollback
      const previousOrders = queryClient.getQueryData<Order[]>(['orders']);
      
      // Оптимистично обновляем кэш
      queryClient.setQueryData<Order[]>(['orders'], (old = []) => [
        {
          id: `temp-${Date.now()}`,
          ...newOrder,
          status: 'PENDING',
          createdAt: new Date(),
        },
        ...old,
      ]);
      
      return { previousOrders }; // context для onError
    },
    
    onError: (error, _variables, context) => {
      // Откатываем при ошибке
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      toast.error(`Order failed: ${error.message}`);
    },
    
    onSuccess: (data) => {
      toast.success(`Order placed! ID: ${data.id}`);
    },
    
    onSettled: () => {
      // Инвалидируем для получения реального состояния с сервера
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
  });
}

// Использование в компоненте
function OrderForm() {
  const { mutate: createOrder, isPending } = useCreateOrder();
  
  const handleSubmit = (data: CreateOrderDto) => {
    createOrder(data);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Placing order...' : 'Place Order'}
      </button>
    </form>
  );
}
```

---

## 12. System Design — Fintech Architecture {#system-design}

---

**Q: Спроектируй систему portfolio management для 1 млн пользователей.**

**A:**
```
Требования:
- 1 млн пользователей
- Real-time P&L обновления
- Исторические данные
- Торговля через несколько брокеров
- SLA: 99.9% uptime, <200ms latency

===== HIGH LEVEL ARCHITECTURE =====

[Clients] → [CDN/Load Balancer] → [API Gateway]
                                          ↓
                            ┌─────────────────────────┐
                            │     Microservices        │
                            ├──────────┬──────────────┤
                            │  Auth    │  Orders      │
                            │  Service │  Service     │
                            ├──────────┼──────────────┤
                            │ Portfolio│  Market Data │
                            │  Service │  Service     │
                            ├──────────┼──────────────┤
                            │  KYC/AML │ Notifications│
                            │  Service │  Service     │
                            └──────────┴──────────────┘
                                         ↓
                            ┌─────────────────────────┐
                            │      Data Layer          │
                            ├──────────┬──────────────┤
                            │PostgreSQL│   MongoDB     │
                            │(transact)│ (time-series) │
                            ├──────────┼──────────────┤
                            │  Redis   │  Kafka/MQ    │
                            │ (cache)  │ (events)     │
                            └──────────┴──────────────┘
                                         ↓
                            ┌─────────────────────────┐
                            │    Broker Integration    │
                            │   IBKR | Bloomberg | FIX │
                            └─────────────────────────┘

===== DATA MODELS =====

PostgreSQL:
- users, accounts, orders, transactions, audit_logs
- ACID гарантии для финансовых операций

MongoDB:
- portfolio_snapshots (hourly snapshots)
- market_data (bucket pattern, time-series)
- user_activity_logs

Redis:
- Session/JWT tokens
- Real-time quotes cache (5 sec TTL)
- Portfolio cache (30 sec TTL)
- Rate limiting counters
- Pub/Sub для real-time updates

===== PORTFOLIO VALUE CALCULATION =====

Стратегия: не вычислять на лету каждый раз

1. Background job каждые 30 секунд:
   - Получает все открытые позиции
   - Умножает quantity × current_price
   - Сохраняет снапшот в MongoDB
   - Обновляет Redis кэш

2. При запросе /api/portfolio:
   - Читаем из Redis (если cache hit)
   - Fallback: MongoDB последний снапшот
   - Добавляем дельту изменений цен с момента снапшота

===== REAL-TIME UPDATES =====

Market Data Flow:
[IBKR] → [Ingestion Service] → [Kafka topic: market.quotes]
                                          ↓
                               [Portfolio Calculator]
                                     (consumer)
                                          ↓
                                [Redis Pub/Sub]
                                          ↓
                              [WebSocket Servers]
                                          ↓
                                    [Clients]

===== SCALING DECISIONS =====

Orders Service: горизонтальное масштабирование, stateless
Market Data Ingestion: SINGLE instance (брокер ограничивает подключения)
WebSocket Server: horizontal scale с Redis Adapter
Database: PostgreSQL primary + read replicas
  - Writes → primary
  - Portfolio reads → read replica
  - Analytics → read replica or separate OLAP

===== FAULT TOLERANCE =====

Circuit Breaker для брокерских API
Dead Letter Queue для failed orders
Idempotent order submission (уникальный clientOrderId)
Saga pattern для multi-step transactions
Database: Point-in-Time Recovery включён
Мониторинг: Prometheus + Grafana, alerts на SLA метрики
```

---

## 13. Live Coding Tasks {#live-coding}

---

### Задача 1: Rate Limiter

**Задание:** Реализуй rate limiter с алгоритмом sliding window.

```typescript
class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>(); // key → timestamps
  
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.windows.has(key)) {
      this.windows.set(key, []);
    }
    
    const requests = this.windows.get(key)!;
    
    // Удаляем запросы за пределами окна
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      this.windows.set(key, validRequests);
      return false;
    }
    
    validRequests.push(now);
    this.windows.set(key, validRequests);
    return true;
  }
  
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = (this.windows.get(key) ?? []).filter(t => t > windowStart);
    return Math.max(0, this.maxRequests - requests.length);
  }
}

// Использование
const limiter = new SlidingWindowRateLimiter(10, 60_000); // 10 req/min
console.log(limiter.isAllowed('user:123')); // true
```

---

### Задача 2: LRU Cache

**Задание:** Реализуй LRU Cache для котировок (O(1) get и put).

```typescript
class LRUCache<K, V> {
  private map = new Map<K, V>(); // Map сохраняет порядок вставки
  
  constructor(private readonly capacity: number) {}
  
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    
    // Перемещаем в конец (наиболее недавно использованный)
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  
  put(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key); // удаляем для перемещения в конец
    } else if (this.map.size >= this.capacity) {
      // Удаляем самый старый (первый в Map)
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
  
  has(key: K): boolean {
    return this.map.has(key);
  }
}

// Тест
const cache = new LRUCache<string, number>(3);
cache.put('AAPL', 185);
cache.put('MSFT', 375);
cache.put('GOOGL', 140);
cache.get('AAPL'); // обращаемся к AAPL → он теперь последний
cache.put('AMZN', 180); // вытесняем MSFT (наименее недавно использованный)
console.log(cache.has('MSFT')); // false
console.log(cache.has('AAPL')); // true
```

---

### Задача 3: Debounce и Throttle

**Задание:** Напиши debounce и throttle с TypeScript.

```typescript
// Debounce — выполняет функцию только после паузы
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle — выполняет не чаще чем раз в interval
function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function (...args: Parameters<T>) {
    const now = Date.now();
    const remaining = interval - (now - lastCall);
    
    if (remaining <= 0) {
      clearTimeout(timeoutId);
      lastCall = now;
      fn(...args);
    } else {
      clearTimeout(timeoutId);
      // Гарантируем последний вызов после throttle
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

// Применение в trading UI
const updatePriceDisplay = throttle((price: number) => {
  document.getElementById('price')!.textContent = price.toFixed(2);
}, 100); // max 10 updates/sec

const searchSymbols = debounce(async (query: string) => {
  const results = await api.searchSymbols(query);
  setSearchResults(results);
}, 300); // ждём 300ms после последнего нажатия клавиши
```

---

### Задача 4: Async Queue с параллелизмом

**Задание:** Реализуй очередь задач с ограниченным параллелизмом (Pool).

```typescript
class AsyncQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  
  constructor(private readonly concurrency: number) {}
  
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.run();
        }
      });
      this.run();
    });
  }
  
  private run(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      task();
    }
  }
}

// Использование: параллельно обрабатываем не более 3 ордеров
const queue = new AsyncQueue(3);

const orders = [order1, order2, order3, order4, order5];
await Promise.all(
  orders.map(order => queue.add(() => processOrder(order)))
);
```

---

### Задача 5: Promise.all с таймаутом

**Задание:** Получить котировки от нескольких источников с таймаутом.

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function getQuoteWithFallbacks(symbol: string): Promise<Quote> {
  // Пробуем источники параллельно, берём первый успешный
  const sources = [
    withTimeout(ibkrService.getQuote(symbol), 500, 'IBKR'),
    withTimeout(bloombergService.getQuote(symbol), 800, 'Bloomberg'),
    withTimeout(polygonService.getQuote(symbol), 1000, 'Polygon'),
  ];
  
  // Promise.any — первый resolved, если все rejected → AggregateError
  try {
    return await Promise.any(sources);
  } catch (error) {
    // Все источники упали — возвращаем кэшированное значение
    const cached = await redis.get(`quote:${symbol}`);
    if (cached) return JSON.parse(cached);
    throw new ServiceUnavailableException(`No quote available for ${symbol}`);
  }
}

// Promise.allSettled — нужны все результаты, даже если часть упала
async function getMultipleQuotes(symbols: string[]): Promise<QuoteResult[]> {
  const results = await Promise.allSettled(
    symbols.map(s => withTimeout(getQuoteWithFallbacks(s), 2000, s))
  );
  
  return results.map((result, i) => ({
    symbol: symbols[i],
    quote: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason.message : null,
  }));
}
```

---

### Задача 6: Deep Clone

```typescript
// Без structuredClone — реализуй сам
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (obj instanceof Map) {
    return new Map([...obj.entries()].map(([k, v]) => [deepClone(k), deepClone(v)])) as unknown as T;
  }
  if (obj instanceof Set) {
    return new Set([...obj].map(item => deepClone(item))) as unknown as T;
  }
  
  const cloned = Object.create(Object.getPrototypeOf(obj));
  for (const key of Object.keys(obj as object)) {
    cloned[key] = deepClone((obj as any)[key]);
  }
  return cloned;
}
```

---

### Задача 7: EventEmitter с типизацией

```typescript
type EventMap = Record<string, any>;

class TypedEventEmitter<Events extends EventMap> {
  private listeners = new Map<keyof Events, Set<Function>>();

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    const wrapper = (data: Events[K]) => {
      listener(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.listeners.get(event)?.forEach(listener => listener(data));
  }
}

// Использование — типобезопасно
interface TradingEvents {
  'order:filled': { orderId: string; price: number; quantity: number };
  'order:cancelled': { orderId: string; reason: string };
  'portfolio:updated': { totalValue: number; dayPnl: number };
}

const emitter = new TypedEventEmitter<TradingEvents>();

emitter.on('order:filled', ({ orderId, price }) => {
  console.log(`Order ${orderId} filled at ${price}`);
});

emitter.emit('order:filled', { orderId: '123', price: 185.5, quantity: 100 });
```

---

### Задача 8: Flatten вложенного объекта

```typescript
// Превратить { a: { b: { c: 1 } }, d: 2 } → { 'a.b.c': 1, 'd': 2 }
// Полезно для MongoDB $set операций

function flatten(
  obj: Record<string, any>, 
  prefix = '', 
  result: Record<string, any> = {}
): Record<string, any> {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      flatten(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

// Использование для MongoDB partial update
const update = { profile: { firstName: 'John' }, preferences: { currency: 'EUR' } };
const flatUpdate = flatten(update);
// { 'profile.firstName': 'John', 'preferences.currency': 'EUR' }
await db.users.updateOne({ _id: userId }, { $set: flatUpdate });
```

---

### Задача 9: Retry с exponential backoff

```typescript
interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay?: number;
  factor?: number;
  shouldRetry?: (error: Error) => boolean;
}

async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { 
    maxAttempts, 
    initialDelay, 
    maxDelay = 30_000, 
    factor = 2,
    shouldRetry = () => true 
  } = options;
  
  let attempt = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      if (attempt >= maxAttempts || !shouldRetry(error as Error)) {
        throw error;
      }
      
      // Exponential backoff с jitter (случайность предотвращает thundering herd)
      const exponentialDelay = initialDelay * Math.pow(factor, attempt - 1);
      const jitter = Math.random() * initialDelay;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Использование
const orderResult = await retry(
  () => ibkrService.submitOrder(order),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10_000,
    shouldRetry: (error) => {
      // Не повторяем если ошибка бизнес-логики (недостаточно средств)
      return !(error instanceof InsufficientFundsError);
    },
  }
);
```

---

## 14. Поведенческие вопросы {#behavioral}

---

**Q: Расскажи о сложной технической проблеме которую ты решил.**

**Структура ответа STAR:**
```
Situation: Опиши контекст и масштаб проблемы
  "В нашем trading приложении при высокой нагрузке (>500 одновременных пользователей) 
   происходила потеря WebSocket соединений и котировки переставали обновляться"

Task: Что нужно было сделать
  "Нужно было обеспечить стабильную работу real-time data feed с SLA 99.9%
   при горизонтальном масштабировании"

Action: Что конкретно ты сделал
  "Профилировал с помощью clinic.js — нашёл memory leak в Map подписчиков.
   Реализовал Redis Pub/Sub для синхронизации между инстансами.
   Добавил heartbeat механизм с автореконнектом.
   Внедрил monitoring с метриками connected clients, message rate, error rate"

Result: Результат
  "Стабильность 99.95% uptime, задержка доставки котировок 50ms p95,
   поддержка 5000 одновременных соединений"
```

---

**Q: Как ты подходишь к code review?**

```
- Проверяю логику, а не стиль (для стиля есть linter/prettier)
- Ищу: N+1 запросы, отсутствие обработки ошибок, race conditions
- В fintech особо смотрю: транзакционная целостность, аудит лог, security (SQL injection, auth checks)
- Комментарии конструктивные с объяснением "почему", а не просто "неправильно"
- Хвалю хорошие решения — мотивирует команду
- Если есть критичная проблема — зову синхронно поговорить, не пишу простыни в комментах
```

---

**Q: Как обеспечить качество кода в команде?**

```
1. Code Review процесс:
   - PR шаблоны с чеклистом (security, tests, migrations)
   - Минимум 2 аппрувала для merge в main
   - Автоматические checks: lint, tests, security scan

2. Тестирование:
   - Unit: jest, >80% coverage для business logic
   - Integration: тестируем API endpoints с реальной БД
   - E2E: cypress/playwright для критичных flows (регистрация, торговля)
   
3. Статический анализ:
   - ESLint с strict rules
   - TypeScript strict mode
   - SonarQube для code smells
   
4. Документация:
   - OpenAPI/Swagger для API
   - JSDoc для сложной бизнес-логики
   - ADR (Architecture Decision Records) для важных решений

5. Definition of Done:
   - Tests написаны
   - No console.log в production коде
   - Monitoring/alerting добавлен
   - Security checklist пройден
```

---

## Быстрый справочник — частые вопросы на интервью

| Тема | Вопрос | Ключевые слова ответа |
|------|--------|----------------------|
| Node.js | Event Loop | microtasks, macrotasks, nextTick, phases |
| Node.js | Memory leak | closures, global state, event listeners, WeakMap |
| Node.js | Streams | backpressure, pipe, Transform, highWaterMark |
| NestJS | DI Scopes | Singleton, Request, Transient |
| NestJS | Guards vs Middleware | Guards имеют доступ к ExecutionContext |
| PostgreSQL | EXPLAIN | Seq Scan, Index Scan, cost, actual rows |
| PostgreSQL | Deadlock | одинаковый порядок блокировок, timeout, retry |
| MongoDB | ObjectId | 4b timestamp + 5b random + 3b counter, monotonic |
| Redis | Persistence | RDB (snapshots) vs AOF (append-only log) |
| Redis | Cluster | hash slots (16384), gossip protocol |
| Security | CSRF | SameSite cookie, CSRF token |
| Security | XSS | CSP headers, escape output, sanitize input |
| Security | SQL Injection | parameterized queries, ORM |
| TypeScript | any vs unknown | unknown требует type narrowing перед использованием |
| TypeScript | interface vs type | type: union/intersect, interface: merging/extending |

---

## Полезные ссылки для подготовки

- [Node.js Event Loop визуализация](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick)
- [PostgreSQL EXPLAIN документация](https://www.postgresql.org/docs/current/sql-explain.html)
- [MongoDB Aggregation Reference](https://www.mongodb.com/docs/manual/aggregation/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

*Подготовлено для собеседования в Itexus — Fullstack Developer (Fintech) — Middle/Senior уровень*
