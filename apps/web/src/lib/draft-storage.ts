import type { LoginSessionResponse } from "@soc/contracts";
import { nowMs } from "@soc/shared";

type DraftSession = Pick<
  LoginSessionResponse,
  "authenticated" | "storageMode" | "draftNamespace"
>;

const TRANSIENT_DRAFT_SESSION_KEY = "soc:draft:transient-session";
export const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "key" | "length">;

function draftExpired(raw: string, now: number): boolean {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return true;
    const draft = value as { updatedAt?: unknown; savedAt?: unknown };
    const modifiedAt = typeof draft.updatedAt === "number"
      ? draft.updatedAt
      : typeof draft.savedAt === "string" ? Date.parse(draft.savedAt) : Number.NaN;
    return !Number.isFinite(modifiedAt) || modifiedAt > now + 60_000 || now - modifiedAt >= DRAFT_RETENTION_MS;
  } catch {
    return true;
  }
}

/** Expired drafts are never restored, including drafts from previous sessions. */
export function readDraftStorage(key: string | null, now = nowMs()): string | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(key);
    if (!raw || !draftExpired(raw, now)) return raw;
    if (storage.getItem(key) === raw) storage.removeItem(key);
  } catch {
    // Browser storage can be disabled; drafting must remain usable.
  }
  return null;
}

export function purgeExpiredDrafts(storage?: DraftStorage, now = nowMs()): number {
  if (!storage && typeof window === "undefined") return 0;
  let removed = 0;
  try {
    const target = storage ?? window.localStorage;
    const keys = Array.from({ length: target.length }, (_, i) => target.key(i));
    for (const key of keys) {
      if (!key?.startsWith("soc:draft:")) continue;
      const raw = target.getItem(key);
      if (raw && draftExpired(raw, now) && target.getItem(key) === raw) {
        target.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    // Quota and privacy settings can prevent local-storage access.
  }
  return removed;
}

const encodeDraftPart = (value: string): string => encodeURIComponent(value);

const getTransientDraftSessionId = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.sessionStorage.getItem(TRANSIENT_DRAFT_SESSION_KEY);
    if (existing) return existing;

    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${nowMs().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(TRANSIENT_DRAFT_SESSION_KEY, generated);
    return generated;
  } catch {
    return null;
  }
};

/**
 * Drafts are intentionally scoped to an opaque authenticated-session namespace
 * or to this tab's transient session. User ids, personal data, and token
 * values are never used as local-storage keys. A missing namespace means the
 * auth query is still transitioning, so callers must not restore or persist a
 * draft yet.
 */
export const getDraftStorageKey = (
  kind: string,
  documentId: string,
  session: DraftSession | null | undefined,
): string | null => {
  if (!session) return null;

  if (session.authenticated && session.storageMode && !session.draftNamespace) {
    return null;
  }

  const owner = session.authenticated && session.draftNamespace
    ? `session:${encodeDraftPart(session.draftNamespace)}`
    : (() => {
        const transientId = getTransientDraftSessionId();
        return transientId ? `tab:${encodeDraftPart(transientId)}` : null;
      })();

  return owner
    ? `soc:draft:${encodeDraftPart(kind)}:${encodeDraftPart(documentId)}:${owner}`
    : null;
};
