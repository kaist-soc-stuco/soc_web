import {
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AdminEvent,
  ContentLocale,
  CreateEventRequest,
  EventItem,
  EventListResponse,
  PatchEventRequest,
} from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { EventsRepository, type EventVisibility } from './events.repository';

const MAX_RANGE_MS = 92 * 24 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 20_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EventsService {
  constructor(
    @Inject(EventsRepository) private readonly repository: EventsRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async list(actorUserId: string | undefined, query: { fromMs?: unknown; toMs?: unknown; locale?: unknown }): Promise<EventListResponse> {
    const fromMs = this.queryEpoch(query.fromMs);
    const toMs = this.queryEpoch(query.toMs);
    if (fromMs >= toMs || toMs - fromMs > MAX_RANGE_MS) throw new UnprocessableEntityException('invalid_event_range');
    const locale = this.locale(query.locale);
    const rows = await this.repository.list(new Date(fromMs), new Date(toMs), await this.visibleTo(actorUserId));
    return { locale, items: rows.map((event) => this.publicEvent(event, locale)) };
  }

  async get(actorUserId: string | undefined, id: string, localeValue: unknown): Promise<EventItem> {
    this.uuid(id);
    const locale = this.locale(localeValue);
    const event = await this.repository.findVisibleById(id, await this.visibleTo(actorUserId));
    if (!event) throw new NotFoundException('event_not_found');
    return this.publicEvent(event, locale, await this.repository.findPublicSurveyIdByEventId(event.id));
  }

  async getAdmin(actorUserId: string, id: string): Promise<AdminEvent> {
    await this.requireManager(actorUserId);
    this.uuid(id);
    const event = await this.repository.findById(id);
    if (!event) throw new NotFoundException('event_not_found');
    return this.adminEvent(event);
  }

  async create(actorUserId: string, input: CreateEventRequest): Promise<AdminEvent> {
    await this.requireManager(actorUserId);
    const normalized = this.validateEvent(input);
    const now = this.clock.now();
    return this.adminEvent(await this.repository.create({
      ...normalized,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
    }));
  }

  async patch(actorUserId: string, id: string, input: PatchEventRequest): Promise<AdminEvent> {
    await this.requireManager(actorUserId);
    this.uuid(id);
    this.validatePatch(input);
    const changedFieldNames = [...new Set(Object.keys(input).map((key) => {
      if (key === 'titleKr' || key === 'titleEn') return 'title';
      if (key === 'descriptionKr' || key === 'descriptionEn') return 'description';
      if (key === 'startAtMs' || key === 'endAtMs') return 'time';
      if (key === 'allDay' || key === 'allDayStartDate' || key === 'allDayEndDate') return 'allDay';
      return key;
    }))].join(',');
    const updatedAt = this.clock.now();
    const updated = await this.repository.patch(id, (current) => {
      const merged: CreateEventRequest = {
        titleKr: input.titleKr ?? current.titleKr,
        titleEn: input.titleEn ?? current.titleEn,
        descriptionKr: input.descriptionKr ?? current.descriptionKr,
        descriptionEn: input.descriptionEn ?? current.descriptionEn,
        startAtMs: input.startAtMs ?? current.startAt.getTime(),
        endAtMs: input.endAtMs ?? current.endAt.getTime(),
        allDay: input.allDay ?? current.allDay,
        allDayStartDate: input.allDayStartDate === undefined ? current.allDayStartDate : input.allDayStartDate,
        allDayEndDate: input.allDayEndDate === undefined ? current.allDayEndDate : input.allDayEndDate,
        location: input.location ?? current.location,
        visibility: input.visibility ?? current.visibility,
      };
      return {
        values: {
          ...this.validateEvent(merged),
          updatedByUserId: actorUserId,
          updatedAt,
        },
        changedFieldNames,
      };
    });
    if (!updated) throw new NotFoundException('event_not_found');
    return this.adminEvent(updated);
  }

  async delete(actorUserId: string, id: string): Promise<void> {
    await this.requireManager(actorUserId);
    this.uuid(id);
    if (!(await this.repository.delete(id, actorUserId))) throw new NotFoundException('event_not_found');
  }

  private validateEvent(input: CreateEventRequest) {
    if (!input || typeof input !== 'object') throw new UnprocessableEntityException('invalid_event');
    for (const value of [input.titleKr, input.titleEn, input.descriptionKr, input.descriptionEn, input.location]) this.text(value);
    const startAtMs = this.bodyEpoch(input.startAtMs);
    const endAtMs = this.bodyEpoch(input.endAtMs);
    if (endAtMs <= startAtMs) throw new UnprocessableEntityException('invalid_event_time');
    if (input.visibility !== 'PUBLIC' && input.visibility !== 'AUTHENTICATED' && input.visibility !== 'COMMITTEE') {
      throw new UnprocessableEntityException('invalid_event_visibility');
    }
    if (typeof input.allDay !== 'boolean') throw new UnprocessableEntityException('invalid_event_all_day');
    const allDayStartDate = input.allDayStartDate ?? null;
    const allDayEndDate = input.allDayEndDate ?? null;
    if (input.allDay) {
      this.calendarDate(allDayStartDate);
      this.calendarDate(allDayEndDate);
      if (allDayEndDate! <= allDayStartDate!) throw new UnprocessableEntityException('invalid_event_all_day');
      if (startAtMs !== this.kstStart(allDayStartDate!) || endAtMs !== this.kstStart(allDayEndDate!)) {
        throw new UnprocessableEntityException('invalid_event_all_day');
      }
    } else if (allDayStartDate !== null || allDayEndDate !== null) {
      throw new UnprocessableEntityException('invalid_event_all_day');
    }
    return {
      titleKr: input.titleKr.trim(),
      titleEn: input.titleEn.trim(),
      descriptionKr: input.descriptionKr.trim(),
      descriptionEn: input.descriptionEn.trim(),
      startAt: new Date(startAtMs),
      endAt: new Date(endAtMs),
      allDay: input.allDay,
      allDayStartDate,
      allDayEndDate,
      location: input.location.trim(),
      visibility: input.visibility,
    };
  }

  private async visibleTo(actorUserId: string | undefined): Promise<EventVisibility[]> {
    if (!actorUserId) return ['PUBLIC'];
    const result: EventVisibility[] = ['PUBLIC', 'AUTHENTICATED'];
    if (await this.permissions.hasPermission(actorUserId, 'EVENT_MANAGE', 'GLOBAL')) result.push('COMMITTEE');
    return result;
  }

  private async requireManager(actorUserId: string): Promise<void> {
    if (!(await this.permissions.hasPermission(actorUserId, 'EVENT_MANAGE', 'GLOBAL'))) {
      throw new ForbiddenException('insufficient_permission');
    }
  }

  private queryEpoch(value: unknown): number {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{1,16}$/.test(value)
        ? Number(value)
        : Number.NaN;
    return this.validEpoch(parsed);
  }

  private bodyEpoch(value: unknown): number {
    if (typeof value !== 'number') throw new UnprocessableEntityException('invalid_event_time');
    return this.validEpoch(value);
  }

  private validEpoch(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(new Date(value).getTime())) {
      throw new UnprocessableEntityException('invalid_event_time');
    }
    return value;
  }

  private validatePatch(input: unknown): asserts input is PatchEventRequest {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw new UnprocessableEntityException('invalid_event');
    }
    const allowed = new Set([
      'titleKr', 'titleEn', 'descriptionKr', 'descriptionEn', 'startAtMs', 'endAtMs',
      'allDay', 'allDayStartDate', 'allDayEndDate', 'location', 'visibility',
    ]);
    for (const [key, value] of Object.entries(input)) {
      if (!allowed.has(key)) throw new UnprocessableEntityException('invalid_event');
      if (value === null && key !== 'allDayStartDate' && key !== 'allDayEndDate') {
        throw new UnprocessableEntityException('invalid_event');
      }
    }
  }

  private locale(value: unknown): ContentLocale {
    if (value === undefined || value === 'ko') return 'ko';
    if (value === 'en') return 'en';
    throw new UnprocessableEntityException('invalid_locale');
  }

  private text(value: unknown): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) {
      throw new UnprocessableEntityException('invalid_event');
    }
  }

  private uuid(value: string): void {
    if (!UUID_PATTERN.test(value)) throw new UnprocessableEntityException('invalid_event_id');
  }

  private calendarDate(value: string | null): void {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new UnprocessableEntityException('invalid_event_all_day');
    const [year, month, day] = value.split('-').map(Number);
    if (new Date(Date.UTC(year!, month! - 1, day!)).toISOString().slice(0, 10) !== value) {
      throw new UnprocessableEntityException('invalid_event_all_day');
    }
  }

  private kstStart(value: string): number {
    return Date.parse(`${value}T00:00:00+09:00`);
  }

  private publicEvent(event: {
    id: string; titleKr: string; titleEn: string; descriptionKr: string; descriptionEn: string;
    startAt: Date; endAt: Date; allDay: boolean; allDayStartDate: string | null; allDayEndDate: string | null;
    location: string; visibility: EventVisibility; updatedAt: Date;
  }, locale: ContentLocale, surveyId?: string | null): EventItem {
    const title = locale === 'ko' ? event.titleKr : event.titleEn;
    const description = locale === 'ko' ? event.descriptionKr : event.descriptionEn;
    return {
      id: event.id,
      title: { value: title || null, translationUnavailable: !title },
      description: { value: description || null, translationUnavailable: !description },
      startAtMs: event.startAt.getTime(),
      endAtMs: event.endAt.getTime(),
      allDay: event.allDay,
      allDayStartDate: event.allDayStartDate,
      allDayEndDate: event.allDayEndDate,
      location: event.location,
      visibility: event.visibility,
      updatedAt: event.updatedAt.toISOString(),
      ...(surveyId === undefined ? {} : { surveyId }),
    };
  }

  private adminEvent(event: {
    id: string; titleKr: string; titleEn: string; descriptionKr: string; descriptionEn: string;
    startAt: Date; endAt: Date; allDay: boolean; allDayStartDate: string | null; allDayEndDate: string | null;
    location: string; visibility: EventVisibility; createdByUserId: string; updatedByUserId: string;
    createdAt: Date; updatedAt: Date;
  }): AdminEvent {
    return {
      id: event.id,
      titleKr: event.titleKr,
      titleEn: event.titleEn,
      descriptionKr: event.descriptionKr,
      descriptionEn: event.descriptionEn,
      startAtMs: event.startAt.getTime(),
      endAtMs: event.endAt.getTime(),
      allDay: event.allDay,
      allDayStartDate: event.allDayStartDate,
      allDayEndDate: event.allDayEndDate,
      location: event.location,
      visibility: event.visibility,
      createdByUserId: event.createdByUserId,
      updatedByUserId: event.updatedByUserId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
