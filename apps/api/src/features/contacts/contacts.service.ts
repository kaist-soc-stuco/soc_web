import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ContactListOptions, ContactListResponse } from "@soc/contracts";
import { AuditLogService } from "../audit/audit-log.service";
import { ContactsRepository } from "./contacts.repository";
import { UsersService } from "../users/users.service";
import { GoogleContactSheetsService } from "./google-contact-sheets.service";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactRecord,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
  ContactDepartmentListResponse,
  ContactDepartmentRecord,
  CreateContactDepartmentRequest,
  UpdateContactDepartmentRequest,
} from "@soc/contracts";

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly auditLogService: AuditLogService,
    private readonly usersService: UsersService,
    private readonly googleSheets: GoogleContactSheetsService,
  ) {}

  async findAll(): Promise<ContactRecord[]> {
    await this.purgeRevoked();
    return this.contactsRepo.findAll();
  }

  async findManaged(
    input: ContactListOptions = {},
    actorUserId?: string,
  ): Promise<ContactListResponse> {
    await this.purgeRevoked(actorUserId);
    return this.contactsRepo.findManaged(input);
  }

  async findDepartments(includeInactive = false): Promise<ContactDepartmentListResponse> {
    return this.contactsRepo.findDepartments(includeInactive);
  }

  async createDepartment(dto: CreateContactDepartmentRequest): Promise<ContactDepartmentRecord> {
    try {
      const department = await this.contactsRepo.insertDepartment(dto);
      await this.googleSheets.enqueueSync();
      return department;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("contact_department_exists");
      throw error;
    }
  }

  async updateDepartment(
    id: string,
    dto: UpdateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord> {
    try {
      const department = await this.contactsRepo.updateDepartment(id, dto);
      if (!department) throw new NotFoundException("contact_department_not_found");
      await this.googleSheets.enqueueSync();
      return department;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("contact_department_exists");
      throw error;
    }
  }

  async deleteDepartment(id: string): Promise<void> {
    const department = await this.contactsRepo.findDepartmentById(id);
    if (!department) throw new NotFoundException("contact_department_not_found");
    const linked = await this.contactsRepo.findManaged({ department: department.nameKo, page: 1, pageSize: 1 });
    if (linked.total && linked.total > 0) {
      throw new ConflictException("contact_department_in_use");
    }
    await this.contactsRepo.deleteDepartment(id);
    await this.googleSheets.enqueueSync();
  }

  async searchPortalMembers(query?: string, limit = 20) {
    return this.usersService.searchUsers({ query, limit });
  }

  async exportManaged(
    input: ContactListOptions = {},
    actorUserId?: string,
  ): Promise<ContactRecord[]> {
    const response = await this.findManaged(
      { ...input, page: 1, pageSize: 500 },
      actorUserId,
    );
    return response.items;
  }

  async findById(id: string): Promise<ContactRecord> {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    return contact;
  }

  async create(dto: CreateContactRequest): Promise<ContactRecord> {
    const contact = await this.contactsRepo.insert(dto);
    await this.googleSheets.enqueueSync();
    return contact;
  }

  async bulkImport(
    dto: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    const result = await this.contactsRepo.bulkImport(dto);
    await this.googleSheets.enqueueSync();
    return result;
  }

  async reorder(dto: ReorderContactsRequest): Promise<ContactRecord[]> {
    const contacts = await this.contactsRepo.reorder(dto.items);
    await this.googleSheets.enqueueSync();
    return contacts;
  }

  async update(id: string, dto: UpdateContactRequest): Promise<ContactRecord> {
    const contact = await this.contactsRepo.update(id, dto);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    await this.googleSheets.enqueueSync();
    return contact;
  }

  async delete(id: string): Promise<void> {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    await this.contactsRepo.delete(id);
    await this.googleSheets.enqueueSync();
  }

  private async purgeRevoked(actorUserId?: string): Promise<void> {
    const removedCount = await this.contactsRepo.purgeRevoked();
    if (removedCount === 0) return;

    await this.auditLogService.record({
      action: "CONTACT_PRIVACY_PURGE",
      actorUserId: actorUserId ?? null,
      payload: { removedCount, reason: "privacy_consent_revoked" },
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}
