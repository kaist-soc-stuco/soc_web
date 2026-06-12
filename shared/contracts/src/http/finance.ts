/**
 * Finance / Fee Management HTTP Contracts
 */

import type { z } from "zod";
import type { UpdateStudentFeeStatusSchema } from "../schemas.js";

export type FeeStatus = "PAID" | "UNPAID";

export interface StudentFeeStatusRecord {
  userId: string;
  status: FeeStatus;
  coverageSemesters: number;
  paidAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  note: string | null;
  updatedAt: string;
}

export type UpdateStudentFeeStatusRequest = z.infer<
  typeof UpdateStudentFeeStatusSchema
>;

export interface StudentFeeListResponse {
  students: Array<{
    userId: string;
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
