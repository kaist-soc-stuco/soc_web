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

export interface CreateContactRequest {
  nameKo: string;
  nameEn?: string | null;
  roleKo: string;
  roleEn?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  sortOrder?: number;
}

export type UpdateContactRequest = Partial<CreateContactRequest>;

export interface ContactListResponse {
  items: ContactRecord[];
}
