# Work Index

이 문서는 현재 작업 상태를 어디서 보면 되는지 정리한 안내 문서입니다. 2026-07-15 전수 감사 이후에는 감사 문서와 Gate 0 구현 현황을 함께 봅니다.

## 먼저 볼 문서

0. `docs/PRODUCT_REQUIREMENTS_2026-08-27.md`
   - 2026-08-27 운영 피드백의 확정 정책, 권한 재설계, 설문 참여 자격, Google Sheets 연동과 기능별 수용 기준을 정리한 최신 제품 요구사항입니다.
   - 해당 범위의 신규 구현과 삭제 판단은 이 문서를 가장 먼저 따릅니다.

1. `docs/GATE0_IMPLEMENTATION_2026-07-15.md`
   - 전수 감사 이후 실제로 적용한 기반 보강, 검증 결과, 외부 조치와 보류 범위를 정리한 현재 상태 문서입니다.
   - 공개 설문, 회비, 설문 동결, SSO, 대량 이메일, nginx의 최신 판정은 이 문서를 우선합니다.

2. `docs/PROJECT_AUDIT_2026-07-15.md`
   - 현재 작업 트리의 구조, 데이터 무결성, 보안, 운영, 테스트, 라이브러리와 제품 완성도를 전수 점검한 최신 기준 문서입니다.
   - 기능 추가 전 차단 항목과 권장 구현 순서는 이 문서를 따릅니다.

3. `docs/DESIGN_AUDIT_2026-07-15.md`
   - 메인과 모든 공개·인증·관리자 route를 desktop/mobile에서 확인한 최신 디자인 감사 문서입니다.
   - 페이지별 문제, 개선안, 반응형·접근성·콘텐츠 규격과 개편 순서가 들어 있습니다.

4. `docs/DEVELOPMENT_PLAN.md`
   - 홈·게시판·작성기·S3·캘린더·마이페이지·관리자·설문·메일·운영 로그 확장 요구사항의 실행 순서와 acceptance 기준입니다.
   - 사용자 직접 지시와 첨부 이미지 참고사항을 구분해 기록합니다.

5. `docs/FOUNDATION_DECISIONS_2026-07-15.md`
   - SOC 브랜드, 사용자당 수기 회비 상태, CMS, 한·영 지원, desktop admin 우선 등 확정된 제품 원칙입니다.

6. `docs/REMAINING_WORK.md`
   - 이전 안정화 pass의 작업 기록입니다.
   - 일부 완료 표기가 현재 코드와 맞지 않아 최신 감사 문서와 대조해 재정리해야 합니다.

7. `docs/SECURITY_PERMISSION_REVIEW.md`
   - 로그인, 세션, 권한, 업로드 보안 점검 결과입니다.
   - 인증/권한/운영 보안 관련 작업을 할 때 봅니다.

8. `docs/CURRENT_ARCHITECTURE_REVIEW.md`
   - 현재 폴더 구조와 아키텍처 개선 방향입니다.
   - 구조 변경이나 큰 리팩터링 전에 봅니다.

9. `docs/OPERATIONS_RUNBOOK.md`
   - 배포 후 운영자가 수동으로 실행할 절차입니다.
   - 현재 compose와 인증 방식이 달라진 부분은 최신 감사 문서에 따라 먼저 교정해야 합니다.

## 참고용 문서

- `docs/DEVELOPMENT_GUIDE.md`: 코드 작성 규칙
- `docs/UI_UX_GUIDE.md`: 이전 UI/UX 기준. 최신 페이지별 판단은 디자인 감사 문서를 우선합니다.
- `docs/ARCHITECTURE_REVIEW_AND_PRIORITIES.md`: 초기에 작성한 구조 리뷰와 우선순위
- `docs/ARCHITECTURE_AUDIT_2026-06-12.md`: 2026-06-12 기준 과거 감사 기록

## 현재 남은 큰 작업

1. 출시 차단 항목 교정
- 공개 설문, 회비, 설문 lifecycle·계보와 실제 Nest asset 업로드 응답 계약까지 저장소 내부 Gate 0는 구현·검증됐습니다.
   - SSO credential 폐기 증거와 Git 이력 정리는 외부 owner 조치로 남아 있습니다. 새 CI workflow는 push 후 첫 원격 실행을 확인해야 합니다.
