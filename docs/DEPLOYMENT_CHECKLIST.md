# Production Deployment Checklist

이 문서는 실제 공개 직전 한 번씩 확인하는 체크리스트입니다. 운영 서버에는 개발 PC의 `.env`, PostgreSQL volume, uploads 디렉터리를 그대로 복사하지 않습니다.

## 1. Source And Build

- [ ] 작업 트리가 깨끗하고 배포할 commit/tag가 확정되어 있다.
- [ ] `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`가 통과한다.
- [ ] `pnpm audit --prod`에 알려진 취약점이 없다.
- [ ] `docker compose --env-file .env -f infra/docker/compose.prod.yml config --quiet`가 통과한다.
- [ ] 운영 이미지를 빌드하고 `/health`가 `status: ok`를 반환한다.

## 2. Production Environment

- [ ] `NODE_ENV=production`, `SEED_MODE=reference`로 설정한다.
- [ ] `CORS_ORIGIN`과 `SSO_REDIRECT_URI`를 실제 HTTPS 도메인으로 설정한다.
- [ ] JWT, pending login, 투표 암호화 키는 서로 다른 충분히 긴 비밀값을 사용한다.
- [ ] `INITIAL__ADMIN_STDNOS`에 최초 관리자 8자리 학번만 쉼표로 구분해 넣는다.
- [ ] 초기 smoke test 전에는 `EMAIL_DRY_RUN=true`, `BULK_EMAIL_SCHEDULER_ENABLED=false`로 둔다.
- [ ] `.env`와 `secrets/` 파일 권한을 운영 계정만 읽을 수 있게 제한한다.

## 3. Database And Administrator

- [ ] 빈 PostgreSQL에서 모든 migration을 순서대로 적용한다.
- [ ] `SEED_MODE=reference`로 기준 데이터만 생성한다.
- [ ] 개발 사용자 `DEV0001`, `개발 관리자`, 샘플 콘텐츠가 존재하지 않는다.
- [ ] `INITIAL__ADMIN_STDNOS` 사용자가 개인정보 동의 후 `최고 관리자` 역할을 받는다.
- [ ] 목록에 없는 일반 사용자는 기본 권한만 받는다.
- [ ] migration 직전 백업을 만들고 별도 DB에서 복원을 확인한다.

## 4. External Services

- [ ] SSO 신규 로그인, 기존 로그인, 비활성 계정, 로그아웃과 세션 갱신을 확인한다.
- [ ] Google OAuth 앱이 Production 상태이며 장기 refresh token과 결과 폴더 쓰기 권한이 유효하다.
- [ ] Google Calendar 서비스 계정에 운영 캘린더 편집 권한이 있다.
- [ ] S3 bucket은 비공개이며 CORS, presigned upload/download와 IAM 최소 권한을 확인한다.
- [ ] ALF 지식·금지 규칙·상담원 연결·운영시간 외 메시지를 운영 콘솔에서 검수한다.
- [ ] ALF가 개인 과비 상태, 익명 작성자, 설문 응답, 투표 선택을 답하거나 추론하지 않는다.
- [ ] 실제 메일 활성화 전 단일 수신자 smoke test와 SPF/DKIM/DMARC를 확인한다.

## 5. Public Smoke Test

- [ ] 비로그인 공개 페이지와 비공개 리소스 차단
- [ ] 게시글 작성·파일 첨부·댓글·비밀글·알림
- [ ] 설문 익명/로그인/전공/과비 조건, 파일 문항, 응답과 Google Sheets 반영
- [ ] 투표 명부·자격·중복 제출 차단·마감·집계·공개
- [ ] 일정 Google/KAIST 수동 동기화와 중복 방지
- [ ] 과비 import/export와 원장 반영
- [ ] 관리자 최소 권한별 메뉴 접근 및 운영 로그
- [ ] 모바일 화면, 다운로드 XLSX 열기, ChannelTalk launcher

## 6. Release And Rollback

- [ ] TLS 종료 프록시가 `X-Forwarded-Proto=https`를 전달한다.
- [ ] 인증 쿠키가 `Secure`, `HttpOnly`, `SameSite=Lax`로 설정된다.
- [ ] TLS 종료 프록시에서 HSTS와 서비스 도메인에 맞춘 CSP를 적용한다.
- [ ] 로그인, 익명 설문 제출, 투표, 업로드 경로에 rate limit을 적용한다.
- [ ] API/web/nginx/PostgreSQL/Redis health와 재시작 상태를 확인한다.
- [ ] 배포 commit, DB backup, 환경변수 변경 내역과 rollback 명령을 기록한다.
- [ ] 공개 후 오류 로그·디스크·DB·메일 실패를 집중 관찰한다.
