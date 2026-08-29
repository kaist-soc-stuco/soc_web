import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, StreamableFile } from "@nestjs/common";
import type { Request } from "express";
import * as XLSX from "xlsx";
import {
  BulkImportContactsSchema,
  CreateContactDepartmentSchema,
  CreateContactSchema,
  ReorderContactsSchema,
  UpdateContactDepartmentSchema,
  UpdateContactSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
import { auditMetadataFromRequest } from "../audit/audit-context";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { ContactsService } from "./contacts.service";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactListResponse,
  ContactRecord,
  ContactDepartmentListResponse,
  ContactDepartmentRecord,
  CreateContactRequest,
  CreateContactDepartmentRequest,
  ReorderContactsRequest,
  UpdateContactDepartmentRequest,
  UpdateContactRequest,
  ContactSpreadsheetSyncResponse,
} from "@soc/contracts";
import { GoogleContactSheetsService } from "./google-contact-sheets.service";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller("contacts")
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly googleContactSheetsService: GoogleContactSheetsService,
  ) {}

  @Get()
  async getContacts(): Promise<ContactListResponse> {
    const items = await this.contactsService.findAll();
    return { items };
  }

  @Get("departments")
  async getContactDepartments(): Promise<ContactDepartmentListResponse> {
    return this.contactsService.findDepartments(false);
  }

  @Get("manage/export.xlsx")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="executive_contacts.xlsx"')
  async exportManagedContacts(
    @Req() request: AuthenticatedRequest,
    @Query("q") query?: string,
    @Query("cohort") cohort?: string,
    @Query("department") department?: string,
    @Query("privacyConsented") privacyConsented?: string,
  ): Promise<StreamableFile> {
    const items = await this.contactsService.exportManaged(
      parseContactListOptions({ query, cohort, department, privacyConsented }),
      auditMetadataFromRequest(request),
    );
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "영문명", "학번", "부서", "영문부서", "직책", "영문직책", "활동 연도", "이메일", "전화번호", "개인정보동의", "표시순서"],
      ...items.map((item) => [
        item.nameKo,
        item.nameEn,
        item.studentNumber,
        item.departmentKo,
        item.departmentEn,
        item.roleKo,
        item.roleEn,
        item.cohort,
        item.email,
        item.phoneNumber,
        item.privacyConsented ? "동의" : "미동의",
        item.sortOrder,
      ]),
    ]);
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 },
      { wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "연락망");
    const buffer = Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
    return new StreamableFile(buffer);
  }

  @Get("manage/departments")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async getManagedContactDepartments(): Promise<ContactDepartmentListResponse> {
    return this.contactsService.findDepartments(true);
  }

  @Get("portal-members")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async searchPortalMembers(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 20;
    return this.contactsService.searchPortalMembers(
      query,
      Number.isFinite(parsedLimit) ? parsedLimit : 20,
    );
  }

  @Get("manage")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async getManagedContacts(
    @Req() request: AuthenticatedRequest,
    @Query("q") query?: string,
    @Query("cohort") cohort?: string,
    @Query("department") department?: string,
    @Query("privacyConsented") privacyConsented?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<ContactListResponse> {
    return this.contactsService.findManaged(
      parseContactListOptions({ query, cohort, department, privacyConsented, page, pageSize }),
      auditMetadataFromRequest(request),
    );
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async createContact(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateContactSchema)) body: CreateContactRequest,
  ): Promise<ContactRecord> {
    return this.contactsService.create(body, auditMetadataFromRequest(request));
  }

  @Post("spreadsheet/sync")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async syncContactSpreadsheet(
    @Req() request: AuthenticatedRequest,
  ): Promise<ContactSpreadsheetSyncResponse> {
    return this.googleContactSheetsService.sync(auditMetadataFromRequest(request));
  }

  @Get("spreadsheet")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async getContactSpreadsheet(
    @Req() request: AuthenticatedRequest,
  ): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
  }> {
    return this.googleContactSheetsService.getReference(auditMetadataFromRequest(request));
  }

  @Post("departments")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async createContactDepartment(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(CreateContactDepartmentSchema)) body: CreateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord> {
    return this.contactsService.createDepartment(body, auditMetadataFromRequest(request));
  }

  @Patch("departments/:id")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async updateContactDepartment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateContactDepartmentSchema)) body: UpdateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord> {
    return this.contactsService.updateDepartment(id, body, auditMetadataFromRequest(request));
  }

  @Delete("departments/:id")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async deleteContactDepartment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<{ success: boolean }> {
    await this.contactsService.deleteDepartment(id, auditMetadataFromRequest(request));
    return { success: true };
  }

  @Post("bulk")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async bulkImportContacts(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(BulkImportContactsSchema))
    body: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    return this.contactsService.bulkImport(body, auditMetadataFromRequest(request));
  }

  @Patch("order")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async reorderContacts(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(ReorderContactsSchema))
    body: ReorderContactsRequest,
  ): Promise<ContactRecord[]> {
    return this.contactsService.reorder(body, auditMetadataFromRequest(request));
  }

  @Patch(":id")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async updateContact(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) body: UpdateContactRequest,
  ): Promise<ContactRecord> {
    return this.contactsService.update(id, body, auditMetadataFromRequest(request));
  }

  @Delete(":id")
  @RequirePermissions(Permissions.MANAGE_CONTACTS)
  async deleteContact(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<{ success: boolean }> {
    await this.contactsService.delete(id, auditMetadataFromRequest(request));
    return { success: true };
  }
}

function parseContactListOptions(input: {
  query?: string;
  cohort?: string;
  department?: string;
  privacyConsented?: string;
  page?: string;
  pageSize?: string;
}) {
  const parsedCohort = input.cohort ? Number(input.cohort) : undefined;
  const parsedPage = input.page ? Number(input.page) : undefined;
  const parsedPageSize = input.pageSize ? Number(input.pageSize) : undefined;
  return {
    q: input.query?.trim() || undefined,
    department: input.department?.trim() || undefined,
    cohort:
      parsedCohort !== undefined && Number.isInteger(parsedCohort) && parsedCohort > 0
        ? parsedCohort
        : undefined,
    privacyConsented:
      input.privacyConsented === "true"
        ? true
        : input.privacyConsented === "false"
          ? false
          : undefined,
    page: Number.isInteger(parsedPage) && parsedPage! > 0 ? parsedPage : undefined,
    pageSize: Number.isInteger(parsedPageSize) && parsedPageSize! > 0 ? parsedPageSize : undefined,
  };
}
