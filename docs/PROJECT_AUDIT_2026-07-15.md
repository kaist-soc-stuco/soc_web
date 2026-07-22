# SOC Web 프로젝트 전수 감사

- 작성일: 2026-07-15
- 감사 기준: `feat/fee-management`, `3dc2ec5` 위의 현재 작업 트리
- 관련 문서: `docs/DESIGN_AUDIT_2026-07-15.md`, `docs/FOUNDATION_DECISIONS_2026-07-15.md`

> **후속 구현 안내:** 이 문서의 문제 관찰은 감사 시점 상태를 보존한다. 이후 Gate 0 구현 상태와 남은 외부 조치는 `docs/GATE0_IMPLEMENTATION_2026-07-15.md`를 함께 확인한다.

## 결론

현재 프로젝트는 기능 골격은 넓게 갖춰졌지만, 대규모 기능 개발을 바로 시작해도 되는 기반 상태는 아니다. 공개 설문 개인정보, 회비 기록 무결성, 인증 세션 일관성, 운영 복구, CI/E2E, 이메일 발송과 CMS 범위에 출시 전 해결해야 할 문제가 남아 있다.

특히 기존 문서의 여러 “완료” 표기와 실제 코드가 일치하지 않는다. 앞으로는 이 문서를 기술 기준점으로 사용하고, 항목을 검증한 뒤에만 완료로 이동해야 한다.

좋은 기반도 분명하다.

- pnpm workspace 아래 Web, API, contracts, common, API client가 분리되어 있다.
- React Query, React Hook Form, Zod, Tiptap, NestJS, Drizzle, PostgreSQL, Redis 조합은 현재 규모에 적절하다.
- 게시판, 설문, 권한, 회비, CMS, 연락망, 감사 로그 등 핵심 도메인의 첫 구현이 존재한다.
- 한국어·영어 필드를 주요 도메인에 반영하기 시작했고 공개 화면의 언어 전환도 동작한다.
- 단위·계약 테스트가 있으며 현재 작업 트리에서 lint, typecheck, test를 통과시킨 이력이 있다.

따라서 전면 재작성이나 프레임워크 교체보다, 데이터 무결성과 운영 경계를 먼저 고친 뒤 책임이 과도하게 섞인 모듈을 단계적으로 분리하는 접근이 적절하다.

## 감사 범위와 방법

- `apps/web`, `apps/api`, `shared/*`, `infra/*`, 루트 스크립트와 문서를 읽기 전용으로 점검했다.
- 공개·인증·관리자 라우트를 실제 로컬 API/DB와 연결해 브라우저로 순회했다.
- 공개 화면은 1440×1000 데스크톱과 390×844 모바일을 기준으로 확인했다.
- 관리자 화면은 사용자 요청에 따라 데스크톱을 우선 점검했고, 모바일에서는 최소한의 실패 방식도 확인했다.
- Mock 관리자 세션으로 설문, 사용자, 운영 로그, 권한, 회비, CMS, 연락망, 이메일, 설문 편집·응답, 게시글 작성·수정을 확인했다.
- 데이터 변경을 일으키는 저장·삭제·발송 동작은 실행하지 않았다.

이번 감사 작성 과정에서는 앱 코드를 추가로 수정하지 않았다. 다만 감사 대상 작업트리에는 감사 시작 전부터 진행 중이던 앱 변경이 포함되어 있으며, 이 문서와 디자인 감사 문서만 이번 감사 산출물로 추가한다.

## 현재 구조 평가

```text
soc_web/
├─ apps/
│  ├─ web/              React 19 + Vite + Tailwind
│  └─ api/              NestJS + Drizzle
├─ shared/
│  ├─ contracts/        Zod 및 HTTP 계약
│  ├─ common/           공통 날짜·도메인 유틸리티
│  └─ api-client/       브라우저 API 클라이언트
├─ infra/
│  ├─ docker/           local/prod compose, nginx
│  └─ scripts/          migrate, seed
└─ docs/
```

Monorepo 경계 자체는 유지해도 된다. 현재 문제는 패키지 수가 아니라 각 feature 내부의 책임 혼합과 오류·폴백 정책의 불일치다. 별도 마이크로서비스, Redux, Next.js, 대형 UI 프레임워크를 추가할 필요는 없다.

