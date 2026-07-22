# Work Index

이 문서는 현재 작업 상태를 어디서 보면 되는지 정리한 안내 문서입니다. 2026-07-15 전수 감사 이후에는 감사 문서와 Gate 0 구현 현황을 함께 봅니다.

## 먼저 볼 문서

1. `docs/GATE0_IMPLEMENTATION_2026-07-15.md`
   - 전수 감사 이후 실제로 적용한 기반 보강, 검증 결과, 외부 조치와 보류 범위를 정리한 현재 상태 문서입니다.
   - 공개 설문, 회비, 설문 동결, SSO, 대량 이메일, nginx의 최신 판정은 이 문서를 우선합니다.

2. `docs/PROJECT_AUDIT_2026-07-15.md`
   - 현재 작업 트리의 구조, 데이터 무결성, 보안, 운영, 테스트, 라이브러리와 제품 완성도를 전수 점검한 최신 기준 문서입니다.
   - 기능 추가 전 차단 항목과 권장 구현 순서는 이 문서를 따릅니다.

3. `docs/DESIGN_AUDIT_2026-07-15.md`
   - 메인과 모든 공개·인증·관리자 route를 desktop/mobile에서 확인한 최신 디자인 감사 문서입니다.
   - 페이지별 문제, 개선안, 반응형·접근성·콘텐츠 규격과 개편 순서가 들어 있습니다.

4. `docs/FOUNDATION_DECISIONS_2026-07-15.md`
   - SOC 브랜드, 사용자당 수기 회비 상태, CMS, 한·영 지원, desktop admin 우선 등 확정된 제품 원칙입니다.

5. `docs/REMAINING_WORK.md`
   - 이전 안정화 pass의 작업 기록입니다.
   - 일부 완료 표기가 현재 코드와 맞지 않아 최신 감사 문서와 대조해 재정리해야 합니다.

6. `docs/SECURITY_PERMISSION_REVIEW.md`
   - 로그인, 세션, 권한, 업로드 보안 점검 결과입니다.
   - 인증/권한/운영 보안 관련 작업을 할 때 봅니다.

7. `docs/CURRENT_ARCHITECTURE_REVIEW.md`
   - 현재 폴더 구조와 아키텍처 개선 방향입니다.
   - 구조 변경이나 큰 리팩터링 전에 봅니다.

8. `docs/OPERATIONS_RUNBOOK.md`
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
   - 대량 이메일은 사용자가 구현 여부를 보류해 현재 Gate 0에서 제외합니다.

2. 인증·운영 기반 완성
   - session/refresh 단일화, Playwright·secret scan·Redis/app smoke, 관측성, backup/restore, 오류 상태를 정리합니다.

3. desktop admin과 공개 모바일 개편
   - 회비·설문·CMS 관리자 흐름을 먼저 완성하고, 공통 공개 shell과 모바일 게시판·홈을 개편합니다. 이메일은 재채택 시 별도 계획으로 편성합니다.
