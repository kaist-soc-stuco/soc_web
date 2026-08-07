import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import type { CreateEventRequest, PatchEventRequest } from '@soc/contracts';
import type { Request } from 'express';

import { AuthGuard, OptionalAuthGuard } from '../../shared/guards';
import { EventsService } from './events.service';

type EventRequest = Request & { user?: { id: string } };
type AuthenticatedRequest = Request & { user: { id: string } };
const EVENT_KEYS = [
  'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'startAtMs', 'endAtMs',
  'allDay', 'allDayStartDate', 'allDayEndDate', 'location', 'visibility',
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectWithKeys(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new UnprocessableEntityException(code);
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new UnprocessableEntityException(code);
  return value as Record<string, unknown>;
}

function eventBody(value: unknown): Record<string, unknown> {
  return objectWithKeys(value, EVENT_KEYS, 'invalid_event');
}
function uuid(value: string): string {
  if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_event_id');
  return value;
}

@Controller('events')
@UseGuards(OptionalAuthGuard)
export class PublicEventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  list(@Req() request: EventRequest, @Query() query: Record<string, unknown>) {
    const value = objectWithKeys(query, ['fromMs', 'toMs', 'locale'], 'invalid_event_query');
    return this.events.list(request.user?.id, value);
  }

  @Get(':id')
  get(@Req() request: EventRequest, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    const value = objectWithKeys(query, ['locale'], 'invalid_event_query');
    return this.events.get(request.user?.id, uuid(id), value.locale);
  }
}

@Controller('admin/events')
@UseGuards(AuthGuard)
export class AdminEventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.events.create(request.user.id, eventBody(body) as unknown as CreateEventRequest);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.events.getAdmin(request.user.id, uuid(id));
  }

  @Patch(':id')
  patch(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.events.patch(request.user.id, uuid(id), eventBody(body) as PatchEventRequest);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.events.delete(request.user.id, uuid(id));
  }
}
