/**
 * Finance / Fee Management HTTP Contracts
 */

export type FeeStatus = "PAID" | "UNPAID" | "WAIVED";

export interface StudentFeeStatusRecord {
  userId: number;
  status: FeeStatus;
  coverageSemesters: number;
  paidAt: string | null;
  verifiedBy: number | null;
  verifiedAt: string | null;
  note: string | null;
  updatedAt: string;
}

export interface UpdateStudentFeeStatusRequest {
  status: FeeStatus;
  coverageSemesters?: number;
  note?: string | null;
}

export interface StudentFeeListResponse {
  students: Array<{
    userId: number;
    nameKo: string;
    nameEn?: string;
    stdNo?: string;
    email: string;
    status: FeeStatus;
    paidAt: string | null;
    verifiedAt: string | null;
    note: string | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