## P0 — 다음 기능 개발 전에 차단해야 할 문제

### P0-1. 공개 설문 결과가 자유서술 원문을 노출할 수 있음

근거:

- `apps/web/src/features/admin-surveys/survey-editor-page.tsx:127-146`
- `apps/api/src/features/surveys/surveys.service.ts:223-244,307-325`
- `apps/web/src/features/survey-results/survey-results-sections.tsx:220-295`

신규 설문의 결과 공개 범위 기본값이 `PUBLIC`이고, 공개 결과 API와 화면이 단답·장문·날짜·시간 응답 원문을 그대로 반환·표시한다. 이는 `FOUNDATION_DECISIONS_2026-07-15.md`의 “자유서술 기본 비공개” 결정과도 충돌한다.

조치:

- 새 설문의 결과 공개 기본값을 `PRIVATE`로 바꾼다.
- 관리자 원본 응답 DTO와 공개 집계 DTO를 분리한다.
- 공개 결과는 선택형 집계와 숫자 통계만 허용한다.
- 자유서술은 질문별 검토·승인된 별도 요약이 있을 때만 공개한다.
- 공개 미리보기에서 실제 노출 필드를 관리자가 확인하고 승인하도록 한다.

완료 기준:

- 비로그인 사용자가 어떤 설정 조합에서도 자유서술 원문을 받을 수 없다.
- 공개 결과 계약 테스트와 브라우저 E2E가 존재한다.

후속 상태: 공개 집계의 원문 차단과 신규 설문 `PRIVATE` 기본값은 구현됐다. 배포 전 브라우저 회귀 검증은 계속 필요하다.

### P0-2. 회비 비고만 수정해도 납부일·검증일이 바뀔 수 있음

근거:

- `apps/web/src/features/admin-finance/fee-management-page.tsx:164-170`
- `apps/api/src/features/users/repositories/users.repository.ts:517-533`

비고 blur 저장이 현재 납부 상태까지 다시 전송하고, 서버는 `PAID`가 들어올 때마다 `paidAt`과 `verifiedAt`을 현재 시각으로 갱신한다. 수기 납부 기록의 증거 시각이 훼손되는 실제 데이터 무결성 버그다.

조치:

- 상태 변경과 비고 변경 명령을 분리하거나 patch의 변경 필드만 갱신한다.
- `UNPAID → PAID` 전환일 때만 `paidAt`을 기록한다.
- 누가 언제 어떤 이전 값에서 바꿨는지 append-only 이력을 남긴다.
- 한 번 클릭 즉시 전환 대신 명시적 저장 또는 확인과 성공 피드백을 둔다.

완료 기준:

- 비고 수정 전후 `paidAt`, `verifiedAt`이 동일하다는 통합 테스트가 통과한다.
- 상단 전체/납부/미납 집계가 현재 페이지가 아니라 전체 필터 결과를 기준으로 계산된다.

후속 상태: 비고 전용 patch, 실제 상태 전환 시각 보존, 최초 행 생성 경쟁과 트랜잭션 반환 행 처리는 구현됐다. 전체 집계·검색·이력 UX는 별도 개선 범위다.

### P0-3. 응답이 쌓인 설문의 의미를 사후 변경할 수 있음

근거:

- `apps/api/src/features/surveys/survey-questions.service.ts:17-45`
- `apps/api/src/features/surveys/survey-sections.service.ts:17-36`
- `apps/api/src/features/surveys/surveys.service.ts:146-159`
- `apps/api/src/infrastructure/postgres/schema/survey.schema.ts:89-129`

첫 응답 후에도 질문 제목, 선택지, 필수 여부, 정규식, 섹션을 수정할 수 있어 기존 답변의 의미가 바뀔 수 있다. 답변이 연결된 질문·섹션 삭제는 명시적인 도메인 규칙이 아니라 FK 오류로 실패하고, 설문 전체 삭제는 response와 answer를 cascade 삭제한다. 즉 “수정은 허용되고 일부 삭제는 예측하기 어려운 오류가 나며 전체 삭제는 기록을 지우는” 일관되지 않은 상태다.

조치:

