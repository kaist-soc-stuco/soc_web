# SoC Web Monorepo Starter

React(Web) + NestJS(API) + Postgres/Redis 기반 `pnpm` 워크스페이스입니다.  
이 레포를 기준으로 기능 개발을 시작할 수 있도록 기본 구조와 실행 절차를 정리했습니다.

## Tech Stack

- Web: React 19, Vite 7, Tailwind CSS v4, shadcn/ui
- API: NestJS 11, `pg`, `ioredis`
- Shared Packages: `@soc/contracts`, `@soc/shared`, `@soc/api-client`
- Infra: Docker Compose (Postgres, Redis, Nginx)

## Workspace 구조

```text
.
├─ apps
│  ├─ api
│  └─ web
│     └─ src/components
│        ├─ ui          # shadcn/ui primitives
│        ├─ atoms
│        ├─ molecules
│        └─ organisms
├─ packages
│  ├─ api-client
│  ├─ contracts
│  ├─ shared
│  └─ config
├─ infra
│  ├─ docker
│  └─ scripts
├─ .env.example
└─ pnpm-workspace.yaml
```

## 사전 요구사항

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

## 빠른 시작

1. 환경 변수 파일 생성

```bash
cp .env.example .env
```

2. 의존성 설치

```bash
pnpm install
```

3. 개발용 인프라 실행

```bash
docker compose -f infra/docker/compose.dev.yml up -d
```

4. 백엔드 실행 (터미널 1)

```bash
pnpm dev:api
```

5. 프론트 실행 (터미널 2)

```bash
pnpm dev:web
```

## 기본 검증 포인트

- Web: `http://localhost:5173`
- Health API: `GET http://localhost:3000/health`
- Mock API: `GET http://localhost:3000/v1/mock/greeting`

## 자주 쓰는 명령어

- 전체 동시 실행: `pnpm dev`
- API만 실행: `pnpm dev:api`
- Web만 실행: `pnpm dev:web`
- 전체 타입체크: `pnpm typecheck`
- 전체 빌드: `pnpm build`
- 전체 테스트(현재 placeholder): `pnpm test`

## Web 컴포넌트 규칙 (shadcn + Atomic)

- `apps/web/src/components/ui`: shadcn 기반 재사용 primitive
- `apps/web/src/components/atoms`: 최소 단위 표현 컴포넌트
- `apps/web/src/components/molecules`: atom 조합
- `apps/web/src/components/organisms`: 화면 섹션 단위 조합
- `apps/web/src/lib/utils.ts`: `cn()` 등 공용 UI 유틸

새 shadcn 컴포넌트 추가 예시:

```bash
cd apps/web
pnpm dlx shadcn@latest add button
```

## 환경 변수

루트 `.env`를 사용합니다. 기본값은 `.env.example`을 참고하세요.

주요 항목:

- `API_PORT`, `WEB_PORT`, `API_BASE_URL`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL`

## DB 관련 스크립트

```bash
./infra/scripts/db-migrate.sh
./infra/scripts/db-seed.sh
```

## 참고

- `pnpm test`는 현재 각 패키지에서 placeholder 스크립트입니다.
- 운영/배포용 compose는 `infra/docker/compose.prod.yml`를 사용합니다.
