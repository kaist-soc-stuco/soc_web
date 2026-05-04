# 설문조사 시행

## Flow

1. 새로운 설문조사 제작

2. 링크 생성 `/survey/{survey_id}`

3. 링크에 접속하면 상태에 따라 진행 전 / 문항 표시 / 마감을 표기

---

# 설문조사 DB

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