- 첫 응답 이후 문항 구조를 서버에서 동결한다.
- 수정이 필요하면 새 버전을 복제하고 기존 버전은 보관한다.
- 질문 제목·선택지 snapshot을 응답 시점에 보존한다.
- 설문 삭제 대신 `ARCHIVED` 상태를 사용한다.

완료 기준:

- 응답 존재 설문의 구조 변경 요청이 명확한 409 도메인 오류로 거절된다.
- 복제·버전 전환과 과거 결과 조회 테스트가 있다.

후속 상태: 설문 행 잠금 기반 동결·제출·복제와 양방향 실DB 경쟁 테스트가 통과했다. `DRAFT`·`PUBLISHED`·`ARCHIVED` 생명주기, terminal 보관, `previousVersionId` 기반 분기형 계보, 파생본을 가진 원본의 삭제 차단까지 구현했다. 별도 응답 시점 질문 JSON snapshot은 만들지 않았지만, 첫 응답 이후 질문·섹션·의미 변경과 설문 삭제를 차단해 참조 질문 행의 불변성을 유지한다.

### P0-4. 저장소에 SSO 비밀값 형태의 샘플이 추적됨

근거:

- 감사 시점 저장소에 추적되던 JSP 샘플의 credential 형태 값과 TLS 검증 비활성 코드
- 현재 보관 원칙: `[etc]/SSO-Login-Guide/README.md`

실제 운영 사용 여부와 무관하게 비밀값 형태로 커밋된 값은 노출된 것으로 취급해야 한다. 벤더 JAR/PDF/JSP 전체를 제품 저장소에 보관하는 현재 방식도 공급망·라이선스·비밀 관리에 불리하다.

조치:

- 해당 credential을 즉시 폐기·재발급한다.
- Git 이력에서 제거하고 샘플은 명백한 placeholder로 교체한다.
- TLS 인증서 검증 비활성 예제를 제거한다.
- 필요한 벤더 문서는 정제한 내부 문서 또는 접근 제한 저장소로 옮긴다.
- secret scanning을 CI에 추가한다.

완료 기준:

- 현재 트리와 Git 이력 secret scan이 통과한다.
- 재발급 사실과 폐기 시각이 내부 운영 기록에 남는다.

후속 상태: 위험한 JSP 샘플은 현재 트리에서 삭제됐다. credential 회전·폐기 확인과 Git 이력 정리는 외부 owner 조치로 남아 있다.

### P0-5. 대량 이메일의 운영 정책·발신 기반이 미확정

근거:

- `apps/web/src/pages/admin/bulk-email-page.tsx:116-203`
- `apps/api/src/features/email/bulk-email.service.ts:18-23`
- `apps/api/src/shared/config/env.validation.ts:85-136`
- `apps/api/src/infrastructure/postgres/schema/email.schema.ts:13-24`

현재 화면은 명확히 비활성화되어 있고 API는 항상 `NotImplementedException`을 반환한다. 감사 당시에는 Phase 1 후보로 분류했지만, 이후 사용자가 구현 여부 판단을 보류했다. 따라서 비활성 상태를 유지하며 현재 Gate 0 완료 조건과 Phase 1 필수 범위에서는 제외한다. 기능을 다시 채택할 때 아래 정책과 발신 기반을 먼저 확정한다.

Gate 0 결정 범위:

- 검증된 발신 도메인, 발신자명, 회신 주소
- provider, 예산, 일·월 발송 한도와 장애 시 책임자
- 수신자 데이터의 사용 근거, 수신 거부와 suppression 정책
- 작성·검토·승인 권한 분리와 발송 보존 기간
- 반송·complaint 처리 및 긴급 중지 절차

Phase 1 구현 범위:

- 수신자 대상 조건과 발송 시점의 recipient snapshot
- 미리보기, 본인 대상 시험 발송, 2단계 승인
- 비동기 queue, idempotency, 속도 제한, 재시도
- 수신 거부, 반송, complaint, 실패 건 재처리
- provider message ID와 전달 상태
- 발송·내보내기 감사 로그

Gate 0 완료 기준:

- 위 정책의 owner와 승인 기록이 문서화된다.
- 발신 도메인과 provider를 실제 계정에서 검증한다.

Phase 1 완료 기준:

