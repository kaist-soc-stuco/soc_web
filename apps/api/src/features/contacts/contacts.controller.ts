import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { CreateContactRequest, PatchContactRequest } from '@soc/contracts';
import type { Request } from 'express';
import { AuthGuard } from '../../shared/guards';
import { ContactsService } from './contacts.service';

type AuthenticatedRequest = Request & { user: { id: string }; requestId?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const correlation = (request: AuthenticatedRequest) => { const value = request.requestId; if (!value || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error('request_correlation_missing'); return value; };
const object = (value: unknown, keys: readonly string[]) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new UnprocessableEntityException('invalid_contact'); return value; };
const id = (value: string) => { if (!UUID.test(value)) throw new UnprocessableEntityException('invalid_contact_id'); return value; };

@Controller('admin/contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly contacts: ContactsService) {}
  @Get() list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) { object(query, ['cursor', 'limit', 'projection', 'includeDeleted']); return this.contacts.list(request.user.id, query); }
  @Post() create(@Req() request: AuthenticatedRequest, @Body() body: unknown) { return this.contacts.create(request.user.id, object(body, ['name', 'email', 'phone', 'affiliation', 'note', 'kaistUid', 'year', 'role', 'retentionDeadlineAt', 'holdUntil']) as CreateContactRequest, correlation(request)); }
  @Patch(':id') patch(@Req() request: AuthenticatedRequest, @Param('id') contactId: string, @Body() body: unknown) { return this.contacts.patch(request.user.id, id(contactId), object(body, ['name', 'email', 'phone', 'affiliation', 'note', 'kaistUid', 'year', 'role', 'retentionDeadlineAt', 'holdUntil']) as PatchContactRequest, correlation(request)); }
  @Delete(':id') @HttpCode(204) async delete(@Req() request: AuthenticatedRequest, @Param('id') contactId: string, @Body() body: unknown): Promise<void> { const value = object(body, ['reasonCode']) as Record<string, unknown>; await this.contacts.delete(request.user.id, id(contactId), value.reasonCode, correlation(request)); }
}
