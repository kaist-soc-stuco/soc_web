# SoC Web Monorepo (Mock)

Vanilla React(FE) + NestJS(BE) + Postgres/Redis(DB) 기반의 `pnpm` workspace 예시입니다.

## 1) 프로젝트 구조

```text
.
├─ apps
│  ├─ api
│  └─ web
├─ packages
│  ├─ api-client
│  ├─ config
│  ├─ contracts
│  └─ shared
├─ infra
│  ├─ docker
│  └─ scripts
├─ .env.example
├─ package.json
└─ pnpm-workspace.yaml
```

## 2) 빠른 시작

1. 환경 변수 파일 생성

```bash
cp .env.example .env
```

2. 로컬 DB 실행

```bash
docker compose -f infra/docker/compose.dev.yml up -d
```

3. 의존성 설치

```bash
pnpm install
```

4. 백엔드 실행 (터미널 1)

```bash
pnpm dev:api
```

5. 프론트 실행 (터미널 2)

```bash
pnpm dev:web
```

## 3) 확인 포인트

- Health 체크: `GET http://localhost:3000/health`
- Mock API: `GET http://localhost:3000/v1/mock/greeting`
- Web UI: `http://localhost:5173`

## 4) 포함된 Mock 기능

- `/health`
  - Postgres `SELECT 1`
  - Redis `PING`
  - 상태/지연시간 반환
- `/v1/mock/greeting`
  - Redis 카운터 증가(방문 횟수)
  - Postgres 서버 시간 반환
- Web UI
  - 버튼으로 두 API 호출
  - 결과 렌더링

## 5) 보조 스크립트

```bash
./infra/scripts/db-migrate.sh
./infra/scripts/db-seed.sh
```
