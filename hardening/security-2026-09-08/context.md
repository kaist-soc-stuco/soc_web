# 보안 수정 권장안의 입력 기록

- 분석일: 2026-09-08
- 입력: 일반 문서 모음. Codex Security 봉인/manifest 검증을 주장하지 않는다.
- 보고서 기준 revision: `13c4b9d0c039362bf32b0c8d08ede8370ca9842d`
- 재검토 checkout: `221203ac24a642a3494a3133a63b9e518bbe616c` + 모바일 UI 미커밋 변경.
- sourceDrift: present. 두 revision 사이 API/shared/infra/lockfile 차이는 없다. Web은 변경됐으므로 로그인 callback/초안/CMS 렌더링 판단을 현재 소스로 갱신해야 한다.
- 과거 제품/디자인 계획은 입력에서 제외한다. 사용자가 판단을 요청한 이번 보안 결과/요약/범위는 보안 증거로만 읽는다.

| 증거 | 문서 | SHA-256 |
| --- | --- | --- |
| E01 | 보안 상세 결과: `docs/SECURITY_AUDIT_RESULTS_2026-09-08.md` | `595b9d116e8eb8cb06acc58298620c3987d712a1b04a755ef1a2fb1a7e82f522` |
| E02 | 보안 범위·위협 모델: `docs/SECURITY_AUDIT_SCOPE_2026-09-08.md` | `d935f760b807c204f85f6f0247234e631846b8b874c32458a471b84a498386a0` |
| E03 | 보안 결과 요약: `docs/SECURITY_AUDIT_SUMMARY_2026-09-08.md` | `404c3f2cf1d2bb467cdd350ab1f1a0f52f160ca4f8427945dc480ffc594b219a` |

collectionSha256: `914ad6b64629881d74e69451a4b977fabf735392bae3bc82500ad6b698829ae5`

계산: 위 문서 순서의 `{path,sha256}` 배열을 Python `json.dumps(sort_keys=True,separators=(',',':'))`로 직렬화한 UTF-8 bytes의 SHA-256. 원본 문서는 수정하지 않는다.

현재 직접 재확인한 코드: article service/repository, comment service, AssetService.getFile, survey response asset validation과 answer validation, RoleGroupsService create/update/assign, ContactsController와 GoogleContactSheetsService.sync, auth callback/session/Redis repository, vote submit/close repository, bulk email retry, Nginx와 bootstrap.

현재 직접 실행한 검사: revision/drift·dirty 상태, `pnpm audit --prod --json`(Moderate 4건 재확인). 기존 보고서의 107 pass/13 skipped 및 하네스 재현은 입력 증거이며 이번 턴에서 다시 실행한 결과가 아니다. 실제 provider/운영 서비스 호출·secret 검증·credential rotation·원본 취약점의 새 HTTP exploit 재현은 하지 않았다.

현재 로컬 `.env`는 이전 사용자 요청으로 Python SSO fixture를 사용한다. Google/KAIST sync는 꺼져 있고 이메일은 dry-run이다. 이를 production 구성으로 해석하지 않는다. 비밀값은 읽어 출력하지 않았다.
