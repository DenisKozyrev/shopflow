---
name: aws-shopflow
description: ShopFlow AWS usage — S3, SES, ECS and related local/dev setup. Use when working on image uploads, emails, deploy, IAM, or AWS MCP tools.
---

# AWS in ShopFlow

## Where AWS appears

| Service | Purpose | Sprint |
|---|---|---|
| S3 | Product images (presigned URLs) | 2 |
| SES | Transactional email via Kafka | 5 |
| ECR / ECS Fargate | Deploy services | 7 |
| RDS / ElastiCache / MSK | Prod infra | 7 |
| CloudWatch / IAM | Logs, least-privilege roles | 7 |

Local Sprint 1: AWS not required.

## Credentials

From `.env.example` (fill in `.env`, never commit secrets):

```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=shopflow-dev
AWS_SES_FROM_EMAIL=noreply@shopflow.dev
```

Prefer IAM user/role with least privilege. For CLI: `aws configure` or `AWS_PROFILE=default`.

## AWS MCP

Registered at Claude Code **user scope** (cross-project, not part of this repo) — see `docs/AGENTS.md` for the `claude mcp add` command (`awslabs.aws-api-mcp-server` via `uvx`).

One-time prerequisite:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# or: brew install uv
```

Then restart the Claude Code session. Without `uv`/`uvx`, AWS MCP will not start — use AWS CLI instead:

```bash
aws sts get-caller-identity
aws s3 ls
```

## Patterns to teach

- **S3:** upload via presigned URL from browser; gateway/service issues URL, never ships long-lived bucket keys to frontend
- **SES:** send from notification-service after Kafka events — not synchronously in HTTP request path
- **ECS:** one task definition per microservice; env from Secrets Manager/SSM in Sprint 7

## Mentor note

Do not create real AWS resources unless Denis asks. Prefer explaining architecture and local stubs until Sprint 2+.
