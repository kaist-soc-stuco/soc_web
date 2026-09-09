# 보안 재점검 staging 실행 절차

작성: 2026-09-09

이 문서는 현재 코드의 local/fake 검증과 실제 staging 구성요소 검증을 분리한다. 운영 DB, 실제 SSO/SMTP/Google/S3 자격증명은 local 테스트에 사용하지 않는다. 배포는 `git pull` 결과를 추적하기 어렵기 때문에 고정 commit 또는 immutable image digest를 기록한다.

## 1. 코드·브라우저 context 검증

Python fake SSO와 disposable Compose를 사용한다. 실제 `.env`를 읽지 않으며, 합성 PostgreSQL/Redis volume을 테스트 종료 시 제거한다.

```powershell
python -m pip install -r tools/security_qa/requirements.txt
python -m playwright install chromium
powershell -ExecutionPolicy Bypass -File tools/security_qa/run_browser_e2e.ps1
```

검증되는 흐름은 다음과 같다.

- 임시 계정 A → 로그아웃 → 임시 계정 B
- 영구 계정 A → 로그아웃 → 영구 계정 B
- 설문 draft가 새 계정에 복원·저장되지 않음
- draft key에 token·학번·이메일이 들어가지 않음
- 실제 브라우저 cookie/sessionStorage/localStorage 상태와 서버 session 응답의 일치

`--Headed`를 사용하면 사람이 화면을 확인할 수 있다. 화면 캡처나 storage dump에는 개인정보·credential을 저장하지 않는다.

## 2. staging 배포 전 고정 조건

- 테스트 DB와 운영 DB를 분리하고, 테스트 계정·테스트 설문·테스트 게시판을 별도로 만든다.
- 배포 commit SHA, image digest, migration 상태, rollback image를 기록한다.
- Google은 test project의 service account와 disposable Spreadsheet/Folder만 사용한다.
- SMTP는 staging recipient allowlist 또는 provider sandbox를 사용한다.
- S3는 별도 test bucket/prefix를 사용하고 public access를 차단한다.
- TLS terminator와 reverse proxy의 실제 주소를 `TRUST_PROXY_IPS`/`TRUST_PROXY_HOPS`에 명시한다.

## 3. 외부 구성요소별 acceptance

### TLS/proxy

외부 URL에서 HTTPS redirect, `Secure; HttpOnly; SameSite` cookie, 실제 `X-Forwarded-*` 전달, untrusted forwarded-header 위조 차단, CSRF Origin, IP rate limit을 확인한다. 직접 API 호출만으로는 이 경로를 증명할 수 없다.

### Google

실제 ACL/scope로 연결·refresh·stale worker를 실행한다. 외부 write 1회에 audit 1회를 남기고 audit 재시도에서 외부 write가 늘지 않는지 확인한다. DB fencing은 이미 수락된 Google write를 취소하지 못하므로 늦은 외부 결과와 reconciliation도 확인한다.

### SMTP

선정된 provider의 sandbox에서 성공, timeout, partial acceptance, result lookup, idempotency/reconciliation을 확인한다. DB/audit 후속 실패에 대한 애플리케이션 상태 전이는 fake provider 테스트로 확인하고 provider별 수락 의미는 실제 provider 로그로 확인한다.

### S3

presigned POST의 조건, 만료·재사용·동일 key 덮어쓰기, 완료 후 반복 업로드, 삭제/암호화/versioning/object-lock 정책을 test bucket에서 확인한다. quota 예약 원자성은 DB concurrency test의 결과와 함께 기록한다.

### CI

PR을 올린 뒤 `quality.yml`의 verify/security job 로그를 보관한다. 전용 concurrency DB 변수가 실제 주입됐는지, 해당 테스트가 skip되지 않았는지, dependency/Trivy/Gitleaks 결과가 생성됐는지 확인한다.

### 백업/복구

새로운 복구 환경에 PostgreSQL, S3 asset/metadata, encryption key를 복원하고 애플리케이션 기동·조회·로그인 세션 무효화까지 확인한다. 생성된 백업 파일만으로는 복구 성공으로 표시하지 않는다.

## 4. 결과 기록 규칙

각 항목에 commit/image, 실행 시각, 환경 식별자, 명령, 핵심 결과, 로그 위치를 기록한다. 실제 자격증명·개인정보·토큰은 기록하지 않는다. local fake 검증은 `local verified`, staging 외부 구성요소 검증은 실제 증거가 있을 때만 `staging verified`로 구분한다.
