import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { faqTopics, faqs, permissionAuditLog } from '../../infrastructure/postgres/postgres.schema';

function changedFaqFields(input: {
  topicId?: string;
  questionKr?: string;
  questionEn?: string;
  answerKr?: string;
  answerEn?: string;
  displayOrder?: number;
  status?: 'DRAFT' | 'PUBLISHED';
}) {
  const fields = Object.entries(input)
    .filter(([key, value]) => value !== undefined && key !== 'actorUserId' && key !== 'now')
    .map(([key]) => {
      if (key === 'questionKr' || key === 'questionEn') return 'question';
      if (key === 'answerKr' || key === 'answerEn') return 'answer';
      return key;
    });
  return [...new Set(fields)].join(',');
}

@Injectable()
export class FaqsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  listPublic() {
    return this.db
      .select({ topic: faqTopics, faq: faqs })
      .from(faqTopics)
      .innerJoin(faqs, and(eq(faqs.topicId, faqTopics.id), eq(faqs.status, 'PUBLISHED')))
      .orderBy(asc(faqTopics.displayOrder), asc(faqs.displayOrder), asc(faqs.id));
  }

  async listAdmin() {
    const [topics, items] = await Promise.all([
      this.db.select().from(faqTopics).orderBy(asc(faqTopics.displayOrder), asc(faqTopics.id)),
      this.db.select().from(faqs).orderBy(asc(faqs.topicId), asc(faqs.displayOrder), asc(faqs.id)),
    ]);
    return { topics, items };
  }

  async createTopic(input: {
    actorUserId: string;
    titleKr: string;
    titleEn: string;
    displayOrder: number;
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('faq_topic_order_v1'))`);
      const [created] = await tx.insert(faqTopics).values({
        titleKr: input.titleKr,
        titleEn: input.titleEn,
        displayOrder: input.displayOrder,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: input.now,
        updatedAt: input.now,
      }).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'FAQ_TOPIC_CREATED',
        recordId: created.id,
        changedFieldNames: 'title,displayOrder',
        correlationId: created.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return created;
    });
  }

  async patchTopic(id: string, input: {
    actorUserId: string;
    titleKr?: string;
    titleEn?: string;
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.update(faqTopics).set({
        titleKr: input.titleKr,
        titleEn: input.titleEn,
        updatedByUserId: input.actorUserId,
        updatedAt: input.now,
      }).where(eq(faqTopics.id, id)).returning();
      if (!updated) return null;
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'FAQ_TOPIC_UPDATED',
        recordId: updated.id,
        changedFieldNames: 'title',
        correlationId: updated.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return updated;
    });
  }

  async deleteTopic(id: string, actorUserId: string): Promise<'deleted' | 'has_faqs' | 'missing'> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('faq_topic_order_v1'))`);
      const [topic] = await tx.select({ id: faqTopics.id }).from(faqTopics).where(eq(faqTopics.id, id)).for('update');
      if (!topic) return 'missing';
      const [child] = await tx.select({ id: faqs.id }).from(faqs).where(eq(faqs.topicId, id)).limit(1);
      if (child) return 'has_faqs';
      await tx.delete(faqTopics).where(eq(faqTopics.id, id));
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'FAQ_TOPIC_DELETED',
        recordId: topic.id,
        changedFieldNames: 'record',
        correlationId: topic.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return 'deleted';
    });
  }

  async reorderTopic(id: string, displayOrder: number, actorUserId: string, now: Date) {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('faq_topic_order_v1'))`);
      const topics = await tx.select({ id: faqTopics.id, displayOrder: faqTopics.displayOrder }).from(faqTopics)
        .orderBy(asc(faqTopics.displayOrder), asc(faqTopics.id)).for('update');
      const currentIndex = topics.findIndex((topic) => topic.id === id);
      if (currentIndex < 0) return null;
      if (displayOrder < 0 || displayOrder >= topics.length) return 'out_of_range' as const;
      if (currentIndex === displayOrder && topics.every((topic, index) => topic.displayOrder === index)) {
        const [unchanged] = await tx.select().from(faqTopics).where(eq(faqTopics.id, id)).limit(1);
        return unchanged!;
      }
      const originalDisplayOrders = new Map(topics.map((topic) => [topic.id, topic.displayOrder]));
      const usedOrders = new Set(topics.map((topic) => topic.displayOrder));
      const temporaryOrders: number[] = [];
      for (let candidate = topics.length; temporaryOrders.length < topics.length; candidate += 1) {
        if (!usedOrders.has(candidate)) temporaryOrders.push(candidate);
      }
      for (const [index, topic] of topics.entries()) {
        await tx.update(faqTopics).set({ displayOrder: temporaryOrders[index]! })
          .where(eq(faqTopics.id, topic.id));
      }
      const [moved] = topics.splice(currentIndex, 1);
      topics.splice(displayOrder, 0, moved!);
      for (const [index, topic] of topics.entries()) {
        const changed = originalDisplayOrders.get(topic.id) !== index;
        await tx.update(faqTopics).set(changed
          ? { displayOrder: index, updatedByUserId: actorUserId, updatedAt: now }
          : { displayOrder: index })
          .where(eq(faqTopics.id, topic.id));
      }
      const [updated] = await tx.select().from(faqTopics).where(eq(faqTopics.id, id)).limit(1);
      const changedTopicIds = topics
        .filter((topic, index) => originalDisplayOrders.get(topic.id) !== index)
        .map((topic) => topic.id);
      await tx.insert(permissionAuditLog).values(changedTopicIds.map((topicId) => ({
        actorUserId,
        action: 'FAQ_TOPIC_REORDERED',
        recordId: topicId,
        changedFieldNames: 'displayOrder',
        correlationId: id,
        reasonCode: 'FAQ_ADMIN',
      })));
      return updated!;
    });
  }

  async createFaq(input: {
    actorUserId: string;
    topicId: string;
    questionKr: string;
    questionEn: string;
    answerKr: string;
    answerEn: string;
    displayOrder: number;
    status: 'DRAFT' | 'PUBLISHED';
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(faqs).values({
        topicId: input.topicId,
        questionKr: input.questionKr,
        questionEn: input.questionEn,
        answerKr: input.answerKr,
        answerEn: input.answerEn,
        displayOrder: input.displayOrder,
        status: input.status,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: input.now,
        updatedAt: input.now,
      }).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'FAQ_CREATED',
        recordId: created.id,
        changedFieldNames: 'topicId,question,answer,displayOrder,status',
        correlationId: created.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return created;
    });
  }

  async patchFaq(id: string, input: {
    actorUserId: string;
    topicId?: string;
    questionKr?: string;
    questionEn?: string;
    answerKr?: string;
    answerEn?: string;
    displayOrder?: number;
    status?: 'DRAFT' | 'PUBLISHED';
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.update(faqs).set({
        topicId: input.topicId,
        questionKr: input.questionKr,
        questionEn: input.questionEn,
        answerKr: input.answerKr,
        answerEn: input.answerEn,
        displayOrder: input.displayOrder,
        status: input.status,
        updatedByUserId: input.actorUserId,
        updatedAt: input.now,
      }).where(eq(faqs.id, id)).returning();
      if (!updated) return null;
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.actorUserId,
        action: 'FAQ_UPDATED',
        recordId: updated.id,
        changedFieldNames: changedFaqFields(input),
        correlationId: updated.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return updated;
    });
  }

  async deleteFaq(id: string, actorUserId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [deleted] = await tx.delete(faqs).where(eq(faqs.id, id)).returning({ id: faqs.id });
      if (!deleted) return false;
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'FAQ_DELETED',
        recordId: deleted.id,
        changedFieldNames: 'record',
        correlationId: deleted.id,
        reasonCode: 'FAQ_ADMIN',
      });
      return true;
    });
  }
}
