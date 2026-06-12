# Work Index

이 문서는 현재 작업 상태를 어디서 보면 되는지 정리한 안내 문서입니다. 앞으로는 먼저 이 파일과 `docs/REMAINING_WORK.md`를 보면 됩니다.

## 먼저 볼 문서

1. `docs/REMAINING_WORK.md`
   - 현재까지 완료한 안정화 작업과 남은 작업의 단일 기준 문서입니다.
   - 다음 작업을 고를 때는 이 문서를 우선 봅니다.

2. `docs/SECURITY_PERMISSION_REVIEW.md`
   - 로그인, 세션, 권한, 업로드 보안 점검 결과입니다.
   - 인증/권한/운영 보안 관련 작업을 할 때 봅니다.

3. `docs/CURRENT_ARCHITECTURE_REVIEW.md`
   - 현재 폴더 구조와 아키텍처 개선 방향입니다.
   - 구조 변경이나 큰 리팩터링 전에 봅니다.

4. `docs/OPERATIONS_RUNBOOK.md`
   - 배포 후 운영자가 수동으로 실행할 절차입니다.
   - 배포 전 preflight, DB migration/seed, 권한 smoke QA, 로그 확인, upload orphan cleanup 절차를 둡니다.

## 참고용 문서

- `docs/DEVELOPMENT_GUIDE.md`: 코드 작성 규칙
- `docs/UI_UX_GUIDE.md`: UI/UX와 미감 기준
- `docs/ARCHITECTURE_REVIEW_AND_PRIORITIES.md`: 초기에 작성한 구조 리뷰와 우선순위

## 현재 남은 큰 작업

1. 반복 UI 소규모 추출
   - confirm dialog, attachment list, comment thread, role permission matrix처럼 반복이 분명한 컴포넌트만 점진적으로 분리합니다.

2. 실제 사용 중 발견되는 페이지별 버그 수정
   - 게시글 상세, 마이페이지, 권한 관리, 행사/설문 흐름은 큰 구조보다 실제 사용 중 발견된 결함 위주로 다룹니다.
