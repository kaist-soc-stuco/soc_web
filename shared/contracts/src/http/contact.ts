export const CONTACTS_MANAGE_SCOPE = "CONTACTS_MANAGE" as const;
export const DEFAULT_CONTACT_PAGE_LIMIT = 20 as const;
export type ContactListLimit =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
  | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
  | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50;
export type ContactCursor = string;

export type ContactFieldName =
  | "name"
  | "email"
  | "phone"
  | "affiliation"
  | "note"
  | "kaistUid"
  | "year"
  | "role";

export interface ContactValues {
  name: string;
  email: string | null;
  phone: string | null;
  affiliation: string | null;
  note: string | null;
  kaistUid: string | null;
  year: string | null;
  role: string | null;
}

export interface ContactLifecycleDto {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  retentionDeadlineAt: string;
  holdUntil: string | null;
}

export interface MaskedContactDto extends ContactLifecycleDto {
  id: string;
  projection: "MASKED";
  name: string;
  email: string | null;
  phone: string | null;
  affiliation: string | null;
  note: null;
  kaistUid: string | null;
  year: string | null;
  role: string | null;
}

export interface FullContactDto extends ContactLifecycleDto, ContactValues {
  id: string;
  projection: "FULL";
}

export type ContactDto = MaskedContactDto | FullContactDto;

export interface AdminContactListQuery {
  cursor?: ContactCursor;
  limit?: ContactListLimit;
  projection?: "MASKED" | "FULL";
  includeDeleted?: boolean;
}

export interface AdminContactListResponse {
  items: ContactDto[];
  nextCursor: string | null;
}
export type ListContactsResult =
  | { ok: true; status: 200; page: AdminContactListResponse }
  | ContactOperationError;

export interface CreateContactRequest extends ContactValues {
  retentionDeadlineAt?: string;
  holdUntil?: string | null;
}

export type PatchContactRequest = {
  [Field in ContactFieldName]?: ContactValues[Field];
} & {
  retentionDeadlineAt?: string;
  holdUntil?: string | null;
};

export interface DeleteContactRequest {
  reasonCode: string;
}

export type ContactOperationError =
  | { ok: false; code: "forbidden"; status: 403 }
  | { ok: false; code: "not_found"; status: 404 }
  | { ok: false; code: "conflict"; status: 409 }
  | { ok: false; code: "validation_failed"; status: 422 };

export type CreateContactResult =
  | { ok: true; status: 201; contact: FullContactDto }
  | ContactOperationError;
export type PatchContactResult =
  | { ok: true; status: 200; contact: FullContactDto }
  | ContactOperationError;
export type DeleteContactResult =
  | { ok: true; status: 204 }
  | ContactOperationError;

export type FeatureDisabledResult = {
  ok: false;
  code: "feature_disabled";
  status: 503;
};

export interface MailPreviewRequest {
  contactIds: string[];
  subject: string;
  body: string;
}

export interface MailCreateRequest extends MailPreviewRequest {}
export interface MailGetRequest { id: string; }
export interface MailCancelRequest { reasonCode?: string; }

export type MailPreviewResult = FeatureDisabledResult | { ok: true; recipients: number; subject: string; body: string };
export type MailCreateResult = FeatureDisabledResult | { ok: true; id: string; status: "SENT" };
export type MailGetResult = FeatureDisabledResult;
export type MailCancelResult = FeatureDisabledResult;

export type ChatPageResponse =
  | { kind: "EXTERNAL_LINK_NOTICE"; externalUrl: string; notice: string }
  | { kind: "INTERNAL_CHAT"; notice: string };

export interface ChatMessageRequest {
  body: string;
}

export type ChatMessageResult = FeatureDisabledResult | { ok: true; reply: string };
