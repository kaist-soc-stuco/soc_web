import type { z } from "zod";
import type {
  AssignRoleGroupMemberSchema,
  CreateRoleGroupSchema,
  ReplaceRoleGroupMembersSchema,
  RoleGroupMemberFilterSchema,
  UpdateRoleGroupSchema,
} from "../schemas.js";

export interface PermissionRecord {
  permissionId: number;
  code: string;
  bitValue: number;
  nameKo: string;
  nameEn: string | null;
  description: string | null;
  isActive: boolean;
}

export interface AdminUserRecord {
  userId: string;
  kaistUid: string;
  stdNo: string | null;
  nameKo: string;
  nameEn: string | null;
  email: string;
  primaryMajor?: string | null;
  doubleMajor?: string | null;
  minor?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
  privacyConsentAt?: string | null;
  feeStatus?: "PAID" | "PARTIAL" | "UNPAID";
  academicStatus: string | null;
  identityCode: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListResponse {
  items: AdminUserRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RoleGroupMemberRecord {
  userRoleGroupId: number;
  roleGroupId: number;
  userId: string;
  kaistUid: string;
  stdNo: string | null;
  nameKo: string;
  nameEn: string | null;
  email: string;
  primaryMajor?: string | null;
  doubleMajor?: string | null;
  minor?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
  academicStatus: string | null;
  identityCode: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  grantedAt: string;
  grantedBy: string | null;
  validFrom: string | null;
  validTo: string | null;
  membershipActive: boolean;
}

export interface RoleGroupCandidateRecord extends AdminUserRecord {
  isMember: boolean;
}

export interface RoleGroupCandidateListResponse {
  items: RoleGroupCandidateRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export interface RoleGroupRecord {
  roleGroupId: number;
  nameKo: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  permissionIds: number[];
  permissionMask: number;
}

export type CreateRoleGroupRequest = z.infer<typeof CreateRoleGroupSchema>;

export type UpdateRoleGroupRequest = z.infer<typeof UpdateRoleGroupSchema>;

export type AssignRoleGroupMemberRequest = z.infer<
  typeof AssignRoleGroupMemberSchema
>;

export type RoleGroupMemberFilterRequest = z.infer<
  typeof RoleGroupMemberFilterSchema
>;

export type ReplaceRoleGroupMembersRequest = z.infer<
  typeof ReplaceRoleGroupMembersSchema
>;