- “처리 성공”과 “실제 provider 접수/전달” 상태가 구분된다.
- 중복 발송과 수신 거부 대상 발송을 막는 통합 테스트가 있다.

후속 상태: 사용자 보류. 위 범위는 기능 재활성화 시 사용할 요구사항 초안이며 현재 구현 지시가 아니다.

### P0-6. 운영 복구·관측성·프록시 설정이 불완전

근거:

- `infra/docker/compose.prod.yml`
- `apps/api/src/features/health/health.service.ts:25-36`
- `apps/api/src/main.ts:10-39`
- `infra/docker/nginx/web.conf:4-10`
- `apps/api/src/features/asset/asset.controller.ts:44,92-113`

운영 compose에 DB·업로드 백업, API/Web healthcheck, restart policy가 없다. health는 의존성 장애에도 HTTP 200을 반환하고, exception filter·request ID·logging interceptor는 만들어 놓고 등록하지 않았다. API는 20MiB를 허용하지만 nginx에 `client_max_body_size`가 없어 기본 제한에서 먼저 실패할 수 있다.

조치:

- readiness와 liveness를 분리하고 degraded 의존성에는 비정상 readiness status를 반환한다.
- request ID, 구조화 로그, 예외 필터, shutdown hook을 실제 등록한다.
- 오류 추적과 운영 알림을 연결한다.
- DB와 업로드의 자동 백업, 보존 정책, 복원 리허설, RPO/RTO를 정한다.
- nginx와 API 업로드 크기·timeout을 같은 상수로 맞춘다.
- 배포 rollback과 migration 실패 절차를 런북에 추가한다.

완료 기준:

- Postgres/Redis 중단 시 readiness가 실패하고 알림이 발생한다.
- 빈 환경에서 백업 복원 리허설을 문서대로 재현할 수 있다.
- 20MiB 이하/초과 업로드가 프록시 포함 E2E에서 기대대로 동작한다.

후속 상태: nginx `/api/` 제한을 `21m`으로 설정하고 구문 검증을 마쳤다. 실제 proxy 경계값 E2E와 P0-6의 나머지 운영 항목은 남아 있다.

## P1 — 초기 운영 전에 해결할 문제

### 인증과 API 클라이언트

- access token은 15분, refresh는 7일인데 선택 인증과 쓰기 guard가 서로 다른 기준을 사용한다. 15분 후 UI는 로그인인데 일부 회원 데이터는 사라지는 split-brain 가능성이 있다.
  - `apps/api/src/features/auth/auth.tokens.ts:9-10`
  - `apps/api/src/features/auth/auth-session.service.ts:462-486`
  - `apps/api/src/features/auth/guards/auth.guard.ts:29-61`
- `createApiClient()`가 약 30곳에서 별도 생성되고 refresh mutex가 인스턴스 내부에만 있다. 동시 401에서 회전된 이전 refresh token 재사용으로 세션 전체가 취소될 수 있다.
  - `shared/api-client/src/core.ts:130-167`
- 인증 조회의 네트워크·500 오류를 로그아웃과 동일하게 처리한다.
  - `apps/web/src/lib/auth-session.ts:46-65`
- 로그인 후 원래 보던 경로로 복귀하는 `returnTo`가 없다.
  - `apps/web/src/components/guards/auth-guard.tsx:40-60`

권장안은 브라우저 전역 API client와 refresh coordinator 하나를 두고, 401/403·네트워크·서버 장애를 분리하며, session cookie를 사용자 상태의 단일 기준으로 삼는 것이다.

### 데이터베이스 무결성과 트랜잭션

- 활성 역할 membership unique 제약이 없어 동시 추가로 중복 행이 생길 수 있다.
- fee status, 게시글 status/scope/visibility, 설문 kind/status/result visibility가 자유 문자열이다.
- 게시글 생성 후 연결 설문 수정, 설문 복제, 질문 순서 변경이 여러 요청으로 나뉘어 부분 완료 상태가 남을 수 있다.
- 설문 목록 repository가 계산한 응답 수를 service가 설문별로 다시 조회하는 N+1이 있다.

권장안:

