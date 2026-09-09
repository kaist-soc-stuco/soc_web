import type { LoginSessionResponse } from "@soc/contracts";
import { nowMs } from "@soc/shared";

type DraftSession = Pick<
  LoginSessionResponse,
  "authenticated" | "storageMode" | "draftNamespace"
>;

const TRANSIENT_DRAFT_SESSION_KEY = "soc:draft:transient-session";

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
