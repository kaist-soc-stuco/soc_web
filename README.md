# SoC Web

KAIST SoC 웹 모노레포입니다.

```
apps/
  api/   — NestJS backend (port 3000)
  web/   — React + Vite frontend (port 5173)
shared/
  common/     — @soc/shared: 시간 유틸리티, 상수
  contracts/  — @soc/contracts: HTTP 요청/응답 타입
  api-client/ — @soc/api-client: 타입 안전 fetch 래퍼
  config/     — 공유 TypeScript/ESLint 설정
infra/
  docker/  — PostgreSQL 16, Redis 7, Nginx 설정
  scripts/ — DB 마이그레이션/시드 스크립트
```

## Tech Stack

- Web: React 19 + Vite
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
```

## Run

### 전체 스택 (api, web, postgres, redis, nginx)

```bash
docker compose up -d --build
```

nginx는 기본적으로 `127.0.0.1:8080`에만 바인딩됩니다. 포트를 바꾸려면:

```bash
NGINX_PORT=18080 docker compose up -d --build
```

### 로컬 개발 (DB + Redis만 Docker로 띄우고, api/web은 직접 실행)

```bash
docker compose -f infra/docker/compose.dev.yml up -d
pnpm dev
```

개별 실행:

```bash
pnpm dev:api   # NestJS :3000
pnpm dev:web   # Vite :5173
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
pnpm db:migrate
```
