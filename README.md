# SOC Web

KAIST 전산학부 집행위원회 사이트 모노레포입니다. 학생회 운영에 필요한 공지, 게시판, 설문조사, 권한 관리, 마이페이지 기능을 하나의 pnpm workspace에서 관리합니다.

## 구조

```text
apps/
  api/   NestJS API 서버
  web/   React + Vite 프론트엔드
shared/
  common/      @soc/shared 공통 유틸리티와 상수
  contracts/   @soc/contracts API 요청/응답 타입
  api-client/  @soc/api-client 타입 안전 fetch 클라이언트
  config/      공유 TypeScript/ESLint 설정
infra/
  docker/   PostgreSQL, Redis, Nginx compose 설정
  scripts/  DB 마이그레이션/시드 스크립트
docs/       개발 규칙, UI/UX 규칙, 구조 개선 우선순위
```

## 기술 스택

- Web: React 19, Vite, Tailwind CSS
- API: NestJS
- DB/Session: PostgreSQL 16, Redis 7
- Monorepo: pnpm workspace
- Infra: Docker Compose, Nginx reverse proxy

## 요구 사항

- Node.js 22.13+
- pnpm 11.x
- Docker 및 Docker Compose
- WSL 환경에서는 가능하면 WSL 내부 shell에서 pnpm 명령을 실행하세요. Windows와 WSL 경로가 섞이면 typecheck/build가 실패할 수 있습니다.

## 환경 변수

로컬 개발은 루트의 `.env`, 운영 Compose는 `.env.production`을 사용합니다.

```bash
cp .env.example .env
cp .env.example .env.production
```

주요 값:

- `API_PORT`, `WEB_PORT`, `NGINX_PORT`: 로컬 포트
- `VITE_API_BASE_URL`: 프론트엔드 API base URL. nginx를 통해 접근하면 `/api` 사용
- `AUTH_JWT_SECRET`: JWT 서명 secret. 운영에서는 반드시 교체
- `AUTH_PENDING_LOGIN_ENCRYPTION_KEY`: SSO pending login 암호화 키. 32자 이상의 랜덤 문자열 권장
- `VOTE_BALLOT_ENCRYPTION_KEY`: 투표 데이터 전용 암호화 키. 인증 키와 분리하고 DB 백업과 함께 보관
- `INITIAL__ADMIN_STDNOS`: 최초 SSO 로그인 시 최고 관리자 역할을 부여할 8자리 학번 목록. 쉼표로 구분
- `REDIS_AUTH_TTL_SECONDS`: 임시 로그인 세션 TTL
- `POSTGRES_*`: PostgreSQL 접속 정보
- `REDIS_URL`: Redis 접속 URL
- `ASSET_UPLOAD_DIR`: 게시글 이미지/첨부파일 저장 위치. 생략하면 로컬 개발 기본 경로 사용
- `ASSET_ORPHAN_GRACE_HOURS`: 게시글에 연결되지 않은 업로드 파일을 정리하기 전까지 기다릴 시간. 기본값 24
- `ASSET_ORPHAN_CLEANUP_ENABLED`: 미연결 업로드 파일 자동 정리 스케줄러 실행 여부. 기본값 false
- `ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS`: 연결되지 않은 업로드 파일을 자동 점검하는 주기. 기본값 6
- `SSO_LOGIN_URL`, `SSO_REDIRECT_URI`, `SSO_CLIENT_ID`, `SSO_AUTH_API_URL`, `SSO_CLIENT_SECRET`: KAIST SSO 연동 설정
- `CHANNELTALK_PLUGIN_KEY`: Channel Talk 웹 SDK plugin key
- `CHANNELTALK_SECRET_KEY`: Channel Talk member hash 생성용 secret. 브라우저에 노출하지 않음
- `EMAIL_DRY_RUN`: 개발 환경에서 메일을 실제 발송하지 않고 처리 기록만 남길지 여부. 기본값 true
- `DOORAY_SMTP_HOST`, `DOORAY_SMTP_PORT`, `DOORAY_SMTP_USER`, `DOORAY_SMTP_PASSWORD`, `DOORAY_SMTP_SECURE`, `EMAIL_FROM`: 운영 SMTP 발송 설정

