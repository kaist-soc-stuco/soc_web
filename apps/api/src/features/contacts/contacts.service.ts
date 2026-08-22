import { Injectable, NotFoundException } from "@nestjs/common";
import type { ContactListOptions, ContactListResponse } from "@soc/contracts";
import { AuditLogService } from "../audit/audit-log.service";
import { ContactsRepository } from "./contacts.repository";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactRecord,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
} from "@soc/contracts";

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly auditLogService: AuditLogService,
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
    return this.contactsRepo.insert(dto);
  }

  async bulkImport(
    dto: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    return this.contactsRepo.bulkImport(dto);
  }

  async reorder(dto: ReorderContactsRequest): Promise<ContactRecord[]> {
    return this.contactsRepo.reorder(dto.items);
  }

  async update(id: string, dto: UpdateContactRequest): Promise<ContactRecord> {
    const contact = await this.contactsRepo.update(id, dto);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    return contact;
  }

  async delete(id: string): Promise<void> {
    const contact = await this.contactsRepo.findById(id);
    if (!contact) {
      throw new NotFoundException("contact_not_found");
    }
    await this.contactsRepo.delete(id);
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
  }
}
