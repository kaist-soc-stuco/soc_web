import { Injectable, NotFoundException } from "@nestjs/common";
import { ContactsRepository } from "./contacts.repository";
import type { ContactRecord, CreateContactRequest, UpdateContactRequest } from "@soc/contracts";

@Injectable()
export class ContactsService {
  constructor(private readonly contactsRepo: ContactsRepository) {}

  async findAll(): Promise<ContactRecord[]> {
    return this.contactsRepo.findAll();
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
}