관리자 기능에는 연락망 CSV 일괄 업로드, 과비 납부율/납부금액 집계와 행 선택 일괄처리, F26 미납자 메일 템플릿이 포함되어 있습니다. 개발 모드에서 F26 메일을 보내면 드라이런 기록이 생성되고, 운영에서 실제 발송하려면 SMTP 설정과 `EMAIL_DRY_RUN=false`가 필요합니다.

업로드 후 게시글에 연결되지 않은 파일은 관리자 권한으로 `POST /v1/assets/cleanup-orphans`를 호출해 정리할 수 있습니다. 자동 정리는 `ASSET_ORPHAN_CLEANUP_ENABLED=true`인 API 프로세스에서만 실행하세요.

운영 배포 전에는 `.env.production`의 `NODE_ENV=production`, `SEED_MODE=reference`, 실제 HTTPS origin과 SSO redirect, 운영 전용 secret을 확인해야 합니다. `.env`와 `.env.production`은 모두 Git에 커밋하지 않습니다.

## 설치

```bash
pnpm install
```

## 로컬 개발

DB와 Redis만 Docker로 띄우고 API/Web은 로컬 Node 프로세스로 실행합니다.

```bash
docker compose --env-file .env up -d
pnpm db:migrate
pnpm dev
```

개별 실행:

```bash
pnpm dev:api
pnpm dev:web
```

기본 주소:

- Web: `http://localhost:5173`
- API health: `http://localhost:3000/health`
- Mock API: `http://localhost:3000/v1/mock/greeting`

## Docker 개발 스택

API, Web, PostgreSQL, Redis, Nginx를 한 번에 실행합니다.

```bash
docker compose --env-file .env -f infra/docker/compose.local.yml up -d --build
```

Nginx는 기본적으로 `127.0.0.1:8080`에 바인딩됩니다.

```bash
NGINX_PORT=18080 docker compose --env-file .env -f infra/docker/compose.local.yml up -d --build
```

업로드 파일은 Docker volume `api_uploads`에 저장됩니다. PostgreSQL과 Redis도 각각 volume을 사용합니다.

## 운영 compose

운영용 이미지는 `infra/docker/compose.prod.yml`을 사용합니다.

```bash
docker compose --env-file .env.production -f infra/docker/compose.prod.yml config
docker compose --env-file .env.production -f infra/docker/compose.prod.yml up -d --build
```

현재 운영 compose는 단일 서버 배포를 전제로 합니다. `ASSET_STORAGE_PROVIDER=s3`를 권장하며, local fallback을 사용할 때는 호스트의 `apps/api/uploads` 경로도 별도로 백업해야 합니다. 자동 업로드 정리는 단일 API 인스턴스에서만 `ASSET_ORPHAN_CLEANUP_ENABLED=true`로 켜세요. API replica가 필요해지는 시점에는 별도 worker 또는 distributed lock 설계를 먼저 추가하세요.

## 자주 쓰는 명령

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm lint
pnpm db:migrate
pnpm db:seed
```

## 작업 전 확인 문서

- `docs/DEVELOPMENT_GUIDE.md`: 코드 작성 규칙
- `docs/UI_UX_GUIDE.md`: UI/UX 및 시각 스타일 규칙
- `docs/ARCHITECTURE_REVIEW_AND_PRIORITIES.md`: 구조 리뷰와 개선 우선순위
- `docs/CURRENT_ARCHITECTURE_REVIEW.md`: 현재 폴더 구조와 아키텍처 리뷰
- `docs/SECURITY_PERMISSION_REVIEW.md`: 로그인/세션/권한/보안 점검
- `docs/REMAINING_WORK.md`: 안정화 잔여 작업 목록
