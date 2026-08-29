import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ContactListOptions, ContactListResponse } from "@soc/contracts";
import { AuditLogService } from "../audit/audit-log.service";
import type { AuditMetadata } from "../audit/audit-context";
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
    audit?: AuditMetadata,
  ): Promise<ContactListResponse> {
    await this.purgeRevoked(audit);
    return this.contactsRepo.findManaged(input);
  }

  async findDepartments(includeInactive = false): Promise<ContactDepartmentListResponse> {
    return this.contactsRepo.findDepartments(includeInactive);
  }

  async createDepartment(
    dto: CreateContactDepartmentRequest,
    audit?: AuditMetadata,
  ): Promise<ContactDepartmentRecord> {
    try {
      const department = await this.contactsRepo.insertDepartment(dto);
      await this.auditLogService.record({
        action: "executive_contact.department.create",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: { after: safeDepartmentSnapshot(department) },
        targetId: department.id,
        targetType: "executive_contact",
      });
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
    audit?: AuditMetadata,
  ): Promise<ContactDepartmentRecord> {
    try {
      const before = await this.contactsRepo.findDepartmentById(id);
      const department = await this.contactsRepo.updateDepartment(id, dto);
      if (!department) throw new NotFoundException("contact_department_not_found");
      await this.auditLogService.record({
        action: "executive_contact.department.update",
        actorUserId: audit?.actorUserId ?? null,
        ipAddress: audit?.ipAddress ?? null,
        payload: {
          before: before ? safeDepartmentSnapshot(before) : undefined,
          after: safeDepartmentSnapshot(department),
          changedFields: Object.keys(dto),
        },
        targetId: department.id,
        targetType: "executive_contact",
      });
      await this.googleSheets.enqueueSync();
      return department;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("contact_department_exists");
      throw error;
    }
  }

  async deleteDepartment(id: string, audit?: AuditMetadata): Promise<void> {
    const department = await this.contactsRepo.findDepartmentById(id);
    if (!department) throw new NotFoundException("contact_department_not_found");
    const linked = await this.contactsRepo.findManaged({ department: department.nameKo, page: 1, pageSize: 1 });
    if (linked.total && linked.total > 0) {
      throw new ConflictException("contact_department_in_use");
    }
    await this.contactsRepo.deleteDepartment(id);
    await this.auditLogService.record({
      action: "executive_contact.department.delete",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { deleted: safeDepartmentSnapshot(department) },
      targetId: department.id,
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
  }

  async searchPortalMembers(query?: string, limit = 20) {
    return this.usersService.searchUsers({ query, limit });
  }

  async exportManaged(
    input: ContactListOptions = {},
    audit?: AuditMetadata,
  ): Promise<ContactRecord[]> {
    const response = await this.findManaged(
      { ...input, page: 1, pageSize: 500 },
      audit,
    );
    await this.auditLogService.record({
      action: "executive_contact.export",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        count: response.items.length,
        filters: {
          q: input.q ?? null,
          department: input.department ?? null,
          cohort: input.cohort ?? null,
          privacyConsented: input.privacyConsented ?? null,
        },
      },
      targetType: "executive_contact",
    });
    return response.items;
  }

  async findById(id: string): Promise<ContactRecord> {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    return contact;
  }

  async create(dto: CreateContactRequest, audit?: AuditMetadata): Promise<ContactRecord> {
    const contact = await this.contactsRepo.insert(dto);
    await this.auditLogService.record({
      action: "executive_contact.create",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { after: safeContactSnapshot(contact) },
      targetId: contact.id,
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
    return contact;
  }

  async bulkImport(
    dto: BulkImportContactsRequest,
    audit?: AuditMetadata,
  ): Promise<BulkImportContactsResponse> {
    const result = await this.contactsRepo.bulkImport(dto);
    await this.auditLogService.record({
      action: "executive_contact.import",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        importedCount: result.importedCount,
        removedCount: result.removedCount,
        replaceExisting: dto.replaceExisting,
      },
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
    return result;
  }

  async reorder(dto: ReorderContactsRequest, audit?: AuditMetadata): Promise<ContactRecord[]> {
    const contacts = await this.contactsRepo.reorder(dto.items);
    await this.auditLogService.record({
      action: "executive_contact.reorder",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { itemCount: dto.items.length },
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
    return contacts;
  }

  async update(id: string, dto: UpdateContactRequest, audit?: AuditMetadata): Promise<ContactRecord> {
    const before = await this.contactsRepo.findById(id);
    const contact = await this.contactsRepo.update(id, dto);
    if (!contact) {
      if (before && dto.privacyConsented === false) {
        await this.auditLogService.record({
          action: "executive_contact.delete",
          actorUserId: audit?.actorUserId ?? null,
          ipAddress: audit?.ipAddress ?? null,
          payload: { deleted: safeContactSnapshot(before), reason: "privacy_revoked" },
          targetId: id,
          targetType: "executive_contact",
        });
      }
      throw new NotFoundException("contact_not_found");
    }
    await this.auditLogService.record({
      action: "executive_contact.update",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: {
        before: before ? safeContactSnapshot(before) : undefined,
        after: safeContactSnapshot(contact),
        changedFields: Object.keys(dto),
      },
      targetId: contact.id,
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
    return contact;
  }

  async delete(id: string, audit?: AuditMetadata): Promise<void> {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    await this.contactsRepo.delete(id);
    await this.auditLogService.record({
      action: "executive_contact.delete",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { deleted: safeContactSnapshot(contact) },
      targetId: id,
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
  }

  private async purgeRevoked(audit?: AuditMetadata): Promise<void> {
    const removedCount = await this.contactsRepo.purgeRevoked();
    if (removedCount === 0) return;

    await this.auditLogService.record({
      action: "CONTACT_PRIVACY_PURGE",
      actorUserId: audit?.actorUserId ?? null,
      ipAddress: audit?.ipAddress ?? null,
      payload: { removedCount, reason: "privacy_consent_revoked" },
      targetType: "executive_contact",
    });
    await this.googleSheets.enqueueSync();
  }
}

function safeContactSnapshot(contact: ContactRecord) {
  return {
    departmentEn: contact.departmentEn,
    departmentKo: contact.departmentKo,
    nameEn: contact.nameEn,
    nameKo: contact.nameKo,
    roleEn: contact.roleEn,
    roleKo: contact.roleKo,
    sortOrder: contact.sortOrder,
  };
}

function safeDepartmentSnapshot(department: ContactDepartmentRecord) {
  return {
    descriptionEn: department.descriptionEn,
    descriptionKo: department.descriptionKo,
    inquiryEmailConfigured: Boolean(department.inquiryEmail),
    isActive: department.isActive,
    nameEn: department.nameEn,
    nameKo: department.nameKo,
    sortOrder: department.sortOrder,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );
}
