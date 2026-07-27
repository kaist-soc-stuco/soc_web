import { describe, expect, it, vi } from 'vitest';

import { EventsService } from '../src/features/events/events.service';

const ids = {
  manager: '10000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000002',
  event: '10000000-0000-4000-8000-000000000003',
};
const start = Date.parse('2026-03-01T00:00:00.000Z');
const input = {
  titleKr: '한국어', titleEn: 'English', descriptionKr: '설명', descriptionEn: 'Description',
  startAtMs: start, endAtMs: start + 3_600_000, allDay: false,
  allDayStartDate: null, allDayEndDate: null, location: 'Room', visibility: 'PUBLIC' as const,
};
function row(overrides: Record<string, unknown> = {}) {
  return { id: ids.event, ...input, startAt: new Date(input.startAtMs), endAt: new Date(input.endAtMs), createdByUserId: ids.manager, updatedByUserId: ids.manager, createdAt: new Date(start), updatedAt: new Date(start), ...overrides };
}
function subject(overrides: Record<string, unknown> = {}) {
  const repository = { list: vi.fn().mockResolvedValue([]), findVisibleById: vi.fn(), create: vi.fn().mockImplementation(async (value) => row(value)), patch: vi.fn().mockImplementation(async (_id, buildUpdate) => { const { values } = buildUpdate(row()); return row(values); }), delete: vi.fn().mockResolvedValue(true), ...overrides };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(false) };
  const clock = { now: vi.fn().mockReturnValue(new Date('2026-04-01T01:02:03.000Z')) };
  return { service: new EventsService(repository as never, permissions as never, clock as never), repository, permissions, clock };
}

describe('EventsService RTM 25–29', () => {
  it('uses [fromMs,toMs) overlap, ordered repository limits, locale projections, and visibility tiers', async () => {
    const { service, repository, permissions } = subject({ list: vi.fn().mockResolvedValue([row({ titleEn: '', descriptionEn: '' })]) });
    const from = start + 10_000; const to = start + 20_000;
    const listed = await service.list(undefined, { fromMs: String(from), toMs: String(to), locale: 'en' });
    expect(repository.list).toHaveBeenCalledWith(new Date(from), new Date(to), ['PUBLIC']);
    expect(listed).toMatchObject({ locale: 'en', items: [{ title: { value: null, translationUnavailable: true }, description: { value: null, translationUnavailable: true } }] });
    await service.list(ids.user, { fromMs: from, toMs: to });
    expect(repository.list).toHaveBeenLastCalledWith(new Date(from), new Date(to), ['PUBLIC', 'AUTHENTICATED']);
    permissions.hasPermission.mockResolvedValueOnce(true);
    await service.list(ids.manager, { fromMs: from, toMs: to });
    expect(repository.list).toHaveBeenLastCalledWith(new Date(from), new Date(to), ['PUBLIC', 'AUTHENTICATED', 'COMMITTEE']);
  });

  it('rejects invalid ranges, locale, UUIDs, and invisible records without disclosure', async () => {
    const { service, repository } = subject();
    for (const query of [{ fromMs: start, toMs: start }, { fromMs: start, toMs: start + 93 * 86_400_000 }, { fromMs: '-1', toMs: String(start) }, { fromMs: String(start), toMs: String(start + 1), locale: 'fr' }]) await expect(service.list(undefined, query)).rejects.toMatchObject({ response: { message: /invalid_/ } });
    await expect(service.get(undefined, 'not-a-uuid', 'ko')).rejects.toMatchObject({ response: { message: 'invalid_event_id' } });
    repository.findVisibleById.mockResolvedValue(null);
    await expect(service.get(undefined, ids.event, 'ko')).rejects.toMatchObject({ response: { message: 'event_not_found' } });
  });

  it('requires EVENT_MANAGE and validates bilingual time and KST all-day intervals', async () => {
    const { service, repository, permissions, clock } = subject();
    await expect(service.create(ids.user, input)).rejects.toMatchObject({ response: { message: 'insufficient_permission' } });
    permissions.hasPermission.mockResolvedValue(true);
    await service.create(ids.manager, input);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ titleKr: '한국어', titleEn: 'English', createdAt: clock.now(), updatedAt: clock.now() }));
    for (const bad of [{ ...input, titleEn: ' ' }, { ...input, endAtMs: input.startAtMs }, { ...input, allDay: true, allDayStartDate: '2026-02-30', allDayEndDate: '2026-03-02' }]) await expect(service.create(ids.manager, bad)).rejects.toMatchObject({ response: { message: /invalid_event/ } });
    const allDay = { ...input, allDay: true, allDayStartDate: '2026-03-01', allDayEndDate: '2026-03-03', startAtMs: Date.parse('2026-03-01T00:00:00+09:00'), endAtMs: Date.parse('2026-03-03T00:00:00+09:00') };
    await expect(service.create(ids.manager, { ...allDay, startAtMs: allDay.startAtMs + 1 }))
      .rejects.toMatchObject({ response: { message: 'invalid_event_all_day' } });
    await expect(service.create(ids.manager, allDay)).resolves.toMatchObject({ allDay: true, allDayEndDate: '2026-03-03' });
  });

  it('patches with Clock updatedAt and performs authorized delete', async () => {
    const { service, repository, permissions, clock } = subject(); permissions.hasPermission.mockResolvedValue(true);
    await service.patch(ids.manager, ids.event, { location: 'New room' });
    expect(repository.patch).toHaveBeenCalledWith(ids.event, expect.any(Function));
    const built = repository.patch.mock.calls[0]![1](row());
    expect(built).toEqual(expect.objectContaining({
      values: expect.objectContaining({ location: 'New room', updatedByUserId: ids.manager, updatedAt: clock.now() }),
      changedFieldNames: 'location',
    }));
    await expect(service.patch(ids.manager, ids.event, {})).rejects.toMatchObject({ response: { message: 'invalid_event' } });
    await expect(service.patch(ids.manager, ids.event, { location: null } as never))
      .rejects.toMatchObject({ response: { message: 'invalid_event' } });
    await expect(service.patch(ids.manager, ids.event, { startAtMs: String(start) } as never))
      .rejects.toMatchObject({ response: { message: 'invalid_event_time' } });
    await service.delete(ids.manager, ids.event);
    expect(repository.delete).toHaveBeenCalledWith(ids.event, ids.manager);
  });
});
