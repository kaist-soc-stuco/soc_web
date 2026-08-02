# PassNi profile contract

Only own string properties are accepted. Values are trimmed; names are NFC-normalized and email is lowercased. Unknown provider properties are ignored. Invalid type, empty value, ambiguous identity, or over-bound value fails closed.

| Provider key | Profile field | Maximum UTF-8 bytes |
|---|---|---:|
| `user_id` | canonical and compatibility authority | 64 |
| `kaist_uid` | KAIST UID | 64 |
| exactly one of `std_no`, `emp_no` | student/employee number | 32 |
| `user_nm` | Korean name | 100 |
| `user_eng_nm` | English name | 100 |
| `user_email` | KAIST email | 254 |

`user_mbtlnum` is not mapped. New consented users and existing users store the same five encrypted profile fields. Existing users are updated only when row id, compatibility id, and canonical subject state agree; legacy null canonical subjects may be set atomically. Conflict, validation failure, or persistence failure produces no session.

The five mapped fields are read-only in MyPage. `userMobile` is independently user-managed. Production synchronization never writes mobile, fee state, grants, or consent. Development fixture convergence is a separate development-only operation.

Telemetry is restricted to allowlisted code, feature, outcome, status, and request id; it never includes PII, identifiers, payloads, queries, cookies, tokens, credentials, or encrypted envelopes.
