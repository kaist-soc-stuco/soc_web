import type {
  AdminUserRecord,
  AdminUserListResponse,
  AssignRoleGroupMemberRequest,
  AuditLogListResponse,
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  BulkEmailListResponse,
  BulkEmailTemplateListResponse,
  ContactListResponse,
  ContactRecord,
  CreateContactRequest,
  CreateRoleGroupRequest,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MySurveyResponseListResponse,
  PermissionRecord,
  RoleGroupMemberRecord,
  RoleGroupRecord,
  SendBulkEmailRequest,
  SendBulkEmailResponse,
  StudentFeeListResponse,
  StudentFeeStatusRecord,
  UpdateContactRequest,
  UpdateRoleGroupRequest,
  UpdateStudentFeeStatusRequest,
} from "@soc/contracts";

import {
  buildListQuery,
  type ApiClientContext,
  type ListQueryOptions,
} from "./core.js";

export const createAdminApi = ({
  auditLogsBaseUrl,
  contactsBaseUrl,
  emailsBaseUrl,
  requestJson,
  requestVoid,
  roleGroupsBaseUrl,
  usersBaseUrl,
}: ApiClientContext) => ({
  getMyArticles: async (
    options?: ListQueryOptions,
  ): Promise<MyArticleListResponse> => {
    return requestJson<MyArticleListResponse>(
      `${usersBaseUrl}/me/articles${buildListQuery(options)}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getMyComments: async (
    options?: ListQueryOptions,
  ): Promise<MyCommentListResponse> => {
    return requestJson<MyCommentListResponse>(
      `${usersBaseUrl}/me/comments${buildListQuery(options)}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getMySurveyResponses: async (
    options?: ListQueryOptions,
  ): Promise<MySurveyResponseListResponse> => {
    return requestJson<MySurveyResponseListResponse>(
      `${usersBaseUrl}/me/survey-responses${buildListQuery(options)}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getMyActivities: async (
    options?: ListQueryOptions,
  ): Promise<MyActivityListResponse> => {
    return requestJson<MyActivityListResponse>(
      `${usersBaseUrl}/me/activity${buildListQuery(options)}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  listPermissions: async (): Promise<PermissionRecord[]> => {
    return requestJson<PermissionRecord[]>(
      `${roleGroupsBaseUrl}/permissions`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  listRoleGroups: async (): Promise<RoleGroupRecord[]> => {
    return requestJson<RoleGroupRecord[]>(
      `${roleGroupsBaseUrl}`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  listRoleGroupMembers: async (
    roleGroupId: number,
  ): Promise<RoleGroupMemberRecord[]> => {
    return requestJson<RoleGroupMemberRecord[]>(
      `${roleGroupsBaseUrl}/${roleGroupId}/users`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  addRoleGroupMember: async (
    roleGroupId: number,
    body: AssignRoleGroupMemberRequest,
  ): Promise<RoleGroupMemberRecord> => {
    return requestJson<RoleGroupMemberRecord>(
      `${roleGroupsBaseUrl}/${roleGroupId}/users`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  removeRoleGroupMember: async (
    roleGroupId: number,
    userId: string,
  ): Promise<void> => {
    await requestVoid(
      `${roleGroupsBaseUrl}/${roleGroupId}/users/${userId}`,
      {
        method: "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  createRoleGroup: async (
    body: CreateRoleGroupRequest,
  ): Promise<RoleGroupRecord> => {
    return requestJson<RoleGroupRecord>(
      `${roleGroupsBaseUrl}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateRoleGroup: async (
    roleGroupId: number,
    body: UpdateRoleGroupRequest,
  ): Promise<RoleGroupRecord> => {
    return requestJson<RoleGroupRecord>(
      `${roleGroupsBaseUrl}/${roleGroupId}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteRoleGroup: async (roleGroupId: number): Promise<void> => {
    await requestVoid(
      `${roleGroupsBaseUrl}/${roleGroupId}`,
      {
        method: "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  searchUsers: async (
    query?: string,
    limit = 20,
  ): Promise<AdminUserRecord[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) {
      params.set("q", query.trim());
    }
    params.set("limit", String(limit));

    return requestJson<AdminUserRecord[]>(
      `${usersBaseUrl}${params.toString() ? `?${params.toString()}` : ""}`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  listAdminUsers: async (options?: {
    page?: number;
    pageSize?: number;
    q?: string;
    sortBy?: "name" | "studentId" | "status" | "lastLoginAt" | "createdAt";
    sortDirection?: "asc" | "desc";
    status?: "active" | "inactive";
  }): Promise<AdminUserListResponse> => {
    const params = new URLSearchParams();
    if (options?.q?.trim()) {
      params.set("q", options.q.trim());
    }
    if (options?.page !== undefined) {
      params.set("page", String(options.page));
    }
    if (options?.pageSize !== undefined) {
      params.set("pageSize", String(options.pageSize));
    }
    if (options?.sortBy !== undefined) {
      params.set("sortBy", options.sortBy);
    }
    if (options?.sortDirection !== undefined) {
      params.set("sortDirection", options.sortDirection);
    }
    if (options?.status !== undefined) {
      params.set("status", options.status);
    }

    return requestJson<AdminUserListResponse>(
      `${usersBaseUrl}/admin/list${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  listAuditLogs: async (options?: {
    action?: string;
    page?: number;
    pageSize?: number;
    q?: string;
    sortBy?: "createdAt" | "actor" | "action";
    sortDirection?: "asc" | "desc";
    targetType?: string;
  }): Promise<AuditLogListResponse> => {
    const params = new URLSearchParams();
    if (options?.action?.trim()) {
      params.set("action", options.action.trim());
    }
    if (options?.q?.trim()) {
      params.set("q", options.q.trim());
    }
    if (options?.targetType?.trim()) {
      params.set("targetType", options.targetType.trim());
    }
    if (options?.page !== undefined) {
      params.set("page", String(options.page));
    }
    if (options?.pageSize !== undefined) {
      params.set("pageSize", String(options.pageSize));
    }
    if (options?.sortBy !== undefined) {
      params.set("sortBy", options.sortBy);
    }
    if (options?.sortDirection !== undefined) {
      params.set("sortDirection", options.sortDirection);
    }

    return requestJson<AuditLogListResponse>(
      `${auditLogsBaseUrl}${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getStudentFeeStatus: async (
    userId: string,
  ): Promise<StudentFeeStatusRecord> => {
    return requestJson<StudentFeeStatusRecord>(
      `${usersBaseUrl}/${userId}/fee-status`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateStudentFeeStatus: async (
    userId: string,
    body: UpdateStudentFeeStatusRequest,
  ): Promise<StudentFeeStatusRecord> => {
    return requestJson<StudentFeeStatusRecord>(
      `${usersBaseUrl}/${userId}/fee-status`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      { retryOnUnauthorized: true },
    );
  },

  listStudentsByFeeStatus: async (
    status?: string,
    page = 1,
    pageSize = 20,
    sortBy: "name" | "studentId" | "status" | "paidAt" = "name",
    sortDirection: "asc" | "desc" = "asc",
  ): Promise<StudentFeeListResponse> => {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortDirection", sortDirection);

    return requestJson<StudentFeeListResponse>(
      `${usersBaseUrl}/fee-status/list?${params.toString()}`,
      {
        method: "GET",
      },
      { retryOnUnauthorized: true },
    );
  },

  getContacts: async (): Promise<ContactListResponse> => {
    return requestJson<ContactListResponse>(
      contactsBaseUrl,
      { method: "GET" },
    );
  },

  createContact: async (
    body: CreateContactRequest,
  ): Promise<ContactRecord> => {
    return requestJson<ContactRecord>(
      contactsBaseUrl,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  bulkImportContacts: async (
    body: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> => {
    return requestJson<BulkImportContactsResponse>(
      `${contactsBaseUrl}/bulk`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateContact: async (
    id: string,
    body: UpdateContactRequest,
  ): Promise<ContactRecord> => {
    return requestJson<ContactRecord>(
      `${contactsBaseUrl}/${id}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteContact: async (id: string): Promise<{ success: boolean }> => {
    return requestJson<{ success: boolean }>(
      `${contactsBaseUrl}/${id}`,
      {
        method: "DELETE",
      },
      { retryOnUnauthorized: true },
    );
  },

  sendBulkEmail: async (
    body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailResponse> => {
    return requestJson<SendBulkEmailResponse>(
      `${emailsBaseUrl}/send`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  getBulkEmailHistory: async (): Promise<BulkEmailListResponse> => {
    return requestJson<BulkEmailListResponse>(
      `${emailsBaseUrl}/history`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getBulkEmailTemplates: async (): Promise<BulkEmailTemplateListResponse> => {
    return requestJson<BulkEmailTemplateListResponse>(
      `${emailsBaseUrl}/templates`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },
});
