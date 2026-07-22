# Gate 0 구현 현황

- 기준일: 2026-07-15
- 최종 갱신: 2026-07-16
- 목적: 전수 감사 이후 진행한 기반 보강의 현재 상태와 남은 경계를 한곳에 기록한다.
- 원 감사 문서: `docs/PROJECT_AUDIT_2026-07-15.md`, `docs/DESIGN_AUDIT_2026-07-15.md`

원 감사 문서의 문제 관찰은 감사 시점 기록으로 보존한다. 이후 코드 상태를 판단할 때는 이 문서의 구현 상태와 검증 경계를 함께 본다.

## 상태 요약

| 항목 | 현재 상태 | 구현·검증 범위 | 남은 일 |
|---|---|---|---|
| 공개 설문 원문 차단과 `PRIVATE` 기본값 | 구현 완료 | 신규 설문의 계약·DB·관리자 편집기 기본값을 `PRIVATE`로 맞췄다. 공개·관리자 집계 응답에서는 단답·장문·날짜·시간 원문을 반환하지 않고 선택형 집계만 제공한다. | 브라우저를 포함한 배포 전 회귀 검증은 전체 품질 게이트에서 계속 유지한다. |
| 회비 비고 수정과 상태 전환의 무결성 | 구현 완료 | 비고만 수정할 때 `paidAt`·`verifiedAt`을 보존하고 실제 상태 전환에서만 시각을 변경한다. 대상 사용자와 검증자를 정렬된 순서로 잠가 최초 생성·상호 갱신을 직렬화하며, 트랜잭션 안에서 확정된 행을 바로 반환한다. | 관리자 화면의 전체 집계·검색·이력 UX는 별도 제품 개선 범위다. |
| 설문 동결·원자적 제출·복제·보관 | 구현 완료 | 응답 삽입과 구조·의미 변경을 같은 설문 행 잠금으로 직렬화한다. `DRAFT`·`PUBLISHED`·`ARCHIVED`와 `archivedAt`을 DB CHECK로 `isPublished`와 일치시키며, 보관본은 설정·섹션·문항 수정 및 재게시를 거부한다. 복제본은 비공개·게시글 미연결 `DRAFT`로 만들고 `previousVersionId`와 파생 단계 `versionNumber`를 남긴다. 하드 삭제는 응답·파생본이 없는 `DRAFT`만 허용한다. | 별도 JSON 질문 snapshot은 만들지 않았다. 현재는 응답 후 문항·섹션·의미 변경과 응답 설문 삭제를 막아 참조 중인 질문 행 자체를 불변 기록으로 유지한다. 독립 보존 snapshot이 필요한 장기 보관 정책은 후속 제품 과제다. |
| SSO 샘플과 credential | 코드 트리 조치 완료·외부 조치 남음 | 위험한 JSP 샘플을 현재 트리에서 제거하고 `[etc]/SSO-Login-Guide/README.md`에 환경변수 기반 secret 관리와 TLS 검증 원칙을 남겼다. | 실제 credential의 회전·폐기 확인, Git 이력 정리, 이력 대상 secret scan은 저장소 밖 owner 조치가 필요하다. |
| 대량 이메일 | 보류·현재 Gate 0 제외 | 발송 UI와 API는 비활성 상태를 유지한다. 사용자가 구현 여부 판단을 보류했으므로 현재 기반 작업의 완료 조건에 포함하지 않는다. | 기능을 다시 활성화하기 전에 provider, 발신 도메인, 승인, 수신 거부, 반송 정책을 먼저 확정한다. |
| nginx·Nest 업로드 제한 | 구현 완료 | `/api/` 프록시에 `client_max_body_size 21m`을 두어 multipart 여유분을 확보했다. Nest의 Multer 단계는 정확히 20 MiB까지 허용하고 1 byte 초과부터 413으로 차단한다. 실제 Nest HTTP multipart 테스트로 초과 파일이 `AssetService`·스토리지에 도달하지 않는 것도 고정했다. | 운영 timeout·rate limit과 nginx→Nest 전체 배포 smoke는 Gate 2 운영 범위에 남긴다. |
| 상시 품질 게이트 | 구현 완료·원격 첫 실행 확인 필요 | `.github/workflows/quality.yml`에 fresh PostgreSQL migration, lint, typecheck, 전체 테스트, production build를 추가했다. 회비·설문 실DB 테스트는 같은 DB에서 파일 단위로 직렬 실행하고, CI에서 DB URL이 빠지면 skip 대신 즉시 실패한다. Actions는 검증한 release의 전체 SHA로 고정했다. | push 후 첫 GitHub Actions 실행을 확인한다. secret scan, Redis/app smoke와 Playwright는 후속 품질 게이트다. |

