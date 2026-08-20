import type { z } from "zod";
import type {
  BulkImportContactsSchema,
  CreateContactSchema,
  UpdateContactSchema,
} from "../schemas.js";

export interface ContactRecord {
  id: string;
  nameKo: string;
  nameEn: string;
  roleKo: string;
  roleEn: string;
  email: string | null;
  phoneNumber: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactRequest = z.infer<typeof CreateContactSchema>;

export type UpdateContactRequest = z.infer<typeof UpdateContactSchema>;

export type BulkImportContactsRequest = z.infer<
  typeof BulkImportContactsSchema
>;

export interface ContactListResponse {
  items: ContactRecord[];
}

export interface BulkImportContactsResponse {
  importedCount: number;
  removedCount: number;
  items: ContactRecord[];
}
