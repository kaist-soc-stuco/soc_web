export interface PermissionRecord {
  permissionId: number;
  code: string;
  bitValue: number;
  nameKo: string;
  nameEn: string | null;
  description: string | null;
  isActive: boolean;
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