import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContactDto, ContactValues, CreateContactRequest, PatchContactRequest } from '@soc/contracts';
import { PiiCipherService } from '../../shared/security/pii-cipher.service';
import { Clock } from '../../shared/time/clock';
import { PermissionsService } from '../permissions/permissions.service';
import { ContactsRepository, type ContactCreateValues, type ContactRow } from './contacts.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORRELATION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REASON = /^[A-Z][A-Z0-9_]{1,63}$/;
const FIELDS = ['name', 'email', 'phone', 'affiliation', 'note', 'kaistUid', 'year', 'role'] as const;
const ENVELOPES = { name: 'nameEnvelope', email: 'emailEnvelope', phone: 'phoneEnvelope', affiliation: 'affiliationEnvelope', note: 'noteEnvelope', kaistUid: 'kaistUidEnvelope', year: 'yearEnvelope', role: 'roleEnvelope' } as const;

@Injectable()
export class ContactsService {
  constructor(
    @Inject(ContactsRepository) private readonly repository: ContactsRepository,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
    @Inject(PiiCipherService) private readonly cipher: PiiCipherService,
    @Inject(Clock) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}
  async list(actor: string, query: Record<string, unknown>, correlationId: string = randomUUID()) {
    await this.require(actor); const limit = query.limit === undefined ? 20 : this.limit(query.limit); const projection = query.projection === undefined ? 'MASKED' : query.projection;
    if (projection !== 'MASKED' && projection !== 'FULL') this.invalid('invalid_contact_projection');
    const includeDeleted = query.includeDeleted === undefined ? false : query.includeDeleted === 'true'; if (query.includeDeleted !== undefined && query.includeDeleted !== 'true' && query.includeDeleted !== 'false') this.invalid('invalid_contact_query');
    const cursor = query.cursor === undefined ? undefined : this.cursor(query.cursor);
    const audit = projection === 'FULL' ? { correlationId: this.correlation(correlationId), occurredAt: this.clock.now() } : undefined;
    const rows = await this.repository.list(actor, limit + 1, cursor, includeDeleted, audit);
    if (!rows) throw new ForbiddenException('insufficient_permission');
    const items = rows.slice(0, limit).map((row) => this.dto(row, projection)); const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url') : null };
  }
  async create(actor: string, input: CreateContactRequest, correlationId: string) { await this.require(actor); const values = this.createValues(input); const now = this.clock.now(); const retentionDeadlineAt = this.date(input.retentionDeadlineAt, this.deadline(now)); const holdUntil = this.optionalDate(input.holdUntil); this.future(retentionDeadlineAt, now); if (holdUntil) this.future(holdUntil, now); const persisted = { ...this.encrypt(values), retentionDeadlineAt, holdUntil, createdAt: now, updatedAt: now } as ContactCreateValues; const row = await this.repository.create(actor, persisted, { changedFieldNames: [...FIELDS, 'retentionDeadlineAt', 'holdUntil'].join(','), correlationId: this.correlation(correlationId), reasonCode: null, occurredAt: now }); if (!row) throw new ForbiddenException('insufficient_permission'); return { contact: this.dto(row, 'FULL') }; }
  async patch(actor: string, id: string, input: PatchContactRequest, correlationId: string) { await this.require(actor); this.id(id); const keys = Object.keys(input); if (!keys.length || keys.some((key) => ![...FIELDS, 'retentionDeadlineAt', 'holdUntil'].includes(key as never))) this.invalid('invalid_contact_patch'); const plain: Partial<ContactValues> = {}; for (const key of FIELDS) if (key in input) (plain as Record<string, string | null>)[key] = this.value(key, input[key]); const values: Record<string, unknown> = { ...this.encrypt(plain) }; const now = this.clock.now(); if ('retentionDeadlineAt' in input) { const retentionDeadlineAt = this.date(input.retentionDeadlineAt); this.future(retentionDeadlineAt, now); values.retentionDeadlineAt = retentionDeadlineAt; } if ('holdUntil' in input) { const holdUntil = this.optionalDate(input.holdUntil); if (holdUntil) this.future(holdUntil, now); values.holdUntil = holdUntil; } values.updatedAt = now; const row = await this.repository.patch(actor, id, values, { changedFieldNames: keys.join(','), correlationId: this.correlation(correlationId), reasonCode: null, occurredAt: now }); if (row === false) throw new ForbiddenException('insufficient_permission'); if (!row) throw new NotFoundException('contact_not_found'); return { contact: this.dto(row, 'FULL') }; }
  async delete(actor: string, id: string, reasonCode: unknown, correlationId: string) { await this.require(actor); this.id(id); if (typeof reasonCode !== 'string' || !REASON.test(reasonCode)) this.invalid('invalid_contact_reason'); const now = this.clock.now(); const result = await this.repository.softDelete(actor, id, now, this.deadline(now), { changedFieldNames: 'deletedAt', correlationId: this.correlation(correlationId), reasonCode, occurredAt: now }); if (result === null) throw new ForbiddenException('insufficient_permission'); if (!result) throw new NotFoundException('contact_not_found'); }
  async purge(limit: number, correlationId: string) { if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !CORRELATION.test(correlationId)) throw new Error('invalid_purge_input'); return this.repository.purge(limit, this.clock.now(), correlationId); }
  async mailRecipients(ids: string[]): Promise<string[]> {
    const rows = await this.repository.byIds(ids);
    if (rows.length !== ids.length) throw new NotFoundException('contact_not_found');
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => this.cipher.decrypt('email', byId.get(id)!.emailEnvelope)).filter((email): email is string => Boolean(email));
  }
  private createValues(input: CreateContactRequest): ContactValues { if (!input || typeof input !== 'object') this.invalid('invalid_contact'); const keys = Object.keys(input); if (keys.some((key) => ![...FIELDS, 'retentionDeadlineAt', 'holdUntil'].includes(key as never))) this.invalid('invalid_contact'); return Object.fromEntries(FIELDS.map((key) => [key, this.value(key, input[key])])) as unknown as ContactValues; }
  private value(field: string, value: unknown): string | null { if (field === 'name') { if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 512) this.invalid('invalid_contact_value'); return value.trim(); } if (value === null) return null; if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 8192) this.invalid('invalid_contact_value'); return value.trim(); }
  private encrypt(values: Partial<ContactValues>) { return Object.fromEntries(Object.entries(values).map(([key, value]) => [ENVELOPES[key as keyof typeof ENVELOPES], this.cipher.encrypt(key, value!)])); }
  private dto(row: ContactRow, projection: 'MASKED' | 'FULL'): ContactDto { const values = Object.fromEntries(FIELDS.map((key) => [key, this.cipher.decrypt(key, row[ENVELOPES[key]] as string | null)])) as unknown as ContactValues; const lifecycle = { id: row.id, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null, retentionDeadlineAt: row.retentionDeadlineAt.toISOString(), holdUntil: row.holdUntil?.toISOString() ?? null }; return projection === 'FULL' ? { ...lifecycle, ...values, projection: 'FULL' } : { ...lifecycle, projection: 'MASKED', ...values, name: values.name.slice(0, 1) + '***', email: values.email ? '***' : null, phone: values.phone ? '***' : null, affiliation: values.affiliation ? '***' : null, note: null, kaistUid: values.kaistUid ? '***' : null, year: values.year ? '***' : null, role: values.role ? '***' : null }; }
  private async require(actor: string) { if (!await this.permissions.hasPermission(actor, 'CONTACTS_MANAGE', 'GLOBAL')) throw new ForbiddenException('insufficient_permission'); }
  private id(value: string) { if (!UUID.test(value)) this.invalid('invalid_contact_id'); }
  private limit(value: unknown) { if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 50) this.invalid('invalid_contact_limit'); return Number(value); }
  private cursor(value: unknown) { try { if (typeof value !== 'string') throw new Error(); const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as { createdAt?: string; id?: string }; const createdAt = this.date(parsed.createdAt); this.id(parsed.id ?? ''); return { createdAt, id: parsed.id! }; } catch { this.invalid('invalid_contact_cursor'); } }
  private date(value: unknown, fallback?: Date) { if (value === undefined && fallback) return fallback; if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) this.invalid('invalid_contact_date'); const parsed = new Date(value); if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) this.invalid('invalid_contact_date'); return parsed; }
  private optionalDate(value: unknown) { return value === undefined || value === null ? null : this.date(value); }
  private future(value: Date, now: Date) { if (value < now) this.invalid('invalid_contact_date'); }
  private correlation(value: string) { if (!CORRELATION.test(value)) this.invalid('invalid_correlation_id'); return randomUUID(); }
  private deadline(now: Date) { const days = Number(this.config.get('CONTACT_PURGE_GRACE_DAYS') ?? 30); if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('invalid_contact_purge_grace_days'); return new Date(now.getTime() + days * 86400000); }
  private invalid(code: string): never { throw new UnprocessableEntityException(code); }
}
