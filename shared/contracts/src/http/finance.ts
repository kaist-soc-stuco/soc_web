/**
 * Finance / Fee Management HTTP Contracts
 */

import type { z } from "zod";
import type {
  BulkProcessStudentFeePaymentsSchema,
  BulkUpdateStudentFeeStatusSchema,
  UpdateStudentFeeStatusSchema,
} from "../schemas.js";

export type FeeStatus = "PAID" | "PARTIAL" | "UNPAID";
export type FeeMajorCategory = "PRIMARY";
export type FeePaymentType = "SIX_SEMESTER_LUMP_SUM" | "PRIOR_PAYMENT_BALANCE";
export type FeePaymentMethod = "BANK_TRANSFER" | "CASH" | "OTHER";

export interface StudentFeeStatusRecord {
  userId: string;
  status: FeeStatus;
  coverageSemesters: number;
  paidAmount: number;
  paidAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  note: string | null;
  updatedAt: string;
  requiredAmount?: number;
  coverageStartSemester?: string | null;
  paymentType?: FeePaymentType | null;
  paymentMethod?: FeePaymentMethod | null;
}

export type UpdateStudentFeeStatusRequest = z.infer<
  typeof UpdateStudentFeeStatusSchema
>;

export type BulkUpdateStudentFeeStatusRequest = z.infer<
  typeof BulkUpdateStudentFeeStatusSchema
>;

export type BulkProcessStudentFeePaymentsRequest = z.infer<
  typeof BulkProcessStudentFeePaymentsSchema
>;

export interface StudentFeePaymentRecord {
  paymentId: string;
  userId: string;
  amount: number;
  paymentType: FeePaymentType;
  paymentMethod: FeePaymentMethod;
  effectiveStartSemester: string;
  coverageSemesters: number;
  paidAt: string;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface StudentFeeDetailResponse {
  user: {
    userId: string;
    nameKo: string;
    nameEn?: string;
    stdNo?: string;
    email: string;
    primaryMajor?: string | null;
  };
  status: StudentFeeStatusRecord;
  history: StudentFeePaymentRecord[];
}

export interface BulkProcessStudentFeePaymentsResponse {
  updated: StudentFeeStatusRecord[];
  payments: StudentFeePaymentRecord[];
  count: number;
}

export interface StudentFeeListOptions {
  status?: FeeStatus;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "studentId" | "status" | "paidAt";
  sortDirection?: "asc" | "desc";
  query?: string;
  referenceSemester?: string;
  /** @deprecated Use referenceSemester. Kept for older admin clients. */
  paymentYear?: number;
  majorCategory?: FeeMajorCategory;
  userIds?: string[];
}

export interface StudentFeeSpreadsheetSyncResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedCount: number;
  syncedAt: string;
}

export interface StudentFeeListResponse {
  students: Array<{
    userId: string;
    nameKo: string;
    nameEn?: string;
    stdNo?: string;
    email: string;
    departmentKo?: string | null;
    primaryMajor?: string | null;
    status: FeeStatus;
    coverageSemesters: number;
    paidAmount: number;
    paidAt: string | null;
    verifiedAt: string | null;
    note: string | null;
    requiredAmount?: number;
    coverageStartSemester?: string | null;
    paymentType?: FeePaymentType | null;
    paymentMethod?: FeePaymentMethod | null;
    eligible?: boolean;
  }>;
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalStudents: number;
    paidStudents: number;
    partialStudents: number;
    unpaidStudents: number;
    paymentRate: number;
    paidAmount: number;
    referenceSemester?: string;
  };
}

export interface StudentFeeStatsResponse {
  totals: {
    totalStudents: number;
    paidStudents: number;
    paidStudentCount: number;
    paymentCount: number;
    partialStudents: number;
    unpaidStudents: number;
    paymentRate: number;
    paidAmount: number;
  };
  trend: Array<{
    period: string;
    paidAmount: number;
    paidStudents: number;
    paymentCount: number;
    cumulativeAmount: number;
    cumulativeStudents: number;
  }>;
  majorBreakdown: Array<{
    category: FeeMajorCategory;
    label: string;
    totalStudents: number;
    paidStudents: number;
    partialStudents: number;
    unpaidStudents: number;
    paymentRate: number;
    paidAmount: number;
  }>;
}

export type StudentFeeStatsBucket = "day" | "week" | "month";

export interface StudentFeeStatsOptions {
  dateFrom?: string;
  dateTo?: string;
  bucket?: StudentFeeStatsBucket;
  referenceSemester?: string;
}

export interface BulkUpdateStudentFeeStatusResponse {
  updated: StudentFeeStatusRecord[];
  count: number;
}
