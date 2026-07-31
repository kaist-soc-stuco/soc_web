# SoC Web

KAIST SoC 웹 모노레포입니다.

- Web: React + Vite
- API: NestJS
- Data: PostgreSQL 16, Redis 7
- Local runtime: Docker Compose + nginx

## 요구 사항

- Docker Engine 및 Docker Compose v2
- 호스트에서 실행하거나 테스트할 때만 Node.js 20+ 및 pnpm 10+

## Docker로 로컬 실행

루트 `compose.yml`은 API, Web, PostgreSQL, Redis, migration, 개발 계정 seed, nginx를 함께 실행합니다.

```bash
node infra/scripts/generate-dev-env.mjs
docker compose up -d --build
docker compose ps
```

브라우저는 `http://localhost:8080`으로 접속합니다.

- API: `http://127.0.0.1:3000`
- Web 개발 서버: `http://127.0.0.1:5173`
- nginx 통합 진입점: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

`generate-dev-env.mjs`는 `.env.example`에서 `.env`를 만들고 JWT·PII·HMAC용 개발 키를 새로 생성합니다. 기존 `.env`에 placeholder 키가 남아 있으면 `node infra/scripts/generate-dev-env.mjs --repair`로 다른 설정을 보존하면서 생성 키만 교체합니다.

실행 상태와 로그:

```bash
docker compose ps
docker compose logs -f api web db-migrate db-seed
curl http://127.0.0.1:3000/health/ready
```

포트 충돌 시 nginx 포트를 바꿉니다.

```bash
NGINX_PORT=18080 docker compose up -d --build
```

이 경우 `.env`의 `PUBLIC_ORIGIN`도 `http://localhost:18080`으로 맞춰야 쿠키 기반 POST 요청이 허용됩니다.

### 개발 계정 로그인

`db-seed`는 migration 뒤 `development-user` 계정을 생성합니다. Docker 개발 화면의 `/login`에서 **개발용 계정으로 로그인**을 선택하면 실제 `soc_at`/`soc_rt` HttpOnly 세션 쿠키가 발급됩니다.

이 엔드포인트는 `NODE_ENV=development`에서만 동작하며 실제 SSO 자격 증명을 우회하기 위한 로컬 개발 전용 기능입니다.

### 중지와 초기화

```bash
# 컨테이너만 중지하고 DB/Redis 데이터는 유지
docker compose down

# DB/Redis 볼륨까지 삭제하고 완전히 초기화
docker compose down -v
```

`down -v` 뒤에는 `docker compose up -d --build`만 다시 실행하면 migration과 개발 계정 seed가 다시 적용됩니다.

### 기본 게시판과 관리

빈 DB에는 migration으로 다음 게시판이 순서대로 생성됩니다.

`공지`, `행사`, `HoC`, `홍보글`, `건의사항 및 QnA`, `연구실`, `ESCamp`

표시 이름과 순서는 DB의 게시판 카탈로그가 기준이며, 헤더도 이 공개 카탈로그를 사용합니다. 글로벌 `BOARD_MANAGE` 권한이 있는 계정은 `/admin/boards`에서 게시판을 추가하거나 설정을 변경하고 빈 게시판을 삭제할 수 있습니다. 게시글 행이 하나라도 남아 있는 게시판은 보존 정책과 데이터 무결성을 위해 삭제되지 않으며 `board_has_articles` 충돌을 반환합니다.

기존 DB에서 관리자가 수정한 게시판 설정은 migration이 덮어쓰지 않습니다. 새 기본 명칭은 기존 seed 값 전체가 그대로인 행에만 적용됩니다.

## 호스트에서 개발 서버 실행

먼저 DB와 Redis만 실행합니다.

```bash
docker compose -f infra/docker/compose.dev.yml up -d
pnpm install
pnpm dev
```

호스트 Vite(`http://localhost:5173`)를 사용할 때는 `.env`의 `PUBLIC_ORIGIN`을 `http://localhost:5173`으로 변경해야 합니다. `VITE_API_PROXY_TARGET=http://localhost:3000`이 `/api` 요청을 API 서버로 프록시합니다.

개별 실행:

```bash
pnpm dev:api
pnpm dev:web
```

## 환경 설정

`.env.example`은 로컬 Docker 기본값과 모든 필수 환경 변수의 형태를 제공합니다. 다음 값은 생성 스크립트가 안전한 랜덤 값으로 채웁니다.

- `AUTH_JWT_*`
- `AUTH_PENDING_LOGIN_ENCRYPTION_KEY`
- `PII_ENCRYPTION_*`
- `SURVEY_PHONE_HASH_HMAC_KEY`
- `SSO_CLIENT_SECRET`

실제 SSO를 검증할 때만 발급받은 `VITE_SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, redirect URI와 API URL로 교체합니다. 로컬 개발 계정 로그인에는 실제 SSO 설정이 필요하지 않습니다.

## 검증 명령

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:api:http
pnpm test:web:unit
```
