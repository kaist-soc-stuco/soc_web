export const RELEASE_MANIFEST_VERSION = "phase-0a" as const;
export const RELEASE_MANIFEST_TOTAL_OPERATIONS = 75 as const;

export type ReleaseSlice =
  | "auth_health"
  | "identity_permission_fee_audit"
  | "faq_events"
  | "boards"
  | "assets"
  | "survey_matcher"
  | "contacts"
  | "mail"
  | "chat";

export interface ReleaseManifestRow {
  readonly operation: number;
  readonly id: string;
  readonly slice: ReleaseSlice;
}

const rows = <TSlice extends ReleaseSlice, const TIds extends readonly string[]>(slice: TSlice, firstOperation: number, ids: TIds) =>
  ids.map((id, index) => ({ operation: firstOperation + index, id, slice })) as readonly {
    readonly operation: number;
    readonly id: TIds[number];
    readonly slice: TSlice;
  }[];

export const RELEASE_MANIFEST = [
  ...rows("auth_health", 1, ["AUTH-START", "AUTH-CALLBACK", "AUTH-CONSENT", "AUTH-SESSION", "AUTH-REFRESH", "AUTH-LOGOUT"]),
  ...rows("identity_permission_fee_audit", 7, ["USER-ME", "USER-PATCH-ME", "USER-ADMIN-LIST", "USER-ADMIN-GET", "GRANT-REQUEST", "GRANT-APPROVE", "GRANT-ACTIVATE", "FEE-SELF", "FEE-ADMIN"]),
  ...rows("faq_events", 16, ["FAQ-LIST", "FAQ-TOPIC-CREATE", "FAQ-TOPIC-PATCH", "FAQ-TOPIC-DELETE", "FAQ-CREATE", "FAQ-PATCH", "FAQ-DELETE", "FAQ-REORDER", "FAQ-ADMIN-LIST", "EVENT-LIST", "EVENT-GET", "EVENT-CREATE", "EVENT-PATCH", "EVENT-DELETE"]),
  ...rows("boards", 30, ["BOARD-LIST", "BOARD-GET", "BOARD-CREATE", "BOARD-PATCH", "BOARD-DELETE", "ARTICLE-LIST", "ARTICLE-GET", "ARTICLE-CREATE", "ARTICLE-PATCH", "ARTICLE-PUBLISH", "ARTICLE-SOFT-DELETE", "COMMENT-CREATE", "COMMENT-PATCH", "COMMENT-DELETE", "REACTION-PUT", "REACTION-DELETE"]),
  ...rows("assets", 46, ["ASSET-INITIATE", "ASSET-COMPLETE", "ASSET-DELETE"]),
  ...rows("survey_matcher", 49, ["SURVEY-LIST", "SURVEY-GET", "SURVEY-CREATE", "SURVEY-PATCH", "SURVEY-PUBLISH", "SURVEY-SECTION", "SURVEY-QUESTION", "SURVEY-SUBMIT", "SURVEY-MY", "SURVEY-REVIEW", "SURVEY-AGGREGATE", "SURVEY-EXPORT", "MATCHER-CREATE", "MATCHER-DELETE"]),
  ...rows("contacts", 63, ["CONTACT-LIST", "CONTACT-CREATE", "CONTACT-PATCH", "CONTACT-DELETE"]),
  ...rows("mail", 67, ["MAIL-PREVIEW", "MAIL-CREATE", "MAIL-GET", "MAIL-CANCEL"]),
  ...rows("chat", 71, ["CHAT-PAGE", "CHAT-MESSAGE"]),
  ...rows("auth_health", 73, ["HEALTH-LIVE", "HEALTH-READY"]),
  ...rows("identity_permission_fee_audit", 75, ["AUDIT-LIST"]),
] as const satisfies readonly ReleaseManifestRow[];

export type ReleaseOperationId = (typeof RELEASE_MANIFEST)[number]["id"];

export const RELEASE_MANIFEST_SLICE_COUNTS: Readonly<Record<ReleaseSlice, number>> = {
  auth_health: 8,
  identity_permission_fee_audit: 10,
  faq_events: 14,
  boards: 16,
  assets: 3,
  survey_matcher: 14,
  contacts: 4,
  mail: 4,
  chat: 2,
};

export function assertReleaseManifest(
  manifest: readonly ReleaseManifestRow[] = RELEASE_MANIFEST,
  expectedSliceCounts: Readonly<Record<ReleaseSlice, number>> = RELEASE_MANIFEST_SLICE_COUNTS,
): void {
  if (manifest.length !== RELEASE_MANIFEST_TOTAL_OPERATIONS) {
    throw new Error(`Release manifest must contain ${RELEASE_MANIFEST_TOTAL_OPERATIONS} operations; received ${manifest.length}.`);
  }

  const ids = new Set<string>();
  const operations = new Set<number>();
  const actualSliceCounts: Record<ReleaseSlice, number> = {
    auth_health: 0,
    identity_permission_fee_audit: 0,
    faq_events: 0,
    boards: 0,
    assets: 0,
    survey_matcher: 0,
    contacts: 0,
    mail: 0,
    chat: 0,
  };

  for (const row of manifest) {
    if (ids.has(row.id)) {
      throw new Error(`Release manifest operation ID is duplicated: ${row.id}.`);
    }
    ids.add(row.id);
    if (operations.has(row.operation)) {
      throw new Error(`Release manifest operation number is duplicated: ${row.operation}.`);
    }
    if (row.operation < 1 || row.operation > RELEASE_MANIFEST_TOTAL_OPERATIONS) {
      throw new Error(`Release manifest operation number is out of range: ${row.operation}.`);
    }
    operations.add(row.operation);
    if (!(row.slice in actualSliceCounts)) {
      throw new Error(`Release manifest has an unknown slice: ${row.slice}.`);
    }
    actualSliceCounts[row.slice] += 1;
  }

  for (const slice of Object.keys(expectedSliceCounts) as ReleaseSlice[]) {
    if (actualSliceCounts[slice] !== expectedSliceCounts[slice]) {
      throw new Error(`Release manifest slice ${slice} must contain ${expectedSliceCounts[slice]} operations; received ${actualSliceCounts[slice]}.`);
    }
  }
  if (operations.size !== RELEASE_MANIFEST_TOTAL_OPERATIONS) {
    throw new Error(`Release manifest must cover operation numbers 1 through ${RELEASE_MANIFEST_TOTAL_OPERATIONS}.`);
  }
}

assertReleaseManifest();
