import type {
  AdminUserRecord,
  AssignRoleGroupMemberRequest,
  BulkEmailListResponse,
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

import { buildListQuery, type ApiClientContext, type ListQueryOptions } from "./core";

export const createAdminApi = ({
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
  ): Promise<StudentFeeListResponse> => {
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

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
});
