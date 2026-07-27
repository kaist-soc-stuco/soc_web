import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../../shared/guards';
import { NotificationsService, type MailMessageInput } from './notifications.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAIL_REQUEST_KEYS = ['contactIds', 'subject', 'body'] as const;
const MAIL_CANCEL_KEYS = ['reasonCode'] as const;
const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const MAX_MAIL_CONTACTS = 100;
const MAX_MAIL_SUBJECT_BYTES = 512;
const MAX_MAIL_BODY_BYTES = 8_192;

type AuthenticatedRequest = Request & { requestId: string; user: { id: string } };

type MailRequest = MailMessageInput;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function parseEmptyQuery(query: unknown): void {
  if (!isPlainObject(query) || Object.keys(query).length !== 0) {
    throw new BadRequestException('invalid_mail_query');
  }
}

function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new BadRequestException('invalid_mail_id');
  }
  return value;
}

function parseMailRequest(body: unknown): MailRequest {
  if (
    !isPlainObject(body)
    || !hasOnlyKeys(body, MAIL_REQUEST_KEYS)
    || !Array.isArray(body.contactIds)
    || body.contactIds.length < 1
    || body.contactIds.length > MAX_MAIL_CONTACTS
    || !body.contactIds.every((contactId) => typeof contactId === 'string' && UUID_PATTERN.test(contactId))
    || new Set(body.contactIds).size !== body.contactIds.length
    || typeof body.subject !== 'string'
    || !body.subject.trim()
    || Buffer.byteLength(body.subject, 'utf8') > MAX_MAIL_SUBJECT_BYTES
    || typeof body.body !== 'string'
    || !body.body.trim()
    || Buffer.byteLength(body.body, 'utf8') > MAX_MAIL_BODY_BYTES
  ) {
    throw new BadRequestException('invalid_mail_request');
  }

  return body as MailRequest;
}

function parseCancelRequest(body: unknown): void {
  if (
    !isPlainObject(body)
    || !hasOnlyKeys(body, MAIL_CANCEL_KEYS)
    || (body.reasonCode !== undefined && (typeof body.reasonCode !== 'string' || !REASON_CODE_PATTERN.test(body.reasonCode)))
  ) {
    throw new BadRequestException('invalid_mail_cancel_request');
  }
}

@Controller('admin/mail')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Post('preview')
  @HttpCode(200)
  preview(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Query() query: unknown) {
    parseEmptyQuery(query);
    const input = parseMailRequest(body);
    return this.notifications.preview(request.user.id, request.requestId, input);
  }

  @Post()
  @HttpCode(202)
  send(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Query() query: unknown) {
    parseEmptyQuery(query);
    const input = parseMailRequest(body);
    return this.notifications.send(request.user.id, request.requestId, input);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Query() query: unknown) {
    parseEmptyQuery(query);
    parseUuid(id);
    return this.notifications.get(request.user.id, request.requestId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() request: AuthenticatedRequest, @Param('id') id: unknown, @Body() body: unknown, @Query() query: unknown) {
    parseEmptyQuery(query);
    parseUuid(id);
    parseCancelRequest(body);
    return this.notifications.cancel(request.user.id, request.requestId);
  }
}
