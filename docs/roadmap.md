# FAQ

## FAQ란?

- Frequently Asked Questions

- 노션에 있던거 그대로 가져온거임

## FAQ configs

- 국문/영문 Question

- 국문/영문 Answer

- 최종 수정 시각

- 최종 수정 관리자

## FAQ 관리

집행위 중 FAQ 관리 권한을 가진 사람에게 FAQ CRUD를 지원하는 기능

- 각 FAQ는 영어/한국어로 질문/응답을 모두 적어야 함

- Topic 및 그 안에서 순서도 지정 가능

## FAQ Viewer

사용자가 전산학부 (& 집행위) FAQ를 볼 수 있는 기능

> <https://kaist-cs.notion.site/FAQ-Book-or-9f9d3923a82347fa83b5a74e80ef1165> 참고

- Accordion 같은 collapsible 형식으로 보여주기

- 저장된 order에 따라 받아오고, Topic 끼리 나눠서 보여주기

---

# SSO Login & User Managing

## User configs

- KAIST UID

- user id

- std(emp)\_no (학번/사번)

- name_kr

- name_en

- email

- fee_paid

- 전산 주/복/부전 여부 → bit mask

- permission

## JWT 토큰 관리

1. 토큰 발급 및 세션 저장

- 로그인 성공 시 상태(`persisted` | `temporary`)에 맞춰 Access/Refresh 토큰 생성.

- Refresh JWT는 `sid`(세션 ID), `jti`(토큰 식별자), `mode`, `sub` 포함.\
  (sub: persisted 모드에서는 `userId`, temporary 모드에서는 `pendingLoginId`)

- 생성된 세션 정보를 `sessionId`를 키로 하여 Redis에 저장 (`refreshJti`, `expiresAt`, `revoked`).

2. 토큰 검증 (API 요청 시)

- Access Token의 시그니처와 `exp`(만료 시간) 검증. 만료 시 `401 Unauthorized` 예외 반환.

- Refresh 검증: 토큰의 서명 및 필수 클레임(`sid`, `jti`, `sub`, `mode`) 누락 여부 확인.

3. 자동 재발급 (Silent Refresh)

- (`api-client/src/index.ts`): retryOnUnauthorized 옵션이 켜진 요청에서 API 응답이 `401`일 경우 `sendRefreshRequest()` 자동 호출.
  - `refreshInFlight` 변수를 활용해 리프레시 API가 단 1번만 호출되도록 제어.

- API 호출: `POST /api/auth/refresh`

4. 재사용 탐지 및 토큰 회전 (Refresh 로직 내부)

- 실행 검증: `sid`로 Redis 세션 조회. 세션이 존재하지 않거나 `revoked: true`이면 갱신 거부 및 401 반환.

- Refresh 토큰의 `jti`와 Redis에 저장된 `refreshJti` 대조.
  - 불일치: 해당 세션을 즉시 폐기(`revoked: true`) 처리.

  - 일치: Redis의 `refreshJti`를 새로운 `jti`로 갱신.

- 새로 발급된 Access/Refresh 토큰 덮어쓰기.

## 로그아웃

1. 로그아웃 요청 (`POST /api/auth/logout`)

- 프론트 로직: 사용자가 로그아웃 버튼 클릭 시 API 호출.

- 백엔드 로직: 요청 쿠키에서 `sessionId` 추출.

2. 서버 세션 파기 (Revoke)

- 실행 함수: `AuthSessionService.revoke(sessionId)`

- 백엔드 로직: 추출한 `sessionId`를 기반으로 Redis 조회.

- 세션 레코드의 `revoked` 값을 `true`로 업데이트.

3. 클라이언트 쿠키 초기화 및 완료

- 백엔드 로직: 클라이언트 브라우저의 인증 쿠키(`access_token`, `refresh_token`, `session_id`)의 `Max-Age`를 `0`으로 설정 (쿠키삭제)

## 과비 납부 여부

집행위 담당자가 수동으로 각 학생 별 과비 납부 여부를 기입

학생 본인은 마이페이지에서 자신의 과비 납부 여부가 잘 기입되었는지 확인 가능

## 포탈 로그인

1. 인증 시작(`GET /api/auth/login/start`)
   1. `state`, `nonce` (UUID) 생성

   2. `auth:sso:state:${state}` 키에 `nonce` 정보를 포함한 페이로드 저장 (TTL 5분)

   3. 프론트에 `{ clientId, loginUrl, redirectUri, state, nonce }` 페이로드 반환

2. SSO 페이지 이동(`POST sso.kaist.ac.kr`)
   1. 프론트: `client_id`, `redirect_uri`, `state`, `nonce` hidden form에 담아 POST, SSO 로그인 페이지로 리다이렉트.

3. 콜백 수신 및 검증(`POST /api/auth/login`)
   1. `body.code` 및 `body.state` 누락 시 `missing_callback_params` 에러 반환.

   2. `body.state` 키로 `StoredLoginState` 조회. 누락/만료 시 `invalid_or_expired_state` 에러 반환.

   3. SSO 서버(`SSO_AUTH_API_URL`)에 `code`를 전송하여 `userInfo` 및 `nonce` 수신.

   4. 응답받은 `nonce`와 Redis에 저장된 `nonce` 일치 여부 확인. Redis에서 해당 `state` 키 삭제.

4. 결과(분기)
   1. 기존 사용자
      1. `AuthSessionService.issuePersistedSession()` 호출하여 실제 세션 및 토큰 발급.

      2. Redis에 `auth:login-result:${resultToken}` 키로 인증 정보 임시 저장 (TTL: 60초).

      3. `/login?status=success&resultToken=...` 주소로 프론트엔드 리다이렉트.

   2. 신규 사용자
      1. `pendingLoginRepository.save()`를 통해 Redis에 유저 정보 임시 보관 (TTL: 10분).

      2. `/login?status=consent-required&pendingLoginToken=...` 주소로 프론트엔드 리다이렉트 (동의 화면 분기).

