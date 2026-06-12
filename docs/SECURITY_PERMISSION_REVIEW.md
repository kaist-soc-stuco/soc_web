# Security And Permission Review

## Frontend Guard Hardening Update

- `AuthGuard` now supports both a single required permission and an "any of these permissions" check.
- The admin shell is limited to users with at least one operational admin permission: survey management, content management, finance management, or full admin.
- Contact management and bulk email pages now block page rendering before their admin-only API calls can run.
- The header admin entry now follows operational admin permissions instead of only the raw full-admin bit.
- Board write/edit routes now require a persisted profile, and board writing uses persisted profile capability instead of temporary authenticated state.
- Uploaded assets now have an admin-only orphan cleanup path with a grace period, and static upload responses set `X-Content-Type-Options: nosniff`.

## Pre-Deploy Regression Coverage

- Board read access is covered by API smoke tests for public, login-only, and admin-only boards.
- Survey access is covered by API smoke tests for unpublished survey preview, regular-user 404, private analytics 403, and manager analytics access.
- Event/survey tab data flow is covered by web smoke tests so event-connected child surveys do not duplicate in the pure survey tab.
- Always-open survey cards are covered by web smoke tests so `isAlwaysOpen` without dates renders as ongoing/`상시`.

작성일: 2026-05-29

이 문서는 현재 로그인, 세션, 권한, 업로드 구조를 운영 시나리오 기준으로 점검한 결과입니다. 목표는 학생회 운영진이 쓰는 가벼운 권한 관리 UX를 유지하되, 서버 권한 검증은 확실하게 두는 것입니다.

## 현재 인증 흐름

1. 프론트가 API의 `GET /auth/login/start`를 호출합니다.
2. API가 SSO authorize용 `state`, `nonce`를 만들고 Redis에 저장합니다.
3. SSO callback은 API의 `POST /auth/login`으로 들어옵니다.
4. API가 SSO userInfo를 교환하고 nonce를 검증합니다.
5. 신규 사용자는 동의 플로우로, 기존 사용자는 persisted session 발급으로 이동합니다.
6. persisted session은 HttpOnly cookie와 Redis session record를 사용합니다.
7. temporary session은 sessionStorage 기반으로 제한된 기능만 사용할 수 있게 분리되어 있습니다.

## 현재 권한 구조

- 권한 bit와 코드의 원천은 `shared/contracts/src/permissions-registry.ts`입니다.
- DB seed는 registry에서 permission row를 생성합니다.
- role group은 permission id 목록을 가지고, 사용자는 role group에 소속됩니다.
- API `AuthGuard`는 persisted session cookie를 확인하고 사용자 permission bitmask를 계산해 `request.user.permission`에 넣습니다.
- `@RequirePermissions(...)`는 API endpoint의 서버 권한 검증 원천입니다.
- 게시판 글쓰기/댓글/관리 권한은 board별 permission bit를 기준으로 서버에서 다시 검증합니다.
- 프론트의 버튼/드롭다운 권한 필터링은 UX 보조이며, 최종 권한 판단은 서버가 담당합니다.
- 이번 점검에서 `연구실`/`QnA` board seed의 write permission이 registry 의미와 어긋난 문제를 수정했습니다. `연구실`은 일반 작성 권한, `QnA`는 authenticated user 작성 가능 게시판으로 맞췄습니다.

## 잘 된 부분

- SSO `state`/`nonce`를 Redis에 저장해 callback 위조와 replay 위험을 낮추고 있습니다.
- session cookie가 HttpOnly이며 production에서는 secure cookie로 전환됩니다.
- role group 변경, 구성원 추가/제거 후 permission cache invalidation이 들어가 있습니다.
- 권한 관리 페이지는 raw permission code보다 운영 기능 단위 한글 라벨을 우선 보여주는 방향으로 정리되어 있습니다.
- asset upload는 로그인된 사용자만 가능하고, 크기 제한과 MIME allowlist가 있습니다. 업로드 SVG/HTML은 허용하지 않습니다.

## 우선 개선

### P0: 운영 배포 전 확인

1. 운영 secret 교체
   - `.env`의 개발용 JWT secret, pending login encryption key, SSO secret은 운영 배포 전에 반드시 교체해야 합니다.

2. CORS 설정
   - production에서 `CORS_ORIGIN`을 실제 web origin으로 명시하는 것을 권장합니다.
   - credentials cookie를 쓰므로 `*` 또는 과도하게 넓은 origin 허용은 피해야 합니다.

3. SSO redirect URI 검증
   - `SSO_REDIRECT_URI`는 SSO에 등록된 API callback URL과 정확히 일치해야 합니다.
   - 프론트 `VITE_*`가 아니라 API 서버 env에서만 관리하는 현재 구조가 맞습니다.

4. mock login 노출 확인
   - `POST /auth/login/mock`은 production에서 막혀 있지만, 배포 env의 `NODE_ENV=production` 설정을 확인해야 합니다.

### P1: 보안 hardening

1. CSRF 정책 명시
   - 현재는 SameSite=Lax cookie와 CORS 제한으로 일반적인 cross-site POST 위험을 낮추는 구조입니다.
   - 추후 외부 도메인 embed, SameSite=None, 더 넓은 CORS가 필요해지면 state-changing API에 CSRF token을 추가하세요.

2. 업로드 파일 lifecycle
   - 업로드 후 글에 연결되지 않은 파일 정리 정책이 필요합니다.
   - 운영 초기에는 `created_at` 기준 orphan asset cleanup script를 주기적으로 실행하는 정도면 충분합니다.

3. 정적 asset header
   - 업로드 파일은 public static으로 제공됩니다.
   - 업로드 SVG/HTML은 막혀 있지만, 필요하면 nginx/API static response에 `X-Content-Type-Options: nosniff`를 추가하세요.

4. debug endpoint 정리
   - `GET /auth/access-check`는 개발/진단용 성격이 강합니다.
   - 운영에 꼭 필요하지 않다면 production에서 비활성화하거나 health/debug 영역으로 분리하는 것이 좋습니다.

### P2: 권한 운영성

1. 권한 변경 audit
   - 현재 권한 변경은 기능적으로 동작하지만, 누가 언제 어떤 role group을 바꿨는지 기록하는 audit log는 없습니다.
   - 학생회 규모에서는 우선 role group 수정/구성원 변경 정도만 audit 대상으로 두면 충분합니다.

2. 관리자 자기 권한 제거 방지
   - 관리자가 자기 자신을 마지막 admin role에서 제거하는 경우를 막는 보호 장치가 있으면 운영 사고를 줄일 수 있습니다.

3. board permission source 정리
   - 프론트 fallback metadata와 DB board permission bit가 다르면 버튼 노출과 서버 판단이 어긋날 수 있습니다.
   - 최종적으로는 board metadata API를 통해 프론트도 서버 값을 사용하게 만드는 것을 권장합니다.

## 권한 구현 원칙

- 프론트 권한 체크는 버튼 숨김과 기본 선택값 제공을 위한 UX 장치로만 사용합니다.
- API endpoint는 `AuthGuard`와 `@RequirePermissions` 또는 feature service의 board-specific permission check를 반드시 통과해야 합니다.
- 새 권한은 `permissions-registry.ts`에 먼저 추가하고 seed, 프론트 라벨, role group UI가 그 값을 따라가게 합니다.
- 운영자 화면에는 `WRITE_NOTICE` 같은 코드보다 `공지사항 관리` 같은 기능 단위 라벨을 우선 노출합니다.