- partial unique와 check constraint를 migration으로 추가한다.
- 단일 사용자 동작은 서버 command/transaction 하나로 묶는다.
- 조회 모델이 이미 반환한 집계를 다시 조회하지 않는다.
- 동시성 테스트는 환경변수 없을 때 skip하지 않고 CI Postgres에서 항상 실행한다.

### 오류, 빈 상태와 과도한 폴백

다음 화면은 API 장애를 정상적인 빈 데이터 또는 코드 fallback으로 바꾼다.

- 홈 행사와 공지
- 행사/설문 목록의 행사 요청
- 게시판 catalog
- 공개 CMS 문구
- About 구성원
- 게시글 상세의 403/404/500
- 마이페이지의 여러 패널

이 방식은 화면이 덜 깨져 보이는 대신 운영 장애를 숨긴다. fallback은 정적 공통 UI·문구처럼 안전한 범위에만 사용하고, 다음 상태를 공통 `DataState`로 분리해야 한다.

- loading
- empty
- partial success
- permission denied
- not found
- network/server error + retry
- fallback content in use + telemetry

### 목록·검색·내보내기

- 카테고리 게시판은 최대 100개를 받은 뒤 클라이언트에서 페이지를 나눠 101번째부터 사라질 수 있다.
- `/board/:category`의 “제목+내용” 검색은 최대 100개를 받은 뒤 실제로 제목만 클라이언트 검색한다. 전체 `/board` 검색 API는 내용도 검색한다.
- 통합 검색은 게시글 24개와 전체 설문 클라이언트 필터에 의존하며 페이지네이션·관련도·부분 오류가 없다.
- 설문 응답과 CSV는 모든 응답을 브라우저로 가져온다.
- CSV가 `=`, `+`, `-`, `@`로 시작하는 사용자 값을 무력화하지 않아 formula injection 위험이 있다.

모든 목록은 서버 cursor/page, 검색 조건, 총 개수, 안정적인 sort를 사용해야 한다. 대용량 export는 서버 job/stream으로 만들고 export 자체를 감사해야 한다.

### 개인정보와 운영 정책

- 개인정보처리방침은 네 개의 포괄적 문단뿐이다.
- 로그인 동의에는 정책 링크, 버전, 항목별 보유 기간과 철회 방법이 없다.
- 사용자 동의 철회, 데이터 내보내기·삭제 요청 기능이 없다.
- 집행위원 개인 전화·이메일의 공개 동의, 임기, 활성/비공개 상태가 없다.
- 자유서술 결과 외에도 설문 응답 조회·CSV export에 보존·마스킹·경고 정책이 없다.

정확한 운영 주체, 연락처, 처리 항목, 목적, 보유 기간, SSO/위탁, 로그·업로드·설문·회비 데이터, 권리 행사, 시행일과 개정 이력을 한·영으로 확정한 뒤 법률·학교 정책 검토가 필요하다.

### 한·영 콘텐츠 완성도

브라우저에서 `html lang=en` 상태로 홈, About, roadmap, 게시판, 행사, 설문 결과, 개인정보를 순회했다. 홈·About·roadmap·설문 결과·개인정보는 표본 화면에서 한국어 잔존이 없었지만, 행사 목록의 영문 카드 5개는 제목만 영어이고 설명은 모두 한국어였다. 게시판 영문 목록과 상세의 공식 작성자명도 `전산학부 학생회`로 남았다.

번역 toggle이 동작하는 것과 콘텐츠가 완전한 것은 다르다. 공개 전 KO/EN completeness를 서버 필드로 계산하고, 공식 공지·행사는 누락된 언어로 게시하지 못하게 해야 한다. 한국어 전용 사용자 게시글만 명시적 badge와 함께 허용한다.

### CI와 테스트

루트에 `.github` workflow가 없고 웹 테스트는 순수 유틸리티 위주다. React DOM, 라우팅, 접근성, 실제 브라우저, 시각 회귀, 운영 compose smoke test가 없다.

최소 CI 순서:

1. 고정 Node/pnpm bootstrap
2. Postgres/Redis 시작과 migration
3. secret scan, lint, typecheck
4. unit/contract/integration
5. production build
6. Playwright 핵심 흐름
7. 이미지·번들 크기 budget

핵심 E2E는 로그인·동의·원경로 복귀, 공개 게시판, 게시글 작성, 설문 응답, 회비 제한, 설문 결과 개인정보, 관리자 회비 수정, CSV export, CMS publish를 포함해야 한다.

