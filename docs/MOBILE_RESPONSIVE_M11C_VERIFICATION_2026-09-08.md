# 모바일 반응형 M11-C 검증 기록

- 검증일: 2026-09-08 (Asia/Seoul)
- 대상: `docs/MOBILE_RESPONSIVE_PLAN_2026-09-07.md`의 M11-C
- 범위: 관리자 대량 이메일 작성·템플릿·발송 검토·이력, 과비 수납 파일 안내·일괄 납부·납부 상세
- 원칙: 긴 입력의 초안·오류·검토·취소 흐름을 모바일에서 접근 가능하게 하고, 실제 발송·예약·결제·원장 반영은 QA에서 실행하지 않는다.

## 1. 실행 전 재현 감사

익명 브라우저에서 실제 관리자 이메일 route를 열어 인증 경계를 확인했다. 승인된 관리자 테스트 계정이 없는 환경이므로 Mock 로그인·쿠키 주입·토큰 우회는 사용하지 않았다.

| 확인 대상 | 실제 결과 | 판정 |
| --- | --- | --- |
| `/admin/emails` 익명 진입 | 로컬 앱에서 실제 SSO URL `https://ssodev.kaist.ac.kr/auth/kaist/error/code`로 이동하고 `오류가 발생하였습니다. 서버 내부 오류가 발생하였습니다.`가 표시됨 | 인증 후 이메일 UI 조작은 계정 제약으로 보류 |
| `/admin/finance` 익명 진입 | 동일한 관리자 권한 보호 범위로 접근됨 | 임의 세션 없이 실제 SSO 경계 유지 |
| 발송·예약·결제·납부 확정 | 외부 부수 효과가 있는 API는 실행하지 않음 | QA 데이터 변경/메일 발송 없음 |

## 2. 적용 내용

### 대량 이메일

- 모바일 작성 화면의 페이지·shell·본문 패딩과 수신 대상 행을 좁은 폭에 맞췄다. 수신자 토큰과 대상 수는 줄바꿈되며 본문 HTML/미리보기 영역은 화면 폭을 넘지 않는다.
- 모바일에서 긴 본문 편집은 데스크톱을 권장한다는 안내를 추가했다. 기존 `soc:admin:bulk-email:draft` localStorage 자동 저장·복원 및 새로 시작/닫기 흐름은 유지한다.
- 에디터/미리보기/HTML 전환 탭과 수신자 필터 메뉴의 터치 영역을 확대하고, 리치 에디터 toolbar 높이를 조정해 44px 탭이 잘리지 않게 했다. 첨부·수신자 제거와 템플릿 삭제 조작도 모바일 최소 터치 영역을 사용한다.
- 템플릿, 발송 이력, 최종 검토 모달을 모바일 full-screen으로 전환하고 safe-area footer를 사용한다. 발송 검토 footer는 좁은 화면에서 테스트 발송/취소/최종 확정 순으로 세로 배치된다.
- 검토/템플릿 저장 또는 테스트 발송 오류·상태 메시지를 모달 내부에도 노출해 페이지 뒤에 가려지지 않게 했다. 최종 발송 버튼과 idempotency key·기존 검증 계약은 변경하지 않았다.

### 과비 수납

- 수납 관리 모바일 화면에 원장 반영 전 대상·금액·학기 확인 안내를 추가했다.
- XLSX 안내 모달과 일괄 납부 모달을 모바일 full-screen으로 전환하고, 납부 유형·적용 학기·결제 수단·일자·비고를 모바일 세로 흐름으로 유지했다.
- 대상별 수납액 표는 학생 비교·금액 입력이 필요한 영역이므로 모달 내부 표 viewport만 가로 스크롤하도록 기존 min-width 계약을 유지했다. 페이지 전체 overflow는 만들지 않았다.
- 납부 금액 검증/반영 오류를 납부 모달 안에 표시하고, 학생 납부 상세 drawer의 저장 오류도 drawer 안에 표시했다. 상세 footer는 좁은 폭에서 wrapping 된다.
- 기존 XLSX 파싱 오류·필수 값 검증·납부 금액/학기 범위 검증·결제 API·원장 이력 보존 계약은 유지했다. 실제 파일 반영·납부 확정은 실행하지 않았다.

주요 변경 파일:

- `apps/web/src/pages/admin/bulk-email-page.tsx`
- `apps/web/src/features/admin-finance/fee-management-page.tsx`
- `apps/web/src/components/ui/admin-page.tsx`
- `apps/web/src/styles.css`

## 3. 실제 런타임 검증

### Docker·API·DB

- `docker compose -f compose.yml build web`: 통과
- `docker compose -f compose.yml up -d web`: 통과
- `soc_web-postgres-1`: `Up (healthy)`
- `soc_web-api-1`, `soc_web-redis-1`, `soc_web-web-1`: `Up`
- migration one-shot container: 정상 종료
- `GET http://127.0.0.1:3000/health`: `status=ok`, `postgres.ok=true`, `redis.ok=true`
- DB 볼륨 삭제·초기화는 하지 않았다.

### 브라우저

- 실제 Codex in-app Chromium에서 로컬 `http://127.0.0.1:5173/admin/emails`와 `http://127.0.0.1:5173/admin/finance`를 열었다.
- 익명 관리자 보호에 따라 외부 SSO error page로 이동하는 것을 확인했다. 따라서 이메일 초안 입력/복원, 검토 모달, 수납 금액 편집, 저장 결과를 임의 세션으로 통과 처리하지 않았다.
- 인증 후 UI의 실제 픽셀 치수·모바일 draft 복원·데스크톱 회귀는 승인된 관리자 테스트 계정이 제공되면 390px·320px·768px·1440px에서 재검증해야 한다.

## 4. 자동 검증

| 명령 | 결과 |
| --- | --- |
| `pnpm --filter @soc/web typecheck` | 통과 |
| `pnpm --filter @soc/web lint` | 통과 (`UI unit contract passed`) |
| `pnpm --filter @soc/web test` | 35 pass, 0 fail |
| `pnpm --filter @soc/web build` | 통과 |
| `git diff --check` | 통과 |

빌드의 기존 informational warning(큰 청크, `not-found-page.tsx`의 동적·정적 import 중복)은 실패가 아니며 이번 변경으로 새 오류가 발생하지 않았다.

## 5. 제한 사항과 다음 작업

- SSO 테스트 계정 부재로 인증 후 이메일·수납 데이터를 브라우저에서 실제 입력/저장하지 못했다. 이는 Mock 로그인으로 우회하지 않고 남긴 검증 보류 항목이다.
- 실제 메일 발송·예약, 결제·납부 확정, XLSX 원장 반영은 외부 부수 효과가 있어 실행하지 않았다.
- 네이티브 iOS·Android 기기와 VoiceOver/TalkBack은 검증하지 않았다. 브라우저 검증은 실제 SSO 경계까지 수행했다.
- M11 이후에는 승인된 관리자 계정으로 계획의 390px·320px·768px·1440px 대표 route를 인증 후 검증하고, 필요하면 M00 route 매핑 누락을 재감사한다.

## 판정

M11-C의 대량 이메일·과비 수납 긴 입력 흐름에 모바일 세로 입력, full-screen 검토/수납 모달, 안전한 오류 노출, 초안 자동 저장 안내와 터치 영역을 적용했다. 기존 발송·결제 API와 권한/SSO 경계는 유지했고 Docker·DB·API는 정상이다. 인증 후 실제 데이터 저장과 외부 부수 효과는 의도적으로 실행하지 않았다.
