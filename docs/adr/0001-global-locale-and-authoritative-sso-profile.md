# Global locale and authoritative SSO profile

## Decision

The browser owns one persisted `ko | en` locale used by first-party UI, localized reads, date formatting, and document metadata. Locale-bound requests are aborted and fenced by a generation so an older response cannot publish after a switch.

PassNi owns `kaistUid`, `studentOrEmployeeNumber`, `nameKr`, `nameEn`, and `userEmail`. Every successful production login validates and encrypts these fields, then synchronizes them before issuing a session. Users may change only `userMobile`.

Existing-user synchronization is one conditional update constrained by the expected row id, matching compatibility `sso_user_id`, and a canonical subject that is null or equal. A null subject is canonicalized in that statement. A zero-row update is an identity conflict and no session is issued.

## Security consequences

Profile PII is encrypted at rest and in pending-login storage. Logs, errors, events, URLs, and browser storage must not contain plaintext PII, ciphertext envelopes, provider payloads, authority identifiers, credentials, cookies, tokens, or search values. Failures expose stable allowlisted codes only.