## 구조와 코드 품질

### 복잡성이 page wrapper에서 feature 파일로 이동함

기존 감사의 “route page 300줄 미만” 목표는 겉으로는 달성됐지만 복잡성이 아래 파일로 이동했다.

| 파일 | 줄 수 | 현재 섞인 책임 |
|---|---:|---|
| `apps/api/drizzle/seed.ts` | 1,417 | 모든 도메인 fixture와 실행 제어 |
| `board-write-form-sections.tsx` | 1,085 | 편집기, 이벤트, 파일, 설문, 설정 |
| `admin-permissions/permission-page.tsx` | 1,032 | 역할 CRUD, 권한, 구성원, 대화상자 |
| `article.repository.ts` | 976 | 목록, 검색, 상세, 쓰기, asset, 조회수 |
| `users.repository.ts` | 907 | 인증, 프로필, 권한, 회비, 마이페이지 |
| `admin-surveys/survey-list-page.tsx` | 795 | 조회, 필터, 정렬, 표, 모든 mutation |
| `survey-editor-page.tsx` | 785 | 설문 lifecycle, 문항, 복제, 저장 |
| `calendar.tsx` | 650 | 달력 계산, API, 상태, UI |
| `header.tsx` | 641 | desktop/mobile nav, auth, 언어, search |
| `admin-site-content/site-content-page.tsx` | 614 | 편집, 저장, history interception |

줄 수를 기계적으로 줄이기보다 도메인 책임을 기준으로 나눈다.

권장 분리:

- 사용자: `UserRepository`, `PermissionResolver`, `FeeRepository`, `MyActivityQuery`
- 게시판: read query, command, access policy, asset link
- 설문 목록: controller, filters, table, dialogs, mutations
- 설문 편집: lifecycle command, settings form, section/question editor, preview
- Header: desktop nav, auth controls, language switcher, mobile drawer
- seed: reference seed, demo seed, 도메인 fixture, 환경별 entrypoint

Asset feature가 Board repository를 직접 주입하는 구조는 persistence 경계를 노출한다. `ArticleAccessService` 같은 명시적 포트를 통해 접근 가능 여부만 질의하도록 바꾸는 편이 낫다.

### dead code와 scaffold

삭제 후보:

- `board-debug-panel.tsx`
- `api-status-card.tsx`
- `status-chip.tsx`, `section-title.tsx`, `metric-row.tsx`
- 미사용 `components/ui/card.tsx`, `components/ui/button.tsx`
- API `sample.guard.ts`, legacy permission guard
- 미등록 exception filter, request ID, logging scaffold
- dev mock greeting API와 관련 contract/client
- 직접 라우팅되지 않는 legacy calendar page
- `Note-Form.md` 구형 프로토타입

관측성 scaffold는 필요한 코드이므로 먼저 실제 등록할지 결정하고, 등록하지 않을 것은 삭제한다. dead mutation 도구는 실수로 다시 노출될 위험이 있어 우선 제거한다.

미사용 public 이미지도 약 13MB다.

- `pizza_snack_event.png`
- `hero_background2.jpeg`
- `hero_background3.jpeg`
- `hero_background4.jpeg`
- `temp.png`
- `logo.png`

사용 여부를 빌드 manifest와 `rg`로 확인한 뒤 삭제하거나 운영 asset으로 옮긴다.

### CMS는 현재 제한적 copy override임

현재 CMS는 10개 고정 key만 수정한다.

- `apps/web/src/features/site-content/site-content.ts:20-107`
- `apps/api/src/infrastructure/postgres/schema/site-content.schema.ts:1-24`

멤버, 연혁, 조직, 배너, 대표 행사, 이미지, 번역 상태, draft/publish/schedule, revision이 없다. 새 필드마다 코드와 migration이 필요하며 저장 즉시 공개된다. 이 상태를 “전체 사이트 CMS”라 부르면 관리자 기대와 다르다.

권장 모델:

- 정적 공통 UI 문구: 현재 key-value 유지
- `member`, `banner`, `content_block`, `featured_event`: 구조화 entity
- 공통 필드: KO/EN, translation status, draft/published, publishAt, revision, media reference
- preview, 승인, rollback, 변경 감사

