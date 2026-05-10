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
  userId: number;
  kaistUid: string;
  stdNo: string | null;
  nameKo: string;
  nameEn: string | null;
  email: string;
  departmentKo: string | null;
  departmentEn: string | null;
  academicStatus: string | null;
  identityCode: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleGroupMemberRecord {
  userRoleGroupId: number;
  roleGroupId: number;
  userId: number;
  kaistUid: string;
  stdNo: string | null;
  nameKo: string;
  nameEn: string | null;
  email: string;
  departmentKo: string | null;
  departmentEn: string | null;
  academicStatus: string | null;
  identityCode: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  grantedAt: string;
  grantedBy: number | null;
  validFrom: string | null;
  validTo: string | null;
  membershipActive: boolean;
}

export interface RoleGroupRecord {
  roleGroupId: number;
  code: string;
  nameKo: string;
  nameEn: string | null;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  permissionIds: number[];
  permissionMask: number;
}

export interface CreateRoleGroupRequest {
  code: string;
  nameKo: string;
  nameEn?: string;
  description?: string;
  permissionIds: number[];
}

export interface UpdateRoleGroupRequest {
  code: string;
  nameKo: string;
  nameEn?: string;
  description?: string;
  permissionIds: number[];
}

export interface AssignRoleGroupMemberRequest {
  userId: number;
}