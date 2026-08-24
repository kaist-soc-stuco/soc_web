import type { z } from "zod";
import type {
  BulkImportContactsSchema,
  CreateContactSchema,
  ReorderContactsSchema,
  UpdateContactSchema,
} from "../schemas.js";

export interface ContactRecord {
  id: string;
  nameKo: string;
  nameEn: string;
  departmentKo: string | null;
  departmentEn: string | null;
  roleKo: string;
  roleEn: string;
  avatarStorageKey: string | null;
  gender: string | null;
  cohort: number | null;
  email: string | null;
  phoneNumber: string | null;
  privacyConsented: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactRequest = z.infer<typeof CreateContactSchema>;

export type ReorderContactsRequest = z.infer<typeof ReorderContactsSchema>;

export type UpdateContactRequest = z.infer<typeof UpdateContactSchema>;

export type BulkImportContactsRequest = z.infer<
  typeof BulkImportContactsSchema
>;

export interface ContactListResponse {
  items: ContactRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ContactListOptions {
  q?: string;
  gender?: string;
  cohort?: number;
  department?: string;
  privacyConsented?: boolean;
  page?: number;
  pageSize?: number;
}

export interface BulkImportContactsResponse {
  importedCount: number;
  removedCount: number;
  items: ContactRecord[];
}
