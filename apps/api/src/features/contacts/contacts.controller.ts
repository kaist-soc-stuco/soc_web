import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateContactSchema, UpdateContactSchema } from "@soc/contracts";
import { Permissions } from "@soc/contracts";
import { RequirePermissions } from "../../shared/guards";
import { ZodValidationPipe } from "../../shared/pipes/zod-validation.pipe";
import { ContactsService } from "./contacts.service";
import type { ContactListResponse, ContactRecord, CreateContactRequest, UpdateContactRequest } from "@soc/contracts";

@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(): Promise<ContactListResponse> {
    const items = await this.contactsService.findAll();
    return { items };
  }

  @Post()
  @RequirePermissions(Permissions.MANAGE_CONTENT)
  async createContact(
    @Body(new ZodValidationPipe(CreateContactSchema)) body: CreateContactRequest,
  ): Promise<ContactRecord> {
    return this.contactsService.create(body);
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
