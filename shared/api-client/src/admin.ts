import type {
  AdminUserRecord,
  BulkProcessStudentFeePaymentsRequest,
  BulkProcessStudentFeePaymentsResponse,
  AdminUserListResponse,
  AssignRoleGroupMemberRequest,
  AuditLogListResponse,
  BulkUpdateStudentFeeStatusRequest,
  BulkUpdateStudentFeeStatusResponse,
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  BulkEmailListResponse,
  BulkEmailDraftListResponse,
  BulkEmailPreviewResponse,
  BulkEmailRecord,
  BulkEmailTemplateListResponse,
  BulkEmailTemplate,
  CreateBulkEmailTemplateRequest,
  UpdateBulkEmailTemplateRequest,
  ContactListResponse,
  ContactListOptions,
  ContactRecord,
  ContactDepartmentListResponse,
  ContactDepartmentRecord,
  ContactSpreadsheetSyncResponse,
  CreateContactDepartmentRequest,
  CreateContactRequest,
  ReorderContactsRequest,
  CreateRoleGroupRequest,
  MyActivityListResponse,
  MyArticleListResponse,
  MyCommentListResponse,
  MyScrapListResponse,
  MySurveyResponseListResponse,
  PermissionRecord,
  ReplaceRoleGroupMembersRequest,
  RoleGroupCandidateListResponse,
  RoleGroupMemberRecord,
  RoleGroupRecord,
  SendBulkEmailRequest,
  SendBulkEmailResponse,
  SendBulkEmailTestResponse,
  SaveBulkEmailDraftRequest,
  StudentFeeListResponse,
  StudentFeeListOptions,
  StudentFeeDetailResponse,
  StudentFeeStatsResponse,
  StudentFeeStatsOptions,
  StudentFeeStatusRecord,
  StudentFeeSpreadsheetSyncResponse,
  UpdateContactRequest,
  UpdateContactDepartmentRequest,
  UpdateRoleGroupRequest,
  UpdateStudentFeeStatusRequest,
  UpdateUserActiveStatusRequest,
  UpdateUserPostingSuspensionRequest,
  UserPostingSuspensionResponse,
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
  requestBlob,
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

  replaceRoleGroupMembers: async (
    roleGroupId: number,
    body: ReplaceRoleGroupMembersRequest,
  ): Promise<RoleGroupMemberRecord[]> => {
    return requestJson<RoleGroupMemberRecord[]>(
      `${roleGroupsBaseUrl}/${roleGroupId}/users`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      { retryOnUnauthorized: true },
    );
  },

  getMyScraps: async (
    options?: ListQueryOptions,
  ): Promise<MyScrapListResponse> => {
    return requestJson<MyScrapListResponse>(
      `${usersBaseUrl}/me/scraps${buildListQuery(options)}`,
      { method: "GET" },
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
    majorType?: "PRIMARY";
    feeStatus?: "PAID" | "PARTIAL" | "UNPAID";
    academicStatus?: string;
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
    if (options?.majorType !== undefined) {
      params.set("majorType", options.majorType);
    }
    if (options?.feeStatus !== undefined) {
      params.set("feeStatus", options.feeStatus);
    }
    if (options?.academicStatus?.trim()) {
      params.set("academicStatus", options.academicStatus.trim());
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
    dateFrom?: string;
    dateTo?: string;
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
    if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
    if (options?.dateTo) params.set("dateTo", options.dateTo);
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
    options?: StudentFeeListOptions,
  ): Promise<StudentFeeListResponse> => {
    const params = new URLSearchParams();
    if (options?.status) {
      params.set("status", options.status);
    }
    params.set("page", String(options?.page ?? 1));
    params.set("pageSize", String(options?.pageSize ?? 20));
    params.set("sortBy", options?.sortBy ?? "name");
    params.set("sortDirection", options?.sortDirection ?? "asc");
    if (options?.query?.trim()) params.set("q", options.query.trim());
    if (options?.referenceSemester) params.set("referenceSemester", options.referenceSemester);
    if (options?.paymentYear !== undefined) params.set("paymentYear", String(options.paymentYear));
    if (options?.majorCategory) params.set("majorCategory", options.majorCategory);
    if (options?.userIds?.length) params.set("userIds", options.userIds.join(","));

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

  getManagedContacts: async (
    options?: ContactListOptions,
  ): Promise<ContactListResponse> => {
    const params = new URLSearchParams();
    if (options?.q?.trim()) params.set("q", options.q.trim());
    if (options?.cohort !== undefined) params.set("cohort", String(options.cohort));
    if (options?.department?.trim()) params.set("department", options.department.trim());
    if (options?.privacyConsented !== undefined) {
      params.set("privacyConsented", String(options.privacyConsented));
    }
    if (options?.page !== undefined) params.set("page", String(options.page));
    if (options?.pageSize !== undefined) params.set("pageSize", String(options.pageSize));
    const query = params.toString();
    return requestJson<ContactListResponse>(
      `${contactsBaseUrl}/manage${query ? `?${query}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getManagedContactDepartments: async (): Promise<ContactDepartmentListResponse> => {
    return requestJson<ContactDepartmentListResponse>(
      `${contactsBaseUrl}/manage/departments`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  searchContactPortalMembers: async (
    query?: string,
    limit = 20,
  ): Promise<AdminUserRecord[]> => {
    const params = new URLSearchParams();
    if (query?.trim()) params.set("q", query.trim());
    params.set("limit", String(limit));
    return requestJson<AdminUserRecord[]>(
      `${contactsBaseUrl}/portal-members?${params.toString()}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  syncContactsSpreadsheet: async (): Promise<ContactSpreadsheetSyncResponse> => {
    return requestJson<ContactSpreadsheetSyncResponse>(
      `${contactsBaseUrl}/spreadsheet/sync`,
      {
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  downloadContactsXlsx: async (
    options?: Omit<ContactListOptions, "page" | "pageSize">,
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options?.q?.trim()) params.set("q", options.q.trim());
    if (options?.cohort !== undefined) params.set("cohort", String(options.cohort));
    if (options?.department?.trim()) params.set("department", options.department.trim());
    if (options?.privacyConsented !== undefined) {
      params.set("privacyConsented", String(options.privacyConsented));
    }
    const query = params.toString();
    return requestBlob(
      `${contactsBaseUrl}/manage/export.xlsx${query ? `?${query}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  updateUserActiveStatus: async (
    userId: string,
    body: UpdateUserActiveStatusRequest,
  ): Promise<{ userId: string; isActive: boolean }> => {
    return requestJson<{ userId: string; isActive: boolean }>(
      `${usersBaseUrl}/${encodeURIComponent(userId)}/status`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      { retryOnUnauthorized: true },
    );
  },

  getUserPostingSuspension: async (
    userId: string,
  ): Promise<UserPostingSuspensionResponse> => {
    return requestJson<UserPostingSuspensionResponse>(
      `${usersBaseUrl}/${encodeURIComponent(userId)}/sanctions/posting`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  updateUserPostingSuspension: async (
    userId: string,
    body: UpdateUserPostingSuspensionRequest,
  ): Promise<UserPostingSuspensionResponse> => {
    return requestJson<UserPostingSuspensionResponse>(
      `${usersBaseUrl}/${encodeURIComponent(userId)}/sanctions/posting`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      },
      { retryOnUnauthorized: true },
    );
  },

  downloadAuditLogsXlsx: async (options?: {
    action?: string;
    q?: string;
    sortBy?: "createdAt" | "actor" | "action";
    sortDirection?: "asc" | "desc";
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options?.action?.trim()) params.set("action", options.action.trim());
    if (options?.q?.trim()) params.set("q", options.q.trim());
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.sortDirection) params.set("sortDirection", options.sortDirection);
    if (options?.targetType?.trim()) params.set("targetType", options.targetType.trim());
    if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
    if (options?.dateTo) params.set("dateTo", options.dateTo);
    const query = params.toString();
    return requestBlob(
      `${auditLogsBaseUrl}/export.xlsx${query ? `?${query}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  getStudentFeeStats: async (options: StudentFeeStatsOptions = {}): Promise<StudentFeeStatsResponse> => {
    const search = new URLSearchParams();
    if (options.dateFrom) search.set("dateFrom", options.dateFrom);
    if (options.dateTo) search.set("dateTo", options.dateTo);
    if (options.bucket) search.set("bucket", options.bucket);
    if (options.referenceSemester) search.set("referenceSemester", options.referenceSemester);
    const params = search.size > 0 ? `?${search.toString()}` : "";
    return requestJson<StudentFeeStatsResponse>(
      `${usersBaseUrl}/fee-status/stats${params}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  downloadStudentFeeXlsx: async (options?: StudentFeeListOptions): Promise<Blob> => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.sortDirection) params.set("sortDirection", options.sortDirection);
    if (options?.query?.trim()) params.set("q", options.query.trim());
    if (options?.referenceSemester) params.set("referenceSemester", options.referenceSemester);
    if (options?.paymentYear !== undefined) params.set("paymentYear", String(options.paymentYear));
    if (options?.majorCategory) params.set("majorCategory", options.majorCategory);
    if (options?.userIds?.length) params.set("userIds", options.userIds.join(","));
    const query = params.toString();
    return requestBlob(
      `${usersBaseUrl}/fee-status/export.xlsx${query ? `?${query}` : ""}`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  syncStudentFeeSpreadsheet: async (
    options?: StudentFeeListOptions,
  ): Promise<StudentFeeSpreadsheetSyncResponse> => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.sortBy) params.set("sortBy", options.sortBy);
    if (options?.sortDirection) params.set("sortDirection", options.sortDirection);
    if (options?.query?.trim()) params.set("q", options.query.trim());
    if (options?.referenceSemester) params.set("referenceSemester", options.referenceSemester);
    if (options?.paymentYear !== undefined) params.set("paymentYear", String(options.paymentYear));
    if (options?.majorCategory) params.set("majorCategory", options.majorCategory);
    if (options?.userIds?.length) params.set("userIds", options.userIds.join(","));
    const query = params.toString();
    return requestJson<StudentFeeSpreadsheetSyncResponse>(
      `${usersBaseUrl}/fee-status/spreadsheet/sync${query ? `?${query}` : ""}`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  bulkUpdateStudentFeeStatuses: async (
    body: BulkUpdateStudentFeeStatusRequest,
  ): Promise<BulkUpdateStudentFeeStatusResponse> => {
    return requestJson<BulkUpdateStudentFeeStatusResponse>(
      `${usersBaseUrl}/fee-status/bulk`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  processStudentFeePayments: async (
    body: BulkProcessStudentFeePaymentsRequest,
  ): Promise<BulkProcessStudentFeePaymentsResponse> => {
    return requestJson<BulkProcessStudentFeePaymentsResponse>(
      `${usersBaseUrl}/fee-status/payments`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  getStudentFeeDetail: async (userId: string): Promise<StudentFeeDetailResponse> => {
    return requestJson<StudentFeeDetailResponse>(
      `${usersBaseUrl}/fee-status/detail/${encodeURIComponent(userId)}`,
      { method: "GET" },
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

  createContactDepartment: async (
    body: CreateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord> => {
    return requestJson<ContactDepartmentRecord>(
      `${contactsBaseUrl}/departments`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateContactDepartment: async (
    id: string,
    body: UpdateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord> => {
    return requestJson<ContactDepartmentRecord>(
      `${contactsBaseUrl}/departments/${encodeURIComponent(id)}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteContactDepartment: async (id: string): Promise<{ success: boolean }> => {
    return requestJson<{ success: boolean }>(
      `${contactsBaseUrl}/departments/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  listRoleGroupCandidates: async (
    roleGroupId: number,
    options?: {
      q?: string;
      department?: string;
      academicStatus?: string;
      majorType?: "PRIMARY";
      feeStatus?: "PAID" | "PARTIAL" | "UNPAID";
      status?: "active" | "inactive";
      page?: number;
      pageSize?: number;
    },
  ): Promise<RoleGroupCandidateListResponse> => {
    const params = new URLSearchParams();
    if (options?.q?.trim()) params.set("q", options.q.trim());
    if (options?.department?.trim()) params.set("department", options.department.trim());
    if (options?.academicStatus?.trim()) params.set("academicStatus", options.academicStatus.trim());
    if (options?.majorType) params.set("majorType", options.majorType);
    if (options?.feeStatus) params.set("feeStatus", options.feeStatus);
    if (options?.status) params.set("status", options.status);
    if (options?.page !== undefined) params.set("page", String(options.page));
    if (options?.pageSize !== undefined) params.set("pageSize", String(options.pageSize));

    return requestJson<RoleGroupCandidateListResponse>(
      `${roleGroupsBaseUrl}/${roleGroupId}/users/candidates${params.toString() ? `?${params.toString()}` : ""}`,
      { method: "GET" },
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

  reorderContacts: async (
    body: ReorderContactsRequest,
  ): Promise<ContactRecord[]> => {
    return requestJson<ContactRecord[]>(
      `${contactsBaseUrl}/order`,
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

  sendBulkEmailTest: async (
    body: SendBulkEmailRequest,
  ): Promise<SendBulkEmailTestResponse> => {
    return requestJson<SendBulkEmailTestResponse>(
      `${emailsBaseUrl}/test`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  createBulkEmailTemplate: async (
    body: CreateBulkEmailTemplateRequest,
  ): Promise<BulkEmailTemplate> => {
    return requestJson<BulkEmailTemplate>(
      `${emailsBaseUrl}/templates`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  updateBulkEmailTemplate: async (
    templateId: string,
    body: UpdateBulkEmailTemplateRequest,
  ): Promise<BulkEmailTemplate> => {
    return requestJson<BulkEmailTemplate>(
      `${emailsBaseUrl}/templates/${encodeURIComponent(templateId)}`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteBulkEmailTemplate: async (templateId: string): Promise<{ success: boolean }> => {
    return requestJson<{ success: boolean }>(
      `${emailsBaseUrl}/templates/${encodeURIComponent(templateId)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  getBulkEmailDrafts: async (): Promise<BulkEmailDraftListResponse> => {
    return requestJson<BulkEmailDraftListResponse>(
      `${emailsBaseUrl}/drafts`,
      { method: "GET" },
      { retryOnUnauthorized: true },
    );
  },

  saveBulkEmailDraft: async (
    body: SaveBulkEmailDraftRequest,
  ): Promise<BulkEmailRecord> => {
    return requestJson<BulkEmailRecord>(
      `${emailsBaseUrl}/drafts`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },

  deleteBulkEmailDraft: async (draftId: string): Promise<{ success: boolean }> => {
    return requestJson<{ success: boolean }>(
      `${emailsBaseUrl}/drafts/${encodeURIComponent(draftId)}`,
      { method: "DELETE" },
      { retryOnUnauthorized: true },
    );
  },

  cancelScheduledBulkEmail: async (emailId: string): Promise<BulkEmailRecord> => {
    return requestJson<BulkEmailRecord>(
      `${emailsBaseUrl}/${encodeURIComponent(emailId)}/cancel`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  retryBulkEmail: async (emailId: string): Promise<SendBulkEmailResponse> => {
    return requestJson<SendBulkEmailResponse>(
      `${emailsBaseUrl}/${encodeURIComponent(emailId)}/retry`,
      { method: "POST" },
      { retryOnUnauthorized: true },
    );
  },

  previewBulkEmailRecipients: async (
    body: SendBulkEmailRequest,
  ): Promise<BulkEmailPreviewResponse> => {
    return requestJson<BulkEmailPreviewResponse>(
      `${emailsBaseUrl}/preview`,
      {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
      { retryOnUnauthorized: true },
    );
  },
});
