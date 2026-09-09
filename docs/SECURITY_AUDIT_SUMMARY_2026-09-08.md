# SOC Web 보안 점검 결과 요약

- 기준일: 2026-09-08 (Asia/Seoul)
- 기준 revision: `13c4b9d0c039362bf32b0c8d08ede8370ca9842d`
- 점검 범위: 현재 코드·설정·테스트·실행 중인 로컬 stack
- 제외: 과거 문서, 실제 production 외부 시스템, 실제 secret 사용 및 외부 계정 호출
- 상세 결과: [SECURITY_AUDIT_RESULTS_2026-09-08.md](C:/Users/Newbiedev/Desktop/soc_web/docs/SECURITY_AUDIT_RESULTS_2026-09-08.md)

## 한 줄 결론

S00~S14 점검은 완료됐다. 현재 증거만으로 exploit path와 production impact가 함께 검증된 Critical/High는 없지만, 의존성 advisory 4건과 privacy·권한·외부 연동·운영 경계의 높은 우선순위 재검증 후보가 남아 있어 이 문서만으로 출시 승인을 내릴 수 없다.

## 점검 규모와 신뢰도

| 항목 | 결과 |
|---|---|
| HTTP route | 196개 전체 매핑 |
| 비HTTP 작업 | scheduler·queue·CLI·import/export·storage·egress 13개 매핑 |
| finding | S02~S13 43개를 S14에서 중복 정리 |
| API 테스트 | 107 pass / 0 fail / 13 skipped |
| Web 테스트 | 35 pass |
| 품질 검사 | lint·typecheck·build pass |
| 로컬 smoke | health 200, 주요 제한·calendar 요청 정상 |
| 변경 범위 | 앱 코드·설정·운영 데이터 수정 없음 |

## 우선순위별 정리

### 1. 먼저 패치할 항목

| 항목 | 내용 | 현재 상태 |
|---|---|---|
| S12-F02 | `sanitize-html` runtime advisory | 설치 버전이 advisory 영향 범위. 패치 후 rich-text 회귀 테스트 필요 |
| S12-F03 | `@tiptap/core` runtime advisory | 설치 버전이 advisory 영향 범위. editor 저장·렌더링 회귀 테스트 필요 |
| S12-F04 | `qs` runtime advisory | Express/body-parser 전이 경로. parser/query 회귀 테스트 필요 |

세 항목은 현재 registry 기준 runtime Moderate advisory 4건에 해당한다. 이는 exploit 성공을 의미하지 않지만 수정 우선순위가 가장 명확한 항목이다.

### 2. 출시 전 재검증할 High 후보

| 영역 | Finding | 확인할 피해 |
|---|---|---|
| 로그인 | S02-F04~F05 | login CSRF, URL·access log의 bearer token 노출 |
| 권한 | S03-F01 | `MANAGE_ROLES`로 과도한 권한을 위임할 수 있는지 |
| 게시판·자산 | S05-F01~F02, S06-F01 | 익명 작성자·비밀글 댓글·비밀 첨부파일의 공개 여부 |
| 설문 | S07-F02~F03 | 타인 응답 첨부파일·설문 이미지 참조 우회 |
| 외부 동기화 | S08-F02 | 철회된 연락처가 Google Sheets로 계속 전송되는지 |
| 콘텐츠 | S09-F01 | CMS의 `javascript:` 등 위험 scheme 저장·렌더링 |
| 메일 | S10-F01 | SMTP 성공 뒤 상태 오류 시 중복 발송 |
| 자격증명·운영 | S12-F01, S13-F03 | local credential material과 multi-replica stale worker 영향 |

위 항목은 현재 환경·정책·fixture·production 배포 조건을 더 확인해야 최종 severity를 확정할 수 있다. 아직 해결된 finding으로 표시하지 않았다.

### 3. 보강 및 운영 확인 항목

- 세션 revoke/refresh/consent 경합, proxy·cookie·CSRF, presign 크기 검증
- 공개 PII와 survey metadata 최소화, export cache 제어, fee/payment idempotency
- global rate limit, parser·응답·export·stream 상한, request/provider timeout
- queue lease/fencing, Redis memory cap, PostgreSQL/Redis/asset backup·restore drill
- CDN tarball integrity, non-root/digest-pinned image, CI secret/dependency/container scan
- production TLS/WAF/firewall, S3 IAM·bucket ACL, Google sharing policy, SMTP/OAuth/provider 정책

## 확인된 것과 확인하지 못한 것

### 확인된 것

- 현재 source의 route, guard, permission, object ownership, DTO, storage, queue, external egress 경계를 추적했다.
- current-build harness와 local HTTP/smoke에서 일부 인증 경합, privacy gate, asset reference, SMTP retry, unsafe URL, resource-boundary 후보를 재현했다.
- 현재 Git 추적 파일에서 secret 파일·marker는 확인되지 않았고, local ignored credential material의 rotation은 수행하지 않았다.

### 아직 확인하지 못한 것

- 실제 production TLS/WAF/rate limit/cache, cloud secret manager/firewall, S3 IAM/bucket policy
- 실제 Google/SMTP/KAIST/holiday/ICS/ChannelTalk provider와 ACL·retention
- browser login CSRF/referrer history, multi-replica lock expiry, 대규모 부하·slow client
- dependency exploit payload, Postgres/Redis 장애, backup restore와 RPO/RTO

## 다음 행동

1. `sanitize-html`, `@tiptap/core`, `qs` 패치와 회귀 테스트
2. local credential material의 운영 사용 여부 확인 및 필요 시 rotation/revocation
3. privacy·asset·survey·권한 경계를 공통 policy로 수정하고 실패 재현 테스트 고정
4. resource/rate/timeout·queue fencing·SMTP idempotency 보강
5. production 배포·ACL·secret·backup/restore 증거 확인

이 요약은 보안 점검 결과를 읽기 쉽게 압축한 문서이며, 전체 안전 보장이나 production release approval이 아니다.
