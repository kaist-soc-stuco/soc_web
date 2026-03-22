# PassNi SSO Login Guide

이 문서는 `[etc]/SSO-Login-Guide` 아래 제공된 PDF/JSP 샘플을 기준으로, 현재 SoC Web 프로젝트에 필요한 로그인 연동 방식을 정리한 문서입니다.

## Source

- `PassNi_단일인증 적용 설명서.pdf`
- `00.DOC/PassNi_단일인증_API 가이드_v2.0.pdf`
- `01.Sample/singleMain.jsp`
- `01.Sample/singleAuth.jsp`

## Login Flow

1. 브라우저는 `GET /api/auth/login/start`로 로그인 시작 요청을 보낸다.
2. 서버는 `state`와 `nonce`를 생성해 Redis에 저장하고, SSO authorize URL로 `POST`를 보낸다.
3. 요청 파라미터는 `client_id`, `redirect_uri`, `state`, `nonce` 이다.
4. SSO 서버는 등록된 `redirect_uri`인 `POST /api/auth/login`으로 `state`와 `code`를 전달한다.
5. 서버는 전달받은 `code`와 `client_secret`을 사용해 사용자 정보 요청 API를 호출한다.
6. 서버는 응답의 `nonce`를 검증하고 `userInfo`를 파싱한 뒤, 로그인 결과를 `/login?status=...&reason=...`로 되돌린다.

## Required Parameters

### Authorize Request

- `client_id`: SSO에 등록된 시스템 ID
- `redirect_uri`: SSO에 등록된 콜백 URL
- `state`: CSRF 방지용 랜덤 값
- `nonce`: Replay Attack 방지용 랜덤 값

### Callback Response

- `state`: 최초 요청 시 보낸 값과 동일해야 함
- `code`: 사용자 정보 조회를 위한 일회성 코드

### User Info API Request

- URL
  - 개발: `https://ssodev.kaist.ac.kr/auth/api/single/auth`
  - 운영: `https://sso.kaist.ac.kr/auth/api/single/auth`
- Method: `POST`
- Header: `Content-Type: application/x-www-form-urlencoded;charset=utf-8`
- Body
  - `client_id`
  - `client_secret`
  - `code`
  - `redirect_uri`

### User Info API Response

성공 예시:

```json
{
  "userInfo": {
    "user_mbtlnum": "010-1223-2221",
    "user_email": "ssotest@kaist.ac.kr",
    "user_id": "ssotest"
  },
  "nonce": "random2"
}
```

실패 예시:

```json
{
  "errorCode": "ESA004",
  "error": "server_error"
}
```

## Project Decision

현재 프로젝트에서는 `/login` 페이지가 **SSO 시작 버튼과 결과 확인 화면** 역할만 담당한다.

- 브라우저에서 할 일
  - `VITE_SSO_REDIRECT_URI`로부터 `GET /api/auth/login/start`를 계산
  - 로그인 시작 버튼 제공
  - `status`, `reason`, `errorCode` 등 결과 쿼리 표시
- 서버에서 할 일
  - `GET /api/auth/login/start` 수신
  - `state`, `nonce` 생성 및 Redis 저장
  - SSO authorize URL로 POST form submit
  - `POST /api/auth/login` callback 수신
  - `state` 검증
  - `client_secret`을 사용한 사용자 정보 API 호출
  - `nonce` 검증
  - 서비스 로그인 세션 생성
  - `/login?status=...&reason=...`로 redirect

## Important Constraint

`client_secret`은 브라우저에 노출되면 안 된다. 따라서 사용자 정보 조회 API 호출은 프런트엔드가 아니라 서버에서 처리해야 한다.

또한 가이드 기준 callback 응답은 `POST`이므로, `redirect_uri`는 정적 SPA 라우트보다는 **서버 엔드포인트**로 두는 편이 안전하다.

예:

```env
VITE_SSO_REDIRECT_URI=https://soc-student-council.kws.inet.sparcs.net/api/auth/login
VITE_SSO_LOGIN_URL=https://sso.kaist.ac.kr/auth/user/single/login/authorize
VITE_SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SSO_AUTH_API_URL=https://sso.kaist.ac.kr/auth/api/single/auth
```

## Current Frontend Behavior

현재 `apps/web/src/pages/login-page.tsx`는 다음만 구현한다.

- `VITE_SSO_REDIRECT_URI` 표시
- `GET /api/auth/login/start`로 이동하는 로그인 시작 버튼 제공
- `/login?status=...&reason=...` 결과 표시
- 서버 콜백이 필요하다는 점을 UI로 안내
