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
docker compose up -d --build
```

루트 `compose.yml`은 전체 스택(api, web, postgres, redis, nginx)을 띄웁니다.
nginx는 기본적으로 `127.0.0.1:8080`에만 바인딩되므로, Caddy가 80/443을 사용해도 충돌하지 않습니다.
필요하면 `NGINX_PORT`로 바꿀 수 있습니다.

```bash
NGINX_PORT=18080 docker compose up -d --build
```

DB/Redis만 필요하면 아래 개발용 compose를 사용합니다.

```bash
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
