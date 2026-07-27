import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { FaqsService } from '../src/features/faqs/faqs.service';

const actorId = '11111111-1111-4111-8111-111111111111';
const topicId = '22222222-2222-4222-8222-222222222222';
const faqId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-07-27T12:00:00.000Z');
const topic = (overrides = {}) => ({ id: topicId, titleKr: '한국어', titleEn: 'English', displayOrder: 0, createdByUserId: actorId, updatedByUserId: actorId, createdAt: now, updatedAt: now, ...overrides });
const faq = (overrides = {}) => ({ id: faqId, topicId, questionKr: '질문', questionEn: 'Question', answerKr: '답변', answerEn: 'Answer', displayOrder: 0, status: 'PUBLISHED' as const, createdByUserId: actorId, updatedByUserId: actorId, createdAt: now, updatedAt: now, ...overrides });
function setup(allowed = true) {
  const repository = { listPublic: vi.fn(), listAdmin: vi.fn(), createTopic: vi.fn(), patchTopic: vi.fn(), deleteTopic: vi.fn(), reorderTopic: vi.fn(), createFaq: vi.fn(), patchFaq: vi.fn(), deleteFaq: vi.fn() };
  const permissions = { hasPermission: vi.fn().mockResolvedValue(allowed) };
  return { repository, permissions, service: new FaqsService(repository as never, permissions as never, { now: () => now } as never) };
}

describe('FaqsService', () => {
  it('groups only repository-published rows deterministically and projects both locales', async () => {
    const { repository, service } = setup();
    repository.listPublic.mockResolvedValue([
      { topic: topic({ id: '44444444-4444-4444-8444-444444444444', displayOrder: 1, titleKr: '', titleEn: 'Second' }), faq: faq({ id: '55555555-5555-4555-8555-555555555555', questionKr: '', answerEn: '', displayOrder: 0 }) },
      { topic: topic(), faq: faq() },
    ]);
    await expect(service.listPublic('ko')).resolves.toEqual({ locale: 'ko', topics: [
      { id: topicId, title: { value: '한국어', translationUnavailable: false }, displayOrder: 0, items: [expect.objectContaining({ question: { value: '질문', translationUnavailable: false } })] },
      { id: '44444444-4444-4444-8444-444444444444', title: { value: null, translationUnavailable: true }, displayOrder: 1, items: [{ id: '55555555-5555-4555-8555-555555555555', question: { value: null, translationUnavailable: true }, answer: { value: '답변', translationUnavailable: false }, displayOrder: 0, updatedAt: now.toISOString() }] },
    ] });
    const en = await service.listPublic('en');
    expect(en.topics[0]!.items[0]!.question).toEqual({ value: 'Question', translationUnavailable: false });
    expect(en.topics[1]!.title).toEqual({ value: 'Second', translationUnavailable: false });
    await expect(service.listPublic('ja')).rejects.toMatchObject({ response: { message: 'invalid_locale' } });
  });

  it('requires exactly FAQ_MANAGE at GLOBAL before any admin disclosure or write', async () => {
    const { repository, permissions, service } = setup(false);
    await expect(service.listAdmin(actorId)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createTopic(actorId, { titleKr: '가', titleEn: 'A', displayOrder: 0 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissions.hasPermission).toHaveBeenCalledWith(actorId, 'FAQ_MANAGE', 'GLOBAL');
    expect(repository.listAdmin).not.toHaveBeenCalled(); expect(repository.createTopic).not.toHaveBeenCalled();
  });

  it('strictly validates missing, unknown-shaped, and bilingual FAQ/topic input', async () => {
    const { repository, service } = setup();
    for (const input of [{ titleKr: '가', displayOrder: 0 }, { titleKr: ' ', titleEn: 'A', displayOrder: 0 }, { titleKr: '가', titleEn: 'A', displayOrder: 2_147_483_648 }, {}, { topicId, questionKr: 'q', questionEn: 'e', answerKr: 'a', answerEn: 'b', displayOrder: -1, status: 'PUBLISHED' }]) {
      await expect(service.createTopic(actorId, input as never)).rejects.toMatchObject({ response: { message: /invalid_faq_(topic|order)/ } });
    }
    await expect(service.createFaq(actorId, { topicId, questionKr: 'q', questionEn: 'e', answerKr: 'a', answerEn: 'b', displayOrder: 0, status: 'NOPE' } as never)).rejects.toMatchObject({ response: { message: 'invalid_faq' } });
    await expect(service.patchFaq(actorId, faqId, {})).rejects.toMatchObject({ response: { message: 'invalid_faq' } });
    expect(repository.createFaq).not.toHaveBeenCalled();
  });

  it('uses the injected clock, actor as updatedBy, and maps write conflicts', async () => {
    const { repository, service } = setup();
    repository.createFaq.mockResolvedValue(faq()); repository.patchFaq.mockResolvedValue(faq({ updatedByUserId: actorId, status: 'DRAFT' }));
    await service.createFaq(actorId, { topicId, questionKr: ' q ', questionEn: ' e ', answerKr: ' a ', answerEn: ' b ', displayOrder: 0, status: 'PUBLISHED' });
    expect(repository.createFaq).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: actorId, questionKr: 'q', answerEn: 'b', now }));
    await service.patchFaq(actorId, faqId, { status: 'DRAFT' });
    expect(repository.patchFaq).toHaveBeenCalledWith(faqId, expect.objectContaining({ actorUserId: actorId, now }));
    repository.createTopic.mockRejectedValueOnce({ code: '23505' });
    await expect(service.createTopic(actorId, { titleKr: '가', titleEn: 'A', displayOrder: 0 })).rejects.toMatchObject({ response: { message: 'faq_order_conflict' } });
    repository.deleteTopic.mockRejectedValueOnce({ cause: { code: '40P01' } });
    await expect(service.deleteTopic(actorId, topicId))
      .rejects.toMatchObject({ response: { message: 'faq_topic_order_conflict' } });
  });

  it('handles create, patch, delete, nonempty topics, and reordered bounds', async () => {
    const { repository, service } = setup();
    repository.createTopic.mockResolvedValue(topic()); repository.patchTopic.mockResolvedValue(topic({ titleKr: '수정' })); repository.deleteTopic.mockResolvedValue('has_faqs'); repository.reorderTopic.mockResolvedValue('out_of_range'); repository.deleteFaq.mockResolvedValue(true);
    await expect(service.createTopic(actorId, { titleKr: '가', titleEn: 'A', displayOrder: 0 })).resolves.toMatchObject({ updatedByUserId: actorId });
    await expect(service.patchTopic(actorId, topicId, { titleKr: '수정' })).resolves.toMatchObject({ titleKr: '수정' });
    await expect(service.deleteTopic(actorId, topicId)).rejects.toMatchObject({ response: { message: 'faq_topic_not_empty' } });
    await expect(service.reorderTopic(actorId, topicId, 9)).rejects.toMatchObject({ response: { message: 'faq_topic_order_conflict' } });
    await expect(service.deleteFaq(actorId, faqId)).resolves.toBeUndefined();
  });
});