5. 최종 토큰 교환 및 완료 (`GET /api/auth/login/result`)
   - `AuthService.consumeLoginResult(resultToken)`

   - Redis에서 `auth:login-result:${resultToken}` 키를 `GETDEL` 명령어로 1회만 소비.

   - 추출된 `accessToken`, `refreshToken`, `sessionId`를 `HttpOnly` 쿠키에 저장.

---

# Utils

## 중앙화된 시간 관리 함수

## 중앙화된 이메일 발송 함수

## Permission Utils

유저의 권한을 쉽게 확인/수정할 수 있는 도구

### Permission configs

Only for 집행위

- CODE

- bit_value

- 권한 이름

---

# 게시판

## 게시판이란?

- 각종 주제의 글을 여러 개 업로드 할 수 있는 기능

## Board configs

- code (표시 용 간단한 코드)

- 국문/영문 제목

- 국문/영문 설명

- 읽기 권한

- 쓰기 권한

- 댓글 권한

- 댓글 허용 여부

- 비밀글 허용 여부

- 좋아요 허용 여부

- 게시판 표시 순서

- 게시판 숨김 여부

- 홈 화면 표시 여부

## Article configs

- 작성자

- 제목 (한글)

- 본문 (한글)

- 상태 (draft, published, deleted, hidden)

- 읽기 권한 범위 (all, kaist, soc, author_and_staff, staff)

- (집행위원용) 고정글 여부

- (집행위원용) 고정 순서

- (집행위원용) 영문 제목

- (집행위원용) 영문 본문

- 게시 시각

- 최종 수정 시각

- 삭제 시각 (이후 지정된 시간이 지나면 최종 삭제)

## Asset configs

- Article ID

- 게시글 내 정렬 순서

- 타입 (image, attachment(file), image_thumbnail)

## Comment configs

- Article ID

- Parent Comment ID

- 작성자

- Status (published, secret, deleted)

- 작성 시각

- 수정 시각

## Reaction configs

- Article ID

- User ID

- 반응 종류 (좋아요, 싫어요)

- 반응 시각

## Matcher configs

셋 중에 2개만 있어도 가능

- Article ID

- Event ID

- Survey ID

## 게시판 주제들

- 집행위 공지

- 집행위 행사

- Human of CS

- 외부 홍보 글

- 건의 사항

- 연구실

- ESCamp

## 게시판 홈

- 각 게시판으로 이동할 수 있는 Link

- 각 게시판 별 가장 최근 글

- 여러가지 모양의 viewer?

---

# 설문조사

## Flow

1. 새로운 설문조사 제작

2. 링크 생성 `/survey/{survey_id}`

3. 링크에 접속하면 상태에 따라 진행 전 / 문항 표시 / 마감을 표기

## 내 응답 보기 페이지

내가 제출한 설문조사의 응답을 모아보는 페이지

## (집행위용) 설문조사 결과 분석 페이지

## 설문조사란?

- Google Forms의 clone

- 여러가지 형식 및 응답 regex parsing을 지원해야 함

굳이 이렇게 해야할까\
다양하게 오픈소스들이 있고, 질문 형식이 다각화 될 수도 있는데, 기존에 있는 스택을 쓰고, 최대한 "전산"에만 들어가는 조건 (과비 납부자) 이런 느낌까지는 우리가 판단하고, 나머지 기본적인 요소는 이미 있는 걸 쓰는게 좋지 않을까

### 구현은?

최대한 자유롭게 설문조사를 구성할 수 있도록 하기 위한 노력

- 단위는 [Survey → Section → Question] 이고,

- 각 Question 별 Answer가 mapping 되며

- User 별 Response가 mapping되고,

- Response 안에 각 Answer가 들어있음

## Survey configs

- 국문/영문 제목

- 국문/영문 설명

- 제작자

- 현 상태 (draft, scheduled, open, closed, archived)

- 게시 시각

- 최종 수정 시각

- 연결 게시글

- 과비 납부자 응답 제한 여부

- 로그인 없이 응답 가능 여부

- 선착순 응답 제한 인원

- 설문조사 열리는 시각

- 설문조사 닫히는 시각

## Section configs

- Survey ID

- 국문/영문 제목

- 국문/영문 설명

- 동일 survey 내 정렬 순서

## Question configs

- Section ID

- 국문/영문 제목

- 국문/영문 설명

- 질문 종류

- 응답 정규식 파싱

- 수정 시각 제한

- 동일 section 내 질문 순서

## Response configs

- Survey ID

- (교내 사람) ID

- (외부인) 전화번호

- 현 상태 (draft, submitted, approved, rejected, waitlisted)

- 제출 시각

- 최종 수정 시각

- 검토 관리자

- 선정/반려 사유

## Answer configs

- Response ID

- Question ID

- 응답 내용

- 최종 제출 시각

---

# 집행위용 기능

## 집행위 연락망

과거 집행위 정보 조사 및 기록

### StucoRole configs

- kaist_uid

- 년도

- 역할

---

# 챗봇

대화형 llm 페이지 (link chatgpt.com) 구현 및 api 연결

---

# 캘린더

## Event configs

- 국문/영문 제목

- 국문/영문 설명

- 시작 시각 (ms)

- 종료 시각 (ms)

- 종일 여부

- 장소

- 보기 권한

- 제작자 (집행위)

- 최종 수정 시각
