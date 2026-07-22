# Remaining Work

> **2026-07-15 감사 주의:** 이 문서는 이전 안정화 pass의 작업 기록입니다. 일부 “Done” 및 범위 제외 항목이 현재 코드와 맞지 않습니다. 최신 우선순위와 완료 기준은 `docs/PROJECT_AUDIT_2026-07-15.md`, `docs/DESIGN_AUDIT_2026-07-15.md`, `docs/GATE0_IMPLEMENTATION_2026-07-15.md`를 기준으로 하며, 이 문서는 후속 작업에서 항목별로 다시 대조해야 합니다.

This document tracks the remaining work for making the student council site deployable while preserving the current UI direction.

## Done In Current Stabilization Pass

- Rebuilt the board detail page around the provided reference image.
- Rebuilt the board detail page from the reference analysis into a left-aligned school-notice layout with a white article panel, compact comments, and a bottom same-board list without notice badges.
- Rebuilt the my page around the provided reference image.
- Rebuilt the permission management page around the provided reference image.
- Connected board comments to create, update, and delete API client calls.
- Added local server-folder asset upload for board images and attachments.
- Added a conservative upload size and MIME allowlist policy.
- Added a real Nest HTTP multipart boundary contract: exactly 20 MiB is accepted and larger files are rejected with 413 before storage.
- Added explicit survey `DRAFT`/`PUBLISHED`/`ARCHIVED` lifecycle, terminal archive behavior, and branch-aware copy ancestry.
- Added a SHA-pinned GitHub Actions quality workflow with fresh migrations and always-on real-DB fee/survey coverage.
- Added session refresh retry coverage to key authenticated API client calls.
- Aligned Docker compose upload volume, internal database port, and nginx upload proxy settings.
- Added production Dockerfiles for API and Web without replacing the local development Dockerfiles.
- Hardened temporary session refresh/logout and permission member removal confirmation.
- Aligned board detail edit/delete/comment controls with board-specific backend permission bits.
- Polished my page empty states, required SSO profile display, and section-level expand/collapse for loaded activity data.
- Simplified permission management errors and made permission labels operation-oriented for student council admins.
- Split the API client internals into auth, board, survey, admin, misc, and shared core modules while preserving `createApiClient()`.
- Extracted a small shared empty-state UI primitive for repeated page data states.
- Extracted a shared pagination UI primitive and reused it across board, survey list, survey response list, and fee management pages.
- Extracted a shared survey status badge for survey management and response management screens.
- Centralized frontend fallback board labels, descriptions, titles, and write permission bits for board list/detail pages.
- Rewrote the README with clean onboarding, environment variable, local development, Docker development, production compose, and command guidance.
- Added write access from the board "전체" tab and filtered the write page category selector by the current user's board permissions.
- Added event date and compact description fields to seeded "행사" category articles.
- Simplified environment variables by removing duplicate SSO frontend vars, Redis host/port vars, and required `DATABASE_URL`.
- Added current architecture and security/permission review documents.
- Hardened frontend guards so admin shell, contact management, bulk email, header admin entry, and board write/edit routes use persisted-session and operation-permission checks consistently.
- Added a conservative admin-only orphan asset cleanup endpoint and safer static upload response headers.
- Automated upload orphan cleanup inside the API server with a 24h default grace window and documented the manual runbook fallback.
- Switched board navigation, board page tabs, board detail tabs, and write-page category permissions to server-provided board metadata with local fallback.
- Added a server-side all-board article list endpoint and switched the board "전체" tab to server pagination/search/sort.
- Added my page list metadata and a unified activity endpoint so activity, posts, comments, and survey responses can paginate from the server.
- Extracted the board detail attachment list into a small shared UI primitive.
- Added a shared confirm dialog hook and replaced browser confirm calls across board, survey, permission, contact, bulk email, and draft deletion flows.
- Extracted the board detail comment UI into a shared comment section component.

## Removed From Scope

- Header search.
- Header notifications.
- Operating environment checklist for this stabilization pass.

## P0: Deployment Blockers

1. Upload operation policy
   - Current implementation stores files in a local Docker volume.
   - File size and MIME allowlist are now enforced in the API.
   - Unlinked uploaded assets are automatically checked every `ASSET_ORPHAN_CLEANUP_INTERVAL_HOURS` and deleted only after `ASSET_ORPHAN_GRACE_HOURS`.
   - Admin-only `POST /v1/assets/cleanup-orphans` remains available as a manual runbook fallback.
   - Decision: do not add admin UI unless upload volume grows enough to justify it.

## P1: Feature Completion

1. Board detail data completeness
   - Connected survey, previous/next article, attachments, article delete, and permission-based comment controls are wired.
   - Remaining: only address bugs found during real use.

2. My page data completeness
   - Empty states, loaded-data expand/collapse, and required SSO profile field display are polished.
   - Activity, survey response, written article, and written comment lists now return real pagination metadata.
   - Remaining: only address bugs found during real use.

3. Permission management operations
   - Role group delete and member removal now ask for confirmation before destructive changes.
   - Login expiry, permission denial, and general save/load failures now have clear lightweight messages.
   - Permission choices now prioritize natural Korean operation labels over raw permission codes.
   - Remaining: only address bugs found during real use.

## P2: Maintainability

1. Split the API client internally
   - Done: `shared/api-client/src/index.ts` now composes smaller internal modules while keeping `createApiClient()` as the single public entry.
   - Remaining: none unless future API surface grows large again.

2. Extract shared UI primitives
   - Done: repeated empty-state, pagination, and survey status badge UI are now shared primitives.
   - Done: board detail attachment list now uses a shared attachment list primitive.
   - Done: destructive and high-impact confirmation flows now use the shared confirm dialog hook instead of browser `confirm()`.
   - Done: board detail comments now use a shared comment section component.
   - Remaining: none unless future pages reuse the same comments/attachments/confirm patterns.
   - Do not enforce atomic design categories as a folder rule.

3. Centralize board metadata
   - Done: frontend fallback board labels, descriptions, titles, and write permission bits live in `apps/web/src/lib/board-metadata.ts`.
   - Done: board navigation, board page tabs, board detail tabs, and write-page category permissions now use `GET /boards` first and fallback metadata only when the API is unavailable.
   - Done: board list "전체" tab now uses server-side all-board pagination/search/sort instead of fetching every board separately.

4. Restore onboarding docs
   - Done: README now covers environment variables, local development, Docker development, production compose, and common commands.
   - Remaining: none unless deployment commands change.
