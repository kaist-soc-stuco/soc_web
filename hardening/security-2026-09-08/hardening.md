# Security Hardening Review: SOC Web

현재 코드의 개인정보·첨부파일 경계를 먼저 수정하고, 인증 수명과 원자적 상태 전이를 이어서 고치는 방향을 권장한다. **Luna max에 전달할 문서는 [최종 구현 지시서](implementation/domain-policy.md)**다. 이 문서 묶음은 권장안이며 패치 완료 또는 출시 승인이 아니다.

## Evidence Basis

[입력 기록](context.md)의 보안 상세 결과·범위·요약을 읽고 핵심 API 소스를 다시 확인했다. 43건은 확정 취약점·정책 후보·운영 확인 사항이 섞인 목록이다. 이 턴에서 의존성 runtime advisory 4건을 재조회했으며, 기존 보고서의 하네스와 107 pass/13 skipped 결과는 다시 실행한 것으로 표시하지 않았다.

보고서 기준 `13c4b9d`에서 현재 `221203a`까지 API/shared/infra/lockfile 변화는 없지만 Web과 로컬 환경은 달라졌다. 입력 문서는 그대로 보존하고 별도 파생 문서를 작성했다. 과거 제품·디자인 계획은 근거로 사용하지 않는다.

## Constraints

기존 NestJS/Postgres/Redis를 유지하며 모바일 개선과 로컬 Python QA SSO를 보존한다. 개인정보 비저장 로그인과 투표 익명성을 약화시키지 않는다. 성능 budget과 실제 production ACL/TLS/복원 증거는 미제공이다. 외부 호출·rotation·배포 없이 검토 가능한 구현 지시를 제공한다.

## Opportunity Portfolio

우리가 선택할 구조적 대안은 **Option 1: 경로별 검사 보강**, **Option 2: 도메인 공통 정책과 정규화된 파일 참조**다. 두 대안 모두 당장 누락된 검사를 고치지만, Option 2는 같은 비밀글을 본문·댓글·파일에서 다르게 판단하는 원인을 줄인다.

| Opportunity | Evidence | Options | Recommendation | Proposal |
| --- | --- | --- | --- | --- |
| 객체 접근·공개 표현·파일 참조의 일관성 | 익명 작성자, 비밀 댓글/neighbor/첨부, 설문 혼합 ID/이미지 승격 6건 | 1 경로별 검사 / 2 도메인 공통 정책 | Option 2. 긴급 경로는 Option 1 방식으로 먼저 차단 후 이동 | [근거·설계·비용 비교](proposals/resource-policy.md) |

인증 경쟁, SMTP 불확실 상태, 과비 원장, 투표 cutoff, 외부 resource cap은 이 정책 모듈로 해결되지 않는다. 별도 구조 개편 프로젝트로 확장하지 않고 [H02~H09 작업](implementation/domain-policy.md)으로 명확히 분리했다.

## Recommendation Summary

나는 입력 요약의 “의존성 먼저, 그다음 재검증”을 엄격한 선후 관계로 채택하지 않는다. 설치 버전 패치는 명확하고 필요하지만, 현재 소스의 비밀 댓글/파일과 혼합 asset ID도 즉시 테스트·수정 가능한 결함이다. 코드상 막아야 할 정보 경계를 실제 노출 데이터가 없다는 이유로 남겨두지 않는 편이 타당하다.

기존 구조를 유지하며 domain policy를 모듈 내에서 공유하면 서비스 분리의 운영 비용 없이 회귀 위험을 줄일 수 있다. 추가 DB 조회와 복합 권한의 의미가 가장 큰 비용이므로 기존 본문 정책을 기준으로 부정/정상 양쪽 테스트를 먼저 고정한다. 성능 비용은 아직 측정하지 않았으며 N+1과 list p95를 후속 비교한다.

특히 네 가지 잘못된 결론을 피한다. ignored secret 파일은 유출 증거가 아니다. `MANAGE_ROLES`의 무제한 위임은 정책이 확정되어야 vulnerability 판정이 가능하다. public contact 저장 동의가 모든 필드 인터넷 공개 동의라는 근거는 없다. SMTP와 DB 사이에 transaction/outbox만 추가해도 exactly-once가 보장되는 것은 아니다. 권장안은 이 차이를 반영해 실행 가능하게 구체화했다.

## Next Decisions

사용자가 요청한 handoff 범위는 [Luna max 최종 지시서](implementation/domain-policy.md)에 완료했다. 권장 기본안을 실행 방향으로 삼되 실제 기존 계약과 충돌하는 migration만 좁혀 확인한다. 43건 처리표와 기능별 release gate를 사용하고, 운영 미확인을 전체 구현 중단이나 무조건 출시 불가와 혼동하지 않는다.

구조화된 기록: [hardening.json](hardening.json). 후속 결과는 `implementation/RESULTS.md`에 별도로 작성한다.