정적 `/about/roadmap`은 사용자 결정대로 CMS로 옮기지 않는다. 대신 책임 부서, 최종 검토일과 공식 학사 링크를 코드 콘텐츠에 명시한다.

## 라이브러리와 패키지 경계

### 유지 권장

- React 19 + Vite + React Router
- TanStack Query
- React Hook Form + Zod
- Tiptap
- Tailwind
- NestJS + Drizzle + PostgreSQL + Redis

현재 문제는 기능 부족을 새 상태 관리·UI 라이브러리로 해결할 성격이 아니다. Redux, headless CMS SaaS, microservice, GraphQL, 대형 component framework 도입은 보류한다.

### 정리 후보

- API의 직접 `cookie`, `dayjs`, `@types/multer`는 실제 import를 확인해 미사용이면 제거한다.
- dead Button을 제거한 뒤 `@radix-ui/react-slot`, `class-variance-authority`가 남아 필요한지 재검토한다.
- `@soc/contracts`의 runtime Zod export와 type-only export를 분리한다.
- API client는 도메인별 deep export를 제공하고 singleton 인스턴스를 사용한다.
- shared 패키지도 lint/test 대상에 포함한다.

삭제는 한 번에 하지 않고 dependency 하나씩 제거한 뒤 typecheck, test, build로 확인한다.

### lint 보강

현재 lint는 Date/dayjs 제한 중심이다. 다음이 필요하다.

- typescript-eslint recommended type-aware 규칙
- unused import와 floating promise
- React Hooks
- JSX 접근성
- import boundary와 cycle 검사
- shared/test package lint

코드 스타일 규칙을 과도하게 늘리기보다 실제 결함을 잡는 규칙부터 적용한다.

## 운영·배포 문서 불일치

- README는 upload named volume을 설명하지만 prod compose는 bind mount를 사용한다.
- 런북의 root compose 로그 명령이 현재 compose 파일 구조와 맞지 않는다.
- Asset cleanup 예시는 Bearer token이지만 실제 guard는 cookie session 기반이다.
- DB 스크립트의 `export $(grep ... | xargs)`는 공백·따옴표·`#`가 포함된 비밀번호를 깨뜨릴 수 있다.
- migrate와 seed 스크립트의 compose project 이름이 다르고 원격 DB를 대상으로 해도 로컬 Postgres를 띄운다.
- API production image는 전체 `node_modules`, source, shared 폴더를 복사하며 dependency pruning, non-root user와 정확한 Node pin이 없다.

문서는 구현과 같은 PR에서 함께 검증해야 하며, 실행 가능한 smoke script를 문서의 단일 기준으로 삼는 편이 안전하다.

## 제품 결정 반영 상태

| 확정 결정 | 현재 상태 | 다음 조치 |
|---|---|---|
| 브랜드 `SOC` | 대체로 반영 | 모바일 홈 identity와 메타데이터 보강 |
| 공식 Instagram | Footer에 반영 | 다른 미확인 링크 금지 |
| 개발 데이터 초기화 가능 | seed 존재 | reference/demo seed 분리, prod guard |
| 사용자당 수기 회비 상태 | 구현됨 | `coverageSemesters` 제거, 이력 무결성 수정 |
| 운영 CMS 필요 | 10개 문구만 구현 | 구조화 콘텐츠와 publish workflow |
| 공개 화면 완전한 한·영 | 부분 구현. 행사 영문 설명에 한국어 잔존 | 번역 completeness와 API 강제 |
| desktop admin 우선 | 기본 틀 구현 | 업무 기능·정보 밀도·저장 상태 개선 |
| 자유서술 기본 비공개 | 감사 시점 위반, 후속 구현 완료 | 회귀 테스트를 품질 게이트에 유지 |
| 게시 설문 구조 고정 | 후속 구현 완료 | lifecycle·분기형 version lineage·terminal archive 회귀 테스트 유지 |
| 로그인 후 원경로 복귀 | 미구현 | `returnTo` 구현 |
| 오류와 빈 상태 분리 | 미구현 | 공통 상태 모델 도입 |

