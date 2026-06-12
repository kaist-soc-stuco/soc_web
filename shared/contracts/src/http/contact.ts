import type { z } from "zod";
import type { CreateContactSchema, UpdateContactSchema } from "../schemas.js";

export interface ContactRecord {
  id: string;
  nameKo: string;
  nameEn: string | null;
  roleKo: string;
  roleEn: string | null;
  email: string | null;
  phoneNumber: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateContactRequest = z.infer<typeof CreateContactSchema>;

export type UpdateContactRequest = z.infer<typeof UpdateContactSchema>;

export interface ContactListResponse {
  items: ContactRecord[];
}
