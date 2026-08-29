import type { z } from "zod";
import type {
  BulkImportContactsSchema,
  CreateContactDepartmentSchema,
  CreateContactSchema,
  ReorderContactsSchema,
  UpdateContactDepartmentSchema,
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
  studentNumber: string | null;
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
  cohort?: number;
  department?: string;
  privacyConsented?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ContactDepartmentRecord {
  id: string;
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  descriptionEn: string;
  inquiryEmail: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactDepartmentRequest = z.infer<
  typeof CreateContactDepartmentSchema
>;

export type UpdateContactDepartmentRequest = z.infer<
  typeof UpdateContactDepartmentSchema
>;

export interface ContactDepartmentListResponse {
  items: ContactDepartmentRecord[];
}

export interface ContactSpreadsheetSyncResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedCount: number;
  syncedAt: string;
}

export interface BulkImportContactsResponse {
  importedCount: number;
  removedCount: number;
  items: ContactRecord[];
}