회비는 “사용자당 현재 납부 여부”로 확정되었으므로 학기별 원장을 새로 만들지 않는다. 다만 현재 값의 변경 이력은 감사와 오류 복구를 위해 필요하다.

## 권장 진행 순서

### Gate 0 — 데이터·보안 차단

1. `[구현 완료]` 공개 설문 원문 차단과 기본값 `PRIVATE`
2. `[구현 완료]` 회비 납부일 훼손 및 동시성 수정
3. `[구현 완료]` 설문 행 잠금 동결·원자적 제출·terminal `ARCHIVED`·분기형 버전 계보
4. `[외부 조치 남음]` SSO credential 폐기 확인·Git 이력 정리
5. `[보류·현재 범위 제외]` 대량 이메일 정책과 구현
6. `[구현 완료]` nginx 업로드 제한과 proxy 경계, 실제 Nest asset endpoint 20 MiB/초과 응답 계약

### Gate 1 — 인증·무결성

1. session 단일 기준과 전역 refresh coordinator
2. DB unique/check constraint
3. 게시글+설문, 설문 복제·재정렬 transaction
4. 오류/빈 상태 분리

### Gate 2 — 운영 기반

1. `[부분 구현]` CI와 실DB 통합 테스트. fresh migration·lint·typecheck·실DB 회비/설문·build는 추가됐고 secret scan·Redis/app smoke는 남음
2. Playwright 핵심 E2E
3. readiness, logging, request ID, alert
4. backup/restore와 rollback runbook
5. production image와 DB script 정리

### Phase 1 — desktop admin 완성

1. 회비 관리
2. 설문·응답 안전성
3. 사용자·권한·감사 로그
4. 구조화 CMS
5. 대량 이메일은 사용자가 기능을 다시 채택한 뒤 별도 계획으로 편성

### Phase 2 — 공개 UI 개편

1. 공통 shell과 모바일 홈
2. 게시판 목록·상세·작성
3. 행사·설문·달력
4. 마이페이지·개인정보
5. About 실제 콘텐츠와 정적 roadmap 보강

### Phase 3 — 복잡도 정리

1. 대형 repository와 feature 분리
2. dead code·dependency·asset 삭제
3. package export와 lint boundary 정리
4. 번들·성능 budget

## 대규모 기능 개발 착수 조건

- 현재 활성 Gate 0의 저장소 내부 항목이 모두 검증되어야 한다. 보류된 대량 이메일은 이 조건에서 제외한다.
- SSO credential 회전·폐기와 Git 이력 정리 같은 외부 조치의 owner와 완료 증거가 기록됐다.
- nginx reverse proxy 업로드 경계값 E2E가 통과했다.
- 인증 만료·동시 refresh E2E가 통과한다.
- 회비와 설문 변경 이력이 보존된다.
- CI가 migration부터 production build와 핵심 Playwright까지 매번 실행된다.
- backup 복원 리허설과 장애 알림이 실제로 확인됐다.
- 공개 결과·연락망·개인정보 정책의 운영 책임자가 승인했다.
- `docs/REMAINING_WORK.md`의 오래된 완료 표기를 현재 코드와 다시 대조했다.

## 외부 확인이 필요한 항목

아래는 코드만으로 확정할 수 없다. 답이 없으면 괄호의 권장안을 적용한다.

1. 실제 SOC 연혁, 현재 조직 부서, 기수, 임원, 활동 실적의 확인 책임자

   권장안: 확인 전 하드코딩 연혁·조직은 공개하지 않는다.

2. 임원 개인 전화번호·이메일 공개 동의 여부

   권장안: 개인 전화는 숨기고 직책용 이메일만 공개한다.

3. 개인정보 처리 운영 주체의 법정 명칭, 담당 이메일, SSO 처리·위탁 정보

   권장안: 확정 전 신규 개인정보 기능을 배포하지 않는다.

4. 대량 메일의 발신 도메인, 발신자명, 회신 주소, provider와 예산

   권장안: provider 선정 전 현재처럼 발송은 비활성화하되 메뉴에는 명확한 준비 상태를 표시한다.

5. Footer의 `cs_suhak@kaist.ac.kr`가 공식 문의 주소인지 여부

   권장안: 검증 전 개인정보 권리 행사 창구로 사용하지 않는다.
