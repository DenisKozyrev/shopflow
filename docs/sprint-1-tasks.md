# Sprint 1 Tasks — Foundation & Auth

Скопируй и создай каждый issue через `gh issue create` или вручную через GitHub UI.

## SF-1: Setup Turborepo monorepo structure
**Labels:** infra, sprint-1
**Description:**
- Configure Turborepo with `turbo.json`
- Setup npm workspaces (`apps/*`, `packages/*`)
- Configure root `tsconfig.json` with path aliases
- Add Prettier + ESLint configuration
- Verify `turbo run build` works across all packages

**Acceptance Criteria:**
- [ ] `npm run build` runs successfully from root
- [ ] Path aliases (`@shopflow/common`, etc.) resolve correctly
- [ ] ESLint passes on all packages

---

## SF-2: Docker Compose — local infrastructure
**Labels:** infra, sprint-1
**Description:**
Setup local development infrastructure:
- PostgreSQL 16 with healthcheck
- Redis 7 with healthcheck  
- Kafka + Zookeeper (Confluent 7.6)
- Kafka UI at port 8080

**Acceptance Criteria:**
- [ ] `docker compose up -d postgres redis zookeeper kafka kafka-ui` runs without errors
- [ ] PostgreSQL accessible at `localhost:5432`
- [ ] Redis accessible at `localhost:6379`
- [ ] Kafka UI accessible at `http://localhost:8080`
- [ ] All containers pass healthchecks

---

## SF-3: packages/prisma — Prisma schema & migrations
**Labels:** backend, sprint-1
**Description:**
Setup Prisma in `packages/prisma`:
- Configure `schema.prisma` with PostgreSQL provider
- Define models: User, OAuthAccount, RefreshToken (auth domain)
- Create initial migration
- Export `PrismaService` for use in microservices

**Learning:** Prisma schema design, relations, migrations workflow

**Acceptance Criteria:**
- [ ] `npm run db:migrate` creates all tables
- [ ] `npm run db:generate` generates Prisma client
- [ ] All relations defined correctly (User → OAuthAccount, RefreshToken)
- [ ] `PrismaService` exported from `@shopflow/prisma`

---

## SF-4: packages/proto — gRPC proto files
**Labels:** backend, sprint-1
**Description:**
Define gRPC contracts in `.proto` files:
- `auth.proto` — ValidateToken, GetUserById RPCs
- Setup `grpc_tools_node_protoc` for TypeScript generation
- Export generated types

**Learning:** Protocol Buffers syntax, gRPC service definitions, code generation

**Acceptance Criteria:**
- [ ] `auth.proto` defines `AuthService` with all RPCs
- [ ] TypeScript types generated successfully
- [ ] Proto files importable from other services

---

## SF-5: auth-service — NestJS gRPC microservice
**Labels:** backend, sprint-1
**Description:**
Build `auth-service` as NestJS gRPC microservice:
- `main.ts` — start gRPC server on port 5001
- `AuthController` with `@GrpcMethod` decorators
- `AuthService` — register/login with bcrypt
- `TokenService` — JWT access (15m) + refresh (7d) tokens
- Prisma integration via `@shopflow/prisma`
- Kafka producer: publish `user.registered` event on registration

**Learning:** NestJS microservices, `@GrpcMethod`, JWT implementation, Kafka Producer

**Acceptance Criteria:**
- [ ] gRPC server starts on port 5001
- [ ] `ValidateToken` RPC validates JWT and returns user info
- [ ] `register` creates user with hashed password
- [ ] `login` returns access + refresh tokens
- [ ] `user.registered` Kafka event published on new user creation
- [ ] Unit tests for AuthService (>80% coverage)

---

## SF-6: api-gateway — NestJS HTTP server + gRPC proxy
**Labels:** backend, sprint-1
**Description:**
Build `api-gateway` as NestJS HTTP server:
- `main.ts` — HTTP server on port 3000
- gRPC clients for all microservices
- `AuthGuard` — validate JWT via gRPC call to auth-service
- `POST /api/v1/auth/register` → proxies to auth-service
- `POST /api/v1/auth/login` → proxies to auth-service
- `GET /api/v1/auth/me` → protected, uses AuthGuard

**Learning:** NestJS ClientProxy, RxJS observables, gRPC client setup

**Acceptance Criteria:**
- [ ] HTTP server starts on port 3000
- [ ] `/auth/register` and `/auth/login` work end-to-end
- [ ] `AuthGuard` blocks unauthorized requests with 401
- [ ] gRPC client successfully connects to auth-service

---

## SF-7: Next.js — Auth pages (login, register)
**Labels:** frontend, sprint-1
**Description:**
Build auth UI in `apps/web`:
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `React Hook Form` + `Zod` validation
- API integration with `axios` + React Query
- Store JWT in `httpOnly` cookie (via Next.js API route)
- Redirect to home on success

**Learning:** Next.js App Router, React Hook Form + Zod, auth flow with cookies

**Acceptance Criteria:**
- [ ] Login/Register forms with validation
- [ ] Successful login stores token and redirects
- [ ] Error messages displayed from API
- [ ] `useAuthStore` (Zustand) manages client-side auth state

---

## SF-8: Sprint 1 integration test
**Labels:** backend, frontend, sprint-1
**Description:**
End-to-end flow test:
1. Start `docker compose up` (infra)
2. Start `auth-service` + `api-gateway`
3. Register new user via API
4. Login and receive tokens
5. Access protected endpoint `/auth/me`
6. Verify `user.registered` event in Kafka UI

**Acceptance Criteria:**
- [ ] Full flow works without errors
- [ ] Kafka UI shows `user.registered` event
- [ ] JWT auth works across gateway → auth-service
