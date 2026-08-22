import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import * as XLSX from "xlsx";
import {
  BulkImportContactsSchema,
  CreateContactSchema,
  ReorderContactsSchema,
  UpdateContactSchema,
} from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../auth/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { ContactsService } from "./contacts.service";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactListResponse,
  ContactRecord,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
} from "@soc/contracts";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(): Promise<ContactListResponse> {
    const items = await this.contactsService.findAll();
    return { items };
  }

  @Get("manage/export.xlsx")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @Header("Content-Disposition", 'attachment; filename="executive_contacts.xlsx"')
  async exportManagedContacts(
    @Req() request: AuthenticatedRequest,
    @Query("q") query?: string,
    @Query("gender") gender?: string,
    @Query("cohort") cohort?: string,
    @Query("department") department?: string,
    @Query("privacyConsented") privacyConsented?: string,
  ): Promise<Buffer> {
    const items = await this.contactsService.exportManaged(
      parseContactListOptions({ query, gender, cohort, department, privacyConsented }),
      request.user?.id,
    );
    const worksheet = XLSX.utils.json_to_sheet(items.map((item) => ({
      이름: item.nameKo,
      영문명: item.nameEn,
      직책: item.roleKo,
      영문직책: item.roleEn,
      성별: item.gender,
      기수: item.cohort,
      이메일: item.email,
      전화번호: item.phoneNumber,
      개인정보동의: item.privacyConsented ? "동의" : "미동의",
      표시순서: item.sortOrder,
    })));
    worksheet["!cols"] = [
      { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 10 },
      { wch: 10 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "연락망");
    return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
  }

  @Get("manage")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async getManagedContacts(
    @Req() request: AuthenticatedRequest,
    @Query("q") query?: string,
    @Query("gender") gender?: string,
    @Query("cohort") cohort?: string,
    @Query("department") department?: string,
    @Query("privacyConsented") privacyConsented?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<ContactListResponse> {
    return this.contactsService.findManaged(
      parseContactListOptions({ query, gender, cohort, department, privacyConsented, page, pageSize }),
      request.user?.id,
    );
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async createContact(
    @Body(new ZodValidationPipe(CreateContactSchema)) body: CreateContactRequest,
  ): Promise<ContactRecord> {
    return this.contactsService.create(body);
  }

  @Post("bulk")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async bulkImportContacts(
    @Body(new ZodValidationPipe(BulkImportContactsSchema))
    body: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    return this.contactsService.bulkImport(body);
  }

  @Patch("order")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async reorderContacts(
    @Body(new ZodValidationPipe(ReorderContactsSchema))
    body: ReorderContactsRequest,
  ): Promise<ContactRecord[]> {
    return this.contactsService.reorder(body);
  }

  @Patch(":id")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async updateContact(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) body: UpdateContactRequest,
  ): Promise<ContactRecord> {
    return this.contactsService.update(id, body);
  }

  @Delete(":id")
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async deleteContact(@Param("id") id: string): Promise<{ success: boolean }> {
    await this.contactsService.delete(id);
    return { success: true };
  }
}

function parseContactListOptions(input: {
  query?: string;
  gender?: string;
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
    gender: input.gender?.trim() || undefined,
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