- 대량 이메일은 수신 대상 filter/preview, Dooray SMTP, 예약·첨부·임시저장, 정적·사용자 정의 템플릿 CRUD, idempotency, 예약 취소·실패 재시도까지 반영했으며, Redis queue와 수신자별 delivery result는 별도 운영 hardening 범위입니다.

2. 인증·운영 기반 완성
   - session/refresh 단일화, Playwright·secret scan·Redis/app smoke, 관측성, backup/restore, 오류 상태를 정리합니다.

3. desktop admin과 공개 모바일 개편
   - 회비·설문·CMS 관리자 흐름을 먼저 완성하고, 공통 공개 shell과 모바일 게시판·홈을 개편합니다. 메일 사용자 템플릿·queue/idempotency는 별도 운영 hardening 범위입니다.

## 2026-08-20 구현 배치 바로가기

- 공개 shell·행사 grid·홈 carousel/calendar·editor interaction: `apps/web/src/components/organisms`, `apps/web/src/features/events-surveys`, `apps/web/src/pages`
- secret/view/like/scrap/draft API: `apps/api/src/features/board`, `apps/api/src/infrastructure/postgres/schema/board.schema.ts`, `shared/contracts/src/http/board.ts`
- 게시판 관리자 CRUD/archive: `apps/api/src/features/board/board.controller.ts`, `apps/web/src/pages/admin/board-management-page.tsx`
- 목록/행사 engagement·대댓글: `apps/web/src/components/ui/article-engagement-actions.tsx`, `apps/web/src/components/ui/comment-section.tsx`, `apps/api/src/features/board/comment.service.ts`
- 파일 저장소 provider/direct upload/migration: `apps/api/src/features/asset/asset.storage.ts`, `apps/api/src/features/asset/asset.service.ts`, `.env.example`의 `ASSET_STORAGE_PROVIDER`·`AWS_S3_*`
- 이용약관 route: `apps/web/src/pages/terms-page.tsx`, `apps/web/src/App.tsx`
- 직접 일정·ICS·KAIST 학사일정 scraper·Google 단방향 outbox: `apps/api/src/features/calendar`, `apps/api/src/infrastructure/postgres/schema/calendar.schema.ts`, `apps/web/src/features/events-surveys/events-surveys-calendar-management.tsx`, `.env.example`의 `GOOGLE_CALENDAR_ID`·`GOOGLE_KAIST_CALENDAR_ID`·`GOOGLE_SERVICE_ACCOUNT_KEY_FILE`
- 설문 no-deadline 정리: `shared/contracts/src/http/survey.ts`, `apps/api/src/features/surveys`, `apps/web/src/features/admin-surveys`, `apps/web/src/features/survey`
- 알림·로그인 세션·마이페이지: `apps/api/src/features/notifications`, `apps/api/src/features/auth`, `apps/web/src/features/my-page`, `shared/contracts/src/http/notifications.ts`
- 권한·사용자·과비: `apps/api/src/features/role-groups`, `apps/api/src/features/users`, `apps/web/src/features/auth`, `apps/web/src/features/admin-finance`, `apps/api/drizzle/0000_baseline.sql`
- 설문 grid/file upload/rich editor/조건부 section/server MIME·용량 검증: `apps/api/src/features/surveys/survey-branching.ts`, `apps/api/src/features/surveys`, `apps/web/src/features/survey`, `apps/web/src/features/admin-surveys`, `apps/web/src/components/organisms/question-editor-modal.tsx`, `apps/web/src/components/organisms/rich-text-editor.tsx`, `apps/web/src/components/organisms/section-editor-modal.tsx`, `apps/web/src/components/ui/rich-text-content.tsx`, `apps/api/drizzle/0000_baseline.sql`
- Dooray 메일 filter/preview/예약/첨부/임시저장/template CRUD/idempotency: `apps/api/src/features/email`, `apps/web/src/pages/admin/bulk-email-page.tsx`, `apps/api/drizzle/0000_baseline.sql`, `.env.example`의 `DOORAY_SMTP_*`·`BULK_EMAIL_*`
- 운영 로그 health/export/연락망 필터·masking·purge audit: `apps/api/src/features/audit`, `apps/api/src/features/health`, `apps/api/src/features/contacts`, `apps/web/src/features/admin-audit`, `apps/web/src/features/admin-contacts`, `apps/api/drizzle/0000_baseline.sql`
- 현재 결정과 미완료 범위: `docs/DEVELOPMENT_PLAN.md`의 `0.4 요구사항 확정 권장안`, `8. 이번 구현 배치 기록`
