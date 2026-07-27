import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  AdminFaq,
  AdminFaqTopic,
  ContentLocale,
  CreateFaqRequest,
  CreateFaqTopicRequest,
  PatchFaqRequest,
  PatchFaqTopicRequest,
  PublicFaqListResponse,
} from '@soc/contracts';

import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { FaqsRepository } from './faqs.repository';

const MAX_TEXT_LENGTH = 20_000;

@Injectable()
export class FaqsService {
  constructor(
    @Inject(FaqsRepository) private readonly repository: FaqsRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(Clock) private readonly clock: Clock,
  ) {}

  async listPublic(locale: unknown): Promise<PublicFaqListResponse> {
    const normalizedLocale = this.locale(locale);
    const rows = await this.repository.listPublic();
    const topics = new Map<string, PublicFaqListResponse['topics'][number]>();
    for (const { topic, faq } of rows) {
      let projected = topics.get(topic.id);
      if (!projected) {
        projected = {
          id: topic.id,
          title: this.localize(normalizedLocale, topic.titleKr, topic.titleEn),
          displayOrder: topic.displayOrder,
          items: [],
        };
        topics.set(topic.id, projected);
      }
      projected.items.push({
        id: faq.id,
        question: this.localize(normalizedLocale, faq.questionKr, faq.questionEn),
        answer: this.localize(normalizedLocale, faq.answerKr, faq.answerEn),
        displayOrder: faq.displayOrder,
        updatedAt: faq.updatedAt.toISOString(),
      });
    }
    const orderedTopics = [...topics.values()]
      .map((topic) => ({
        ...topic,
        items: [...topic.items].sort((left, right) =>
          left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)),
      }))
      .sort((left, right) =>
        left.displayOrder - right.displayOrder || left.id.localeCompare(right.id));
    return { locale: normalizedLocale, topics: orderedTopics };
  }

  async listAdmin(actorUserId: string) {
    await this.requireManager(actorUserId);
    const rows = await this.repository.listAdmin();
    return {
      topics: rows.topics.map((topic) => this.adminTopic(topic)),
      items: rows.items.map((faq) => this.adminFaq(faq)),
    };
  }

  async createTopic(actorUserId: string, input: CreateFaqTopicRequest) {
    await this.requireManager(actorUserId);
    this.validateTopic(input, false);
    try {
      return this.adminTopic(await this.repository.createTopic({
        actorUserId,
        titleKr: input.titleKr.trim(),
        titleEn: input.titleEn.trim(),
        displayOrder: input.displayOrder,
        now: this.clock.now(),
      }));
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async patchTopic(actorUserId: string, id: string, input: PatchFaqTopicRequest) {
    await this.requireManager(actorUserId);
    this.validateTopic(input, true);
    const updated = await this.repository.patchTopic(id, {
      actorUserId,
      titleKr: input.titleKr?.trim(),
      titleEn: input.titleEn?.trim(),
      now: this.clock.now(),
    });
    if (!updated) throw new NotFoundException('faq_topic_not_found');
    return this.adminTopic(updated);
  }

  async deleteTopic(actorUserId: string, id: string): Promise<void> {
    await this.requireManager(actorUserId);
    try {
      const result = await this.repository.deleteTopic(id, actorUserId);
      if (result === 'missing') throw new NotFoundException('faq_topic_not_found');
      if (result === 'has_faqs') throw new ConflictException('faq_topic_not_empty');
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.mapWriteError(error, 'faq_topic_order_conflict');
    }
  }

  async reorderTopic(actorUserId: string, id: string, displayOrder: unknown) {
    await this.requireManager(actorUserId);
    this.requireOrder(displayOrder);
    try {
      const updated = await this.repository.reorderTopic(id, displayOrder, actorUserId, this.clock.now());
      if (!updated) throw new NotFoundException('faq_topic_not_found');
      if (updated === 'out_of_range') throw new ConflictException('faq_topic_order_conflict');
      return this.adminTopic(updated);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.mapWriteError(error, 'faq_topic_order_conflict');
    }
  }

  async createFaq(actorUserId: string, input: CreateFaqRequest) {
    await this.requireManager(actorUserId);
    this.validateFaq(input, false);
    try {
      return this.adminFaq(await this.repository.createFaq({
        actorUserId,
        topicId: input.topicId,
        questionKr: input.questionKr.trim(),
        questionEn: input.questionEn.trim(),
        answerKr: input.answerKr.trim(),
        answerEn: input.answerEn.trim(),
        displayOrder: input.displayOrder,
        status: input.status,
        now: this.clock.now(),
      }));
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async patchFaq(actorUserId: string, id: string, input: PatchFaqRequest) {
    await this.requireManager(actorUserId);
    this.validateFaq(input, true);
    try {
      const updated = await this.repository.patchFaq(id, {
        actorUserId,
        topicId: input.topicId,
        questionKr: input.questionKr?.trim(),
        questionEn: input.questionEn?.trim(),
        answerKr: input.answerKr?.trim(),
        answerEn: input.answerEn?.trim(),
        displayOrder: input.displayOrder,
        status: input.status,
        now: this.clock.now(),
      });
      if (!updated) throw new NotFoundException('faq_not_found');
      return this.adminFaq(updated);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.mapWriteError(error);
    }
  }

  async deleteFaq(actorUserId: string, id: string): Promise<void> {
    await this.requireManager(actorUserId);
    if (!(await this.repository.deleteFaq(id, actorUserId))) throw new NotFoundException('faq_not_found');
  }

  private locale(value: unknown): ContentLocale {
    if (value === undefined || value === 'ko') return 'ko';
    if (value === 'en') return 'en';
    throw new UnprocessableEntityException('invalid_locale');
  }

  private localize(locale: ContentLocale, kr: string, en: string) {
    const value = locale === 'ko' ? kr : en;
    return { value: value || null, translationUnavailable: !value };
  }

  private validateTopic(input: PatchFaqTopicRequest | CreateFaqTopicRequest, patch: boolean): void {
    if (!input || typeof input !== 'object') throw new UnprocessableEntityException('invalid_faq_topic');
    if (patch && Object.keys(input).length === 0) throw new UnprocessableEntityException('invalid_faq_topic');
    if ('titleKr' in input) this.requireText(input.titleKr, 'invalid_faq_topic');
    else if (!patch) throw new UnprocessableEntityException('invalid_faq_topic');
    if ('titleEn' in input) this.requireText(input.titleEn, 'invalid_faq_topic');
    else if (!patch) throw new UnprocessableEntityException('invalid_faq_topic');
    if ('displayOrder' in input) this.requireOrder(input.displayOrder);
    else if (!patch) throw new UnprocessableEntityException('invalid_faq_topic');
  }

  private validateFaq(input: PatchFaqRequest | CreateFaqRequest, patch: boolean): void {
    if (!input || typeof input !== 'object') throw new UnprocessableEntityException('invalid_faq');
    if (patch && Object.keys(input).length === 0) throw new UnprocessableEntityException('invalid_faq');
    const requiredText = ['questionKr', 'questionEn', 'answerKr', 'answerEn'] as const;
    for (const field of requiredText) {
      if (field in input) this.requireText(input[field], 'invalid_faq');
      else if (!patch) throw new UnprocessableEntityException('invalid_faq');
    }
    if ('topicId' in input) this.requireUuid(input.topicId, 'invalid_faq');
    else if (!patch) throw new UnprocessableEntityException('invalid_faq');
    if ('displayOrder' in input) this.requireOrder(input.displayOrder);
    else if (!patch) throw new UnprocessableEntityException('invalid_faq');
    if ('status' in input && input.status !== 'DRAFT' && input.status !== 'PUBLISHED') throw new UnprocessableEntityException('invalid_faq');
    if (!patch && !('status' in input)) throw new UnprocessableEntityException('invalid_faq');
  }

  private requireText(value: unknown, code: string): void {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) {
      throw new UnprocessableEntityException(code);
    }
  }

  private requireOrder(value: unknown): asserts value is number {
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 2_147_483_647) {
      throw new UnprocessableEntityException('invalid_faq_order');
    }
  }

  private requireUuid(value: unknown, code: string): asserts value is string {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new UnprocessableEntityException(code);
    }
  }

  private async requireManager(actorUserId: string): Promise<void> {
    if (!(await this.permissions.hasPermission(actorUserId, 'FAQ_MANAGE', 'GLOBAL'))) {
      throw new ForbiddenException('insufficient_permission');
    }
  }

  private mapWriteError(error: unknown, conflictCode = 'faq_order_conflict'): never {
    let current: unknown = error;
    let code: string | undefined;
    while (current && typeof current === 'object') {
      code = (current as { code?: string }).code;
      if (code) break;
      current = (current as { cause?: unknown }).cause;
    }
    if (code === '23505' || code === '40001' || code === '40P01') throw new ConflictException(conflictCode);
    if (code === '23503') throw new NotFoundException('faq_topic_not_found');
    if (code === '23514') throw new UnprocessableEntityException('invalid_faq');
    throw error;
  }

  private adminTopic(topic: {
    id: string; titleKr: string; titleEn: string; displayOrder: number;
    createdByUserId: string; updatedByUserId: string; createdAt: Date; updatedAt: Date;
  }): AdminFaqTopic {
    return { ...topic, createdAt: topic.createdAt.toISOString(), updatedAt: topic.updatedAt.toISOString() };
  }

  private adminFaq(faq: {
    id: string; topicId: string; questionKr: string; questionEn: string; answerKr: string; answerEn: string;
    displayOrder: number; status: 'DRAFT' | 'PUBLISHED'; createdByUserId: string; updatedByUserId: string;
    createdAt: Date; updatedAt: Date;
  }): AdminFaq {
    return { ...faq, createdAt: faq.createdAt.toISOString(), updatedAt: faq.updatedAt.toISOString() };
  }
}
