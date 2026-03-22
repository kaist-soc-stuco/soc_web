# SoC Web

KAIST SoC 웹 모노레포입니다.

- Web: React + Vite
- API: NestJS
- Infra: Postgres, Redis, Docker Compose

## Requirements

- Node.js 20+
- pnpm 10+
- Docker

## Setup

루트 `.env`를 사용합니다.

```bash
cp .env.example .env
pnpm install
docker compose -f infra/docker/compose.dev.yml up -d
```

## Run

API:

```bash
pnpm dev:api
```

Web:

```bash
pnpm dev:web
```

둘 다 같이 실행:

```bash
pnpm dev
```

## Check

- Web: `http://localhost:5173`
- API health: `http://localhost:3000/health`
- Mock API: `http://localhost:3000/v1/mock/greeting`

## Useful Commands

```bash
pnpm typecheck
pnpm build
pnpm test
```
