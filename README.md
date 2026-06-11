# ShopFlow

> Modern e-commerce platform built with microservices architecture — NestJS + gRPC + Kafka + AWS + Next.js

[![CI](https://github.com/YOUR_USERNAME/shopflow/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/shopflow/actions)

## Architecture

```
Client (Next.js 15)
    │
    ▼ HTTP + WebSocket
┌───────────────────────┐
│      api-gateway       │  JWT validation · Rate limiting · WebSocket
└──────┬────────────────┘
       │ gRPC
  ┌────┴────┬─────────────┬──────────────┐
  ▼         ▼             ▼              ▼
auth     product        order         payment
service  service        service       service
           │              │              │
           └──────┬───────┴──────────────┘
                  ▼ Kafka
         notification-service → AWS SES
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Tailwind CSS, shadcn/ui, React Query, Zustand |
| API Gateway | NestJS HTTP + WebSocket (Socket.io) |
| Microservices | NestJS gRPC (auth, product, order, payment, notification) |
| Sync IPC | gRPC + Protocol Buffers |
| Async IPC | Kafka (KafkaJS) |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| Storage | AWS S3 |
| Email | AWS SES + React Email |
| Payments | Stripe |
| Deploy | Docker + AWS ECS Fargate |
| CI/CD | GitHub Actions |
| Observability | OpenTelemetry + AWS CloudWatch |

## Project Structure

```
shopflow/
├── apps/
│   ├── api-gateway/          # NestJS HTTP server + WebSocket
│   ├── auth-service/         # gRPC: JWT, OAuth, users
│   ├── product-service/      # gRPC: catalog, S3 images
│   ├── order-service/        # gRPC: orders, Redis cart
│   ├── payment-service/      # Kafka: Stripe webhooks
│   ├── notification-service/ # Kafka consumer: AWS SES
│   └── web/                  # Next.js 15 frontend
├── packages/
│   ├── proto/                # gRPC .proto files + generated types
│   ├── prisma/               # Prisma schema + client
│   ├── kafka/                # Kafka config + topic constants
│   └── common/               # Shared DTOs, enums, interfaces
├── infra/
│   └── docker/               # Dockerfiles
└── .github/
    └── workflows/            # CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- AWS CLI (for S3/SES)

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/YOUR_USERNAME/shopflow
cd shopflow
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start infrastructure (PostgreSQL, Redis, Kafka)
docker compose up -d postgres redis zookeeper kafka kafka-ui

# 4. Run database migrations
npm run db:migrate

# 5. Generate Prisma client
npm run db:generate

# 6. Start all services in dev mode
npm run dev
```

### Kafka UI

Kafka UI is available at http://localhost:8080 — inspect topics, messages, consumer groups.

## Sprint Plan

| Sprint | Focus | Status |
|--------|-------|--------|
| 1 | Foundation: Turborepo, Auth, API Gateway, gRPC | 🚧 In Progress |
| 2 | Product Service, AWS S3, Kafka Producer | ⏳ Pending |
| 3 | Order Service, Redis Cart, Checkout | ⏳ Pending |
| 4 | Payment Service, Stripe Webhooks | ⏳ Pending |
| 5 | Notifications, AWS SES, WebSockets | ⏳ Pending |
| 6 | Admin Dashboard, RBAC, Analytics | ⏳ Pending |
| 7 | Deploy: AWS ECS, CI/CD, OpenTelemetry | ⏳ Pending |

## Kafka Topics

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `order.created` | order-service | payment-service, notification-service |
| `order.paid` | payment-service | order-service, notification-service |
| `order.shipped` | order-service | notification-service |
| `inventory.low` | product-service | notification-service |
| `user.registered` | auth-service | notification-service |

## Contributing

This is a learning project. All changes go through Pull Requests with code review.

Branch naming: `feature/SF-{issue-number}-short-description`
