import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { contactAuditLog, contacts, permissionDefinitions, permissionGrants } from '../../infrastructure/postgres/postgres.schema';

type Transaction = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];
export type ContactRow = typeof contacts.$inferSelect;
export type ContactCreateValues = Omit<typeof contacts.$inferInsert, 'createdByUserId' | 'updatedByUserId'>;

@Injectable()
export class ContactsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  list(actorUserId: string, limit: number, cursor?: { createdAt: Date; id: string }, includeDeleted = false, fullViewAudit?: FullViewAudit): Promise<ContactRow[] | null> {
    return this.db.transaction(async (tx) => {
      if (!await this.authorized(tx, actorUserId)) return null;
      const predicate = cursor ? or(gt(contacts.createdAt, cursor.createdAt), and(eq(contacts.createdAt, cursor.createdAt), gt(contacts.id, cursor.id))) : undefined;
      const rows = await tx.select().from(contacts).where(and(includeDeleted ? undefined : isNull(contacts.deletedAt), predicate)).orderBy(asc(contacts.createdAt), asc(contacts.id)).limit(limit);
      if (fullViewAudit) {
        for (const row of rows) {
          await this.audit(tx, row.id, actorUserId, 'CONTACT_FULL_VIEWED', FIELDS_VIEWED, fullViewAudit.correlationId, 'EXPLICIT_FULL_PROJECTION', fullViewAudit.occurredAt);
        }
      }
      return rows;
    });
  }

  async create(actorUserId: string, values: ContactCreateValues, audit: AuditInput): Promise<ContactRow | null> {
    return this.db.transaction(async (tx) => {
      if (!await this.authorized(tx, actorUserId)) return null;
      const [row] = await tx.insert(contacts).values({ ...values, createdByUserId: actorUserId, updatedByUserId: actorUserId }).returning();
      await this.audit(tx, row.id, actorUserId, 'CONTACT_CREATED', audit.changedFieldNames, audit.correlationId, audit.reasonCode, audit.occurredAt);
      return row;
    });
  }

  async patch(actorUserId: string, id: string, values: Partial<typeof contacts.$inferInsert>, audit: AuditInput): Promise<ContactRow | null | false> {
    return this.db.transaction(async (tx) => {
      if (!await this.authorized(tx, actorUserId)) return false;
      const [current] = await tx.select().from(contacts).where(eq(contacts.id, id)).for('update');
      if (!current || current.deletedAt) return null;
      const [row] = await tx.update(contacts).set({ ...values, updatedByUserId: actorUserId }).where(eq(contacts.id, id)).returning();
      await this.audit(tx, id, actorUserId, 'CONTACT_UPDATED', audit.changedFieldNames, audit.correlationId, audit.reasonCode, audit.occurredAt);
      return row;
    });
  }

  async softDelete(actorUserId: string, id: string, deletedAt: Date, retentionDeadlineAt: Date, audit: AuditInput): Promise<boolean | null> {
    return this.db.transaction(async (tx) => {
      if (!await this.authorized(tx, actorUserId)) return null;
      const [current] = await tx.select({ id: contacts.id, retentionDeadlineAt: contacts.retentionDeadlineAt }).from(contacts).where(eq(contacts.id, id)).for('update');
      if (!current) return false;
      const effectiveRetentionDeadline = current.retentionDeadlineAt > retentionDeadlineAt ? current.retentionDeadlineAt : retentionDeadlineAt;
      const result = await tx.update(contacts).set({ deletedAt, deletedByUserId: actorUserId, retentionDeadlineAt: effectiveRetentionDeadline, updatedAt: deletedAt, updatedByUserId: actorUserId }).where(and(eq(contacts.id, id), isNull(contacts.deletedAt))).returning({ id: contacts.id });
      if (!result[0]) return false;
      await this.audit(tx, id, actorUserId, 'CONTACT_DELETED', 'deletedAt', audit.correlationId, audit.reasonCode, deletedAt);
      return true;
    });
  }

  async purge(limit: number, now: Date, correlationId: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const rows = await tx.select({ id: contacts.id }).from(contacts).where(and(lte(contacts.retentionDeadlineAt, now), sql`${contacts.deletedAt} IS NOT NULL`, or(isNull(contacts.holdUntil), lte(contacts.holdUntil, now)))).orderBy(asc(contacts.retentionDeadlineAt), asc(contacts.id)).limit(limit).for('update', { skipLocked: true });
      for (const row of rows) {
        await tx.delete(contacts).where(eq(contacts.id, row.id));
        await this.audit(tx, row.id, null, 'CONTACT_PURGED', 'deletedAt', correlationId, null, now, 'contact-purge');
      }
      return rows.length;
    });
  }

  private async authorized(tx: Transaction, actorUserId: string): Promise<boolean> {
    const [row] = await tx.select({ id: permissionGrants.id }).from(permissionGrants).innerJoin(permissionDefinitions, eq(permissionGrants.permissionDefinitionId, permissionDefinitions.id)).where(and(eq(permissionGrants.userId, actorUserId), eq(permissionDefinitions.key, 'CONTACTS_MANAGE'), eq(permissionDefinitions.isActive, true), eq(permissionGrants.scope, 'GLOBAL'), isNull(permissionGrants.revokedAt), lte(permissionGrants.activatedFrom, sql`now()`), or(isNull(permissionGrants.expiresAt), gt(permissionGrants.expiresAt, sql`now()`)))).limit(1).for('update');
    return Boolean(row);
  }

  private audit(tx: Transaction, contactId: string, actorUserId: string | null, action: string, changedFieldNames: string, correlationId: string, reasonCode: string | null, occurredAt: Date, actorSystemIdentity: string | null = null) {
    return tx.insert(contactAuditLog).values({ contactId, actorUserId, actorSystemIdentity, action, changedFieldNames, correlationId, reasonCode, occurredAt });
  }
}

type AuditInput = { changedFieldNames: string; correlationId: string; reasonCode: string | null; occurredAt: Date };
type FullViewAudit = { correlationId: string; occurredAt: Date };
const FIELDS_VIEWED = 'name,email,phone,affiliation,note,kaistUid,year,role';
