import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';

import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { contentMatchers, events, permissionAuditLog, surveys } from '../../infrastructure/postgres/postgres.schema';

export type EventVisibility = 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE';

@Injectable()
export class EventsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  list(from: Date, to: Date, visibility: EventVisibility[]) {
    return this.db.select().from(events).where(and(
      lt(events.startAt, to),
      gt(events.endAt, from),
      inArray(events.visibility, visibility),
    )).orderBy(asc(events.startAt), asc(events.id)).limit(200);
  }

  async findVisibleById(id: string, visibility: EventVisibility[]) {
    const [event] = await this.db.select().from(events).where(and(
      eq(events.id, id),
      inArray(events.visibility, visibility),
    )).limit(1);
    return event ?? null;
  }

  async findById(id: string) {
    const [event] = await this.db.select().from(events).where(eq(events.id, id)).limit(1);
    return event ?? null;
  }
  async findPublicSurveyIdByEventId(eventId: string): Promise<string | null> {
    const [match] = await this.db
      .select({ surveyId: surveys.id })
      .from(contentMatchers)
      .innerJoin(surveys, eq(contentMatchers.surveyId, surveys.id))
      .where(and(
        eq(contentMatchers.eventId, eventId),
        isNull(contentMatchers.articleId),
        inArray(surveys.state, ['OPEN', 'SCHEDULED', 'CLOSED']),
      ))
      .orderBy(
        sql`case
          when ${surveys.state} = 'CLOSED' then 2
          when ${surveys.closesAt} is not null and ${surveys.closesAt} <= current_timestamp then 2
          when ${surveys.opensAt} is not null and ${surveys.opensAt} > current_timestamp then 1
          else 0
        end`,
        desc(contentMatchers.createdAt),
        desc(contentMatchers.id),
      )
      .limit(1);
    return match?.surveyId ?? null;
  }

  async create(input: typeof events.$inferInsert) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(events).values(input).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: input.createdByUserId,
        action: 'EVENT_CREATED',
        recordId: created.id,
        changedFieldNames: 'title,description,time,allDay,location,visibility',
        correlationId: created.id,
        reasonCode: 'EVENT_ADMIN',
      });
      return created;
    });
  }

  async patch(
    id: string,
    buildUpdate: (current: typeof events.$inferSelect) => {
      values: Partial<typeof events.$inferInsert>;
      changedFieldNames: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(events).where(eq(events.id, id)).for('update');
      if (!current) return null;
      const { values, changedFieldNames } = buildUpdate(current);
      const [updated] = await tx.update(events).set(values).where(eq(events.id, id)).returning();
      await tx.insert(permissionAuditLog).values({
        actorUserId: values.updatedByUserId!,
        action: 'EVENT_UPDATED',
        recordId: updated.id,
        changedFieldNames,
        correlationId: updated.id,
        reasonCode: 'EVENT_ADMIN',
      });
      return updated;
    });
  }

  async delete(id: string, actorUserId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [deleted] = await tx.delete(events).where(eq(events.id, id)).returning({ id: events.id });
      if (!deleted) return false;
      await tx.insert(permissionAuditLog).values({
        actorUserId,
        action: 'EVENT_DELETED',
        recordId: deleted.id,
        changedFieldNames: 'record',
        correlationId: deleted.id,
        reasonCode: 'EVENT_ADMIN',
      });
      return true;
    });
  }
}