## 완료 판정 경계

현재 활성 Gate 0의 저장소 내부 완료 조건은 다음과 같이 본다.

1. `[완료]` 설문 동결·제출·명시적 보관·분기형 버전 계보와 양방향 동시성 회귀 검증
2. `[완료]` 실제 Nest asset endpoint의 20 MiB 경계·초과 413·저장 미호출 오류 계약
3. `[완료]` 공개 설문·회비·실DB 경쟁 테스트를 포함한 CI workflow 구현
4. `[확인 필요]` 저장소에 push한 뒤 원격 CI 첫 실행 결과 확인

다음은 코드만으로 닫을 수 없는 외부 조치다.

1. 노출 가능성이 있었던 SSO credential의 회전·폐기 사실과 시각을 운영 기록으로 확인한다.
2. Git 이력 정리 범위와 협업자 재동기화 절차를 정한 뒤 이력 secret scan을 수행한다.

대량 이메일은 현재 활성 Gate 0에서 제외한다. 향후 기능을 다시 채택하면 별도의 정책 게이트와 구현 완료 기준을 새로 연다.

## 현재 구현과 이후 제품 개선의 구분

- 설문 보관은 명시적 `ARCHIVED` terminal 상태다. 복제의 `versionNumber`는 전역 일련번호가 아니라 `previousVersionId`를 따라 증가하는 파생 깊이이므로 같은 단계의 분기가 존재할 수 있다.
- 응답 시점 질문 JSON 복사본은 없다. 대신 첫 응답 이후 질문·섹션·설문 의미를 변경하거나 삭제할 수 없게 하여 현재 관계형 질문 행을 불변 참조로 사용한다.
- 회비는 사용자당 현재 납부 상태 모델을 유지한다. 학기별 회계 원장이나 자동 입금 대조를 이번 기반 작업에 추가하지 않는다.
- 공개 설문 집계에서 자유서술 원문을 제거한 것과 관리자 원문 열람의 마스킹·보존·감사 정책은 서로 다른 과제다.
- nginx와 Nest의 크기 제한 정렬은 backup/restore, readiness, logging, alert, timeout, rate limit, 전체 배포 smoke를 완료했다는 뜻이 아니다.
- CI workflow 추가는 secret scan, Redis/app smoke와 Playwright E2E까지 완료했다는 뜻이 아니다.

## 검증 기록

- CI와 같은 단일 동시성 설정 및 같은 임시 PostgreSQL에서 API 테스트 89/89 통과, 조건부 skip 0건. 이 안에 설문 실DB 11건과 회비 실DB 3건이 포함됨
- Web 테스트 33/33 통과, API/Web lint와 전체 workspace typecheck 통과
- 빈 PostgreSQL에 `0000`부터 `0009`까지 전체 migration 적용 성공. `survey.result_visibility` 기본값 `PRIVATE` 확인
- `0008` 상태의 게시·비게시 행에 `0009`를 적용해 각각 `PUBLISHED`·`DRAFT` backfill 확인, lifecycle/isPublished 드리프트 시도는 DB CHECK가 거부함을 확인
- Drizzle 재생성 검사에서 추가 schema 변경 없음 확인
- 실제 nginx 설정으로 20 MiB multipart 전달과 프록시 한도 초과 413 차단 확인, `nginx -t` 통과. 실제 Nest HTTP endpoint는 정확히 20 MiB 201, 1 byte 초과 413, 저장 서비스 미호출을 확인
- 전체 workspace production build와 `git diff --check` 통과
- 현재 트리의 SSO credential/TLS 우회 위험 marker는 0건이지만, 삭제된 샘플을 포함한 Git 이력은 별도 정리가 필요함
